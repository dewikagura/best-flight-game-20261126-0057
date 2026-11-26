// Cendrawasih Airlift — input: keyboard, mouse and touch, all feeding one
// small state object the physics reads every frame. Nothing here touches
// the game logic; it only reports what the pilot is doing.
'use strict';

function newInput() {
  return {
    pitchUp: false,
    pitchDown: false,
    throttleUp: false,
    throttleDown: false,
    pitchSet: null, // pointer steering target, or null
    throttleSet: null,
    pointerDown: false,
    pointerX: 0,
    pointerY: 0,
    dropQueued: false,
    pauseQueued: false,
    startQueued: false,
    restartQueued: false,
    muteQueued: false,
  };
}

const KEYMAP = {
  ArrowUp: 'pitchUp',
  KeyW: 'pitchUp',
  ArrowDown: 'pitchDown',
  KeyS: 'pitchDown',
  ArrowRight: 'throttleUp',
  KeyD: 'throttleUp',
  ArrowLeft: 'throttleDown',
  KeyA: 'throttleDown',
};

// Wire keyboard + pointer events on the canvas. Returns the input state.
function attachInput(canvas, input) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'Space') {
      input.dropQueued = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyP') {
      input.pauseQueued = true;
      return;
    }
    if (event.code === 'Enter') {
      input.startQueued = true;
      return;
    }
    if (event.code === 'KeyR') {
      input.restartQueued = true;
      return;
    }
    if (event.code === 'KeyM') {
      input.muteQueued = true;
      return;
    }
    const field = KEYMAP[event.code];
    if (field) {
      input[field] = true;
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    const field = KEYMAP[event.code];
    if (field) input[field] = false;
  });

  // Pointer drag steers: horizontal position sets the pitch target,
  // vertical position sets the throttle. A quick tap drops cargo.
  canvas.addEventListener('pointerdown', (event) => {
    input.pointerDown = true;
    updatePointer(input, canvas, event);
  });
  window.addEventListener('pointermove', (event) => {
    if (input.pointerDown) updatePointer(input, canvas, event);
  });
  window.addEventListener('pointerup', () => {
    input.pointerDown = false;
    input.pitchSet = null;
    input.throttleSet = null;
  });
  window.addEventListener('pointercancel', () => {
    input.pointerDown = false;
    input.pitchSet = null;
    input.throttleSet = null;
  });

  return input;
}

// Turn a pointer position into a pitch and throttle target.
// Vertical position steers (up = climb, down = dive); horizontal position
// sets the throttle (right = more power). The plane follows the finger.
function updatePointer(input, canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  input.pointerX = x;
  input.pointerY = y;
  const planeScreenY = 0.55;
  input.pitchSet = (y - planeScreenY) * 2.2;
  input.throttleSet = Math.max(0, Math.min(1, x));
}
