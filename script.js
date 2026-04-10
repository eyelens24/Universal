const canvas = document.getElementById("solarCanvas");
const ctx = canvas.getContext("2d");

const simTimeDisplay = document.getElementById("simTimeDisplay");
const modeDisplay = document.getElementById("modeDisplay");
const nowBtn = document.getElementById("nowBtn");
const applyTimeBtn = document.getElementById("applyTimeBtn");
const customTimeInput = document.getElementById("customTime");

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

let usingRealTime = true;
let baseSimTime = new Date();
let realTimestampAtBase = Date.now();

const asteroidImg = new Image();
asteroidImg.src = "assets/asteroid.png";

const asteroidBeltInner = 180;
const asteroidBeltOuter = 205;
const asteroidCount = 140;
const asteroids = [];

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

function drawSolarSystem(simDate) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.clearRect(0, 0, width, height);
  drawBackgroundStars(width, height);

  // scale km -> pixels using Neptune distance
  const neptuneEt = spice.time.dateToEt(simDate);
  const neptuneState = spice.getBodyHeliocentricState("NEPTUNE", neptuneEt).state.position.norm();
  const maxVisualRadius = Math.min(width, height) * 0.43;
  const scale = maxVisualRadius / neptuneState;

  // orbit guides
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

  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.fillText("Sun", centerX - 12, centerY - 24);

  planetNames.forEach((name) => {
    const planet = getPlanetDrawData(name, simDate, scale);
    const px = centerX + planet.x;
    const py = centerY + planet.y;

    let radius = 5;
    if (name === "JUPITER") radius = 11;
    if (name === "SATURN") radius = 10;
    if (name === "URANUS" || name === "NEPTUNE") radius = 8;
    if (name === "VENUS" || name === "EARTH") radius = 6;
    if (name === "MARS") radius = 5;
    if (name === "MERCURY") radius = 4;

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
    ctx.fillText(name.charAt(0) + name.slice(1).toLowerCase(), px + 8, py - 8);
  });
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
