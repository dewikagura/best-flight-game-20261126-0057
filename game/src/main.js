// Cendrawasih Airlift — the game itself: state machine, the main loop,
// crashes, level-ups and the deterministic screenshot states (?shot=...).
// Everything the other files build comes together here.
'use strict';

const GAME_VERSION = '1.0.0';
const MAX_LEVEL = 3;
const SHOT_SEED = 20261126;

// Screenshot states: cover | rings | landing | storm
function shotState() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot') || null;
}

function newGame() {
  return {
    state: 'menu', // menu | flying | paused | crashed | over
    level: 1,
    world: null,
    plane: null,
    missions: null,
    audio: newAudio(),
    input: newInput(),
    windNow: 0,
    gustPhase: 0,
    time: 0,
    score: 0,
    bestScore: 0,
    crashReason: '',
    shot: shotState(),
    missionDoneAt: 0,
  };
}

function startLevel(game, level) {
  const seed = SHOT_SEED + level * 104729;
  game.level = level;
  game.world = buildWorld(level, seed);
  game.plane = newPlane(game.world, level);
  game.missions = newMissions(level);
  startMission(game.missions, game.world, game.plane);
  game.windNow = game.world.wind;
  game.state = 'flying';
}

// Put the plane into a screenshot state: a fixed, readable moment that
// shows the game at its best. No randomness, no waiting for the player.
function applyShot(game, shot) {
  if (shot === 'cover') {
    // Mid-flight over the first island chain, the next ring dead ahead,
    // one centre ring already banked — the whole game in one frame.
    game.missions.ringsHit = 1;
    game.missions.combo = 1;
    game.world.rings[0].passed = true;
    const ring = nextRing(game.world);
    if (ring) {
      game.plane.x = ring.x - 700;
      game.plane.y = ring.y + 90;
    }
    game.plane.speed = 320;
    game.plane.throttle = 0.72;
    game.plane.pitch = -0.05;
    game.plane.fuel = 78;
    game.missions.score = 150;
    game.missions.timeLeft = 132;
  }
  if (shot === 'rings') {
    // Lined up on the next ring, throttle up, sun low behind the plane.
    game.missions.ringsHit = 3;
    game.missions.combo = 3;
    for (let i = 0; i < 3; i += 1) game.world.rings[i].passed = true;
    const ring = nextRing(game.world);
    if (ring) {
      game.plane.x = ring.x - 620;
      game.plane.y = ring.y + 30;
    }
    game.plane.speed = 380;
    game.plane.throttle = 0.9;
    // A touch of nose-down holds her level against the lift at this speed,
    // so the shot catches her dead on the ring's line.
    game.plane.pitch = 0.08;
    game.plane.fuel = 64;
    game.missions.score = 520;
    game.missions.timeLeft = 96;
  }
  if (shot === 'landing') {
    // On final approach, gear down over the strip, flare just begun.
    const strip = game.world.islands[1] && game.world.islands[1].strip
      ? game.world.islands[1].strip
      : game.world.islands[0].strip;
    if (strip) {
      game.plane.x = strip.x - 480;
      game.plane.y = strip.y - 150;
    }
    game.plane.speed = 210;
    game.plane.throttle = 0.28;
    game.plane.pitch = -0.08;
    game.plane.fuel = 41;
    game.missions.kindIndex = 2;
    game.missions.kind = 'landing';
    game.missions.banner = 'ISLAND LANDING — put her down gently on the strip';
    game.missions.bannerUntil = 999;
    game.missions.score = 2400;
    game.missions.ringsHit = 6;
    for (let i = 0; i < game.world.rings.length; i += 1) game.world.rings[i].passed = true;
    game.missions.timeLeft = 74;
  }
  if (shot === 'storm') {
    // Heavy weather: rain, grey sky, the plane fighting a gust.
    game.plane.x = 5200;
    game.plane.y = 300;
    game.plane.speed = 350;
    game.plane.throttle = 0.85;
    game.plane.pitch = -0.12;
    game.plane.fuel = 55;
    game.windNow = 48;
    game.missions.score = 900;
    game.missions.ringsHit = 4;
    game.missions.combo = 2;
    for (let i = 0; i < 4; i += 1) game.world.rings[i].passed = true;
    game.missions.timeLeft = 58;
  }
}

// One frame of the game.
function stepGame(game, dt) {
  game.time += dt;
  const input = game.input;

  // Mute is global and instant.
  if (input.muteQueued) {
    input.muteQueued = false;
    toggleMute(game.audio);
  }

  if (game.state === 'menu') {
    if (input.startQueued || input.pointerDown) {
      input.startQueued = false;
      ensureAudio(game.audio);
      startLevel(game, 1);
      if (game.shot) applyShot(game, game.shot);
    }
    return;
  }

  if (game.state === 'paused') {
    if (input.pauseQueued || input.startQueued || input.pointerDown) {
      input.pauseQueued = false;
      input.startQueued = false;
      game.state = 'flying';
    }
    if (input.restartQueued) {
      input.restartQueued = false;
      startLevel(game, 1);
      if (game.shot) applyShot(game, game.shot);
    }
    return;
  }

  if (game.state === 'crashed' || game.state === 'over') {
    if (input.restartQueued || input.startQueued || input.pointerDown) {
      input.restartQueued = false;
      input.startQueued = false;
      startLevel(game, 1);
      if (game.shot) applyShot(game, game.shot);
    }
    return;
  }

  // Flying.
  if (input.pauseQueued) {
    input.pauseQueued = false;
    game.state = 'paused';
    return;
  }

  // Wind: a steady blow plus slow gusts that come and go.
  game.gustPhase += dt;
  const gust = Math.sin(game.gustPhase * 0.6) * game.world.gust;
  game.windNow = game.world.wind + gust;

  // A mission that just finished waits for its banner to be read, then the
  // next one starts — or the next level, if the ladder is done.
  if (game.missions.done && game.time - game.missionDoneAt > 2.4) {
    if (game.missions.kindIndex >= MISSION_KINDS.length) {
      if (game.level >= MAX_LEVEL) {
        game.state = 'over';
        game.bestScore = Math.max(game.bestScore, game.missions.score);
        return;
      }
      missionFanfare(game.audio);
      startLevel(game, game.level + 1);
      if (game.shot) applyShot(game, game.shot);
      return;
    }
    nextMission(game.missions, game.world, game.plane);
  }

  if (input.dropQueued) {
    input.dropQueued = false;
    if (dropCrate(game.missions, game.plane)) cargoThud(game.audio);
  }

  const ringsBefore = game.missions.ringsHit;
  const wasAirborne = !game.plane.onGround;
  stepPlane(game.plane, input, dt, game.world, game.windNow);
  const finished = stepMissions(game.missions, game.world, game.plane, dt, game.time);
  if (finished) {
    game.missionDoneAt = game.time;
    missionFanfare(game.audio);
  }
  if (game.missions.ringsHit > ringsBefore) ringChime(game.audio);
  updateEngineSound(game.audio, game.plane);

  // Crash checks, in order of how they kill a pilot.
  const plane = game.plane;
  if (plane.fuel <= 0 && plane.onGround) {
    // Dead-stick onto a strip is a fuel stop, not a crash: the ground crew
    // hands over 25 units and the clock keeps running.
    if (stripAt(game.world, plane.x)) {
      plane.fuel = 25;
      game.missions.banner = 'DEAD-STICK LANDING! Ground crew refuels you (+25)';
      game.missions.bannerUntil = 2.5;
    } else {
      return crash(game, 'Out of fuel on the ground — the courier walks home.');
    }
  }
  // Rolling into the sea is a ditching, even at taxi speed.
  if (plane.onGround && overSea(game.world, plane.x) && !stripAt(game.world, plane.x)) {
    return crash(game, 'Ditched in the sea — the mail got wet.');
  }
  if (plane.damage >= CONFIG.damageMax) {
    return crash(game, 'The airframe gave up — too many hard knocks.');
  }
  // Touchdown: the moment wheels meet ground decides what happens next.
  // A strip is always safe; open sea is a ditching; a hillside is a crash.
  if (wasAirborne && plane.onGround) {
    const strip = stripAt(game.world, plane.x);
    const ground = terrainHeightAt(game.world, plane.x);
    if (!strip && ground >= CONFIG.seaLevel - 1) {
      return crash(game, 'Ditched in the sea — the mail got wet.');
    }
    if (!strip) {
      const hard = Math.abs(plane.impactVy) > 170 || plane.speed > 300;
      plane.damage = Math.min(CONFIG.damageMax, plane.damage + (hard ? 45 : 20));
      if (plane.damage >= CONFIG.damageMax) {
        return crash(game, 'Slammed into the hillside at full speed.');
      }
      plane.speed *= 0.3;
      game.missions.combo = 0;
      crashSound(game.audio);
    }
  }
  if (plane.x > game.world.length) {
    return crash(game, 'You flew off the end of the map — turn back, courier!');
  }
  if (plane.x < 0) {
    plane.x = 0;
    plane.vx = Math.max(0, plane.vx);
  }
  if (plane.y < -220) {
    plane.y = -220;
    plane.vy = Math.max(0, plane.vy);
  }
  // Out of fuel in the air: she glides down, and the ground decides.
  if (plane.fuel <= 0 && !plane.onGround) {
    game.missions.banner = 'OUT OF FUEL — glide her down!';
    game.missions.bannerUntil = 1;
  }
  if (game.missions.timeLeft <= 0) {
    return crash(game, 'The mission clock ran out — the mail is late.');
  }
}

function crash(game, reason) {
  game.state = 'crashed';
  game.crashReason = reason;
  game.bestScore = Math.max(game.bestScore, game.missions.score);
  crashSound(game.audio);
}

// The render loop: fixed steps so physics is the same on every machine.
function runGame(canvas) {
  const ctx = canvas.getContext('2d');
  const game = newGame();
  game.world = buildWorld(1, SHOT_SEED + 104729);
  game.plane = newPlane(game.world, 1);
  game.missions = newMissions(1);
  startMission(game.missions, game.world, game.plane);
  game.windNow = game.world.wind;
  attachInput(canvas, game.input);

  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      stepGame(game, STEP);
      acc -= STEP;
    }
    drawFrame(ctx, {
      plane: game.plane,
      world: game.world,
      missions: game.missions,
      state: game.state,
      windNow: game.windNow,
      time: game.time,
      shot: game.shot,
      bestScore: game.bestScore,
      crashReason: game.crashReason,
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return game;
}

// Boot: the page is ready, the canvas is sized, the game starts.
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  window.__airlift = runGame(canvas);
});
