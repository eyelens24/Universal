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
const preferRadiationInput = document.getElementById("preferRadiationInput");
const swapRouteBtn = document.getElementById("swapRouteBtn");
const planRouteBtn = document.getElementById("planRouteBtn");
const routeSummary = document.getElementById("routeSummary");
const routeStats = document.getElementById("routeStats");
const planetInfo = document.getElementById("planetInfo");
const closePlanetInfoBtn = document.getElementById("closePlanetInfoBtn");
const planetBadge = document.getElementById("planetBadge");
const planetName = document.getElementById("planetName");
const planetDistance = document.getElementById("planetDistance");
const planetSize = document.getElementById("planetSize");
const planetTemp = document.getElementById("planetTemp");
const planetElements = document.getElementById("planetElements");

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

const asteroidImg = new Image();
asteroidImg.src = "assets/asteroid.png";

const asteroidBeltInner = 180;
const asteroidBeltOuter = 205;
const asteroidCount = 140;
const asteroids = [];
const stars = [];

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
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  createStarField(rect.width, rect.height);
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
  const maxVisualRadius = Math.min(width, height) * 0.42;
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
}

function getPlanetDisplayName(name) {
  return name.charAt(0) + name.slice(1).toLowerCase();
}

function hidePlanetInfo() {
  planetInfo?.classList.add("hidden");
  selectedPlanetName = null;
}

function showPlanetInfo(name, simDate = getCurrentSimTime()) {
  const info = spice.getBodyInfo(name);
  const state = getBodyState(name, simDate);
  const earthState = getBodyState("EARTH", simDate);
  const distanceFromEarthAu = state.position.sub(earthState.position).norm() / AU_KM;
  const intel = PLANET_INTELLIGENCE[name];

  selectedPlanetName = name;
  if (planetBadge) {
    planetBadge.textContent = getPlanetDisplayName(name).slice(0, 2).toUpperCase();
    planetBadge.style.background = `linear-gradient(135deg, ${info.color}, rgba(255,255,255,0.9))`;
  }
  if (planetName) {
    planetName.textContent = getPlanetDisplayName(name);
  }
  if (planetDistance) {
    planetDistance.textContent = name === "EARTH" ? "0 AU" : formatAu(distanceFromEarthAu);
  }
  if (planetSize) {
    planetSize.textContent = `${formatKm(info.radiusKm)} radius`;
  }
  if (planetTemp) {
    planetTemp.textContent = intel?.temperature || "No thermal profile available";
  }
  if (planetElements) {
    planetElements.textContent = intel?.elements || "No composition data available";
  }
  planetInfo?.classList.remove("hidden");
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
  const samples = 24;
  let score = 0;
  const hits = new Set();

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const sample = startPosition.add(endPosition.sub(startPosition).scale(t));
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
  const samples = 36;
  let totalExposure = 0;
  let peakExposure = 0;
  let closestRadiusAu = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const sample = startPosition.add(endPosition.sub(startPosition).scale(t));
    const radiusAu = Math.max(0.2, sample.norm() / AU_KM);
    closestRadiusAu = Math.min(closestRadiusAu, radiusAu);

    let exposure = 1 / (radiusAu * radiusAu);
    if (radiusAu < 0.85) {
      exposure += ((0.85 - radiusAu) / 0.85) * 2.4;
    }
    if (radiusAu > 4.8 && radiusAu < 6.2) {
      exposure += 1.1;
    }

    totalExposure += exposure;
    peakExposure = Math.max(peakExposure, exposure);
  }

  const averageExposure = totalExposure / (samples + 1);
  const missionExposure = averageExposure * Math.max(1, travelDays / 30);

  return {
    score: missionExposure,
    peakExposure,
    closestRadiusAu
  };
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
    time: Boolean(preferTimeInput?.checked),
    fuel: Boolean(preferFuelInput?.checked),
    radiation: Boolean(preferRadiationInput?.checked)
  };
}

function ensureAtLeastOnePreference(preferences) {
  if (preferences.time || preferences.fuel || preferences.radiation) {
    return preferences;
  }

  return {
    time: true,
    fuel: true,
    radiation: true
  };
}

function getRouteScore(candidate, metrics, preferences) {
  let score = candidate.phaseErrorRad ?? 0;

  if (preferences.time) {
    score += candidate.travelDays / Math.max(metrics.maxTravelDays, 1);
  }
  if (preferences.fuel) {
    score += candidate.fuelRequiredKg / Math.max(metrics.maxFuelRequiredKg, 1);
  }
  if (preferences.radiation) {
    score += candidate.radiationScore / Math.max(metrics.maxRadiationScore, 1);
  }

  return score;
}

function summarizePreferenceText(preferences) {
  const active = [];
  if (preferences.time) active.push("time");
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
    peakRadiation: radiation.peakExposure,
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
        peakRadiation: radiation.peakExposure,
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

  const feasibleCandidates = validCandidates
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

  const minimumFuelCandidates = [...validCandidates].sort((a, b) =>
    a.fuelRequiredKg - b.fuelRequiredKg ||
    a.arrivalPositionErrorKm - b.arrivalPositionErrorKm ||
    (a.delayDays + a.travelDays) - (b.delayDays + b.travelDays) ||
    a.travelDays - b.travelDays ||
    a.totalDeltaV - b.totalDeltaV
  );

  const fallbackCandidates = [...candidates].sort((a, b) =>
    a.arrivalPositionErrorKm - b.arrivalPositionErrorKm ||
    a.fuelRequiredKg - b.fuelRequiredKg ||
    (a.delayDays + a.travelDays) - (b.delayDays + b.travelDays) ||
    a.travelDays - b.travelDays ||
    a.totalDeltaV - b.totalDeltaV
  );
  const lowestRadiationCandidates = [...validCandidates].sort((a, b) =>
    a.radiationScore - b.radiationScore ||
    a.peakRadiation - b.peakRadiation ||
    a.travelDays - b.travelDays
  );
  const fastestCandidates = [...validCandidates].sort((a, b) =>
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

  const feasibleCandidates = validCandidates
    .filter((candidate) => candidate.feasible)
    .sort((a, b) =>
      getRouteScore(a, metrics, preferences) - getRouteScore(b, metrics, preferences) ||
      comparePlanCandidates(a, b)
    );

  const minimumFuelCandidates = [...validCandidates].sort((a, b) =>
    a.fuelRequiredKg - b.fuelRequiredKg ||
    a.phaseErrorRad - b.phaseErrorRad ||
    comparePlanCandidates(a, b)
  );

  const fallbackCandidates = [...candidates].sort(comparePlanCandidates);
  const lowestRadiationCandidates = [...validCandidates].sort((a, b) =>
    a.radiationScore - b.radiationScore ||
    a.peakRadiation - b.peakRadiation ||
    comparePlanCandidates(a, b)
  );
  const fastestCandidates = [...validCandidates].sort((a, b) =>
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
  const stats = plan
    ? [
        { label: "Best Time To Leave", value: formatShortDate(plan.departureDate) },
        { label: "Destination Arrival", value: formatShortDate(plan.arrivalDate) },
        { label: "Selected Priorities", value: summarizePreferenceText(plan.preferences) || "time, fuel, radiation" },
        { label: "Minimum Fuel To Make Trip", value: formatFuel(plan.minimumFuelRequiredKg) },
        { label: "Lowest Fuel Leave Time", value: formatShortDate(plan.minimumFuelDepartureDate) },
        { label: "Fastest Leave Time", value: formatShortDate(plan.fastestDepartureDate) },
        { label: "Lowest Radiation Leave Time", value: formatShortDate(plan.lowestRadiationDepartureDate) },
        { label: "Mission Time", value: formatDays(plan.delayDays + plan.travelDays) },
        { label: "Travel Time", value: formatDays(plan.travelDays) },
        { label: "Departure Delay", value: formatDays(plan.delayDays) },
        { label: "Departure Burn", value: formatDeltaV(plan.departureDeltaV) },
        { label: "Arrival Match", value: formatDeltaV(plan.arrivalDeltaV) },
        { label: "Total Delta-V", value: formatDeltaV(plan.totalDeltaV) },
        { label: "Fuel Required", value: formatFuel(plan.fuelRequiredKg) },
        { label: "Radiation Score", value: formatNumber(plan.radiationScore, 2) },
        { label: "Peak Radiation Spike", value: formatNumber(plan.peakRadiation, 2) },
        { label: "Closest Sun Distance", value: formatAu(plan.closestSunRadiusAu) },
        { label: "Fuel Remaining", value: formatFuel(Math.max(0, plan.ship.fuelMassKg - plan.fuelRequiredKg)) },
        { label: "Intercept Error", value: formatKm(plan.arrivalPositionErrorKm) },
        { label: "Hazard Notes", value: plan.hazardHits.join(", ") || "Clear" }
      ]
    : [
        "Best Time To Leave",
        "Destination Arrival",
        "Selected Priorities",
        "Minimum Fuel To Make Trip",
        "Lowest Fuel Leave Time",
        "Fastest Leave Time",
        "Lowest Radiation Leave Time",
        "Mission Time",
        "Travel Time",
        "Departure Delay",
        "Departure Burn",
        "Arrival Match",
        "Total Delta-V",
        "Fuel Required",
        "Radiation Score",
        "Peak Radiation Spike",
        "Closest Sun Distance",
        "Fuel Remaining",
        "Intercept Error",
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
    `Minimum fuel to make the trip at all is ${formatNumber(plan.minimumFuelRequiredKg, 1)} kg. ` +
    `Lowest-radiation departure is ${formatShortDate(plan.lowestRadiationDepartureDate)}, and fastest departure is ${formatShortDate(plan.fastestDepartureDate)}. ` +
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

function drawRouteMarker(position, scale, centerX, centerY, color, label) {
  const x = centerX + position.x * scale;
  const y = centerY + position.y * scale;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = "bold 12px Arial";
  ctx.fillText(label, x + 12, y - 10);
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
  ctx.font = "bold 12px Arial";
  ctx.fillText(options.label, screenPoint.x + 12, screenPoint.y + 16);

  return screenPoint;
}

function drawOriginMarker(simDate, viewState) {
  const originDescriptor = getCurrentOriginDescriptor();
  const originState = resolveDescriptorState(originDescriptor, simDate);

  return drawDraggableMarker(originState.position, viewState, {
    label: originDescriptor.mode === "custom" ? "Ship" : "Origin",
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
    label: destinationDescriptor.mode === "custom" ? "Destination" : "Target",
    color: "#ffd166",
    activeColor: "#ffc98d",
    ringColor: "rgba(255, 209, 102, 0.55)",
    textColor: "#fff0c2",
    isDragging: dragTarget === "destination"
  });
}

function drawRouteOverlay(simDate, centerX, centerY, scale) {
  if (!activeRoutePlan) {
    return;
  }

  const currentOriginState = resolveDescriptorState(activeRoutePlan.originDescriptor, simDate);
  const currentDestinationState = resolveDescriptorState(activeRoutePlan.destinationDescriptor, simDate);
  const departurePoint = activeRoutePlan.departureState.position;
  const arrivalPoint = activeRoutePlan.arrivalState.position;

  const startX = centerX + departurePoint.x * scale;
  const startY = centerY + departurePoint.y * scale;
  const endX = centerX + arrivalPoint.x * scale;
  const endY = centerY + arrivalPoint.y * scale;
  const controlX = (startX + endX) / 2;
  const controlY = (startY + endY) / 2 - Math.min(canvas.clientWidth, canvas.clientHeight) * 0.08;

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = activeRoutePlan.feasible ? "rgba(120, 255, 206, 0.95)" : "rgba(255, 176, 120, 0.95)";
  ctx.lineWidth = 2.5;
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(controlX, controlY, endX, endY);
  ctx.stroke();
  ctx.restore();

  drawRouteMarker(currentOriginState.position, scale, centerX, centerY, "#80ffce", "You");
  drawRouteMarker(currentDestinationState.position, scale, centerX, centerY, "#ffd166", "Target");
  drawRouteMarker(departurePoint, scale, centerX, centerY, "#9cf6ff", "Departure");
  drawRouteMarker(arrivalPoint, scale, centerX, centerY, "#ffc98d", "Destination");
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

  const glow = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, 42);
  glow.addColorStop(0, "rgba(255, 220, 120, 1)");
  glow.addColorStop(0.3, "rgba(255, 190, 90, 0.8)");
  glow.addColorStop(0.65, "rgba(255, 160, 70, 0.2)");
  glow.addColorStop(1, "rgba(255, 140, 45, 0)");

  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#ffce66";
  ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.fillText("Sun", centerX - 14, centerY - 26);

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
      ctx.beginPath();
      ctx.strokeStyle = "rgba(231, 210, 141, 0.9)";
      ctx.lineWidth = 2;
      ctx.ellipse(px, py, radius + 7, radius + 3, -0.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "12px Arial";
    ctx.fillText(getPlanetDisplayName(name), px + 8, py - 8);

    lastPlanetHitTargets.push({
      name,
      x: px,
      y: py,
      radius: Math.max(10, radius + 4)
    });
  });

  drawRouteOverlay(simDate, centerX, centerY, scale);
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
    showPlanetInfo(selectedPlanetName, simDate);
  }
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

window.addEventListener("resize", resizeCanvas);

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
  const originLabel = originMode.value === "custom" ? "Ship" : "Origin";
  const destinationLabel = destinationMode.value === "custom" ? "Destination" : "Target";
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

function initializeApp() {
  customTimeInput.value = formatDateForInput(new Date());
  if (speedInput) {
    speedInput.value = String(timeScale);
  }
  createAsteroids();
  syncModeVisibility();
  setControlMenuOpen(false);
  setPlannerOpen(false);
  updateZoomDisplay();
  resizeCanvas();

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
