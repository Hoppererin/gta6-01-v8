// Isla Fortuna v8 — city3d.js
// Builds the 3D island from the 2D city data (city.js): one painted ground
// texture (grass, sand, roads, lagoon, harbour, runway), box buildings
// with lit-window facades, instanced palms + street lamps, the gold casino.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD_W, WORLD_H, LAND, DISTRICTS, CASINO } from './config.js';
import { ROADS_X, ROADS_Y, ROAD_W, LAGOON, HARBOUR_BASIN, DOCKS, RUNWAY } from './city.js';

// World (x, y) -> 3D (x, 0, z): the island is centred on the origin.
export function w2x(x) { return x - WORLD_W / 2; }
export function w2z(y) { return y - WORLD_H / 2; }

// --- Canvas textures ---------------------------------------------------------

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Facade with a window grid; some windows lit warm (night shots glow).
function facadeTexture(hue, litRatio) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = `hsl(${hue}, 42%, 58%)`;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, h - 26, w, 26);
    for (let y = 18; y < h - 30; y += 34) {
      for (let x = 16; x < w - 16; x += 36) {
        const lit = Math.random() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : 'rgba(20,40,70,0.55)';
        g.fillRect(x, y, 20, 24);
      }
    }
  });
}

function roofMaterial() {
  return new THREE.MeshLambertMaterial({ color: 0x2e3138 });
}

function signTexture(line1, line2) {
  return canvasTexture(512, 192, (g, w, h) => {
    g.fillStyle = '#1a1206';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd700'; g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#ffd700';
    g.font = 'bold 54px sans-serif';
    g.textAlign = 'center';
    g.fillText(line1, w / 2, 92);
    g.fillStyle = '#fff3c4';
    g.font = 'bold 34px sans-serif';
    g.fillText(line2, w / 2, 150);
  });
}

// The island ground, painted once from the 2D city data: grass, sand rim,
// Palm Beach, jungle shade, roads + dashes, lagoon, harbour, runway.
function groundTexture(city) {
  const TW = 2048, TH = 1536;
  const sx = TW / WORLD_W, sy = TH / WORLD_H;
  return canvasTexture(TW, TH, (g) => {
    // Ocean is a separate plane; the texture only covers the island rect.
    g.fillStyle = '#e8d28a'; // sand rim
    g.fillRect(0, 0, TW, TH);
    g.fillStyle = '#69a84f'; // grass
    g.fillRect(LAND.x * sx, LAND.y * sy, LAND.w * sx, LAND.h * sy);
    g.fillStyle = '#f0d48a'; // Palm Beach sand, east coast
    g.fillRect(2580 * sx, 580 * sy, 500 * sx, 1040 * sy);
    g.fillStyle = 'rgba(20,80,30,0.35)'; // jungle
    g.fillRect(2000 * sx, 1700 * sy, 1080 * sx, 580 * sy);
    // Water bodies.
    g.fillStyle = '#2b8bc4';
    g.fillRect(LAGOON.x * sx, LAGOON.y * sy, LAGOON.w * sx, LAGOON.h * sy);
    g.fillRect(HARBOUR_BASIN.x * sx, HARBOUR_BASIN.y * sy, HARBOUR_BASIN.w * sx, HARBOUR_BASIN.h * sy);
    // District tint labels (faint, painted on the ground).
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.font = 'bold 44px sans-serif';
    g.textAlign = 'center';
    for (const d of DISTRICTS) {
      g.fillText(d.name.toUpperCase(), (d.x + d.w / 2) * sx, (d.y + d.h / 2) * sy);
    }
    // Docks.
    g.fillStyle = '#8a6b42';
    for (const d of DOCKS) g.fillRect(d.x * sx, d.y * sy, d.w * sx, d.h * sy);
    // Runway.
    g.fillStyle = '#3a3f45';
    g.fillRect(RUNWAY.x * sx, RUNWAY.y * sy, RUNWAY.w * sx, RUNWAY.h * sy);
    g.fillStyle = '#f5d76e';
    g.font = 'bold 30px sans-serif';
    g.fillText('ISLA FORTUNA AIR', (RUNWAY.x + RUNWAY.w / 2) * sx, (RUNWAY.y + RUNWAY.h / 2 + 10) * sy);
    // Roads + centre dashes.
    g.fillStyle = '#3c4147';
    for (const rx of ROADS_X) g.fillRect((rx - ROAD_W / 2) * sx, LAND.y * sy, ROAD_W * sx, LAND.h * sy);
    for (const ry of ROADS_Y) g.fillRect(LAND.x * sx, (ry - ROAD_W / 2) * sy, LAND.w * sx, ROAD_W * sy);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    g.setLineDash([26, 24]);
    g.beginPath();
    for (const rx of ROADS_X) { g.moveTo(rx * sx, LAND.y * sy); g.lineTo(rx * sx, (LAND.y + LAND.h) * sy); }
    for (const ry of ROADS_Y) { g.moveTo(LAND.x * sx, ry * sy); g.lineTo((LAND.x + LAND.w) * sx, ry * sy); }
    g.stroke();
    g.setLineDash([]);
  });
}

// --- The 3D city ---------------------------------------------------------------

export function buildCity3d(scene, city) {
  const group = new THREE.Group();
  scene.add(group);

  // Ocean plane (under everything, bigger than the island).
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 7000),
    new THREE.MeshLambertMaterial({ color: 0x1d6fa8 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -1.2;
  group.add(ocean);

  // Island ground (painted texture).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_W, WORLD_H),
    new THREE.MeshLambertMaterial({ map: groundTexture(city) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Water sheen over lagoon + harbour (slightly raised, translucent).
  const sheenMat = new THREE.MeshLambertMaterial({ color: 0x2b8bc4, transparent: true, opacity: 0.55 });
  for (const r of [LAGOON, HARBOUR_BASIN]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), sheenMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(w2x(r.x + r.w / 2), 0.6, w2z(r.y + r.h / 2));
    group.add(s);
  }

  // Buildings: boxes with window facades (4 shared variants) + dark roofs.
  const facadeMats = [0, 90, 200, 280].map((hue) => new THREE.MeshLambertMaterial({ map: facadeTexture(hue, 0.28) }));
  const roofMat = roofMaterial();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of city.buildings) {
    const h = b.casino ? 95 : 46 + Math.min(90, (b.w + b.h) / 7);
    const mat = b.casino
      ? new THREE.MeshLambertMaterial({ color: 0xd4a017 })
      : facadeMats[Math.floor(b.hue / 90) % facadeMats.length];
    const mesh = new THREE.Mesh(boxGeo, [mat, mat, roofMat, roofMat, mat, mat]);
    mesh.scale.set(b.w, h, b.h);
    mesh.position.set(w2x(b.x + b.w / 2), h / 2, w2z(b.y + b.h / 2));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (b.casino) {
      // Glowing casino sign on the south face.
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(190, 72),
        new THREE.MeshBasicMaterial({ map: signTexture('★ GILDED CROWN ★', 'CASINO') })
      );
      sign.position.set(w2x(b.x + b.w / 2), 56, w2z(b.y + b.h) + 2);
      group.add(sign);
    }
  }

  // Palms: instanced trunks + foliage (2 draw calls for ~160 palms).
  const palmCount = city.palms.length;
  const trunkGeo = new THREE.CylinderGeometry(2.2, 3.4, 26, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
  const leafGeo = new THREE.IcosahedronGeometry(13, 0);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3a });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palmCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  city.palms.forEach((p, i) => {
    q.setFromEuler(new THREE.Euler(0, 0, 0));
    s.set(p.s, p.s, p.s);
    m4.compose(new THREE.Vector3(w2x(p.x), 13 * p.s, w2z(p.y)), q, s);
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(w2x(p.x + 4 * p.s), 30 * p.s, w2z(p.y)), q, new THREE.Vector3(p.s, p.s * 0.75, p.s));
    leaves.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  group.add(trunks);
  group.add(leaves);

  // Street lamps along the road grid (instanced poles + bulbs).
  const lampPts = [];
  for (const rx of ROADS_X) for (let y = LAND.y + 200; y < LAND.y + LAND.h - 100; y += 340) lampPts.push([rx + 52, y]);
  for (const ry of ROADS_Y) for (let x = LAND.x + 200; x < LAND.x + LAND.w - 100; x += 340) lampPts.push([x, ry + 52]);
  const poleGeo = new THREE.CylinderGeometry(1.2, 1.6, 22, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampPts.length);
  const bulbGeo = new THREE.SphereGeometry(2.1, 8, 6);
  const bulbMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xcc9933 });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampPts.length);
  lampPts.forEach(([x, y], i) => {
    m4.compose(new THREE.Vector3(w2x(x), 11, w2z(y)), q, new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(w2x(x), 23, w2z(y)), q, new THREE.Vector3(1, 1, 1));
    bulbs.setMatrixAt(i, m4);
  });
  group.add(poles);
  group.add(bulbs);

  // Golden doubloons: spinning toruses (animated in render3d).
  const doubloonGeo = new THREE.TorusGeometry(11, 4.5, 8, 18);
  const doubloonMat = new THREE.MeshLambertMaterial({ color: 0xffd700, emissive: 0x664400 });
  const doubloons = city.doubloons.map((d) => {
    const mesh = new THREE.Mesh(doubloonGeo, doubloonMat);
    mesh.position.set(w2x(d.x), 14, w2z(d.y));
    mesh.rotation.x = Math.PI / 2.4;
    group.add(mesh);
    return mesh;
  });

  return { group, doubloons };
}
