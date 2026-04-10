
/*
  ============================================
  GRAVITY.JS — SPICE-DRIVEN SOLAR SYSTEM GRAVITY SIMULATOR
  ============================================

  What this file does:
  - Loads real solar-system body states from SPICE through spice-integration.js
  - Computes gravity from those bodies on a spacecraft
  - Returns:
      (a) total gravitational acceleration
      (b) per-body gravity contributions
  - Propagates the spacecraft with RK4
  - Lets you query gravity at any given ephemeris time (ET)

  Units used:
  - distance: km
  - time: s
  - velocity: km/s
  - acceleration: km/s^2
  - mu: km^3/s^2
  - SPICE ET: seconds past J2000 TDB

  IMPORTANT:
  - This is still a Newtonian point-mass gravity model for the spacecraft.
  - The planets/moon/sun are NOT numerically integrated here.
    Their positions come from SPICE kernels.
  - This is usually the correct architecture:
      SPICE = environment truth
      Your simulator = spacecraft dynamics
*/

const path = require("path");
const {
  Vec3,
  StateVector,
  createSpiceEnvironment,
} = require("./spice-integration");

/* =========================
   1) Spacecraft state
   ========================= */
class SpacecraftState {
  constructor(position, velocity, time = 0) {
    this.position = position;
    this.velocity = velocity;
    this.time = time; // ET in seconds
  }

  clone() {
    return new SpacecraftState(
      new Vec3(this.position.x, this.position.y, this.position.z),
      new Vec3(this.velocity.x, this.velocity.y, this.velocity.z),
      this.time
    );
  }

  toString() {
    return `SpacecraftState(pos=${this.position.toString()}, vel=${this.velocity.toString()}, time=${this.time})`;
  }
}

/* =========================
   2) SPICE-backed body
   =========================
   A body is queried from SPICE at any ET.
*/
class SpiceBody {
  constructor({
    name,
    mu,
    radii = null,
    stateProvider,
  }) {
    this.name = name;
    this.mu = mu;
    this.radii = radii;
    this._stateProvider = stateProvider;
  }

  stateAt(et) {
    return this._stateProvider(et);
  }

  positionAt(et) {
    return this.stateAt(et).position;
  }

  velocityAt(et) {
    return this.stateAt(et).velocity;
  }
}

/* =========================
   3) Gravity calculations
   =========================

   Standard point-mass gravity from one body:

   a_i = -mu_i * (r_ship - r_body) / |r_ship - r_body|^3
*/
function gravityFromBody(shipPosition, body, et, softening = 0) {
  if (body.mu == null || !Number.isFinite(body.mu)) {
    throw new Error(`Body ${body.name} does not have a valid gravitational parameter (mu).`);
  }

  const bodyPosition = body.positionAt(et);
  const dr = shipPosition.sub(bodyPosition);

  const r2 = dr.magnitudeSquared() + softening * softening;
  const r = Math.sqrt(r2);

  if (r === 0) {
    throw new Error(`Ship is exactly at body center: ${body.name}`);
  }

  const factor = -body.mu / (r2 * r); // = -mu / r^3
  const acceleration = dr.scale(factor);

  return {
    body: body.name,
    bodyPosition,
    relativeVector: dr,
    distance: r,
    mu: body.mu,
    acceleration,
    radii: body.radii,
  };
}

function gravityBreakdown(shipPosition, bodies, et, softening = 0) {
  const contributions = [];
  let totalAcceleration = new Vec3(0, 0, 0);

  for (const body of bodies) {
    const contrib = gravityFromBody(shipPosition, body, et, softening);
    contributions.push(contrib);
    totalAcceleration = totalAcceleration.add(contrib.acceleration);
  }

  return {
    time: et,
    shipPosition,
    totalAcceleration,
    contributions,
  };
}

function totalGravity(shipPosition, bodies, et, softening = 0) {
  return gravityBreakdown(shipPosition, bodies, et, softening).totalAcceleration;
}

/* =========================
   4) State derivative
   =========================
*/
function stateDerivative(state, bodies, softening = 0, extraAccelerationFn = null) {
  let accel = totalGravity(state.position, bodies, state.time, softening);

  if (typeof extraAccelerationFn === "function") {
    const extra = extraAccelerationFn(state, bodies);
    if (extra) {
      accel = accel.add(extra);
    }
  }

  return {
    dPosition: state.velocity,
    dVelocity: accel,
    dTime: 1,
  };
}

function applyDerivative(state, deriv, dt) {
  return new SpacecraftState(
    state.position.add(deriv.dPosition.scale(dt)),
    state.velocity.add(deriv.dVelocity.scale(dt)),
    state.time + deriv.dTime * dt
  );
}

/* =========================
   5) RK4 integrator
   ========================= */
function rk4Step(state, bodies, dt, softening = 0, extraAccelerationFn = null) {
  const k1 = stateDerivative(state, bodies, softening, extraAccelerationFn);
  const k2 = stateDerivative(applyDerivative(state, k1, dt / 2), bodies, softening, extraAccelerationFn);
  const k3 = stateDerivative(applyDerivative(state, k2, dt / 2), bodies, softening, extraAccelerationFn);
  const k4 = stateDerivative(applyDerivative(state, k3, dt), bodies, softening, extraAccelerationFn);

  const newPosition = state.position
    .add(k1.dPosition.scale(dt / 6))
    .add(k2.dPosition.scale(dt / 3))
    .add(k3.dPosition.scale(dt / 3))
    .add(k4.dPosition.scale(dt / 6));

  const newVelocity = state.velocity
    .add(k1.dVelocity.scale(dt / 6))
    .add(k2.dVelocity.scale(dt / 3))
    .add(k3.dVelocity.scale(dt / 3))
    .add(k4.dVelocity.scale(dt / 6));

  return new SpacecraftState(newPosition, newVelocity, state.time + dt);
}

/* =========================
   6) Gravity simulator
   ========================= */
class GravitySimulator {
  constructor(bodies, options = {}) {
    this.bodies = bodies;
    this.softening = options.softening ?? 0;
    this.extraAccelerationFn = options.extraAccelerationFn ?? null;
  }

  getBodyStates(et) {
    return this.bodies.map((body) => {
      const state = body.stateAt(et);
      return {
        name: body.name,
        mu: body.mu,
        radii: body.radii,
        position: state.position,
        velocity: state.velocity,
      };
    });
  }

  getBodyPositions(et) {
    return this.bodies.map((body) => ({
      name: body.name,
      position: body.positionAt(et),
    }));
  }

  getGravityAt(shipPosition, et) {
    return gravityBreakdown(shipPosition, this.bodies, et, this.softening);
  }

  stepShip(state, dt) {
    return rk4Step(
      state,
      this.bodies,
      dt,
      this.softening,
      this.extraAccelerationFn
    );
  }

  simulateShip(initialState, dt, steps) {
    const history = [];
    let state = initialState.clone();

    for (let i = 0; i < steps; i++) {
      const gravity = this.getGravityAt(state.position, state.time);

      history.push({
        step: i,
        time: state.time,
        position: state.position,
        velocity: state.velocity,
        totalAcceleration: gravity.totalAcceleration,
        contributions: gravity.contributions,
      });

      state = this.stepShip(state, dt);
    }

    history.push({
      step: steps,
      time: state.time,
      position: state.position,
      velocity: state.velocity,
      totalAcceleration: this.getGravityAt(state.position, state.time).totalAcceleration,
      contributions: this.getGravityAt(state.position, state.time).contributions,
    });

    return history;
  }
}

/* =========================
   7) SPICE body builder
   =========================

   Creates SpiceBody objects using the same frame/origin conventions
   as spice-integration.js.
*/
async function buildSpiceBodies({
  kernelPaths,
  bodyNames,
  refFrame = "J2000",
  observer = "SOLAR SYSTEM BARYCENTER",
  abcorr = "NONE",
}) {
  const spice = await createSpiceEnvironment();

  spice.loadStandardSolarSystemKernels({
    lsk: kernelPaths.lsk,
    pck: kernelPaths.pck,
    spk: kernelPaths.spk,
    extra: kernelPaths.extra ?? [],
  });

  const bodies = bodyNames.map((bodyName) => {
    let mu = null;
    let radii = null;

    try {
      mu = spice.geometry.getGM(bodyName);
    } catch (err) {
      // leave null if unavailable
    }

    try {
      radii = spice.geometry.getRadii(bodyName);
    } catch (err) {
      // leave null if unavailable
    }

    return new SpiceBody({
      name: bodyName,
      mu,
      radii,
      stateProvider: (et) => {
        const result = spice.geometry.getState(
          bodyName,
          et,
          refFrame,
          abcorr,
          observer
        );
        return result.state;
      },
    });
  });

  return {
    spice,
    bodies,
    refFrame,
    observer,
    abcorr,
  };
}

/* =========================
   8) Convenience builder
   ========================= */
async function buildGravitySimulatorFromSpice({
  kernelPaths,
  bodyNames = [
    "SUN",
    "MERCURY BARYCENTER",
    "VENUS BARYCENTER",
    "EARTH",
    "MOON",
    "MARS BARYCENTER",
    "JUPITER BARYCENTER",
  ],
  refFrame = "J2000",
  observer = "SOLAR SYSTEM BARYCENTER",
  abcorr = "NONE",
  softening = 0,
  extraAccelerationFn = null,
}) {
  const { spice, bodies } = await buildSpiceBodies({
    kernelPaths,
    bodyNames,
    refFrame,
    observer,
    abcorr,
  });

  const simulator = new GravitySimulator(bodies, {
    softening,
    extraAccelerationFn,
  });

  return {
    spice,
    simulator,
    bodies,
    refFrame,
    observer,
    abcorr,
  };
}

/* =========================
   9) Utility helpers
   ========================= */

function ensureAllBodiesHaveMu(bodies) {
  const missing = bodies.filter((b) => !(Number.isFinite(b.mu)));
  if (missing.length > 0) {
    throw new Error(
      `These bodies are missing GM/mu values in loaded kernels: ${missing.map((b) => b.name).join(", ")}`
    );
  }
}

function formatContribution(contrib) {
  return [
    `Body: ${contrib.body}`,
    `  Body position: ${contrib.bodyPosition.toString()}`,
    `  Distance: ${contrib.distance}`,
    `  Mu: ${contrib.mu}`,
    `  Acceleration from body: ${contrib.acceleration.toString()}`,
  ].join("\n");
}

/* =========================
   10) Example usage
   =========================

   IMPORTANT:
   Replace the kernel file names with the ones you actually downloaded.
*/
async function main() {
  const kernelDir = path.resolve("./kernels");

  const kernelPaths = {
    lsk: path.join(kernelDir, "naif0012.tls"),
    pck: path.join(kernelDir, "gm_de440.tpc"),
    spk: path.join(kernelDir, "de440s.bsp"),
    extra: [],
  };

  const {
    spice,
    simulator,
    bodies,
  } = await buildGravitySimulatorFromSpice({
    kernelPaths,
    bodyNames: [
      "SUN",
      "MERCURY BARYCENTER",
      "VENUS BARYCENTER",
      "EARTH",
      "MOON",
      "MARS BARYCENTER",
      "JUPITER BARYCENTER",
    ],
    refFrame: "J2000",
    observer: "SOLAR SYSTEM BARYCENTER",
    abcorr: "NONE",
    softening: 0,
  });

  ensureAllBodiesHaveMu(bodies);

  // Example time
  const et0 = spice.time.utcToEt("2026-04-10T12:00:00 UTC");

  // Example spacecraft state:
  // near Earth's orbit, heliocentric-ish initial velocity
  const ship = new SpacecraftState(
    new Vec3(149_597_870.7 + 20_000, 0, 0),
    new Vec3(0, 29.8, 0),
    et0
  );

  const gravityNow = simulator.getGravityAt(ship.position, ship.time);

  console.log("=== GRAVITY AT CURRENT MOMENT ===");
  console.log("ET:", gravityNow.time);
  console.log("UTC:", spice.time.etToUtc(gravityNow.time, "ISOC", 3));
  console.log("Ship position:", gravityNow.shipPosition.toString());
  console.log("Total acceleration:", gravityNow.totalAcceleration.toString());

  for (const c of gravityNow.contributions) {
    console.log(formatContribution(c));
  }

  const dt = 60;   // seconds
  const steps = 20;

  const history = simulator.simulateShip(ship, dt, steps);

  console.log("\n=== SHIP TRAJECTORY ===");
  for (const h of history) {
    console.log(`Step ${h.step}`);
    console.log(`  ET: ${h.time}`);
    console.log(`  UTC: ${spice.time.etToUtc(h.time, "ISOC", 3)}`);
    console.log(`  Position: ${h.position.toString()}`);
    console.log(`  Velocity: ${h.velocity.toString()}`);
    console.log(`  Total acceleration: ${h.totalAcceleration.toString()}`);
  }

  // Optional cleanup
  // spice.kernels.clearKernelPool();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  SpacecraftState,
  SpiceBody,
  GravitySimulator,
  gravityFromBody,
  gravityBreakdown,
  totalGravity,
  stateDerivative,
  applyDerivative,
  rk4Step,
  buildSpiceBodies,
  buildGravitySimulatorFromSpice,
  ensureAllBodiesHaveMu,
  formatContribution,
};
