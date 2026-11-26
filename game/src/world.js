// Cendrawasih Airlift — the archipelago: terrain, islands, airstrips,
// ring gates, clouds and boats. Built once per level from a seed, so the
// same level always looks the same.
'use strict';

const ISLAND_KINDS = ['volcano', 'terraces', 'palm', 'village'];

// Island names the pilot sees on the strip signs — real Indonesian flavour,
// invented strips only.
const ISLAND_NAMES = [
  'Pulau Merapi', 'Pulau Sawah', 'Pulau Kelapa', 'Pulau Ombak',
  'Pulau Senja', 'Pulau Garuda', 'Pulau Nusa', 'Pulau Bambu',
];

// Build one level's world: a strip of sea with islands every 1.5–2.6 km.
function buildWorld(level, seed) {
  const rng = makeRng(seed + level * 7919);
  const tuning = levelTuning(level);
  const islands = [];
  let x = 900;
  let stripIndex = 0;
  let islandIndex = 0;
  while (x < CONFIG.worldLength - 1200) {
    const kind = pick(rng, ISLAND_KINDS);
    const width = range(rng, 1100, 1900);
    const height = range(rng, 120, 300);
    // The first three islands always have strips: home base, the landing
    // shot's target and the cargo drop's target. Later ones are luck.
    const hasStrip = stripIndex < 4 && (islandIndex < 3 || rng() < 0.72);
    const island = {
      x: x,
      width: width,
      height: height,
      kind: kind,
      name: ISLAND_NAMES[stripIndex % ISLAND_NAMES.length],
      seed: rangeInt(rng, 1, 99999),
      strip: null,
    };
    if (hasStrip) {
      island.strip = {
        x: x + width * 0.5 - CONFIG.stripLength / 2,
        y: CONFIG.seaLevel - height * 0.55,
        length: CONFIG.stripLength,
        name: island.name,
      };
      stripIndex += 1;
    }
    islands.push(island);
    x += width + range(rng, CONFIG.islandGapMin, CONFIG.islandGapMax);
    islandIndex += 1;
  }

  // Ring gates: a chain across the sky, one per gap between islands.
  const rings = [];
  const ringRadius = tuning.ringRadius;
  for (let i = 0; i < CONFIG.ringsPerRun; i += 1) {
    const rx = 1800 + i * ((CONFIG.worldLength - 3600) / CONFIG.ringsPerRun);    rings.push({
      x: rx,
      y: CONFIG.seaLevel - range(rng, 260, 470),
      radius: ringRadius,
      passed: false,
      index: i,
    });
  }

  // Clouds drift slowly; boats bob on the sea.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: range(rng, 0, CONFIG.worldLength),
      y: range(rng, 40, 260),
      scale: range(rng, 0.6, 1.8),
      speed: range(rng, 4, 12),
    });
  }
  const boats = [];
  for (let i = 0; i < 10; i += 1) {
    boats.push({
      x: range(rng, 400, CONFIG.worldLength - 400),
      bob: range(rng, 0, Math.PI * 2),
      speed: range(rng, 6, 16),
    });
  }

  return {
    level: level,
    seed: seed,
    islands: islands,
    rings: rings,
    clouds: clouds,
    boats: boats,
    length: CONFIG.worldLength,
    wind: tuning.wind,
    gust: tuning.gust,
  };
}

// Ground height at world x: sea level minus island humps. Returns y in
// world space (larger y is lower on screen).
function terrainHeightAt(world, x) {
  let ground = CONFIG.seaLevel;
  for (const island of world.islands) {
    if (x >= island.x - 60 && x <= island.x + island.width + 60) {
      const t = (x - island.x) / island.width;
      const hump = Math.sin(t * Math.PI);
      const hill = smoothNoise(x * 0.004, island.seed) * 0.5 + 0.5;
      const top = CONFIG.seaLevel - island.height * (0.55 + 0.45 * hump * hill);
      if (island.strip && x >= island.strip.x - 40 && x <= island.strip.x + island.strip.length + 40) {
        ground = Math.min(ground, island.strip.y);
      } else {
        ground = Math.min(ground, top);
      }
    }
  }
  return ground;
}

// The airstrip under world x, if the plane is over one.
function stripAt(world, x) {
  for (const island of world.islands) {
    if (island.strip && x >= island.strip.x && x <= island.strip.x + island.strip.length) {
      return island.strip;
    }
  }
  return null;
}

// Is world x above open sea (no island under it)?
function overSea(world, x) {
  return terrainHeightAt(world, x) >= CONFIG.seaLevel - 1;
}

// The next ring the pilot still has to fly through.
function nextRing(world) {
  for (const ring of world.rings) {
    if (!ring.passed) return ring;
  }
  return null;
}
