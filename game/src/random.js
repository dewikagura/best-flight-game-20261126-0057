// Cendrawasih Airlift — deterministic random numbers.
// The whole archipelago comes from one seed, so the same seed always builds
// the same islands, rings and strips. That keeps the game fair and the
// screenshot states reproducible.
'use strict';

// mulberry32: a small, fast, well-behaved seeded generator.
function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a number in [min, max) from a generator.
function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick an integer in [min, max] from a generator.
function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// Shuffle a copy of an array (Fisher-Yates), leaving the original alone.
function shuffled(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Pick one item from an array.
function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// Smooth noise in [0, 1] from a position and a seed: the terrain's hills.
function smoothNoise(x, seed) {
  const xi = Math.floor(x);
  const xf = x - xi;
  const a = hash1(xi, seed);
  const b = hash1(xi + 1, seed);
  const u = xf * xf * (3 - 2 * xf);
  return a + (b - a) * u;
}

function hash1(n, seed) {
  let h = (n * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
