# Isla Fortuna — 3D

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Hoppererin/gta6-01-v8/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Hoppererin/gta6-01-v8/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, set on the invented
Caribbean island of **Isla Fortuna** — now in **3D third-person**
(Three.js, vendored under `game/vendor/`). Dante Reyes, getaway driver,
runs twelve story jobs for the fixer Auntie Marisol — from a first
taxi fare to the Fortuna heist at the Gilded Crown Casino — then free
roam across the island.

## What's in the game

- **A 3D island to explore on foot, by car and by boat**: Fortuna City,
  the Gilded Mile casino strip, Old Town, the fishing harbour, Palm
  Beach, the jungle and an airstrip — with traffic, pedestrians,
  palms, parks, a plaza, street lamps and a sunset sky.
- **12 story jobs with a real arc**: fares, package runs, getaways,
  a boat pickup, a street race, a turf war, a scanner heist, a
  blackout delivery, an escort, three vault keys and the finale.
- **A wanted level with police who respond** — named FCPD dispatch
  units (MARLIN-2, TARPON-38, BULWARK-1…), patrol cars, police boats,
  roadblocks, and the **AIR-1 police helicopter** with a spotlight at
  3+ stars — plus a **heat meter** the island remembers between jobs.
- **Combat**: fists, pistol, SMG and shotgun (unlocks at job 9), with
  tracers, muzzle flash and ammo. Shoot out police cars to disable them.
- **A crew to hire**: Mara the Driver, Leo the Lookout, Ada the Hacker
  — each changes how the island plays.
- **Progression**: street respect (ROOKIE → DRIVER → SHOT CALLER →
  KINGPIN), named radio stations, named cars with condition and a
  speedometer, 8 golden doubloons, taxi fares and street races.
- **A day/night cycle with weather**: dawn, noon, golden sunset,
  night lamps and island rain.
- **A dense HUD**: mission panel, live minimap, FCPD dispatch panel,
  weapon slots, respect bar, radio, speedometer, dialogue with
  character portraits; start screen, pause menu, and save/load in the
  browser.

## Controls

WASD / arrows — move and drive · E — enter a car or boat · Click —
shoot · 1–4 — weapons · Space — punch · Shift — run · P — pause ·
M — mute · H — horn · R — retry a failed job.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network — the
game is plain static files under `game/` (Three.js is vendored).

---

<sub>Entered on [make.fun](https://make.fun/?ref=dhj53q2r)</sub>
