// Isla Fortuna v8 — weapons.js
// Weapon slots + hitscan shooting. Four slots: fists (always), pistol,
// SMG, shotgun (locked until job 9). Keys 1–4 select; click shoots.
// Shooting is a hitscan cone along the camera forward ray: it can drop
// rivals and disable police cars (hp 3). Every shot is a crime (+2 heat).

import { dist, angleTo, angleDiff, clamp } from './random.js';
import { commitCrime } from './police.js';

export const WEAPONS = [
  { name: 'FISTS', key: '1', range: 62, damage: 1, spread: 0.10, cooldown: 0.45, ammo: Infinity },
  { name: 'PISTOL', key: '2', range: 520, damage: 1, spread: 0.05, cooldown: 0.32, ammo: 60 },
  { name: 'SMG', key: '3', range: 420, damage: 1, spread: 0.11, cooldown: 0.11, ammo: 120 },
  { name: 'SHOTGUN', key: '4', range: 300, damage: 3, spread: 0.22, cooldown: 0.85, ammo: 12 },
];

export function selectWeapon(world, slot) {
  const w = world.weapons;
  if (slot < 0 || slot > 3) return false;
  if (!w.unlocked[slot]) {
    world.dialogue.push({ who: 'Marisol', text: `${WEAPONS[slot].name} is locked — finish more jobs to unlock it.` });
    return false;
  }
  if (w.slot === slot) return true;
  w.slot = slot;
  w.cooldown = 0;
  if (world.audio) world.audio.click();
  return true;
}

// Aim direction: the camera forward ray (render3d stores it on the world
// each frame); falls back to the player's facing angle.
export function aimAngle(world) {
  if (world.camDir) return Math.atan2(world.camDir.z, world.camDir.x);
  return world.player.angle;
}

// Fire the selected weapon once. Returns true if a shot went off.
export function shoot(world) {
  const w = world.weapons;
  const pl = world.player;
  if (!world.started || world.paused || world.busted) return false;
  if (pl.vehicle) return false; // no drive-by shooting in v8
  if (w.cooldown > 0) return false;
  const def = WEAPONS[w.slot];
  if (w.slot === 0) return false; // fists use Space (punch), not the mouse
  if (w.ammo[w.slot] <= 0) {
    world.dialogue.push({ who: 'Dante', text: `${def.name} is dry — grab ammo from a job reward.` });
    w.cooldown = 0.3;
    return false;
  }
  w.cooldown = def.cooldown;
  w.ammo[w.slot] -= 1;
  w.flash = 0.09;
  commitCrime(world, 2);
  if (world.audio) world.audio.punch();
  const a = aimAngle(world);
  const ox = pl.x, oy = pl.y;
  const ex = ox + Math.cos(a) * def.range, ey = oy + Math.sin(a) * def.range;
  w.tracers = w.tracers || [];
  w.tracers.push({ x1: ox, y1: oy, x2: ex, y2: ey, ttl: 0.12 });
  // Hitscan: nearest rival / police unit inside the cone.
  const cone = def.spread + 0.04;
  let best = null, bestD = Infinity;
  const consider = (x, y, obj, kind) => {
    const d = dist(ox, oy, x, y);
    if (d > def.range || d > bestD) return;
    if (Math.abs(angleDiff(a, angleTo(ox, oy, x, y))) > cone) return;
    best = { obj, kind, d }; bestD = d;
  };
  for (const r of world.rivals) consider(r.x, r.y, r, 'rival');
  for (const p of world.police) consider(p.x, p.y, p, 'police');
  if (best) {
    w.tracers[w.tracers.length - 1].x2 = best.obj.x;
    w.tracers[w.tracers.length - 1].y2 = best.obj.y;
    best.obj.hp -= def.damage;
    best.obj.hitFlash = 0.3;
    if (best.kind === 'police' && best.obj.hp <= 0 && !best.obj.disabled) {
      best.obj.disabled = true;
      best.obj.speed = 0;
      world.dialogue.push({ who: 'FCPD Dispatch', text: `${best.obj.call || 'Unit'} is disabled — send a tow, all units stay sharp.` });
    }
    if (best.kind === 'rival' && best.obj.hp <= 0 && world.audio) world.audio.pickup();
  }
  return true;
}

// Per-frame weapon timers (called from the main loop, after stepWorld).
export function updateWeapons(world, dt) {
  const w = world.weapons;
  if (w.cooldown > 0) w.cooldown -= dt;
  if (w.tracers) {
    for (const t of w.tracers) t.ttl -= dt;
    w.tracers = w.tracers.filter((t) => t.ttl > 0);
  }
}

// Ammo top-up from job rewards: +24 pistol, +48 SMG, +6 shotgun.
export function restockAmmo(world) {
  const w = world.weapons;
  w.ammo[1] = Math.min(60, w.ammo[1] + 24);
  w.ammo[2] = Math.min(120, w.ammo[2] + 48);
  w.ammo[3] = Math.min(12, w.ammo[3] + 6);
}

export function respectRank(respect) {
  if (respect >= 500) return { name: 'KINGPIN', next: 500, max: 500 };
  if (respect >= 250) return { name: 'SHOT CALLER', next: 500, max: 500 };
  if (respect >= 100) return { name: 'DRIVER', next: 250, max: 250 };
  return { name: 'ROOKIE', next: 100, max: 100 };
}

export function clamp01(v) { return clamp(v, 0, 1); }
