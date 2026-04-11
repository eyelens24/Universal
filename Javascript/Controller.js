

const G0 = 9.80665; // m/s^2

class SpacecraftController {
  constructor(options = {}) {
    this.name = options.name ?? "Ship";

    this.dryMassKg = options.dryMassKg ?? 1000;
    this.fuelMassKg = options.fuelMassKg ?? 500;
    this.maxThrustN = options.maxThrustN ?? 0;
    this.ispSeconds = options.ispSeconds ?? 300;

    this.manualAccelerationProvider = options.manualAccelerationProvider ?? null;
    this.pointingMode = options.pointingMode ?? "manual";

    this.activeBurn = null;
    this.scheduledBurns = [];

    this.telemetry = {
      totalFuelUsedKg: 0,
      totalBurnTimeS: 0,
      burnLog: [],
    };
  }

  get totalMassKg() {
    return this.dryMassKg + this.fuelMassKg;
  }

  hasFuel() {
    return this.fuelMassKg > 0;
  }

  setManualAccelerationProvider(fn) {
    this.manualAccelerationProvider = fn;
  }

  setPointingMode(mode) {
    this.pointingMode = mode;
  }

  scheduleFiniteBurn({
    startTime,
    endTime,
    directionProvider,
    throttle = 1.0,
    label = "finite-burn",
  }) {
    if (endTime <= startTime) {
      throw new Error("endTime must be greater than startTime");
    }

    this.scheduledBurns.push({
      type: "finite",
      startTime,
      endTime,
      directionProvider,
      throttle,
      label,
      started: false,
      finished: false,
    });
  }

  scheduleImpulsiveBurn({
    time,
    deltaV,
    label = "impulsive-burn",
  }) {
    this.scheduledBurns.push({
      type: "impulsive",
      time,
      deltaV,
      label,
      executed: false,
    });
  }

  clearScheduledBurns() {
    this.scheduledBurns = [];
  }

  /*
    Call this before stepping if you want true impulsive burns
    applied directly to the state velocity.
  */
  applyImpulsiveBurns(state) {
    for (const burn of this.scheduledBurns) {
      if (burn.type !== "impulsive" || burn.executed) continue;

      if (state.time >= burn.time) {
        state.velocity = state.velocity.add(burn.deltaV);
        burn.executed = true;

        this.telemetry.burnLog.push({
          type: "impulsive",
          label: burn.label,
          time: state.time,
          deltaV: burn.deltaV,
        });
      }
    }

    return state;
  }

  getActiveFiniteBurn(state) {
    for (const burn of this.scheduledBurns) {
      if (burn.type !== "finite" || burn.finished) continue;

      if (state.time >= burn.startTime && state.time < burn.endTime) {
        return burn;
      }
    }

    return null;
  }

  getThrottleForBurn(burn) {
    if (!burn) return 0;
    return Math.max(0, Math.min(1, burn.throttle ?? 1));
  }

  getDirectionUnitVector(state, bodies, burn) {
    if (!burn) {
      return null;
    }

    if (typeof burn.directionProvider === "function") {
      const v = burn.directionProvider(state, bodies, this);
      if (!v) return null;

      const mag = v.magnitude();
      if (mag === 0) return null;
      return v.scale(1 / mag);
    }

    return null;
  }

  getManualAcceleration(state, bodies) {
    if (typeof this.manualAccelerationProvider !== "function") {
      return null;
    }

    return this.manualAccelerationProvider(state, bodies, this);
  }

  getMassFlowKgPerS(thrustN) {
    if (thrustN <= 0 || this.ispSeconds <= 0) return 0;
    return thrustN / (this.ispSeconds * G0);
  }

  consumeFuelForDt(thrustN, dt) {
    if (dt <= 0 || thrustN <= 0 || !this.hasFuel()) return 0;

    const mdot = this.getMassFlowKgPerS(thrustN);
    const requestedFuel = mdot * dt;
    const usedFuel = Math.min(this.fuelMassKg, requestedFuel);

    this.fuelMassKg -= usedFuel;
    this.telemetry.totalFuelUsedKg += usedFuel;
    this.telemetry.totalBurnTimeS += dt;

    return usedFuel;
  }

  updateFiniteBurnStatus(startTime, endTime) {
    for (const burn of this.scheduledBurns) {
      if (burn.type !== "finite" || burn.finished) continue;

      const overlapsStep = startTime < burn.endTime && endTime > burn.startTime;
      if (overlapsStep && !burn.started) {
        burn.started = true;
        this.telemetry.burnLog.push({
          type: "finite-start",
          label: burn.label,
          time: Math.max(startTime, burn.startTime),
        });
      }

      if (endTime >= burn.endTime && !burn.finished) {
        burn.finished = true;
        this.telemetry.burnLog.push({
          type: "finite-end",
          label: burn.label,
          time: burn.endTime,
        });
      }
    }
  }

  advance(dt, state) {
    if (!(dt > 0)) return;

    const startTime = state.time;
    const endTime = state.time + dt;
    this.updateFiniteBurnStatus(startTime, endTime);

    if (!this.hasFuel() || this.maxThrustN <= 0) {
      return;
    }

    for (const burn of this.scheduledBurns) {
      if (burn.type !== "finite") continue;

      const overlapStart = Math.max(startTime, burn.startTime);
      const overlapEnd = Math.min(endTime, burn.endTime);
      const activeDuration = Math.max(0, overlapEnd - overlapStart);

      if (activeDuration <= 0) continue;

      const throttle = this.getThrottleForBurn(burn);
      if (throttle <= 0) continue;

      const thrustN = this.maxThrustN * throttle;
      this.consumeFuelForDt(thrustN, activeDuration);

      if (!this.hasFuel()) {
        break;
      }
    }
  }

  /*
    Returns thrust acceleration in km/s^2.
    This is what you plug into GravitySimulator.extraAccelerationFn.
  */
  getAcceleration(state, bodies) {
    if (!this.hasFuel() || this.maxThrustN <= 0) {
      return this.getManualAcceleration(state, bodies) ?? null;
    }

    const burn = this.getActiveFiniteBurn(state);

    let thrustAcceleration = null;

    if (burn) {
      const throttle = this.getThrottleForBurn(burn);
      const direction = this.getDirectionUnitVector(state, bodies, burn);

      if (direction && throttle > 0) {
        const thrustN = this.maxThrustN * throttle;
        const massKg = this.totalMassKg;

        // a = F / m   [m/s^2], then convert to km/s^2
        const accelMS2 = thrustN / massKg;
        const accelKmS2 = accelMS2 / 1000.0;

        thrustAcceleration = direction.scale(accelKmS2);
      }
    }

    const manualAccel = this.getManualAcceleration(state, bodies);

    if (thrustAcceleration && manualAccel) {
      return thrustAcceleration.add(manualAccel);
    }

    return thrustAcceleration ?? manualAccel ?? null;
  }

  getStatus() {
    return {
      name: this.name,
      dryMassKg: this.dryMassKg,
      fuelMassKg: this.fuelMassKg,
      totalMassKg: this.totalMassKg,
      maxThrustN: this.maxThrustN,
      ispSeconds: this.ispSeconds,
      telemetry: this.telemetry,
      scheduledBurns: this.scheduledBurns.map((b) => ({ ...b })),
    };
  }
}

/* 
   Useful direction helpers
*/

function unitVectorFromVelocity(state) {
  const speed = state.velocity.magnitude();
  if (speed === 0) return null;
  return state.velocity.scale(1 / speed);
}

function unitVectorRetrograde(state) {
  const prograde = unitVectorFromVelocity(state);
  return prograde ? prograde.scale(-1) : null;
}

function unitVectorTowardBody(state, body) {
  const rel = body.positionAt(state.time).sub(state.position);
  const mag = rel.magnitude();
  if (mag === 0) return null;
  return rel.scale(1 / mag);
}

function unitVectorAwayFromBody(state, body) {
  const toward = unitVectorTowardBody(state, body);
  return toward ? toward.scale(-1) : null;
}

function makeProgradeBurnDirection() {
  return (state) => unitVectorFromVelocity(state);
}

function makeRetrogradeBurnDirection() {
  return (state) => unitVectorRetrograde(state);
}

function makeTowardBodyBurnDirection(bodyName) {
  return (state, bodies) => {
    const body = bodies.find((b) => b.name === bodyName);
    if (!body) return null;
    return unitVectorTowardBody(state, body);
  };
}

function makeAwayFromBodyBurnDirection(bodyName) {
  return (state, bodies) => {
    const body = bodies.find((b) => b.name === bodyName);
    if (!body) return null;
    return unitVectorAwayFromBody(state, body);
  };
}

module.exports = {
  SpacecraftController,
  unitVectorFromVelocity,
  unitVectorRetrograde,
  unitVectorTowardBody,
  unitVectorAwayFromBody,
  makeProgradeBurnDirection,
  makeRetrogradeBurnDirection,
  makeTowardBodyBurnDirection,
  makeAwayFromBodyBurnDirection,
};
