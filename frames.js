/*
  frames.js
  --------------------------------------------
  Reference-frame helpers for barycentric / body-relative
  / velocity-relative calculations.
*/

function getBodyByName(bodies, name) {
  return bodies.find((b) => b.name === name) ?? null;
}

function getBodyRelativeState(state, body) {
  const bodyPosition = body.positionAt(state.time);
  const bodyVelocity = body.velocityAt(state.time);

  return {
    body: body.name,
    time: state.time,
    position: state.position.sub(bodyPosition),
    velocity: state.velocity.sub(bodyVelocity),
    bodyPosition,
    bodyVelocity,
  };
}

function getBodyCenteredPosition(state, body) {
  return state.position.sub(body.positionAt(state.time));
}

function getBodyCenteredVelocity(state, body) {
  return state.velocity.sub(body.velocityAt(state.time));
}

function getDistanceToBody(state, body) {
  return getBodyCenteredPosition(state, body).magnitude();
}

function getSpeedRelativeToBody(state, body) {
  return getBodyCenteredVelocity(state, body).magnitude();
}

function normalize(vec) {
  const mag = vec.magnitude();
  if (mag === 0) return null;
  return vec.scale(1 / mag);
}

function getVelocityFrame(state, body = null) {
  const relVelocity = body ? getBodyCenteredVelocity(state, body) : state.velocity;
  const prograde = normalize(relVelocity);
  const retrograde = prograde ? prograde.scale(-1) : null;

  const radialSource = body
    ? getBodyCenteredPosition(state, body)
    : state.position;
  const radialOut = normalize(radialSource);
  const radialIn = radialOut ? radialOut.scale(-1) : null;

  return {
    prograde,
    retrograde,
    radialOut,
    radialIn,
  };
}

module.exports = {
  getBodyByName,
  getBodyRelativeState,
  getBodyCenteredPosition,
  getBodyCenteredVelocity,
  getDistanceToBody,
  getSpeedRelativeToBody,
  getVelocityFrame,
};
