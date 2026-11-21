// Isla Fortuna v8 — hud.js
// The dense HUD, as DOM over the WebGL canvas (crisp text in screenshots):
// cash + wanted + heat + clock + district + HP (top-left), mission panel
// (top-centre), minimap + FCPD dispatch panel (top-right), dialogue with
// character portrait (bottom-left), weapon slots + respect + radio +
// speedometer (bottom-right). Title / pause / busted are DOM overlays too.

import { WORLD_W, WORLD_H, LAND, CREW, CASINO } from './config.js';
import { ROADS_X, ROADS_Y, LAGOON, HARBOUR_BASIN, districtAt } from './city.js';
import { missionObjective, missionTarget, currentMission } from './missions.js';
import { clockString } from './weather.js';
import { WEAPONS, respectRank } from './weapons.js';
import { clamp, dist } from './random.js';

const PORTRAITS = {
  Marisol: { initial: 'M', bg: '#d4a017' },
  Dante: { initial: 'D', bg: '#2ecc71' },
  Passenger: { initial: 'P', bg: '#3498db' },
  'FCPD Dispatch': { initial: 'F', bg: '#1c2733' },
};

function radioNow(world) {
  if (world.weather === 'rain') return { station: 'FORTUNA 101.5', song: 'Rainy Static — Night Drive' };
  if (world.time >= 16.5 && world.time < 19) return { station: 'FORTUNA 101.5', song: 'Golden Hour — Isla Sunset' };
  if (world.time >= 19 || world.time < 5.5) return { station: 'FORTUNA 101.5', song: 'Isla Nights — Neon Palms' };
  return { station: 'RADIO MANGO 98.6', song: 'Guava Sunrise — Los Palmas' };
}

export function buildHUD() {
  const hud = document.getElementById('hud');
  hud.innerHTML = `
  <div id="hud-tl" class="panel">
    <div class="row"><span id="hud-cash" class="cash">$150</span><span id="hud-stars" class="stars">☆☆☆☆☆</span></div>
    <div class="row"><span class="lbl">HEAT</span><div class="bar"><div id="hud-heat" class="fill heat"></div></div><span id="hud-heat-n">0</span></div>
    <div class="row small"><span id="hud-clock">10:30</span><span id="hud-weather">clear</span><span id="hud-district">Old Town</span></div>
    <div class="row"><span class="lbl">HP</span><div class="bar"><div id="hud-hp" class="fill hp"></div></div><span id="hud-hp-n">100</span></div>
  </div>
  <div id="hud-mission" class="panel">
    <div id="hud-job" class="job">JOB 1/12 — First Fare</div>
    <div id="hud-objective" class="objective">Get in the taxi</div>
    <div id="hud-timer" class="timer"></div>
  </div>
  <div id="hud-tr">
    <canvas id="hud-minimap" width="190" height="142"></canvas>
    <div id="hud-dispatch" class="panel">
      <div id="hud-dispatch-title" class="dispatch-title">FCPD DISPATCH — STANDING BY</div>
      <div id="hud-dispatch-units"></div>
    </div>
  </div>
  <div id="hud-air" class="air-banner">🚁 AIR UNIT DEPLOYED — AIR-1 HAS YOU IN THE LIGHT</div>
  <div id="hud-dialogue" class="panel">
    <div id="hud-portrait" class="portrait">M</div>
    <div class="dlg-text"><div id="hud-who" class="who">Marisol</div><div id="hud-say" class="say"></div></div>
  </div>
  <div id="hud-br">
    <div id="hud-weapons" class="panel weapons"></div>
    <div class="panel respect">
      <div class="row"><span id="hud-respect-name" class="lbl">ROOKIE</span><span id="hud-respect-n" class="small">0/100 RESPECT</span></div>
      <div class="bar"><div id="hud-respect" class="fill respect-fill"></div></div>
    </div>
    <div class="panel radio"><span id="hud-radio">📻 FORTUNA 101.5 — Isla Nights</span></div>
    <div id="hud-speed" class="panel speed"><span id="hud-speed-n">0</span><span class="unit">mph</span><div id="hud-car" class="car">ON FOOT</div></div>
  </div>
  <div id="hud-hint">WASD drive · E enter/exit · Click shoot · 1–4 weapons · Space punch · Shift run · P pause · M mute · H horn · R retry</div>
  <div id="hud-title" class="overlay">
    <div class="title-big">ISLA FORTUNA</div>
    <div class="title-sub">An open-world crime story — twelve jobs, one island, one last heist.</div>
    <div class="title-lines">Dante Reyes, getaway driver. Auntie Marisol has work for you.<br><br>
    WASD / arrows — move &amp; drive · E — enter a car or boat · Click — shoot · 1–4 — weapons<br>
    Space — punch · Shift — run · P — pause · M — mute · H — horn · R — retry a failed job<br>
    Hire crew in the pause menu: 1 Mara the Driver ($400) · 2 Leo the Lookout ($350) · 3 Ada the Hacker ($600)<br><br>
    Press ENTER to start — L loads your save</div>
  </div>
  <div id="hud-pause" class="overlay">
    <div class="title-big small">PAUSED</div>
    <div id="hud-crew" class="title-lines"></div>
    <div class="title-lines">P resume · S save · L load · M mute</div>
  </div>
  <div id="hud-busted" class="overlay red">
    <div class="title-big">BUSTED!</div>
    <div class="title-sub">The police took you in. Press R to retry the job.</div>
  </div>
  <div id="hud-failed" class="overlay"><div class="title-big small">JOB FAILED — press R to retry</div></div>`;
  return {
    cash: document.getElementById('hud-cash'),
    stars: document.getElementById('hud-stars'),
    heat: document.getElementById('hud-heat'),
    heatN: document.getElementById('hud-heat-n'),
    clock: document.getElementById('hud-clock'),
    weather: document.getElementById('hud-weather'),
    district: document.getElementById('hud-district'),
    hp: document.getElementById('hud-hp'),
    hpN: document.getElementById('hud-hp-n'),
    job: document.getElementById('hud-job'),
    objective: document.getElementById('hud-objective'),
    timer: document.getElementById('hud-timer'),
    minimap: document.getElementById('hud-minimap'),
    dispatchTitle: document.getElementById('hud-dispatch-title'),
    dispatchUnits: document.getElementById('hud-dispatch-units'),
    air: document.getElementById('hud-air'),
    portrait: document.getElementById('hud-portrait'),
    who: document.getElementById('hud-who'),
    say: document.getElementById('hud-say'),
    weapons: document.getElementById('hud-weapons'),
    respectName: document.getElementById('hud-respect-name'),
    respectN: document.getElementById('hud-respect-n'),
    respect: document.getElementById('hud-respect'),
    radio: document.getElementById('hud-radio'),
    speed: document.getElementById('hud-speed'),
    speedN: document.getElementById('hud-speed-n'),
    car: document.getElementById('hud-car'),
    title: document.getElementById('hud-title'),
    pause: document.getElementById('hud-pause'),
    crew: document.getElementById('hud-crew'),
    busted: document.getElementById('hud-busted'),
    failed: document.getElementById('hud-failed'),
  };
}

function drawMinimap(refs, world) {
  const ctx = refs.minimap.getContext('2d');
  const mw = 190, mh = 142;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = '#1d6fa8';
  ctx.fillRect(0, 0, mw, mh);
  ctx.fillStyle = '#69a84f';
  ctx.fillRect(LAND.x * sx, LAND.y * sy, LAND.w * sx, LAND.h * sy);
  ctx.fillStyle = '#2b8bc4';
  ctx.fillRect(LAGOON.x * sx, LAGOON.y * sy, LAGOON.w * sx, LAGOON.h * sy);
  ctx.fillRect(HARBOUR_BASIN.x * sx, HARBOUR_BASIN.y * sy, HARBOUR_BASIN.w * sx, HARBOUR_BASIN.h * sy);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(rx * sx, 0); ctx.lineTo(rx * sx, mh); ctx.stroke(); }
  for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(0, ry * sy); ctx.lineTo(mw, ry * sy); ctx.stroke(); }
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(CASINO.x * sx, CASINO.y * sy, 8, 6);
  const target = missionTarget(world);
  if (target && world.started && !world.finale) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(target.x * sx, target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of world.police) {
    ctx.fillStyle = '#ff4444';
    ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (world.heli) {
    ctx.fillStyle = '#ff88ff';
    ctx.beginPath(); ctx.arc(world.heli.x * sx, world.heli.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  const pl = world.player;
  ctx.fillStyle = '#2ecc71';
  ctx.beginPath(); ctx.arc(pl.x * sx, pl.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(pl.x * sx, pl.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
}

let last = {};
function setText(el, key, value) {
  if (last[key] !== value) { last[key] = value; el.textContent = value; }
}
function setHTML(el, key, value) {
  if (last[key] !== value) { last[key] = value; el.innerHTML = value; }
}
function setStyle(el, key, prop, value) {
  const k = key + prop;
  if (last[k] !== value) { last[k] = value; el.style[prop] = value; }
}

export function updateHUD(refs, world) {
  const pl = world.player;
  setText(refs.cash, 'cash', `$${world.cash}`);
  setText(refs.stars, 'stars', '★'.repeat(world.wanted) + '☆'.repeat(5 - world.wanted));
  setStyle(refs.heat, 'heat', 'width', `${clamp(world.heat, 0, 100)}%`);
  setText(refs.heatN, 'heatN', String(Math.round(world.heat)));
  setText(refs.clock, 'clock', clockString(world));
  setText(refs.weather, 'weather', world.weather);
  setText(refs.district, 'district', districtAt(pl.x, pl.y));
  setStyle(refs.hp, 'hp', 'width', `${clamp(Math.round(pl.hp), 0, 100)}%`);
  setText(refs.hpN, 'hpN', String(Math.round(pl.hp)));

  const m = currentMission(world);
  const jobLabel = world.finale ? 'FREE ROAM' : m ? `JOB ${Math.min(world.missionIndex + 1, 12)}/12 — ${m.name}` : '';
  setText(refs.job, 'job', jobLabel);
  setText(refs.objective, 'objective', missionObjective(world));
  const timerText = world.missionTimer !== null && world.missionTimer !== undefined && !world.finale
    ? `⏱ ${Math.ceil(world.missionTimer)}s` : '';
  setText(refs.timer, 'timer', timerText);
  setStyle(refs.timer, 'timer', 'color', world.missionTimer !== null && world.missionTimer < 15 ? '#ff5544' : '#fff');

  // Dispatch panel: named units + role + distance, heli on top.
  const units = world.police;
  const title = world.wanted > 0
    ? `FCPD DISPATCH — ${units.length} UNIT${units.length === 1 ? '' : 'S'} · ${world.wanted}★`
    : 'FCPD DISPATCH — STANDING BY';
  setText(refs.dispatchTitle, 'dtitle', title);
  const rows = [];
  if (world.heli) rows.push(`<div class="unit heli">AIR-1 · SPOTLIGHT · OVERHEAD</div>`);
  const sorted = [...units].sort((a, b) => dist(a.x, a.y, pl.x, pl.y) - dist(b.x, b.y, pl.x, pl.y)).slice(0, 5);
  for (const u of sorted) {
    const d = Math.round(dist(u.x, u.y, pl.x, pl.y));
    rows.push(`<div class="unit${u.disabled ? ' disabled' : ''}">${u.call || 'UNIT'} · ${u.role || 'PURSUIT'} · ${d}m${u.disabled ? ' · DISABLED' : ''}</div>`);
  }
  if (!rows.length) rows.push('<div class="unit idle">No active units — the island is quiet.</div>');
  setHTML(refs.dispatchUnits, 'dunits', rows.join(''));
  setStyle(refs.air, 'air', 'display', world.heli ? 'block' : 'none');

  // Dialogue + portrait.
  const lastDlg = world.dialogue[world.dialogue.length - 1];
  if (lastDlg) {
    const p = PORTRAITS[lastDlg.who] || { initial: lastDlg.who[0], bg: '#888' };
    setText(refs.portrait, 'portrait', p.initial);
    setStyle(refs.portrait, 'portrait', 'background', p.bg);
    setText(refs.who, 'who', lastDlg.who);
    setText(refs.say, 'say', lastDlg.text);
  }

  // Weapon slots.
  const w = world.weapons;
  const slots = WEAPONS.map((def, i) => {
    const locked = !w.unlocked[i];
    const active = w.slot === i;
    const ammo = def.ammo === Infinity ? '∞' : String(w.ammo[i]);
    return `<div class="slot${active ? ' active' : ''}${locked ? ' locked' : ''}"><span class="key">${def.key}</span><span class="wname">${def.name}</span><span class="ammo">${locked ? '🔒 LOCKED' : ammo}</span></div>`;
  }).join('');
  setHTML(refs.weapons, 'weapons', slots);

  // Respect.
  const rk = respectRank(world.respect || 0);
  setText(refs.respectName, 'rk', rk.name);
  setText(refs.respectN, 'rkn', `${world.respect || 0}/${rk.next} RESPECT`);
  setStyle(refs.respect, 'respect', 'width', `${clamp(((world.respect || 0) / rk.max) * 100, 0, 100)}%`);

  const radio = radioNow(world);
  setText(refs.radio, 'radio', `📻 ${radio.station} — ${radio.song}`);

  // Speedometer + car name + condition.
  if (pl.vehicle) {
    const v = pl.vehicle;
    const mph = Math.round(Math.abs(pl.speed) * 0.24);
    const gear = Math.abs(pl.speed) < 80 ? 'G1' : Math.abs(pl.speed) < 200 ? 'G2' : Math.abs(pl.speed) < 320 ? 'G3' : 'G4';
    setText(refs.speedN, 'speed', `${mph}`);
    setText(refs.car, 'car', `${v.name || (v.type === 'boat' ? 'BOAT' : 'CAR')} · ${v.condition ?? 100}% · ${gear}`);
  } else {
    setText(refs.speedN, 'speed', '—');
    setText(refs.car, 'car', 'ON FOOT');
  }

  drawMinimap(refs, world);

  // Overlays.
  setStyle(refs.title, 'title', 'display', world.started ? 'none' : 'flex');
  setStyle(refs.pause, 'pause', 'display', world.paused && world.started ? 'flex' : 'none');
  if (world.paused) {
    const crewHtml = CREW.map((c) => {
      const owned = world.crew[c.id];
      return `<div>${c.key}. ${c.name} — $${c.cost}${owned ? ' ✓ HIRED' : ''}<br><span class="dim">${c.benefit}</span></div>`;
    }).join('<br>');
    setHTML(refs.crew, 'crew', `Hire crew — press 1, 2 or 3:<br><br>${crewHtml}`);
  }
  setStyle(refs.busted, 'busted', 'display', world.busted ? 'flex' : 'none');
  setStyle(refs.failed, 'failed', 'display', world.missionFailed && !world.busted ? 'flex' : 'none');
}
