// cockpit.js — the lit instrument panel, the HUD, the target guidance and
// every screen around the flying: title, mission select, briefing,
// debrief, pause and crash. Instruments look flown, not drawn: warm-lit
// dials, glass reflections, needles that move. Captions are white extra-bold
// with a black outline, low on the frame, per the toon caption rule.
var CA = window.CA || (window.CA = {});

CA.Cockpit = (function () {
  var INK = '#1a1424';
  var AMBER = '#ffb347';
  var GREEN = '#7dff8a';
  var RED = '#ff5a4e';

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function text(g, s, x, y, size, color, align, weight) {
    g.font = (weight || '800') + ' ' + size + 'px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = align || 'left';
    g.textBaseline = 'middle';
    g.fillStyle = color || '#fff';
    g.fillText(s, x, y);
  }

  // White extra-bold caption with a black outline, centred low in frame.
  function caption(g, s, cx, y, size) {
    g.font = '900 ' + size + 'px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(10,10,20,0.9)';
    g.strokeText(s, cx, y);
    g.fillStyle = '#fff';
    g.fillText(s, cx, y);
  }

  function dial(g, cx, cy, r, label, valueText, frac, warn) {
    // Lit dial face.
    var grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#3a3f55');
    grad.addColorStop(1, '#14161f');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.lineWidth = 3; g.strokeStyle = warn ? RED : AMBER;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    // Tick marks.
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2;
    for (var i = 0; i <= 10; i++) {
      var a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
      g.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
      g.stroke();
    }
    // Needle.
    var na = Math.PI * 0.75 + Math.max(0, Math.min(1, frac)) * Math.PI * 1.5;
    g.strokeStyle = warn ? RED : '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(na) * r * 0.72, cy + Math.sin(na) * r * 0.72);
    g.stroke();
    // Glass reflection.
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 5;
    g.beginPath(); g.arc(cx, cy, r * 0.7, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    text(g, label, cx, cy + r * 0.55, 11, '#cfd6e4', 'center', '700');
    text(g, valueText, cx, cy - r * 0.45, 13, warn ? RED : '#fff', 'center', '900');
  }

  // The bottom instrument strip: airspeed, altitude, vertical speed,
  // artificial horizon, compass, fuel, RPM, flaps and gear lamps.
  function drawPanel(g, W, H, plane, mission, windNow, t) {
    var stripH = 96;
    var y0 = H - stripH;
    var grad = g.createLinearGradient(0, y0, 0, H);
    grad.addColorStop(0, '#232838');
    grad.addColorStop(1, '#10121a');
    g.fillStyle = grad;
    g.fillRect(0, y0, W, stripH);
    g.fillStyle = AMBER;
    g.fillRect(0, y0, W, 3);
    var speed = Math.hypot(plane.vx, plane.vy);
    var knots = Math.round(speed * 1.944);
    var altFt = Math.max(0, Math.round(plane.y * 3.281));
    var vsFpm = Math.round(plane.vy * 196.85);
    var cx = 78;
    dial(g, cx, y0 + 48, 36, 'KNOTS', String(knots), speed / 90, plane.stalled);
    dial(g, cx + 92, y0 + 48, 36, 'ALT FT', String(altFt), Math.min(1, plane.y / 900), false);
    dial(g, cx + 184, y0 + 48, 36, 'V/S', (vsFpm >= 0 ? '+' : '') + vsFpm, (vsFpm + 1500) / 3000, false);
    // Artificial horizon: bank follows pitch, sky/ground split.
    var hx = cx + 276, hy = y0 + 48, hr = 30;
    g.save();
    g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.clip();
    g.translate(hx, hy);
    g.rotate(-plane.pitch * 0.9);
    g.fillStyle = '#4a90d9'; g.fillRect(-hr, -hr - plane.vy * 1.2, hr * 2, hr);
    g.fillStyle = '#7a5230'; g.fillRect(-hr, -plane.vy * 1.2, hr * 2, hr * 2);
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-hr, -plane.vy * 1.2); g.lineTo(hr, -plane.vy * 1.2); g.stroke();
    g.restore();
    g.lineWidth = 3; g.strokeStyle = AMBER;
    g.beginPath(); g.arc(hx, hy, hr, 0, Math.PI * 2); g.stroke();
    text(g, 'ATTITUDE', hx, hy + hr + 9, 10, '#cfd6e4', 'center', '700');
    // Compass tape.
    var compX = cx + 368, compW = 190;
    text(g, 'HDG', compX + compW / 2, y0 + 16, 11, '#cfd6e4', 'center', '700');
    var heading = 90; // eastbound along the chain
    g.save();
    g.beginPath(); g.rect(compX, y0 + 26, compW, 44); g.clip();
    g.fillStyle = '#14161f'; g.fillRect(compX, y0 + 26, compW, 44);
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    for (var d = -60; d <= 60; d += 10) {
      var dx = compX + compW / 2 + d * 2.4;
      g.beginPath(); g.moveTo(dx, y0 + 30); g.lineTo(dx, y0 + 40); g.stroke();
      if (d % 30 === 0) text(g, String((heading + d + 360) % 360), dx, y0 + 54, 11, '#fff', 'center', '800');
    }
    g.restore();
    g.strokeStyle = AMBER; g.lineWidth = 3;
    g.beginPath(); g.moveTo(compX + compW / 2, y0 + 26); g.lineTo(compX + compW / 2, y0 + 70); g.stroke();
    // Fuel gauge.
    var fx = compX + compW + 26;
    text(g, 'FUEL', fx + 34, y0 + 16, 11, '#cfd6e4', 'center', '700');
    var fuelFrac = plane.fuel / 520;
    g.fillStyle = '#14161f';
    rr(g, fx, y0 + 28, 68, 16, 4); g.fill();
    g.fillStyle = fuelFrac < 0.2 ? RED : GREEN;
    rr(g, fx + 2, y0 + 30, Math.max(4, 64 * fuelFrac), 12, 3); g.fill();
    text(g, Math.round(plane.fuel) + ' kg', fx + 34, y0 + 58, 11, fuelFrac < 0.2 ? RED : '#fff', 'center', '800');
    // RPM + throttle bar.
    var tx = fx + 92;
    text(g, 'THR ' + Math.round(plane.throttle * 100) + '%', tx + 34, y0 + 16, 11, '#cfd6e4', 'center', '700');
    g.fillStyle = '#14161f';
    rr(g, tx, y0 + 28, 68, 16, 4); g.fill();
    g.fillStyle = AMBER;
    rr(g, tx + 2, y0 + 30, Math.max(4, 64 * plane.throttle), 12, 3); g.fill();
    // Flaps / gear lamps.
    var lx = tx + 92;
    lamp(g, lx, y0 + 34, 'FLAPS', plane.flaps > 0, GREEN);
    lamp(g, lx, y0 + 62, 'GEAR', plane.gearDown, GREEN);
    lamp(g, lx + 78, y0 + 34, 'STALL', plane.stalled, RED, t);
    lamp(g, lx + 78, y0 + 62, 'LOW FUEL', plane.fuel < 90, RED, t);
    // Wind readout.
    var wx = lx + 168;
    text(g, 'WIND', wx, y0 + 16, 11, '#cfd6e4', 'center', '700');
    var wa = windNow >= 0 ? 0 : Math.PI;
    g.save();
    g.translate(wx, y0 + 48);
    g.rotate(wa);
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 12); g.lineTo(0, -12); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -16); g.lineTo(-5, -6); g.lineTo(5, -6); g.closePath(); g.fill();
    g.restore();
    text(g, Math.abs(Math.round(windNow * 1.944)) + ' kt', wx, y0 + 76, 11, '#fff', 'center', '800');
  }

  function lamp(g, x, y, label, on, color, t) {
    var blink = t === undefined ? true : (Math.floor(t * 3) % 2 === 0);
    g.fillStyle = on ? (blink ? color : '#3a3f55') : '#22242e';
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.stroke();
    text(g, label, x + 13, y, 10, on ? '#fff' : '#8a90a3', 'left', '700');
  }

  // Top bar: mission, objective, distance, score, timer.
  function drawTopBar(g, W, mission, leg, distM, score, timeSec, plane) {
    g.fillStyle = 'rgba(10,12,20,0.72)';
    rr(g, 12, 10, W - 24, 40, 8); g.fill();
    g.strokeStyle = 'rgba(255,179,71,0.6)'; g.lineWidth = 1.5;
    rr(g, 12, 10, W - 24, 40, 8); g.stroke();
    text(g, mission.name.toUpperCase() + '  ·  ' + mission.cargo, 26, 30, 15, '#fff', 'left', '900');
    var obj = leg ? ('NEXT: ' + leg.name + '  —  ' + (distM / 1000).toFixed(1) + ' km') : 'EN ROUTE';
    text(g, obj, W / 2, 30, 15, AMBER, 'center', '800');
    var mm = Math.floor(timeSec / 60), ss = Math.floor(timeSec % 60);
    text(g, 'SCORE ' + score + '   ' + mm + ':' + (ss < 10 ? '0' : '') + ss, W - 26, 30, 15, '#fff', 'right', '800');
  }

  // Guidance: an arrow and a glide-slope diamond pointing at the next strip
  // or drop ring, plus a distance readout.
  function drawGuidance(g, W, H, screenX, screenY, distM, kind, onTarget) {
    var cx = W / 2, cy = H * 0.30;
    var dx = screenX - cx, dy = screenY - cy;
    var ang = Math.atan2(dy, dx);
    var ax = cx + Math.cos(ang) * 120, ay = cy + Math.sin(ang) * 120;
    g.save();
    g.translate(ax, ay);
    g.rotate(ang);
    g.fillStyle = onTarget ? GREEN : AMBER;
    g.beginPath();
    g.moveTo(14, 0); g.lineTo(-8, -9); g.lineTo(-4, 0); g.lineTo(-8, 9);
    g.closePath(); g.fill();
    g.restore();
    g.lineWidth = 3;
    g.strokeStyle = onTarget ? GREEN : AMBER;
    g.beginPath(); g.arc(cx, cy, 26, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    g.moveTo(cx - 34, cy); g.lineTo(cx - 20, cy);
    g.moveTo(cx + 20, cy); g.lineTo(cx + 34, cy);
    g.moveTo(cx, cy - 34); g.lineTo(cx, cy - 20);
    g.moveTo(cx, cy + 20); g.lineTo(cx, cy + 34);
    g.stroke();
    text(g, kind + '  ' + (distM / 1000).toFixed(1) + ' km', cx, cy + 46, 14, '#fff', 'center', '900');
  }

  function drawBanner(g, W, H, lines, accent) {
    var bw = 620, bh = 44 + lines.length * 30;
    var bx = (W - bw) / 2, by = H * 0.16;
    g.fillStyle = 'rgba(10,12,20,0.82)';
    rr(g, bx, by, bw, bh, 12); g.fill();
    g.strokeStyle = accent || AMBER; g.lineWidth = 2;
    rr(g, bx, by, bw, bh, 12); g.stroke();
    for (var i = 0; i < lines.length; i++) {
      text(g, lines[i], W / 2, by + 32 + i * 30, i === 0 ? 20 : 14, i === 0 ? '#fff' : '#cfd6e4', 'center', i === 0 ? '900' : '700');
    }
  }

  function drawTitle(g, W, H, t) {
    g.fillStyle = 'rgba(8,10,18,0.45)';
    g.fillRect(0, 0, W, H);
    var bob = Math.sin(t * 1.4) * 6;
    text(g, 'CENDRAWASIH AIRLIFT', W / 2, H * 0.30 + bob, 54, '#fff', 'center', '900');
    g.lineWidth = 8; g.strokeStyle = 'rgba(10,10,20,0.9)';
    g.font = '900 54px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeText('CENDRAWASIH AIRLIFT', W / 2, H * 0.30 + bob);
    g.fillStyle = '#fff';
    g.fillText('CENDRAWASIH AIRLIFT', W / 2, H * 0.30 + bob);
    caption(g, 'Papua bush courier — twelve runs, one old Caravan', W / 2, H * 0.42, 20);
    caption(g, 'Click or press Enter to fly', W / 2, H * 0.62, 22);
    text(g, 'Arrows / WASD fly  ·  F flaps  ·  G gear  ·  B brakes  ·  P pause  ·  M mute', W / 2, H * 0.72, 15, '#e8ecf4', 'center', '700');
    text(g, 'An original game. Art, sound and names are all its own.', W / 2, H * 0.90, 13, '#9aa1b5', 'center', '700');
  }

  function drawSelect(g, W, H, missions, save, hover) {
    g.fillStyle = 'rgba(8,10,18,0.68)';
    g.fillRect(0, 0, W, H);
    text(g, 'CHOOSE YOUR RUN', W / 2, 54, 30, '#fff', 'center', '900');
    var cols = 4, cw = 272, ch = 128, gap = 18;
    var x0 = (W - (cols * cw + (cols - 1) * gap)) / 2, y0 = 96;
    for (var i = 0; i < missions.length; i++) {
      var m = missions[i];
      var cx = x0 + (i % cols) * (cw + gap), cy = y0 + Math.floor(i / cols) * (ch + gap);
      var unlocked = i < save.unlocked;
      var isHover = hover >= 0 && hover === i;
      g.fillStyle = unlocked ? (isHover ? '#2c3350' : 'rgba(20,24,38,0.92)') : 'rgba(12,14,22,0.75)';
      rr(g, cx, cy, cw, ch, 10); g.fill();
      g.strokeStyle = unlocked ? (isHover ? AMBER : 'rgba(255,255,255,0.25)') : 'rgba(255,255,255,0.08)';
      g.lineWidth = 2;
      rr(g, cx, cy, cw, ch, 10); g.stroke();
      if (!unlocked) {
        text(g, 'LOCKED', cx + cw / 2, cy + ch / 2, 18, '#5a6178', 'center', '900');
        continue;
      }
      text(g, (i + 1) + '. ' + m.name.toUpperCase(), cx + 14, cy + 24, 15, '#fff', 'left', '900');
      text(g, m.cargo, cx + 14, cy + 48, 12, '#cfd6e4', 'left', '700');
      text(g, m.tod.toUpperCase() + '  ·  ' + m.legs.length + ' STOPS', cx + 14, cy + 70, 11, AMBER, 'left', '800');
      var best = save.best[m.id];
      var stars = best ? best.stars : 0;
      for (var s = 0; s < 3; s++) {
        text(g, s < stars ? '★' : '☆', cx + 16 + s * 22, cy + 102, 18, s < stars ? AMBER : '#4a5068', 'left', '900');
      }
      if (best) text(g, best.total + ' pts', cx + cw - 14, cy + 102, 12, '#fff', 'right', '800');
    }
    text(g, 'Click a run to read its briefing. Finish one to unlock the next.', W / 2, H - 30, 14, '#cfd6e4', 'center', '700');
  }

  function drawBrief(g, W, H, m) {
    g.fillStyle = 'rgba(8,10,18,0.62)';
    g.fillRect(0, 0, W, H);
    var bw = 760, bh = 380;
    var bx = (W - bw) / 2, by = (H - bh) / 2;
    g.fillStyle = 'rgba(16,19,32,0.96)';
    rr(g, bx, by, bw, bh, 14); g.fill();
    g.strokeStyle = AMBER; g.lineWidth = 2;
    rr(g, bx, by, bw, bh, 14); g.stroke();
    text(g, m.name.toUpperCase(), W / 2, by + 40, 28, '#fff', 'center', '900');
    text(g, 'CARGO: ' + m.cargo + '   ·   ' + m.tod.toUpperCase() + '   ·   WIND ' + Math.round(m.wind * 1.944) + ' KT', W / 2, by + 74, 14, AMBER, 'center', '800');
    var words = wrapText(g, m.brief, 20, bw - 80);
    var y = by + 118;
    g.font = '400 16px "Trebuchet MS", Verdana, sans-serif';
    g.fillStyle = '#e8ecf4';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    for (var i = 0; i < words.length; i++) { g.fillText(words[i], bx + 40, y); y += 24; }
    var stops = m.legs.map(function (l) { return l.name; }).join('  →  ');
    text(g, stops, W / 2, by + bh - 78, 15, '#fff', 'center', '800');
    text(g, 'PAR TIME ' + Math.floor(m.par / 60) + ':' + ('0' + (m.par % 60)).slice(-2) + '   ·   FUEL ' + m.fuel + ' KG', W / 2, by + bh - 52, 13, '#cfd6e4', 'center', '700');
    caption(g, 'Click or press Enter to take off', W / 2, H - 60, 20);
  }

  function wrapText(g, s, size, maxW) {
    g.font = size + 'px "Trebuchet MS", Verdana, sans-serif';
    var words = s.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawDebrief(g, W, H, m, result) {
    g.fillStyle = 'rgba(8,10,18,0.6)';
    g.fillRect(0, 0, W, H);
    var bw = 640, bh = 400;
    var bx = (W - bw) / 2, by = (H - bh) / 2;
    g.fillStyle = 'rgba(16,19,32,0.96)';
    rr(g, bx, by, bw, bh, 14); g.fill();
    g.strokeStyle = GREEN; g.lineWidth = 2;
    rr(g, bx, by, bw, bh, 14); g.stroke();
    text(g, 'RUN COMPLETE', W / 2, by + 42, 28, '#fff', 'center', '900');
    var stars = '';
    for (var s = 0; s < 3; s++) stars += s < result.stars ? '★' : '☆';
    text(g, stars, W / 2, by + 86, 30, AMBER, 'center', '900');
    var rows = [
      ['Landing', result.parts.landing + ' / 300'],
      ['Cargo condition', result.parts.cargo + ' / 250'],
      ['Time bonus', result.parts.time + ' / 200'],
      ['Fuel left', result.parts.fuel + ' / 150'],
      ['Smooth flying', result.parts.smooth + ' / 100']
    ];
    var y = by + 140;
    for (var i = 0; i < rows.length; i++) {
      text(g, rows[i][0], bx + 60, y, 16, '#cfd6e4', 'left', '700');
      text(g, rows[i][1], bx + bw - 60, y, 16, '#fff', 'right', '800');
      y += 32;
    }
    text(g, 'TOTAL  ' + result.total + '  /  1000', W / 2, by + bh - 58, 22, AMBER, 'center', '900');
    caption(g, 'Click or press Enter for the next run', W / 2, H - 60, 19);
  }

  function drawCrash(g, W, H, cause) {
    g.fillStyle = 'rgba(20,8,10,0.55)';
    g.fillRect(0, 0, W, H);
    drawBanner(g, W, H, ['DOWN IN THE BUSH', 'Cause: ' + cause, 'The Caravan is tough — she will fly again.'], RED);
    caption(g, 'Press R to try again, Esc for the menu', W / 2, H * 0.62, 19);
  }

  return {
    drawPanel: drawPanel, drawTopBar: drawTopBar, drawGuidance: drawGuidance,
    drawBanner: drawBanner, drawTitle: drawTitle, drawSelect: drawSelect,
    drawBrief: drawBrief, drawDebrief: drawDebrief, drawCrash: drawCrash,
    caption: caption, text: text
  };
})();
