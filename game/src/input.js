// Isla Fortuna — input.js
// Keyboard state, edge-triggered presses, and a tiny on-screen touch note.
// No imports.

export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, consumed once per frame
  const input = {
    keys, pressed,
    up: false, down: false, left: false, right: false,
    downKey(code) { keys.add(code); pressed.add(code); },
    upKey(code) { keys.delete(code); },
    // Call once per frame after the game has read `pressed`, so each edge-triggered key fires exactly once.
    endFrame() { pressed.clear(); },
    wasPressed(code) { return pressed.has(code); },
    // Directional helpers (WASD + arrows).
    axis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
  };
  return input;
}

export function attachInput(input, target) {
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.downKey(e.code);
  };
  const up = (e) => input.upKey(e.code);
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}
