// Cendrawasih Airlift — sound: everything is synthesised with WebAudio,
// no audio files. Engine hum follows the throttle, rings chime, the crate
// thuds, a crash is noise. Silent until the player first interacts.
'use strict';

function newAudio() {
  return {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    muted: false,
    started: false,
  };
}

// Create the context on first user gesture (browsers demand that).
function ensureAudio(audio) {
  if (audio.ctx || typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(filter);
    filter.connect(audio.engineGain);
    audio.engineGain.connect(audio.ctx.destination);
    audio.engineOsc.start();
    audio.started = true;
  } catch (err) {
    audio.ctx = null;
  }
}

// Engine hum: pitch and loudness follow throttle and speed.
function updateEngineSound(audio, plane) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const target = plane.fuel > 0 ? 0.02 + plane.throttle * 0.05 : 0;
  audio.engineGain.gain.setTargetAtTime(target, t, 0.1);
  const freq = 42 + plane.throttle * 48 + plane.speed * 0.05;
  audio.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
}

// One short tone: frequency, duration, shape, volume.
function blip(audio, freq, duration, type, volume) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume || 0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

function ringChime(audio) {
  blip(audio, 880, 0.35, 'sine', 0.16);
  setTimeout(() => blip(audio, 1318, 0.4, 'sine', 0.12), 70);
}

// A bright two-note fanfare for a finished mission.
function missionFanfare(audio) {
  blip(audio, 523, 0.25, 'sine', 0.14);
  setTimeout(() => blip(audio, 659, 0.25, 'sine', 0.14), 110);
  setTimeout(() => blip(audio, 784, 0.45, 'sine', 0.14), 220);
}

function cargoThud(audio) {
  blip(audio, 140, 0.25, 'triangle', 0.2);
}

function landingThud(audio) {
  blip(audio, 90, 0.3, 'triangle', 0.22);
  setTimeout(() => blip(audio, 660, 0.3, 'sine', 0.1), 90);
}

function crashSound(audio) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const dur = 0.7;
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * dur, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = audio.ctx.createGain();
  gain.gain.value = 0.3;
  src.connect(gain);
  gain.connect(audio.ctx.destination);
  src.start(t);
}

function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.engineGain) {
    audio.engineGain.gain.value = audio.muted ? 0 : 0.03;
  }
  return audio.muted;
}
