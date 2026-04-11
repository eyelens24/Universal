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
const { createCircularOrbitState, createStateFromVectors } = require("./initial-conditions");
const { formatTelemetry } = require("./telemetry");
const { planTrajectory, formatPlanSummary } = require("./trajectory-planner");

function readNumberArg(name, fallback) {
  const prefix = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  if (!entry) return fallback;

  const value = Number(entry.slice(prefix.length));
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric value for --${name}`);
  }

  return value;
}

function hasArg(name) {
  const prefix = `--${name}=`;
  return process.argv.some((arg) => arg.startsWith(prefix));
}

function readStringArg(name, fallback) {
  const prefix = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

async function main() {
  const kernelDir = path.resolve("./kernels");
  const dryMassKg = readNumberArg("dry-mass", 1500);
  const fuelMassKg = readNumberArg("fuel-mass", 700);
  const maxThrustN = readNumberArg("max-thrust", 25000);
  const ispSeconds = readNumberArg("isp", 320);
  const startPosX = readNumberArg("start-pos-x", null);
  const startPosY = readNumberArg("start-pos-y", null);
  const startPosZ = readNumberArg("start-pos-z", null);
  const startVelX = readNumberArg("start-vel-x", 0);
  const startVelY = readNumberArg("start-vel-y", 0);
  const startVelZ = readNumberArg("start-vel-z", 0);
  const plannerMode = hasArg("plan-target");
  const planTarget = readStringArg("plan-target", "MARS BARYCENTER");
  const plannerTimeWeight = readNumberArg("plan-time-weight", 4.5);
  const plannerFuelWeight = readNumberArg("plan-fuel-weight", 0.85);
  const plannerHazardWeight = readNumberArg("plan-hazard-weight", 140);

  console.log("Simulation config:");
  console.log(`  Dry mass (kg): ${dryMassKg}`);
  console.log(`  Fuel mass (kg): ${fuelMassKg}`);
  console.log(`  Starting total mass (kg): ${dryMassKg + fuelMassKg}`);
  console.log(`  Max thrust (N): ${maxThrustN}`);
  console.log(`  Isp (s): ${ispSeconds}`);

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

  const usingManualPosition =
    hasArg("start-pos-x") || hasArg("start-pos-y") || hasArg("start-pos-z");

  if (usingManualPosition && [startPosX, startPosY, startPosZ].some((value) => value == null)) {
    throw new Error(
      "Manual position mode requires --start-pos-x, --start-pos-y, and --start-pos-z"
    );
  }

  const initialState = usingManualPosition
    ? createStateFromVectors({
        position: new Vec3(startPosX, startPosY, startPosZ),
        velocity: new Vec3(startVelX, startVelY, startVelZ),
        time: et0,
      })
    : createCircularOrbitState({
        body: earth,
        altitudeKm: 400,
        time: et0,
        Vec3,
      });

  console.log(
    usingManualPosition
      ? `  Start mode: manual position (${startPosX}, ${startPosY}, ${startPosZ}) km`
      : "  Start mode: default 400 km circular orbit around Earth"
  );
  if (usingManualPosition) {
    console.log(`  Start velocity (km/s): (${startVelX}, ${startVelY}, ${startVelZ})`);
  }

  if (plannerMode) {
    const plan = planTrajectory({
      simulator,
      bodies,
      initialState,
      targetBodyName: planTarget,
      options: {
        dryMassKg,
        fuelMassKg,
        ispSeconds,
        weightTime: plannerTimeWeight,
        weightFuel: plannerFuelWeight,
        weightHazard: plannerHazardWeight,
      },
    });

    console.log("");
    console.log(formatPlanSummary(plan));
    return;
  }

  const controller = new SpacecraftController({
    name: "Explorer-1",
    dryMassKg,
    fuelMassKg,
    maxThrustN,
    ispSeconds,
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
