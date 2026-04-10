"use strict";

const { getMeanRadiusKm, isCollidingWithBody } = require("./collision");

const G0 = 9.80665;
const AU_KM = 149_597_870.7;
const DAY_SECONDS = 86_400;

function findBodyByName(bodies, name) {
  const normalize = (value) =>
    String(value)
      .trim()
      .toUpperCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  const requested = normalize(name);
  const body = bodies.find((entry) => {
    const bodyName = normalize(entry.name);
    if (bodyName === requested) return true;
    if (bodyName.replace(/ BARYCENTER$/, "") === requested) return true;
    return false;
  });
  if (!body) {
    throw new Error(`Unknown body: ${name}`);
  }
  return body;
}

function normalizeOrNull(vec) {
  const mag = vec.magnitude();
  if (mag === 0) return null;
  return vec.scale(1 / mag);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function angleBetween(a, b) {
  const ua = normalizeOrNull(a);
  const ub = normalizeOrNull(b);
  if (!ua || !ub) return 0;
  const cosine = Math.max(-1, Math.min(1, dot(ua, ub)));
  return Math.acos(cosine);
}

function impulseFuelRequiredKg(deltaVKmS, dryMassKg, fuelMassKg, ispSeconds) {
  if (!(deltaVKmS > 0) || !(ispSeconds > 0)) {
    return 0;
  }

  const initialMass = dryMassKg + fuelMassKg;
  const deltaVMS = deltaVKmS * 1000;
  const finalMass = initialMass / Math.exp(deltaVMS / (ispSeconds * G0));
  return Math.max(0, initialMass - finalMass);
}

function impulseFuelUsedKg(deltaVKmS, dryMassKg, fuelMassKg, ispSeconds) {
  return Math.min(
    fuelMassKg,
    impulseFuelRequiredKg(deltaVKmS, dryMassKg, fuelMassKg, ispSeconds)
  );
}

function buildHazardModel() {
  return {
    asteroidBands: [
      { name: "Main Belt", radiusMinAu: 2.05, radiusMaxAu: 3.35, weight: 1.2 },
      { name: "Jupiter Trojans", radiusMinAu: 5.0, radiusMaxAu: 5.35, weight: 1.0 },
      { name: "Kuiper Objects", radiusMinAu: 30, radiusMaxAu: 47, weight: 0.4 },
    ],
    debrisShells: [
      { name: "LEO Debris", body: "EARTH", radiusMinKm: 6_900, radiusMaxKm: 12_500, weight: 1.8 },
      { name: "GEO Debris", body: "EARTH", radiusMinKm: 41_000, radiusMaxKm: 46_500, weight: 1.2 },
      { name: "Lunar Congestion", body: "MOON", radiusMinKm: 1_900, radiusMaxKm: 20_000, weight: 0.7 },
    ],
  };
}

function computeHazardSample(state, targetBody, hazardModel) {
  let hazard = 0;
  const notes = [];
  const heliocentricRadiusAu = state.position.magnitude() / AU_KM;

  for (const band of hazardModel.asteroidBands) {
    if (heliocentricRadiusAu >= band.radiusMinAu && heliocentricRadiusAu <= band.radiusMaxAu) {
      hazard += band.weight;
      notes.push(band.name);
    }
  }

  if (targetBody) {
    const targetDistance = state.position.sub(targetBody.positionAt(state.time)).magnitude();
    const targetRadius = getMeanRadiusKm(targetBody);
    if (targetRadius && targetDistance <= targetRadius + 50_000) {
      hazard += 0.1;
    }
  }

  return { hazard, notes };
}

function computeDebrisHazard(state, bodies, hazardModel) {
  let hazard = 0;
  const notes = [];

  for (const shell of hazardModel.debrisShells) {
    const body = bodies.find((entry) => entry.name === shell.body);
    if (!body) continue;

    const distanceKm = state.position.sub(body.positionAt(state.time)).magnitude();
    if (distanceKm >= shell.radiusMinKm && distanceKm <= shell.radiusMaxKm) {
      hazard += shell.weight;
      notes.push(shell.name);
    }
  }

  return { hazard, notes };
}

function makeDirectionSet(initialState, targetBody) {
  return [
    {
      name: "coast",
      unit: () => null,
    },
    {
      name: "prograde",
      unit: (state) => normalizeOrNull(state.velocity),
    },
    {
      name: "retrograde",
      unit: (state) => {
        const prograde = normalizeOrNull(state.velocity);
        return prograde ? prograde.scale(-1) : null;
      },
    },
    {
      name: "radial-out",
      unit: (state) => normalizeOrNull(state.position),
    },
    {
      name: "radial-in",
      unit: (state) => {
        const radial = normalizeOrNull(state.position);
        return radial ? radial.scale(-1) : null;
      },
    },
    {
      name: "toward-target",
      unit: (state) => normalizeOrNull(targetBody.positionAt(state.time).sub(state.position)),
    },
    {
      name: "target-velocity-match",
      unit: (state) => normalizeOrNull(targetBody.velocityAt(state.time).sub(state.velocity)),
    },
    {
      name: "plane-change-lite",
      unit: (state) => normalizeOrNull(targetBody.positionAt(state.time).sub(initialState.position).add(state.velocity.scale(0.2))),
    },
    {
      name: "intercept-estimate",
      deltaV: (state, _bodies, transferDurationSeconds) => {
        const futureTargetPosition = targetBody.positionAt(state.time + transferDurationSeconds);
        const desiredVelocity = futureTargetPosition
          .sub(state.position)
          .scale(1 / transferDurationSeconds);
        return desiredVelocity.sub(state.velocity);
      },
    },
    {
      name: "rendezvous-estimate",
      deltaV: (state, _bodies, transferDurationSeconds) => {
        const futureTargetPosition = targetBody.positionAt(state.time + transferDurationSeconds);
        const futureTargetVelocity = targetBody.velocityAt(state.time + transferDurationSeconds);
        const closureVelocity = futureTargetPosition
          .sub(state.position)
          .scale(1 / transferDurationSeconds);
        const desiredVelocity = closureVelocity.scale(0.7).add(futureTargetVelocity.scale(0.3));
        return desiredVelocity.sub(state.velocity);
      },
    },
  ];
}

function propagateState(simulator, initialState, durationSeconds, stepSeconds) {
  let state = initialState.clone();
  const steps = Math.max(1, Math.ceil(durationSeconds / stepSeconds));
  const dt = durationSeconds / steps;

  for (let i = 0; i < steps; i += 1) {
    state = simulator.stepShip(state, dt);
  }

  return state;
}

function evaluateCandidate({
  simulator,
  bodies,
  initialState,
  targetBody,
  directionChoice,
  burnMagnitudeKmS,
  departureDelaySeconds,
  transferDurationSeconds,
  plannerOptions,
}) {
  const hazardModel = plannerOptions.hazardModel;
  const bodyMarginKm = plannerOptions.bodySafetyMarginKm;
  const evaluationStepSeconds = plannerOptions.evaluationStepSeconds;

  let state = propagateState(
    simulator,
    initialState,
    departureDelaySeconds,
    evaluationStepSeconds
  );

  const departureState = state.clone();
  const appliedDeltaV = typeof directionChoice.deltaV === "function"
    ? directionChoice.deltaV(state, bodies, transferDurationSeconds)
    : (() => {
        const direction = directionChoice.unit(state, bodies);
        return direction ? direction.scale(burnMagnitudeKmS) : null;
      })();

  if (appliedDeltaV) {
    state.velocity = state.velocity.add(appliedDeltaV);
  }

  let minDistanceToTargetKm = Infinity;
  let minDistanceTime = state.time;
  let hazardExposure = 0;
  let collisionPenalty = 0;
  let debrisEvents = 0;
  let asteroidEvents = 0;
  const hazardHits = new Set();

  const steps = Math.max(1, Math.ceil(transferDurationSeconds / evaluationStepSeconds));
  const dt = transferDurationSeconds / steps;

  for (let i = 0; i < steps; i += 1) {
    const distanceToTargetKm = state.position.sub(targetBody.positionAt(state.time)).magnitude();
    if (distanceToTargetKm < minDistanceToTargetKm) {
      minDistanceToTargetKm = distanceToTargetKm;
      minDistanceTime = state.time;
    }

    const asteroidRisk = computeHazardSample(state, targetBody, hazardModel);
    const debrisRisk = computeDebrisHazard(state, bodies, hazardModel);

    hazardExposure += asteroidRisk.hazard + debrisRisk.hazard;
    asteroidEvents += asteroidRisk.hazard > 0 ? 1 : 0;
    debrisEvents += debrisRisk.hazard > 0 ? 1 : 0;
    asteroidRisk.notes.forEach((note) => hazardHits.add(note));
    debrisRisk.notes.forEach((note) => hazardHits.add(note));

    for (const body of bodies) {
      const collision = isCollidingWithBody(state, body, { marginKm: bodyMarginKm });
      if (collision.colliding) {
        collisionPenalty += 10_000;
      }
    }

    state = simulator.stepShip(state, dt);
  }

  const arrivalBodyState = targetBody.stateAt(state.time);
  const finalDistanceKm = state.position.sub(arrivalBodyState.position).magnitude();
  const arrivalRelativeSpeedKmS = state.velocity.sub(arrivalBodyState.velocity).magnitude();
  const deltaVUsedKmS = appliedDeltaV ? appliedDeltaV.magnitude() : 0;
  const requiredFuelKg = impulseFuelRequiredKg(
    deltaVUsedKmS,
    plannerOptions.dryMassKg,
    plannerOptions.fuelMassKg,
    plannerOptions.ispSeconds
  );
  const fuelUsedKg = impulseFuelUsedKg(
    deltaVUsedKmS,
    plannerOptions.dryMassKg,
    plannerOptions.fuelMassKg,
    plannerOptions.ispSeconds
  );
  const infeasibleFuelPenalty = requiredFuelKg > plannerOptions.fuelMassKg
    ? (requiredFuelKg - plannerOptions.fuelMassKg) * 250
    : 0;
  const transferDays = transferDurationSeconds / DAY_SECONDS;
  const departureDays = departureDelaySeconds / DAY_SECONDS;

  const score =
    finalDistanceKm / 25_000 +
    minDistanceToTargetKm / 80_000 +
    arrivalRelativeSpeedKmS * 180 +
    fuelUsedKg * plannerOptions.weightFuel +
    transferDays * plannerOptions.weightTime +
    hazardExposure * plannerOptions.weightHazard +
    infeasibleFuelPenalty +
    collisionPenalty;

  return {
    score,
    direction: directionChoice.name,
    deltaVKmS: deltaVUsedKmS,
    fuelUsedKg,
    requiredFuelKg,
    feasibleFuel: requiredFuelKg <= plannerOptions.fuelMassKg,
    departureDelayDays: departureDays,
    transferDays,
    finalDistanceKm,
    minDistanceToTargetKm,
    arrivalRelativeSpeedKmS,
    hazardExposure,
    asteroidEvents,
    debrisEvents,
    hazardHits: [...hazardHits],
    departureState,
    minDistanceTime,
  };
}

function planTrajectory({
  simulator,
  bodies,
  initialState,
  targetBodyName,
  options = {},
}) {
  if (!simulator) throw new Error("simulator is required");
  if (!Array.isArray(bodies) || bodies.length === 0) throw new Error("bodies are required");
  if (!initialState) throw new Error("initialState is required");
  if (!targetBodyName) throw new Error("targetBodyName is required");

  const plannerOptions = {
    dryMassKg: options.dryMassKg ?? 1500,
    fuelMassKg: options.fuelMassKg ?? 700,
    ispSeconds: options.ispSeconds ?? 320,
    weightFuel: options.weightFuel ?? 0.85,
    weightTime: options.weightTime ?? 4.5,
    weightHazard: options.weightHazard ?? 140,
    bodySafetyMarginKm: options.bodySafetyMarginKm ?? 100,
    evaluationStepSeconds: options.evaluationStepSeconds ?? 6 * 3600,
    departureDelayDays: options.departureDelayDays ?? [0, 1, 3, 7, 14, 30, 60, 90],
    transferDays: options.transferDays ?? [7, 14, 30, 60, 120, 180, 240, 320],
    burnMagnitudesKmS: options.burnMagnitudesKmS ?? [0, 0.2, 0.5, 1, 2, 3, 5],
    topCount: options.topCount ?? 5,
    hazardModel: buildHazardModel(),
  };

  const targetBody = findBodyByName(bodies, targetBodyName);
  const directionSet = makeDirectionSet(initialState, targetBody);
  const candidates = [];

  for (const departureDelayDays of plannerOptions.departureDelayDays) {
    for (const transferDays of plannerOptions.transferDays) {
      for (const burnMagnitudeKmS of plannerOptions.burnMagnitudesKmS) {
        for (const directionChoice of directionSet) {
          const usesExplicitDeltaV = typeof directionChoice.deltaV === "function";
          if (!usesExplicitDeltaV && burnMagnitudeKmS === 0 && directionChoice.name !== "coast") {
            continue;
          }
          if (usesExplicitDeltaV && burnMagnitudeKmS !== 0) {
            continue;
          }

          const result = evaluateCandidate({
            simulator,
            bodies,
            initialState,
            targetBody,
            directionChoice,
            burnMagnitudeKmS,
            departureDelaySeconds: departureDelayDays * DAY_SECONDS,
            transferDurationSeconds: transferDays * DAY_SECONDS,
            plannerOptions,
          });
          candidates.push(result);
        }
      }
    }
  }

  candidates.sort((a, b) => a.score - b.score);

  return {
    targetBody: targetBodyName,
    objective: {
      fuelWeight: plannerOptions.weightFuel,
      timeWeight: plannerOptions.weightTime,
      hazardWeight: plannerOptions.weightHazard,
    },
    best: candidates[0] ?? null,
    topCandidates: candidates.slice(0, plannerOptions.topCount),
    candidateCount: candidates.length,
  };
}

function formatPlanSummary(plan) {
  if (!plan.best) {
    return "No feasible trajectory candidates were produced.";
  }

  const lines = [];
  lines.push(`Trajectory target: ${plan.targetBody}`);
  lines.push(`Candidates tested: ${plan.candidateCount}`);
  lines.push("");
  lines.push("Best plan:");
  lines.push(`  Direction: ${plan.best.direction}`);
  lines.push(`  Delta-V: ${plan.best.deltaVKmS.toFixed(3)} km/s`);
  lines.push(`  Estimated fuel used: ${plan.best.fuelUsedKg.toFixed(1)} kg`);
  lines.push(`  Fuel-feasible: ${plan.best.feasibleFuel ? "yes" : "no"}`);
  lines.push(`  Departure delay: ${plan.best.departureDelayDays.toFixed(1)} days`);
  lines.push(`  Transfer time: ${plan.best.transferDays.toFixed(1)} days`);
  lines.push(`  Closest approach to target: ${plan.best.minDistanceToTargetKm.toFixed(0)} km`);
  lines.push(`  Final target distance: ${plan.best.finalDistanceKm.toFixed(0)} km`);
  lines.push(`  Arrival relative speed: ${plan.best.arrivalRelativeSpeedKmS.toFixed(3)} km/s`);
  lines.push(`  Hazard exposure score: ${plan.best.hazardExposure.toFixed(2)}`);
  if (plan.best.hazardHits.length > 0) {
    lines.push(`  Hazard zones crossed: ${plan.best.hazardHits.join(", ")}`);
  }
  lines.push("");
  lines.push("Top candidates:");
  plan.topCandidates.forEach((candidate, index) => {
    lines.push(
      `  ${index + 1}. ${candidate.direction}, dv=${candidate.deltaVKmS.toFixed(2)} km/s, fuel=${candidate.fuelUsedKg.toFixed(1)} kg, depart=${candidate.departureDelayDays.toFixed(1)} d, transfer=${candidate.transferDays.toFixed(1)} d, finalDist=${candidate.finalDistanceKm.toFixed(0)} km, hazard=${candidate.hazardExposure.toFixed(2)}`
    );
  });
  return lines.join("\n");
}

module.exports = {
  AU_KM,
  DAY_SECONDS,
  impulseFuelUsedKg,
  impulseFuelRequiredKg,
  planTrajectory,
  formatPlanSummary,
};
