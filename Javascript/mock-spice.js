"use strict";

const DAY_SECONDS = 86400;
const AU_KM = 149_597_870.7;

class MockVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = Number(x);
    this.y = Number(y);
    this.z = Number(z);
  }

  add(v) {
    return new MockVec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v) {
    return new MockVec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s) {
    return new MockVec3(this.x * s, this.y * s, this.z * s);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  magnitudeSquared() {
    return this.dot(this);
  }

  magnitude() {
    return Math.hypot(this.x, this.y, this.z);
  }

  norm() {
    return this.magnitude();
  }

  unit() {
    const mag = this.magnitude();
    return mag === 0 ? new MockVec3(0, 0, 0) : this.scale(1 / mag);
  }

  toString() {
    return `Vec3(${this.x}, ${this.y}, ${this.z})`;
  }
}

function circularOrbitState(radiusKm, periodSeconds, phase = 0, z = 0) {
  return (et) => {
    const omega = (2 * Math.PI) / periodSeconds;
    const theta = phase + omega * et;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    return {
      position: new MockVec3(radiusKm * cosT, radiusKm * sinT, z),
      velocity: new MockVec3(-radiusKm * omega * sinT, radiusKm * omega * cosT, 0),
    };
  };
}

function bodyCatalog() {
  const earthOrbit = circularOrbitState(AU_KM, 365.25 * DAY_SECONDS, 0.15);
  const moonRelative = circularOrbitState(384_400, 27.321661 * DAY_SECONDS, 1.1, 5_000);
  const marsOrbit = circularOrbitState(227_939_200, 686.98 * DAY_SECONDS, 1.7);
  const mercuryOrbit = circularOrbitState(57_909_050, 87.97 * DAY_SECONDS, 2.1);
  const venusOrbit = circularOrbitState(108_208_000, 224.70 * DAY_SECONDS, 0.8);
  const jupiterOrbit = circularOrbitState(778_340_821, 4332.59 * DAY_SECONDS, 2.7);
  const saturnOrbit = circularOrbitState(1_426_666_422, 10_759.22 * DAY_SECONDS, 0.5, 1_000_000);
  const uranusOrbit = circularOrbitState(2_870_658_186, 30_688.5 * DAY_SECONDS, 1.35, 2_000_000);
  const neptuneOrbit = circularOrbitState(4_498_396_441, 60_182 * DAY_SECONDS, 2.15, 3_000_000);
  const plutoOrbit = circularOrbitState(5_906_376_272, 90_560 * DAY_SECONDS, 2.95, 120_000_000);

  return {
    "SUN": {
      mu: 132_712_440_018,
      radii: [695_700, 695_700, 695_700],
      state: () => ({
        position: new MockVec3(0, 0, 0),
        velocity: new MockVec3(0, 0, 0),
      }),
    },
    "MERCURY BARYCENTER": {
      mu: 22_032,
      radii: [2_439.7, 2_439.7, 2_439.7],
      state: mercuryOrbit,
    },
    "VENUS BARYCENTER": {
      mu: 324_859,
      radii: [6_051.8, 6_051.8, 6_051.8],
      state: venusOrbit,
    },
    "EARTH": {
      mu: 398_600.4418,
      radii: [6_378.137, 6_378.137, 6_356.752],
      state: earthOrbit,
    },
    "MOON": {
      mu: 4_902.800066,
      radii: [1_737.4, 1_737.4, 1_737.4],
      state: (et) => {
        const earth = earthOrbit(et);
        const moon = moonRelative(et);
        return {
          position: earth.position.add(moon.position),
          velocity: earth.velocity.add(moon.velocity),
        };
      },
    },
    "MARS BARYCENTER": {
      mu: 42_828.375816,
      radii: [3_389.5, 3_389.5, 3_376.2],
      state: marsOrbit,
    },
    "JUPITER BARYCENTER": {
      mu: 126_686_534.911,
      radii: [69_911, 69_911, 69_911],
      state: jupiterOrbit,
    },
    "SATURN BARYCENTER": {
      mu: 37_931_187,
      radii: [58_232, 58_232, 54_364],
      state: saturnOrbit,
    },
    "URANUS BARYCENTER": {
      mu: 5_793_939,
      radii: [25_362, 25_362, 24_973],
      state: uranusOrbit,
    },
    "NEPTUNE BARYCENTER": {
      mu: 6_836_529,
      radii: [24_622, 24_622, 24_341],
      state: neptuneOrbit,
    },
    "PLUTO BARYCENTER": {
      mu: 872.4,
      radii: [1_188.3, 1_188.3, 1_188.3],
      state: plutoOrbit,
    },
  };
}

function createMockSpiceEnvironment() {
  const catalog = bodyCatalog();

  function getBodyRecord(bodyName) {
    const record = catalog[bodyName];
    if (!record) {
      throw new Error(`Mock SPICE body not available: ${bodyName}`);
    }
    return record;
  }

  return {
    isMock: true,
    kernels: {
      loadedKernelPaths: [],
      loadKernel(kernelPath) {
        this.loadedKernelPaths.push(kernelPath);
        return kernelPath;
      },
      loadKernels(kernelPaths) {
        return kernelPaths.map((kernelPath) => this.loadKernel(kernelPath));
      },
      clearKernelPool() {
        this.loadedKernelPaths = [];
      },
      listLoadedKernels() {
        return [...this.loadedKernelPaths];
      },
    },
    loadStandardSolarSystemKernels({ lsk, pck, spk, extra = [] } = {}) {
      const kernels = [lsk, pck, spk, ...extra].filter(Boolean);
      return this.kernels.loadKernels(kernels);
    },
    time: {
      utcToEt(utcString) {
        const normalized = String(utcString)
          .trim()
          .replace(/\s+UTC$/i, "Z")
          .replace(" ", "T");
        const value = Date.parse(normalized);
        if (Number.isNaN(value)) {
          throw new Error(`Invalid UTC string for mock SPICE: ${utcString}`);
        }
        return value / 1000;
      },
      etToUtc(et, format = "ISOC", precision = 3) {
        const iso = new Date(et * 1000).toISOString();
        const trimmed = precision >= 0
          ? iso.replace(/\.(\d+)Z$/, (_, frac) => `.${frac.slice(0, precision).padEnd(precision, "0")}Z`)
          : iso;
        return format === "ISOC" ? trimmed.replace("Z", "") : trimmed;
      },
    },
    geometry: {
      getGM(bodyName) {
        return getBodyRecord(bodyName).mu;
      },
      getRadii(bodyName) {
        return [...getBodyRecord(bodyName).radii];
      },
      getState(bodyName, et) {
        const record = getBodyRecord(bodyName);
        const state = record.state(et);
        return {
          state: {
            position: state.position,
            velocity: state.velocity,
          },
        };
      },
      getRotationMatrix() {
        return [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ];
      },
    },
    getBodyBarycentricState(bodyName, et) {
      return this.geometry.getState(bodyName, et);
    },
    getPhysicsBodies(bodyNames, et) {
      return bodyNames.map((bodyName) => {
        const state = this.geometry.getState(bodyName, et).state;
        const record = getBodyRecord(bodyName);
        return {
          name: bodyName,
          mu: record.mu,
          position: state.position,
          velocity: state.velocity,
          radii: [...record.radii],
          refFrame: "J2000",
          observer: "SOLAR SYSTEM BARYCENTER",
        };
      });
    },
  };
}

module.exports = {
  createMockSpiceEnvironment,
};
