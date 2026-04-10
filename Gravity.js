// Simple 3D n-body gravity model for a spacecraft.
// Units should be consistent.
// Example choice:
// - position: kilometers
// - velocity: kilometers / second
// - mu: km^3 / s^2
// - time: seconds

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

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return new Vec3(0, 0, 0);
    return this.scale(1 / mag);
  }
}

class Body {
  constructor(name, position, mu) {
    this.name = name;
    this.position = position; // Vec3
    this.mu = mu;             // gravitational parameter GM
  }
}

class Spacecraft {
  constructor(position, velocity) {
    this.position = position; // Vec3
    this.velocity = velocity; // Vec3
  }
}

/**
 * Acceleration on spacecraft from one body:
 * a = -mu * (r_sc - r_body) / |r_sc - r_body|^3
 */
function gravityFromBody(spacecraftPos, body) {
  const dr = spacecraftPos.sub(body.position); // vector from body to spacecraft
  const distance = dr.magnitude();

  if (distance === 0) {
    throw new Error(`Spacecraft is at the exact position of ${body.name}`);
  }

  const factor = -body.mu / Math.pow(distance, 3);
  return dr.scale(factor);
}

/**
 * Total gravitational acceleration from all bodies.
 */
function totalGravity(spacecraftPos, bodies) {
  let total = new Vec3(0, 0, 0);

  for (const body of bodies) {
    total = total.add(gravityFromBody(spacecraftPos, body));
  }

  return total;
}

/**
 * One Euler integration step.
 * Good for understanding, but not very accurate for serious simulation.
 */
function stepEuler(spacecraft, bodies, dt) {
  const accel = totalGravity(spacecraft.position, bodies);

  spacecraft.velocity = spacecraft.velocity.add(accel.scale(dt));
  spacecraft.position = spacecraft.position.add(spacecraft.velocity.scale(dt));

  return accel;
}

/**
 * Better: RK4 integrator for state [position, velocity]
 */
function stepRK4(spacecraft, bodies, dt) {
  const r0 = spacecraft.position;
  const v0 = spacecraft.velocity;

  function accelerationAt(pos) {
    return totalGravity(pos, bodies);
  }

  // k1
  const k1_r = v0;
  const k1_v = accelerationAt(r0);

  // k2
  const r_k2 = r0.add(k1_r.scale(dt / 2));
  const v_k2 = v0.add(k1_v.scale(dt / 2));
  const k2_r = v_k2;
  const k2_v = accelerationAt(r_k2);

  // k3
  const r_k3 = r0.add(k2_r.scale(dt / 2));
  const v_k3 = v0.add(k2_v.scale(dt / 2));
  const k3_r = v_k3;
  const k3_v = accelerationAt(r_k3);

  // k4
  const r_k4 = r0.add(k3_r.scale(dt));
  const v_k4 = v0.add(k3_v.scale(dt));
  const k4_r = v_k4;
  const k4_v = accelerationAt(r_k4);

  const newR = r0.add(
    k1_r.scale(dt / 6)
      .add(k2_r.scale(dt / 3))
      .add(k3_r.scale(dt / 3))
      .add(k4_r.scale(dt / 6))
  );

  const newV = v0.add(
    k1_v.scale(dt / 6)
      .add(k2_v.scale(dt / 3))
      .add(k3_v.scale(dt / 3))
      .add(k4_v.scale(dt / 6))
  );

  spacecraft.position = newR;
  spacecraft.velocity = newV;

  return accelerationAt(newR);
}

// -------------------------
// Example usage
// -------------------------

// Example mu values in km^3/s^2
const SUN_MU = 132712440018;
const EARTH_MU = 398600.4418;
const MARS_MU = 42828.375214;

// Example positions in km in some common reference frame
const bodies = [
  new Body("Sun", new Vec3(0, 0, 0), SUN_MU),
  new Body("Earth", new Vec3(149_600_000, 0, 0), EARTH_MU),
  new Body("Mars", new Vec3(227_900_000, 0, 0), MARS_MU)
];

// Example spacecraft
const spacecraft = new Spacecraft(
  new Vec3(149_600_000 + 10_000, 2_000, 0),
  new Vec3(0, 29.78, 0) // rough heliocentric speed near Earth in km/s
);

// Simulate
const dt = 60; // 60 seconds
for (let i = 0; i < 10; i++) {
  const accel = stepRK4(spacecraft, bodies, dt);
  console.log(`Step ${i + 1}`);
  console.log("Position:", spacecraft.position);
  console.log("Velocity:", spacecraft.velocity);
  console.log("Acceleration:", accel);
}
