// Isla Fortuna v8 — render3d.js
// The 3D renderer: Three.js scene, third-person chase camera, sun + sky
// dome that follows the clock, fog, rain, shadows. Maps the 2D world
// (x, y) to 3D (x, height, z). The 2D game logic never changes — only
// the picture does.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD_W, WORLD_H } from './config.js';
import { buildCity3d, w2x, w2z } from './city3d.js';
import { createVehicleMeshes } from './vehicles3d.js';
import { missionTarget } from './missions.js';
import { daylight } from './weather.js';
import { clamp } from './random.js';

function skyTexture(top, mid, low) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, low);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Sky palette per time of day: [top, horizon, fog, sun color, sun intensity, hemi intensity]
function skyFor(world) {
  const t = world.time;
  const dl = daylight(world);
  if (world.weather === 'sunset' || (t >= 16.5 && t < 19)) {
    return { top: '#3a1c5e', mid: '#ff7a3c', low: '#ffc46b', fog: 0xcf7a52, sun: 0xffb36b, sunI: 2.4, hemiI: 0.55, sunElev: 0.16 };
  }
  if (dl < 0.25) {
    return { top: '#050914', mid: '#0d1b33', low: '#1b2a44', fog: 0x0d1b33, sun: 0xbfd4ff, sunI: 0.75, hemiI: 0.45, sunElev: 0.5, moon: true };
  }
  if (t >= 6 && t < 10) {
    return { top: '#7ec8f2', mid: '#ffd9a0', low: '#f2e2b8', fog: 0xcfd8e0, sun: 0xffe9b0, sunI: 2.0, hemiI: 0.8, sunElev: 0.35 };
  }
  if (world.weather === 'rain') {
    return { top: '#5a6b7d', mid: '#8a9aa8', low: '#aab6c0', fog: 0x8a9aa8, sun: 0xdfe8ee, sunI: 1.1, hemiI: 0.7, sunElev: 0.6 };
  }
  if (world.weather === 'haze') {
    return { top: '#8fb8d8', mid: '#d8e2e8', low: '#e8e0c8', fog: 0xd8e2e8, sun: 0xfff2cc, sunI: 1.7, hemiI: 0.75, sunElev: 0.55 };
  }
  return { top: '#3f8fd2', mid: '#9fd4f2', low: '#e8f2f8', fog: 0xa8c8e0, sun: 0xfff2cc, sunI: 2.6, hemiI: 0.9, sunElev: 0.8 };
}

export function createRenderer3d(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 1, 9000);
  camera.position.set(0, 200, 400);

  // Sky dome (gradient sphere that follows the camera) + sun disc + clouds.
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), skyMat);
  scene.add(sky);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(150, 24), sunMat);
  scene.add(sun);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(90 + (i % 4) * 30, 10, 8), cloudMat);
    cl.scale.y = 0.32;
    cl.position.set(-2600 + (i * 397) % 5200, 700 + (i % 3) * 120, -2200 + (i * 733) % 4400);
    scene.add(cl);
    clouds.push(cl);
  }

  // Lighting: hemisphere + sun with shadows that follow the player.
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a5a3a, 0.9);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xfff2cc, 2.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(512, 512);
  sunLight.shadow.camera.left = -500;
  sunLight.shadow.camera.right = 500;
  sunLight.shadow.camera.top = 500;
  sunLight.shadow.camera.bottom = -500;
  sunLight.shadow.camera.near = 50;
  sunLight.shadow.camera.far = 2600;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);
  scene.add(sunLight.target);

  scene.fog = new THREE.Fog(0xa8c8e0, 500, 3400);

  const city3d = buildCity3d(scene, world.city);
  const vehicles = createVehicleMeshes(scene);

  // Rain streaks around the camera (Points, recycled).
  const RAIN_N = 420;
  const rainPos = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 900;
    rainPos[i * 3 + 1] = Math.random() * 320;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 900;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaac4e8, size: 2.4, transparent: true, opacity: 0.7 }));
  rain.visible = false;
  scene.add(rain);

  const camPos = new THREE.Vector3(0, 220, 420);
  const camLook = new THREE.Vector3(0, 0, 0);
  let lastSkyKey = '';
  // Dynamic render scale: the game renders at full resolution on a real GPU,
  // but drops the internal buffer (CSS size stays) when frames are slow, so
  // it stays playable on software renderers (SwiftShader). 1 = full res.
  let renderScale = 1;
  let cssW = 1280, cssH = 720;

  function setSize(w, h) {
    cssW = w; cssH = h;
    renderer.setPixelRatio(renderScale);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setRenderScale(s) {
    renderScale = Math.min(1, Math.max(0.25, s));
    renderer.setPixelRatio(renderScale);
    renderer.setSize(cssW, cssH, false);
  }

  // The frame render. `dt` is the clamped frame delta (seconds).
  function render(w, dt, time) {
    const pl = w.player;
    const inCar = !!(pl.vehicle && pl.vehicle.type !== 'boat');
    const inBoat = !!(pl.vehicle && pl.vehicle.type === 'boat');

    // --- Sky + light follow the clock/weather (only rebuild on change) ---
    const pal = skyFor(w);
    const skyKey = `${pal.top}|${pal.mid}|${pal.low}|${pal.fog}`;
    if (skyKey !== lastSkyKey) {
      lastSkyKey = skyKey;
      skyMat.map = skyTexture(pal.top, pal.mid, pal.low);
      skyMat.needsUpdate = true;
      scene.fog.color.setHex(pal.fog);
    }
    hemi.intensity = pal.hemiI;
    sunLight.intensity = pal.sunI;
    sunLight.color.setHex(pal.sun);
    sunMat.color.setHex(pal.moon ? 0xdfe8f8 : 0xfff2cc);
    const sunAz = (w.time / 24) * Math.PI * 2 - Math.PI / 2;
    const sunDir = new THREE.Vector3(Math.cos(sunAz) * 0.7, pal.sunElev, Math.sin(sunAz) * 0.7).normalize();
    const px = w2x(pl.x), pz = w2z(pl.y);
    sun.position.set(px + sunDir.x * 3600, sunDir.y * 3600, pz + sunDir.z * 3600);
    sun.lookAt(px, 0, pz);
    sky.position.set(px, 0, pz);
    sunLight.position.set(px + sunDir.x * 900, 400 + sunDir.y * 500, pz + sunDir.z * 900);
    sunLight.target.position.set(px, 0, pz);
    for (const cl of clouds) cl.position.x += dt * 6;

    // --- Chase camera (third person, behind the player) ---
    const fwd = { x: Math.cos(pl.angle), z: Math.sin(pl.angle) };
    let dist = inCar ? 26 : inBoat ? 30 : 15;
    let height = inCar ? 12 : inBoat ? 14 : 8;
    let lookAhead = inCar ? 16 : 10;
    if (w.camOverride) {
      // Staged screenshot camera (set by shots.js).
      camPos.set(w.camOverride.pos[0], w.camOverride.pos[1], w.camOverride.pos[2]);
      camLook.set(w.camOverride.look[0], w.camOverride.look[1], w.camOverride.look[2]);
    } else {
      const tx = px - fwd.x * dist, tz = pz - fwd.z * dist;
      const k = 1 - Math.exp(-dt * 5);
      camPos.x += (tx - camPos.x) * k;
      camPos.z += (tz - camPos.z) * k;
      camPos.y += (height - camPos.y) * k;
      camLook.x += (px + fwd.x * lookAhead - camLook.x) * (1 - Math.exp(-dt * 7));
      camLook.y += (2 - camLook.y) * (1 - Math.exp(-dt * 7));
      camLook.z += (pz + fwd.z * lookAhead - camLook.z) * (1 - Math.exp(-dt * 7));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // Aim ray for weapons: camera forward, projected to the ground.
    const cd = new THREE.Vector3();
    camera.getWorldDirection(cd);
    w.camDir = { x: cd.x, z: cd.z };

    // --- Rain ---
    rain.visible = w.weather === 'rain';
    if (rain.visible) {
      const pos = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_N; i++) {
        pos[i * 3 + 1] -= dt * 420;
        if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 320;
      }
      rainGeo.attributes.position.needsUpdate = true;
      rain.position.set(px, 0, pz);
    }

    // --- City life ---
    for (let i = 0; i < city3d.doubloons.length; i++) {
      const d = w.doubloons[i];
      const mesh = city3d.doubloons[i];
      mesh.visible = !d.taken;
      if (mesh.visible) {
        mesh.rotation.y += dt * 2.4;
        mesh.position.y = 14 + Math.sin(time * 2 + i) * 3;
      }
    }

    vehicles.sync(w, time);
    vehicles.drawTracers(w);
    vehicles.drawBeacon(missionTarget(w), time);
    vehicles.drawFlash(w);
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, render, setSize, setRenderScale, renderScale: () => renderScale };
}
