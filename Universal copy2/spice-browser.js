/*
  spice-browser.js
  Browser-friendly SPICE-style helper for solar system visualizations.

  What this does:
  - works in plain browser JS
  - no Node.js require/fs/path/module.exports
  - gives you time conversion helpers
  - gives approximate heliocentric states for planets
  - gives body constants like radius and GM
  - keeps a SPICE-like structure so your app can grow later

  What this does NOT do:
  - it is not real NAIF CSPICE precision
  - it does not load .bsp / .tls / .tpc kernels
  - it does not need a backend
*/

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

  norm() {
    return Math.hypot(this.x, this.y, this.z);
  }

  unit() {
    const n = this.norm();
    return n === 0 ? new Vec3(0, 0, 0) : this.scale(1 / n);
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

const AU_KM = 149597870.7;
const DAY_SEC = 86400;
const J2000_MS = Date.parse("2000-01-01T12:00:00Z");

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function normalizeAngleRad(a) {
  const twoPi = Math.PI * 2;
  a = a % twoPi;
  if (a < 0) a += twoPi;
  return a;
}

function solveKepler(meanAnomaly, eccentricity, iterations = 8) {
  let E = meanAnomaly;
  for (let i = 0; i < iterations; i++) {
    E = E - (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
  }
  return E;
}

/*
  Approximate orbital elements at/near J2000.
  Units:
  - a in AU
  - angles in degrees
  - orbitalPeriodDays in Earth days
  - radiusKm mean radius
  - GM in km^3/s^2
*/
const BODY_DATA = {
  SUN: {
    radiusKm: 696340,
    GM: 132712440018,
    color: "#ffb347"
  },
  MERCURY: {
    a: 0.38709927,
    e: 0.20563593,
    i: 7.00497902,
    L: 252.25032350,
    longPeri: 77.45779628,
    longNode: 48.33076593,
    orbitalPeriodDays: 87.969,
    radiusKm: 2439.7,
    GM: 22031.86855,
    color: "#b7b7b7"
  },
  VENUS: {
    a: 0.72333566,
    e: 0.00677672,
    i: 3.39467605,
    L: 181.97909950,
    longPeri: 131.60246718,
    longNode: 76.67984255,
    orbitalPeriodDays: 224.701,
    radiusKm: 6051.8,
    GM: 324858.592,
    color: "#d8b26e"
  },
  EARTH: {
    a: 1.00000261,
    e: 0.01671123,
    i: 0.00001531,
    L: 100.46457166,
    longPeri: 102.93768193,
    longNode: 0.0,
    orbitalPeriodDays: 365.256,
    radiusKm: 6371.0,
    GM: 398600.435436,
    color: "#4da6ff"
  },
  MARS: {
    a: 1.52371034,
    e: 0.09339410,
    i: 1.84969142,
    L: -4.55343205,
    longPeri: -23.94362959,
    longNode: 49.55953891,
    orbitalPeriodDays: 686.980,
    radiusKm: 3389.5,
    GM: 42828.375214,
    color: "#d96b4d"
  },
  JUPITER: {
    a: 5.20288700,
    e: 0.04838624,
    i: 1.30439695,
    L: 34.39644051,
    longPeri: 14.72847983,
    longNode: 100.47390909,
    orbitalPeriodDays: 4332.589,
    radiusKm: 69911,
    GM: 126686534.911,
    color: "#d9b38c"
  },
  SATURN: {
    a: 9.53667594,
    e: 0.05386179,
    i: 2.48599187,
    L: 49.95424423,
    longPeri: 92.59887831,
    longNode: 113.66242448,
    orbitalPeriodDays: 10759.22,
    radiusKm: 58232,
    GM: 37931207.8,
    color: "#e7d28d"
  },
  URANUS: {
    a: 19.18916464,
    e: 0.04725744,
    i: 0.77263783,
    L: 313.23810451,
    longPeri: 170.95427630,
    longNode: 74.01692503,
    orbitalPeriodDays: 30688.5,
    radiusKm: 25362,
    GM: 5793951.3,
    color: "#8fe3ff"
  },
  NEPTUNE: {
    a: 30.06992276,
    e: 0.00859048,
    i: 1.77004347,
    L: -55.12002969,
    longPeri: 44.96476227,
    longNode: 131.78422574,
    orbitalPeriodDays: 60182,
    radiusKm: 24622,
    GM: 6835099.5,
    color: "#4b70dd"
  }
};

class SpiceTime {
  utcToEt(utcString) {
    const ms = Date.parse(utcString);
    if (Number.isNaN(ms)) {
      throw new Error(`Invalid UTC string: ${utcString}`);
    }
    return (ms - J2000_MS) / 1000;
  }

  etToUtc(et, format = "ISOC", precision = 3) {
    const date = new Date(J2000_MS + et * 1000);
    if (format === "ISOC" || format === "ISOD" || format === "C") {
      const iso = date.toISOString();
      if (precision >= 3) return iso;
      const base = iso.replace(/\.\d{3}Z$/, "Z");
      return base;
    }
    return date.toISOString();
  }

  etToDate(et) {
    return new Date(J2000_MS + et * 1000);
  }

  dateToEt(date) {
    return (date.getTime() - J2000_MS) / 1000;
  }
}

class SpiceGeometry {
  constructor() {}

  getBodyConstants(bodyName, item) {
    const body = BODY_DATA[bodyName.toUpperCase()];
    if (!body) throw new Error(`Unknown body: ${bodyName}`);

    if (item === "GM") return [body.GM];
    if (item === "RADII") {
      const r = body.radiusKm;
      return [r, r, r];
    }

    throw new Error(`Unsupported item: ${item}`);
  }

  getGM(bodyName) {
    return this.getBodyConstants(bodyName, "GM")[0];
  }

  getRadii(bodyName) {
    const [a, b, c] = this.getBodyConstants(bodyName, "RADII");
    return { a, b, c };
  }

  getRotationMatrix(fromFrame, toFrame) {
    if (fromFrame === toFrame) {
      return [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
      ];
    }

    throw new Error(`Only identity frame transform is supported right now: ${fromFrame} -> ${toFrame}`);
  }

  rotateVector(matrix3x3, vec3) {
    const [r0, r1, r2] = matrix3x3;
    return new Vec3(
      r0[0] * vec3.x + r0[1] * vec3.y + r0[2] * vec3.z,
      r1[0] * vec3.x + r1[1] * vec3.y + r1[2] * vec3.z,
      r2[0] * vec3.x + r2[1] * vec3.y + r2[2] * vec3.z
    );
  }

  computePlanetHeliocentricState(bodyName, et) {
    const name = bodyName.toUpperCase();

    if (name === "SUN") {
      return {
        state: new StateVector(new Vec3(0, 0, 0), new Vec3(0, 0, 0)),
        lightTimeSeconds: 0
      };
    }

    const body = BODY_DATA[name];
    if (!body || !body.a) {
      throw new Error(`No orbital model for body: ${bodyName}`);
    }

    const aKm = body.a * AU_KM;
    const e = body.e;
    const i = degToRad(body.i);
    const Omega = degToRad(body.longNode);
    const omega = degToRad(body.longPeri - body.longNode);
    const M0 = degToRad(body.L - body.longPeri);

    const n = (2 * Math.PI) / (body.orbitalPeriodDays * DAY_SEC);
    const M = normalizeAngleRad(M0 + n * et);
    const E = solveKepler(M, e);

    const xOrb = aKm * (Math.cos(E) - e);
    const yOrb = aKm * Math.sqrt(1 - e * e) * Math.sin(E);

    const r = Math.sqrt(xOrb * xOrb + yOrb * yOrb);

    const dEdt = n / (1 - e * Math.cos(E));
    const vxOrb = -aKm * Math.sin(E) * dEdt;
    const vyOrb = aKm * Math.sqrt(1 - e * e) * Math.cos(E) * dEdt;

    const cosO = Math.cos(Omega);
    const sinO = Math.sin(Omega);
    const cosI = Math.cos(i);
    const sinI = Math.sin(i);
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);

    const R11 = cosO * cosW - sinO * sinW * cosI;
    const R12 = -cosO * sinW - sinO * cosW * cosI;
    const R13 = sinO * sinI;

    const R21 = sinO * cosW + cosO * sinW * cosI;
    const R22 = -sinO * sinW + cosO * cosW * cosI;
    const R23 = -cosO * sinI;

    const R31 = sinW * sinI;
    const R32 = cosW * sinI;
    const R33 = cosI;

    const x = R11 * xOrb + R12 * yOrb;
    const y = R21 * xOrb + R22 * yOrb;
    const z = R31 * xOrb + R32 * yOrb;

    const vx = R11 * vxOrb + R12 * vyOrb;
    const vy = R21 * vxOrb + R22 * vyOrb;
    const vz = R31 * vxOrb + R32 * vyOrb;

    return {
      state: new StateVector(new Vec3(x, y, z), new Vec3(vx, vy, vz)),
      lightTimeSeconds: r / 299792.458
    };
  }

  getState(target, et, refFrame = "J2000", abcorr = "NONE", observer = "SUN") {
    if (refFrame !== "J2000") {
      throw new Error(`Only J2000 is supported in this browser version right now.`);
    }

    if (abcorr !== "NONE") {
      console.warn("Browser version ignores aberration correction. Using NONE.");
    }

    const targetName = target.toUpperCase();
    const observerName = observer.toUpperCase();

    const targetState = this.computePlanetHeliocentricState(targetName, et).state;
    const observerState = this.computePlanetHeliocentricState(observerName, et).state;

    return {
      state: new StateVector(
        targetState.position.sub(observerState.position),
        targetState.velocity.sub(observerState.velocity)
      ),
      lightTimeSeconds: targetState.position.sub(observerState.position).norm() / 299792.458
    };
  }

  getPosition(target, et, refFrame = "J2000", abcorr = "NONE", observer = "SUN") {
    return this.getState(target, et, refFrame, abcorr, observer).state.position;
  }

  getVelocity(target, et, refFrame = "J2000", abcorr = "NONE", observer = "SUN") {
    return this.getState(target, et, refFrame, abcorr, observer).state.velocity;
  }

  getRelativeState(target, observer, et, refFrame = "J2000", abcorr = "NONE") {
    return this.getState(target, et, refFrame, abcorr, observer);
  }
}

class SpiceEnvironment {
  constructor() {
    this.time = new SpiceTime();
    this.geometry = new SpiceGeometry();
    this.kernels = {
      loadKernel: () => console.warn("Browser version does not load NAIF kernels."),
      loadKernels: () => console.warn("Browser version does not load NAIF kernels."),
      clearKernelPool: () => {},
      listLoadedKernels: () => []
    };
  }

  loadStandardSolarSystemKernels() {
    console.warn("Browser version uses built-in approximate solar-system data instead of kernel files.");
    return [];
  }

  getBodyBarycentricState(bodyName, et, refFrame = "J2000") {
    return this.geometry.getState(bodyName, et, refFrame, "NONE", "SUN");
  }

  getBodyHeliocentricState(bodyName, et, refFrame = "J2000") {
    return this.geometry.getState(bodyName, et, refFrame, "NONE", "SUN");
  }

  getBodyGeocentricState(bodyName, et, refFrame = "J2000") {
    return this.geometry.getState(bodyName, et, refFrame, "NONE", "EARTH");
  }

  getPhysicsBodies(bodyNames, et, {
    refFrame = "J2000",
    observer = "SUN",
    abcorr = "NONE"
  } = {}) {
    return bodyNames.map((name) => {
      const { state } = this.geometry.getState(name, et, refFrame, abcorr, observer);

      let mu = null;
      let radii = null;

      try {
        mu = this.geometry.getGM(name);
      } catch {}

      try {
        radii = this.geometry.getRadii(name);
      } catch {}

      return {
        name,
        mu,
        position: state.position,
        velocity: state.velocity,
        radii,
        refFrame,
        observer,
        et
      };
    });
  }

  getBodyInfo(bodyName) {
    const body = BODY_DATA[bodyName.toUpperCase()];
    if (!body) throw new Error(`Unknown body: ${bodyName}`);
    return { ...body };
  }
}

function createSpiceEnvironment() {
  return new SpiceEnvironment();
}

window.Vec3 = Vec3;
window.StateVector = StateVector;
window.SpiceTime = SpiceTime;
window.SpiceGeometry = SpiceGeometry;
window.SpiceEnvironment = SpiceEnvironment;
window.createSpiceEnvironment = createSpiceEnvironment;
