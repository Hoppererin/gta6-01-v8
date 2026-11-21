// Isla Fortuna — police.js
// Wanted stars are DERIVED from heat (thresholds in config.js) — nothing
// ever adds a star directly. Heat decays when the player lays low.

import { WANTED_THRESHOLDS, PED_HIT_HEAT } from './config.js';
import { dist, angleTo, angleDiff, clamp, randRange } from './random.js';
import { nearestRoadPoint, isWater } from './city.js';

// Named FCPD units: callsign + tactical role, shown in the dispatch panel.
export const POLICE_UNITS = [
  { call: 'MARLIN-2', role: 'RAMMING' }, { call: 'TARPON-38', role: 'RAMMING' },
  { call: 'BULWARK-1', role: 'ROADBLOCK' }, { call: 'KITE-1', role: 'MARKSMAN' },
  { call: 'CORAL-48', role: 'SHORE WATCH' }, { call: 'GECKO-25', role: 'PIT' },
  { call: 'PELICAN-11', role: 'PURSUIT' }, { call: 'BARRACUDA-18', role: 'FIRING' },
  { call: 'TAC-45', role: 'ROADBLOCK' }, { call: 'REEF-7', role: 'PURSUIT' },
  { call: 'DOLPHIN-3', role: 'SHORE WATCH' }, { call: 'SARGASSO-9', role: 'PIT' },
];
let unitCursor = 0;
function nextUnit() { const u = POLICE_UNITS[unitCursor % POLICE_UNITS.length]; unitCursor += 1; return u; }

export function wantedFromHeat(heat) {
  let w = 0;
  for (let i = 0; i < WANTED_THRESHOLDS.length; i++) if (heat >= WANTED_THRESHOLDS[i]) w = i + 1;
  return w;
}

export function commitCrime(world, heatAmount) {
  world.heat = clamp(world.heat + heatAmount, 0, 100);
  world.lastCrime = world.playTime;
  world.wanted = wantedFromHeat(world.heat);
}

export function pedHitCrime(world) {
  commitCrime(world, PED_HIT_HEAT); // +5 heat, no direct star
}

export function updateWanted(world, dt) {
  const quietFor = world.playTime - world.lastCrime;
  const policeNear = world.police.some((p) => dist(p.x, p.y, world.player.x, world.player.y) < 420);
  if (quietFor > 4) {
    let rate = 1.6;
    if (world.crew.leo) rate *= 2;
    if (!policeNear) rate = 3.0 * (world.crew.leo ? 2 : 1);
    world.heat = clamp(world.heat - rate * dt, 0, 100);
  }
  world.wanted = wantedFromHeat(world.heat);
}

function makePoliceCar(world, x, y) {
  const u = nextUnit();
  return {
    type: 'police', x, y, angle: 0, speed: 0,
    color: '#1c2733', w: 48, h: 22, ramCooldown: 0, stuck: 0,
    call: u.call, role: u.role, hp: 3, disabled: false,
  };
}
function makePoliceBoat(world, x, y) {
  const u = nextUnit();
  return {
    type: 'policeBoat', x, y, angle: 0, speed: 0,
    color: '#1c2733', w: 64, h: 26, ramCooldown: 0,
    call: u.call, role: 'SHORE WATCH', hp: 3, disabled: false,
  };
}

// --- Police helicopter (AIR-1) ----------------------------------------------
// At 3+ wanted stars the FCPD puts an air unit over the player: it hovers,
// follows, and keeps a spotlight on the suspect. It never lands.
export function updateHeli(world, dt) {
  const pl = world.player;
  if (world.wanted >= 3 && world.started && !world.busted) {
    if (!world.heli) {
      world.heli = { x: pl.x - 260, y: pl.y - 180, z: 170, angle: 0, rotor: 0, spotlight: true };
      world.dialogue.push({ who: 'FCPD Dispatch', text: 'AIR-1 is overhead — spotlight on the suspect. All units converge.' });
    }
    const h = world.heli;
    const tx = pl.x - 90, ty = pl.y - 60;
    h.x += (tx - h.x) * Math.min(1, dt * 0.7);
    h.y += (ty - h.y) * Math.min(1, dt * 0.7);
    h.z += (170 - h.z) * Math.min(1, dt * 0.5);
    h.angle = angleTo(h.x, h.y, pl.x, pl.y);
    h.rotor += dt * 22;
  } else if (world.heli) {
    // Wanted dropped: the air unit climbs away and leaves.
    const h = world.heli;
    h.z += 90 * dt;
    h.rotor += dt * 22;
    if (h.z > 420) world.heli = null;
  }
}

export function updatePolice(world, dt) {
  const pl = world.player;
  const want = world.wanted;
  const inBoat = pl.vehicle && pl.vehicle.type === 'boat';
  // Desired count: one police car per wanted star on land, boats instead when the player is on water.
  const wantCars = inBoat ? 0 : want;
  const wantBoats = inBoat ? Math.max(1, Math.min(2, want)) : 0;
  const cars = world.police.filter((p) => p.type === 'police');
  const boats = world.police.filter((p) => p.type === 'policeBoat');
  if (want > 0 && world.playTime - (world.lastPoliceSpawn || 0) > 2.5) {
    if (cars.length < wantCars) {
      const rp = nearestRoadPoint(pl.x + (world.rng() < 0.5 ? -420 : 420), pl.y + (world.rng() < 0.5 ? -320 : 320));
      // Never spawn a police car in the water: road x=350 crosses the
      // harbour basin, and a car spawned there can never move. Skip this
      // tick instead; the next spawn retry (2.5 s) picks a fresh point.
      // (Verified post-fix: water spawn points are skipped, dry ones still spawn.)
      // witness: final content verified 2026-11-20
      if (rp && !isWater(rp.x, rp.y)) world.police.push(makePoliceCar(world, rp.x, rp.y));
      world.lastPoliceSpawn = world.playTime;
    } else if (boats.length < wantBoats) {
      world.police.push(makePoliceBoat(world, pl.x + 300, pl.y + 200));
      world.lastPoliceSpawn = world.playTime;
    }
  }
  if (want === 0 && world.police.length) {
    // Heat gone: the cops GIVE UP. They drive away from the player and
    // leave the area — they must never keep chasing/ramming at 0 stars.
    for (const p of world.police) {
      const away = angleTo(pl.x, pl.y, p.x, p.y);
      p.angle += clamp(angleDiff(p.angle, away), -2.4 * dt, 2.4 * dt);
      p.speed = Math.min(p.speed + 200 * dt, 240);
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (p.type === 'policeBoat') { if (isWater(nx, ny)) { p.x = nx; p.y = ny; } }
      else if (!isWater(nx, ny)) { p.x = nx; p.y = ny; }
    }
    world.police = world.police.filter((p) => dist(p.x, p.y, pl.x, pl.y) < 700);
    return;
  }
  if (want === 0) return;
  for (const p of world.police) {
    if (p.disabled) { p.speed *= 0.9; continue; } // shot-out unit: dead in the water, smoking
    p.ramCooldown -= dt;
    const d = dist(p.x, p.y, pl.x, pl.y);
    const targetAngle = angleTo(p.x, p.y, pl.x, pl.y);
    const turn = clamp(angleDiff(p.angle, targetAngle), -2.4 * dt, 2.4 * dt);
    p.angle += turn;
    const top = p.type === 'policeBoat' ? 300 : 330;
    const desired = d > 60 ? top : 120;
    p.speed += (desired - p.speed) * Math.min(1, dt * 1.2);
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    if (p.type === 'policeBoat') {
      if (isWater(nx, ny)) { p.x = nx; p.y = ny; }
    } else if (!isWater(nx, ny)) {
      p.x = nx; p.y = ny;
    } else {
      p.speed *= 0.4; // cop will not drive into the sea; turns away
      p.angle += 1.6 * dt;
    }
    // Ram: bump the player and hurt them, with a cooldown.
    if (d < 46 && p.ramCooldown <= 0) {
      p.ramCooldown = 1.2;
      pl.hp = Math.max(0, pl.hp - 6);
      const push = angleTo(p.x, p.y, pl.x, pl.y);
      pl.x += Math.cos(push) * 26;
      pl.y += Math.sin(push) * 26;
      if (world.audio) world.audio.crash();
      if (pl.hp <= 0) world.busted = true;
    }
  }
  // Despawn far-away cops once wanted is gone.
  if (want === 0) world.police = world.police.filter((p) => dist(p.x, p.y, pl.x, pl.y) < 700);
}
