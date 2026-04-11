"use strict";

const path = require("path");
const { Vec3, createSpiceEnvironment } = require("./spice-integration");

const DAY_SECONDS = 86_400;
const AU_KM = 149_597_870.7;

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

function readStringArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

function hasArg(name) {
  const prefix = `--${name}=`;
  return process.argv.some((arg) => arg.startsWith(prefix));
}

function formatDate(spice, et) {
  return spice.time.etToUtc(et, "ISOC", 3);
}

function formatKm(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDays(value) {
  return value.toFixed(2);
}

function normalizeBodyName(name) {
  return String(name)
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function resolveBodyName(name, availableNames) {
  const requested = normalizeBodyName(name);
  const match = availableNames.find((candidate) => {
    const normalized = normalizeBodyName(candidate);
    return (
      normalized === requested ||
      normalized.replace(/ BARYCENTER$/, "") === requested
    );
  });

  if (!match) {
    throw new Error(`Unknown body "${name}". Available: ${availableNames.join(", ")}`);
  }

  return match;
}

function buildBodyAccessor(spice, bodyName) {
  return {
    type: "body",
    label: bodyName,
    positionAt(et) {
      return spice.geometry.getState(bodyName, et, "J2000", "NONE", "SOLAR SYSTEM BARYCENTER").state.position;
    },
    velocityAt(et) {
      return spice.geometry.getState(bodyName, et, "J2000", "NONE", "SOLAR SYSTEM BARYCENTER").state.velocity;
    },
  };
}

function buildCoordinateAccessor(prefix) {
  const x = readNumberArg(`${prefix}-x`, null);
  const y = readNumberArg(`${prefix}-y`, null);
  const z = readNumberArg(`${prefix}-z`, null);

  if ([x, y, z].some((value) => value == null)) {
    throw new Error(
      `${prefix} coordinates require --${prefix}-x, --${prefix}-y, and --${prefix}-z`
    );
  }

  const vx = readNumberArg(`${prefix}-vx`, 0);
  const vy = readNumberArg(`${prefix}-vy`, 0);
  const vz = readNumberArg(`${prefix}-vz`, 0);
  const position = new Vec3(x, y, z);
  const velocity = new Vec3(vx, vy, vz);

  return {
    type: "coordinates",
    label: `${prefix.toUpperCase()} XYZ`,
    positionAt(et, baseEt) {
      const dt = et - baseEt;
      return position.add(velocity.scale(dt));
    },
    velocityAt() {
      return velocity;
    },
  };
}

function buildAccessor(spice, prefix, availableNames, baseEt) {
  const bodyArg = readStringArg(prefix, null);
  if (bodyArg) {
    const bodyName = resolveBodyName(bodyArg, availableNames);
    return buildBodyAccessor(spice, bodyName);
  }

  if (hasArg(`${prefix}-x`) || hasArg(`${prefix}-y`) || hasArg(`${prefix}-z`)) {
    const accessor = buildCoordinateAccessor(prefix);
    return {
      ...accessor,
      positionAt(et) {
        return accessor.positionAt(et, baseEt);
      },
    };
  }

  throw new Error(`Missing --${prefix}=BODY or explicit --${prefix}-x/--${prefix}-y/--${prefix}-z`);
}

function requiredCruiseSpeedKmS(originPos, originVel, targetPos, travelSeconds) {
  const lineVelocity = targetPos.sub(originPos).scale(1 / travelSeconds);
  return lineVelocity.sub(originVel).magnitude();
}

function estimateIntercept({
  origin,
  destination,
  departureEt,
  cruiseSpeedKmS,
  minTravelDays,
  maxTravelDays,
  travelStepHours,
}) {
  const originPos = origin.positionAt(departureEt);
  const originVel = origin.velocityAt(departureEt);
  const minTravelSeconds = minTravelDays * DAY_SECONDS;
  const maxTravelSeconds = maxTravelDays * DAY_SECONDS;
  const travelStepSeconds = Math.max(3600, travelStepHours * 3600);

  let best = null;

  for (let travelSeconds = minTravelSeconds; travelSeconds <= maxTravelSeconds; travelSeconds += travelStepSeconds) {
    const arrivalEt = departureEt + travelSeconds;
    const targetPos = destination.positionAt(arrivalEt);
    const targetVel = destination.velocityAt(arrivalEt);
    const requiredSpeed = requiredCruiseSpeedKmS(originPos, originVel, targetPos, travelSeconds);

    if (requiredSpeed <= cruiseSpeedKmS) {
      const lineVelocity = targetPos.sub(originPos).scale(1 / travelSeconds);
      const relativeArrivalSpeed = lineVelocity.sub(targetVel).magnitude();
      best = {
        departureEt,
        arrivalEt,
        travelSeconds,
        requiredSpeedKmS: requiredSpeed,
        arrivalDistanceKm: targetPos.sub(originPos.add(lineVelocity.scale(travelSeconds))).magnitude(),
        relativeArrivalSpeedKmS: relativeArrivalSpeed,
        originOrbitalSpeedKmS: originVel.magnitude(),
        destinationOrbitalSpeedKmS: targetVel.magnitude(),
        departureDistanceFromSunKm: originPos.magnitude(),
        arrivalDistanceFromSunKm: targetPos.magnitude(),
      };
      break;
    }
  }

  return best;
}

function scanDepartureWindows({
  spice,
  origin,
  destination,
  departureStartEt,
  cruiseSpeedKmS,
  departureWindowDays,
  departureStepDays,
  minTravelDays,
  maxTravelDays,
  travelStepHours,
}) {
  const candidates = [];

  for (let offsetDays = 0; offsetDays <= departureWindowDays; offsetDays += departureStepDays) {
    const departureEt = departureStartEt + offsetDays * DAY_SECONDS;
    const estimate = estimateIntercept({
      origin,
      destination,
      departureEt,
      cruiseSpeedKmS,
      minTravelDays,
      maxTravelDays,
      travelStepHours,
    });

    if (estimate) {
      candidates.push({
        ...estimate,
        departureOffsetDays: offsetDays,
      });
    }
  }

  candidates.sort((a, b) => a.travelSeconds - b.travelSeconds);
  return candidates;
}

function summarizeCandidates(spice, origin, destination, cruiseSpeedKmS, candidates) {
  if (candidates.length === 0) {
    return [
      `Origin: ${origin.label}`,
      `Destination: ${destination.label}`,
      `Cruise speed: ${cruiseSpeedKmS} km/s`,
      "",
      "No feasible intercept was found within the scanned departure and travel window.",
    ].join("\n");
  }

  const fastest = candidates[0];
  const earliestArrival = [...candidates].sort((a, b) => a.arrivalEt - b.arrivalEt)[0];
  const top = candidates.slice(0, 5);

  const lines = [];
  lines.push(`Origin: ${origin.label}`);
  lines.push(`Destination: ${destination.label}`);
  lines.push(`Cruise speed: ${cruiseSpeedKmS} km/s`);
  lines.push("");
  lines.push("Fastest departure window:");
  lines.push(`  Leave at: ${formatDate(spice, fastest.departureEt)}`);
  lines.push(`  Travel time: ${formatDays(fastest.travelSeconds / DAY_SECONDS)} days`);
  lines.push(`  Arrive at: ${formatDate(spice, fastest.arrivalEt)}`);
  lines.push(`  Required cruise speed from departure frame: ${fastest.requiredSpeedKmS.toFixed(3)} km/s`);
  lines.push(`  Origin orbital speed: ${fastest.originOrbitalSpeedKmS.toFixed(3)} km/s`);
  lines.push(`  Destination orbital speed at arrival: ${fastest.destinationOrbitalSpeedKmS.toFixed(3)} km/s`);
  lines.push(`  Relative arrival speed: ${fastest.relativeArrivalSpeedKmS.toFixed(3)} km/s`);
  lines.push(`  Origin heliocentric radius: ${(fastest.departureDistanceFromSunKm / AU_KM).toFixed(3)} AU`);
  lines.push(`  Arrival heliocentric radius: ${(fastest.arrivalDistanceFromSunKm / AU_KM).toFixed(3)} AU`);
  lines.push("");
  lines.push("Earliest arrival in the scanned window:");
  lines.push(`  Leave at: ${formatDate(spice, earliestArrival.departureEt)}`);
  lines.push(`  Travel time: ${formatDays(earliestArrival.travelSeconds / DAY_SECONDS)} days`);
  lines.push(`  Arrive at: ${formatDate(spice, earliestArrival.arrivalEt)}`);
  lines.push("");
  lines.push("Best departure options:");
  top.forEach((candidate, index) => {
    lines.push(
      `  ${index + 1}. depart ${formatDate(spice, candidate.departureEt)}, travel ${formatDays(candidate.travelSeconds / DAY_SECONDS)} d, arrive ${formatDate(spice, candidate.arrivalEt)}, rel-arrival ${candidate.relativeArrivalSpeedKmS.toFixed(2)} km/s`
    );
  });

  return lines.join("\n");
}

async function main() {
  const kernelDir = path.resolve("./kernels");
  const spice = await createSpiceEnvironment();
  spice.loadStandardSolarSystemKernels({
    lsk: path.join(kernelDir, "naif0012.tls"),
    pck: path.join(kernelDir, "gm_de440.tpc"),
    spk: path.join(kernelDir, "de440s.bsp"),
    extra: [],
  });

  const availableBodies = [
    "SUN",
    "MERCURY BARYCENTER",
    "VENUS BARYCENTER",
    "EARTH",
    "MOON",
    "MARS BARYCENTER",
    "JUPITER BARYCENTER",
    "SATURN BARYCENTER",
    "URANUS BARYCENTER",
    "NEPTUNE BARYCENTER",
    "PLUTO BARYCENTER",
  ];

  const startUtc = readStringArg("start-date", "2026-04-10T12:00:00 UTC");
  const departureStartEt = spice.time.utcToEt(startUtc);
  const cruiseSpeedKmS = readNumberArg("speed-kms", 20);
  const departureWindowDays = readNumberArg("window-days", 730);
  const departureStepDays = readNumberArg("departure-step-days", 1);
  const minTravelDays = readNumberArg("min-travel-days", 1);
  const maxTravelDays = readNumberArg("max-travel-days", 1200);
  const travelStepHours = readNumberArg("travel-step-hours", 12);

  const origin = buildAccessor(spice, "from", availableBodies, departureStartEt);
  const destination = buildAccessor(spice, "to", availableBodies, departureStartEt);

  const candidates = scanDepartureWindows({
    spice,
    origin,
    destination,
    departureStartEt,
    cruiseSpeedKmS,
    departureWindowDays,
    departureStepDays,
    minTravelDays,
    maxTravelDays,
    travelStepHours,
  });

  console.log(
    summarizeCandidates(spice, origin, destination, cruiseSpeedKmS, candidates)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
