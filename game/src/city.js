// Isla Fortuna — city.js
// The island: roads, buildings, water (ocean + lagoon + harbour basin),
// docks, palms, the casino, the airstrip. Deterministic from the seed.
// No imports except config + random helpers.

import { WORLD_W, WORLD_H, LAND, DISTRICTS, CASINO, DOUBLOON_SPOTS } from './config.js';
import { mulberry32, randRange, clamp } from './random.js';

// Road centrelines (the island street grid). Roads are 84px wide, so traffic uses the centreline ±42px.
export const ROADS_X = [350, 800, 1250, 1700, 2150, 2600];
export const ROADS_Y = [350, 700, 1100, 1500, 1900];
export const ROAD_W = 84;

// Water bodies inside the land rect.
export const LAGOON = { x: 700, y: 2040, w: 520, h: 240 }; // south-west lagoon
export const HARBOUR_BASIN = { x: 120, y: 1480, w: 280, h: 520 }; // bay on the west edge
// Walkable wooden piers across the harbour basin.
export const DOCKS = [
  { x: 120, y: 1580, w: 300, h: 26 },
  { x: 120, y: 1760, w: 300, h: 26 },
  { x: 120, y: 1920, w: 300, h: 26 },
];
export const RUNWAY = { x: 2280, y: 240, w: 640, h: 90 };

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function onRoad(x, y, margin = 0) {
  const half = ROAD_W / 2 + margin;
  for (const rx of ROADS_X) if (Math.abs(x - rx) < half) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < half) return true;
  return false;
}
function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

export function isWater(x, y) {
  if (x < LAND.x || x > LAND.x + LAND.w || y < LAND.y || y > LAND.y + LAND.h) return true;
  if (inRect(x, y, LAGOON) || inRect(x, y, HARBOUR_BASIN)) return true;
  return false;
}
export function onDock(x, y) { return DOCKS.some((d) => inRect(x, y, d)); }
export function isDry(x, y) { return !isWater(x, y) || onDock(x, y); }

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (inRect(x, y, d)) return d.name;
  if (isWater(x, y)) return 'Ocean';
  return 'Fortuna City';
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];
  const keepOut = [
    CASINO, RUNWAY, LAGOON, HARBOUR_BASIN,
    { x: 1440, y: 630, w: 160, h: 90 }, // casino plaza (south of the casino)
    { x: 400, y: 1600, w: 200, h: 200 }, // harbour office yard
    { x: 760, y: 1210, w: 120, h: 120 }, // player start clearing
    // Mission targets must never sit inside a solid building: keep every
    // goto/pickup/race point clear so the player can always reach it.
    ...[
      [1510, 660], [480, 1680], [1250, 1100], [2150, 1100], [900, 700],
      [1700, 350], [2600, 700], [2600, 1500], [1700, 1900], [800, 1500], [800, 700],
      [1250, 700], [800, 1900], [2600, 1900], [2620, 320], [1700, 1100],
      [1100, 1900], [2150, 350], [2600, 1100], [1510, 640],
    ].map(([cx, cy]) => ({ x: cx - 80, y: cy - 80, w: 160, h: 160 })),
    // Doubloon spots too: a doubloon inside a building can never be
    // collected (pickup radius 42), so keep every spot clear as well.
    // (Verified post-fix: all 8 spots reachable on seeds 1-3.)
    // witness: final content verified 2026-11-20
    ...DOUBLOON_SPOTS.map(([cx, cy]) => ({ x: cx - 80, y: cy - 80, w: 160, h: 160 })),
  ];
  // Buildings fill the blocks between roads.
  const blockXs = [LAND.x + 20, ...ROADS_X, LAND.x + LAND.w - 20];
  const blockYs = [LAND.y + 20, ...ROADS_Y, LAND.y + LAND.h - 20];
  for (let bi = 0; bi < blockXs.length - 1; bi++) {
    for (let bj = 0; bj < blockYs.length - 1; bj++) {
      const bx0 = blockXs[bi] + ROAD_W / 2 + 14;
      const bx1 = blockXs[bi + 1] - ROAD_W / 2 - 14;
      const by0 = blockYs[bj] + ROAD_W / 2 + 14;
      const by1 = blockYs[bj + 1] - ROAD_W / 2 - 14;
      if (bx1 - bx0 < 90 || by1 - by0 < 90) continue;
      const n = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const w = randRange(rng, 90, Math.min(220, bx1 - bx0));
        const h = randRange(rng, 90, Math.min(200, by1 - by0));
        const x = randRange(rng, bx0, Math.max(bx0 + 1, bx1 - w));
        const y = randRange(rng, by0, Math.max(by0 + 1, by1 - h));
        const b = { x, y, w, h, hue: Math.floor(randRange(rng, 0, 360)) };
        if (keepOut.some((k2) => rectsOverlap(b, k2))) continue;
        if (buildings.some((o) => rectsOverlap(b, { x: o.x - 18, y: o.y - 18, w: o.w + 36, h: o.h + 36 }))) continue;
        buildings.push(b);
      }
    }
  }
  // The casino itself (big, gold, unmistakable).
  buildings.push({ x: CASINO.x, y: CASINO.y, w: CASINO.w, h: CASINO.h, hue: 45, casino: true });
  // Palms: beach + jungle + scattered.
  for (let i = 0; i < 160; i++) {
    const x = randRange(rng, LAND.x + 30, LAND.x + LAND.w - 30);
    const y = randRange(rng, LAND.y + 30, LAND.y + LAND.h - 30);
    if (isWater(x, y) || onRoad(x, y, 10)) continue;
    if (buildings.some((b) => inRect(x, y, { x: b.x - 12, y: b.y - 12, w: b.w + 24, h: b.h + 24 }))) continue;
    palms.push({ x, y, s: randRange(rng, 0.8, 1.3) });
  }
  const doubloons = DOUBLOON_SPOTS.map(([x, y]) => ({ x, y, taken: false }));
  return { buildings, palms, doubloons, seed };
}

// True if a circle of radius r at (x, y) overlaps any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Circle-vs-building push-out. Returns corrected {x, y}.
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Centre inside the building: push out along the smallest penetration.
        const pl = x - b.x + r, pr = b.x + b.w - x + r;
        const pt = y - b.y + r, pb = b.y + b.h - y + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x - r; else if (m === pr) x = b.x + b.w + r;
        else if (m === pt) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  return { x, y };
}

// Nearest point on the road grid to (x, y) — used for traffic / police spawns.
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, LAND.y + 40, LAND.y + LAND.h - 40) }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, LAND.x + 40, LAND.x + LAND.w - 40), y: ry }; }
  }
  return best;
}

export { WORLD_W, WORLD_H, LAND, DISTRICTS };
