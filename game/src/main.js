// Isla Fortuna v8 — main.js
// Entry point: WebGL canvas + DOM HUD, game loop, keyboard + mouse,
// save/load, the ?shot= screenshot mode, and the window.__isla debug hook.

import { createWorld, startGame, stepWorld, saveGame, loadGame, enterVehicle, exitVehicle, punch, nearestVehicle, retryAfterBusted } from './world.js';
import { createInput, attachInput } from './input.js';
import { createAudio } from './audio.js';
import { startMission, currentMission, missionTarget, MISSIONS } from './missions.js';
import { hire } from './crew.js';
import { createRenderer3d } from './render3d.js';
import { buildHUD, updateHUD } from './hud.js';
import { selectWeapon, shoot, updateWeapons } from './weapons.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('game');
const hudRefs = buildHUD();

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const world = createWorld(seed);
world.viewW = canvas.width;
world.viewH = canvas.height;
const input = createInput();
attachInput(input, window);
const audio = createAudio();
world.audio = audio;
world.input = input;
const renderer3d = createRenderer3d(canvas, world);
renderer3d.setSize(canvas.width, canvas.height);

// Mouse: hold to fire the selected gun (fists use Space).
let mouseHeld = false;
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouseHeld = true; shoot(world); } });
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseHeld = false; });
window.addEventListener('blur', () => { mouseHeld = false; });

// Debug / automation hook: the playtest bot reads positions and mission state here and steers the player with real keyboard input.
window.__isla = {
  world,
  renderer3d,
  version: 'v8',
  missions: MISSIONS,
  state() {
    const t = missionTarget(world);
    const m = currentMission(world);
    return {
      px: Math.round(world.player.x), py: Math.round(world.player.y),
      angle: world.player.angle, speed: Math.round(world.player.speed || 0),
      hp: Math.round(world.player.hp),
      inCar: !!(world.player.vehicle && world.player.vehicle.type !== 'boat'),
      inBoat: !!(world.player.vehicle && world.player.vehicle.type === 'boat'),
      vehicle: world.player.vehicle ? { type: world.player.vehicle.type, x: Math.round(world.player.vehicle.x), y: Math.round(world.player.vehicle.y) } : null,
      missionIndex: world.missionIndex, missionStep: world.missionStep,
      missionName: m ? m.name : null,
      missionTime: +(world.missionTime || 0).toFixed(2),
      missionTimer: world.missionTimer === null ? null : +(world.missionTimer || 0).toFixed(1),
      missionDone: world.missionDone, missionFailed: world.missionFailed,
      objective: world.objective,
      target: t ? { x: Math.round(t.x), y: Math.round(t.y), label: t.label } : null,
      wanted: world.wanted, heat: Math.round(world.heat),
      cash: world.cash, time: +world.time.toFixed(2), weather: world.weather,
      started: world.started, paused: world.paused, busted: world.busted,
      finale: world.finale, playTime: +(world.playTime || 0).toFixed(1),
      rivals: world.rivals.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), hp: r.hp })),
      police: world.police.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), type: p.type })),
      vehicles: world.vehicles.map((v) => ({ id: v.id, type: v.type, x: Math.round(v.x), y: Math.round(v.y) })),
      crew: { ...world.crew },
      dialogue: world.dialogue.length ? world.dialogue[world.dialogue.length - 1] : null,
      respect: world.respect, weaponSlot: world.weapons.slot,
      heli: world.heli ? { x: Math.round(world.heli.x), y: Math.round(world.heli.y) } : null,
      renderScale: renderer3d.renderScale(),
    };
  },
  startMission(i) { startMission(world, i); },
  teleport(x, y) { world.player.x = x; world.player.y = y; if (world.player.vehicle) { world.player.vehicle.x = x; world.player.vehicle.y = y; } },
  setHeat(h) { world.heat = h; },
};

function handleKeys() {
  // Title screen.
  if (!world.started) {
    if (input.wasPressed('Enter')) { audio.resume(); startGame(world); }
    if (input.wasPressed('KeyL')) {
      if (loadGame(world)) world.dialogue.push({ who: 'Marisol', text: 'Save loaded. Press Enter to continue.' });
    }
    return;
  }
  // Busted / failed: R retries the current job.
  if (world.busted && input.wasPressed('KeyR')) { retryAfterBusted(world); return; }
  if (world.missionFailed && input.wasPressed('KeyR')) {
    world.missionFailed = false;
    world.heat = 0; world.wanted = 0; world.lastCrime = -999;
    startMission(world, world.missionIndex);
    return;
  }
  if (input.wasPressed('KeyP')) { world.paused = !world.paused; audio.click(); }
  if (input.wasPressed('KeyM')) {
    world.muted = !world.muted;
    audio.setMuted(world.muted);
  }
  if (world.paused) {
    if (input.wasPressed('Digit1')) { const r = hire(world, 'mara'); world.dialogue.push({ who: 'Marisol', text: r.msg }); }
    if (input.wasPressed('Digit2')) { const r = hire(world, 'leo'); world.dialogue.push({ who: 'Marisol', text: r.msg }); }
    if (input.wasPressed('Digit3')) { const r = hire(world, 'ada'); world.dialogue.push({ who: 'Marisol', text: r.msg }); }
    if (input.wasPressed('KeyS')) { saveGame(world); world.dialogue.push({ who: 'Marisol', text: 'Game saved.' }); }
    if (input.wasPressed('KeyL')) {
      if (loadGame(world)) { world.dialogue.push({ who: 'Marisol', text: 'Save loaded.' }); startMission(world, world.missionIndex); }
    }
    return;
  }
  // Weapon slots 1–4 (only when not paused; 1–3 hire crew in the pause menu).
  if (input.wasPressed('Digit1')) selectWeapon(world, 0);
  if (input.wasPressed('Digit2')) selectWeapon(world, 1);
  if (input.wasPressed('Digit3')) selectWeapon(world, 2);
  if (input.wasPressed('Digit4')) selectWeapon(world, 3);
  if (input.wasPressed('KeyE')) {
    if (world.player.vehicle) exitVehicle(world);
    else {
      const v = nearestVehicle(world, 85);
      if (v) enterVehicle(world, v);
    }
  }
  if (input.wasPressed('Space')) punch(world);
  if (input.wasPressed('KeyH') && world.player.vehicle) audio.horn();
  if (input.wasPressed('KeyR') && world.missionFailed) {
    startMission(world, world.missionIndex);
  }
}

let last = performance.now();
let lastScaleCheck = 0;
let emaRawDt = 0.016;
function frame(now) {
  const rawDt = (now - last) / 1000;
  const dt = Math.min(rawDt, 0.05);
  last = now;
  world.viewW = canvas.width;
  world.viewH = canvas.height;
  // Buffer size is logical size x render scale; re-sync only if it drifted.
  const expectW = Math.max(1, Math.round(canvas.width * renderer3d.renderScale()));
  const expectH = Math.max(1, Math.round(canvas.height * renderer3d.renderScale()));
  if (renderer3d.renderer.domElement.width !== expectW || renderer3d.renderer.domElement.height !== expectH) {
    renderer3d.setSize(canvas.width, canvas.height);
  }
  // Adaptive resolution: every 3s, drop the render scale while frames are
  // slow (software renderer), climb back when there is headroom. Uses the
  // RAW frame time (dt is clamped and would hide slowness). Time-based, not
  // frame-based, so it still converges when fps is very low.
  emaRawDt = emaRawDt * 0.9 + Math.min(rawDt, 0.5) * 0.1;
  if (!lastScaleCheck) lastScaleCheck = now;
  if (now - lastScaleCheck > 3000) {
    lastScaleCheck = now;
    const fps = 1 / Math.max(emaRawDt, 0.001);
    const s = renderer3d.renderScale();
    if (fps < 15 && s > 0.3) renderer3d.setRenderScale(s * 0.7);
    else if (fps < 25 && s > 0.3) renderer3d.setRenderScale(s * 0.85);
    else if (fps > 50 && s < 1) renderer3d.setRenderScale(Math.min(1, s * 1.25));
  }
  handleKeys();
  stepWorld(world, input, dt);
  updateWeapons(world, dt);
  if (mouseHeld) shoot(world);
  audio.musicTick(dt);
  renderer3d.render(world, dt, now / 1000);
  updateHUD(hudRefs, world);
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: staged scene, a few settle frames, no game loop —
  // the scene is exactly what runShot() set up.
  audio.muted = true;
  runShot(world, shotName);
  world.viewW = 1280; world.viewH = 720;
  canvas.width = 1280; canvas.height = 720;
  renderer3d.setRenderScale(1); // screenshots always at full resolution
  renderer3d.setSize(1280, 720);
  updateHUD(hudRefs, world);
  renderer3d.render(world, 0.016, 1);
  requestAnimationFrame(() => {
    renderer3d.render(world, 0.016, 1.05);
    updateHUD(hudRefs, world);
    document.title = `Isla Fortuna v8 — shot ${shotName}`;
  });
} else {
  requestAnimationFrame(frame);
}
