/*
  trajectory-recorder.js
  --------------------------------------------
  Keeps a rolling history of spacecraft states and telemetry.
*/

class TrajectoryRecorder {
  constructor(options = {}) {
    this.maxPoints = options.maxPoints ?? 10000;
    this.points = [];
  }

  clear() {
    this.points = [];
  }

  add(entry) {
    this.points.push(entry);
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
  }

  latest() {
    return this.points.length > 0 ? this.points[this.points.length - 1] : null;
  }

  toRenderPath() {
    return this.points.map((p) => ({
      time: p.time,
      position: p.position,
    }));
  }

  toJSON() {
    return this.points.map((p) => ({
      time: p.time,
      position: { x: p.position.x, y: p.position.y, z: p.position.z },
      velocity: { x: p.velocity.x, y: p.velocity.y, z: p.velocity.z },
      telemetry: p.telemetry ?? null,
    }));
  }
}

module.exports = {
  TrajectoryRecorder,
};
