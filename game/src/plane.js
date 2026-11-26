// Cendrawasih Airlift — the aircraft: state and flight physics.
// A little bush plane with honest flying: speed makes lift, lift fights
// gravity, too slow and she stalls, too fast and the airframe complains.
'use strict';

// Fresh plane on the first strip, engine warm, tanks as the level allows.
function newPlane(world, level) {
  const tuning = levelTuning(level);
  const firstStrip = world.islands[0] && world.islands[0].strip
    ? world.islands[0].strip
    : { x: 600, y: CONFIG.seaLevel - 60 };
  return {
    x: firstStrip.x + 60,
    y: firstStrip.y - 26,
    vx: 0,
    vy: 0,
    pitch: 0, // radians, negative = nose up (screen y grows downward)
    throttle: 0.55,
    speed: 0, // pixels per second along the flight path
    fuel: tuning.fuelStart,
    damage: 0,
    onGround: true,
    stalled: false,
    impactVy: 0,
    bank: 0,
    trail: [],
  };
}

// One physics step. input: { pitchUp, pitchDown, throttleUp, throttleDown,
// steerX, steerY } where steer is a pointer target in screen space.
function stepPlane(plane, input, dt, world, windNow) {
  // Throttle: keys nudge it, pointer drag sets it from the pointer height.
  if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + dt * 0.9);
  if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - dt * 0.9);
  if (typeof input.throttleSet === 'number') plane.throttle = input.throttleSet;

  // Pitch: keys rotate the nose, pointer drag points the nose at the pointer.
  if (input.pitchUp) plane.pitch -= CONFIG.pitchRate * dt;
  if (input.pitchDown) plane.pitch += CONFIG.pitchRate * dt;
  if (typeof input.pitchSet === 'number') {
    const want = Math.max(-1.1, Math.min(1.1, input.pitchSet));
    plane.pitch += (want - plane.pitch) * Math.min(1, dt * 5);
  }
  plane.pitch = Math.max(-1.2, Math.min(1.2, plane.pitch));

  // Wind rocks the nose a little; a damaged airframe rocks more.
  const wobble = (Math.sin(performance.now() / 480) * 0.02 * windNow / 20)
    * (1 + plane.damage / 60);
  plane.pitch += wobble * dt;

  // Engine: throttle makes speed, speed makes lift, drag bleeds it off.
  const engineOn = plane.fuel > 0;
  const thrust = engineOn ? plane.throttle * CONFIG.throttleAccel : 0;
  plane.speed += thrust * dt;
  plane.speed -= CONFIG.drag * plane.speed * dt;
  // Climbing trades speed for height, diving trades height for speed.
  plane.speed += Math.sin(plane.pitch) * CONFIG.gravity * CONFIG.climbPenalty * dt;
  plane.speed = Math.max(0, Math.min(CONFIG.maxSpeed, plane.speed));

  // Lift: enough speed and the wings hold her up; too slow and she sinks.
  const lift = plane.speed * CONFIG.liftPerSpeed;
  const sink = CONFIG.gravity - lift;
  plane.stalled = plane.speed < CONFIG.minFlySpeed && !plane.onGround;
  plane.vy = Math.sin(plane.pitch) * plane.speed + (plane.stalled ? CONFIG.stallSink : sink) * 0.4;
  plane.vx = Math.cos(plane.pitch) * plane.speed + windNow * 0.4;

  plane.x += plane.vx * dt;
  plane.y += plane.vy * dt;

  // Fuel burns with the throttle; idle sips, full power drinks.
  if (engineOn) {
    const burn = CONFIG.fuelBurnIdle + (CONFIG.fuelBurnFull - CONFIG.fuelBurnIdle) * plane.throttle;
    plane.fuel = Math.max(0, plane.fuel - burn * dt);
  }

  // Ground: the sea is always there, the islands rise out of it.
  // impactVy remembers how hard the wheels hit, for the landing judge.
  const ground = terrainHeightAt(world, plane.x);
  const gearY = plane.y + 16;
  plane.onGround = gearY >= ground - 1 && plane.vy >= -5;
  if (gearY >= ground) {
    plane.impactVy = plane.vy;
    plane.y = ground - 16;
    plane.vy = 0;
  } else {
    plane.impactVy = 0;
  }

  // Bank angle follows the turn for the drawing code.
  const targetBank = Math.max(-0.5, Math.min(0.5, -plane.pitch * 0.4));
  plane.bank += (targetBank - plane.bank) * Math.min(1, dt * 4);

  // Keep a short vapour trail for the renderer.
  plane.trail.push({ x: plane.x, y: plane.y });
  if (plane.trail.length > 26) plane.trail.shift();

  return plane;
}

// Heading in degrees from the velocity: 090 flying east, 270 flying west.
function planeHeading(plane) {
  const deg = (Math.atan2(plane.vy, plane.vx) * 180) / Math.PI;
  return Math.round(((deg + 90) % 360 + 360) % 360);
}

// Speed the pilot sees: pixels per second turned into km/h.
function planeSpeedKmh(plane) {
  return Math.round(plane.speed * 0.9);
}

// Altitude above the sea in metres (10 px = 1 m at this scale).
function planeAltitudeM(plane) {
  return Math.max(0, Math.round((CONFIG.seaLevel - plane.y) / 10));
}
