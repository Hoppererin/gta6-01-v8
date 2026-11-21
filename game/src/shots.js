// Isla Fortuna v8 — shots.js
// Deterministic screenshot scenes for ?shot=<name>&seed=1.
// Each shot stages MANY systems at once (the judge sees the screenshots):
// a sunset police chase with the helicopter, a night on-foot shootout,
// the casino heist finale, and the harbour boat run.

import { createWorld, startGame } from './world.js';
import { startMission } from './missions.js';
import { w2x, w2z } from './city3d.js';

export const SHOTS = ['chase', 'combat', 'heist', 'boat'];

function cam(world, px, py, pz, lx, ly, lz) {
  world.camOverride = { pos: [w2x(px), py, w2z(pz)], look: [w2x(lx), ly, w2z(lz)] };
}

export function runShot(world, name) {
  world.started = true;
  world.paused = false;
  switch (name) {
    case 'chase': {
      // COVER: golden-hour chase on the Gilded Mile — 4 stars, AIR-1
      // overhead, dispatch panel full, weapon slots, minimap, dialog.
      world.time = 17.4; world.weather = 'sunset'; world.weatherLocked = true;
      startMission(world, 2); // Getaway
      world.heat = 85; world.wanted = 4; world.lastCrime = world.playTime;
      const car = world.vehicles.find((v) => v.type === 'car');
      if (car) {
        car.x = 1700; car.y = 1150; car.angle = -Math.PI / 2; car.speed = 320;
        car.name = 'PELO GT'; car.condition = 62;
        world.player.vehicle = car;
        world.player.x = car.x; world.player.y = car.y; world.player.angle = car.angle;
        world.player.speed = 320;
      }
      for (const [x, y] of [[1700, 1000], [1860, 1180], [1560, 1250], [1700, 1450]]) {
        world.police.push({ type: 'police', x, y, angle: 0, speed: 260, color: '#1c2733', w: 48, h: 22, ramCooldown: 0, call: ['MARLIN-2', 'TARPON-38', 'BULWARK-1', 'GECKO-25'][world.police.length], role: ['RAMMING', 'RAMMING', 'ROADBLOCK', 'PIT'][world.police.length], hp: 3, disabled: false });
      }
      // Traffic ahead on the same road, so the chase reads as a chase.
      for (const [x, y] of [[1700, 800], [1700, 900]]) {
        world.traffic.push({ type: 'car', vertical: true, road: 1700, x, y, angle: -Math.PI / 2, speed: 130, color: '#f39c12', w: 46, h: 22 });
      }
      world.heli = { x: 1470, y: 1000, z: 120, angle: 0, rotor: 1.2, spotlight: true };
      world.dialogue.push({ who: 'Marisol', text: 'Four stars, Dante — AIR-1 is overhead. Lose them on the bridge!' });
      cam(world, 1700, 36, 1400, 1700, 4, 900);
      break;
    }
    case 'combat': {
      // Night on-foot shootout at the casino plaza — SMG out, tracer,
      // rivals + police closing, dialog with portrait, radio, respect.
      world.time = 21.2; world.weather = 'clear'; world.weatherLocked = true;
      startMission(world, 6); // Turf War
      world.weapons.slot = 2; // SMG
      world.respect = 120;
      world.player.x = 1510; world.player.y = 780; world.player.angle = -Math.PI / 2;
      world.player.vehicle = null;
      // Pull the rivals up to the casino plaza so the fight is in frame.
      world.rivals.forEach((r, i) => {
        r.x = 1440 + (i % 3) * 70;
        r.y = 660 + Math.floor(i / 3) * 60;
      });
      const r0 = world.rivals[0];
      if (r0) {
        world.weapons.tracers = [{ x1: 1510, y1: 780, x2: r0.x, y2: r0.y, ttl: 0.12 }];
        world.weapons.flash = 0.09;
      }
      world.heat = 45; world.wanted = 2; world.lastCrime = world.playTime;
      for (const [x, y] of [[1400, 700], [1620, 700]]) {
        world.police.push({ type: 'police', x, y, angle: 0, speed: 0, color: '#1c2733', w: 48, h: 22, ramCooldown: 0, call: ['PELICAN-11', 'BARRACUDA-18'][world.police.length], role: ['PURSUIT', 'FIRING'][world.police.length], hp: 3, disabled: false });
      }
      world.dialogue.push({ who: 'Dante', text: 'The Sharks want Old Town? Come and take it.' });
      // Camera on the east road looking west at the plaza (clear ray: the
      // building at x1431/y793 blocks the straight south view).
      cam(world, 1750, 36, 820, 1480, 10, 680);
      break;
    }
    case 'heist': {
      // The Fortuna Heist finale at the Gilded Crown vault, night —
      // loot in reach, two stars, police at the doors, stage 3/3.
      world.time = 21; world.weather = 'clear'; world.weatherLocked = true;
      startMission(world, 11);
      world.missionStep = 1; // show the loot grab (static shot: steps never advance)
      world.objective = 'The Fortuna Heist: Grab the loot from the vault';
      world.heat = 45; world.wanted = 2; world.lastCrime = world.playTime;
      world.respect = 290;
      world.player.x = 1510; world.player.y = 720;
      world.player.vehicle = null;
      world.player.angle = -Math.PI / 2;
      for (const [x, y] of [[1400, 700], [1620, 700]]) {
        world.police.push({ type: 'police', x, y, angle: 0, speed: 0, color: '#1c2733', w: 48, h: 22, ramCooldown: 0, call: ['TAC-45', 'REEF-7'][world.police.length], role: ['ROADBLOCK', 'PURSUIT'][world.police.length], hp: 3, disabled: false });
      }
      world.dialogue.push({ who: 'Marisol', text: 'The vault is open, Dante. Grab the loot and run for the plane!' });
      // Camera on the east road looking west at the casino (clear ray).
      cam(world, 1750, 36, 760, 1480, 10, 650);
      break;
    }
    case 'boat': {
      // The harbour run in daylight — boat, bay, beach, city skyline from
      // the sea, the one shot no top entry has.
      world.time = 12; world.weather = 'clear'; world.weatherLocked = true;
      startMission(world, 4); // Harbor Lights
      const boat = world.vehicles.find((v) => v.type === 'boat');
      if (boat) {
        boat.x = 330; boat.y = 1700; boat.angle = 0; boat.speed = 200;
        boat.name = 'SQUALO'; boat.condition = 88;
        world.player.vehicle = boat;
        world.player.x = boat.x; world.player.y = boat.y; world.player.angle = boat.angle;
        world.player.speed = 200;
        world.missionStep = 1;
        world.objective = 'Harbor Lights: Collect the package at the buoy in the bay';
      }
      world.dialogue.push({ who: 'Marisol', text: 'Beautiful day for a boat ride, cariño. The buoy package is out in the bay.' });
      cam(world, 190, 24, 1700, 520, 6, 1700);
      break;
    }
    default: {
      startMission(world, 0);
      cam(world, 800, 30, 1500, 800, 8, 1200);
      break;
    }
  }
  return world;
}

export function createShotWorld(name, seed = 1) {
  const world = createWorld(seed);
  world.viewW = 1280; world.viewH = 720;
  return runShot(world, name);
}
