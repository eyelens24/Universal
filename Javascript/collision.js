/*
  collision.js
  --------------------------------------------
  Collision and altitude checks for spacecraft
  against SPICE-backed bodies.

  Units:
  - distance: km
  - velocity: km/s
  - time: s
*/

function getMeanRadiusKm(body) {
  if (!body || !Array.isArray(body.radii) || body.radii.length === 0) {
    return null;
  }

  const sum = body.radii.reduce((a, b) => a + b, 0);
  return sum / body.radii.length;
}

function getBodyCenterDistanceKm(state, body) {
  const bodyPos = body.positionAt(state.time);
  return state.position.sub(bodyPos).magnitude();
}

function getAltitudeKm(state, body) {
  const radius = getMeanRadiusKm(body);
  if (radius == null) return null;

  const centerDistance = getBodyCenterDistanceKm(state, body);
  return centerDistance - radius;
}

function isCollidingWithBody(state, body, options = {}) {
  const marginKm = options.marginKm ?? 0;
  const radius = getMeanRadiusKm(body);

  if (radius == null) {
    return {
      body: body.name,
      colliding: false,
      reason: "No body radii available",
      altitudeKm: null,
      distanceKm: getBodyCenterDistanceKm(state, body),
      impactRadiusKm: null,
    };
  }

  const bodyPos = body.positionAt(state.time);
  const rel = state.position.sub(bodyPos);
  const distanceKm = rel.magnitude();
  const impactRadiusKm = radius + marginKm;
  const altitudeKm = distanceKm - radius;
  const colliding = distanceKm <= impactRadiusKm;

  return {
    body: body.name,
    colliding,
    altitudeKm,
    distanceKm,
    impactRadiusKm,
    bodyRadiusKm: radius,
    marginKm,
  };
}

function findCollisions(state, bodies, options = {}) {
  const results = [];

  for (const body of bodies) {
    const result = isCollidingWithBody(state, body, options);
    if (result.colliding) {
      results.push(result);
    }
  }

  return results;
}

function firstCollision(state, bodies, options = {}) {
  const collisions = findCollisions(state, bodies, options);
  return collisions.length > 0 ? collisions[0] : null;
}

function checkSurfaceCrossing(previousState, currentState, bodies, options = {}) {
  const marginKm = options.marginKm ?? 0;
  const crossings = [];

  for (const body of bodies) {
    const radius = getMeanRadiusKm(body);
    if (radius == null) continue;

    const prevBodyPos = body.positionAt(previousState.time);
    const currBodyPos = body.positionAt(currentState.time);

    const prevDistance = previousState.position.sub(prevBodyPos).magnitude();
    const currDistance = currentState.position.sub(currBodyPos).magnitude();

    const threshold = radius + marginKm;
    const wasOutside = prevDistance > threshold;
    const isInside = currDistance <= threshold;

    if (wasOutside && isInside) {
      crossings.push({
        body: body.name,
        crossed: true,
        previousDistanceKm: prevDistance,
        currentDistanceKm: currDistance,
        thresholdKm: threshold,
        bodyRadiusKm: radius,
      });
    }
  }

  return crossings;
}

function summarizeCollisionState(state, bodies, options = {}) {
  const perBody = bodies.map((body) => {
    const radius = getMeanRadiusKm(body);
    const bodyPos = body.positionAt(state.time);
    const rel = state.position.sub(bodyPos);
    const distanceKm = rel.magnitude();
    const altitudeKm = radius == null ? null : distanceKm - radius;

    return {
      body: body.name,
      distanceKm,
      altitudeKm,
      bodyRadiusKm: radius,
      colliding: radius == null ? false : altitudeKm <= (options.marginKm ?? 0),
    };
  });

  return {
    time: state.time,
    collisions: perBody.filter((x) => x.colliding),
    perBody,
  };
}

module.exports = {
  getMeanRadiusKm,
  getBodyCenterDistanceKm,
  getAltitudeKm,
  isCollidingWithBody,
  findCollisions,
  firstCollision,
  checkSurfaceCrossing,
  summarizeCollisionState,
};
