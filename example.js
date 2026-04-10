/*
  example-sim-main.js
  --------------------------------------------
  Example wiring for the new bridge modules.
  Adjust kernel paths and body names for your project.
*/

const path = require("path");
const { Vec3 } = require("./spice-integration");
const { buildGravitySimulatorFromSpice } = require("./Gravity-2");
const { SpacecraftController, makeProgradeBurnDirection } = require("./spacecraft-controller");
const { SimulationClock } = require("./sim-clock");
const { SimulationBridge } = require("./simulation-bridge");
const { createCircularOrbitState } = require("./initial-conditions");
const { formatTelemetry } = require("./telemetry");

async function main() {
  const kernelDir = path.resolve("./kernels");

  const { spice, simulator, bodies } = await buildGravitySimulatorFromSpice({
    kernelPaths: {
      lsk: path.join(kernelDir, "naif0012.tls"),
      pck: path.join(kernelDir, "gm_de440.tpc"),
      spk: path.join(kernelDir, "de440s.bsp"),
      extra: [],
    },
    bodyNames: ["SUN", "EARTH", "MOON", "MARS BARYCENTER", "JUPITER BARYCENTER"],
  });

  const et0 = spice.time.utcToEt("2026-04-10T12:00:00 UTC");
  const earth = bodies.find((b) => b.name === "EARTH");

  const initialState = createCircularOrbitState({
    body: earth,
    altitudeKm: 400,
    time: et0,
    Vec3,
  });

  const controller = new SpacecraftController({
    name: "Explorer-1",
    dryMassKg: 1500,
    fuelMassKg: 700,
    maxThrustN: 25000,
    ispSeconds: 320,
  });

  controller.scheduleFiniteBurn({
    startTime: et0 + 120,
    endTime: et0 + 240,
    directionProvider: makeProgradeBurnDirection(),
    throttle: 0.5,
    label: "raise-orbit",
  });

  const clock = new SimulationClock({
    startTime: et0,
    fixedStep: 10,
    timeScale: 1,
  });

  const bridge = new SimulationBridge({
    simulator,
    bodies,
    initialState,
    spice,
    controller,
    clock,
    onTick: (payload) => {
      console.log("--- TICK ---");
      console.log(formatTelemetry(payload.telemetry));
    },
    onCollision: (info) => {
      console.log("COLLISION OR SURFACE CROSSING DETECTED");
      console.log(info);
    },
  });

  for (let i = 0; i < 30; i++) {
    bridge.stepFixed(10);
  }
}

main().catch(console.error);
