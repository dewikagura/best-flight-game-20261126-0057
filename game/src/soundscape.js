// soundscape.js — all sound is synthesised with WebAudio: no audio files,
// no downloads. Engine drone, wind, stall warning, touchdown thud, chimes
// and thunder. The context starts on the first user gesture; until then the
// game is silent by design.
var CA = window.CA || (window.CA = {});

CA.Soundscape = (function () {
  var ctx = null, master = null, engineOsc = null, engineOsc2 = null,
    engineGain = null, engineFilter = null, windSrc = null, windGain = null,
    windFilter = null, muted = false, started = false, lastStallBeep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55.7;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Wind: looped white noise through a bandpass, gain follows airspeed.
      var len = ctx.sampleRate * 2;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf; windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSrc.start();
      started = true;
      return true;
    } catch (e) { return false; }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  // Call every frame with the plane's state.
  function update(throttle, airspeed, stalled, onGround) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var rpm = 50 + throttle * 95;
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(rpm * 1.012 + 1.5, t, 0.08);
    engineFilter.frequency.setTargetAtTime(300 + throttle * 900, t, 0.1);
    var target = onGround ? throttle * 0.05 : 0.04 + throttle * 0.1;
    engineGain.gain.setTargetAtTime(target, t, 0.1);
    var windTarget = Math.min(0.16, Math.max(0, (airspeed - 15) / 500));
    windGain.gain.setTargetAtTime(windTarget, t, 0.15);
    windFilter.frequency.setTargetAtTime(300 + airspeed * 8, t, 0.15);
    // Stall warning: a short beep every half second while the wing is
    // stalled and airborne. The parameter was passed in but never used,
    // so the warning used to stay silent.
    if (stalled && !onGround && t - lastStallBeep > 0.45) {
      lastStallBeep = t;
      stallBeep();
    }
  }

  function blip(freq, dur, vol, type) {
    if (!ctx || muted) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol || 0.12;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) {}
  }

  function thud() {
    if (!ctx || muted) return;
    try {
      var len = ctx.sampleRate * 0.25;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var s = ctx.createBufferSource(); s.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      var g = ctx.createGain(); g.gain.value = 0.5;
      s.connect(f); f.connect(g); g.connect(master);
      s.start();
    } catch (e) {}
  }

  function chime() {
    if (!ctx || muted) return;
    var notes = [523.25, 659.25, 783.99, 1046.5];
    for (var i = 0; i < notes.length; i++) {
      (function (f, delay) {
        setTimeout(function () { blip(f, 0.5, 0.14, 'triangle'); }, delay);
      })(notes[i], i * 110);
    }
  }

  function thunder() {
    if (!ctx || muted) return;
    try {
      var len = ctx.sampleRate * 1.4;
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      var s = ctx.createBufferSource(); s.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 120;
      var g = ctx.createGain(); g.gain.value = 0.4;
      s.connect(f); f.connect(g); g.connect(master);
      s.start();
    } catch (e) {}
  }

  function stallBeep() { blip(880, 0.12, 0.1, 'square'); }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }

  return {
    ensure: ensure, resume: resume, update: update, blip: blip,
    thud: thud, chime: chime, thunder: thunder, stallBeep: stallBeep,
    setMuted: setMuted, isMuted: function () { return muted; },
    isStarted: function () { return started; }
  };
})();
