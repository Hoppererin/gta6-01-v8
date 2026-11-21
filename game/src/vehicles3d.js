// Isla Fortuna v8 — vehicles3d.js
// 3D meshes for everything that moves: player + pedestrians + rivals,
// traffic, parked cars, police cars/boats, the police helicopter, boats,
// the mission beacon and weapon tracers. One shared geometry/material
// cache keeps draw calls low; meshes are pooled per entity object.

import * as THREE from '../vendor/three.module.min.js';
import { w2x, w2z } from './city3d.js';

const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(4.4, 4.4, 3.4, 10);
const wheelMat = mat(0x14181d);

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// A car: body + cabin + 4 wheels + headlights. `lights` adds a flashing
// red/blue police bar. The mesh faces +x at rotation.y = 0.
export function makeCarMesh(color, lights = false) {
  const g = new THREE.Group();
  const body = box(48, 13, 22, mat(color), 0, 8, 0);
  const cabin = box(24, 11, 19, mat(0x9fc4e8, { transparent: true, opacity: 0.85 }), -3, 18, 0);
  g.add(body, cabin);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const hl1 = box(2, 4, 4, headMat, 24, 8, -7);
  const hl2 = box(2, 4, 4, headMat, 24, 8, 7);
  g.add(hl1, hl2);
  for (const [wx, wz] of [[16, -11], [16, 11], [-16, -11], [-16, 11]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 4.4, wz);
    g.add(w);
  }
  let barR = null, barB = null;
  if (lights) {
    barR = box(10, 3, 6, new THREE.MeshBasicMaterial({ color: 0xff2222 }), -3, 26, -5);
    barB = box(10, 3, 6, new THREE.MeshBasicMaterial({ color: 0x2266ff }), -3, 26, 5);
    g.add(barR, barB);
  }
  g.userData.barR = barR;
  g.userData.barB = barB;
  return g;
}

export function makeBoatMesh(color) {
  const g = new THREE.Group();
  g.add(box(64, 10, 26, mat(color), 0, 5, 0));
  g.add(box(26, 10, 18, mat(0x9fc4e8, { transparent: true, opacity: 0.85 }), -6, 13, 0));
  g.add(box(10, 14, 6, mat(0xffffff), 18, 10, 0));
  return g;
}

export function makeHeliMesh() {
  const g = new THREE.Group();
  g.add(box(34, 16, 18, mat(0x1c2733), 0, 0, 0));
  g.add(box(30, 8, 8, mat(0x1c2733), -30, 2, 0));
  g.add(box(6, 16, 4, mat(0x1c2733), -44, 6, 0));
  g.add(box(10, 10, 14, mat(0x9fc4e8, { transparent: true, opacity: 0.85 }), 12, 2, 0));
  const rotor = box(72, 1.6, 5, mat(0x22262c), 0, 12, 0);
  g.add(rotor);
  g.userData.rotor = rotor;
  // Spotlight cone pointing down (visible at night / wanted).
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(26, 90, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
  );
  cone.position.set(0, -50, 0);
  cone.rotation.x = Math.PI;
  g.add(cone);
  // Skids.
  g.add(box(30, 2, 3, mat(0x22262c), 0, -12, -8));
  g.add(box(30, 2, 3, mat(0x22262c), 0, -12, 8));
  return g;
}

export function makePersonMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(6, 7.5, 20, 8), mat(color));
  body.position.y = 12;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(5.4, 10, 8), mat(0xf2c89b));
  head.position.y = 27;
  head.castShadow = true;
  g.add(body, head);
  return g;
}

// --- Mesh pool: one mesh per live entity, synced every frame --------------

export function createVehicleMeshes(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const pool = new Map(); // entity object -> mesh
  const tracerPool = [];
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe94a, transparent: true, opacity: 0.9 })
    );
    t.visible = false;
    group.add(t);
    tracerPool.push(t);
  }
  // Mission beacon: light pillar + ground ring at the current target.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 260, 12, 1, true), beaconMat);
  beacon.visible = false;
  group.add(beacon);
  const ringGeo = new THREE.RingGeometry(16, 24, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  group.add(ring);
  // Muzzle flash sphere (at the player's gun).
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(7, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe94a, transparent: true, opacity: 0.95 })
  );
  flash.visible = false;
  group.add(flash);

  function getMesh(entity, kind) {
    if (pool.has(entity)) return pool.get(entity);
    let m;
    if (kind === 'car') m = makeCarMesh(entity.color || '#c0392b');
    else if (kind === 'police') m = makeCarMesh('#1c2733', true);
    else if (kind === 'boat') m = makeBoatMesh(entity.color || '#e8e8e8');
    else if (kind === 'policeBoat') m = makeBoatMesh('#1c2733');
    else if (kind === 'heli') m = makeHeliMesh();
    else m = makePersonMesh(entity.color || '#e74c3c');
    group.add(m);
    pool.set(entity, m);
    return m;
  }

  function place(mesh, x, y, angle, z = 0) {
    mesh.position.set(w2x(x), z, w2z(y));
    mesh.rotation.y = -angle;
  }

  function prune(alive) {
    for (const [entity, mesh] of pool) {
      if (!alive.has(entity)) {
        group.remove(mesh);
        pool.delete(entity);
      }
    }
  }

  // Sync all moving meshes to the world state. `time` drives flashing.
  function sync(world, time) {
    const alive = new Set();
    const pl = world.player;
    // Player (on foot only — in a vehicle the vehicle mesh is the player).
    if (!pl.vehicle) {
      const m = getMesh(pl, 'person');
      alive.add(pl);
      place(m, pl.x, pl.y, pl.angle);
      // Player body is green.
      m.children[0].material = mat(0x2ecc71);
    } else {
      if (pool.has(pl)) { group.remove(pool.get(pl)); pool.delete(pl); }
    }
    for (const v of world.vehicles) {
      const m = getMesh(v, v.type === 'boat' ? 'boat' : 'car');
      alive.add(v);
      place(m, v.x, v.y, v.angle, v.type === 'boat' ? 2 : 0);
      // Green ring marks the driven vehicle (and only that one).
      if (v === pl.vehicle) {
        m.userData.ring = m.userData.ring || (() => {
          const r = new THREE.Mesh(new THREE.RingGeometry(34, 38, 28), new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
          r.rotation.x = -Math.PI / 2;
          r.position.y = 1;
          m.add(r);
          return r;
        })();
        m.userData.ring.visible = true;
      } else if (m.userData.ring) {
        m.userData.ring.visible = false;
      }
    }
    for (const t of world.traffic) {
      const m = getMesh(t, 'car');
      alive.add(t);
      place(m, t.x, t.y, t.angle);
    }
    for (const r of world.raceRivals) {
      const m = getMesh(r, 'car');
      alive.add(r);
      place(m, r.x, r.y, r.angle);
    }
    for (const p of world.police) {
      const m = getMesh(p, p.type === 'policeBoat' ? 'policeBoat' : 'police');
      alive.add(p);
      place(m, p.x, p.y, p.angle, p.type === 'policeBoat' ? 2 : 0);
      // Flashing light bar + disabled smoke (tilt + dark).
      if (m.userData.barR) {
        const on = Math.floor(time * 3) % 2 === 0;
        m.userData.barR.visible = on && !p.disabled;
        m.userData.barB.visible = !on && !p.disabled;
      }
      if (p.disabled) m.rotation.z = 0.06;
    }
    if (world.heli) {
      const h = world.heli;
      const m = getMesh(h, 'heli');
      alive.add(h);
      m.position.set(w2x(h.x), h.z, w2z(h.y));
      m.rotation.y = -h.angle;
      if (m.userData.rotor) m.userData.rotor.rotation.y = h.rotor;
    }
    for (const p of world.peds) {
      if (p.down > 0) {
        // Knocked down: lie flat.
        const m = getMesh(p, 'person');
        alive.add(p);
        place(m, p.x, p.y, p.angle);
        m.rotation.z = Math.PI / 2;
        m.position.y = 4;
        continue;
      }
      const m = getMesh(p, 'person');
      alive.add(p);
      place(m, p.x, p.y, p.angle);
      m.rotation.z = 0;
    }
    for (const r of world.rivals) {
      const m = getMesh(r, 'person');
      alive.add(r);
      place(m, r.x, r.y, r.angle);
      m.children[0].material = mat(0x8e2f2f);
      // Hit flash: white body.
      if (r.hitFlash > 0) m.children[0].material = mat(0xffffff);
      // HP bar is drawn by the HUD (2D overlay reads rivals).
    }
    prune(alive);
    return { alive };
  }

  // Tracers: stretch a cylinder between two ground points.
  function drawTracers(world) {
    const list = (world.weapons && world.weapons.tracers) || [];
    tracerPool.forEach((t, i) => {
      const tr = list[i];
      if (!tr) { t.visible = false; return; }
      const a = new THREE.Vector3(w2x(tr.x1), 26, w2z(tr.y1));
      const b = new THREE.Vector3(w2x(tr.x2), 26, w2z(tr.y2));
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const len = a.distanceTo(b);
      t.visible = true;
      t.position.copy(mid);
      t.scale.set(1, len, 1);
      t.lookAt(b);
      t.rotateX(Math.PI / 2);
      t.material.opacity = Math.min(0.9, tr.ttl * 8);
    });
  }

  function drawBeacon(target, time) {
    if (!target) { beacon.visible = false; ring.visible = false; return; }
    beacon.visible = true;
    ring.visible = true;
    beacon.position.set(w2x(target.x), 130, w2z(target.y));
    beacon.material.opacity = 0.08 + 0.04 * Math.sin(time * 4);
    ring.position.set(w2x(target.x), 1.5, w2z(target.y));
    const s = 1 + 0.12 * Math.sin(time * 5);
    ring.scale.set(s, s, 1);
  }

  function drawFlash(world) {
    const w = world.weapons;
    if (!w || w.flash <= 0 || world.player.vehicle) { flash.visible = false; return; }
    const pl = world.player;
    const a = pl.angle;
    flash.visible = true;
    flash.position.set(w2x(pl.x + Math.cos(a) * 26), 26, w2z(pl.y + Math.sin(a) * 26));
  }

  return { group, sync, drawTracers, drawBeacon, drawFlash };
}
