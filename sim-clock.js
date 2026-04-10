/*
  sim-clock.js
  --------------------------------------------
  Central simulation clock for physics + rendering.

  Units:
  - time: seconds
*/

class SimulationClock {
  constructor(options = {}) {
    this.currentTime = options.startTime ?? 0;
    this.timeScale = options.timeScale ?? 1;
    this.fixedStep = options.fixedStep ?? 1;
    this.maxSubSteps = options.maxSubSteps ?? 20;
    this.paused = options.paused ?? false;
    this._accumulator = 0;
  }

  setTime(et) {
    this.currentTime = et;
    this._accumulator = 0;
  }

  setTimeScale(scale) {
    this.timeScale = scale;
  }

  setFixedStep(stepSeconds) {
    if (!(stepSeconds > 0)) {
      throw new Error("fixedStep must be > 0");
    }
    this.fixedStep = stepSeconds;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  togglePause() {
    this.paused = !this.paused;
  }

  resetAccumulator() {
    this._accumulator = 0;
  }

  stepBy(dtSeconds) {
    this.currentTime += dtSeconds;
    return this.currentTime;
  }

  consumeRealDelta(realDeltaSeconds) {
    if (this.paused || realDeltaSeconds <= 0) {
      return {
        physicsSteps: 0,
        simulatedSeconds: 0,
        stepSize: this.fixedStep,
        alpha: 0,
        currentTime: this.currentTime,
      };
    }

    const simulatedDelta = realDeltaSeconds * this.timeScale;
    this._accumulator += simulatedDelta;

    let physicsSteps = 0;
    while (
      this._accumulator >= this.fixedStep &&
      physicsSteps < this.maxSubSteps
    ) {
      this.currentTime += this.fixedStep;
      this._accumulator -= this.fixedStep;
      physicsSteps += 1;
    }

    if (physicsSteps === this.maxSubSteps && this._accumulator > this.fixedStep) {
      this._accumulator = this.fixedStep;
    }

    return {
      physicsSteps,
      simulatedSeconds: simulatedDelta,
      stepSize: this.fixedStep,
      alpha: this.fixedStep > 0 ? this._accumulator / this.fixedStep : 0,
      currentTime: this.currentTime,
    };
  }

  snapshot() {
    return {
      currentTime: this.currentTime,
      timeScale: this.timeScale,
      fixedStep: this.fixedStep,
      maxSubSteps: this.maxSubSteps,
      paused: this.paused,
      accumulator: this._accumulator,
    };
  }
}

module.exports = {
  SimulationClock,
};
