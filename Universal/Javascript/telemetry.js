/*
  telemetry.js
  --------------------------------------------
  Builds a clean telemetry snapshot from simulator + state.
*/

const {
  getClosestBody,
  getDominantGravityBody,
} = require("./proximity");
const {
  firstCollision,
} = require("./collision");

function magnitudeOrNull(vec) {
  return vec ? vec.magnitude() : null;
}

function createTelemetrySnapshot({
  state,
  simulator,
  bodies,
  controller = null,
  collisionMarginKm = 0,
  spice = null,
}) {
  const gravity = simulator.getGravityAt(state.position, state.time);
  const closestBody = getClosestBody(state, bodies);
  const dominantGravity = getDominantGravityBody(state, simulator);
  const collision = firstCollision(state, bodies, { marginKm: collisionMarginKm });

  return {
    time: {
      et: state.time,
      utc: spice ? spice.time.etToUtc(state.time, "ISOC", 3) : null,
    },
    spacecraft: {
      position: state.position,
      velocity: state.velocity,
      speedKmS: magnitudeOrNull(state.velocity),
    },
    environment: {
      totalGravity: gravity.totalAcceleration,
      totalGravityMagnitudeKmS2: magnitudeOrNull(gravity.totalAcceleration),
      dominantGravity,
      closestBody,
      collision,
    },
    controller: controller && typeof controller.getStatus === "function"
      ? controller.getStatus()
      : null,
  };
}

function formatTelemetry(snapshot) {
  const lines = [];
  lines.push(`ET: ${snapshot.time.et}`);
  if (snapshot.time.utc) lines.push(`UTC: ${snapshot.time.utc}`);
  lines.push(`Position: ${snapshot.spacecraft.position.toString()}`);
  lines.push(`Velocity: ${snapshot.spacecraft.velocity.toString()}`);
  lines.push(`Speed (km/s): ${snapshot.spacecraft.speedKmS}`);
  lines.push(`Total gravity: ${snapshot.environment.totalGravity.toString()}`);

  if (snapshot.environment.closestBody) {
    lines.push(
      `Closest body: ${snapshot.environment.closestBody.body} ` +
      `(distance=${snapshot.environment.closestBody.distanceKm}, altitude=${snapshot.environment.closestBody.altitudeKm})`
    );
  }

  if (snapshot.environment.dominantGravity) {
    lines.push(
      `Dominant gravity: ${snapshot.environment.dominantGravity.body} ` +
      `(acc=${snapshot.environment.dominantGravity.accelerationKmS2})`
    );
  }

  if (snapshot.environment.collision) {
    lines.push(`COLLISION: ${snapshot.environment.collision.body}`);
  }

  if (snapshot.controller) {
    lines.push(`Fuel mass (kg): ${snapshot.controller.fuelMassKg}`);
    lines.push(`Total mass (kg): ${snapshot.controller.totalMassKg}`);
  }

  return lines.join("\n");
}

module.exports = {
  createTelemetrySnapshot,
  formatTelemetry,
};
