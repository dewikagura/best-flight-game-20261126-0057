// scenery.js — the picture: sky, sea, islands, the built-looking plane and
// the chase camera. The toon rules from the field notes, adapted to a 2D
// canvas: ink outlines in warm brown, one warm/cool palette per mood,
// painted (never flat) surfaces, dense set dressing, and a camera that
// follows with a soft look-ahead and never fights the pilot. Static art is
// painted once per mission and reused; per-frame work stays small so the
// game holds 60 fps.
var CA = window.CA || (window.CA = {});

CA.Scenery = (function () {
  var INK = '#1a1424';

  // Chase camera: eased follow with velocity look-ahead, a gentle roll with
  // the bank, and a slow drift so the frame never sits dead still.
  function createCamera() {
    return { x: 0, y: 0, zoom: 0.62, roll: 0, shake: 0, drift: 0 };
  }

  function updateCamera(cam, plane, targetX, dt, t) {
    var lookAhead = Math.max(0, plane.vx) * 0.45 + 260;
    var wantX = plane.x + lookAhead;
    // The camera sits above the plane so the plane rides near 58% height
    // and the ground stays in frame; clamped so the terrain never drops
    // below the instrument strip at high altitude.
    var wantY = plane.y - 232;
    var k = 1 - Math.pow(0.0018, dt); // smooth exponential ease
    cam.x += (wantX - cam.x) * k;
    cam.y += (wantY - cam.y) * k;
    if (cam.y > 130) cam.y = 130;
    cam.drift = Math.sin(t * 0.11) * 14;
    var wantZoom = plane.onGround ? 0.72 : 0.62;
    cam.zoom += (wantZoom - cam.zoom) * (1 - Math.pow(0.01, dt));
    var wantRoll = -plane.pitch * 0.05;
    cam.roll += (wantRoll - cam.roll) * (1 - Math.pow(0.005, dt));
    if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 30);
  }

  function skyGradient(g, W, H, pal) {
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, pal.sky[0]);
    grad.addColorStop(0.55, pal.sky[1]);
    grad.addColorStop(1, pal.sky[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  function drawSunMoon(g, W, H, pal, tod, t) {
    var sx = W * 0.78, sy = H * 0.16;
    if (tod === 'night') {
      // Luminous moon with a soft halo, never a flat disc.
      var halo = g.createRadialGradient(sx, sy, 8, sx, sy, 90);
      halo.addColorStop(0, 'rgba(244,234,208,0.5)');
      halo.addColorStop(1, 'rgba(244,234,208,0)');
      g.fillStyle = halo;
      g.fillRect(sx - 90, sy - 90, 180, 180);
      g.fillStyle = '#f4ead0';
      g.beginPath(); g.arc(sx, sy, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(180,170,140,0.7)';
      g.beginPath(); g.arc(sx - 8, sy - 5, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(sx + 7, sy + 8, 4, 0, Math.PI * 2); g.fill();
      // Stars.
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (var i = 0; i < 70; i++) {
        var px = (i * 173.3) % W, py = (i * 97.7) % (H * 0.5);
        var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.7 + i));
        g.globalAlpha = tw * 0.8;
        g.fillRect(px, py, 2, 2);
      }
      g.globalAlpha = 1;
    } else {
      // Gold disc with a white-hot core; only the core blooms.
      var glow = g.createRadialGradient(sx, sy, 6, sx, sy, 110);
      glow.addColorStop(0, 'rgba(255,214,106,0.75)');
      glow.addColorStop(1, 'rgba(255,214,106,0)');
      g.fillStyle = glow;
      g.fillRect(sx - 110, sy - 110, 220, 220);
      g.fillStyle = pal.sun;
      g.beginPath(); g.arc(sx, sy, 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = pal.sunCore;
      g.beginPath(); g.arc(sx, sy, 16, 0, Math.PI * 2); g.fill();
      // Thin rays.
      g.strokeStyle = 'rgba(255,214,106,0.5)';
      g.lineWidth = 3;
      for (var r = 0; r < 8; r++) {
        var a = (r / 8) * Math.PI * 2 + t * 0.02;
        g.beginPath();
        g.moveTo(sx + Math.cos(a) * 44, sy + Math.sin(a) * 44);
        g.lineTo(sx + Math.cos(a) * 62, sy + Math.sin(a) * 62);
        g.stroke();
      }
    }
  }

  function drawClouds(g, W, H, clouds, cam, t) {
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var px = (c.x - cam.x * c.par) % (W + 400);
      if (px < -200) px += W + 400;
      var py = c.y + Math.sin(t * 0.1 + c.seed) * 6;
      g.globalAlpha = c.alpha;
      g.drawImage(c.sprite, px - 90, py, 180, 74);
      g.globalAlpha = 1;
    }
  }

  function drawSea(g, W, H, cam, pal, t, horizonY) {
    var grad = g.createLinearGradient(0, horizonY, 0, H);
    grad.addColorStop(0, pal.sea[0]);
    grad.addColorStop(1, pal.sea[1]);
    g.fillStyle = grad;
    g.fillRect(0, horizonY, W, H - horizonY);
    // Cartoon wave shapes with outlines, drifting slowly.
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 2;
    for (var i = 0; i < 14; i++) {
      var wx = ((i * 197 + t * 12) % (W + 200)) - 100;
      var wy = horizonY + 30 + ((i * 89) % (H - horizonY - 60));
      g.beginPath();
      g.arc(wx, wy, 14 + (i % 3) * 6, Math.PI, Math.PI * 2);
      g.stroke();
    }
  }

  // Dense set dressing for one island: huts with lit windows, palms,
  // windsock, fuel drums, crates, a beached boat. All toy-like, chunky,
  // inked, with a light top edge for the toy sheen.
  function drawProps(g, world, isle, cam, pal, t, toScreen) {
    var ink = pal.ink;
    if (isle.village) {
      var v = isle.village;
      for (var h = 0; h < v.huts; h++) {
        var hx = v.x + h * 74;
        var pos = toScreen(hx, world.heightAt(hx));
        if (pos.x < -120 || pos.x > 1400) continue;
        var hy = pos.y;
        // Hut: walls, roof tiles, lit window, chimney.
        g.fillStyle = '#c98f5a';
        g.fillRect(pos.x - 22, hy - 34, 44, 34);
        g.strokeStyle = ink; g.lineWidth = 2.5;
        g.strokeRect(pos.x - 22, hy - 34, 44, 34);
        g.fillStyle = '#b4503c';
        g.beginPath();
        g.moveTo(pos.x - 28, hy - 34); g.lineTo(pos.x, hy - 58); g.lineTo(pos.x + 28, hy - 34);
        g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
        for (var tr = 0; tr < 3; tr++) {
          g.beginPath(); g.moveTo(pos.x - 22 + tr * 8, hy - 40 - tr * 5); g.lineTo(pos.x + 22 - tr * 8, hy - 40 - tr * 5); g.stroke();
        }
        // Lit window: warm practical in the dark, soft by day.
        g.fillStyle = world.tod === 'night' ? '#ffd76a' : '#ffe9b0';
        g.fillRect(pos.x - 8, hy - 26, 16, 14);
        g.strokeStyle = ink; g.lineWidth = 2;
        g.strokeRect(pos.x - 8, hy - 26, 16, 14);
        if (world.tod === 'night') {
          var glow = g.createRadialGradient(pos.x, hy - 19, 2, pos.x, hy - 19, 34);
          glow.addColorStop(0, 'rgba(255,215,106,0.5)');
          glow.addColorStop(1, 'rgba(255,215,106,0)');
          g.fillStyle = glow;
          g.fillRect(pos.x - 34, hy - 53, 68, 68);
        }
      }
      for (var p = 0; p < v.palms; p++) {
        var px = v.x + 30 + p * 58;
        var pp = toScreen(px, world.heightAt(px));
        if (pp.x < -80 || pp.x > 1360) continue;
        drawPalm(g, pp.x, pp.y, pal, t + p);
      }
      // Windsock on a pole near the strip.
      var ws = toScreen(isle.strip.x - 60, world.heightAt(isle.strip.x - 60));
      g.strokeStyle = ink; g.lineWidth = 3;
      g.beginPath(); g.moveTo(ws.x, ws.y); g.lineTo(ws.x, ws.y - 52); g.stroke();
      g.save();
      g.translate(ws.x, ws.y - 52);
      g.rotate(Math.sin(t * 2) * 0.12);
      g.fillStyle = '#ff7a3c';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(26, -5); g.lineTo(26, 5); g.closePath(); g.fill();
      g.strokeStyle = ink; g.lineWidth = 2; g.stroke();
      g.restore();
      // Fuel drums and crates by the strip.
      for (var d = 0; d < 3; d++) {
        var dx = isle.strip.x + isle.strip.len + 40 + d * 26;
        var dp = toScreen(dx, world.heightAt(dx));
        g.fillStyle = d % 2 ? '#2f7a44' : '#b4503c';
        rr(g, dp.x - 9, dp.y - 22, 18, 22, 3); g.fill();
        g.strokeStyle = ink; g.lineWidth = 2;
        rr(g, dp.x - 9, dp.y - 22, 18, 22, 3); g.stroke();
      }
    }
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawPalm(g, x, y, pal, t) {
    var sway = Math.sin(t * 0.9) * 0.06;
    g.strokeStyle = pal.ink; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 30, x + 12, y - 52); g.stroke();
    g.strokeStyle = '#2f7a44'; g.lineWidth = 5; g.lineCap = 'round';
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI * (0.15 + i * 0.16) + sway;
      g.beginPath();
      g.moveTo(x + 12, y - 52);
      g.quadraticCurveTo(x + 12 + Math.cos(a) * 22, y - 52 + Math.sin(a) * 22 - 8, x + 12 + Math.cos(a) * 34, y - 52 + Math.sin(a) * 34 + 10);
      g.stroke();
    }
    g.lineCap = 'butt';
  }

  // The runway: painted planks with seams, edge markers, and — at night —
  // a row of warm practical lights, at least three in view.
  function drawStrip(g, world, isle, toScreen, t) {
    var s = isle.strip;
    var p0 = toScreen(s.x, world.heightAt(s.x));
    var p1 = toScreen(s.x + s.len, world.heightAt(s.x + s.len));
    var w = p1.x - p0.x;
    if (p1.x < -50 || p0.x > 1400) return;
    var y = p0.y;
    g.fillStyle = s.kind === 'grass' ? '#8fae4e' : '#a08a6a';
    g.fillRect(p0.x, y - 5, w, 10);
    g.strokeStyle = world.palette.ink; g.lineWidth = 2;
    g.strokeRect(p0.x, y - 5, w, 10);
    // Plank seams every ~40 px, staggered.
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
    for (var x = p0.x + 24; x < p1.x; x += 42) {
      g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke();
    }
    // White centre line dashes.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (var d = p0.x + 12; d < p1.x - 12; d += 56) g.fillRect(d, y - 1.5, 28, 3);
    // Edge cones.
    for (var c = p0.x; c <= p1.x; c += 90) {
      g.fillStyle = '#ff7a3c';
      g.beginPath(); g.moveTo(c, y - 14); g.lineTo(c + 5, y - 5); g.lineTo(c - 5, y - 5); g.closePath(); g.fill();
    }
    if (s.lights) {
      for (var l = p0.x + 10; l < p1.x; l += 70) {
        var pulse = 0.7 + 0.3 * Math.sin(t * 3 + l * 0.05);
        var glow = g.createRadialGradient(l, y - 8, 1, l, y - 8, 22 * pulse);
        glow.addColorStop(0, 'rgba(255,215,106,0.9)');
        glow.addColorStop(1, 'rgba(255,215,106,0)');
        g.fillStyle = glow;
        g.fillRect(l - 22, y - 30, 44, 44);
        g.fillStyle = '#ffd76a';
        g.beginPath(); g.arc(l, y - 8, 3.5, 0, Math.PI * 2); g.fill();
      }
    }
  }

  // The drop ring for the sea-drop mission: a floating ring with a buoy.
  function drawRing(g, x, y, t, pal) {
    var bob = Math.sin(t * 1.5) * 4;
    g.save();
    g.translate(x, y + bob);
    g.strokeStyle = '#ffb347'; g.lineWidth = 6;
    g.beginPath(); g.ellipse(0, 0, 46, 12, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = pal.ink; g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, 0, 46, 12, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ff5a4e';
    g.beginPath(); g.arc(0, -16, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = pal.ink; g.lineWidth = 2;
    g.beginPath(); g.arc(0, -16, 7, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  // The plane: a bush Caravan that looks built, not flat — fuselage panels
  // with seams and rivets, windows, wing struts, tail fin with the
  // bird-of-paradise mark, cargo pod, spinning prop, gear and nav lights.
  // Ink outline in warm brown, 3 px, wobble 0 so it never crawls.
  function drawPlane(g, plane, screenX, screenY, scale, pal, t, onGround) {
    g.save();
    g.translate(screenX, screenY);
    g.rotate(plane.pitch * 0.8);
    g.scale(scale, scale);
    var ink = pal.ink;
    // Ground shadow when low.
    // Prop blur disc.
    g.save();
    g.translate(34, 0);
    g.fillStyle = 'rgba(200,200,210,0.35)';
    g.beginPath(); g.ellipse(0, 0, 4, 26, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(26,20,36,0.5)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(0, 0, 4, 26, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
    // Wing (far side, darker).
    g.fillStyle = '#d96a3c';
    g.beginPath(); g.moveTo(-6, -2); g.lineTo(8, -16); g.lineTo(16, -14); g.lineTo(4, 2); g.closePath(); g.fill();
    g.strokeStyle = ink; g.lineWidth = 2.5; g.stroke();
    // Tail fin with the cendrawasih mark.
    g.fillStyle = '#e2574c';
    g.beginPath(); g.moveTo(-30, 0); g.lineTo(-38, -22); g.lineTo(-28, -22); g.lineTo(-20, 0); g.closePath(); g.fill();
    g.strokeStyle = ink; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = '#ffd76a';
    g.beginPath(); g.arc(-30, -14, 3.5, 0, Math.PI * 2); g.fill();
    // Fuselage: cream body, teal belly, panel seams, rivets.
    g.fillStyle = '#f2e6c8';
    g.beginPath();
    g.moveTo(-34, -2);
    g.quadraticCurveTo(-20, -12, 4, -11);
    g.quadraticCurveTo(26, -10, 36, -2);
    g.quadraticCurveTo(26, 6, 4, 7);
    g.quadraticCurveTo(-20, 8, -34, 2);
    g.closePath(); g.fill();
    g.strokeStyle = ink; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#2fae9e';
    g.beginPath();
    g.moveTo(-30, 3); g.quadraticCurveTo(0, 9, 30, 2);
    g.lineTo(28, 6); g.quadraticCurveTo(0, 11, -28, 6);
    g.closePath(); g.fill();
    // Panel seams + rivets.
    g.strokeStyle = 'rgba(26,20,36,0.35)'; g.lineWidth = 1;
    for (var s = -18; s <= 18; s += 12) {
      g.beginPath(); g.moveTo(s, -10); g.lineTo(s, 6); g.stroke();
    }
    g.fillStyle = 'rgba(26,20,36,0.4)';
    for (var rv = -24; rv <= 24; rv += 8) {
      g.beginPath(); g.arc(rv, -6, 0.9, 0, Math.PI * 2); g.fill();
    }
    // Windows: cockpit glass with a warm reflection.
    g.fillStyle = '#2a3a6e';
    g.beginPath(); g.moveTo(14, -9); g.lineTo(26, -8); g.lineTo(24, -2); g.lineTo(12, -3); g.closePath(); g.fill();
    g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(16, -8); g.lineTo(22, -4); g.stroke();
    g.fillStyle = '#2a3a6e';
    for (var w = -8; w <= 6; w += 7) {
      g.beginPath(); g.arc(w, -5, 2.6, 0, Math.PI * 2); g.fill();
    }
    // Cargo pod under the belly.
    g.fillStyle = '#c98f5a';
    rr(g, -12, 6, 26, 8, 3); g.fill();
    g.strokeStyle = ink; g.lineWidth = 2;
    rr(g, -12, 6, 26, 8, 3); g.stroke();
    // Landing gear.
    if (plane.gearDown) {
      g.strokeStyle = ink; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-14, 8); g.lineTo(-16, 18); g.stroke();
      g.beginPath(); g.moveTo(12, 8); g.lineTo(14, 18); g.stroke();
      g.fillStyle = '#22242e';
      g.beginPath(); g.arc(-16, 19, 4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(14, 19, 4, 0, Math.PI * 2); g.fill();
    }
    // Nav lights: red left, green right, white strobe blink.
    g.fillStyle = '#ff5a4e';
    g.beginPath(); g.arc(-34, 0, 2.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7dff8a';
    g.beginPath(); g.arc(36, -2, 2.5, 0, Math.PI * 2); g.fill();
    if (Math.floor(t * 2) % 2 === 0) {
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(-30, -22, 2.5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function drawRain(g, W, H, intensity, t) {
    if (intensity <= 0) return;
    var n = Math.floor(90 * intensity);
    g.strokeStyle = 'rgba(200,220,230,0.5)';
    g.lineWidth = 1.5;
    for (var i = 0; i < n; i++) {
      var depth = (i % 3) + 1;
      var x = ((i * 137.5 + t * (300 + depth * 160)) % (W + 120)) - 60;
      var y = ((i * 89.3 + t * (520 + depth * 260)) % (H + 120)) - 60;
      var len = 12 + depth * 9;
      g.globalAlpha = 0.25 + depth * 0.18;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x - len * 0.28, y + len);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawVignette(g, W, H) {
    var grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(8,8,18,0.28)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  // Full frame. ctx: {g, W, H, world, plane, cam, t, mission, fog, rain,
  // lightning, dropX, dropDone}. Returns nothing; draws everything.
  function drawWorld(c) {
    var g = c.g, W = c.W, H = c.H, pal = c.world.palette, cam = c.cam;
    var horizonY = H * 0.62 - (cam.y - c.plane.y) * cam.zoom * 0.12;
    skyGradient(g, W, H, pal);
    drawSunMoon(g, W, H, pal, c.world.tod, c.t);
    drawClouds(g, W, H, c.clouds, cam, c.t);
    // Far mountains: aerial perspective — lighter and bluer with distance.
    g.fillStyle = pal.tod === 'night' ? 'rgba(90,106,208,0.5)' : 'rgba(140,170,200,0.55)';
    g.beginPath();
    g.moveTo(0, horizonY);
    for (var fx = 0; fx <= W; fx += 40) {
      var fh = horizonY - 60 - 50 * Math.abs(Math.sin((fx + cam.x * 0.15) * 0.004));
      g.lineTo(fx, fh);
    }
    g.lineTo(W, horizonY);
    g.closePath(); g.fill();
    var toScreen = function (wx, wy) {
      var sx = (wx - cam.x) * cam.zoom + W * 0.45 + cam.drift;
      var sy = H * 0.78 - (wy - cam.y) * cam.zoom;
      return { x: sx, y: sy };
    };
    // Sea.
    var seaTop = toScreen(0, 0).y;
    drawSea(g, W, H, cam, pal, c.t, Math.min(H, Math.max(H * 0.55, seaTop)));
    // Islands (pre-painted canvases) + strips + props.
    for (var i = 0; i < c.world.islands.length; i++) {
      var isle = c.world.islands[i];
      var layer = c.islandLayers[i];
      var pos = toScreen(isle.x0, 0);
      var top = toScreen(0, layer.groundTop).y;
      if (pos.x + layer.width * cam.zoom < -100 || pos.x > W + 100) continue;
      // The layer was painted at layer.pxPerM px/m; scale to the camera.
      var ls = cam.zoom / layer.pxPerM;
      g.drawImage(layer.canvas, pos.x, top, layer.width * ls, layer.height * ls);
      drawStrip(g, c.world, isle, toScreen, c.t);
      drawProps(g, c.world, isle, cam, pal, c.t, toScreen);
    }
    // Drop ring.
    if (c.dropX !== null && !c.dropDone) {
      var rp = toScreen(c.dropX, 4);
      drawRing(g, rp.x, rp.y, c.t, pal);
    }
    // Lightning: lights only the sky and rims, 2-3 frames, never a white flash.
    if (c.lightning > 0) {
      g.fillStyle = 'rgba(200,210,255,' + (c.lightning * 0.12) + ')';
      g.fillRect(0, 0, W, H * 0.5);
    }
    // The plane.
    var pp = toScreen(c.plane.x, c.plane.y);
    drawPlane(g, c.plane, pp.x, pp.y, 1.45, pal, c.t, c.plane.onGround);
    // Rain + fog.
    drawRain(g, W, H, c.rain, c.t);
    if (c.fog > 0) {
      g.fillStyle = c.world.palette.fog;
      g.globalAlpha = c.fog * 0.5;
      g.fillRect(0, H * 0.3, W, H * 0.5);
      g.globalAlpha = 1;
    }
    drawVignette(g, W, H);
  }

  return {
    createCamera: createCamera, updateCamera: updateCamera, drawWorld: drawWorld
  };
})();
