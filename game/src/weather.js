// Isla Fortuna — weather.js
// Day/night clock + weather. Weather changes slowly on its own; missions
// can force a condition (e.g. The Blackout is always night + rain).

import { clamp, randRange } from './random.js';

export function updateWeather(world, dt) {
  // Clock: a full in-game day lasts 8 real minutes.
  world.time += (dt * 24) / 480;
  if (world.time >= 24) world.time -= 24;
  world.weatherTimer -= dt;
  if (world.weatherTimer <= 0 && !world.weatherLocked) {
    world.weatherTimer = randRange(world.rng, 45, 90);
    const roll = world.rng();
    world.weather = roll < 0.55 ? 'clear' : roll < 0.75 ? 'haze' : roll < 0.9 ? 'rain' : 'sunset';
  }
  // Rain ambience: occasional patter (cheap, throttled by the caller).
  world.rainDrops = world.weather === 'rain'
    ? Array.from({ length: 60 }, (_, i) => ({
        x: ((i * 137.5 + world.playTime * 300) % 1400),
        y: ((i * 89.3 + world.playTime * 900) % 800),
      }))
    : [];
}

// 0..1 daylight factor from the clock (1 = noon, 0 = deep night).
export function daylight(world) {
  const t = world.time;
  if (t >= 6 && t <= 18) return 0.75 + 0.25 * Math.sin(((t - 6) / 12) * Math.PI);
  if (t > 18 && t < 20) return 0.75 - ((t - 18) / 2) * 0.7;
  if (t > 4 && t < 6) return 0.05 + ((t - 4) / 2) * 0.7;
  return 0.05;
}

export function clockString(world) {
  const h = Math.floor(world.time);
  const m = Math.floor((world.time - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isNight(world) { return world.time < 5.5 || world.time >= 19; }
