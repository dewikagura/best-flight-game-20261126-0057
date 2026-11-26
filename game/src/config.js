// Cendrawasih Airlift — tuning constants and level curve.
// One place for every number the physics, the world and the missions use,
// so a balance change is a one-line edit here, never a hunt through code.
'use strict';

const CONFIG = {
  // Canvas the game draws on (the page scales it to the window).
  viewWidth: 1280,
  viewHeight: 800,

  // The sea sits at this y in world space; ground height is measured up from it.
  seaLevel: 620,

  // Plane physics (units: pixels, seconds; speed shown to the player in km/h).
  gravity: 96,
  liftPerSpeed: 0.62,
  drag: 0.16,
  minFlySpeed: 150,
  maxSpeed: 460,
  throttleAccel: 230,
  pitchRate: 2.4,
  stallSink: 150,
  climbPenalty: 0.55,

  // Fuel: units per second at full throttle, scaled by throttle setting.
  fuelCapacity: 100,
  fuelBurnFull: 6.5,
  fuelBurnIdle: 0.9,
  fuelPerMission: 42,
  fuelPerLanding: 26,

  // Damage: one bad hit is survivable, two in a row usually are not.
  damageTerrainHit: 34,
  damageHardLanding: 22,
  damageMax: 100,

  // Rings: radius shrinks a little every level, and so does the fuel margin.
  ringBaseRadius: 54,
  ringShrinkPerLevel: 2.5,
  ringMinRadius: 38,
  ringsPerRun: 6,

  // Wind: gusts push the plane sideways and rock its nose.
  windBase: 14,
  windPerLevel: 7,
  gustStrength: 26,

  // Landing: touchdown is safe only inside these limits.
  landMaxSink: 130,
  landMaxSpeed: 330,
  landMaxPitch: 0.45,

  // Scoring.
  scoreRing: 100,
  scoreRingCentre: 50,
  scoreCargoHit: 300,
  scoreCargoNear: 100,
  scoreLanding: 400,
  scoreLandingSoft: 200,
  scoreMissionTime: 5,
  // Combo: three clean rings in a row doubles the next reward, six triples it.
  comboDoubleAt: 3,
  comboTripleAt: 6,

  // World: how long one archipelago leg is, and how the islands are spaced.
  worldLength: 26000,
  islandGapMin: 1500,
  islandGapMax: 2600,
  stripLength: 420,
};

// Level curve: each level tightens the screws a little.
function levelTuning(level) {
  const n = Math.max(0, level - 1);
  return {
    wind: CONFIG.windBase + n * CONFIG.windPerLevel,
    ringRadius: Math.max(
      CONFIG.ringMinRadius,
      CONFIG.ringBaseRadius - n * CONFIG.ringShrinkPerLevel
    ),
    fuelStart: Math.max(62, CONFIG.fuelCapacity - n * 6),
    gust: CONFIG.gustStrength + n * 4,
  };
}
