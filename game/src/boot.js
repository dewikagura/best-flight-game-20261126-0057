// boot.js — the game itself: state machine, fixed-step loop, mission flow,
// leg landings, the airdrop, overshoot and crash handling, tutorial prompts
// and the deterministic screenshot mode (?shot=cover|night|storm|menu).
var CA = window.CA || (window.CA = {});

(function () {
  var canvas, g, W = 1280, H = 720;
  var state = 'title'; // title | select | brief | fly | pause | debrief | crash
  var mission = CA.Campaign.MISSIONS[0];
  var world = null, plane = null, cam = null;
  var islandLayers = [], clouds = [];
  var save = CA.Campaign.store.read();
  var legIdx = 1, score = 0, timeSec = 0, missionStart = 0;
  var legResults = [];
  var messages = []; // {text, until}
  var tutorial = -1, tutorialText = '';
  var dropX = null, dropDone = false, dropPrompted = false;
  var lightning = 0, nextBolt = 8, rain = 0, fog = 0, windNow = 0;
  var t = 0, acc = 0, lastTs = 0, shotMode = null, hoverMission = -1;
  var crashCause = '', debriefResult = null, pausedFrom = 'fly';
  var FPS = 60;

  function $(id) { return document.getElementById(id); }

  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || 1280;
    H = canvas.clientHeight || 720;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function showMessage(text, secs) {
    messages.push({ text: text, until: t + secs });
  }

  function startMission(m) {
    mission = m;
    world = CA.Islands.buildWorld(m, 1234 + m.id.charCodeAt(2) * 77);
    plane = CA.FlightModel.createPlane(world.islands[0].strip.x + 60, world.heightAt(world.islands[0].strip.x + 60), m.fuel);
    cam = CA.Scenery.createCamera();
    cam.x = plane.x + 420;
    cam.y = plane.y + 260;
    islandLayers = [];
    var pxPerM = 0.62;
    for (var i = 0; i < world.islands.length; i++) {
      var isle = world.islands[i];
      var layer = CA.Islands.paintIsland(world, isle, pxPerM, 520);
      layer.groundTop = 520;
      islandLayers.push(layer);
    }
    clouds = [];
    for (var c = 0; c < 10; c++) {
      clouds.push({
        x: (c * 911) % 2600, y: 30 + (c % 5) * 42,
        par: 0.12 + (c % 3) * 0.1, alpha: 0.45 + (c % 3) * 0.15,
        seed: c * 1.3, sprite: CA.Islands.paintCloud(world.palette, 500 + c * 31)
      });
    }
    legIdx = 1; score = 0; timeSec = 0; legResults = [];
    messages = []; tutorial = m.id === 'm01' ? 0 : -1; tutorialText = '';
    fuelWarned = false;
    dropX = m.airdrop ? world.islands[0].x1 + 1400 : null;
    dropDone = false; dropPrompted = false;
    rain = m.rain; fog = m.fog; lightning = 0; nextBolt = 6 + Math.random() * 8;
    state = 'brief';
  }

  function targetStrip() {
    if (legIdx >= world.islands.length) return null;
    return world.islands[legIdx].strip;
  }

  function targetLeg() {
    if (legIdx >= mission.legs.length) return null;
    return mission.legs[legIdx];
  }

  function landOnStrip(strip) {
    var ts = targetStrip();
    if (ts && plane.x >= ts.x - 20 && plane.x <= ts.x + ts.len + 20) {
      // Leg complete.
      var res = CA.Campaign.scoreLanding(mission, plane, timeSec, legIdx, mission.legs.length - 1);
      legResults.push(res);
      score += res.total;
      CA.Soundscape.chime();
      if (mission.refuel && legIdx < mission.legs.length - 1) {
        plane.fuel = mission.fuel;
        showMessage('REFUELLED — tanks full, on to the next leg', 4);
      }
      legIdx++;
      plane.landed = false;
      if (legIdx >= mission.legs.length) {
        finishMission();
      } else {
        showMessage('LEG COMPLETE — ' + mission.legs[legIdx].name + ' is next, ' +
          ((targetStrip().x - plane.x) / 1000).toFixed(1) + ' km', 4);
      }
      return true;
    }
    return false;
  }

  function finishMission() {
    var totalStars = 0;
    for (var i = 0; i < legResults.length; i++) totalStars += legResults[i].stars;
    var avgStars = Math.max(1, Math.round(totalStars / Math.max(1, legResults.length)));
    var last = legResults[legResults.length - 1] || { total: 0, stars: 1, parts: { landing: 0, cargo: 0, time: 0, fuel: 0, smooth: 0 } };
    debriefResult = {
      total: score, stars: avgStars,
      parts: { landing: last.parts.landing, cargo: last.parts.cargo, time: last.parts.time, fuel: last.parts.fuel, smooth: last.parts.smooth }
    };
    var idx = CA.Campaign.MISSIONS.indexOf(mission);
    var best = save.best[mission.id];
    if (!best || score > best.total) save.best[mission.id] = { total: score, stars: avgStars };
    if (idx + 1 >= save.unlocked && idx + 1 < CA.Campaign.MISSIONS.length) save.unlocked = idx + 2;
    CA.Campaign.store.write(save);
    state = 'debrief';
  }

  function crash(cause) {
    plane.crashed = true;
    crashCause = cause;
    state = 'crash';
    CA.Soundscape.thud();
  }

  // One fixed 1/60 step while flying.
  function stepFly(dt) {
    var intent = CA.Controls.readIntent();
    if (shotMode) {
      var shotAlt = shotMode === 'night' ? 180 : 320;
      intent = CA.Controls.autopilot(plane, targetStrip() ? targetStrip().x : plane.x + 3000, shotAlt, dt, world.heightAt(plane.x));
    }
    if (intent.flapsKey) {
      plane.flaps = (plane.flaps + 1) % 3;
      CA.Soundscape.blip(660, 0.08, 0.08, 'square');
    }
    if (intent.gearKey) {
      plane.gearDown = !plane.gearDown;
      CA.Soundscape.blip(520, 0.08, 0.08, 'square');
    }
    if (intent.pauseKey) { state = 'pause'; pausedFrom = 'fly'; return; }
    if (intent.muteKey) CA.Soundscape.setMuted(!CA.Soundscape.isMuted());
    if (intent.restartKey) { startMission(mission); state = 'fly'; return; }
    var wind = { base: -mission.wind, gust: mission.gust, seed: world.seed };
    var wasAirborne = plane.airborne;
    var prevVy = plane.vy;
    CA.FlightModel.step(plane, intent, wind, dt, function (x) { return world.heightAt(x); }, t, {});
    windNow = wind.base + wind.gust * CA.FlightModel.gustAt(t, wind.seed);
    timeSec += dt;
    // Storm lightning: sky-only flashes, 2-3 frames, never a white flash.
    if (mission.tod === 'storm' && t > nextBolt) {
      lightning = 0.14;
      nextBolt = t + 7 + Math.random() * 9;
      CA.Soundscape.thunder();
    }
    if (lightning > 0) lightning -= dt;
    // Fuel out over the bush.
    if (plane.fuel <= 0 && !plane.onGround) showMessageOnce('FUEL EMPTY — glide her down gently', 3);
    if (plane.stalled && Math.floor(t * 2) % 2 === 0) CA.Soundscape.stallBeep();
    // The airdrop: low and slow over the ring, press D.
    if (dropX !== null && !dropDone) {
      var dx = Math.abs(plane.x - dropX);
      if (dx < 200 && plane.y < 170 && Math.hypot(plane.vx, plane.vy) < 78) {
        if (!dropPrompted) { showMessage('OVER THE BOAT — press X to drop the crates', 5); dropPrompted = true; }
        if (CA.Controls.down('x') || CA.Controls.down('X')) {
          dropDone = true;
          score += 150;
          CA.Soundscape.chime();
          showMessage('SUPPLIES AWAY — the boat has them. Now land at Serui.', 4);
        }
      }
    }
    // Touchdown handling.
    if (plane.landed) {
      CA.Soundscape.thud();
      var strip = world.stripAt(plane.x);
      var overSea = world.heightAt(plane.x) < 1;
      if (overSea) { crash('ditched in the sea'); return; }
      if (!landOnStrip(strip)) {
        if (strip) {
          // Safe on the wrong strip: take off again and carry on.
          showMessage('Safe landing — but this is not your stop. Throttle up and go.', 4);
          plane.landed = false;
        } else {
          // Rough field landing: it costs the airframe, but she can lift again.
          plane.damage += 15;
          plane.cargoHealth = Math.max(0, plane.cargoHealth - 10);
          showMessage('ROUGH FIELD LANDING — the airframe took a knock', 4);
          plane.landed = false;
          if (plane.damage >= 100) { crash('airframe gave out after a rough landing'); return; }
        }
      }
    }
    if (plane.crashed) { crash(plane.crashCause || 'crashed'); return; }
    // Overshot the target strip: the strip is behind you now.
    var ts = targetStrip();
    if (ts && !plane.onGround && plane.x > ts.x + ts.len + 900) {
      crash('overshot the strip at ' + mission.legs[legIdx].name);
      return;
    }
    if (plane.y < 2 && !plane.onGround) { crash('ditched in the sea'); return; }
    // Tutorial prompts for the first run.
    if (tutorial >= 0) runTutorial(intent);
    // Engine + wind sound follows the plane.
    CA.Soundscape.update(plane.throttle, Math.hypot(plane.vx, plane.vy), plane.stalled, plane.onGround);
    CA.Scenery.updateCamera(cam, plane, ts ? ts.x : plane.x, dt, t);
  }

  var fuelWarned = false;
  function showMessageOnce(text, secs) {
    if (fuelWarned) return;
    fuelWarned = true;
    showMessage(text, secs);
  }

  function runTutorial(intent) {
    var steps = [
      { text: 'Hold RIGHT to spool the throttle', done: function () { return plane.throttle > 0.8; } },
      { text: 'At speed, hold UP to lift the nose — rotate!', done: function () { return plane.airborne; } },
      { text: 'Climb to 300 m, then ease the nose level', done: function () { return plane.y > 280; } },
      { text: 'Numfor is ahead — watch the amber arrow and the distance', done: function () { return plane.x > world.islands[1].x0; } },
      { text: 'Slow down: LEFT for throttle, F for flaps, G to lower the gear', done: function () { return plane.flaps === 2 && plane.gearDown; } },
      { text: 'Touch down soft — under 3 m/s sink, wings level', done: function () { return false; } }
    ];
    var s = steps[tutorial];
    if (!s) { tutorial = -1; tutorialText = ''; return; }
    tutorialText = s.text;
    if (s.done()) tutorial++;
  }

  // ---- rendering ---------------------------------------------------------
  function draw() {
    g.clearRect(0, 0, W, H);
    if (!world) {
      g.fillStyle = '#1a2a4a';
      g.fillRect(0, 0, W, H);
      return;
    }
    // The camera drifts slowly over the islands on menu screens.
    if (state === 'title' || state === 'select') {
      cam.x = 600 + Math.sin(t * 0.02) * 900;
      cam.y = 320;
    }
    var ts = targetStrip();
    var dropScreen = null;
    CA.Scenery.drawWorld({
      g: g, W: W, H: H, world: world, plane: plane, cam: cam, t: t,
      clouds: clouds, islandLayers: islandLayers,
      rain: state === 'fly' ? rain : rain * 0.4, fog: fog,
      lightning: lightning, dropX: dropX, dropDone: dropDone
    });
    if (state === 'fly' || state === 'pause') {
      var leg = targetLeg();
      var distM = ts ? Math.max(0, ts.x - plane.x) : 0;
      CA.Cockpit.drawTopBar(g, W, mission, leg, distM, score, timeSec, plane);
      // Guidance arrow to the next strip (or the drop ring).
      if (ts && state === 'fly') {
        var sp = worldToScreen(ts.x + ts.len / 2, world.heightAt(ts.x + ts.len / 2) + 30);
        CA.Cockpit.drawGuidance(g, W, H, sp.x, sp.y, distM, 'RUNWAY', distM < 1500);
      } else if (dropX !== null && !dropDone && state === 'fly') {
        var dp = worldToScreen(dropX, 30);
        CA.Cockpit.drawGuidance(g, W, H, dp.x, dp.y, Math.abs(dropX - plane.x), 'DROP ZONE', Math.abs(dropX - plane.x) < 400);
      }
      CA.Cockpit.drawPanel(g, W, H, plane, mission, windNow, t);
      // Transient messages + tutorial, as low captions.
      var now = t;
      messages = messages.filter(function (m) { return m.until > now; });
      var shown = messages.slice(-1)[0];
      if (tutorialText) CA.Cockpit.caption(g, tutorialText, W / 2, H * 0.68, 20);
      else if (shown) CA.Cockpit.caption(g, shown.text, W / 2, H * 0.68, 20);
      if (plane.stalled && state === 'fly') CA.Cockpit.caption(g, 'STALL — nose down, throttle up', W / 2, H * 0.56, 22);
      if (state === 'pause') {
        CA.Cockpit.drawBanner(g, W, H, ['PAUSED', 'P to resume  ·  R to restart  ·  Esc for menu'], '#ffb347');
      }
    } else if (state === 'title') {
      CA.Cockpit.drawTitle(g, W, H, t);
    } else if (state === 'select') {
      CA.Cockpit.drawSelect(g, W, H, CA.Campaign.MISSIONS, save, hoverMission);
    } else if (state === 'brief') {
      CA.Cockpit.drawBrief(g, W, H, mission);
    } else if (state === 'debrief') {
      CA.Cockpit.drawDebrief(g, W, H, mission, debriefResult);
    } else if (state === 'crash') {
      CA.Cockpit.drawCrash(g, W, H, crashCause);
    }
    // Mute indicator.
    if (CA.Soundscape.isMuted()) CA.Cockpit.text(g, 'MUTED (M)', W - 16, H - 108, 12, '#9aa1b5', 'right', '700');
  }

  function worldToScreen(wx, wy) {
    var sx = (wx - cam.x) * cam.zoom + W * 0.45 + cam.drift;
    var sy = H * 0.78 - (wy - cam.y) * cam.zoom;
    return { x: sx, y: sy };
  }

  // ---- main loop: fixed 1/60 steps, clamped frame time ------------------
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    t += dt;
    // FPS estimate (cheap, rolling).
    FPS = FPS * 0.95 + (dt > 0 ? (1 / dt) * 0.05 : 0);
    if (state === 'fly') {
      acc += dt;
      var n = 0;
      while (acc >= 1 / 60 && n < 5) { stepFly(1 / 60); acc -= 1 / 60; n++; }
      if (n === 5) acc = 0;
    } else {
      keyMenu();
    }
    draw();
    CA.Controls.endFrame();
  }

  // ---- menus -------------------------------------------------------------
  function clickAt(x, y) {
    if (state === 'title') { state = 'select'; return; }
    if (state === 'select') {
      var cols = 4, cw = 272, ch = 128, gap = 18;
      var x0 = (W - (cols * cw + (cols - 1) * gap)) / 2, y0 = 96;
      for (var i = 0; i < CA.Campaign.MISSIONS.length; i++) {
        var cx = x0 + (i % cols) * (cw + gap), cy = y0 + Math.floor(i / cols) * (ch + gap);
        if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch && i < save.unlocked) {
          startMission(CA.Campaign.MISSIONS[i]);
          return;
        }
      }
      return;
    }
    if (state === 'brief') { state = 'fly'; return; }
    if (state === 'debrief') { state = 'select'; return; }
    if (state === 'pause') { state = 'fly'; return; }
    if (state === 'crash') { startMission(mission); state = 'fly'; return; }
  }

  function keyMenu() {
    var intent = CA.Controls.readIntent();
    if (intent.pauseKey && state === 'pause') { state = 'fly'; return; }
    if (intent.restartKey && (state === 'crash' || state === 'debrief')) {
      startMission(mission);
      state = state === 'crash' ? 'fly' : 'brief';
      return;
    }
    if (!intent.anyKey) return;
    if (state === 'title' || state === 'brief' || state === 'debrief' || state === 'crash') clickAt(-1, -1);
  }

  // ---- screenshot mode ---------------------------------------------------
  // ?shot=cover|night|storm|menu — deterministic demo states for real
  // browser renders. Autopilot flies; nothing here can fail or crash.
  function startShot(mode) {
    shotMode = mode;
    if (mode === 'menu') {
      save.unlocked = CA.Campaign.MISSIONS.length;
      startMission(CA.Campaign.MISSIONS[0]);
      state = 'select';
      return;
    }
    var m = mode === 'night' ? CA.Campaign.missionById('m05')
      : mode === 'storm' ? CA.Campaign.missionById('m11')
      : CA.Campaign.missionById('m01');
    startMission(m);
    state = 'fly';
    var ts = targetStrip();
    var startX = ts.x - (mode === 'night' ? 1300 : 1100);
    plane.x = startX;
    plane.y = mode === 'night' ? 230 : 320;
    plane.vx = 62; plane.vy = 0;
    plane.throttle = 0.62;
    plane.onGround = false; plane.airborne = true;
    if (mode === 'night') {
      // A real final approach: 58 m/s, flaps 1, gear down, throttle 0.6.
      // Slower than this, the plane sits on the back of the power curve:
      // drag beats thrust, speed bleeds to the stall, and the autopilot
      // porpoises between dive and climb.
      plane.flaps = 1; plane.gearDown = true; plane.y = 200;
      plane.vx = 58; plane.throttle = 0.6;
    }
    cam.x = plane.x + 320;
    cam.y = plane.y - 232;
    tutorial = -1; tutorialText = '';
    // Pre-roll 4 s of flight so the shot is settled, not mid-spawn.
    for (var i = 0; i < 240; i++) stepFly(1 / 60);
  }

  function init() {
    canvas = $('game');
    g = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    CA.Controls.attach(canvas);
    canvas.addEventListener('mousedown', function (e) { clickAt(e.offsetX, e.offsetY); });
    canvas.addEventListener('mousemove', function (e) {
      if (state !== 'select') { hoverMission = -1; return; }
      var cols = 4, cw = 272, ch = 128, gap = 18;
      var x0 = (W - (cols * cw + (cols - 1) * gap)) / 2, y0 = 96;
      hoverMission = -1;
      for (var i = 0; i < CA.Campaign.MISSIONS.length; i++) {
        var cx = x0 + (i % cols) * (cw + gap), cy = y0 + Math.floor(i / cols) * (ch + gap);
        if (e.offsetX >= cx && e.offsetX <= cx + cw && e.offsetY >= cy && e.offsetY <= cy + ch) hoverMission = i;
      }
    });
    // A default world behind the title screen.
    startMission(CA.Campaign.MISSIONS[0]);
    state = 'title';
    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    if (shot) startShot(shot);
    requestAnimationFrame(frame);
  }

  window.addEventListener('DOMContentLoaded', init);
})();
