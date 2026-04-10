/*
  initial-conditions.js
  --------------------------------------------
  Helpers to create usable spacecraft starting states.

  Assumes Vec3 + SpacecraftState from your existing gravity stack.
*/

const { SpacecraftState } = require("./Gravity-2");
const { getMeanRadiusKm } = require("./collision");

function normalize(vec) {
  const mag = vec.magnitude();
  if (mag === 0) {
    throw new Error("Cannot normalize zero vector");
  }
  return vec.scale(1 / mag);
}

function cross(a, b, Vec3Ctor) {
  return new Vec3Ctor(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}

function createStateFromVectors({ position, velocity, time }) {
  return new SpacecraftState(position, velocity, time);
}

function createBodyRelativeState({ body, altitudeKm = 0, speedKmS = 0, time, Vec3 }) {
  const radius = getMeanRadiusKm(body);
  if (radius == null) {
    throw new Error(`Body ${body.name} does not have radii for altitude placement`);
  }

  const bodyPosition = body.positionAt(time);
  const bodyVelocity = body.velocityAt(time);

  const radialDirection = normalize(bodyPosition.magnitude() === 0 ? new Vec3(1, 0, 0) : bodyPosition);
  const up = new Vec3(0, 0, 1);
  let tangent = cross(up, radialDirection, Vec3);
  if (tangent.magnitude() === 0) {
    tangent = new Vec3(0, 1, 0);
  }
  tangent = normalize(tangent);

  const position = bodyPosition.add(radialDirection.scale(radius + altitudeKm));
  const velocity = bodyVelocity.add(tangent.scale(speedKmS));

  return new SpacecraftState(position, velocity, time);
}

function createCircularOrbitState({ body, altitudeKm, time, Vec3, progradeSign = 1 }) {
  const radius = getMeanRadiusKm(body);
  if (radius == null) {
    throw new Error(`Body ${body.name} does not have radii for circular orbit placement`);
  }
  if (!(Number.isFinite(body.mu) && body.mu > 0)) {
    throw new Error(`Body ${body.name} does not have a valid mu`);
  }

  const bodyPosition = body.positionAt(time);
  const bodyVelocity = body.velocityAt(time);

  const radialDirection = normalize(bodyPosition.magnitude() === 0 ? new Vec3(1, 0, 0) : bodyPosition);
  const up = new Vec3(0, 0, 1);
  let tangent = cross(up, radialDirection, Vec3);
  if (tangent.magnitude() === 0) {
    tangent = new Vec3(0, 1, 0);
  }
  tangent = normalize(tangent).scale(progradeSign);

  const orbitRadiusKm = radius + altitudeKm;
  const circularSpeedKmS = Math.sqrt(body.mu / orbitRadiusKm);

  const position = bodyPosition.add(radialDirection.scale(orbitRadiusKm));
  const velocity = bodyVelocity.add(tangent.scale(circularSpeedKmS));

  return new SpacecraftState(position, velocity, time);
}

module.exports = {
  createStateFromVectors,
  createBodyRelativeState,
  createCircularOrbitState,
};
