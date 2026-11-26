// Cendrawasih Airlift — missions: ring runs, cargo drops and island
// landings, plus scoring, combos and the level ladder. One mission at a
// time; finishing one starts the next, harder than the last.
'use strict';

const MISSION_KINDS = ['rings', 'cargo', 'landing'];

function missionTitle(kind) {
  if (kind === 'rings') return 'RING RUN — fly through all 6 rings';
  if (kind === 'cargo') return 'CARGO DROP — drop the crate on the target';
  return 'ISLAND LANDING — put her down gently on the strip';
}

// Fresh mission set for a level: rings, then cargo, then landing.
function newMissions(level) {
  return {
    level: level,
    kindIndex: 0,
    kind: MISSION_KINDS[0],
    ringsHit: 0,
    combo: 0,
    score: 0,
    missionScore: 0,
    timeLeft: 150,
    elapsed: 0,
    banner: '',
    bannerUntil: 0,
    crate: null, // { x, y, vy } once dropped
    target: null, // { x, y, radius } for the cargo drop
    done: false,
  };
}

// Start the next mission in the rotation, placing its target in the world.
function startMission(missions, world, plane) {
  const kind = MISSION_KINDS[missions.kindIndex % MISSION_KINDS.length];
  missions.kind = kind;
  missions.ringsHit = 0;
  missions.missionScore = 0;
  missions.timeLeft = 150;
  missions.elapsed = 0;
  missions.crate = null;
  missions.banner = missionTitle(kind);
  missions.bannerUntil = 4;
  if (kind === 'cargo') {
    const strip = world.islands[2] && world.islands[2].strip
      ? world.islands[2].strip
      : { x: 9000, y: CONFIG.seaLevel - 80 };
    missions.target = {
      x: strip.x + strip.length / 2,
      y: strip.y,
      radius: 90,
      name: strip.name,
    };
  } else {
    missions.target = null;
  }
  return missions;
}

// Combo multiplier from the current clean streak.
function comboMultiplier(combo) {
  if (combo >= CONFIG.comboTripleAt) return 3;
  if (combo >= CONFIG.comboDoubleAt) return 2;
  return 1;
}

// Add points, honouring the combo. Returns the points actually added.
function award(missions, base) {
  const pts = base * comboMultiplier(missions.combo);
  missions.score += pts;
  missions.missionScore += pts;
  return pts;
}

// One mission step: rings, cargo crate, landing checks, the clock.
function stepMissions(missions, world, plane, dt, now) {
  missions.elapsed += dt;
  missions.timeLeft = Math.max(0, missions.timeLeft - dt);
  if (missions.bannerUntil > 0) missions.bannerUntil -= dt;

  if (missions.kind === 'rings') {
    const ring = nextRing(world);
    if (ring) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ring.radius && plane.speed > 60) {
        ring.passed = true;
        missions.ringsHit += 1;
        missions.combo += 1;
        const centre = dist < ring.radius * 0.45;
        const pts = award(missions, CONFIG.scoreRing + (centre ? CONFIG.scoreRingCentre : 0));
        missions.banner = centre
          ? 'RING ' + missions.ringsHit + '/6 — DEAD CENTRE! +' + pts
          : 'RING ' + missions.ringsHit + '/6 — +' + pts;
        missions.bannerUntil = 2.2;
        if (missions.ringsHit >= CONFIG.ringsPerRun) {
          return finishMission(missions, plane);
        }
      }
    }
  }

  if (missions.kind === 'cargo' && missions.target) {
    if (missions.crate) {
      const crate = missions.crate;
      crate.vy = Math.min(260, crate.vy + 300 * dt);
      crate.y += crate.vy * dt;
      crate.x += plane.vx * 0.12 * dt;
      const ground = terrainHeightAt(world, crate.x);
      if (crate.y >= ground - 6) {
        const dx = Math.abs(crate.x - missions.target.x);
        if (dx < missions.target.radius * 0.5) {
          missions.combo += 1;
          const pts = award(missions, CONFIG.scoreCargoHit);
          missions.banner = 'CARGO ON TARGET! +' + pts;
        } else if (dx < missions.target.radius * 1.6) {
          missions.combo += 1;
          const pts = award(missions, CONFIG.scoreCargoNear);
          missions.banner = 'CARGO CLOSE — +' + pts;
        } else {
          missions.banner = 'CRATE LOST IN THE SEA — no points';
          missions.combo = 0;
        }
        missions.bannerUntil = 2.5;
        missions.crate = null;
        return finishMission(missions, plane);
      }
    }
  }

  if (missions.kind === 'landing') {
    const strip = stripAt(world, plane.x);
    if (strip && plane.onGround) {
      const sink = Math.abs(plane.impactVy || 0);
      const sinkOk = sink <= CONFIG.landMaxSink;
      const speedOk = plane.speed <= CONFIG.landMaxSpeed;
      const pitchOk = Math.abs(plane.pitch) <= CONFIG.landMaxPitch;
      if (sinkOk && speedOk && pitchOk) {
        const soft = sink < 60 && plane.speed < 220;
        const pts = award(missions, CONFIG.scoreLanding + (soft ? CONFIG.scoreLandingSoft : 0));
        missions.banner = soft ? 'BUTTER-SMOOTH LANDING! +' + pts
          : 'LANDED — +' + pts;
        missions.bannerUntil = 2.5;
        plane.fuel = Math.min(CONFIG.fuelCapacity, plane.fuel + CONFIG.fuelPerLanding);
        return finishMission(missions, plane);
      }
      // A bad touchdown on the strip still counts as a landing attempt:
      // the airframe takes the hit once per touchdown, then the mission
      // carries on. The cooldown stops one rough landing charging twice.
      if (missions.elapsed - (missions.lastHardHit || -99) > 2) {
        missions.lastHardHit = missions.elapsed;
        plane.damage = Math.min(CONFIG.damageMax, plane.damage + CONFIG.damageHardLanding);
        plane.y = strip.y - 16;
        plane.vy = 0;
        plane.speed *= 0.4;
        missions.banner = 'HARD LANDING! Airframe -' + CONFIG.damageHardLanding;
        missions.bannerUntil = 2;
        missions.combo = 0;
      }
    }
  }

  return null;
}

// Drop the cargo crate from the plane (cargo missions only).
function dropCrate(missions, plane) {
  if (missions.kind !== 'cargo' || missions.crate) return false;
  missions.crate = { x: plane.x, y: plane.y + 14, vy: 0 };
  return true;
}

// A mission is done: time bonus, fuel top-up, and the next one starts.
function finishMission(missions, plane) {
  const timeBonus = Math.round(missions.timeLeft) * CONFIG.scoreMissionTime;
  missions.score += timeBonus;
  missions.missionScore += timeBonus;
  plane.fuel = Math.min(CONFIG.fuelCapacity, plane.fuel + CONFIG.fuelPerMission);
  missions.kindIndex += 1;
  missions.done = true;
  return {
    kind: missions.kind,
    score: missions.missionScore,
    timeBonus: timeBonus,
  };
}

// Advance to the next mission after the banner has been read.
function nextMission(missions, world, plane) {
  missions.done = false;
  return startMission(missions, world, plane);
}
