// Isla Fortuna — world.js
// The simulation: player on foot / car / boat, traffic, pedestrians,
// police, side activities, save/load. Wires missions + police + weather.

import {
  WORLD_W, WORLD_H, LAND, START_CASH, SAVE_KEY, DOUBLOON_REWARD,
  PLAYER_START, HARBOUR_DOCK,
} from './config.js';
import { mulberry32, clamp, dist, angleTo, angleDiff } from './random.js';
import { buildCity, isWater, isDry, onDock, collideBuildings, hitsBuilding, districtAt } from './city.js';
import { spawnPeds, updatePeds, knockDown, makeTrafficCar, updateTraffic, updateRivals, makeRival } from './entities.js';
import { startMission, stepMission, currentMission, missionObjective, missionTarget, failMission } from './missions.js';
import { updatePolice, updateWanted, pedHitCrime, commitCrime, updateHeli } from './police.js';
import { updateWeather } from './weather.js';
import { carSpeedMult } from './crew.js';

export function createWorld(seed = 1) {
  const rng = mulberry32(seed);
  const city = buildCity(seed);
  const world = {
    seed, rng, city,
    time: 10.5, weather: 'clear', weatherTimer: 60, weatherLocked: false, rainDrops: [],
    playTime: 0, started: false, paused: false, muted: false,
    player: {
      x: PLAYER_START.x, y: PLAYER_START.y, angle: 0, speed: 0,
      hp: 100, vehicle: null, punchCooldown: 0, lastDamage: -99,
    },
    vehicles: [], traffic: [], peds: [], police: [], rivals: [], raceRivals: [],
    cash: START_CASH, heat: 0, wanted: 0, lastCrime: -999, lastPoliceSpawn: 0,
    heli: null, respect: 0,
    // Weapons: 0 fists, 1 pistol, 2 SMG, 3 shotgun (locked until job 9).
    weapons: { slot: 0, ammo: [Infinity, 60, 120, 12], unlocked: [true, true, true, false], flash: 0 },
    missionIndex: 0, missionStep: 0, missionDone: false, missionFailed: false,
    missionTime: 0, missionTimer: null, missionTimerMax: null,
    collected: 0, punched: 0, rivalsSpawned: 0, raceIndex: 0, waitTimer: 0,
    crew: { mara: false, leo: false, ada: false },
    doubloons: city.doubloons,
    fare: null, fareTimer: 0, sideRace: null,
    dialogue: [], objective: '',
    camera: { x: 0, y: 0 },
    busted: false, finale: false,
    autosaveTimer: 0, stats: { pedsHit: 0, carsStolen: 0, distance: 0 },
    audio: null, input: null,
    __entityFns: { makeRival },
  };
  // Parked cars around the island + two boats moored at the harbour.
  // Each car has a name + condition, shown on the HUD speedometer.
  const CAR_NAMES = ['PELO GT', 'COMET RS', 'VULCAN S', 'SQUALO', 'MARLIN GT', 'CORAL C', 'BRISA S', 'TIDE RUNNER'];
  const spots = [
    ['car', 1350, 1250], ['car', 1300, 750], ['car', 1750, 1150], ['car', 2650, 750],
    ['car', 850, 1950], ['car', 2200, 1150], ['car', 1300, 1950], ['car', 2650, 1550],
  ];
  for (const [type, x, y] of spots) {
    world.vehicles.push({
      id: `${type}-${world.vehicles.length + 1}`, type, x, y,
      angle: 0, speed: 0, color: '#c0392b', w: 48, h: 22,
      name: CAR_NAMES[world.vehicles.length % CAR_NAMES.length], condition: 100,
    });
  }
  world.vehicles.push({ id: 'boat-0', type: 'boat', x: 200, y: 1650, angle: 0, speed: 0, color: '#e8e8e8', w: 64, h: 26, name: 'SQUALO', condition: 100 });
  world.vehicles.push({ id: 'boat-1x', type: 'boat', x: 240, y: 1900, angle: 0, speed: 0, color: '#7fb3d5', w: 64, h: 26, name: 'MARLIN', condition: 100 });
  for (let i = 0; i < 14; i++) world.traffic.push(makeTrafficCar(rng));
  world.peds = spawnPeds(city, rng, 42);
  world.dialogue = [{ who: 'Marisol', text: 'Dante Reyes — welcome home to Isla Fortuna. Press Enter to start.' }];
  return world;
}

export function startGame(world) {
  world.started = true;
  world.paused = false;
  startMission(world, world.missionIndex);
}

// --- Vehicles ---------------------------------------------------------------

export function nearestVehicle(world, maxD = 85) {
  let best = null, bd = maxD;
  for (const v of world.vehicles) {
    const d = dist(v.x, v.y, world.player.x, world.player.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function enterVehicle(world, v) {
  world.player.vehicle = v;
  world.player.x = v.x; world.player.y = v.y;
  world.player.angle = v.angle;
  world.stats.carsStolen += 1;
  if (world.audio) world.audio.click();
}

// Exit onto DRY land only. Tries several directions/radii; if no dry spot
// exists the player stays in the vehicle (never stranded in water).
export function exitVehicle(world) {
  const v = world.player.vehicle;
  if (!v) return false;
  const pl = world.player;
  const offsets = [46, 64, 92, 130];
  const angles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4];
  for (const r of offsets) {
    for (const a of angles) {
      const nx = v.x + Math.cos(a) * r, ny = v.y + Math.sin(a) * r;
      if (!isDry(nx, ny)) continue;
      const fixed = collideBuildings(world.city, nx, ny, 16);
      if (dist(fixed.x, fixed.y, nx, ny) > 2) continue; // inside a building
      pl.x = fixed.x; pl.y = fixed.y;
      pl.vehicle = null; pl.speed = 0; v.speed = 0;
      if (world.audio) world.audio.click();
      return true;
    }
  }
  return false; // no dry landing: stay in the vehicle
}

export function punch(world) {
  const pl = world.player;
  if (pl.vehicle || pl.punchCooldown > 0) return;
  pl.punchCooldown = 0.45;
  if (world.audio) world.audio.punch();
  for (const r of world.rivals) {
    if (dist(r.x, r.y, pl.x, pl.y) < 62) {
      r.hp -= 1; r.hitFlash = 0.3;
      r.x += Math.cos(angleTo(pl.x, pl.y, r.x, r.y)) * 14;
      r.y += Math.sin(angleTo(pl.x, pl.y, r.x, r.y)) * 14;
      if (r.hp <= 0 && world.audio) world.audio.pickup();
    }
  }
}

// --- Side activities --------------------------------------------------------

function updateFare(world, dt) {
  world.fareTimer -= dt;
  const pl = world.player;
  if (!world.fare && world.fareTimer <= 0 && world.started) {
    // A fare appears on a road near the player (on foot or in a taxi).
    const fx = clamp(pl.x + (world.rng() < 0.5 ? -260 : 260), LAND.x + 60, LAND.x + LAND.w - 60);
    const fy = clamp(pl.y + (world.rng() < 0.5 ? -200 : 200), LAND.y + 60, LAND.y + LAND.h - 60);
    if (isDry(fx, fy)) {
      world.fare = {
        state: 'waiting', x: fx, y: fy,
        tx: clamp(fx + (world.rng() < 0.5 ? -700 : 700), LAND.x + 60, LAND.x + LAND.w - 60),
        ty: clamp(fy + (world.rng() < 0.5 ? -500 : 500), LAND.y + 60, LAND.y + LAND.h - 60),
        reward: 80 + Math.floor(world.rng() * 80),
      };
    }
    world.fareTimer = 25;
  }
  const f = world.fare;
  if (!f) return;
  if (f.state === 'waiting') {
    const v = pl.vehicle;
    if (v && v.type === 'taxi' && dist(pl.x, pl.y, f.x, f.y) < 70) {
      f.state = 'riding';
      world.dialogue.push({ who: 'Passenger', text: `Take me to the marked spot — $${f.reward} for you.` });
    }
  } else if (dist(pl.x, pl.y, f.tx, f.ty) < 80) {
    world.cash += f.reward;
    world.dialogue.push({ who: 'Passenger', text: `Thanks, driver! $${f.reward} — keep the change.` });
    if (world.audio) world.audio.coin();
    world.fare = null;
    world.fareTimer = 20;
  }
}

function updateSideRace(world, dt) {
  const m = currentMission(world);
  const inRaceMission = m && m.steps[world.missionStep] && m.steps[world.missionStep].type === 'race';
  const pl = world.player;
  if (!world.sideRace && !inRaceMission && pl.vehicle && pl.vehicle.type !== 'boat'
    && dist(pl.x, pl.y, 1700, 350) < 60 && world.started) {
    world.sideRace = {
      points: [[2600, 700], [2600, 1500], [1700, 1900], [1700, 350]],
      index: 0, timer: 75,
    };
    world.dialogue.push({ who: 'Marisol', text: 'Street race! Hit the checkpoints — $200 if you finish them all.' });
  }
  const sr = world.sideRace;
  if (!sr) return;
  sr.timer -= dt;
  const p = sr.points[sr.index];
  if (p && dist(pl.x, pl.y, p[0], p[1]) < 95) {
    sr.index += 1;
    if (world.audio) world.audio.pickup();
    if (sr.index >= sr.points.length) {
      world.cash += 200;
      world.dialogue.push({ who: 'Marisol', text: 'Street race won — $200 in your pocket.' });
      if (world.audio) world.audio.success();
      world.sideRace = null;
    }
  } else if (sr.timer <= 0) {
    world.sideRace = null;
  }
}

function updateDoubloons(world) {
  const pl = world.player;
  for (const d of world.doubloons) {
    if (!d.taken && dist(pl.x, pl.y, d.x, d.y) < 42) {
      d.taken = true;
      world.cash += DOUBLOON_REWARD;
      world.dialogue.push({ who: 'Dante', text: `Golden doubloon! +$${DOUBLOON_REWARD}.` });
      if (world.audio) world.audio.coin();
    }
  }
}

// --- The frame step ---------------------------------------------------------

export function stepWorld(world, input, dt) {
  if (!world.started || world.paused) return;
  if (world.busted) return;
  dt = Math.min(dt, 0.05);
  world.playTime += dt;
  const pl = world.player;
  const v = pl.vehicle;

  updateWeather(world, dt);
  updateWanted(world, dt);
  stepMission(world, dt);

  // --- Player / vehicle movement ---
  const ax = input.axis();
  if (v) {
    const isBoat = v.type === 'boat';
    const top = (isBoat ? 300 : 420) * (isBoat ? 1 : carSpeedMult(world));
    const accel = isBoat ? 260 : 520;
    if (ax.y < 0) v.speed += accel * dt;
    else if (ax.y > 0) v.speed -= (v.speed > 0 ? 700 : 260) * dt;
    else v.speed -= v.speed * (isBoat ? 0.4 : 1.4) * dt;
    v.speed = clamp(v.speed, isBoat ? -90 : -160, top);
    const steer = ax.x * clamp(Math.abs(v.speed) / 120, 0.3, 1) * (isBoat ? 1.5 : 2.6); // steering keeps some authority even at crawl speed, so a car pinned on a wall can still turn away
    v.angle += steer * dt * (v.speed >= 0 ? 1 : -1);
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    // Water rules: cars stay dry, boats stay wet. Boats are blocked by
    // LAND even on a dock (a pier is for walking, not for beaching a boat
    // on — v6's harbour trap came from boats leaving the water).
    const blocked = (x, y) => (isBoat ? !isWater(x, y) : isWater(x, y)) || hitsBuilding(world.city, x, y, 20);
    let movedX = false, movedY = false;
    if (!blocked(nx, v.y)) { v.x = nx; movedX = true; }
    if (!blocked(v.x, ny)) { v.y = ny; movedY = true; }
    if (!movedX && !movedY) v.speed *= 0.35;
    // Safety net: an outside shove (e.g. a traffic bump) can still leave
    // the car inside a building's collision shell, where every axis is
    // blocked and it would wedge forever. Eject it to the nearest edge.
    const fixed = collideBuildings(world.city, v.x, v.y, 20);
    if (dist(fixed.x, fixed.y, v.x, v.y) > 0.5) { v.x = fixed.x; v.y = fixed.y; v.speed *= 0.6; }
    v.x = clamp(v.x, 20, WORLD_W - 20);
    v.y = clamp(v.y, 20, WORLD_H - 20);
    pl.x = v.x; pl.y = v.y; pl.angle = v.angle; pl.speed = v.speed;
    world.stats.distance += Math.abs(v.speed) * dt;
    if (world.audio) world.audio.engine(Math.abs(v.speed) / top);
  } else {
    // On foot. Wading is allowed: standing in water never hard-blocks
    // movement, so the player can always walk back to dry land.
    const inWater = isWater(pl.x, pl.y) && !onDock(pl.x, pl.y);
    const base = input.run() ? 265 : 175;
    const sp = inWater ? base * 0.5 : base;
    let mx = ax.x, my = ax.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const nx = pl.x + mx * sp * dt;
    const ny = pl.y + my * sp * dt;
    // Foot movement is only blocked by buildings, never by water.
    const fixed = collideBuildings(world.city, nx, ny, 15);
    pl.x = clamp(fixed.x, LAND.x - 150, LAND.x + LAND.w + 150);
    pl.y = clamp(fixed.y, LAND.y - 150, LAND.y + LAND.h + 150);
    pl.speed = len > 0 ? sp : 0;
    if (len > 0) pl.angle = Math.atan2(my, mx);
    world.stats.distance += pl.speed * dt;
    if (world.audio) world.audio.engine(0);
  }
  if (pl.punchCooldown > 0) pl.punchCooldown -= dt;

  // --- Pedestrian hits (tuned down: +5 heat, no direct star) ---
  if (v && Math.abs(v.speed) > 80) {
    for (const p of world.peds) {
      if (p.down > 0) continue;
      if (dist(p.x, p.y, pl.x, pl.y) < 30) {
        if (knockDown(p)) {
          world.stats.pedsHit += 1;
          pedHitCrime(world);
          if (world.audio) world.audio.crash();
        }
      }
    }
  }
  // --- Traffic bumps (cars only — a car cannot shove a boat) ---
  if (v && v.type !== 'boat') {
    for (const t of world.traffic) {
      if (dist(t.x, t.y, pl.x, pl.y) < 44) {
        const a = angleTo(t.x, t.y, pl.x, pl.y);
        v.x += Math.cos(a) * 8; v.y += Math.sin(a) * 8;
        v.speed *= 0.55;
        if (v.condition !== undefined) v.condition = Math.max(0, v.condition - 1);
      }
    }
  }

  // --- Race rivals follow the checkpoints ---
  const m = currentMission(world);
  if (m && m.steps[world.missionStep] && m.steps[world.missionStep].type === 'race') {
    const step = m.steps[world.missionStep];
    for (const r of world.raceRivals) {
      const p = step.points[r.point];
      if (!p) continue;
      const a = angleTo(r.x, r.y, p[0], p[1]);
      r.angle += clamp(angleDiff(r.angle, a), -2.2 * dt, 2.2 * dt);
      r.speed = 300;
      r.x += Math.cos(r.angle) * r.speed * dt;
      r.y += Math.sin(r.angle) * r.speed * dt;
      if (dist(r.x, r.y, p[0], p[1]) < 90) r.point += 1;
    }
  }

  updatePeds(world, dt);
  updateTraffic(world, dt);
  updateRivals(world, dt);
  updatePolice(world, dt);
  updateHeli(world, dt);
  if (world.weapons.flash > 0) world.weapons.flash -= dt;

  // HP regen when safe.
  const policeNear = world.police.some((p) => dist(p.x, p.y, pl.x, pl.y) < 400);
  if (!policeNear && world.playTime - pl.lastDamage > 6) pl.hp = Math.min(100, pl.hp + 3 * dt);
  if (pl.hp <= 0) world.busted = true;

  updateFare(world, dt);
  updateSideRace(world, dt);
  updateDoubloons(world);

  // Camera follows the player.
  const vw = world.viewW || 1280, vh = world.viewH || 720;
  world.camera.x = clamp(pl.x - vw / 2, 0, Math.max(0, WORLD_W - vw));
  world.camera.y = clamp(pl.y - vh / 2, 0, Math.max(0, WORLD_H - vh));

  // Autosave every 20s.
  world.autosaveTimer += dt;
  if (world.autosaveTimer > 20) {
    world.autosaveTimer = 0;
    saveGame(world);
  }
}

// --- Save / load ------------------------------------------------------------

export function saveGame(world) {
  try {
    const data = {
      cash: world.cash, heat: world.heat, missionIndex: world.missionIndex,
      crew: world.crew, doubloons: world.doubloons.map((d) => d.taken),
      px: world.player.x, py: world.player.y, time: world.time, playTime: world.playTime,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame(world) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    world.cash = d.cash; world.heat = d.heat; world.crew = d.crew || world.crew;
    world.player.x = d.px; world.player.y = d.py;
    world.time = d.time ?? world.time; world.playTime = d.playTime ?? 0;
    (d.doubloons || []).forEach((taken, i) => { if (world.doubloons[i]) world.doubloons[i].taken = taken; });
    world.missionIndex = d.missionIndex || 0;
    return true;
  } catch (e) { return false; }
}

export function retryAfterBusted(world) {
  world.busted = false;
  world.player.hp = 100;
  world.heat = 0; world.wanted = 0; world.lastCrime = -999;
  world.police = [];
  world.player.vehicle = null;
  world.player.x = PLAYER_START.x; world.player.y = PLAYER_START.y;
  world.player.speed = 0;
  startMission(world, world.missionIndex);
}
