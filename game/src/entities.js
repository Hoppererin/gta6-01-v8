// Isla Fortuna — entities.js
// Pedestrians, traffic cars, rival gang members. Pedestrians are FEW on
// roads (most walk sidewalks) and scatter from approaching cars, so a
// normal drive does not mow people down.

import { WORLD_W, WORLD_H, LAND } from './config.js';
import { mulberry32, randRange, dist, angleTo, clamp } from './random.js';
import { isDry, onRoad, ROADS_X, ROADS_Y, isWater } from './city.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
const CAR_COLORS = ['#c0392b', '#2980b9', '#f39c12', '#7f8c8d', '#16a085', '#8e44ad', '#d35400', '#2c3e50'];

export function makePed(rng, x, y) {
  return {
    x, y, angle: randRange(rng, 0, Math.PI * 2), speed: randRange(rng, 28, 55),
    tx: x, ty: y, color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
    down: 0, downTimer: 0, scatter: 0,
  };
}

export function spawnPeds(city, rng, n) {
  const peds = [];
  let guard = 0;
  while (peds.length < n && guard++ < n * 30) {
    const x = randRange(rng, LAND.x + 60, LAND.x + LAND.w - 60);
    const y = randRange(rng, LAND.y + 60, LAND.y + LAND.h - 60);
    if (!isDry(x, y)) continue;
    // Keep most peds off the road surface: only ~1 in 5 spawns on a road.
    if (onRoad(x, y, 4) && rng() < 0.8) continue;
    peds.push(makePed(rng, x, y));
  }
  return peds;
}

export function updatePeds(world, dt) {
  const rng = world.rng;
  for (const p of world.peds) {
    if (p.down > 0) {
      p.downTimer -= dt;
      if (p.downTimer <= 0) { p.down = 0; p.x = p.tx; p.y = p.ty; }
      continue;
    }
    // Scatter away from a fast approaching car.
    const pl = world.player;
    const d = dist(p.x, p.y, pl.x, pl.y);
    const vehSpeed = Math.abs(pl.speed || 0);
    if (d < 110 && vehSpeed > 60 && !pl.onFoot) {
      const a = angleTo(pl.x, pl.y, p.x, p.y);
      p.tx = p.x + Math.cos(a) * 140;
      p.ty = p.y + Math.sin(a) * 140;
      p.scatter = 1.2;
    }
    if (p.scatter > 0) p.scatter -= dt;
    const td = dist(p.x, p.y, p.tx, p.ty);
    if (td < 12) {
      // New wander target: nearby dry spot, biased off-road.
      for (let tries = 0; tries < 6; tries++) {
        const nx = clamp(p.x + randRange(rng, -260, 260), LAND.x + 40, LAND.x + LAND.w - 40);
        const ny = clamp(p.y + randRange(rng, -260, 260), LAND.y + 40, LAND.y + LAND.h - 40);
        if (isDry(nx, ny) && !(onRoad(nx, ny, 4) && rng() < 0.7)) { p.tx = nx; p.ty = ny; break; }
      }
    } else {
      const a = angleTo(p.x, p.y, p.tx, p.ty);
      const sp = p.speed * (p.scatter > 0 ? 2.2 : 1);
      p.x += Math.cos(a) * sp * dt;
      p.y += Math.sin(a) * sp * dt;
      p.angle = a;
      if (!isDry(p.x, p.y)) { p.x -= Math.cos(a) * sp * dt; p.y -= Math.sin(a) * sp * dt; }
    }
  }
}

// Knock a pedestrian down (car hit). Returns true only if it was a fresh hit (an already-down ped returns false).
export function knockDown(ped) {
  if (ped.down > 0) return false;
  ped.down = 1; ped.downTimer = 6;
  ped.tx = ped.x; ped.ty = ped.y;
  return true;
}

export function makeTrafficCar(rng) {
  const vertical = rng() < 0.5;
  const road = vertical
    ? ROADS_X[Math.floor(rng() * ROADS_X.length)]
    : ROADS_Y[Math.floor(rng() * ROADS_Y.length)];
  const along = vertical
    ? randRange(rng, LAND.y + 80, LAND.y + LAND.h - 80)
    : randRange(rng, LAND.x + 80, LAND.x + LAND.w - 80);
  return {
    type: 'car', vertical, road,
    x: vertical ? road + (rng() < 0.5 ? -20 : 20) : along,
    y: vertical ? along : road + (rng() < 0.5 ? -20 : 20),
    angle: vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
    speed: randRange(rng, 90, 150),
    color: CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)],
    w: 46, h: 22,
  };
}

export function updateTraffic(world, dt) {
  for (const c of world.traffic) {
    // Next position: turn around at the world edge AND at water — traffic
    // drives on roads, never through the harbour basin or the lagoon.
    const nx = c.vertical ? c.x : c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.vertical ? c.y + Math.sin(c.angle) * c.speed * dt : c.y;
    if (isWater(nx, ny)) {
      c.angle += Math.PI;
      continue;
    }
    if (c.vertical) {
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (c.y < LAND.y + 60) { c.y = LAND.y + 60; c.angle = Math.PI / 2; }
      if (c.y > LAND.y + LAND.h - 60) { c.y = LAND.y + LAND.h - 60; c.angle = -Math.PI / 2; }
    } else {
      c.x += Math.cos(c.angle) * c.speed * dt;
      if (c.x < LAND.x + 60) { c.x = LAND.x + 60; c.angle = 0; }
      if (c.x > LAND.x + LAND.w - 60) { c.x = LAND.x + LAND.w - 60; c.angle = Math.PI; }
    }
  }
}

// Rival gang members for the Turf War: they walk toward the player and
// can be punched. Each needs 3 hits.
export function makeRival(rng, x, y) {
  return {
    x, y, angle: 0, hp: 3, speed: randRange(rng, 55, 75),
    color: '#8e2f2f', swing: 0, hitFlash: 0,
  };
}

export function updateRivals(world, dt) {
  const pl = world.player;
  for (const r of world.rivals) {
    if (r.hitFlash > 0) r.hitFlash -= dt;
    const d = dist(r.x, r.y, pl.x, pl.y);
    if (d > 26) {
      const a = angleTo(r.x, r.y, pl.x, pl.y);
      r.x += Math.cos(a) * r.speed * dt;
      r.y += Math.sin(a) * r.speed * dt;
      r.angle = a;
      if (!isDry(r.x, r.y)) { r.x -= Math.cos(a) * r.speed * dt; r.y -= Math.sin(a) * r.speed * dt; }
    } else if (pl.onFoot) {
      // A rival in punching range shoves the player a little.
      r.swing += dt;
      if (r.swing > 1.1) { r.swing = 0; pl.hp = Math.max(1, pl.hp - 4); }
    }
  }
  world.rivals = world.rivals.filter((r) => r.hp > 0);
}
