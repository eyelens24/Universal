"use strict";

/*
  ============================================
  SOLAR SYSTEM GRAVITY SIMULATOR
  ============================================

  What this code does:
  - Models bodies moving on simple circular orbits
  - Computes gravity from each body on a spaceship
  - Returns both:
      (a) total gravitational acceleration
      (b) per-body gravity contributions
  - Propagates the ship forward in time with RK4
  - Lets you query gravity at any given time

  Recommended units:
  - distance: km
  - time: s
  - velocity: km/s
  - acceleration: km/s^2
  - mu: km^3/s^2

  Important:
  - This is a Newtonian point-mass model.
  - Planet orbits here are simplified circular demo orbits.
  - For higher realism, replace orbit functions with ephemeris data.
*/


/* =========================
   1) 3D vector class
   ========================= */
class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
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

  magnitude() {
    return Math.sqrt(this.magnitudeSquared());
  }

  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return new Vec3(0, 0, 0);
    return this.scale(1 / mag);
  }

  toObject() {
    return { x: this.x, y: this.y, z: this.z };
  }

  toString() {
    return `(${this.x}, ${this.y}, ${this.z})`;
  }
}


/* =========================
   2) Celestial body
   =========================
   Variables:
   - name: label, e.g. "Earth"
   - mu: gravitational parameter = G*M
   - getPosition(t): returns body position at time t
*/
class Body {
  constructor(name, mu, getPosition) {
    this.name = name;
    this.mu = mu;
    this.getPosition = getPosition;
  }

  positionAt(t) {
    return this.getPosition(t);
  }
}


/* =========================
   3) Spacecraft state
   =========================
   Variables:
   - position: ship location (x, y, z)
   - velocity: ship velocity (vx, vy, vz)
   - time: current time
*/
class SpacecraftState {
  constructor(position, velocity, time = 0) {
    this.position = position;
    this.velocity = velocity;
    this.time = time;
  }

  clone() {
    return new SpacecraftState(
      new Vec3(this.position.x, this.position.y, this.position.z),
      new Vec3(this.velocity.x, this.velocity.y, this.velocity.z),
      this.time
    );
  }
}


/* =========================
   4) Orbit helpers
   ========================= */

/*
  Make a body move on a circular orbit in the xy-plane.

  Variables:
  - radius: orbital radius from center body
  - period: orbital period
  - phase: starting angle in radians
  - centerFn(t): returns the center position, usually the Sun at origin
*/
function makeCircularOrbitBody({
  name,
  mu,
  radius,
  period,
  phase = 0,
  centerFn = () => new Vec3(0, 0, 0)
}) {
  const angularRate = (2 * Math.PI) / period;

  return new Body(name, mu, (t) => {
    const center = centerFn(t);
    const theta = angularRate * t + phase;

    return center.add(
      new Vec3(
        radius * Math.cos(theta),
        radius * Math.sin(theta),
        0
      )
    );
  });
}


/* =========================
   5) Gravity calculations
   =========================

   Standard point-mass gravity from one body:

   a_i = -mu_i * (r_ship - r_body) / |r_ship - r_body|^3

   Variables:
   - r_ship: spaceship position
   - r_body: body position at time t
   - mu: body gravity strength
   - dr: vector from body to ship
   - distance: separation magnitude
*/
function gravityFromBody(shipPosition, body, t, softening = 0) {
  const bodyPosition = body.positionAt(t);
  const dr = shipPosition.sub(bodyPosition);

  // Optional tiny softening to avoid singularity if extremely close.
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
    acceleration
  };
}


/*
  Compute full gravity breakdown at a given time.

  Returns:
  - totalAcceleration
  - contributions: array of each body's gravity effect
*/
function gravityBreakdown(shipPosition, bodies, t, softening = 0) {
  const contributions = [];
  let totalAcceleration = new Vec3(0, 0, 0);

  for (const body of bodies) {
    const contrib = gravityFromBody(shipPosition, body, t, softening);
    contributions.push(contrib);
    totalAcceleration = totalAcceleration.add(contrib.acceleration);
  }

  return {
    time: t,
    shipPosition,
    totalAcceleration,
    contributions
  };
}


/*
  Convenience: get only the total gravitational acceleration.
*/
function totalGravity(shipPosition, bodies, t, softening = 0) {
  return gravityBreakdown(shipPosition, bodies, t, softening).totalAcceleration;
}


/* =========================
   6) State derivative
   =========================

   For the ship:
   d(position)/dt = velocity
   d(velocity)/dt = totalGravity(position, t)
   d(time)/dt     = 1
*/
function stateDerivative(state, bodies, softening = 0) {
  return {
    dPosition: state.velocity,
    dVelocity: totalGravity(state.position, bodies, state.time, softening),
    dTime: 1
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
   7) RK4 integrator
   =========================

   More accurate than Euler.
*/
function rk4Step(state, bodies, dt, softening = 0) {
  const k1 = stateDerivative(state, bodies, softening);
  const k2 = stateDerivative(applyDerivative(state, k1, dt / 2), bodies, softening);
  const k3 = stateDerivative(applyDerivative(state, k2, dt / 2), bodies, softening);
  const k4 = stateDerivative(applyDerivative(state, k3, dt), bodies, softening);

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
   8) Simulator wrapper
   ========================= */
class GravitySimulator {
  constructor(bodies, options = {}) {
    this.bodies = bodies;
    this.softening = options.softening ?? 0;
  }

  getBodyPositions(t) {
    return this.bodies.map(body => ({
      name: body.name,
      position: body.positionAt(t)
    }));
  }

  getGravityAt(shipPosition, t) {
    return gravityBreakdown(shipPosition, this.bodies, t, this.softening);
  }

  stepShip(state, dt) {
    return rk4Step(state, this.bodies, dt, this.softening);
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
        contributions: gravity.contributions
      });

      state = this.stepShip(state, dt);
    }

    return history;
  }
}


/* =========================
   9) Example solar system
   =========================

   These are common gravitational parameters in km^3/s^2.
*/
const MU_SUN   = 132712440018.0;
const MU_MERC  = 22031.86855;
const MU_VENUS = 324858.592;
const MU_EARTH = 398600.4418;
const MU_MARS  = 42828.375214;
const MU_JUP   = 126686534.0;

// Orbital radii in km (very simplified circular averages)
const AU = 149_597_870.7;

const PERIOD_DAY = 24 * 3600;
const PERIOD_YEAR = 365.25 * PERIOD_DAY;

// Sun fixed at origin
const sun = new Body("Sun", MU_SUN, () => new Vec3(0, 0, 0));

// Simple circular orbits around Sun
const mercury = makeCircularOrbitBody({
  name: "Mercury",
  mu: MU_MERC,
  radius: 0.387 * AU,
  period: 87.969 * PERIOD_DAY,
  phase: 0.3
});

const venus = makeCircularOrbitBody({
  name: "Venus",
  mu: MU_VENUS,
  radius: 0.723 * AU,
  period: 224.701 * PERIOD_DAY,
  phase: 1.2
});

const earth = makeCircularOrbitBody({
  name: "Earth",
  mu: MU_EARTH,
  radius: 1.0 * AU,
  period: 365.25 * PERIOD_DAY,
  phase: 0
});

const mars = makeCircularOrbitBody({
  name: "Mars",
  mu: MU_MARS,
  radius: 1.524 * AU,
  period: 686.98 * PERIOD_DAY,
  phase: 0.8
});

const jupiter = makeCircularOrbitBody({
  name: "Jupiter",
  mu: MU_JUP,
  radius: 5.203 * AU,
  period: 4332.59 * PERIOD_DAY,
  phase: 2.0
});

// Add whichever bodies you want included in the force model
const bodies = [sun, mercury, venus, earth, mars, jupiter];


/* =========================
   10) Example usage
   ========================= */
const simulator = new GravitySimulator(bodies, {
  // Set to small positive number if you want numerical softening near centers
  softening: 0
});

// Example ship state:
// Start near Earth's orbit, with a roughly heliocentric tangential velocity
let ship = new SpacecraftState(
  new Vec3(AU + 20_000, 0, 0),
  new Vec3(0, 29.8, 0),
  0
);

// Query gravity at any given moment
const gravityNow = simulator.getGravityAt(ship.position, ship.time);

console.log("=== GRAVITY AT CURRENT MOMENT ===");
console.log("Time:", gravityNow.time);
console.log("Ship position:", gravityNow.shipPosition.toString());
console.log("Total acceleration:", gravityNow.totalAcceleration.toString());

for (const c of gravityNow.contributions) {
  console.log(`Body: ${c.body}`);
  console.log(`  Body position: ${c.bodyPosition.toString()}`);
  console.log(`  Distance: ${c.distance}`);
  console.log(`  Acceleration from body: ${c.acceleration.toString()}`);
}

// Propagate ship forward
const dt = 60; // 60 seconds per step
const steps = 20;

const history = simulator.simulateShip(ship, dt, steps);

console.log("=== SHIP TRAJECTORY ===");
for (const h of history) {
  console.log(`Step ${h.step}`);
  console.log(`  Time: ${h.time}`);
  console.log(`  Position: ${h.position.toString()}`);
  console.log(`  Velocity: ${h.velocity.toString()}`);
  console.log(`  Total acceleration: ${h.totalAcceleration.toString()}`);
}
