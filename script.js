const canvas = document.getElementById("solarCanvas");
const ctx = canvas.getContext("2d");

const simTimeDisplay = document.getElementById("simTimeDisplay");
const modeDisplay = document.getElementById("modeDisplay");
const nowBtn = document.getElementById("nowBtn");
const applyTimeBtn = document.getElementById("applyTimeBtn");
const customTimeInput = document.getElementById("customTime");
const backBtn = document.getElementById("backBtn");

const planetInfo = document.getElementById("planetInfo");
const planetImage = document.getElementById("planetImage");
const planetNameEl = document.getElementById("planetName");
const planetDistanceEl = document.getElementById("planetDistance");
const planetSizeEl = document.getElementById("planetSize");
const planetTempEl = document.getElementById("planetTemp");
const planetElementsEl = document.getElementById("planetElements");
const legend = document.getElementById("legend");

const spice = createSpiceEnvironment();

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

const planetExtraData = {
  MERCURY: {
    displayName: "Mercury",
    temp: "-180°C to 430°C",
    elements: "Rocky surface with silicates, iron-rich core, oxygen, sodium, hydrogen, helium, potassium"
  },
  VENUS: {
    displayName: "Venus",
    temp: "About 465°C",
    elements: "Carbon dioxide atmosphere, nitrogen, sulfuric acid clouds, rocky silicate crust, iron core"
  },
  EARTH: {
    displayName: "Earth",
    temp: "Average about 15°C",
    elements: "Nitrogen, oxygen, argon, carbon, silicon, iron, water"
  },
  MARS: {
    displayName: "Mars",
    temp: "-125°C to 20°C",
    elements: "Carbon dioxide atmosphere, iron oxide, silicon, oxygen, magnesium, aluminum"
  },
  JUPITER: {
    displayName: "Jupiter",
    temp: "About -145°C",
    elements: "Mostly hydrogen and helium, with methane, ammonia, water vapor"
  },
  SATURN: {
    displayName: "Saturn",
    temp: "About -178°C",
    elements: "Mostly hydrogen and helium, traces of methane, ammonia, water"
  },
  URANUS: {
    displayName: "Uranus",
    temp: "About -224°C",
    elements: "Hydrogen, helium, methane, water, ammonia"
  },
  NEPTUNE: {
    displayName: "Neptune",
    temp: "About -214°C",
    elements: "Hydrogen, helium, methane, water, ammonia"
  }
};

let usingRealTime = true;
let baseSimTime = new Date();
let realTimestampAtBase = Date.now();

let selectedPlanet = null;
let clickablePlanets = [];

const asteroidImg = new Image();
asteroidImg.src = "assets/asteroid.png";

const asteroidBeltInner = 180;
const asteroidBeltOuter = 205;
const asteroidCount = 140;
const asteroids = [];

const planetImages = {};
planetNames.forEach((name) => {
  const img = new Image();
  img.src = `assets/${name.toLowerCase()}.png`;
  planetImages[name] = img;
});

function createAsteroids() {
  asteroids.length = 0;

  for (let i = 0; i < asteroidCount; i++) {
    const orbitRadius = asteroidBeltInner + Math.random() * (asteroidBeltOuter - asteroidBeltInner);
    const baseAngle = Math.random() * Math.PI * 2;
    const orbitalPeriod = 1200 + Math.random() * 1800;
    const size = 8 + Math.random() * 10;

    asteroids.push({
      orbitRadius,
      baseAngle,
      orbitalPeriod,
      size
    });
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = size * dpr;
  canvas.height = size * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

function getCurrentSimTime() {
  if (usingRealTime) return new Date();
  const elapsedMs = Date.now() - realTimestampAtBase;
  return new Date(baseSimTime.getTime() + elapsedMs);
}

function formatDateForInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatKm(value) {
  return `${Math.round(value).toLocaleString()} km`;
}

function formatLightYears(km) {
  const lightYearKm = 9.4607e12;
  return `${(km / lightYearKm).toExponential(6)} ly`;
}

function drawBackgroundStars(width, height) {
  for (let i = 0; i < 120; i++) {
    const x = (i * 73) % width;
    const y = (i * 127) % height;
    const r = (i % 3) + 1;

    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.15 + (i % 5) * 0.1})`;
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAsteroidBelt(simDate, centerX, centerY) {
  const et = spice.time.dateToEt(simDate);
  const days = et / 86400;

  ctx.beginPath();
  ctx.strokeStyle = "rgba(200, 180, 150, 0.08)";
  ctx.lineWidth = 18;
  ctx.arc(centerX, centerY, (asteroidBeltInner + asteroidBeltOuter) / 2, 0, Math.PI * 2);
  ctx.stroke();

  asteroids.forEach((asteroid) => {
    const angle = asteroid.baseAngle + (days / asteroid.orbitalPeriod) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * asteroid.orbitRadius;
    const y = centerY + Math.sin(angle) * asteroid.orbitRadius;

    if (asteroidImg.complete && asteroidImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(
        asteroidImg,
        -asteroid.size / 2,
        -asteroid.size / 2,
        asteroid.size,
        asteroid.size
      );
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.fillStyle = "#9a8f80";
      ctx.arc(x, y, asteroid.size / 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function getPlanetDrawData(name, simDate, scale) {
  const et = spice.time.dateToEt(simDate);
  const state = spice.getBodyHeliocentricState(name, et).state;
  const info = spice.getBodyInfo(name);

  return {
    name,
    info,
    xKm: state.position.x,
    yKm: state.position.y,
    zKm: state.position.z,
    x: state.position.x * scale,
    y: state.position.y * scale
  };
}

function getPlanetRadius(name) {
  if (name === "JUPITER") return 26;
  if (name === "SATURN") return 24;
  if (name === "URANUS" || name === "NEPTUNE") return 18;
  if (name === "VENUS" || name === "EARTH") return 16;
  if (name === "MARS") return 14;
  return 12;
}

function getDistanceFromEarth(name, simDate) {
  const et = spice.time.dateToEt(simDate);
  const earthState = spice.getBodyHeliocentricState("EARTH", et).state.position;
  const otherState = spice.getBodyHeliocentricState(name, et).state.position;

  const dx = otherState.x - earthState.x;
  const dy = otherState.y - earthState.y;
  const dz = otherState.z - earthState.z;

  return Math.hypot(dx, dy, dz);
}

function updatePlanetInfo(name, simDate) {
  const extra = planetExtraData[name];
  const radii = spice.geometry.getRadii(name);
  const distance = getDistanceFromEarth(name, simDate);

  planetNameEl.textContent = extra.displayName;
  planetDistanceEl.textContent = `${formatKm(distance)} (${formatLightYears(distance)})`;
  planetSizeEl.textContent = `Radius: ${Math.round(radii.a).toLocaleString()} km`;
  planetTempEl.textContent = extra.temp;
  planetElementsEl.textContent = extra.elements;
  planetImage.src = `assets/${name.toLowerCase()}.png`;
  planetImage.alt = extra.displayName;
}

function drawSelectedPlanetView(simDate, width, height) {
  const centerX = width / 2;
  const centerY = height / 2 - 70;
  const name = selectedPlanet;
  const info = spice.getBodyInfo(name);
  const radius = Math.min(width, height) * 0.14;

  const img = planetImages[name];

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.arc(centerX, centerY, radius + 12, 0, Math.PI * 2);
  ctx.stroke();

  if (img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.fillStyle = info.color || "white";
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(planetExtraData[name].displayName, centerX, centerY - radius - 28);
  ctx.textAlign = "start";

  updatePlanetInfo(name, simDate);
  planetInfo.classList.remove("hidden");
  backBtn.classList.remove("hidden");
  legend.classList.add("hidden");
}

function drawOverview(simDate, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;

  const neptuneEt = spice.time.dateToEt(simDate);
  const neptuneState = spice.getBodyHeliocentricState("NEPTUNE", neptuneEt).state.position.norm();
  const maxVisualRadius = Math.min(width, height) * 0.36;
  const scale = maxVisualRadius / neptuneState;

  clickablePlanets = [];

  planetNames.forEach((name) => {
    const info = spice.getBodyInfo(name);
    const orbitRadiusPx = info.a * AU_KM * scale;

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.arc(centerX, centerY, orbitRadiusPx, 0, Math.PI * 2);
    ctx.stroke();
  });

  drawAsteroidBelt(simDate, centerX, centerY);

  const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 40);
  glow.addColorStop(0, "rgba(255, 220, 120, 1)");
  glow.addColorStop(0.45, "rgba(255, 180, 70, 0.85)");
  glow.addColorStop(1, "rgba(255, 150, 50, 0)");

  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#ffb347";
  ctx.arc(centerX, centerY, 16, 0, Math.PI * 2);
  ctx.fill();

  planetNames.forEach((name) => {
    const planet = getPlanetDrawData(name, simDate, scale);
    const px = centerX + planet.x;
    const py = centerY + planet.y;
    const radius = getPlanetRadius(name);
    const img = planetImages[name];

    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, px - radius, py - radius, radius * 2, radius * 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.fillStyle = planet.info.color || "white";
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    clickablePlanets.push({
      name,
      x: px,
      y: py,
      radius: radius + 8
    });
  });

  planetInfo.classList.add("hidden");
  backBtn.classList.add("hidden");
  legend.classList.remove("hidden");
}

function drawSolarSystem(simDate) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);
  drawBackgroundStars(width, height);

  if (selectedPlanet) {
    drawSelectedPlanetView(simDate, width, height);
  } else {
    drawOverview(simDate, width, height);
  }
}

function updateUI(simDate) {
  simTimeDisplay.textContent = simDate.toLocaleString();
  modeDisplay.textContent = usingRealTime
    ? "Real Time"
    : "Custom Time (continues running from chosen date/time)";
}

function animate() {
  const simDate = getCurrentSimTime();
  drawSolarSystem(simDate);
  updateUI(simDate);
  requestAnimationFrame(animate);
}

canvas.addEventListener("click", (event) => {
  if (selectedPlanet) return;

  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  for (const planet of clickablePlanets) {
    const dx = mouseX - planet.x;
    const dy = mouseY - planet.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= planet.radius) {
      selectedPlanet = planet.name;
      break;
    }
  }
});

backBtn.addEventListener("click", () => {
  selectedPlanet = null;
});

nowBtn.addEventListener("click", () => {
  usingRealTime = true;
  customTimeInput.value = formatDateForInput(new Date());
});

applyTimeBtn.addEventListener("click", () => {
  if (!customTimeInput.value) return;

  usingRealTime = false;
  baseSimTime = new Date(customTimeInput.value);
  realTimestampAtBase = Date.now();
});

window.addEventListener("resize", resizeCanvas);

customTimeInput.value = formatDateForInput(new Date());
createAsteroids();
resizeCanvas();
animate();
