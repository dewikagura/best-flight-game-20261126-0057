// islands.js — the Papua island chain: seeded terrain, airstrips, villages,
// painted surfaces and the toon look (ink outlines, warm/cool palettes,
// three-stop skies, layered clouds). Static art is painted once per mission
// into offscreen canvases and reused every frame, so the frame stays cheap.
var CA = window.CA || (window.CA = {});

CA.Islands = (function () {
  var INK = '#1a1424'; // warm dark brown ink, never pure black
  var INK_NIGHT = '#0c0c1e';

  // Small deterministic RNG (mulberry32).
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Time-of-day palettes: one warm/cool pair per mood, terrain and sky in
  // the same style. Night stays luminous ultramarine, never black.
  var PALETTES = {
    day: {
      sky: ['#7ec8f2', '#a8dcf5', '#e8f4f8'], sun: '#ffd76a', sunCore: '#fff6c8',
      sea: ['#2fae9e', '#1d8f8a'], sand: '#f2dfa8', grass: ['#7ec850', '#5da83c'],
      jungle: ['#3f9150', '#2f7a44'], rock: ['#9a8a7a', '#7d6f61'],
      ink: INK, fog: 'rgba(232,244,248,0.55)', light: 1
    },
    dusk: {
      sky: ['#ff9a5c', '#ffb27a', '#ffe3b3'], sun: '#ff7a3c', sunCore: '#fff0c0',
      sea: ['#e07a5f', '#b45a6e'], sand: '#eec88f', grass: ['#8fae4e', '#6d8f3a'],
      jungle: ['#5d7f45', '#47663a'], rock: ['#8a6f63', '#6e564c'],
      ink: '#1e0f14', fog: 'rgba(255,178,122,0.5)', light: 0.85
    },
    night: {
      sky: ['#141a5a', '#2a3a9a', '#5a6ad0'], sun: '#f4ead0', sunCore: '#fffbe8',
      sea: ['#1d3a6e', '#142a55'], sand: '#8a7f66', grass: ['#2f5a3f', '#24452f'],
      jungle: ['#1f4a33', '#173826'], rock: ['#4a4460', '#38334a'],
      ink: INK_NIGHT, fog: 'rgba(42,58,154,0.5)', light: 0.6
    },
    storm: {
      sky: ['#5a6e6e', '#7d8f8a', '#a8b5a8'], sun: '#cfd8c8', sunCore: '#e8ece0',
      sea: ['#3a6e6e', '#2a5555'], sand: '#b8a888', grass: ['#5d7f4a', '#4a6a3c'],
      jungle: ['#3a6a44', '#2c5236'], rock: ['#6e6a62', '#57534c'],
      ink: '#0a1420', fog: 'rgba(125,143,138,0.6)', light: 0.7
    }
  };

  // Build one mission's world: a chain of islands with strips and villages.
  // legs: [{ name, distKm, stripLen, stripKind, village, mountain }]
  function buildWorld(mission, seed) {
    var rand = rng(seed);
    var islands = [];
    var x = 0;
    var stripX = [];
    mission.legs.forEach(function (leg, i) {
      var len = Math.max(4200, leg.distKm * 1000); // every island is real land
      var isle = {
        name: leg.name, x0: x, x1: x + len,
        peaks: [], strip: null, village: null, mountain: !!leg.mountain
      };
      var nPeaks = 3 + Math.floor(rand() * 3);
      for (var k = 0; k < nPeaks; k++) {
        isle.peaks.push({
          cx: x + len * (0.12 + 0.76 * rand()),
          h: (leg.mountain ? 150 + rand() * 170 : 30 + rand() * 40),
          w: len * (0.28 + rand() * 0.18)
        });
      }
      // Airstrip near the far end of each leg's island (or the start island).
      var sx = (i === 0) ? x + 420 : x + len - 420 - leg.stripLen;
      isle.strip = {
        x: sx, len: leg.stripLen, kind: leg.stripKind || 'grass',
        lights: mission.tod === 'night'
      };
      stripX.push(sx + leg.stripLen / 2);
      if (leg.village !== false) {
        isle.village = {
          x: sx + leg.stripLen + 260 + rand() * 300,
          huts: 3 + Math.floor(rand() * 4), palms: 4 + Math.floor(rand() * 5)
        };
      }
      islands.push(isle);
      x += len + 2600 + rand() * 2400; // sea gap between islands
    });
    var world = {
      islands: islands, length: x, seed: seed,
      palette: PALETTES[mission.tod] || PALETTES.day,
      tod: mission.tod, stripCenters: stripX
    };
    world.heightAt = function (wx) { return heightAt(world, wx); };
    world.stripAt = function (wx) {
      for (var i = 0; i < islands.length; i++) {
        var s = islands[i].strip;
        if (wx >= s.x - 30 && wx <= s.x + s.len + 30) return s;
      }
      return null;
    };
    return world;
  }

  function heightAt(world, wx) {
    var h = 0;
    for (var i = 0; i < world.islands.length; i++) {
      var isle = world.islands[i];
      if (wx < isle.x0 - 400 || wx > isle.x1 + 400) continue;
      // Beach ramps at the edges, gaussian peaks inside.
      var edge = 1;
      if (wx < isle.x0 + 500) edge = Math.max(0, (wx - isle.x0) / 500);
      else if (wx > isle.x1 - 500) edge = Math.max(0, (isle.x1 - wx) / 500);
      var base = 14 * edge;
      // Rolling jungle floor: broad low bumps so the island reads as
      // rolling hills, not one pointy triangle.
      base += 16 * (0.5 + 0.5 * Math.sin(wx * 0.0011 + isle.x0 * 0.001));
      base += 10 * (0.5 + 0.5 * Math.sin(wx * 0.0027 + 1.7));
      for (var k = 0; k < isle.peaks.length; k++) {
        var pk = isle.peaks[k];
        var d = (wx - pk.cx) / pk.w;
        base += pk.h * Math.exp(-d * d);
      }
      // Keep the strip itself flat: carve a level shelf around it.
      var s = isle.strip;
      if (wx > s.x - 160 && wx < s.x + s.len + 160) {
        var t = wx < s.x ? (wx - (s.x - 160)) / 160 : (wx > s.x + s.len ? ((s.x + s.len + 160) - wx) / 160 : 1);
        base = base * (1 - t) + 26 * t;
      }
      h = Math.max(h, base);
    }
    return h;
  }

  // Paint one island's terrain into an offscreen canvas, once per mission.
  // Painted surfaces: value drift in bands, a light top edge, ink silhouette.
  function paintIsland(world, isle, pxPerM, groundY) {
    var w = Math.ceil((isle.x1 - isle.x0) * pxPerM) + 4;
    var h = Math.ceil(groundY * pxPerM) + 4;
    var cv = document.createElement('canvas');
    cv.width = Math.max(2, w); cv.height = Math.max(2, h);
    var g = cv.getContext('2d');
    var pal = world.palette;
    var step = 6; // metres per sample
    g.beginPath();
    g.moveTo(0, h);
    var pts = [];
    for (var wx = isle.x0; wx <= isle.x1; wx += step) {
      var th = heightAt(world, wx);
      var sx = (wx - isle.x0) * pxPerM;
      var sy = h - th * pxPerM;
      pts.push([sx, sy]);
      g.lineTo(sx, sy);
    }
    g.lineTo(w, h);
    g.closePath();
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, pal.grass[0]);
    grad.addColorStop(0.55, pal.jungle[0]);
    grad.addColorStop(1, pal.jungle[1]);
    g.fillStyle = grad;
    g.fill();
    // Painted value drift: soft horizontal bands, darker toward the base.
    // Clipped to the terrain so the stripes never show in the sky.
    g.save();
    g.clip();
    g.globalAlpha = 0.16;
    for (var b = 0; b < 5; b++) {
      g.fillStyle = b % 2 ? pal.jungle[1] : pal.grass[1];
      g.fillRect(0, h * (0.35 + b * 0.13), w, h * 0.06);
    }
    g.restore();
    g.globalAlpha = 1;
    // Beach sand at the waterline.
    g.fillStyle = pal.sand;
    g.beginPath();
    g.moveTo(0, h);
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][1] > h - 26 * pxPerM) g.lineTo(pts[i][0], pts[i][1]);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    // Ink silhouette along the top, 3 px, warm brown.
    g.strokeStyle = pal.ink;
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var j = 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]);
    g.stroke();
    // Light top edge: a 1-2 px sunlit bevel under the ink.
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1] + 4);
    for (var m = 1; m < pts.length; m++) g.lineTo(pts[m][0], pts[m][1] + 4);
    g.stroke();
    return { canvas: cv, x0: isle.x0, width: w, height: h, pxPerM: pxPerM };
  }

  // One soft painterly cloud sprite, reused at three depths.
  function paintCloud(pal, seed) {
    var r = rng(seed);
    var cv = document.createElement('canvas');
    cv.width = 220; cv.height = 90;
    var g = cv.getContext('2d');
    var lobes = 5 + Math.floor(r() * 3);
    for (var i = 0; i < lobes; i++) {
      var cx = 30 + r() * 160, cy = 45 + (r() - 0.5) * 22, rad = 18 + r() * 26;
      var grad = g.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
    }
    return cv;
  }

  return {
    buildWorld: buildWorld, heightAt: heightAt, paintIsland: paintIsland,
    paintCloud: paintCloud, PALETTES: PALETTES, rng: rng
  };
})();
