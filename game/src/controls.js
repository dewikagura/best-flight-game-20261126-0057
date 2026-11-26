// controls.js — keyboard and mouse input, plus a gentle autopilot used by
// the screenshot mode (and as an optional assist). Keys: arrows/WASD fly,
// F flaps, G gear, B brakes, P pause, M mute, R restart, Esc menu.
var CA = window.CA || (window.CA = {});

CA.Controls = (function () {
  var keys = {};
  var pressed = {}; // edge-triggered, consumed once per frame
  var mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };

  function attach(canvas) {
    window.addEventListener('keydown', function (e) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
      if (!keys[e.key]) pressed[e.key] = true;
      keys[e.key] = true;
      CA.Soundscape.resume();
    });
    window.addEventListener('keyup', function (e) { keys[e.key] = false; });
    canvas.addEventListener('mousedown', function (e) {
      mouse.down = true; mouse.clicked = true;
      mouse.clickX = e.offsetX; mouse.clickY = e.offsetY;
      CA.Soundscape.resume();
    });
    window.addEventListener('mouseup', function () { mouse.down = false; });
    canvas.addEventListener('mousemove', function (e) {
      mouse.x = e.offsetX; mouse.y = e.offsetY;
    });
    canvas.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      var r = canvas.getBoundingClientRect();
      mouse.x = t.clientX - r.left; mouse.y = t.clientY - r.top;
      mouse.clicked = true; mouse.clickX = mouse.x; mouse.clickY = mouse.y;
      CA.Soundscape.resume();
      e.preventDefault();
    }, { passive: false });
  }

  function down(k) { return !!keys[k]; }
  function hit(k) {
    if (pressed[k]) { pressed[k] = false; return true; }
    return false;
  }
  function endFrame() {
    pressed = {};
    mouse.clicked = false;
  }

  // The pilot's intent this frame, from keys.
  function readIntent() {
    return {
      pitchUp: down('ArrowUp') || down('w') || down('W'),
      pitchDown: down('ArrowDown') || down('s') || down('S'),
      throttleUp: down('ArrowRight') || down('d') || down('D'),
      throttleDown: down('ArrowLeft') || down('a') || down('A'),
      brake: down('b') || down('B') || down(' '),
      flapsKey: hit('f') || hit('F'),
      gearKey: hit('g') || hit('G'),
      pauseKey: hit('p') || hit('P') || hit('Escape'),
      muteKey: hit('m') || hit('M'),
      restartKey: hit('r') || hit('R'),
      anyKey: hit('Enter') || mouse.clicked
    };
  }

  // Autopilot: hold a target altitude and steer to a target x. Used by the
  // screenshot mode so every shot is a stable, good-looking flight, and as
  // an assist the player can toggle with the A key in the menu. It never
  // flies into terrain: below 70 m above the ground it climbs, hard.
  function autopilot(plane, targetX, targetAlt, dt, groundY) {
    var intent = { pitchUp: false, pitchDown: false, throttleUp: false, throttleDown: false, brake: false };
    var speed = Math.hypot(plane.vx, plane.vy);
    var desiredThrottle = 0.62;
    if (plane.x > targetX - 2600 && plane.onGround === false) desiredThrottle = 0.55;
    if (plane.throttle < desiredThrottle) intent.throttleUp = true;
    if (plane.throttle > desiredThrottle + 0.05) intent.throttleDown = true;
    var altErr = targetAlt - plane.y;
    if (!plane.onGround) {
      if (plane.stalled) {
        // Stall recovery: nose down to regain speed, full power. Pitching
        // up in a stall only deepens it.
        intent.pitchDown = true;
        intent.throttleUp = true;
      } else if (groundY !== undefined && plane.y - groundY < 70) {
        intent.pitchUp = true;
        intent.throttleUp = true;
      } else {
        // Proportional pitch, GENTLE: lift responds so strongly to pitch
        // (a 0.1 rad change swings lift ~50%) that a hot gain porpoises
        // the plane between dive and climb. Small gain, small caps, and
        // a deadband around the target rate.
        var desiredVy = altErr * 0.08;
        if (desiredVy > 5) desiredVy = 5;
        if (desiredVy < -4) desiredVy = -4;
        var vyErr = desiredVy - plane.vy;
        var targetPitch = vyErr * 0.02;
        if (targetPitch > 0.12) targetPitch = 0.12;
        if (targetPitch < -0.04) targetPitch = -0.04;
        if (Math.abs(vyErr) > 0.3) {
          if (plane.pitch < targetPitch - 0.02) intent.pitchUp = true;
          else if (plane.pitch > targetPitch + 0.02) intent.pitchDown = true;
        }
      }
    }
    if (plane.onGround && speed < 55) intent.throttleUp = true;
    return intent;
  }

  return {
    attach: attach, down: down, hit: hit, endFrame: endFrame,
    readIntent: readIntent, autopilot: autopilot, mouse: mouse, keys: keys
  };
})();
