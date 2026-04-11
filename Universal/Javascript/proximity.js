/*
  proximity.js
  --------------------------------------------
  Closest-body, SOI-ish, and proximity helpers.

  Units:
  - distance: km
*/

const { getMeanRadiusKm } = require("./collision");

function getRelativeVector(state, body) {
  const bodyPos = body.positionAt(state.time);
  return state.position.sub(bodyPos);
}

function getDistanceToBodyKm(state, body) {
  return getRelativeVector(state, body).magnitude();
}

function getSpeedRelativeToBodyKmS(state, body) {
  const bodyVel = body.velocityAt(state.time);
  return state.velocity.sub(bodyVel).magnitude();
}

function getAltitudeToBodyKm(state, body) {
  const radius = getMeanRadiusKm(body);
  if (radius == null) return null;
  return getDistanceToBodyKm(state, body) - radius;
}

function getClosestBody(state, bodies) {
  let best = null;

  for (const body of bodies) {
    const distanceKm = getDistanceToBodyKm(state, body);

    if (!best || distanceKm < best.distanceKm) {
      best = {
        body: body.name,
        bodyRef: body,
        distanceKm,
        altitudeKm: getAltitudeToBodyKm(state, body),
        relativeSpeedKmS: getSpeedRelativeToBodyKmS(state, body),
      };
    }
  }

  return best;
}

function getBodiesWithinDistance(state, bodies, maxDistanceKm) {
  return bodies
    .map((body) => ({
      body: body.name,
      bodyRef: body,
      distanceKm: getDistanceToBodyKm(state, body),
      altitudeKm: getAltitudeToBodyKm(state, body),
      relativeSpeedKmS: getSpeedRelativeToBodyKmS(state, body),
    }))
    .filter((x) => x.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

function getBodiesWithinAltitude(state, bodies, maxAltitudeKm) {
  return bodies
    .map((body) => ({
      body: body.name,
      bodyRef: body,
      distanceKm: getDistanceToBodyKm(state, body),
      altitudeKm: getAltitudeToBodyKm(state, body),
      relativeSpeedKmS: getSpeedRelativeToBodyKmS(state, body),
    }))
    .filter((x) => x.altitudeKm != null && x.altitudeKm <= maxAltitudeKm)
    .sort((a, b) => a.altitudeKm - b.altitudeKm);
}

function rankBodiesByGravity(state, simulator) {
  const breakdown = simulator.getGravityAt(state.position, state.time);

  return breakdown.contributions
    .map((c) => ({
      body: c.body,
      distanceKm: c.distance,
      accelerationKmS2: c.acceleration.magnitude(),
      vector: c.acceleration,
    }))
    .sort((a, b) => b.accelerationKmS2 - a.accelerationKmS2);
}

function getDominantGravityBody(state, simulator) {
  const ranked = rankBodiesByGravity(state, simulator);
  return ranked.length > 0 ? ranked[0] : null;
}

/*
  Approximate classical sphere of influence:
  r_soi ≈ a * (m/M)^(2/5)

  Since mu = Gm, the mass ratio m/M can be replaced by mu_body/mu_primary.
*/
function estimateSphereOfInfluenceKm(body, primaryBody, state) {
  if (!Number.isFinite(body.mu) || !Number.isFinite(primaryBody.mu)) {
    return null;
  }

  const bodyPos = body.positionAt(state.time);
  const primaryPos = primaryBody.positionAt(state.time);
  const semiMajorApproxKm = bodyPos.sub(primaryPos).magnitude();

  return semiMajorApproxKm * Math.pow(body.mu / primaryBody.mu, 2 / 5);
}

function isInsideApproxSOI(state, body, primaryBody) {
  const soiKm = estimateSphereOfInfluenceKm(body, primaryBody, state);
  if (soiKm == null) {
    return {
      body: body.name,
      inside: false,
      soiKm: null,
      distanceKm: getDistanceToBodyKm(state, body),
    };
  }

  const distanceKm = getDistanceToBodyKm(state, body);

  return {
    body: body.name,
    inside: distanceKm <= soiKm,
    soiKm,
    distanceKm,
  };
}

function summarizeProximity(state, bodies, simulator = null) {
  const closest = getClosestBody(state, bodies);
  const nearby = bodies
    .map((body) => ({
      body: body.name,
      distanceKm: getDistanceToBodyKm(state, body),
      altitudeKm: getAltitudeToBodyKm(state, body),
      relativeSpeedKmS: getSpeedRelativeToBodyKmS(state, body),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    time: state.time,
    closest,
    nearby,
    dominantGravity: simulator ? getDominantGravityBody(state, simulator) : null,
  };
}

module.exports = {
  getRelativeVector,
  getDistanceToBodyKm,
  getSpeedRelativeToBodyKmS,
  getAltitudeToBodyKm,
  getClosestBody,
  getBodiesWithinDistance,
  getBodiesWithinAltitude,
  rankBodiesByGravity,
  getDominantGravityBody,
  estimateSphereOfInfluenceKm,
  isInsideApproxSOI,
  summarizeProximity,
};
