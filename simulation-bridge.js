/*
  simulation-bridge.js
  --------------------------------------------
  Main orchestrator that ties together:
  - GravitySimulator
  - SpacecraftController
  - SimulationClock
  - Collision/proximity/telemetry
  - Trajectory recording
  - optional renderer hooks
*/

const { SimulationClock } = require("./sim-clock");
const { createTelemetrySnapshot } = require("./telemetry");
const { TrajectoryRecorder } = require("./trajectory-recorder");
const { firstCollision, checkSurfaceCrossing } = require("./collision");

class SimulationBridge {
  constructor({
    simulator,
    bodies,
    initialState,
    spice = null,
    controller = null,
    clock = null,
    recorder = null,
    collisionMarginKm = 0,
    onTick = null,
    onCollision = null,
  }) {
    if (!simulator) throw new Error("simulator is required");
    if (!bodies) throw new Error("bodies are required");
    if (!initialState) throw new Error("initialState is required");

    this.simulator = simulator;
    this.bodies = bodies;
    this.state = initialState.clone();
    this.spice = spice;
    this.controller = controller ?? null;
    this.clock = clock ?? new SimulationClock({
      startTime: initialState.time,
      fixedStep: 1,
      timeScale: 1,
    });
    this.recorder = recorder ?? new TrajectoryRecorder();
    this.collisionMarginKm = collisionMarginKm;

    this.onTick = onTick;
    this.onCollision = onCollision;
    this.lastTelemetry = null;
    this.lastBodyStates = [];

    if (this.controller) {
      this.simulator.extraAccelerationFn = (state, bodies) => {
        return this.controller.getAcceleration(state, bodies);
      };
    }

    this.recordCurrentState();
  }

  setRendererCallbacks({ onTick = null, onCollision = null } = {}) {
    this.onTick = onTick;
    this.onCollision = onCollision;
  }

  setState(newState) {
    this.state = newState.clone();
    this.clock.setTime(this.state.time);
    this.recordCurrentState();
  }

  getBodyRenderState(et = this.state.time) {
    return this.simulator.getBodyStates(et).map((b) => ({
      name: b.name,
      position: b.position,
      velocity: b.velocity,
      mu: b.mu,
      radii: b.radii,
    }));
  }

  getShipRenderState() {
    return {
      time: this.state.time,
      position: this.state.position,
      velocity: this.state.velocity,
    };
  }

  buildTickPayload() {
    const telemetry = createTelemetrySnapshot({
      state: this.state,
      simulator: this.simulator,
      bodies: this.bodies,
      controller: this.controller,
      collisionMarginKm: this.collisionMarginKm,
      spice: this.spice,
    });

    this.lastTelemetry = telemetry;
    this.lastBodyStates = this.getBodyRenderState(this.state.time);

    return {
      clock: this.clock.snapshot(),
      state: this.state,
      ship: this.getShipRenderState(),
      bodies: this.lastBodyStates,
      telemetry,
      trajectoryPath: this.recorder.toRenderPath(),
    };
  }

  recordCurrentState() {
    const telemetry = createTelemetrySnapshot({
      state: this.state,
      simulator: this.simulator,
      bodies: this.bodies,
      controller: this.controller,
      collisionMarginKm: this.collisionMarginKm,
      spice: this.spice,
    });

    this.lastTelemetry = telemetry;

    this.recorder.add({
      time: this.state.time,
      position: this.state.position,
      velocity: this.state.velocity,
      telemetry,
    });

    return telemetry;
  }

  stepPhysics(dt) {
    if (this.controller && typeof this.controller.applyImpulsiveBurns === "function") {
      this.state = this.controller.applyImpulsiveBurns(this.state);
    }

    const previousState = this.state.clone();
    this.state = this.simulator.stepShip(this.state, dt);
    this.clock.setTime(this.state.time);

    const directCollision = firstCollision(this.state, this.bodies, {
      marginKm: this.collisionMarginKm,
    });

    const crossings = checkSurfaceCrossing(previousState, this.state, this.bodies, {
      marginKm: this.collisionMarginKm,
    });

    const telemetry = this.recordCurrentState();

    if (directCollision || crossings.length > 0) {
      const info = {
        directCollision,
        crossings,
        telemetry,
        state: this.state,
      };
      if (typeof this.onCollision === "function") {
        this.onCollision(info);
      }
      return {
        collision: info,
        telemetry,
      };
    }

    return {
      collision: null,
      telemetry,
    };
  }

  tickRealTime(realDeltaSeconds) {
    const clockUpdate = this.clock.consumeRealDelta(realDeltaSeconds);
    let collisionInfo = null;

    for (let i = 0; i < clockUpdate.physicsSteps; i++) {
      const result = this.stepPhysics(clockUpdate.stepSize);
      if (result.collision) {
        collisionInfo = result.collision;
        break;
      }
    }

    const payload = this.buildTickPayload();
    payload.clockUpdate = clockUpdate;
    payload.collision = collisionInfo;

    if (typeof this.onTick === "function") {
      this.onTick(payload);
    }

    return payload;
  }

  stepFixed(dt) {
    const result = this.stepPhysics(dt);
    const payload = this.buildTickPayload();
    payload.collision = result.collision;
    payload.fixedStep = dt;

    if (typeof this.onTick === "function") {
      this.onTick(payload);
    }

    return payload;
  }

  getSnapshot() {
    return this.buildTickPayload();
  }
}

module.exports = {
  SimulationBridge,
};
