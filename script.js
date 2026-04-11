(() => {
const canvas = document.getElementById("solarCanvas");
if (!canvas) {
  throw new Error("Canvas element #solarCanvas was not found.");
}

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("2D canvas context could not be created.");
}

const simTimeDisplay = document.getElementById("simTimeDisplay");
const controlMenuBtn = document.getElementById("controlMenuBtn");
const missionControls = document.getElementById("missionControls");
const nowBtn = document.getElementById("nowBtn");
const togglePauseBtn = document.getElementById("togglePauseBtn");
const applyTimeBtn = document.getElementById("applyTimeBtn");
const speedInput = document.getElementById("speedInput");
const customTimeInput = document.getElementById("customTime");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
const zoomDisplay = document.getElementById("zoomDisplay");
const openPlannerBtn = document.getElementById("openPlannerBtn");
const closePlannerBtn = document.getElementById("closePlannerBtn");
const plannerModal = document.getElementById("plannerModal");
const plannerBackdrop = document.getElementById("plannerBackdrop");
const planetOverviewPanel = document.querySelector(".planet-overview-panel");

const originMode = document.getElementById("originMode");
const originBody = document.getElementById("originBody");
const originBodyGroup = document.getElementById("originBodyGroup");
const originCustomGroup = document.getElementById("originCustomGroup");
const originCustomX = document.getElementById("originCustomX");
const originCustomY = document.getElementById("originCustomY");
const originCustomZ = document.getElementById("originCustomZ");

const destinationMode = document.getElementById("destinationMode");
const destinationBody = document.getElementById("destinationBody");
const destinationBodyGroup = document.getElementById("destinationBodyGroup");
const destinationCustomGroup = document.getElementById("destinationCustomGroup");
const destinationCustomX = document.getElementById("destinationCustomX");
const destinationCustomY = document.getElementById("destinationCustomY");
const destinationCustomZ = document.getElementById("destinationCustomZ");

const dryMassInput = document.getElementById("dryMassInput");
const fuelMassInput = document.getElementById("fuelMassInput");
const ispInput = document.getElementById("ispInput");
const preferTimeInput = document.getElementById("preferTimeInput");
const preferFuelInput = document.getElementById("preferFuelInput");
const swapRouteBtn = document.getElementById("swapRouteBtn");
const planRouteBtn = document.getElementById("planRouteBtn");
const routeSummary = document.getElementById("routeSummary");
const routeStats = document.getElementById("routeStats");
const departureTimerValue = document.getElementById("departureTimerValue");
const departureTimerMeta = document.getElementById("departureTimerMeta");
const arrivalTimerValue = document.getElementById("arrivalTimerValue");
const arrivalTimerMeta = document.getElementById("arrivalTimerMeta");
const missionStatusValue = document.getElementById("missionStatusValue");
const telemetryClosestBody = document.getElementById("telemetryClosestBody");
const telemetryAltitude = document.getElementById("telemetryAltitude");
const telemetryRelativeSpeed = document.getElementById("telemetryRelativeSpeed");
const telemetryDominantGravity = document.getElementById("telemetryDominantGravity");
const telemetrySolarDistance = document.getElementById("telemetrySolarDistance");
const telemetryShipSpeed = document.getElementById("telemetryShipSpeed");
const missionAlertText = document.getElementById("missionAlertText");
const planetInfo = document.getElementById("planetInfo");
const closePlanetInfoBtn = document.getElementById("closePlanetInfoBtn");
const planetEndpointBtn = document.getElementById("planetEndpointBtn");
const planetName = document.getElementById("planetName");
const planetDistance = document.getElementById("planetDistance");
const planetSize = document.getElementById("planetSize");
const planetTemp = document.getElementById("planetTemp");
const planetElements = document.getElementById("planetElements");
const planetOverviewImage = document.getElementById("planetOverviewImage");

const BrowserVec3 = window.Vec3;
const createBrowserSpiceEnvironment = window.createSpiceEnvironment;

if (typeof BrowserVec3 !== "function") {
  throw new Error("SPICE vector helper failed to load.");
}

if (typeof createBrowserSpiceEnvironment !== "function") {
  throw new Error("SPICE browser environment failed to load.");
}

const spice = createBrowserSpiceEnvironment();
const AU_KM = 149597870.7;
const G0 = 9.80665;
const DAY_MS = 86400000;
const DAY_SECONDS = 86400;
const SUN_GM = spice.getBodyInfo("SUN").GM;
const CREW_DOSE_LIMIT_30_DAY_MSV = 250;
const CREW_DOSE_LIMIT_YEAR_MSV = 500;
const CREW_DOSE_LIMIT_CAREER_MSV = 600;
const DEEP_SPACE_GCR_MSV_PER_DAY = 1.8;
const NOMINAL_SOLAR_PARTICLE_MSV_PER_DAY_AT_1_AU = 0.08;
const PEAK_DOSE_RATE_LIMIT_MSV_PER_DAY = 25;
const MIN_CREW_SAFE_SOLAR_DISTANCE_AU = 0.7;

const planetNames = [
  "MERCURY",
  "VENUS",
  "EARTH",
  "MARS",
  "JUPITER",
  "SATURN",
  "URANUS",
  "NEPTUNE"
];

const TELEMETRY_BODY_NAMES = ["SUN", ...planetNames];

const PLANET_INTELLIGENCE = {
  MERCURY: {
    temperature: "-180 C to 430 C",
    elements: "Rocky crust rich in silicates, iron-heavy core, trace sodium and potassium in the exosphere"
  },
  VENUS: {
    temperature: "About 465 C at the surface",
    elements: "Dense carbon dioxide atmosphere with nitrogen, sulfuric acid clouds, basaltic rocky terrain"
  },
  EARTH: {
    temperature: "-89 C to 58 C on the surface",
    elements: "Nitrogen-oxygen atmosphere, liquid water oceans, silicate crust and iron-nickel core"
  },
  MARS: {
    temperature: "-125 C to 20 C",
    elements: "Carbon dioxide atmosphere, iron-oxide dust, basaltic rock, buried water ice"
  },
  JUPITER: {
    temperature: "Around -145 C in the cloud tops",
    elements: "Hydrogen-helium gas giant with ammonia clouds, water vapor and probable metallic hydrogen interior"
  },
  SATURN: {
    temperature: "Around -178 C in the cloud tops",
    elements: "Hydrogen-helium atmosphere, ammonia haze, water ice ring system, possible metallic hydrogen layers"
  },
  URANUS: {
    temperature: "Around -224 C",
    elements: "Hydrogen, helium, methane atmosphere over an icy mantle of water, ammonia and methane"
  },
  NEPTUNE: {
    temperature: "Around -214 C",
    elements: "Hydrogen, helium and methane atmosphere with deep icy mantle and strong storm systems"
  }
};

const PLANET_IMAGE_PATHS = {
  MERCURY: "assets/mercury.png",
  VENUS: "assets/venus.png",
  EARTH: "assets/earth.png",
  MARS: "assets/mars.png",
  JUPITER: "assets/jupiter.png",
  SATURN: "assets/saturn.png",
  URANUS: "assets/uranus.png",
  NEPTUNE: "assets/neptune.png"
};

const UI_FONT = "\"Gunken\", Arial, sans-serif";

let usingRealTime = true;
let paused = false;
let timeScale = 1;
let baseSimTime = new Date();
let realTimestampAtBase = Date.now();
let activeRoutePlan = null;
let zoomLevel = 1;
let lastViewState = null;
let dragTarget = null;
let isPanningView = false;
let cameraOffsetX = 0;
let cameraOffsetY = 0;
let dragPointerId = null;
let panStartPointer = null;
let panStartOffset = null;
let routePlanFramePending = false;
let routePlanRequestPending = false;
let isPlanningRoute = false;
let selectedPlanetName = null;
let pointerMovedDuringDrag = false;
let lastPlanetHitTargets = [];
let planetOverviewTimer = null;

const asteroidImg = new Image();
asteroidImg.src = "assets/asteroid.png";

Object.values(PLANET_IMAGE_PATHS).forEach((path) => {
  const image = new Image();
  image.src = path;
});

const asteroidBeltInner = 180;
const asteroidBeltOuter = 205;
const asteroidCount = 140;
const asteroids = [];
const stars = [];
let canvasResizeFrame = null;
let canvasResizeObserver = null;
let canvasResizeTimeout = null;

function createAsteroids() {
  asteroids.length = 0;

  for (let i = 0; i < asteroidCount; i += 1) {
    const orbitRadius = asteroidBeltInner + Math.random() * (asteroidBeltOuter - asteroidBeltInner);
    const baseAngle = Math.random() * Math.PI * 2;
    const orbitalPeriod = 1000 + Math.random() * 2200;
    const size = 4 + Math.random() * 8;

    asteroids.push({
      orbitRadius,
      baseAngle,
      orbitalPeriod,
      size
    });
  }
}

function createStarField(width, height) {
  stars.length = 0;
  const starCount = 180;
  const spread = Math.max(width, height) * 1.8;

  for (let i = 0; i < starCount; i += 1) {
    stars.push({
      x: (Math.random() - 0.5) * spread,
      y: (Math.random() - 0.5) * spread,
      radius: Math.random() * 1.25 + 0.5,
      alpha: 0.1 + Math.random() * 0.35,
      depth: 0.08 + Math.random() * 0.2
    });
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const nextWidth = Math.round(rect.width * dpr);
  const nextHeight = Math.round(rect.height * dpr);

  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    return;
  }

  canvas.width = nextWidth;
  canvas.height = nextHeight;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  createStarField(rect.width, rect.height);
}

function scheduleCanvasResize(immediate = false) {
  if (canvasResizeFrame !== null) {
    return;
  }

  if (immediate) {
    canvasResizeFrame = requestAnimationFrame(() => {
      canvasResizeFrame = null;
      resizeCanvas();
    });
    return;
  }

  if (canvasResizeTimeout !== null) {
    clearTimeout(canvasResizeTimeout);
  }

  canvasResizeTimeout = setTimeout(() => {
    canvasResizeTimeout = null;
    canvasResizeFrame = requestAnimationFrame(() => {
      canvasResizeFrame = null;
      resizeCanvas();
    });
  }, 80);
}

function observeCanvasLayout() {
  if (typeof ResizeObserver !== "function") {
    return;
  }

  canvasResizeObserver = new ResizeObserver(() => {
    scheduleCanvasResize();
  });

  if (canvas.parentElement) {
    canvasResizeObserver.observe(canvas.parentElement);
  }
}

function getCurrentSimTime() {
  if (paused) {
    return baseSimTime;
  }

  const elapsedMs = Date.now() - realTimestampAtBase;
  return new Date(baseSimTime.getTime() + elapsedMs * timeScale);
}

function setStatus(text) {
  void text;
}

function setPlannerOpen(isOpen) {
  plannerModal.classList.toggle("hidden", !isOpen);
  plannerModal.setAttribute("aria-hidden", String(!isOpen));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function updateZoomDisplay() {
  zoomDisplay.textContent = `${zoomLevel.toFixed(2)}×`;
}

function formatDateForInput(date) {
  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatShortDate(date) {
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatFullDateTime(date) {
  return date.toLocaleString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits
  }).format(value);
}

function formatDays(value) {
  return `${formatNumber(value, 1)} days`;
}

function formatKm(value) {
  return `${formatNumber(value, 0)} km`;
}

function formatDeltaV(value) {
  return `${formatNumber(value, 2)} km/s`;
}

function formatFuel(value) {
  return `${formatNumber(value, 1)} kg`;
}

function formatAu(value) {
  return `${formatNumber(value, 3)} AU`;
}

function formatDose(value) {
  return `${formatNumber(value, 1)} mSv`;
}

function formatDoseRate(value) {
  return `${formatNumber(value, 2)} mSv/day`;
}

function formatRiskLevel(value) {
  return value;
}

function formatAcceleration(value) {
  return `${formatNumber(value, 6)} km/s^2`;
}

function formatPositionAu(position) {
  return `X ${formatNumber(position.x / AU_KM, 3)} AU, Y ${formatNumber(position.y / AU_KM, 3)} AU, Z ${formatNumber(position.z / AU_KM, 3)} AU`;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function getPolarAngle(position) {
  return Math.atan2(position.y, position.x);
}

function unwrapAngleDelta(startAngle, endAngle) {
  let delta = endAngle - startAngle;

  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;

  return delta;
}

function getTransferArcSample(startPosition, endPosition, t) {
  const startRadius = Math.max(0.05 * AU_KM, startPosition.norm());
  const endRadius = Math.max(0.05 * AU_KM, endPosition.norm());
  const startAngle = getPolarAngle(startPosition);
  const angleDelta = unwrapAngleDelta(startAngle, getPolarAngle(endPosition));
  const angle = startAngle + angleDelta * t;
  const interpolatedRadius = 1 / (lerp(1 / startRadius, 1 / endRadius, t));
  const z = lerp(startPosition.z, endPosition.z, t);

  return new BrowserVec3(
    Math.cos(angle) * interpolatedRadius,
    Math.sin(angle) * interpolatedRadius,
    z
  );
}

function buildTransferArcSamples(startPosition, endPosition, sampleCount = 72) {
  const samples = [];

  for (let i = 0; i <= sampleCount; i += 1) {
    samples.push(getTransferArcSample(startPosition, endPosition, i / sampleCount));
  }

  return samples;
}

function formatTimerOffset(targetDate, referenceDate, whenPastLabel) {
  const diffMs = targetDate.getTime() - referenceDate.getTime();
  const diffDays = Math.abs(diffMs) / DAY_MS;

  if (Math.abs(diffMs) < 60000) {
    return "Right now";
  }

  if (diffMs > 0) {
    return `In ${formatNumber(diffDays, 1)} days`;
  }

  return whenPastLabel || `${formatNumber(diffDays, 1)} days ago`;
}

function updateRouteTimeline(plan, simDate = getCurrentSimTime()) {
  if (!departureTimerValue || !departureTimerMeta || !arrivalTimerValue || !arrivalTimerMeta) {
    return;
  }

  if (!plan) {
    departureTimerValue.textContent = "Waiting for route";
    departureTimerMeta.textContent = "Generate a route to see the best departure window.";
    arrivalTimerValue.textContent = "Waiting for route";
    arrivalTimerMeta.textContent = "Arrival timing will appear after the planner finishes.";
    return;
  }

  departureTimerValue.textContent = formatFullDateTime(plan.departureDate);
  departureTimerMeta.textContent =
    `${formatTimerOffset(plan.departureDate, simDate, "Departure window has passed")} relative to the current simulation time.`;

  arrivalTimerValue.textContent = formatFullDateTime(plan.arrivalDate);
  arrivalTimerMeta.textContent =
    `${formatTimerOffset(plan.arrivalDate, simDate, "Arrival time has passed")} from the current simulation time, after ${formatDays(plan.travelDays)} in transit.`;
}

function getCurrentMissionState(simDate = getCurrentSimTime()) {
  return resolveDescriptorState(getCurrentOriginDescriptor(), simDate);
}

function getBodyStateForTelemetry(name, simDate) {
  if (name === "SUN") {
    return {
      position: new BrowserVec3(0, 0, 0),
      velocity: new BrowserVec3(0, 0, 0)
    };
  }

  return getBodyState(name, simDate);
}

function getBodyRadiusKm(name) {
  const info = spice.getBodyInfo(name);
  if (!info) {
    return null;
  }

  if (Number.isFinite(info.radiusKm)) {
    return info.radiusKm;
  }

  if (Array.isArray(info.radiiKm) && info.radiiKm.length > 0) {
    return info.radiiKm.reduce((sum, value) => sum + value, 0) / info.radiiKm.length;
  }

  return null;
}

function getClosestBodyTelemetry(state, simDate) {
  let best = null;

  TELEMETRY_BODY_NAMES.forEach((name) => {
    const bodyState = getBodyStateForTelemetry(name, simDate);
    const distanceKm = state.position.sub(bodyState.position).norm();
    const radiusKm = getBodyRadiusKm(name) || 0;
    const altitudeKm = distanceKm - radiusKm;
    const relativeSpeedKmS = state.velocity.sub(bodyState.velocity).norm();

    if (!best || distanceKm < best.distanceKm) {
      best = {
        name,
        distanceKm,
        altitudeKm,
        relativeSpeedKmS
      };
    }
  });

  return best;
}

function getDominantGravityTelemetry(state, simDate) {
  let best = null;

  TELEMETRY_BODY_NAMES.forEach((name) => {
    const bodyState = getBodyStateForTelemetry(name, simDate);
    const radiusKm = Math.max(1, state.position.sub(bodyState.position).norm());
    const accelerationKmS2 = spice.getBodyInfo(name).GM / (radiusKm * radiusKm);

    if (!best || accelerationKmS2 > best.accelerationKmS2) {
      best = {
        name,
        accelerationKmS2
      };
    }
  });

  return best;
}

function getMissionSafetyMessage(plan, closestBody) {
  if (closestBody && closestBody.altitudeKm <= 0) {
    return {
      status: "Collision risk critical",
      alert: `The current ship state intersects ${getPlanetDisplayName(closestBody.name)}. Move the origin away from the body immediately.`
    };
  }

  if (closestBody && closestBody.altitudeKm < 50000) {
    return {
      status: "Close approach caution",
      alert: `${getPlanetDisplayName(closestBody.name)} is within ${formatKm(closestBody.altitudeKm)} altitude. Watch approach speed and clearance.`
    };
  }

  if (plan && !plan.crewSafe) {
    return {
      status: "Crew safety review required",
      alert: `The current best route is ${plan.crewRadiationRisk.toLowerCase()} with hazards: ${plan.hazardHits.join(", ") || "none listed"}.`
    };
  }

  if (plan && plan.crewRadiationRisk === "Elevated") {
    return {
      status: "Crew safety elevated",
      alert: `Crew radiation is elevated at ${formatDose(plan.radiationDoseMsv)}. Safety-first planning is keeping the route inside crew limits where possible.`
    };
  }

  return {
    status: "Crew-safe profile",
    alert: "Current mission state is within nominal operating margins for crew safety and navigation."
  };
}

function updateMissionTelemetry(simDate = getCurrentSimTime()) {
  if (
    !missionStatusValue ||
    !telemetryClosestBody ||
    !telemetryAltitude ||
    !telemetryRelativeSpeed ||
    !telemetryDominantGravity ||
    !telemetrySolarDistance ||
    !telemetryShipSpeed ||
    !missionAlertText
  ) {
    return;
  }

  try {
    const missionState = getCurrentMissionState(simDate);
    const closestBody = getClosestBodyTelemetry(missionState, simDate);
    const dominantGravity = getDominantGravityTelemetry(missionState, simDate);
    const solarDistanceAu = missionState.position.norm() / AU_KM;
    const safety = getMissionSafetyMessage(activeRoutePlan, closestBody);

    telemetryClosestBody.textContent = closestBody ? getPlanetDisplayName(closestBody.name) : "Unavailable";
    telemetryAltitude.textContent = closestBody ? formatKm(Math.max(closestBody.altitudeKm, 0)) : "Unavailable";
    telemetryRelativeSpeed.textContent = closestBody ? formatDeltaV(closestBody.relativeSpeedKmS) : "Unavailable";
    telemetryDominantGravity.textContent = dominantGravity
      ? `${getPlanetDisplayName(dominantGravity.name)} (${formatAcceleration(dominantGravity.accelerationKmS2)})`
      : "Unavailable";
    telemetrySolarDistance.textContent = formatAu(solarDistanceAu);
    telemetryShipSpeed.textContent = formatDeltaV(missionState.velocity.norm());
    missionStatusValue.textContent = safety.status;
    missionAlertText.textContent = safety.alert;
  } catch (error) {
    telemetryClosestBody.textContent = "Awaiting valid coordinates";
    telemetryAltitude.textContent = "Awaiting valid coordinates";
    telemetryRelativeSpeed.textContent = "Awaiting valid coordinates";
    telemetryDominantGravity.textContent = "Awaiting valid coordinates";
    telemetrySolarDistance.textContent = "Awaiting valid coordinates";
    telemetryShipSpeed.textContent = "Awaiting valid coordinates";
    missionStatusValue.textContent = "Telemetry standing by";
    missionAlertText.textContent = error.message;
  }
}

function canvasToScreen(position, viewState) {
  return {
    x: viewState.centerX + position.x * viewState.scale,
    y: viewState.centerY + position.y * viewState.scale
  };
}

function screenToWorld(x, y, viewState) {
  return new BrowserVec3(
    (x - viewState.centerX) / viewState.scale,
    (y - viewState.centerY) / viewState.scale,
    0
  );
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function pointHitsMarker(pointer, marker, label) {
  const markerRadius = 24;
  const labelWidth = Math.max(42, label.length * 7 + 10);
  const labelRect = {
    left: marker.x + 8,
    top: marker.y - 8,
    right: marker.x + 8 + labelWidth,
    bottom: marker.y + 22
  };
  const withinMarker = Math.hypot(pointer.x - marker.x, pointer.y - marker.y) <= markerRadius;
  const withinLabel =
    pointer.x >= labelRect.left &&
    pointer.x <= labelRect.right &&
    pointer.y >= labelRect.top &&
    pointer.y <= labelRect.bottom;

  if (!withinMarker && !withinLabel) {
    return Number.POSITIVE_INFINITY;
  }

  const labelCenterX = (labelRect.left + labelRect.right) / 2;
  const labelCenterY = (labelRect.top + labelRect.bottom) / 2;
  return Math.min(
    Math.hypot(pointer.x - marker.x, pointer.y - marker.y),
    Math.hypot(pointer.x - labelCenterX, pointer.y - labelCenterY)
  );
}

function getBaseScale(simDate) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const neptuneState = getBodyState("NEPTUNE", simDate).position.norm();
  const maxVisualRadius = Math.min(width, height) * 0.36;
  return maxVisualRadius / neptuneState;
}

function getViewState(simDate) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const centerX = width / 2 + cameraOffsetX;
  const centerY = height / 2 + cameraOffsetY;
  const scale = getBaseScale(simDate) * zoomLevel;
  return { centerX, centerY, scale, width, height };
}

function setZoomAtPoint(nextZoomLevel, pointer) {
  const simDate = getCurrentSimTime();
  const currentView = getViewState(simDate);
  const clampedZoom = clamp(nextZoomLevel, 0.35, 25);

  if (!pointer) {
    zoomLevel = clampedZoom;
    updateZoomDisplay();
    return;
  }

  const worldPoint = screenToWorld(pointer.x, pointer.y, currentView);
  const nextScale = getBaseScale(simDate) * clampedZoom;
  const baseCenterX = currentView.width / 2;
  const baseCenterY = currentView.height / 2;

  cameraOffsetX = pointer.x - baseCenterX - worldPoint.x * nextScale;
  cameraOffsetY = pointer.y - baseCenterY - worldPoint.y * nextScale;
  zoomLevel = clampedZoom;
  updateZoomDisplay();
}

function drawBackgroundStars(viewState) {
  const zoomParallax = 0.9 + Math.log2(Math.max(zoomLevel, 0.35) + 1) * 0.22;

  stars.forEach((star) => {
    const x = viewState.width / 2 + (cameraOffsetX + star.x) * star.depth * zoomParallax;
    const y = viewState.height / 2 + (cameraOffsetY + star.y) * star.depth * zoomParallax;
    const radius = star.radius * (0.9 + zoomParallax * 0.35);

    if (
      x < -8 || x > viewState.width + 8 ||
      y < -8 || y > viewState.height + 8
    ) {
      return;
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawAsteroidBelt(simDate, viewState) {
  const et = spice.time.dateToEt(simDate);
  const days = et / DAY_SECONDS;
  const beltRadius = ((asteroidBeltInner + asteroidBeltOuter) / 2) * zoomLevel;
  const beltThickness = Math.max(8, 20 * zoomLevel);

  ctx.beginPath();
  ctx.strokeStyle = "rgba(200, 180, 150, 0.08)";
  ctx.lineWidth = beltThickness;
  ctx.arc(viewState.centerX, viewState.centerY, beltRadius, 0, Math.PI * 2);
  ctx.stroke();

  asteroids.forEach((asteroid) => {
    const angle = asteroid.baseAngle + (days / asteroid.orbitalPeriod) * Math.PI * 2;
    const orbitRadius = asteroid.orbitRadius * zoomLevel;
    const x = viewState.centerX + Math.cos(angle) * orbitRadius;
    const y = viewState.centerY + Math.sin(angle) * orbitRadius;
    const size = Math.max(2, asteroid.size * Math.sqrt(zoomLevel));

    if (asteroidImg.complete && asteroidImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(
        asteroidImg,
        -size / 2,
        -size / 2,
        size,
        size
      );
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.fillStyle = "#9a8f80";
      ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function getBodyState(name, simDate) {
  const et = spice.time.dateToEt(simDate);
  return spice.getBodyHeliocentricState(name, et).state;
}

function getPlanetRadius(name) {
  const baseRadius = (() => {
    switch (name) {
      case "VENUS":
      case "EARTH":
        return 6;
      case "MARS":
        return 5;
      case "JUPITER":
        return 11;
      case "SATURN":
        return 10;
      case "URANUS":
      case "NEPTUNE":
        return 8;
      default:
        return 4;
    }
  })();

  const zoomBoost = 0.14 + Math.pow(Math.max(zoomLevel, 0.5), 0.8) * 0.54;
  return clamp(baseRadius * zoomBoost, baseRadius * 0.52, baseRadius * 8);
}

function getSunDisplayRadius(simDate, scale) {
  const baseRadius = 13;
  const zoomBoost = 0.18 + Math.pow(Math.max(zoomLevel, 0.5), 0.84) * 0.62;
  const mercuryOrbitPx = spice.getBodyInfo("MERCURY").a * AU_KM * scale;
  const desiredRadius = baseRadius * zoomBoost;
  const maxRadius = Math.max(baseRadius * 0.75, mercuryOrbitPx * 0.22);

  return clamp(desiredRadius, baseRadius * 0.7, maxRadius);
}

function getPlanetDisplayName(name) {
  return name.charAt(0) + name.slice(1).toLowerCase();
}

function getPlanetOverviewData(name, simDate = getCurrentSimTime()) {
  const info = spice.getBodyInfo(name);
  const state = getBodyState(name, simDate);
  const earthState = getBodyState("EARTH", simDate);
  const distanceFromEarthAu = state.position.sub(earthState.position).norm() / AU_KM;
  const intel = PLANET_INTELLIGENCE[name];

  return {
    info,
    imagePath: PLANET_IMAGE_PATHS[name],
    displayName: getPlanetDisplayName(name),
    distanceFromEarthAu,
    sizeText: `${formatKm(info.radiusKm)} radius`,
    temperatureText: intel?.temperature || "No thermal profile available",
    elementsText: intel?.elements || "No composition data available"
  };
}

function clearPlanetOverviewTimer() {
  if (planetOverviewTimer) {
    clearTimeout(planetOverviewTimer);
    planetOverviewTimer = null;
  }
}

function resetViewportScroll() {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function resetPlanetOverviewScroll() {
  if (planetOverviewPanel) {
    planetOverviewPanel.scrollTop = 0;
  }
}

function hidePlanetInfo() {
  clearPlanetOverviewTimer();
  planetInfo?.classList.remove("is-open");
  planetInfo?.setAttribute("aria-hidden", "true");
  resetPlanetOverviewScroll();

  planetOverviewTimer = setTimeout(() => {
    planetInfo?.classList.add("hidden");
    planetOverviewTimer = null;
  }, 220);

  selectedPlanetName = null;
}

function populatePlanetOverview(name, simDate = getCurrentSimTime()) {
  const data = getPlanetOverviewData(name, simDate);

  selectedPlanetName = name;
  if (planetName) {
    planetName.textContent = data.displayName;
  }
  if (planetDistance) {
    planetDistance.textContent = name === "EARTH" ? "0 AU" : formatAu(data.distanceFromEarthAu);
  }
  if (planetSize) {
    planetSize.textContent = data.sizeText;
  }
  if (planetTemp) {
    planetTemp.textContent = data.temperatureText;
  }
  if (planetElements) {
    planetElements.textContent = data.elementsText;
  }
  if (planetOverviewImage) {
    planetOverviewImage.src = data.imagePath;
    planetOverviewImage.alt = `${data.displayName} planet render`;
    planetOverviewImage.classList.toggle("is-saturn", name === "SATURN");
  }
}

function showPlanetInfo(name) {
  clearPlanetOverviewTimer();
  populatePlanetOverview(name);
  planetInfo?.classList.remove("hidden");
  planetInfo?.setAttribute("aria-hidden", "false");
  resetViewportScroll();
  resetPlanetOverviewScroll();

  requestAnimationFrame(() => {
    resetPlanetOverviewScroll();
    planetInfo?.classList.add("is-open");
  });
}

function getMarkerLabel(type) {
  return type === "origin" ? "Ship" : "Destination";
}

function drawDraggableMarker(position, viewState, options) {
  const screenPoint = canvasToScreen(position, viewState);

  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = options.isDragging ? options.activeColor : options.color;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2;
  ctx.arc(screenPoint.x, screenPoint.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = options.ringColor;
  ctx.arc(screenPoint.x, screenPoint.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = options.textColor;
  const textX = screenPoint.x + 12;
  const textY = screenPoint.y + 10;
  const lines = [options.label, ...(options.detailLines || [])];

  lines.forEach((line, index) => {
    ctx.font = index === 0 ? `700 12px ${UI_FONT}` : `11px ${UI_FONT}`;
    ctx.fillText(line, textX, textY + index * 14);
  });

  return screenPoint;
}

function drawOriginMarker(simDate, viewState) {
  const originDescriptor = getCurrentOriginDescriptor();
  const originState = resolveDescriptorState(originDescriptor, simDate);

  return drawDraggableMarker(originState.position, viewState, {
    label: getMarkerLabel("origin"),
    detailLines: [
      `From: ${originDescriptor.label}`,
      `${formatNumber(originState.position.x / AU_KM, 2)}, ${formatNumber(originState.position.y / AU_KM, 2)} AU`
    ],
    color: "#80ffce",
    activeColor: "#8ec5ff",
    ringColor: "rgba(128, 255, 206, 0.55)",
    textColor: "#d8fff1",
    isDragging: dragTarget === "origin"
  });
}

function drawDestinationMarker(simDate, viewState) {
  const destinationDescriptor = getCurrentDestinationDescriptor();
  const destinationState = resolveDescriptorState(destinationDescriptor, simDate);

  return drawDraggableMarker(destinationState.position, viewState, {
    label: getMarkerLabel("destination"),
    detailLines: [
      `To: ${destinationDescriptor.label}`,
      `${formatNumber(destinationState.position.x / AU_KM, 2)}, ${formatNumber(destinationState.position.y / AU_KM, 2)} AU`
    ],
    color: "#ffd166",
    activeColor: "#ffc98d",
    ringColor: "rgba(255, 209, 102, 0.55)",
    textColor: "#fff0c2",
    isDragging: dragTarget === "destination"
  });
}

function drawPlannedTransferMarkers(viewState) {
  if (!activeRoutePlan?.departureState || !activeRoutePlan?.arrivalState) {
    return;
  }

  drawDraggableMarker(activeRoutePlan.departureState.position, viewState, {
    label: "Best Depart",
    detailLines: [
      formatShortDate(activeRoutePlan.departureDate),
      `From ${activeRoutePlan.originDescriptor.label}`
    ],
    color: "#8ef7ff",
    activeColor: "#8ef7ff",
    ringColor: "rgba(142, 247, 255, 0.48)",
    textColor: "#d9fbff",
    isDragging: false
  });

  drawDraggableMarker(activeRoutePlan.arrivalState.position, viewState, {
    label: "Arrival",
    detailLines: [
      formatShortDate(activeRoutePlan.arrivalDate),
      `At ${activeRoutePlan.destinationDescriptor.label}`
    ],
    color: "#ffb570",
    activeColor: "#ffb570",
    ringColor: "rgba(255, 181, 112, 0.48)",
    textColor: "#ffe6cb",
    isDragging: false
  });
}

function drawRouteOverlay(simDate, centerX, centerY, scale) {
  if (!activeRoutePlan) {
    return;
  }

  const pathSamples = buildTransferArcSamples(
    activeRoutePlan.departureState.position,
    activeRoutePlan.arrivalState.position,
    64
  );

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = activeRoutePlan.feasible ? "rgba(120, 255, 206, 0.95)" : "rgba(255, 176, 120, 0.95)";
  ctx.lineWidth = 2.5;
  pathSamples.forEach((sample, index) => {
    const x = centerX + sample.x * scale;
    const y = centerY + sample.y * scale;

    if (index === 0) {
      ctx.moveTo(x, y);
      return;
    }

    ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function getPlanetDrawData(name, simDate, scale) {
  const state = getBodyState(name, simDate);
  const info = spice.getBodyInfo(name);

  return {
    name,
    info,
    position: state.position,
    velocity: state.velocity,
    x: state.position.x * scale,
    y: state.position.y * scale
  };
}

function impulseFuelRequiredKg(deltaVKmS, dryMassKg, fuelMassKg, ispSeconds) {
  if (!(deltaVKmS > 0) || !(ispSeconds > 0)) {
    return 0;
  }

  void fuelMassKg;

  const massRatio = Math.exp((deltaVKmS * 1000) / (ispSeconds * G0));
  return Math.max(0, dryMassKg * (massRatio - 1));
}

function buildDescriptor(mode, bodySelect, xInput, yInput, zInput, fallbackLabel) {
  if (mode === "body") {
    return {
      mode: "body",
      bodyName: bodySelect.value,
      label: bodySelect.options[bodySelect.selectedIndex].text
    };
  }

  const xAu = Number(xInput.value);
  const yAu = Number(yInput.value);
  const zAu = Number(zInput.value);

  if (![xAu, yAu, zAu].every(Number.isFinite)) {
    throw new Error(`Please enter valid ${fallbackLabel.toLowerCase()} coordinates.`);
  }

  return {
    mode: "custom",
    label: fallbackLabel,
    basePosition: new BrowserVec3(xAu * AU_KM, yAu * AU_KM, zAu * AU_KM),
    baseVelocity: new BrowserVec3(0, 0, 0),
    anchorTimeMs: getCurrentSimTime().getTime()
  };
}

function resolveDescriptorState(descriptor, date) {
  if (descriptor.mode === "body") {
    return getBodyState(descriptor.bodyName, date);
  }

  const dtSeconds = (date.getTime() - descriptor.anchorTimeMs) / 1000;
  return {
    position: descriptor.basePosition.add(descriptor.baseVelocity.scale(dtSeconds)),
    velocity: descriptor.baseVelocity
  };
}

function estimateHazardAlongRoute(startPosition, endPosition) {
  const samples = buildTransferArcSamples(startPosition, endPosition, 24);
  let score = 0;
  const hits = new Set();

  for (const sample of samples) {
    const radiusAu = sample.norm() / AU_KM;

    if (radiusAu >= 2.05 && radiusAu <= 3.35) {
      score += 1.2;
      hits.add("Main asteroid belt");
    }
    if (radiusAu >= 5 && radiusAu <= 5.35) {
      score += 0.9;
      hits.add("Jupiter Trojan corridor");
    }
    if (radiusAu < 0.45) {
      score += 0.6;
      hits.add("Inner-solar thermal zone");
    }
  }

  return {
    score,
    hits: [...hits]
  };
}

function estimateRadiationAlongRoute(startPosition, endPosition, travelDays) {
  const samples = buildTransferArcSamples(startPosition, endPosition, 72);
  let totalDoseRateMsvPerDay = 0;
  let peakDoseRateMsvPerDay = 0;
  let closestRadiusAu = Number.POSITIVE_INFINITY;
  const missionDoseLimitMsv = getCrewMissionDoseLimitMsv(travelDays);

  for (const sample of samples) {
    const radiusAu = Math.max(0.05, sample.norm() / AU_KM);
    closestRadiusAu = Math.min(closestRadiusAu, radiusAu);

    const doseRateMsvPerDay = estimateCrewDoseRateMsvPerDay(radiusAu);
    totalDoseRateMsvPerDay += doseRateMsvPerDay;
    peakDoseRateMsvPerDay = Math.max(peakDoseRateMsvPerDay, doseRateMsvPerDay);
  }

  const averageDoseRateMsvPerDay = totalDoseRateMsvPerDay / samples.length;
  const totalDoseMsv = averageDoseRateMsvPerDay * Math.max(0.1, travelDays);
  const doseLimitRatio = totalDoseMsv / missionDoseLimitMsv;
  const peakLimitRatio = peakDoseRateMsvPerDay / PEAK_DOSE_RATE_LIMIT_MSV_PER_DAY;
  const crewRiskLevel = getCrewRadiationRiskLevel(doseLimitRatio, peakLimitRatio, closestRadiusAu);
  const violatesSolarKeepout = closestRadiusAu < MIN_CREW_SAFE_SOLAR_DISTANCE_AU;
  const score = totalDoseMsv +
    Math.max(0, doseLimitRatio - 1) * missionDoseLimitMsv * 4 +
    Math.max(0, peakLimitRatio - 1) * PEAK_DOSE_RATE_LIMIT_MSV_PER_DAY * 30 +
    (violatesSolarKeepout ? 100000 : 0);

  return {
    score,
    totalDoseMsv,
    averageDoseRateMsvPerDay,
    peakDoseRateMsvPerDay,
    missionDoseLimitMsv,
    doseLimitRatio,
    peakLimitRatio,
    crewRiskLevel,
    violatesSolarKeepout,
    closestRadiusAu
  };
}

function getCrewMissionDoseLimitMsv(travelDays) {
  if (travelDays <= 30) {
    return CREW_DOSE_LIMIT_30_DAY_MSV;
  }

  const annualizedLimit = CREW_DOSE_LIMIT_YEAR_MSV * (travelDays / 365);
  return clamp(annualizedLimit, CREW_DOSE_LIMIT_30_DAY_MSV, CREW_DOSE_LIMIT_CAREER_MSV);
}

function estimateCrewDoseRateMsvPerDay(radiusAu) {
  const solarParticleDose = NOMINAL_SOLAR_PARTICLE_MSV_PER_DAY_AT_1_AU / (radiusAu * radiusAu);
  const solarEventRiskDose = radiusAu < 0.9
    ? 2.5 * Math.pow(0.9 / radiusAu, 4)
    : 0;
  const innerSolarHazardDose = radiusAu < 0.35
    ? 18 * Math.pow(0.35 / radiusAu, 6)
    : 0;
  const jupiterTrappedRadiationDose = radiusAu >= 4.8 && radiusAu <= 5.6 ? 3.5 : 0;

  return DEEP_SPACE_GCR_MSV_PER_DAY +
    solarParticleDose +
    solarEventRiskDose +
    innerSolarHazardDose +
    jupiterTrappedRadiationDose;
}

function getCrewRadiationRiskLevel(doseLimitRatio, peakLimitRatio, closestRadiusAu) {
  if (closestRadiusAu < MIN_CREW_SAFE_SOLAR_DISTANCE_AU) {
    return "Solar keep-out violation";
  }
  if (closestRadiusAu < 0.25 || doseLimitRatio >= 1.5 || peakLimitRatio >= 2) {
    return "Critical";
  }
  if (closestRadiusAu < 0.4 || doseLimitRatio >= 1 || peakLimitRatio >= 1) {
    return "Exceeds crew standard";
  }
  if (doseLimitRatio >= 0.75 || peakLimitRatio >= 0.7) {
    return "Elevated";
  }
  return "Within crew standard";
}

function normalizeAngleRad(angle) {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized <= -Math.PI) normalized += twoPi;
  if (normalized > Math.PI) normalized -= twoPi;
  return normalized;
}

function getPlanCandidateRanking(candidate) {
  return [
    candidate.phaseErrorRad ?? Number.POSITIVE_INFINITY,
    candidate.delayDays + candidate.travelDays,
    candidate.totalDeltaV,
    candidate.hazardScore
  ];
}

function comparePlanCandidates(a, b) {
  const rankA = getPlanCandidateRanking(a);
  const rankB = getPlanCandidateRanking(b);

  for (let i = 0; i < rankA.length; i += 1) {
    if (rankA[i] !== rankB[i]) {
      return rankA[i] - rankB[i];
    }
  }

  return 0;
}

function getOptimizationPreferences() {
  return {
    safety: true,
    time: Boolean(preferTimeInput?.checked),
    fuel: Boolean(preferFuelInput?.checked),
    radiation: true
  };
}

function ensureAtLeastOnePreference(preferences) {
  if (preferences.safety || preferences.time || preferences.fuel || preferences.radiation) {
    return preferences;
  }

  return {
    safety: true,
    time: true,
    fuel: true,
    radiation: true
  };
}

function getRouteScore(candidate, metrics, preferences) {
  if (candidate.violatesSolarKeepout) {
    return Number.POSITIVE_INFINITY;
  }

  let score = candidate.phaseErrorRad ?? 0;

  if (preferences.time) {
    score += candidate.travelDays / Math.max(metrics.maxTravelDays, 1);
  }
  if (preferences.fuel) {
    score += candidate.fuelRequiredKg / Math.max(metrics.maxFuelRequiredKg, 1);
  }
  if (preferences.radiation) {
    score += candidate.radiationScore / Math.max(metrics.maxRadiationScore, 1);
    score += Math.max(0, (candidate.radiationDoseLimitRatio ?? 0) - 0.75) * 3;
    score += Math.max(0, (candidate.radiationPeakLimitRatio ?? 0) - 0.7) * 2;
    if ((candidate.closestSunRadiusAu ?? 1) < MIN_CREW_SAFE_SOLAR_DISTANCE_AU) {
      score += 6;
    }
  }

  if (preferences.safety) {
    score += candidate.hazardScore * 0.55;
    score += Math.max(0, candidate.arrivalSpeedKmS - 12) * 0.3;
    score += Math.max(0, 0.85 - (candidate.closestSunRadiusAu ?? 1)) * 18;
    score += Math.max(0, (candidate.radiationDoseLimitRatio ?? 0) - 0.55) * 8;
    score += Math.max(0, (candidate.radiationPeakLimitRatio ?? 0) - 0.55) * 6;

    if (!candidate.crewSafe) {
      score += 40;
    }
  }

  return score;
}

function summarizePreferenceText(preferences) {
  const active = [];
  if (preferences.safety) active.push("crew safety");
  if (preferences.time) active.push("shortest travel time");
  if (preferences.fuel) active.push("fuel");
  if (preferences.radiation) active.push("radiation");
  return active.join(", ");
}

function estimateBodyTransferCandidate(originDescriptor, destinationDescriptor, departureDate, ship) {
  const destinationInfo = spice.getBodyInfo(destinationDescriptor.bodyName);
  const destinationMeanMotion = (Math.PI * 2) / (destinationInfo.orbitalPeriodDays * DAY_SECONDS);
  const departureState = resolveDescriptorState(originDescriptor, departureDate);

  let arrivalDate = new Date(departureDate.getTime() + 240 * DAY_MS);
  let arrivalState = resolveDescriptorState(destinationDescriptor, arrivalDate);
  let transferSeconds = 0;

  for (let i = 0; i < 3; i += 1) {
    const r1 = departureState.position.norm();
    const r2 = arrivalState.position.norm();
    const transferSemiMajorAxis = (r1 + r2) / 2;
    transferSeconds = Math.PI * Math.sqrt(
      (transferSemiMajorAxis * transferSemiMajorAxis * transferSemiMajorAxis) / SUN_GM
    );
    arrivalDate = new Date(departureDate.getTime() + transferSeconds * 1000);
    arrivalState = resolveDescriptorState(destinationDescriptor, arrivalDate);
  }

  const r1 = departureState.position.norm();
  const r2 = arrivalState.position.norm();
  const transferSemiMajorAxis = (r1 + r2) / 2;
  const departureTransferSpeed = Math.sqrt(SUN_GM * ((2 / r1) - (1 / transferSemiMajorAxis)));
  const arrivalTransferSpeed = Math.sqrt(SUN_GM * ((2 / r2) - (1 / transferSemiMajorAxis)));
  const departureTransferVelocity = departureState.velocity.unit().scale(departureTransferSpeed);
  const arrivalTransferVelocity = arrivalState.velocity.unit().scale(arrivalTransferSpeed);
  const departureBurn = departureTransferVelocity.sub(departureState.velocity);
  const arrivalBurn = arrivalState.velocity.sub(arrivalTransferVelocity);
  const departureDeltaV = departureBurn.norm();
  const arrivalDeltaV = arrivalBurn.norm();
  const totalDeltaV = departureDeltaV + arrivalDeltaV;
  const fuelRequiredKg = impulseFuelRequiredKg(
    totalDeltaV,
    ship.dryMassKg,
    ship.fuelMassKg,
    ship.ispSeconds
  );
  const departureAngle = Math.atan2(departureState.position.y, departureState.position.x);
  const destinationAngle = Math.atan2(arrivalState.position.y, arrivalState.position.x);
  const actualPhaseAtDeparture = normalizeAngleRad(
    destinationAngle - departureAngle - destinationMeanMotion * transferSeconds
  );
  const requiredPhaseAtDeparture = normalizeAngleRad(Math.PI - destinationMeanMotion * transferSeconds);
  const phaseErrorRad = Math.abs(
    normalizeAngleRad(actualPhaseAtDeparture - requiredPhaseAtDeparture)
  );
  const interceptErrorKm = phaseErrorRad * r2;
  const hazard = estimateHazardAlongRoute(
    departureState.position,
    arrivalState.position
  );
  const radiation = estimateRadiationAlongRoute(
    departureState.position,
    arrivalState.position,
    transferSeconds / DAY_SECONDS
  );

  return {
    delayDays: 0,
    travelDays: transferSeconds / DAY_SECONDS,
    departureDate,
    arrivalDate,
    departureState,
    arrivalState,
    transitVelocity: departureTransferVelocity,
    departureDeltaV,
    arrivalDeltaV,
    totalDeltaV,
    fuelRequiredKg,
    feasible: fuelRequiredKg <= ship.fuelMassKg,
    fuelMarginKg: ship.fuelMassKg - fuelRequiredKg,
    arrivalSpeedKmS: arrivalBurn.norm(),
    departureDistanceKm: departureState.position.sub(arrivalState.position).norm(),
    arrivalPositionErrorKm: interceptErrorKm,
    phaseErrorRad,
    radiationScore: radiation.score,
    radiationDoseMsv: radiation.totalDoseMsv,
    averageRadiationDoseRateMsvPerDay: radiation.averageDoseRateMsvPerDay,
    peakRadiation: radiation.peakDoseRateMsvPerDay,
    missionDoseLimitMsv: radiation.missionDoseLimitMsv,
    radiationDoseLimitRatio: radiation.doseLimitRatio,
    radiationPeakLimitRatio: radiation.peakLimitRatio,
    crewRadiationRisk: radiation.crewRiskLevel,
    violatesSolarKeepout: radiation.violatesSolarKeepout,
    crewSafe: !radiation.violatesSolarKeepout && radiation.doseLimitRatio <= 1 && radiation.peakLimitRatio <= 1,
    closestSunRadiusAu: radiation.closestRadiusAu,
    hazardScore: hazard.score,
    hazardHits: hazard.hits
  };
}

function gravitationalAcceleration(position) {
  const radius = Math.max(position.norm(), 1);
  return position.scale(-SUN_GM / (radius * radius * radius));
}

function propagateBallisticState(initialState, durationSeconds, steps) {
  if (!(durationSeconds > 0)) {
    return initialState;
  }

  const dt = durationSeconds / steps;
  let position = initialState.position;
  let velocity = initialState.velocity;

  for (let i = 0; i < steps; i += 1) {
    const accel = gravitationalAcceleration(position);
    const nextPosition = position
      .add(velocity.scale(dt))
      .add(accel.scale(0.5 * dt * dt));
    const nextAccel = gravitationalAcceleration(nextPosition);
    const nextVelocity = velocity.add(accel.add(nextAccel).scale(0.5 * dt));

    position = nextPosition;
    velocity = nextVelocity;
  }

  return {
    position,
    velocity
  };
}

function solveBallisticTransfer(departureState, arrivalState, transferSeconds) {
  const stepCount = clamp(Math.round(transferSeconds / (DAY_SECONDS * 5)), 36, 180);
  let velocityGuess = arrivalState.position.sub(departureState.position).scale(1 / transferSeconds);
  let propagatedState = null;
  let positionError = null;

  for (let i = 0; i < 5; i += 1) {
    propagatedState = propagateBallisticState(
      {
        position: departureState.position,
        velocity: velocityGuess
      },
      transferSeconds,
      stepCount
    );
    positionError = arrivalState.position.sub(propagatedState.position);
    if (positionError.norm() < 250000) {
      break;
    }

    velocityGuess = velocityGuess.add(positionError.scale(0.92 / transferSeconds));
  }

  return {
    departureVelocity: velocityGuess,
    arrivalVelocity: propagatedState.velocity,
    arrivalPositionErrorKm: positionError.norm()
  };
}

function estimateRouteBallistic(originDescriptor, destinationDescriptor, simDate, ship) {
  const sameBody =
    originDescriptor.mode === "body" &&
    destinationDescriptor.mode === "body" &&
    originDescriptor.bodyName === destinationDescriptor.bodyName;

  if (sameBody) {
    throw new Error("Origin and destination cannot be the same body.");
  }

  const departureDelayDays = [0, 3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 240, 320, 420, 540];
  const transferDays = [];
  for (let day = 30; day <= 900; day += 15) {
    transferDays.push(day);
  }

  const candidates = [];

  for (const delayDays of departureDelayDays) {
    const departureDate = new Date(simDate.getTime() + delayDays * DAY_MS);
    const departureState = resolveDescriptorState(originDescriptor, departureDate);

    for (const travelDays of transferDays) {
      const arrivalDate = new Date(departureDate.getTime() + travelDays * DAY_MS);
      const arrivalState = resolveDescriptorState(destinationDescriptor, arrivalDate);
      const transferSeconds = travelDays * DAY_SECONDS;
      const transferSolution = solveBallisticTransfer(
        departureState,
        arrivalState,
        transferSeconds
      );
      const departureBurn = transferSolution.departureVelocity.sub(departureState.velocity);
      const arrivalBurn = arrivalState.velocity.sub(transferSolution.arrivalVelocity);
      const departureDeltaV = departureBurn.norm();
      const arrivalDeltaV = arrivalBurn.norm();
      const totalDeltaV = departureDeltaV + arrivalDeltaV;
      const fuelRequiredKg = impulseFuelRequiredKg(
        totalDeltaV,
        ship.dryMassKg,
        ship.fuelMassKg,
        ship.ispSeconds
      );
      const hazard = estimateHazardAlongRoute(
        departureState.position,
        arrivalState.position
      );
      const radiation = estimateRadiationAlongRoute(
        departureState.position,
        arrivalState.position,
        travelDays
      );

      candidates.push({
        delayDays,
        travelDays,
        departureDate,
        arrivalDate,
        departureState,
        arrivalState,
        transitVelocity: transferSolution.departureVelocity,
        departureDeltaV,
        arrivalDeltaV,
        totalDeltaV,
        fuelRequiredKg,
        feasible: fuelRequiredKg <= ship.fuelMassKg,
        fuelMarginKg: ship.fuelMassKg - fuelRequiredKg,
        arrivalSpeedKmS: arrivalBurn.norm(),
        departureDistanceKm: departureState.position.sub(arrivalState.position).norm(),
        arrivalPositionErrorKm: transferSolution.arrivalPositionErrorKm,
        radiationScore: radiation.score,
        radiationDoseMsv: radiation.totalDoseMsv,
        averageRadiationDoseRateMsvPerDay: radiation.averageDoseRateMsvPerDay,
        peakRadiation: radiation.peakDoseRateMsvPerDay,
        missionDoseLimitMsv: radiation.missionDoseLimitMsv,
        radiationDoseLimitRatio: radiation.doseLimitRatio,
        radiationPeakLimitRatio: radiation.peakLimitRatio,
        crewRadiationRisk: radiation.crewRiskLevel,
        violatesSolarKeepout: radiation.violatesSolarKeepout,
        crewSafe: !radiation.violatesSolarKeepout && radiation.doseLimitRatio <= 1 && radiation.peakLimitRatio <= 1,
        closestSunRadiusAu: radiation.closestRadiusAu,
        hazardScore: hazard.score,
        hazardHits: hazard.hits
      });
    }
  }

  const preferences = ensureAtLeastOnePreference(getOptimizationPreferences());
  const validCandidates = candidates
    .filter((candidate) => candidate.arrivalPositionErrorKm < 3500000);

  const metrics = validCandidates.reduce((acc, candidate) => {
    acc.maxTravelDays = Math.max(acc.maxTravelDays, candidate.travelDays);
    acc.maxFuelRequiredKg = Math.max(acc.maxFuelRequiredKg, candidate.fuelRequiredKg);
    acc.maxRadiationScore = Math.max(acc.maxRadiationScore, candidate.radiationScore);
    return acc;
  }, {
    maxTravelDays: 1,
    maxFuelRequiredKg: 1,
    maxRadiationScore: 1
  });

  const crewSafeCandidates = validCandidates
    .filter((candidate) => candidate.crewSafe);
  const routePool = crewSafeCandidates.length ? crewSafeCandidates : validCandidates;

  const feasibleCandidates = routePool
    .filter((candidate) => candidate.feasible)
    .sort((a, b) =>
      getRouteScore(a, metrics, preferences) - getRouteScore(b, metrics, preferences) ||
      (a.delayDays + a.travelDays) - (b.delayDays + b.travelDays) ||
      a.arrivalPositionErrorKm - b.arrivalPositionErrorKm ||
      a.travelDays - b.travelDays ||
      a.delayDays - b.delayDays ||
      a.totalDeltaV - b.totalDeltaV ||
      a.hazardScore - b.hazardScore
    );

  const minimumFuelCandidates = [...routePool].sort((a, b) =>
    a.fuelRequiredKg - b.fuelRequiredKg ||
    a.arrivalPositionErrorKm - b.arrivalPositionErrorKm ||
    (a.delayDays + a.travelDays) - (b.delayDays + b.travelDays) ||
    a.travelDays - b.travelDays ||
    a.totalDeltaV - b.totalDeltaV
  );

  const fallbackCandidates = [...(routePool.length ? routePool : candidates)].sort((a, b) =>
    a.arrivalPositionErrorKm - b.arrivalPositionErrorKm ||
    a.fuelRequiredKg - b.fuelRequiredKg ||
    (a.delayDays + a.travelDays) - (b.delayDays + b.travelDays) ||
    a.travelDays - b.travelDays ||
    a.totalDeltaV - b.totalDeltaV
  );
  const lowestRadiationCandidates = [...routePool].sort((a, b) =>
    a.radiationScore - b.radiationScore ||
    a.peakRadiation - b.peakRadiation ||
    a.travelDays - b.travelDays
  );
  const fastestCandidates = [...routePool].sort((a, b) =>
    a.travelDays - b.travelDays ||
    a.arrivalPositionErrorKm - b.arrivalPositionErrorKm
  );

  const best = feasibleCandidates[0] || fallbackCandidates[0] || null;
  const minimumFuelPlan = minimumFuelCandidates[0] || fallbackCandidates[0] || null;
  const lowestRadiationPlan = lowestRadiationCandidates[0] || fallbackCandidates[0] || null;
  const fastestPlan = fastestCandidates[0] || fallbackCandidates[0] || null;
  if (!best) {
    throw new Error("No route candidates could be generated.");
  }

  const direction = best.departureDeltaV > 0
    ? departureBurnLabel(best.departureState.velocity, best.transitVelocity)
    : "Coast";

  return {
    createdAt: simDate,
    originDescriptor,
    destinationDescriptor,
    ship,
    feasible: best.feasible,
    candidateCount: candidates.length,
    validCandidateCount: validCandidates.length,
    direction,
    preferences,
    minimumFuelRequiredKg: minimumFuelPlan ? minimumFuelPlan.fuelRequiredKg : best.fuelRequiredKg,
    minimumFuelDepartureDate: minimumFuelPlan ? minimumFuelPlan.departureDate : best.departureDate,
    minimumFuelTravelDays: minimumFuelPlan ? minimumFuelPlan.travelDays : best.travelDays,
    lowestRadiationScore: lowestRadiationPlan ? lowestRadiationPlan.radiationScore : best.radiationScore,
    lowestRadiationDepartureDate: lowestRadiationPlan ? lowestRadiationPlan.departureDate : best.departureDate,
    lowestRadiationTravelDays: lowestRadiationPlan ? lowestRadiationPlan.travelDays : best.travelDays,
    fastestDepartureDate: fastestPlan ? fastestPlan.departureDate : best.departureDate,
    fastestTravelDays: fastestPlan ? fastestPlan.travelDays : best.travelDays,
    ...best
  };
}

function estimateRoute(originDescriptor, destinationDescriptor, simDate, ship) {
  const sameBody =
    originDescriptor.mode === "body" &&
    destinationDescriptor.mode === "body" &&
    originDescriptor.bodyName === destinationDescriptor.bodyName;

  if (sameBody) {
    throw new Error("Origin and destination cannot be the same body.");
  }

  if (originDescriptor.mode !== "body" || destinationDescriptor.mode !== "body") {
    return estimateRouteBallistic(originDescriptor, destinationDescriptor, simDate, ship);
  }

  const candidates = [];
  const preferences = ensureAtLeastOnePreference(getOptimizationPreferences());
  for (let delayDays = 0; delayDays <= 780; delayDays += 5) {
    const departureDate = new Date(simDate.getTime() + delayDays * DAY_MS);
    const candidate = estimateBodyTransferCandidate(
      originDescriptor,
      destinationDescriptor,
      departureDate,
      ship
    );
    candidate.delayDays = delayDays;
    candidates.push(candidate);
  }

  const validCandidates = candidates
    .filter((candidate) => candidate.arrivalPositionErrorKm < 25000000);

  const metrics = validCandidates.reduce((acc, candidate) => {
    acc.maxTravelDays = Math.max(acc.maxTravelDays, candidate.travelDays);
    acc.maxFuelRequiredKg = Math.max(acc.maxFuelRequiredKg, candidate.fuelRequiredKg);
    acc.maxRadiationScore = Math.max(acc.maxRadiationScore, candidate.radiationScore);
    return acc;
  }, {
    maxTravelDays: 1,
    maxFuelRequiredKg: 1,
    maxRadiationScore: 1
  });

  const crewSafeCandidates = validCandidates
    .filter((candidate) => candidate.crewSafe);
  const routePool = crewSafeCandidates.length ? crewSafeCandidates : validCandidates;

  const feasibleCandidates = routePool
    .filter((candidate) => candidate.feasible)
    .sort((a, b) =>
      getRouteScore(a, metrics, preferences) - getRouteScore(b, metrics, preferences) ||
      comparePlanCandidates(a, b)
    );

  const minimumFuelCandidates = [...routePool].sort((a, b) =>
    a.fuelRequiredKg - b.fuelRequiredKg ||
    a.phaseErrorRad - b.phaseErrorRad ||
    comparePlanCandidates(a, b)
  );

  const fallbackCandidates = [...(routePool.length ? routePool : candidates)].sort(comparePlanCandidates);
  const lowestRadiationCandidates = [...routePool].sort((a, b) =>
    a.radiationScore - b.radiationScore ||
    a.peakRadiation - b.peakRadiation ||
    comparePlanCandidates(a, b)
  );
  const fastestCandidates = [...routePool].sort((a, b) =>
    a.travelDays - b.travelDays ||
    comparePlanCandidates(a, b)
  );
  const best = feasibleCandidates[0] || fallbackCandidates[0] || null;
  const minimumFuelPlan = minimumFuelCandidates[0] || fallbackCandidates[0] || null;
  const lowestRadiationPlan = lowestRadiationCandidates[0] || fallbackCandidates[0] || null;
  const fastestPlan = fastestCandidates[0] || fallbackCandidates[0] || null;

  if (!best) {
    throw new Error("No route candidates could be generated.");
  }

  const direction = best.departureDeltaV > 0
    ? departureBurnLabel(best.departureState.velocity, best.transitVelocity)
    : "Coast";

  return {
    createdAt: simDate,
    originDescriptor,
    destinationDescriptor,
    ship,
    feasible: best.feasible,
    candidateCount: candidates.length,
    validCandidateCount: validCandidates.length,
    direction,
    preferences,
    minimumFuelRequiredKg: minimumFuelPlan ? minimumFuelPlan.fuelRequiredKg : best.fuelRequiredKg,
    minimumFuelDepartureDate: minimumFuelPlan ? minimumFuelPlan.departureDate : best.departureDate,
    minimumFuelTravelDays: minimumFuelPlan ? minimumFuelPlan.travelDays : best.travelDays,
    lowestRadiationScore: lowestRadiationPlan ? lowestRadiationPlan.radiationScore : best.radiationScore,
    lowestRadiationDepartureDate: lowestRadiationPlan ? lowestRadiationPlan.departureDate : best.departureDate,
    lowestRadiationTravelDays: lowestRadiationPlan ? lowestRadiationPlan.travelDays : best.travelDays,
    fastestDepartureDate: fastestPlan ? fastestPlan.departureDate : best.departureDate,
    fastestTravelDays: fastestPlan ? fastestPlan.travelDays : best.travelDays,
    ...best
  };
}

function departureBurnLabel(originVelocity, transitVelocity) {
  const originSpeed = originVelocity.norm();
  const transitSpeed = transitVelocity.norm();
  const radialDot = originVelocity.unit().dot(transitVelocity.unit());

  if (originSpeed === 0 || transitSpeed === 0) {
    return "Accelerate toward the plotted destination";
  }
  if (radialDot > 0.92 && transitSpeed > originSpeed) {
    return "Accelerate mostly prograde";
  }
  if (radialDot > 0.92 && transitSpeed <= originSpeed) {
    return "Adjust prograde and trim speed";
  }
  if (radialDot < -0.35) {
    return "Reverse course, then burn toward the intercept";
  }
  return "Burn toward the destination intercept point";
}

function renderRouteStats(plan) {
  updateRouteTimeline(plan);

  const stats = plan
    ? [
        { label: "Crew Safety First", value: plan.preferences.safety ? "Enabled" : "Optional" },
        { label: "Best Time To Leave", value: formatShortDate(plan.departureDate) },
        { label: "Destination Arrival", value: formatShortDate(plan.arrivalDate) },
        { label: "Selected Priorities", value: summarizePreferenceText(plan.preferences) || "time, fuel, radiation" },
        { label: "Minimum Fuel To Make Trip", value: formatFuel(plan.minimumFuelRequiredKg) },
        { label: "Lowest Fuel Leave Time", value: formatShortDate(plan.minimumFuelDepartureDate) },
        { label: "Shortest-Time Departure", value: formatShortDate(plan.fastestDepartureDate) },
        { label: "Shortest Travel Time", value: formatDays(plan.fastestTravelDays) },
        { label: "Lowest Radiation Leave Time", value: formatShortDate(plan.lowestRadiationDepartureDate) },
        { label: "Travel Time", value: formatDays(plan.travelDays) },
        { label: "Departure Burn", value: formatDeltaV(plan.departureDeltaV) },
        { label: "Arrival Match", value: formatDeltaV(plan.arrivalDeltaV) },
        { label: "Total Delta-V", value: formatDeltaV(plan.totalDeltaV) },
        { label: "Fuel Required", value: formatFuel(plan.fuelRequiredKg) },
        { label: "Crew Radiation Dose", value: formatDose(plan.radiationDoseMsv) },
        { label: "Peak Dose Rate", value: formatDoseRate(plan.peakRadiation) },
        { label: "Closest Sun Distance", value: formatAu(plan.closestSunRadiusAu) },
        { label: "Fuel Remaining", value: formatFuel(Math.max(0, plan.ship.fuelMassKg - plan.fuelRequiredKg)) },
        { label: "Crew Dose Limit", value: formatDose(plan.missionDoseLimitMsv) },
        { label: "Crew Radiation Risk", value: formatRiskLevel(plan.crewRadiationRisk) },
        { label: "Hazard Notes", value: plan.hazardHits.join(", ") || "Clear" }
      ]
    : [
        "Best Time To Leave",
        "Destination Arrival",
        "Selected Priorities",
        "Minimum Fuel To Make Trip",
        "Lowest Fuel Leave Time",
        "Shortest-Time Departure",
        "Shortest Travel Time",
        "Lowest Radiation Leave Time",
        "Travel Time",
        "Departure Burn",
        "Arrival Match",
        "Total Delta-V",
        "Fuel Required",
        "Crew Radiation Dose",
        "Peak Dose Rate",
        "Closest Sun Distance",
        "Fuel Remaining",
        "Crew Dose Limit",
        "Crew Radiation Risk",
        "Hazard Notes"
      ].map((label) => ({ label, value: "Awaiting route" }));

  routeStats.innerHTML = stats
    .map(
      (stat) => `
        <div class="route-stat${plan ? "" : " empty"}">
          <span class="label">${stat.label}</span>
          <span class="value">${stat.value}</span>
        </div>
      `
    )
    .join("");
}

function planActiveRoute() {
  const simDate = getCurrentSimTime();
  const ship = {
    dryMassKg: Number(dryMassInput.value),
    fuelMassKg: Number(fuelMassInput.value),
    ispSeconds: Number(ispInput.value)
  };

  const validShip =
    Number.isFinite(ship.dryMassKg) && ship.dryMassKg > 0 &&
    Number.isFinite(ship.fuelMassKg) && ship.fuelMassKg >= 0 &&
    Number.isFinite(ship.ispSeconds) && ship.ispSeconds > 0;

  if (!validShip) {
    throw new Error("Please enter valid spacecraft mass and engine values.");
  }

  const originDescriptor = buildDescriptor(
    originMode.value,
    originBody,
    originCustomX,
    originCustomY,
    originCustomZ,
    "Current Position"
  );
  const destinationDescriptor = buildDescriptor(
    destinationMode.value,
    destinationBody,
    destinationCustomX,
    destinationCustomY,
    destinationCustomZ,
    "Destination Point"
  );

  const plan = estimateRoute(originDescriptor, destinationDescriptor, simDate, ship);
  activeRoutePlan = plan;

  const feasibilityText = plan.feasible
    ? `Best transfer route from ${plan.originDescriptor.label} to ${plan.destinationDescriptor.label}`
    : `Current fuel is too low, so this is the closest transfer plan from ${plan.originDescriptor.label} to ${plan.destinationDescriptor.label}`;
  const preferenceSummary = summarizePreferenceText(plan.preferences) || "time, fuel, and radiation";

  routeSummary.textContent =
    `${feasibilityText}. Best time to leave is ${formatShortDate(plan.departureDate)} ` +
    `(${plan.delayDays === 0 ? "leave now" : `in ${formatNumber(plan.delayDays, 1)} days`}), ` +
    `optimized for ${preferenceSummary}. ` +
    `travel for ${formatNumber(plan.travelDays, 1)} days, and ${plan.direction.toLowerCase()}. ` +
    `Estimated total delta-v is ${formatNumber(plan.totalDeltaV, 2)} km/s ` +
    `with ${formatNumber(plan.fuelRequiredKg, 1)} kg of fuel required for the selected route. ` +
    `Estimated crew radiation dose is ${formatDose(plan.radiationDoseMsv)} against a ${formatDose(plan.missionDoseLimitMsv)} mission limit (${plan.crewRadiationRisk.toLowerCase()}). ` +
    `Minimum fuel to make the trip at all is ${formatNumber(plan.minimumFuelRequiredKg, 1)} kg. ` +
    `For shortest travel time, depart ${formatShortDate(plan.fastestDepartureDate)} and travel for ${formatDays(plan.fastestTravelDays)}. ` +
    `Lowest-radiation departure is ${formatShortDate(plan.lowestRadiationDepartureDate)}. ` +
    `Sun gravity is included in the transfer estimate.`;

  renderRouteStats(plan);
  setStatus(
    plan.feasible
      ? `Route planned successfully. ${plan.candidateCount} transfer candidates checked.`
      : "Route plotted, but the current fuel load is too low for a fully feasible transfer."
  );
}

function tryPlanActiveRoute(statusText) {
  try {
    planActiveRoute();
    if (statusText) {
      setStatus(statusText);
    }
    return true;
  } catch (error) {
    routeSummary.textContent = error.message;
    renderRouteStats();
    setStatus(error.message);
    return false;
  }
}

function queueRoutePlan(options = {}) {
  const { statusText, pendingSummary } = options;

  if (routePlanRequestPending || isPlanningRoute) {
    return;
  }

  routePlanRequestPending = true;
  isPlanningRoute = true;
  if (planRouteBtn) {
    planRouteBtn.disabled = true;
  }
  if (pendingSummary) {
    routeSummary.textContent = pendingSummary;
  }
  renderRouteStats();

  requestAnimationFrame(() => {
    setTimeout(() => {
      routePlanRequestPending = false;
      tryPlanActiveRoute(statusText);
      isPlanningRoute = false;
      if (planRouteBtn) {
        planRouteBtn.disabled = false;
      }
    }, 0);
  });
}

function scheduleRoutePlanUpdate(statusText) {
  if (routePlanFramePending) {
    return;
  }

  routePlanFramePending = true;
  requestAnimationFrame(() => {
    routePlanFramePending = false;
    if (isPlanningRoute) {
      return;
    }
    tryPlanActiveRoute(statusText);
  });
}

function getCurrentOriginDescriptor() {
  return buildDescriptor(
    originMode.value,
    originBody,
    originCustomX,
    originCustomY,
    originCustomZ,
    "Current Position"
  );
}

function getCurrentDestinationDescriptor() {
  return buildDescriptor(
    destinationMode.value,
    destinationBody,
    destinationCustomX,
    destinationCustomY,
    destinationCustomZ,
    "Destination Point"
  );
}

function updateOriginInputsFromPosition(positionKm) {
  originMode.value = "custom";
  syncModeVisibility();
  originCustomX.value = (positionKm.x / AU_KM).toFixed(3);
  originCustomY.value = (positionKm.y / AU_KM).toFixed(3);
  originCustomZ.value = (positionKm.z / AU_KM).toFixed(3);
}

function updateDestinationInputsFromPosition(positionKm) {
  destinationMode.value = "custom";
  syncModeVisibility();
  destinationCustomX.value = (positionKm.x / AU_KM).toFixed(3);
  destinationCustomY.value = (positionKm.y / AU_KM).toFixed(3);
  destinationCustomZ.value = (positionKm.z / AU_KM).toFixed(3);
}

function drawSolarSystem(simDate) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const viewState = getViewState(simDate);
  const centerX = viewState.centerX;
  const centerY = viewState.centerY;

  ctx.clearRect(0, 0, width, height);
  drawBackgroundStars(viewState);

  lastViewState = viewState;
  const scale = viewState.scale;

  planetNames.forEach((name) => {
    const info = spice.getBodyInfo(name);
    const orbitRadiusPx = info.a * AU_KM * scale;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.arc(centerX, centerY, orbitRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
  });

  drawAsteroidBelt(simDate, viewState);

  const sunRadius = getSunDisplayRadius(simDate, scale);
  const mercuryOrbitPx = spice.getBodyInfo("MERCURY").a * AU_KM * scale;
  const sunGlowRadius = Math.min(sunRadius * 2.2, mercuryOrbitPx * 0.72);
  const glow = ctx.createRadialGradient(centerX, centerY, Math.max(4, sunRadius * 0.45), centerX, centerY, sunGlowRadius);
  glow.addColorStop(0, "rgba(255, 220, 120, 1)");
  glow.addColorStop(0.3, "rgba(255, 190, 90, 0.8)");
  glow.addColorStop(0.65, "rgba(255, 160, 70, 0.2)");
  glow.addColorStop(1, "rgba(255, 140, 45, 0)");

  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.arc(centerX, centerY, sunGlowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#ffce66";
  ctx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
  ctx.fill();

  lastPlanetHitTargets = [];
  planetNames.forEach((name) => {
    const planet = getPlanetDrawData(name, simDate, scale);
    const px = centerX + planet.x;
    const py = centerY + planet.y;
    const radius = getPlanetRadius(name);

    ctx.beginPath();
    ctx.fillStyle = planet.info.color || "white";
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();

    if (name === "SATURN") {
      const ringRadiusX = radius * 1.95;
      const ringRadiusY = Math.max(radius * 0.72, 6);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(231, 210, 141, 0.9)";
      ctx.lineWidth = Math.max(1.8, radius * 0.16);
      ctx.ellipse(px, py, ringRadiusX, ringRadiusY, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = `12px ${UI_FONT}`;
    ctx.fillText(getPlanetDisplayName(name), px + 8, py - 8);

    lastPlanetHitTargets.push({
      name,
      x: px,
      y: py,
      radius: Math.max(10, radius + 4)
    });
  });

  drawRouteOverlay(simDate, centerX, centerY, scale);
  drawPlannedTransferMarkers(viewState);
  drawOriginMarker(simDate, viewState);
  drawDestinationMarker(simDate, viewState);
}

function updateUI(simDate) {
  if (!simTimeDisplay.dataset.enhanced) {
    simTimeDisplay.textContent = "";
    const clockLine = document.createElement("span");
    const dateLine = document.createElement("span");
    clockLine.className = "sim-time-clock";
    dateLine.className = "sim-time-date";
    simTimeDisplay.append(clockLine, dateLine);
    simTimeDisplay.dataset.enhanced = "true";
  }

  simTimeDisplay.querySelector(".sim-time-clock").textContent = simDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
  simTimeDisplay.querySelector(".sim-time-date").textContent = simDate.toLocaleDateString([], {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  if (selectedPlanetName) {
    populatePlanetOverview(selectedPlanetName, simDate);
  }

  if (activeRoutePlan) {
    updateRouteTimeline(activeRoutePlan, simDate);
  }

  updateMissionTelemetry(simDate);
}

function animate() {
  const simDate = getCurrentSimTime();
  drawSolarSystem(simDate);
  updateUI(simDate);
  requestAnimationFrame(animate);
}

function setSimulationMode(useRealTime) {
  usingRealTime = useRealTime;
  paused = false;
  togglePauseBtn.textContent = "Pause";
  baseSimTime = new Date();
  realTimestampAtBase = Date.now();

  if (useRealTime) {
    setStatus("Using current real-world time.");
  } else {
    setStatus("Using the selected custom simulation time.");
  }
}

function syncModeVisibility() {
  originBodyGroup.classList.toggle("hidden", originMode.value !== "body");
  originCustomGroup.classList.toggle("hidden", originMode.value !== "custom");
  destinationBodyGroup.classList.toggle("hidden", destinationMode.value !== "body");
  destinationCustomGroup.classList.toggle("hidden", destinationMode.value !== "custom");
}

function setControlMenuOpen(isOpen) {
  controlMenuBtn?.setAttribute("aria-expanded", String(isOpen));
  missionControls?.setAttribute("aria-hidden", String(!isOpen));
  missionControls?.querySelectorAll("button, input, select").forEach((control) => {
    control.tabIndex = isOpen ? 0 : -1;
  });
}

function swapRouteSelections() {
  const oldOriginMode = originMode.value;
  const oldDestinationMode = destinationMode.value;
  const oldOriginBody = originBody.value;
  const oldDestinationBody = destinationBody.value;
  const oldOriginCustom = [originCustomX.value, originCustomY.value, originCustomZ.value];
  const oldDestinationCustom = [destinationCustomX.value, destinationCustomY.value, destinationCustomZ.value];

  originMode.value = oldDestinationMode;
  destinationMode.value = oldOriginMode;
  originBody.value = oldDestinationBody;
  destinationBody.value = oldOriginBody;
  [originCustomX.value, originCustomY.value, originCustomZ.value] = oldDestinationCustom;
  [destinationCustomX.value, destinationCustomY.value, destinationCustomZ.value] = oldOriginCustom;

  syncModeVisibility();
}

nowBtn.addEventListener("click", () => {
  setSimulationMode(true);
  customTimeInput.value = formatDateForInput(new Date());
});

togglePauseBtn.addEventListener("click", () => {
  paused = !paused;

  if (paused) {
    baseSimTime = getCurrentSimTime();
    togglePauseBtn.textContent = "Resume";
    setStatus("Simulation paused.");
  } else {
    realTimestampAtBase = Date.now();
    if (!usingRealTime) {
      baseSimTime = new Date(customTimeInput.value || baseSimTime);
    }
    togglePauseBtn.textContent = "Pause";
    setStatus("Simulation running.");
  }
});

applyTimeBtn.addEventListener("click", () => {
  if (!customTimeInput.value) {
    setStatus("Please choose a valid date/time before applying.");
    return;
  }

  usingRealTime = false;
  paused = false;
  baseSimTime = new Date(customTimeInput.value);
  realTimestampAtBase = Date.now();
  togglePauseBtn.textContent = "Pause";
  setStatus("Custom simulation time applied.");
});

function applySpeedInput() {
  const nextTimeScale = Number(speedInput?.value);
  if (!Number.isFinite(nextTimeScale) || nextTimeScale <= 0) {
    if (speedInput) {
      speedInput.value = String(timeScale);
    }
    return;
  }

  timeScale = nextTimeScale;
}

speedInput?.addEventListener("change", applySpeedInput);
speedInput?.addEventListener("input", applySpeedInput);

zoomInBtn.addEventListener("click", () => {
  setZoomAtPoint(zoomLevel * 1.2);
});

zoomOutBtn.addEventListener("click", () => {
  setZoomAtPoint(zoomLevel / 1.2);
});

zoomResetBtn?.addEventListener("click", () => {
  cameraOffsetX = 0;
  cameraOffsetY = 0;
  setZoomAtPoint(1);
});

controlMenuBtn?.addEventListener("click", () => {
  const isOpen = controlMenuBtn.getAttribute("aria-expanded") === "true";
  setControlMenuOpen(!isOpen);
});

controlMenuBtn?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  const isOpen = controlMenuBtn.getAttribute("aria-expanded") === "true";
  setControlMenuOpen(!isOpen);
});

openPlannerBtn.addEventListener("click", () => {
  setPlannerOpen(true);
});

closePlannerBtn.addEventListener("click", () => {
  setPlannerOpen(false);
});

plannerBackdrop.addEventListener("click", () => {
  setPlannerOpen(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && selectedPlanetName) {
    hidePlanetInfo();
    return;
  }

  if (event.key === "Escape" && !plannerModal.classList.contains("hidden")) {
    setPlannerOpen(false);
  }
});

originMode.addEventListener("change", syncModeVisibility);
destinationMode.addEventListener("change", syncModeVisibility);

swapRouteBtn.addEventListener("click", () => {
  swapRouteSelections();
  setStatus("Origin and destination swapped.");
});

planRouteBtn.addEventListener("click", () => {
  queueRoutePlan({
    pendingSummary: "Calculating the fastest gravity-assisted route...",
    statusText: "Fastest route updated."
  });
});

[
  originMode,
  originBody,
  destinationMode,
  destinationBody,
  dryMassInput,
  fuelMassInput,
  ispInput,
  preferTimeInput,
  preferFuelInput,
  originCustomX,
  originCustomY,
  originCustomZ,
  destinationCustomX,
  destinationCustomY,
  destinationCustomZ
].forEach((control) => {
  control?.addEventListener("change", () => {
    scheduleRoutePlanUpdate("Route guidance refreshed.");
  });
});

window.addEventListener("resize", () => scheduleCanvasResize(true));

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const pointer = getPointerPosition(event);
  const delta = clamp(event.deltaY, -40, 40);
  const factor = Math.exp(-delta * 0.006);
  setZoomAtPoint(zoomLevel * factor, pointer);
}, { passive: false });

canvas.addEventListener("pointerdown", (event) => {
  if (!lastViewState || event.button !== 0) return;
  pointerMovedDuringDrag = false;

  const pointer = getPointerPosition(event);
  const originState = resolveDescriptorState(getCurrentOriginDescriptor(), getCurrentSimTime());
  const destinationState = resolveDescriptorState(getCurrentDestinationDescriptor(), getCurrentSimTime());
  const originMarker = canvasToScreen(originState.position, lastViewState);
  const destinationMarker = canvasToScreen(destinationState.position, lastViewState);
  const originLabel = getMarkerLabel("origin");
  const destinationLabel = getMarkerLabel("destination");
  const originDistance = pointHitsMarker(pointer, originMarker, originLabel);
  const destinationDistance = pointHitsMarker(pointer, destinationMarker, destinationLabel);

  if (Number.isFinite(originDistance) && originDistance <= destinationDistance) {
    dragTarget = "origin";
    isPanningView = false;
    dragPointerId = event.pointerId;
    originMode.value = "custom";
    syncModeVisibility();
    canvas.setPointerCapture(event.pointerId);
    setStatus("Dragging ship origin. Release to set the custom coordinate.");
    return;
  }

  if (Number.isFinite(destinationDistance)) {
    dragTarget = "destination";
    isPanningView = false;
    dragPointerId = event.pointerId;
    destinationMode.value = "custom";
    syncModeVisibility();
    canvas.setPointerCapture(event.pointerId);
    setStatus("Dragging destination. Release to set the custom coordinate.");
    return;
  }

  isPanningView = true;
  dragTarget = null;
  dragPointerId = event.pointerId;
  panStartPointer = pointer;
  panStartOffset = { x: cameraOffsetX, y: cameraOffsetY };
  canvas.setPointerCapture(event.pointerId);
  setStatus("Dragging view. Release to stop panning.");
});

canvas.addEventListener("pointermove", (event) => {
  if (!lastViewState || event.pointerId !== dragPointerId) return;
  pointerMovedDuringDrag = true;

  if (dragTarget === "origin") {
    const pointer = getPointerPosition(event);
    const world = screenToWorld(pointer.x, pointer.y, lastViewState);
    updateOriginInputsFromPosition(world);
    scheduleRoutePlanUpdate("Scanning fastest route from the dragged ship position...");
    return;
  }

  if (dragTarget === "destination") {
    const pointer = getPointerPosition(event);
    const world = screenToWorld(pointer.x, pointer.y, lastViewState);
    updateDestinationInputsFromPosition(world);
    scheduleRoutePlanUpdate("Scanning fastest route to the dragged destination...");
    return;
  }

  if (!isPanningView || !panStartPointer || !panStartOffset) return;
  const pointer = getPointerPosition(event);
  cameraOffsetX = panStartOffset.x + (pointer.x - panStartPointer.x);
  cameraOffsetY = panStartOffset.y + (pointer.y - panStartPointer.y);
});

canvas.addEventListener("click", (event) => {
  if (pointerMovedDuringDrag) {
    pointerMovedDuringDrag = false;
    return;
  }

  const pointer = getPointerPosition(event);
  const selectedTarget = lastPlanetHitTargets.find((planet) =>
    Math.hypot(pointer.x - planet.x, pointer.y - planet.y) <= planet.radius
  );

  if (!selectedTarget) {
    hidePlanetInfo();
    return;
  }

  showPlanetInfo(selectedTarget.name);
});

function finishOriginDrag(event) {
  if (event && dragPointerId !== null && event.pointerId !== dragPointerId) return;

  const finishedDragTarget = dragTarget;
  const finishedPanningView = isPanningView;

  dragTarget = null;
  isPanningView = false;
  dragPointerId = null;
  panStartPointer = null;
  panStartOffset = null;

  if (event && typeof canvas.releasePointerCapture === "function") {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {}
  }

  if (finishedPanningView && !finishedDragTarget) {
    setStatus("View updated.");
    return;
  }

  if (!finishedDragTarget) return;

  tryPlanActiveRoute(
    finishedDragTarget === "origin"
      ? "Custom ship origin updated from the canvas."
      : "Custom destination updated from the canvas."
  );
}

canvas.addEventListener("pointerup", finishOriginDrag);
canvas.addEventListener("pointercancel", finishOriginDrag);
canvas.addEventListener("pointerleave", finishOriginDrag);
closePlanetInfoBtn?.addEventListener("click", hidePlanetInfo);
planetEndpointBtn?.addEventListener("click", () => {
  if (!selectedPlanetName) {
    return;
  }

  destinationMode.value = "body";
  destinationBody.value = selectedPlanetName;
  syncModeVisibility();
  queueRoutePlan({
    pendingSummary: `Updating route to ${getPlanetDisplayName(selectedPlanetName)}...`,
    statusText: `Destination set to ${getPlanetDisplayName(selectedPlanetName)}.`
  });
  hidePlanetInfo();
});

function initializeApp() {
  resetViewportScroll();
  resetPlanetOverviewScroll();
  customTimeInput.value = formatDateForInput(new Date());
  if (speedInput) {
    speedInput.value = String(timeScale);
  }
  createAsteroids();
  observeCanvasLayout();
  syncModeVisibility();
  setControlMenuOpen(false);
  setPlannerOpen(false);
  updateZoomDisplay();
  scheduleCanvasResize(true);

  queueRoutePlan({
    pendingSummary: "Calculating the initial route..."
  });

  animate();
}

try {
  initializeApp();
} catch (error) {
  simTimeDisplay.textContent = "Startup error";
  routeSummary.textContent = error.message;
  renderRouteStats();
  setStatus(error.message);
  throw error;
}
})();
