"use strict";

const AU_KM = 149_597_870.7;
const DAY_SECONDS = 86_400;
const G0 = 9.80665;
const BASE_DATE = new Date("2026-04-10T12:00:00Z");
const ORIGIN_ATTACHMENT_THRESHOLD_KM = 5_000_000;

const BODY_STYLES = [
  { key: "sun", label: "Sun", color: "#ffd166", radiusPx: 8 },
  { key: "mercury", label: "Mercury", color: "#c9b18d", radiusPx: 4 },
  { key: "venus", label: "Venus", color: "#ffb870", radiusPx: 5 },
  { key: "earth", label: "Earth", color: "#58a6ff", radiusPx: 5 },
  { key: "moon", label: "Moon", color: "#d8dde6", radiusPx: 3 },
  { key: "mars", label: "Mars", color: "#ff7f50", radiusPx: 4 },
  { key: "jupiter", label: "Jupiter", color: "#f4d19b", radiusPx: 7 },
  { key: "saturn", label: "Saturn", color: "#e7d3a6", radiusPx: 6 },
  { key: "uranus", label: "Uranus", color: "#8be9fd", radiusPx: 5 },
  { key: "neptune", label: "Neptune", color: "#4479ff", radiusPx: 5 },
  { key: "pluto", label: "Pluto", color: "#b8a48c", radiusPx: 3 },
  { key: "destination", label: "Destination", color: "#ff5fa2", radiusPx: 6 },
  { key: "spacecraft", label: "Spacecraft", color: "#7bdff6", radiusPx: 5 },
];

const ORBITS = {
  mercury: { radiusKm: 57_909_050, periodDays: 87.97, phase: 2.1, zAmplitudeKm: 500_000 },
  venus: { radiusKm: 108_208_000, periodDays: 224.7, phase: 0.8, zAmplitudeKm: 900_000 },
  earth: { radiusKm: AU_KM, periodDays: 365.25, phase: 0.15, zAmplitudeKm: 1_200_000 },
  mars: { radiusKm: 227_939_200, periodDays: 686.98, phase: 1.7, zAmplitudeKm: 1_800_000 },
  jupiter: { radiusKm: 778_340_821, periodDays: 4332.59, phase: 2.7, zAmplitudeKm: 4_500_000 },
  saturn: { radiusKm: 1_426_666_422, periodDays: 10_759.22, phase: 0.5, zAmplitudeKm: 8_200_000 },
  uranus: { radiusKm: 2_870_658_186, periodDays: 30_688.5, phase: 1.35, zAmplitudeKm: 12_000_000 },
  neptune: { radiusKm: 4_498_396_441, periodDays: 60_182, phase: 2.15, zAmplitudeKm: 15_500_000 },
  pluto: { radiusKm: 5_906_376_272, periodDays: 90_560, phase: 2.95, zAmplitudeKm: 780_000_000 },
};

const ASTEROID_LAYERS = [
  {
    key: "main-belt-inner",
    label: "Main Belt",
    color: "rgba(198, 212, 235, 0.42)",
    count: 220,
    radiusMinKm: 2.05 * AU_KM,
    radiusMaxKm: 3.35 * AU_KM,
    zSpreadKm: 8_000_000,
    basePhase: 0.4,
    drift: 0.012,
  },
  {
    key: "greeks",
    label: "Jupiter Trojans",
    color: "rgba(244, 209, 155, 0.32)",
    count: 110,
    radiusMinKm: 5.0 * AU_KM,
    radiusMaxKm: 5.35 * AU_KM,
    zSpreadKm: 12_000_000,
    basePhase: 2.7,
    drift: 0.008,
  },
  {
    key: "kuiper",
    label: "Kuiper Objects",
    color: "rgba(135, 170, 255, 0.18)",
    count: 260,
    radiusMinKm: 30 * AU_KM,
    radiusMaxKm: 47 * AU_KM,
    zSpreadKm: 250_000_000,
    basePhase: 1.25,
    drift: 0.0024,
  },
];

const DEBRIS_FIELDS = [
  {
    key: "leo",
    label: "LEO Debris",
    color: "rgba(123, 223, 246, 0.42)",
    anchor: "earth",
    count: 90,
    radiusMinKm: 7_000,
    radiusMaxKm: 12_500,
    zSpreadKm: 2_500,
    drift: 0.14,
  },
  {
    key: "geo",
    label: "GEO Debris",
    color: "rgba(255, 165, 120, 0.32)",
    anchor: "earth",
    count: 70,
    radiusMinKm: 41_000,
    radiusMaxKm: 46_000,
    zSpreadKm: 6_000,
    drift: 0.08,
  },
  {
    key: "mars-transfer",
    label: "Transfer Debris",
    color: "rgba(255, 127, 80, 0.22)",
    anchor: "sun",
    count: 80,
    radiusMinKm: 1.25 * AU_KM,
    radiusMaxKm: 1.8 * AU_KM,
    zSpreadKm: 10_000_000,
    drift: 0.01,
  },
];

function byId(id) {
  return document.getElementById(id);
}

function formatKm(value) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} km`;
}

function formatAu(valueKm) {
  return `${(valueKm / AU_KM).toFixed(3)} AU`;
}

function formatDateFromDayOffset(dayOffset) {
  const date = new Date(BASE_DATE.getTime() + dayOffset * DAY_SECONDS * 1000);
  return date.toISOString().replace("Z", "");
}

function clampNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function makeBodyPosition(radiusKm, periodDays, phase, dayOffset, zAmplitudeKm) {
  const periodSeconds = periodDays * DAY_SECONDS;
  const theta = phase + ((2 * Math.PI) / periodSeconds) * (dayOffset * DAY_SECONDS);

  return {
    x: radiusKm * Math.cos(theta),
    y: radiusKm * Math.sin(theta),
    z: zAmplitudeKm * Math.sin(theta * 0.6),
  };
}

function getSceneState(dayOffset) {
  const scene = {
    sun: { x: 0, y: 0, z: 0 },
    mercury: makeBodyPosition(
      ORBITS.mercury.radiusKm,
      ORBITS.mercury.periodDays,
      ORBITS.mercury.phase,
      dayOffset,
      ORBITS.mercury.zAmplitudeKm
    ),
    venus: makeBodyPosition(
      ORBITS.venus.radiusKm,
      ORBITS.venus.periodDays,
      ORBITS.venus.phase,
      dayOffset,
      ORBITS.venus.zAmplitudeKm
    ),
    earth: makeBodyPosition(
      ORBITS.earth.radiusKm,
      ORBITS.earth.periodDays,
      ORBITS.earth.phase,
      dayOffset,
      ORBITS.earth.zAmplitudeKm
    ),
    moon: { x: 0, y: 0, z: 0 },
    mars: makeBodyPosition(
      ORBITS.mars.radiusKm,
      ORBITS.mars.periodDays,
      ORBITS.mars.phase,
      dayOffset,
      ORBITS.mars.zAmplitudeKm
    ),
    jupiter: makeBodyPosition(
      ORBITS.jupiter.radiusKm,
      ORBITS.jupiter.periodDays,
      ORBITS.jupiter.phase,
      dayOffset,
      ORBITS.jupiter.zAmplitudeKm
    ),
    saturn: makeBodyPosition(
      ORBITS.saturn.radiusKm,
      ORBITS.saturn.periodDays,
      ORBITS.saturn.phase,
      dayOffset,
      ORBITS.saturn.zAmplitudeKm
    ),
    uranus: makeBodyPosition(
      ORBITS.uranus.radiusKm,
      ORBITS.uranus.periodDays,
      ORBITS.uranus.phase,
      dayOffset,
      ORBITS.uranus.zAmplitudeKm
    ),
    neptune: makeBodyPosition(
      ORBITS.neptune.radiusKm,
      ORBITS.neptune.periodDays,
      ORBITS.neptune.phase,
      dayOffset,
      ORBITS.neptune.zAmplitudeKm
    ),
    pluto: makeBodyPosition(
      ORBITS.pluto.radiusKm,
      ORBITS.pluto.periodDays,
      ORBITS.pluto.phase,
      dayOffset,
      ORBITS.pluto.zAmplitudeKm
    ),
  };

  scene.moon = (() => {
    const moonAngle = 1.1 + ((2 * Math.PI) / (27.321661 * DAY_SECONDS)) * (dayOffset * DAY_SECONDS);
    return {
      x: scene.earth.x + 384_400 * Math.cos(moonAngle),
      y: scene.earth.y + 384_400 * Math.sin(moonAngle),
      z: scene.earth.z + 8_000 * Math.sin(moonAngle * 0.6),
    };
  })();

  return scene;
}

function getDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

function addVec(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subVec(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scaleVec(a, scalar) {
  return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar };
}

function magnitude(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function estimateFuelRequiredKg(deltaVKmS, dryMassKg, fuelMassKg, ispSeconds) {
  if (!(deltaVKmS > 0) || !(ispSeconds > 0)) {
    return 0;
  }

  const initialMass = dryMassKg + fuelMassKg;
  const deltaVMS = deltaVKmS * 1000;
  const finalMass = initialMass / Math.exp(deltaVMS / (ispSeconds * G0));
  return Math.max(0, initialMass - finalMass);
}

function getRenderableBodyKeys() {
  return BODY_STYLES
    .map((style) => style.key)
    .filter((key) => !["spacecraft", "destination"].includes(key));
}

function estimateBodyVelocity(key, dayOffset) {
  const deltaDays = 0.05;
  const previous = getSceneState(dayOffset - deltaDays)[key];
  const next = getSceneState(dayOffset + deltaDays)[key];
  return scaleVec(subVec(next, previous), 1 / (2 * deltaDays * DAY_SECONDS));
}

function createRenderer(canvas, projection) {
  const context = canvas.getContext("2d");

  function toCanvasPoint(point, maxRadiusKm) {
    const padding = 52;
    const size = Math.min(canvas.width, canvas.height);
    const center = size / 2;
    const scale = (center - padding) / maxRadiusKm;
    const primary = projection === "xy" ? point.y : point.z;

    return {
      x: center + point.x * scale,
      y: center - primary * scale,
    };
  }

  function drawGrid(maxRadiusKm) {
    const steps = 4;
    const size = Math.min(canvas.width, canvas.height);
    const center = size / 2;
    const tickRadius = maxRadiusKm / steps;

    context.save();
    context.strokeStyle = "rgba(120, 155, 220, 0.16)";
    context.lineWidth = 1;

    for (let i = 1; i <= steps; i += 1) {
      const radius = ((center - 52) / steps) * i;
      context.beginPath();
      context.arc(center, center, radius, 0, Math.PI * 2);
      context.stroke();
    }

    context.strokeStyle = "rgba(255, 255, 255, 0.35)";
    context.beginPath();
    context.moveTo(0, center);
    context.lineTo(size, center);
    context.moveTo(center, 0);
    context.lineTo(center, size);
    context.stroke();

    context.fillStyle = "rgba(238, 244, 255, 0.65)";
    context.font = "12px IBM Plex Sans, sans-serif";
    context.fillText("Sun / Origin", center + 10, center - 10);

    for (let i = 1; i <= steps; i += 1) {
      const labelKm = tickRadius * i;
      context.fillStyle = "rgba(158, 175, 201, 0.75)";
      context.fillText(formatAu(labelKm), center + 10, center - ((center - 52) / steps) * i - 6);
    }

    context.restore();
  }

  function drawOrbit(radiusKm, maxRadiusKm) {
    const size = Math.min(canvas.width, canvas.height);
    const center = size / 2;
    const scale = (center - 52) / maxRadiusKm;

    context.save();
    context.strokeStyle = "rgba(255, 255, 255, 0.08)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(center, center, radiusKm * scale, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawPointCloud(points, color, maxRadiusKm) {
    context.save();
    context.fillStyle = color;
    context.globalAlpha = 0.85;

    points.forEach((point) => {
      const canvasPoint = toCanvasPoint(point, maxRadiusKm);
      context.beginPath();
      context.arc(canvasPoint.x, canvasPoint.y, 1.4, 0, Math.PI * 2);
      context.fill();
    });

    context.restore();
  }

  function drawPath(points, color, maxRadiusKm, lineDash = []) {
    if (!points || points.length < 2) return;

    context.save();
    context.strokeStyle = color;
    context.lineWidth = 2.2;
    context.setLineDash(lineDash);
    context.beginPath();

    points.forEach((point, index) => {
      const canvasPoint = toCanvasPoint(point, maxRadiusKm);
      if (index === 0) {
        context.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        context.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });

    context.stroke();
    context.restore();
  }

  function drawRing(point, color, maxRadiusKm) {
    const canvasPoint = toCanvasPoint(point, maxRadiusKm);
    context.save();
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(canvasPoint.x, canvasPoint.y, 10, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawBody(point, style, maxRadiusKm, showLabels) {
    const canvasPoint = toCanvasPoint(point, maxRadiusKm);

    context.save();
    context.fillStyle = style.color;
    context.shadowColor = style.color;
    context.shadowBlur = style.key === "sun" ? 20 : 10;
    context.beginPath();
    context.arc(canvasPoint.x, canvasPoint.y, style.radiusPx, 0, Math.PI * 2);
    context.fill();

    if (showLabels) {
      context.shadowBlur = 0;
      context.fillStyle = "rgba(238, 244, 255, 0.9)";
      context.font = "13px IBM Plex Sans, sans-serif";
      context.fillText(style.label, canvasPoint.x + 10, canvasPoint.y - 10);
    }

    context.restore();
  }

  return function render(scene, spacecraft, options) {
    const maxRadiusKm = options.maxRadiusKm;

    context.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(maxRadiusKm);

    if (options.showOrbits) {
      Object.values(ORBITS).forEach((orbit) => drawOrbit(orbit.radiusKm, maxRadiusKm));
    }

    options.asteroidLayers.forEach((layer) => {
      drawPointCloud(layer.points, layer.color, maxRadiusKm);
    });

    options.debrisFields.forEach((field) => {
      drawPointCloud(field.points, field.color, maxRadiusKm);
    });

    drawPath(options.waitPath, "rgba(255,255,255,0.38)", maxRadiusKm, [5, 5]);
    drawPath(options.transferPath, "rgba(123,223,246,0.95)", maxRadiusKm);

    BODY_STYLES.filter((style) => style.key !== "spacecraft").forEach((style) => {
      if (style.key === "destination") return;
      drawBody(scene[style.key], style, maxRadiusKm, options.showLabels);
    });

    if (options.destinationPoint) {
      drawBody(
        options.destinationPoint,
        BODY_STYLES.find((style) => style.key === "destination"),
        maxRadiusKm,
        options.showLabels
      );
      drawRing(options.destinationPoint, "rgba(255,95,162,0.8)", maxRadiusKm);
    }

    if (options.arrivalDestinationPoint) {
      drawRing(options.arrivalDestinationPoint, "rgba(255,255,255,0.7)", maxRadiusKm);
    }

    drawBody(spacecraft, BODY_STYLES.find((style) => style.key === "spacecraft"), maxRadiusKm, options.showLabels);
  };
}

const state = {
  inputs: {
    x: byId("spacecraft-x"),
    y: byId("spacecraft-y"),
    z: byId("spacecraft-z"),
    destinationSelect: byId("destination-select"),
    destinationX: byId("destination-x"),
    destinationY: byId("destination-y"),
    destinationZ: byId("destination-z"),
    cruiseSpeed: byId("cruise-speed"),
    dryMass: byId("dry-mass"),
    fuelMass: byId("fuel-mass"),
    ispSeconds: byId("isp-seconds"),
    windowDays: byId("window-days"),
    maxTravelDays: byId("max-travel-days"),
    scale: byId("scale-au"),
    dayOffset: byId("day-offset"),
    showOrbits: byId("show-orbits"),
    showLabels: byId("show-labels"),
    preset: byId("preset-select"),
  },
  outputs: {
    scaleLabel: byId("scale-label"),
    dayLabel: byId("day-label"),
    sunDistance: byId("sun-distance"),
    earthDistance: byId("earth-distance"),
    marsDistance: byId("mars-distance"),
    scaleMetric: byId("scale-metric"),
    destinationDistance: byId("destination-distance"),
    travelMetric: byId("travel-metric"),
    fuelMetric: byId("fuel-metric"),
    departureMetric: byId("departure-metric"),
    trajectorySummary: byId("trajectory-summary"),
    legend: byId("legend"),
  },
  renderXY: createRenderer(byId("canvas-xy"), "xy"),
  renderXZ: createRenderer(byId("canvas-xz"), "xz"),
};

function setCoordinates(position) {
  state.inputs.x.value = position.x.toFixed(1);
  state.inputs.y.value = position.y.toFixed(1);
  state.inputs.z.value = position.z.toFixed(1);
}

function getSpacecraftPosition() {
  return {
    x: clampNumber(state.inputs.x.value, 0),
    y: clampNumber(state.inputs.y.value, 0),
    z: clampNumber(state.inputs.z.value, 0),
  };
}

function setDestinationCoordinates(position) {
  state.inputs.destinationX.value = position.x.toFixed(1);
  state.inputs.destinationY.value = position.y.toFixed(1);
  state.inputs.destinationZ.value = position.z.toFixed(1);
}

function getDestinationAccessor(dayOffset) {
  const selected = state.inputs.destinationSelect.value;
  if (selected === "custom") {
    const customPoint = {
      x: clampNumber(state.inputs.destinationX.value, 0),
      y: clampNumber(state.inputs.destinationY.value, 0),
      z: clampNumber(state.inputs.destinationZ.value, 0),
    };
    return {
      key: "custom",
      label: "Custom destination",
      currentPoint: customPoint,
      positionAt() {
        return customPoint;
      },
      velocityAt() {
        return { x: 0, y: 0, z: 0 };
      },
    };
  }

  const currentPoint = getSceneState(dayOffset)[selected];
  return {
    key: selected,
    label: BODY_STYLES.find((style) => style.key === selected)?.label ?? selected,
    currentPoint,
    positionAt(targetDayOffset) {
      return getSceneState(targetDayOffset)[selected];
    },
    velocityAt(targetDayOffset) {
      return estimateBodyVelocity(selected, targetDayOffset);
    },
  };
}

function inferTrackedOrigin(spacecraft, dayOffset) {
  const scene = getSceneState(dayOffset);
  const candidates = getRenderableBodyKeys()
    .filter((key) => key !== "sun")
    .map((key) => ({
      key,
      point: scene[key],
      distanceKm: getDistance(spacecraft, scene[key]),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearest = candidates[0];
  if (nearest && nearest.distanceKm <= ORIGIN_ATTACHMENT_THRESHOLD_KM) {
    const offset = subVec(spacecraft, nearest.point);
    return {
      label: `Attached to ${BODY_STYLES.find((style) => style.key === nearest.key)?.label ?? nearest.key}`,
      positionAt(targetDayOffset) {
        return addVec(getSceneState(targetDayOffset)[nearest.key], offset);
      },
      velocityAt(targetDayOffset) {
        return estimateBodyVelocity(nearest.key, targetDayOffset);
      },
    };
  }

  return {
    label: "Free-space origin",
    positionAt() {
      return spacecraft;
    },
    velocityAt() {
      return { x: 0, y: 0, z: 0 };
    },
  };
}

function applyPreset() {
  const preset = state.inputs.preset.value;
  const dayOffset = clampNumber(state.inputs.dayOffset.value, 0);
  const scene = getSceneState(dayOffset);

  if (preset === "sun") {
    setCoordinates(scene.sun);
  } else if (preset === "earth") {
    setCoordinates({ ...scene.earth, z: scene.earth.z + 500_000 });
  } else if (preset === "mars") {
    setCoordinates({ ...scene.mars, z: scene.mars.z + 750_000 });
  } else if (preset === "jupiter") {
    setCoordinates({ ...scene.jupiter, z: scene.jupiter.z + 1_500_000 });
  }
}

function syncDestinationToSelection() {
  const selected = state.inputs.destinationSelect.value;
  if (selected === "custom") return;
  const dayOffset = clampNumber(state.inputs.dayOffset.value, 0);
  setDestinationCoordinates(getSceneState(dayOffset)[selected]);
}

function makeDeterministicPoints(layer, dayOffset, anchorPoint = { x: 0, y: 0, z: 0 }) {
  const points = [];

  for (let i = 0; i < layer.count; i += 1) {
    const ratio = layer.count === 1 ? 0 : i / (layer.count - 1);
    const radiusKm = layer.radiusMinKm + (layer.radiusMaxKm - layer.radiusMinKm) * ratio;
    const angle = layer.basePhase != null
      ? layer.basePhase + i * 0.137 + dayOffset * layer.drift
      : i * 0.31 + dayOffset * layer.drift;
    const zWave = Math.sin(i * 1.71 + dayOffset * layer.drift * 11);
    points.push({
      x: anchorPoint.x + radiusKm * Math.cos(angle),
      y: anchorPoint.y + radiusKm * Math.sin(angle),
      z: anchorPoint.z + zWave * layer.zSpreadKm,
    });
  }

  return points;
}

function buildLegend() {
  state.outputs.legend.innerHTML = "";

  BODY_STYLES.forEach((style) => {
    const item = document.createElement("div");
    item.className = "legend-item";

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = style.color;

    const label = document.createElement("span");
    label.textContent = style.label;

    item.appendChild(swatch);
    item.appendChild(label);
    state.outputs.legend.appendChild(item);
  });
}

function buildRoutePlan(spacecraft, dayOffset) {
  const destination = getDestinationAccessor(dayOffset);
  const origin = inferTrackedOrigin(spacecraft, dayOffset);
  const cruiseSpeedKmS = Math.max(0.1, clampNumber(state.inputs.cruiseSpeed.value, 25));
  const dryMassKg = Math.max(1, clampNumber(state.inputs.dryMass.value, 1500));
  const fuelMassKg = Math.max(0, clampNumber(state.inputs.fuelMass.value, 700));
  const ispSeconds = Math.max(1, clampNumber(state.inputs.ispSeconds.value, 320));
  const windowDays = Math.max(0, Math.floor(clampNumber(state.inputs.windowDays.value, 365)));
  const maxTravelDays = Math.max(1, Math.floor(clampNumber(state.inputs.maxTravelDays.value, 500)));

  let best = null;

  for (let departureOffset = 0; departureOffset <= windowDays; departureOffset += 1) {
    const departureDay = dayOffset + departureOffset;
    const originPosition = origin.positionAt(departureDay);
    const originVelocity = origin.velocityAt(departureDay);

    for (let travelDays = 1; travelDays <= maxTravelDays; travelDays += 1) {
      const arrivalDay = departureDay + travelDays;
      const targetPosition = destination.positionAt(arrivalDay);
      const targetVelocity = destination.velocityAt(arrivalDay);
      const travelSeconds = travelDays * DAY_SECONDS;
      const lineVelocity = scaleVec(subVec(targetPosition, originPosition), 1 / travelSeconds);
      const requiredCruiseSpeedKmS = magnitude(subVec(lineVelocity, originVelocity));

      if (requiredCruiseSpeedKmS > cruiseSpeedKmS) {
        continue;
      }

      const requiredFuelKg = estimateFuelRequiredKg(
        requiredCruiseSpeedKmS,
        dryMassKg,
        fuelMassKg,
        ispSeconds
      );

      const candidate = {
        originLabel: origin.label,
        destinationLabel: destination.label,
        departureDay,
        departureOffset,
        arrivalDay,
        travelDays,
        requiredCruiseSpeedKmS,
        requiredFuelKg,
        fuelFeasible: requiredFuelKg <= fuelMassKg,
        relativeArrivalSpeedKmS: magnitude(subVec(lineVelocity, targetVelocity)),
        departurePoint: originPosition,
        currentDestinationPoint: destination.currentPoint,
        arrivalDestinationPoint: targetPosition,
        lineVelocity,
      };

      if (
        !best ||
        candidate.arrivalDay < best.arrivalDay ||
        (candidate.arrivalDay === best.arrivalDay && candidate.travelDays < best.travelDays) ||
        (candidate.arrivalDay === best.arrivalDay &&
          candidate.travelDays === best.travelDays &&
          candidate.requiredFuelKg < best.requiredFuelKg)
      ) {
        best = candidate;
      }

      break;
    }
  }

  if (!best) {
    return {
      found: false,
      destinationPoint: destination.currentPoint,
      destinationLabel: destination.label,
    };
  }

  const waitPath = [];
  if (best.departureOffset > 0 && origin.label.startsWith("Attached")) {
    const samples = Math.min(24, best.departureOffset + 1);
    for (let i = 0; i <= samples; i += 1) {
      const sampleDay = dayOffset + (best.departureOffset * i) / samples;
      waitPath.push(origin.positionAt(sampleDay));
    }
  }

  const transferPath = [];
  const transferSamples = Math.min(80, Math.max(10, best.travelDays));
  for (let i = 0; i <= transferSamples; i += 1) {
    const fraction = i / transferSamples;
    transferPath.push(
      addVec(best.departurePoint, scaleVec(best.lineVelocity, fraction * best.travelDays * DAY_SECONDS))
    );
  }

  return {
    found: true,
    ...best,
    waitPath,
    transferPath,
  };
}

function render() {
  const dayOffset = clampNumber(state.inputs.dayOffset.value, 0);
  if (state.inputs.destinationSelect.value !== "custom") {
    setDestinationCoordinates(getSceneState(dayOffset)[state.inputs.destinationSelect.value]);
  }
  const maxRadiusKm = clampNumber(state.inputs.scale.value, 8) * AU_KM;
  const scene = getSceneState(dayOffset);
  const spacecraft = getSpacecraftPosition();
  const routePlan = buildRoutePlan(spacecraft, dayOffset);
  const options = {
    maxRadiusKm,
    showOrbits: state.inputs.showOrbits.checked,
    showLabels: state.inputs.showLabels.checked,
    asteroidLayers: ASTEROID_LAYERS.map((layer) => ({
      ...layer,
      points: makeDeterministicPoints(layer, dayOffset),
    })),
    debrisFields: DEBRIS_FIELDS.map((field) => ({
      ...field,
      points: makeDeterministicPoints(
        field,
        dayOffset,
        field.anchor === "earth" ? scene.earth : scene.sun
      ),
    })),
    destinationPoint: routePlan.destinationPoint,
    arrivalDestinationPoint: routePlan.arrivalDestinationPoint ?? null,
    waitPath: routePlan.waitPath ?? [],
    transferPath: routePlan.transferPath ?? [],
  };

  state.renderXY(scene, spacecraft, options);
  state.renderXZ(scene, spacecraft, options);

  state.outputs.scaleLabel.textContent = `${state.inputs.scale.value} AU from the Sun at the edge of each view`;
  state.outputs.dayLabel.textContent = `Day offset: ${dayOffset}`;
  state.outputs.scaleMetric.textContent = `${state.inputs.scale.value} AU`;
  state.outputs.sunDistance.textContent = `${formatKm(getDistance(spacecraft, scene.sun))} (${formatAu(getDistance(spacecraft, scene.sun))})`;
  state.outputs.earthDistance.textContent = `${formatKm(getDistance(spacecraft, scene.earth))} (${formatAu(getDistance(spacecraft, scene.earth))})`;
  state.outputs.marsDistance.textContent = `${formatKm(getDistance(spacecraft, scene.mars))} (${formatAu(getDistance(spacecraft, scene.mars))})`;
  state.outputs.destinationDistance.textContent = `${formatKm(getDistance(spacecraft, routePlan.destinationPoint))} (${formatAu(getDistance(spacecraft, routePlan.destinationPoint))})`;

  if (routePlan.found) {
    state.outputs.travelMetric.textContent = `${routePlan.travelDays.toFixed(0)} days`;
    state.outputs.fuelMetric.textContent = `${formatKm(routePlan.requiredFuelKg)} kg`;
    state.outputs.departureMetric.textContent = `Day ${routePlan.departureDay.toFixed(0)}`;
    state.outputs.trajectorySummary.textContent =
      `Fastest reachable route to ${routePlan.destinationLabel} leaves on ${formatDateFromDayOffset(routePlan.departureDay)}, arrives on ${formatDateFromDayOffset(routePlan.arrivalDay)}, needs ${routePlan.requiredCruiseSpeedKmS.toFixed(2)} km/s of cruise speed, and ${routePlan.fuelFeasible ? "fits within" : "exceeds"} the entered fuel budget. Relative arrival speed is ${routePlan.relativeArrivalSpeedKmS.toFixed(2)} km/s. Origin model: ${routePlan.originLabel}.`;
  } else {
    state.outputs.travelMetric.textContent = "No route";
    state.outputs.fuelMetric.textContent = "Too slow";
    state.outputs.departureMetric.textContent = "No window";
    state.outputs.trajectorySummary.textContent =
      `No reachable route to ${routePlan.destinationLabel} was found within the scanned departure and travel window at the entered cruise speed. Increase cruise speed, extend the window, or choose a nearer destination.`;
  }
}

[
  state.inputs.x,
  state.inputs.y,
  state.inputs.z,
  state.inputs.destinationX,
  state.inputs.destinationY,
  state.inputs.destinationZ,
  state.inputs.destinationSelect,
  state.inputs.cruiseSpeed,
  state.inputs.dryMass,
  state.inputs.fuelMass,
  state.inputs.ispSeconds,
  state.inputs.windowDays,
  state.inputs.maxTravelDays,
  state.inputs.scale,
  state.inputs.dayOffset,
  state.inputs.showOrbits,
  state.inputs.showLabels,
].forEach((element) => {
  element.addEventListener("input", render);
});

state.inputs.preset.addEventListener("change", () => {
  applyPreset();
  render();
});

state.inputs.destinationSelect.addEventListener("change", () => {
  syncDestinationToSelection();
  render();
});

buildLegend();
syncDestinationToSelection();
render();
