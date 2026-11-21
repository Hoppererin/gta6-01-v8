// Isla Fortuna — missions.js
// The 12 story jobs. Data-driven steps; one engine runs all 12 jobs.
//
// THE PROGRESSION RULE (this is what broke v6): completeMission() MUST
// start the next job. startMission() resets missionDone=false plus EVERY
// per-mission counter, the briefing and the mission weather — and
// stepMission() never early-returns forever after a job completes.

import { CASINO_FRONT, CASINO_VAULT, HARBOUR_OFFICE, HARBOUR_DOCK, AIRSTRIP_GETAWAY } from './config.js';
import { dist, clamp, randRange } from './random.js';
import { isDry, isWater } from './city.js';
import { timerBonus } from './crew.js';
import { restockAmmo } from './weapons.js';

function spawnVehicle(world, type, x, y, id) {
  const v = {
    id: id || `${type}-${world.vehicles.length + 1}`,
    type, x, y, angle: -Math.PI / 2, speed: 0,
    color: type === 'taxi' ? '#f7c948' : type === 'boat' ? '#e8e8e8' : '#c0392b',
    w: type === 'boat' ? 64 : 48, h: type === 'boat' ? 26 : 22,
  };
  world.vehicles.push(v);
  return v;
}

function drySpotNear(world, x, y, radius = 200) {
  for (let r = 40; r <= radius; r += 40) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (isDry(nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

function waterSpotNear(world, x, y, radius = 500) {
  for (let r = 40; r <= radius; r += 40) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      if (isWater(nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x: 200, y: 1750 }; // harbour basin fallback
}

export const MISSIONS = [
  {
    name: 'First Fare',
    brief: 'Auntie Marisol: "Dante, first job is easy. Take the taxi, pick up my friend at the corner and drop them at the Gilded Crown Casino. Don\'t scratch the paint."',
    reward: 200,
    steps: [
      { type: 'enterVehicle', vehicleType: 'taxi', label: 'Get in the taxi' },
      { type: 'goto', x: CASINO_FRONT.x, y: CASINO_FRONT.y, r: 90, label: 'Drive the passenger to the Gilded Crown Casino' },
    ],
    setup(world) {
      // Park the taxi ON the road (x=800, the Old Town north-south road)
      // so the first drive starts on tarmac, not against a building.
      spawnVehicle(world, 'taxi', 800, 1330, 'taxi-1');
      world.dialogue.push({ who: 'Marisol', text: 'The yellow taxi is yours for the job, cariño.' });
    },
  },
  {
    name: 'Package Run',
    brief: 'Auntie Marisol: "A package is waiting at the Harbour Office. Seventy-five seconds, Dante — the boat does not wait for slow drivers."',
    reward: 250, timer: 75,
    steps: [
      { type: 'pickup', x: HARBOUR_OFFICE.x, y: HARBOUR_OFFICE.y, r: 80, label: 'Pick up the package at the Harbour Office' },
      { type: 'goto', x: 1250, y: 1100, r: 90, label: 'Deliver the package to the Old Town drop-off' },
    ],
  },
  {
    name: 'Getaway',
    brief: 'Auntie Marisol: "The police are all over you, Dante. Lose them. Lay low, stay out of trouble, and let the heat die down."',
    reward: 300,
    steps: [
      { type: 'loseWanted', label: 'Lose the police — get your wanted level to zero' },
    ],
    setup(world) {
      world.heat = 55; world.lastCrime = world.playTime;
      world.wanted = 3;
      world.dialogue.push({ who: 'Marisol', text: 'Three stars on you. Drive smooth, no more trouble, and they will forget.' });
    },
  },
  {
    name: 'The Long Con',
    brief: 'Auntie Marisol: "A friend in the Jungle district has something for us. Pick it up, then bring it to the Old Town fence. No questions."',
    reward: 350,
    steps: [
      { type: 'pickup', x: 2150, y: 1100, r: 80, label: 'Pick up the goods at the Jungle meeting point' },
      { type: 'goto', x: 900, y: 700, r: 90, label: 'Deliver the goods to the Old Town fence' },
    ],
  },
  {
    name: 'Harbor Lights',
    brief: 'Auntie Marisol: "Time to get your feet wet. Take the boat from the harbour, collect the buoy package out in the bay, and bring it back to the dock."',
    reward: 400,
    steps: [
      { type: 'enterVehicle', vehicleType: 'boat', label: 'Get in the boat at the harbour' },
      { type: 'pickup', x: 200, y: 1800, r: 80, label: 'Collect the package at the buoy in the bay' },
      { type: 'goto', x: 300, y: 1700, r: 90, label: 'Return to the harbour dock' },
    ],
    setup(world) {
      const w = waterSpotNear(world, HARBOUR_DOCK.x, HARBOUR_DOCK.y, 300);
      spawnVehicle(world, 'boat', w.x, w.y, 'boat-1');
    },
  },
  {
    name: 'The Wheelman Run',
    brief: 'Auntie Marisol: "Rico the Shark thinks he is the fastest on the island. Prove him wrong — hit every checkpoint in order, before the clock runs out."',
    reward: 500, timer: 180,
    steps: [
      {
        type: 'race', label: 'Race: hit every checkpoint in order',
        points: [
          [1700, 350], [2600, 700], [2600, 1500], [1700, 1900], [800, 1500], [800, 700], [1510, 660],
        ],
      },
    ],
    setup(world) {
      // Rival race cars follow the same checkpoints, a little slower than a good driver.
      const m = MISSIONS[5];
      world.raceRivals = m.steps[0].points.map(([x, y], i) => ({
        x: x + (i % 2 ? 40 : -40), y: y + 50, angle: 0, speed: 0, point: 0,
        color: i % 2 ? '#8e44ad' : '#16a085', w: 48, h: 22,
      }));
    },
  },
  {
    name: 'The Turf War',
    brief: 'Auntie Marisol: "The Sharks are muscling in on Old Town. Go on foot and settle it the old way — your fists. Five of them. No guns, no cars."',
    reward: 450,
    steps: [
      { type: 'punch', count: 5, label: 'Defeat the 5 rival gang members (Space punch, click shoot)' },
    ],
    setup(world) {
      const { makeRival } = world.__entityFns;
      for (let i = 0; i < 5; i++) {
        const spot = drySpotNear(world, world.player.x + (i - 2) * 90, world.player.y + 120, 260);
        world.rivals.push(makeRival(world.rng, spot.x, spot.y));
      }
      world.rivalsSpawned = 5;
    },
  },
  {
    name: 'The Scanner Job',
    brief: 'Auntie Marisol: "Ada needs scanner parts from four stashes around the island. Collect them all — and keep your nose clean, the police are watching."',
    reward: 500,
    steps: [
      { type: 'pickup', x: 1250, y: 700, r: 80, label: 'Scanner part 1 of 4 — Gilded Mile' },
      { type: 'pickup', x: 2150, y: 1100, r: 80, label: 'Scanner part 2 of 4 — Jungle road' },
      { type: 'pickup', x: 800, y: 1900, r: 80, label: 'Scanner part 3 of 4 — Harbour road' },
      { type: 'pickup', x: 2600, y: 1900, r: 80, label: 'Scanner part 4 of 4 — Palm Beach road' },
    ],
  },
  {
    name: 'The Blackout',
    brief: 'Auntie Marisol: "Tonight it rains, the power is out, and the airstrip crew is waiting. Drive the delivery to the airstrip in the dark — no lights, no noise."',
    reward: 600, weather: 'rain', time: 22,
    steps: [
      { type: 'goto', x: AIRSTRIP_GETAWAY.x, y: AIRSTRIP_GETAWAY.y, r: 90, label: 'Deliver the package to the airstrip — night, in the rain' },
    ],
  },
  {
    name: 'The Silent Partner',
    brief: 'Auntie Marisol: "A quiet man is waiting near the plaza. Meet him, take the envelope, and deliver it to the Old Town chapel before the hour turns."',
    reward: 650, timer: 70,
    steps: [
      { type: 'pickup', x: 1700, y: 1100, r: 80, label: 'Meet the contact at the plaza' },
      { type: 'goto', x: 1100, y: 1900, r: 90, label: 'Deliver the envelope to the Old Town chapel — quietly' },
    ],
  },
  {
    name: 'The Big Score',
    brief: 'Auntie Marisol: "The Crown keeps three vault keys in three places. Collect all three, and the Fortuna Heist is ours."',
    reward: 800,
    steps: [
      { type: 'pickup', x: CASINO_FRONT.x, y: CASINO_FRONT.y, r: 80, label: 'Vault key 1 of 3 — the Casino' },
      { type: 'pickup', x: 2150, y: 350, r: 80, label: 'Vault key 2 of 3 — the Airstrip office' },
      { type: 'pickup', x: 2600, y: 1100, r: 80, label: 'Vault key 3 of 3 — Palm Beach' },
    ],
  },
  {
    name: 'The Fortuna Heist',
    brief: 'Auntie Marisol: "This is it, Dante. The Gilded Crown vault. Grab the loot and run for the airstrip getaway plane. Fortuna is ours tonight."',
    reward: 5000, weather: 'clear', time: 21,
    steps: [
      { type: 'goto', x: CASINO_VAULT.x, y: CASINO_VAULT.y, r: 90, label: 'Reach the Gilded Crown Casino vault' },
      { type: 'pickup', x: CASINO_VAULT.x, y: CASINO_VAULT.y, r: 70, label: 'Grab the loot from the vault' },
      { type: 'goto', x: AIRSTRIP_GETAWAY.x, y: AIRSTRIP_GETAWAY.y, r: 100, label: 'Escape to the getaway plane at the airstrip' },
    ],
    setup(world) {
      world.heat = Math.max(world.heat, 40); // the heist is hot from the start
      world.lastCrime = world.playTime;
      world.wanted = 2;
    },
  },
];

export function currentMission(world) {
  return MISSIONS[world.missionIndex] || null;
}

export function missionObjective(world) {
  if (world.finale) return 'Free roam — Isla Fortuna is yours. Enjoy the island, Dante.';
  const m = currentMission(world);
  if (!m) return '';
  const step = m.steps[world.missionStep];
  if (!step) return m.name;
  if (step.type === 'race') {
    const done = world.raceIndex || 0;
    return `${m.name}: checkpoint ${done + 1}/${step.points.length} — ${step.label}`;
  }
  if (step.type === 'punch') {
    const left = world.rivalsSpawned - world.punched;
    return `${m.name}: ${Math.max(0, left)} rivals left — ${step.label}`;
  }
  return `${m.name}: ${step.label}`;
}

export function missionTarget(world) {
  if (world.finale) return null;
  const m = currentMission(world);
  if (!m) return null;
  const step = m.steps[world.missionStep];
  if (!step) return null;
  if (step.type === 'enterVehicle') {
    const v = world.vehicles.find((vv) => vv.type === step.vehicleType);
    return v ? { x: v.x, y: v.y, label: step.label } : null;
  }
  if (step.type === 'race') {
    const p = step.points[world.raceIndex || 0];
    return p ? { x: p[0], y: p[1], label: step.label } : null;
  }
  if (step.type === 'punch') {
    if (world.rivals.length) {
      let best = world.rivals[0], bd = Infinity;
      for (const r of world.rivals) {
        const d = dist(r.x, r.y, world.player.x, world.player.y);
        if (d < bd) { bd = d; best = r; }
      }
      return { x: best.x, y: best.y, label: step.label };
    }
    return { x: world.player.x, y: world.player.y, label: step.label };
  }
  if (step.type === 'loseWanted') return { x: world.player.x, y: world.player.y, label: step.label };
  return { x: step.x, y: step.y, label: step.label };
}

// Start (or restart) job `index`. Resets EVERYTHING per-mission so the
// next job always runs — this is the fix for the v6 soft-lock.
export function startMission(world, index) {
  if (index >= MISSIONS.length) {
    world.finale = true;
    world.missionDone = true;
    world.missionFailed = false;
    world.respect = (world.respect || 0) + 60; // the heist makes Dante a legend
    world.objective = 'Free roam — Isla Fortuna is yours.';
    world.dialogue.push({ who: 'Marisol', text: 'You did it, Dante. The Fortuna Heist is ours. The island is yours now — free roam, enjoy it.' });
    if (world.audio) world.audio.success();
    return;
  }
  const m = MISSIONS[index];
  world.missionIndex = index;
  world.missionStep = 0;
  world.missionDone = false;
  world.missionFailed = false;
  world.missionTime = 0;
  world.waitTimer = 0;
  world.collected = 0;
  world.punched = 0;
  world.rivalsSpawned = 0;
  world.raceIndex = 0;
  world.raceRivals = [];
  world.missionTimer = m.timer ? m.timer + timerBonus(world) : null;
  world.missionTimerMax = world.missionTimer;
  world.weatherLocked = !!m.weather;
  if (m.weather) world.weather = m.weather;
  if (m.time !== undefined) world.time = m.time;
  // The shotgun unlocks from job 9 (The Blackout) — it stays LOCKED on the HUD before that.
  if (world.weapons && index >= 8) world.weapons.unlocked[3] = true;
  world.objective = missionObjective(world);
  world.dialogue = [{ who: 'Marisol', text: m.brief }];
  if (m.setup) m.setup(world);
  world.objective = missionObjective(world);
}

export function completeMission(world) {
  const m = currentMission(world);
  if (!m) return;
  world.cash += m.reward;
  // Respect: the island's street reputation. Ranks: ROOKIE 0, DRIVER 100,
  // SHOT CALLER 250, KINGPIN 500. Shown on the HUD respect bar.
  world.respect = (world.respect || 0) + 20;
  restockAmmo(world); // job rewards top up pistol / SMG / shotgun ammo
  world.missionDone = true;
  world.dialogue.push({ who: 'Marisol', text: `Job done — "${m.name}" paid $${m.reward}.` });
  if (world.audio) world.audio.success();
  world.missionIndex += 1;
  if (world.missionIndex >= MISSIONS.length) {
    // Finale: free roam, no job 13.
    startMission(world, world.missionIndex);
    return;
  }
  // THE FIX: the next job starts immediately, with all counters reset.
  startMission(world, world.missionIndex);
}

export function failMission(world, reason) {
  if (world.missionDone || world.missionFailed) return;
  world.missionFailed = true;
  world.dialogue.push({ who: 'Marisol', text: `${reason} Press R to retry the job.` });
  if (world.audio) world.audio.fail();
}

function advanceStep(world) {
  const m = currentMission(world);
  world.missionStep += 1;
  world.objective = missionObjective(world);
  if (world.audio) world.audio.pickup();
  if (world.missionStep >= m.steps.length) completeMission(world);
}

// The per-frame mission engine. Never early-returns forever: it only
// skips while paused, failed, or between jobs (missionDone is only true
// in the finale, where there is no current mission).
export function stepMission(world, dt) {
  if (!world.started || world.paused) return;
  if (world.missionFailed || world.finale) return;
  const m = currentMission(world);
  if (!m) return;
  if (world.missionDone) return; // transient: completeMission starts the next job at once
  world.missionTime += dt;
  if (world.missionTimer !== null && world.missionTimer !== undefined) {
    world.missionTimer -= dt;
    if (world.missionTimer <= 0) {
      world.missionTimer = 0;
      failMission(world, `Time ran out on "${m.name}".`);
      return;
    }
  }
  const step = m.steps[world.missionStep];
  if (!step) return;
  const pl = world.player;
  const near = (x, y, r) => dist(pl.x, pl.y, x, y) < r;
  switch (step.type) {
    case 'enterVehicle': {
      const v = pl.vehicle;
      if (v && v.type === step.vehicleType) advanceStep(world);
      break;
    }
    case 'goto':
    case 'pickup': {
      if (near(step.x, step.y, step.r)) {
        world.collected += 1;
        advanceStep(world);
      }
      break;
    }
    case 'race': {
      const p = step.points[world.raceIndex || 0];
      if (p && near(p[0], p[1], 110)) {
        world.raceIndex += 1;
        world.collected += 1;
        if (world.audio) world.audio.pickup();
        if (world.raceIndex >= step.points.length) {
          world.missionStep += 1;
          if (world.missionStep >= m.steps.length) completeMission(world);
        }
      }
      world.objective = missionObjective(world);
      break;
    }
    case 'punch': {
      world.punched = world.rivalsSpawned - world.rivals.length;
      if (world.rivalsSpawned > 0 && world.rivals.length === 0) {
        world.missionStep += 1;
        if (world.missionStep >= m.steps.length) completeMission(world);
      }
      world.objective = missionObjective(world);
      break;
    }
    case 'loseWanted': {
      if (world.wanted === 0) {
        world.missionStep += 1;
        if (world.missionStep >= m.steps.length) completeMission(world);
      }
      break;
    }
    case 'wait': {
      world.waitTimer += dt;
      if (world.waitTimer >= (step.seconds || 3)) {
        world.missionStep += 1;
        if (world.missionStep >= m.steps.length) completeMission(world);
      }
      break;
    }
    default:
      break;
  }
  world.objective = missionObjective(world);
}
