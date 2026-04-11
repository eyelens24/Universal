

"use strict";

const fs = require("fs");
const path = require("path");
const { createMockSpiceEnvironment } = require("./mock-spice");

/**
 * Change this if your generated CSPICE module lives elsewhere.
 * This module should export an async factory, e.g.:
 *   const cSpice = require("./cspice.node.js");
 *   const instance = await cSpice();
 */
function loadCSpiceFactory() {
  try {
    return require("./cspice.node.js");
  } catch (error) {
    if (error && error.code === "MODULE_NOT_FOUND") {
      throw new Error(
        "Missing ./cspice.node.js. Build or add the Node-compatible CSPICE wrapper before creating a SPICE environment."
      );
    }
    throw error;
  }
}

// ---------- Small math helpers ----------

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
  }

  static fromArray(a) {
    return new Vec3(a[0], a[1], a[2]);
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  add(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s) {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  magnitudeSquared() {
    return this.dot(this);
  }

  norm() {
    return Math.hypot(this.x, this.y, this.z);
  }

  magnitude() {
    return this.norm();
  }

  unit() {
    const n = this.norm();
    if (n === 0) return new Vec3(0, 0, 0);
    return this.scale(1 / n);
  }

  toString() {
    return `Vec3(${this.x}, ${this.y}, ${this.z})`;
  }
}

class StateVector {
  constructor(position = new Vec3(), velocity = new Vec3()) {
    this.position = position;
    this.velocity = velocity;
  }

  toString() {
    return `StateVector(pos=${this.position.toString()}, vel=${this.velocity.toString()})`;
  }
}

// ---------- Low-level string and memory helpers ----------

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Kernel file not found: ${filePath}`);
  }
}

function normalizeKernelPath(p) {
  return path.resolve(p).replace(/\\/g, "/");
}

/**
 * Generic wrapper around Emscripten ccall.
 */
function call(instance, fnName, returnType, argTypes, args) {
  return instance.ccall(fnName, returnType, argTypes, args);
}

/**
 * Allocate a C string buffer, write string into it, and return pointer.
 */
function writeCString(instance, str) {
  const len = Buffer.byteLength(str, "utf8") + 1;
  const ptr = instance._malloc(len);
  instance.stringToUTF8(str, ptr, len);
  return ptr;
}

/**
 * Read a C string from pointer.
 */
function readCString(instance, ptr) {
  return instance.UTF8ToString(ptr);
}

/**
 * Allocate a C double array and optionally initialize it.
 */
function mallocDoubleArray(instance, length, values = null) {
  const bytes = length * Float64Array.BYTES_PER_ELEMENT;
  const ptr = instance._malloc(bytes);
  if (values) {
    instance.HEAPF64.set(values, ptr / Float64Array.BYTES_PER_ELEMENT);
  }
  return ptr;
}

function readDoubleArray(instance, ptr, length) {
  const start = ptr / Float64Array.BYTES_PER_ELEMENT;
  return Array.from(instance.HEAPF64.subarray(start, start + length));
}

function mallocIntArray(instance, length, values = null) {
  const bytes = length * Int32Array.BYTES_PER_ELEMENT;
  const ptr = instance._malloc(bytes);
  if (values) {
    instance.HEAP32.set(values, ptr / Int32Array.BYTES_PER_ELEMENT);
  }
  return ptr;
}

function readInt(instance, ptr) {
  return instance.HEAP32[ptr / Int32Array.BYTES_PER_ELEMENT];
}

function readDouble(instance, ptr) {
  return instance.HEAPF64[ptr / Float64Array.BYTES_PER_ELEMENT];
}

function freeAll(instance, ptrs) {
  for (const ptr of ptrs) {
    if (ptr) instance._free(ptr);
  }
}

/**
 * Optional helper if your build exports failed_c / getmsg_c / reset_c.
 * If not exported, this safely does nothing.
 */
function makeErrorChecker(instance) {
  return {
    check() {
      try {
        const failed = call(instance, "failed_c", "number", [], []);
        if (!failed) return;

        const shortPtr = writeCString(instance, "SHORT");
        const explainPtr = writeCString(instance, "EXPLAIN");
        const longPtr = writeCString(instance, "LONG");

        const shortOut = instance._malloc(1841);
        const explainOut = instance._malloc(1841);
        const longOut = instance._malloc(1841);

        call(instance, "getmsg_c", null, ["number", "number", "number"], [shortPtr, 1840, shortOut]);
        call(instance, "getmsg_c", null, ["number", "number", "number"], [explainPtr, 1840, explainOut]);
        call(instance, "getmsg_c", null, ["number", "number", "number"], [longPtr, 1840, longOut]);

        const msg = [
          readCString(instance, shortOut),
          readCString(instance, explainOut),
          readCString(instance, longOut),
        ].filter(Boolean).join(" | ");

        call(instance, "reset_c", null, [], []);
        freeAll(instance, [shortPtr, explainPtr, longPtr, shortOut, explainOut, longOut]);

        throw new Error(`SPICE error: ${msg}`);
      } catch (err) {
        if (String(err.message || err).startsWith("SPICE error:")) {
          throw err;
        }
        // If failed_c/getmsg_c are not exported, do not block usage.
      }
    }
  };
}

// ---------- Main integration class ----------

class SpiceKernelManager {
  constructor(instance) {
    this.instance = instance;
    this.error = makeErrorChecker(instance);
    this.loadedKernelPaths = [];
    this.virtualKernelRoot = "/kernels";
  }

  /**
   * Sets up an in-memory /kernels directory and copies files into the Emscripten FS.
   * You can call this once, then furnsh_c those in-FS paths.
   */
  ensureKernelDir() {
    try {
      this.instance.FS.mkdir(this.virtualKernelRoot);
    } catch (err) {
      // already exists
    }
  }

  /**
   * Copy a host file into the Emscripten virtual FS.
   */
  copyKernelToVirtualFS(hostPath, virtualFilename = null) {
    assertFileExists(hostPath);
    this.ensureKernelDir();

    const src = normalizeKernelPath(hostPath);
    const filename = virtualFilename || path.basename(src);
    const dest = `${this.virtualKernelRoot}/${filename}`;

    const data = fs.readFileSync(src);

    try {
      this.instance.FS.unlink(dest);
    } catch (err) {
      // ignore if it does not exist
    }

    this.instance.FS.writeFile(dest, data);
    return dest;
  }

  /**
   * Load one kernel into SPICE.
   */
  loadKernel(hostPath, virtualFilename = null) {
    const vpath = this.copyKernelToVirtualFS(hostPath, virtualFilename);
    const ptr = writeCString(this.instance, vpath);

    try {
      call(this.instance, "furnsh_c", null, ["number"], [ptr]);
      this.error.check();
      this.loadedKernelPaths.push(vpath);
      return vpath;
    } finally {
      freeAll(this.instance, [ptr]);
    }
  }

  /**
   * Load multiple kernels in order.
   * Order matters.
   */
  loadKernels(hostPaths) {
    return hostPaths.map((p) => this.loadKernel(p));
  }

  unloadKernelByVirtualPath(virtualPath) {
    const ptr = writeCString(this.instance, virtualPath);
    try {
      call(this.instance, "unload_c", null, ["number"], [ptr]);
      this.error.check();
      this.loadedKernelPaths = this.loadedKernelPaths.filter((p) => p !== virtualPath);
    } finally {
      freeAll(this.instance, [ptr]);
    }
  }

  clearKernelPool() {
    call(this.instance, "kclear_c", null, [], []);
    this.error.check();
    this.loadedKernelPaths = [];
  }

  listLoadedKernels() {
    return [...this.loadedKernelPaths];
  }
}

class SpiceTime {
  constructor(instance) {
    this.instance = instance;
    this.error = makeErrorChecker(instance);
  }

  /**
   * Convert UTC string to ephemeris time (ET, seconds past J2000 TDB).
   * Example UTC:
   * - "2026-04-10T12:00:00"
   * - "2026-04-10 12:00:00 UTC"
   */
  utcToEt(utcString) {
    const utcPtr = writeCString(this.instance, utcString);
    const etPtr = mallocDoubleArray(this.instance, 1);

    try {
      call(this.instance, "str2et_c", null, ["number", "number"], [utcPtr, etPtr]);
      this.error.check();
      return readDouble(this.instance, etPtr);
    } finally {
      freeAll(this.instance, [utcPtr, etPtr]);
    }
  }

  /**
   * Convert ET back to UTC string.
   * format can be "C", "D", "J", "ISOC", "ISOD"
   */
  etToUtc(et, format = "ISOC", precision = 3) {
    const formatPtr = writeCString(this.instance, format);
    const outPtr = this.instance._malloc(128);

    try {
      call(this.instance, "et2utc_c", null, ["number", "number", "number", "number"], [et, formatPtr, precision, outPtr]);
      this.error.check();
      return readCString(this.instance, outPtr);
    } finally {
      freeAll(this.instance, [formatPtr, outPtr]);
    }
  }
}

class SpiceGeometry {
  constructor(instance) {
    this.instance = instance;
    this.error = makeErrorChecker(instance);
  }

  /**
   * Get target state relative to observer.
   *
   * target, observer, refFrame, abcorr are SPICE names:
   *   target:   "MARS", "EARTH", "MOON", "SUN", spacecraft name/id if kernels support it
   *   observer: "SOLAR SYSTEM BARYCENTER", "SUN", "EARTH", etc.
   *   refFrame: "J2000", "ECLIPJ2000", "IAU_EARTH", etc.
   *   abcorr:   "NONE" for simulation/dynamics, or "LT", "LT+S" for apparent geometry
   */
  getState(target, et, refFrame = "J2000", abcorr = "NONE", observer = "SOLAR SYSTEM BARYCENTER") {
    const targetPtr = writeCString(this.instance, target);
    const framePtr = writeCString(this.instance, refFrame);
    const abcorrPtr = writeCString(this.instance, abcorr);
    const observerPtr = writeCString(this.instance, observer);

    const statePtr = mallocDoubleArray(this.instance, 6);
    const ltPtr = mallocDoubleArray(this.instance, 1);

    try {
      call(
        this.instance,
        "spkezr_c",
        null,
        ["number", "number", "number", "number", "number", "number", "number"],
        [targetPtr, et, framePtr, abcorrPtr, observerPtr, statePtr, ltPtr]
      );
      this.error.check();

      const s = readDoubleArray(this.instance, statePtr, 6);
      return {
        state: new StateVector(
          new Vec3(s[0], s[1], s[2]),
          new Vec3(s[3], s[4], s[5])
        ),
        lightTimeSeconds: readDouble(this.instance, ltPtr),
      };
    } finally {
      freeAll(this.instance, [targetPtr, framePtr, abcorrPtr, observerPtr, statePtr, ltPtr]);
    }
  }

  getPosition(target, et, refFrame = "J2000", abcorr = "NONE", observer = "SOLAR SYSTEM BARYCENTER") {
    return this.getState(target, et, refFrame, abcorr, observer).state.position;
  }

  getVelocity(target, et, refFrame = "J2000", abcorr = "NONE", observer = "SOLAR SYSTEM BARYCENTER") {
    return this.getState(target, et, refFrame, abcorr, observer).state.velocity;
  }

  /**
   * Rotation matrix from one frame to another at ET.
   */
  getRotationMatrix(fromFrame, toFrame, et) {
    const fromPtr = writeCString(this.instance, fromFrame);
    const toPtr = writeCString(this.instance, toFrame);
    const matPtr = mallocDoubleArray(this.instance, 9);

    try {
      call(this.instance, "pxform_c", null, ["number", "number", "number", "number"], [fromPtr, toPtr, et, matPtr]);
      this.error.check();

      const m = readDoubleArray(this.instance, matPtr, 9);
      return [
        [m[0], m[1], m[2]],
        [m[3], m[4], m[5]],
        [m[6], m[7], m[8]],
      ];
    } finally {
      freeAll(this.instance, [fromPtr, toPtr, matPtr]);
    }
  }

  rotateVector(matrix3x3, vec3) {
    const [r0, r1, r2] = matrix3x3;
    return new Vec3(
      r0[0] * vec3.x + r0[1] * vec3.y + r0[2] * vec3.z,
      r1[0] * vec3.x + r1[1] * vec3.y + r1[2] * vec3.z,
      r2[0] * vec3.x + r2[1] * vec3.y + r2[2] * vec3.z
    );
  }

  /**
   * Body constants from kernel pool, e.g. GM or RADII.
   */
  getBodyConstants(bodyName, item, maxn = 16) {
    const bodyPtr = writeCString(this.instance, bodyName);
    const itemPtr = writeCString(this.instance, item);

    const dimPtr = mallocIntArray(this.instance, 1);
    const valsPtr = mallocDoubleArray(this.instance, maxn);

    try {
      call(
        this.instance,
        "bodvrd_c",
        null,
        ["number", "number", "number", "number", "number"],
        [bodyPtr, itemPtr, maxn, dimPtr, valsPtr]
      );
      this.error.check();

      const n = readInt(this.instance, dimPtr);
      return readDoubleArray(this.instance, valsPtr, n);
    } finally {
      freeAll(this.instance, [bodyPtr, itemPtr, dimPtr, valsPtr]);
    }
  }

  getGM(bodyName) {
    const values = this.getBodyConstants(bodyName, "GM", 1);
    return values[0];
  }

  getRadii(bodyName) {
    const values = this.getBodyConstants(bodyName, "RADII", 3);
    return {
      a: values[0],
      b: values[1],
      c: values[2],
    };
  }

  /**
   * Relative state of target w.r.t observer in a chosen frame, no aberration by default.
   */
  getRelativeState(target, observer, et, refFrame = "J2000", abcorr = "NONE") {
    return this.getState(target, et, refFrame, abcorr, observer);
  }
}

// ---------- Higher-level simulator adapter ----------

class SpiceEnvironment {
  constructor(instance) {
    this.instance = instance;
    this.kernels = new SpiceKernelManager(instance);
    this.time = new SpiceTime(instance);
    this.geometry = new SpiceGeometry(instance);
  }

  /**
   * Load a standard solar-system kernel set.
   *
   * Suggested order:
   * 1) leapseconds
   * 2) planetary constants
   * 3) planetary ephemeris SPK
   * 4) anything more specific after that
   */
  loadStandardSolarSystemKernels({
    lsk,
    pck,
    spk,
    extra = [],
  }) {
    const ordered = [lsk, pck, spk, ...extra].filter(Boolean);
    return this.kernels.loadKernels(ordered);
  }

  /**
   * Query a body's inertial state relative to the Solar System Barycenter.
   */
  getBodyBarycentricState(bodyName, et, refFrame = "J2000") {
    return this.geometry.getState(bodyName, et, refFrame, "NONE", "SOLAR SYSTEM BARYCENTER");
  }

  /**
   * Query a body's heliocentric state.
   */
  getBodyHeliocentricState(bodyName, et, refFrame = "J2000") {
    return this.geometry.getState(bodyName, et, refFrame, "NONE", "SUN");
  }

  /**
   * Query a body's geocentric state.
   */
  getBodyGeocentricState(bodyName, et, refFrame = "J2000") {
    return this.geometry.getState(bodyName, et, refFrame, "NONE", "EARTH");
  }

  /**
   * Builds a simple "physics bodies" array for your gravity simulator.
   * Each body includes name, GM (mu), position, velocity, radii, and frame/origin metadata.
   */
  getPhysicsBodies(bodyNames, et, {
    refFrame = "J2000",
    observer = "SOLAR SYSTEM BARYCENTER",
    abcorr = "NONE",
  } = {}) {
    return bodyNames.map((name) => {
      const { state } = this.geometry.getState(name, et, refFrame, abcorr, observer);

      let mu = null;
      let radii = null;

      try {
        mu = this.geometry.getGM(name);
      } catch (err) {
        // Some bodies may lack GM in current kernels.
      }

      try {
        radii = this.geometry.getRadii(name);
      } catch (err) {
        // Some bodies may lack tri-axial radii in current kernels.
      }

      return {
        name,
        mu,
        position: state.position,
        velocity: state.velocity,
        radii,
        refFrame,
        observer,
        et,
      };
    });
  }
}

// ---------- Bootstrapping ----------

/**
 * Create and initialize the SPICE environment.
 *
 * Expected exported CSPICE functions in your build:
 * - furnsh_c
 * - unload_c
 * - kclear_c
 * - str2et_c
 * - et2utc_c
 * - spkezr_c
 * - pxform_c
 * - bodvrd_c
 *
 * Strongly recommended:
 * - failed_c
 * - getmsg_c
 * - reset_c
 */
async function createSpiceEnvironment() {
  try {
    const createCSpice = loadCSpiceFactory();
    const instance = await createCSpice();
    return new SpiceEnvironment(instance);
  } catch (error) {
    if (
      error &&
      typeof error.message === "string" &&
      error.message.includes("Missing ./cspice.node.js")
    ) {
      return createMockSpiceEnvironment();
    }
    throw error;
  }
}

// ---------- Example usage ----------

async function example() {
  const spice = await createSpiceEnvironment();

  // Change these to your local kernel paths.
  const kernelDir = path.resolve("./kernels");

  const lsk = path.join(kernelDir, "naif0012.tls");
  const pck = path.join(kernelDir, "gm_de440.tpc");
  const spk = path.join(kernelDir, "de440s.bsp");

  spice.loadStandardSolarSystemKernels({ lsk, pck, spk });

  const et = spice.time.utcToEt("2026-04-10T12:00:00 UTC");

  const earth = spice.getBodyBarycentricState("EARTH", et);
  const mars = spice.getBodyBarycentricState("MARS", et);
  const moonGM = spice.geometry.getGM("MOON");
  const earthRadii = spice.geometry.getRadii("EARTH");

  console.log("ET:", et);
  console.log("Earth barycentric:", earth.state.toString());
  console.log("Mars barycentric:", mars.state.toString());
  console.log("Moon GM (km^3/s^2):", moonGM);
  console.log("Earth radii (km):", earthRadii);

  const bodies = spice.getPhysicsBodies(
    ["SUN", "MERCURY BARYCENTER", "VENUS BARYCENTER", "EARTH", "MOON", "MARS BARYCENTER", "JUPITER BARYCENTER"],
    et
  );

  console.log("\nPhysics body pack:");
  for (const b of bodies) {
    console.log({
      name: b.name,
      mu: b.mu,
      pos: b.position.toArray(),
      vel: b.velocity.toArray(),
      radii: b.radii,
      frame: b.refFrame,
      observer: b.observer,
    });
  }

  const rot = spice.geometry.getRotationMatrix("J2000", "IAU_EARTH", et);
  console.log("\nJ2000 -> IAU_EARTH rotation:");
  console.log(rot);

  spice.kernels.clearKernelPool();
}

if (require.main === module) {
  example().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  Vec3,
  StateVector,
  SpiceKernelManager,
  SpiceTime,
  SpiceGeometry,
  SpiceEnvironment,
  createSpiceEnvironment,
};
