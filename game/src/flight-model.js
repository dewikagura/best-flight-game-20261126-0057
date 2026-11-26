// flight-model.js — the bush plane's flight model: lift, drag, thrust, stall,
// wind and gusts, ground effect, takeoffs, landings and crashes.
// World units are metres; speeds are m/s. Display conversion (knots, feet)
// lives in cockpit.js. Nothing here touches the network or the DOM.
var CA = window.CA || (window.CA = {});

CA.FlightModel = (function () {
  var GRAVITY = 9.81;
  var STALL_CLEAN = 38; // m/s, clean wing
  var STALL_FLAPS = 30; // m/s, full flaps
  var MAX_THRUST_ACCEL = 7; // m/s^2 at full throttle (bush plane, not a jet)
  var LIFT_K = 0.0068; // lift accel per (m/s)^2 at unit angle factor
  var DRAG_K = 0.0013;

  // A fresh plane on a runway. x and groundY are metres, heading is +x.
  function createPlane(x, groundY, fuelKg) {
    return {
      x: x, y: groundY, vx: 0, vy: 0,
      pitch: 0, // radians, nose up positive
      throttle: 0, flaps: 0, gearDown: true,
      fuel: fuelKg, damage: 0, cargoHealth: 100,
      rpm: 0, stalled: false, onGround: true,
      airborne: false, maxG: 1, gLoad: 1,
      landed: false, crashed: false, crashCause: '',
      touchdownVs: 0, touchdownSpeed: 0, airTime: 0,
      smoothScore: 100
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Deterministic gust field: same mission, same time -> same wind.
  function gustAt(t, seed) {
    var a = Math.sin(t * 0.9 + seed * 1.7);
    var b = Math.sin(t * 2.3 + seed * 3.1) * 0.5;
    var c = Math.sin(t * 0.37 + seed * 0.6) * 0.7;
    return (a + b + c) / 2.2;
  }

  // One fixed step. input: {pitchUp, pitchDown, throttleUp, throttleDown,
  // flaps, gear, brake}. wind: {base, gust, seed}. groundY(x) gives terrain.
  function step(p, input, wind, dt, groundY, t, opts) {
    opts = opts || {};
    var speed = Math.hypot(p.vx, p.vy);
    var flying = !p.onGround;

    // --- throttle ---
    if (input.throttleUp) p.throttle = clamp(p.throttle + dt * 0.7, 0, 1);
    if (input.throttleDown) p.throttle = clamp(p.throttle - dt * 0.9, 0, 1);
    if (p.fuel <= 0) p.throttle = 0;
    p.rpm = lerp(p.rpm, p.throttle, dt * 2);

    // --- pitch authority: weak at low speed, crisp at cruise. The pilot
    // can already pull the nose up on the runway roll for rotation.
    var authority = clamp(speed / 55, 0.25, 1);
    // Mushy controls in a stall: pulling up barely works until the wing
    // flies again. Pushing the nose down always works.
    var stallMush = p.stalled ? 0.4 : 1;
    if (input.pitchUp) p.pitch += dt * 0.85 * authority * (flying ? 1 : 0.7) * stallMush;
    if (input.pitchDown) p.pitch -= dt * 0.95 * authority * (flying ? 1 : 0.7);
    p.pitch = clamp(p.pitch, -0.5, 0.55);

    // --- wind ---
    var windNow = wind.base + wind.gust * gustAt(t, wind.seed);
    var relVx = p.vx - windNow; // airspeed along x
    var airspeed = Math.hypot(relVx, p.vy);

    // --- forces ---
    var flapLift = 1 + p.flaps * 0.22;
    var flapDrag = 1 + p.flaps * 0.4 + (p.gearDown && flying ? 0.18 : 0);
    var stallSpeed = p.flaps === 2 ? STALL_FLAPS : (p.flaps === 1 ? 34 : STALL_CLEAN);
    // Flight-path angle and true angle of attack. Lift acts PERPENDICULAR
    // to the relative airflow, never straight up: as the plane climbs, the
    // flight-path angle eats the angle of attack, lift falls, and the climb
    // settles instead of running away. (A lift vector fixed to the body
    // axis explodes: vy feeds airspeed feeds lift feeds vy, until NaN.)
    var phi = Math.atan2(p.vy, relVx);
    var aoa = p.pitch - phi;
    var aoaFactor = clamp(0.3 + aoa * 2.0, 0.0, 1.35);
    p.stalled = flying && (airspeed < stallSpeed || Math.abs(aoa) > 0.5);
    var liftFactor = p.stalled ? 0.32 : 1;
    var lift = LIFT_K * airspeed * airspeed * flapLift * aoaFactor * liftFactor;
    var liftX = -lift * Math.sin(phi);
    var liftY = lift * Math.cos(phi);
    var drag = DRAG_K * airspeed * airspeed * flapDrag;
    var dragX = speed > 0.01 ? -drag * (p.vx / speed) : 0;
    var dragY = speed > 0.01 ? -drag * (p.vy / speed) : 0;
    var thrust = p.throttle * MAX_THRUST_ACCEL;
    var thrustX = thrust * Math.cos(p.pitch);
    var thrustY = thrust * Math.sin(p.pitch);

    // Ground effect: a cushion of extra lift close to the runway.
    var heightAgl = p.y - groundY(p.x);
    if (flying && heightAgl < 14 && p.vy < 0) liftY *= 1.18;

    var ax = thrustX + dragX + liftX;
    var ay = thrustY + dragY + liftY - GRAVITY;

    // Stall: the nose drops by itself and the controls go mushy.
    if (p.stalled) {
      p.pitch -= dt * 0.55;
      ax *= 0.6;
    }

    // --- integrate ---
    p.vx += ax * dt;
    p.vy += ay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // G load tracking (cargo cares about hard manoeuvres).
    var gNow = 1 + Math.abs(ay) / GRAVITY;
    p.gLoad = gNow;
    if (gNow > p.maxG) p.maxG = gNow;
    if (gNow > 2.2) {
      var over = (gNow - 2.2) * dt * 6;
      p.cargoHealth = Math.max(0, p.cargoHealth - over);
      p.smoothScore = Math.max(0, p.smoothScore - over * 0.8);
    }

    // --- fuel ---
    if (p.throttle > 0 && p.fuel > 0) {
      p.fuel = Math.max(0, p.fuel - (0.22 + p.throttle * 0.85) * dt);
    }

    // --- ground contact ---
    var ground = groundY(p.x);
    if (p.y <= ground) {
      var impactVs = -p.vy;
      p.y = ground;
      if (!p.onGround) {
        // Touchdown moment.
        p.touchdownVs = impactVs;
        p.touchdownSpeed = speed;
        if (p.gearDown && impactVs < 6.5 && Math.abs(p.pitch) < 0.22 && speed > 25) {
          p.landed = true;
          p.onGround = true;
          p.vy = 0;
          if (impactVs > 3.5) {
            p.damage += (impactVs - 3.5) * 4;
            p.cargoHealth = Math.max(0, p.cargoHealth - (impactVs - 3.5) * 6);
          }
        } else {
          p.crashed = true;
          p.crashCause = !p.gearDown ? 'gear-up landing' :
            (impactVs >= 6.5 ? 'hard impact' : 'bad attitude');
          p.vy = 0;
        }
      } else {
        p.vy = 0;
        p.y = ground;
      }
      if (p.onGround) {
        // Rolling: brakes and drag slow the plane; throttle still pushes.
        var rollDrag = input.brake ? 9 : 1.2;
        p.vx -= p.vx * Math.min(1, rollDrag * dt * 0.12);
        if (p.throttle > 0.25) p.vx += p.throttle * MAX_THRUST_ACCEL * dt * 0.55;
        // Rotate: enough lift and speed lifts the wheels off.
        var liftOff = LIFT_K * speed * speed * flapLift * clamp(0.3 + p.pitch * 2.0, 0, 1.35);
        if (speed > stallSpeed * 0.92 && liftOff > GRAVITY * 0.95 && p.pitch > 0.05) {
          p.onGround = false;
          p.airborne = true;
          p.y += 0.5;
        }
      }
    } else if (p.onGround && p.y > ground + 0.6) {
      p.onGround = false;
      p.airborne = true;
    }

    if (p.airborne) p.airTime += dt;
    if (p.y < -50) { p.crashed = true; p.crashCause = 'lost in the sea'; }
    return p;
  }

  return { createPlane: createPlane, step: step, gustAt: gustAt, clamp: clamp, lerp: lerp };
})();
