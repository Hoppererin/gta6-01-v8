// Isla Fortuna — config.js
// World constants, districts, crew prices, tuning. No imports.

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const LAND = { x: 120, y: 120, w: 2960, h: 2160 }; // ocean surrounds this rect
export const START_CASH = 150;
export const SAVE_KEY = 'isla-fortuna-save-v7';

// Heat -> wanted-star thresholds (stars are DERIVED from heat, never added directly — see wantedFromHeat in police.js).
export const WANTED_THRESHOLDS = [20, 40, 60, 80, 95];
export const PED_HIT_HEAT = 5; // small: a bump is not a felony
export const HEAT_DECAY_PER_SEC = 1.6; // while quiet (no crime for 4s)
export const HEAT_DECAY_FAST_PER_SEC = 3.0; // while quiet AND no police nearby

export const DISTRICTS = [
  { name: 'Gilded Mile', x: 1100, y: 130, w: 1000, h: 420, color: '#e8c15a' },
  { name: 'Old Town', x: 300, y: 600, w: 800, h: 800, color: '#d98a4b' },
  { name: 'Harbour', x: 130, y: 1400, w: 700, h: 700, color: '#4b9fd8' },
  { name: 'Palm Beach', x: 2600, y: 600, w: 470, h: 1000, color: '#f2d38a' },
  { name: 'Jungle', x: 2000, y: 1700, w: 1080, h: 580, color: '#3f7a3a' },
  { name: 'Airstrip', x: 2200, y: 130, w: 860, h: 420, color: '#9aa3ad' },
];

export const CREW = [
  { id: 'mara', name: 'Mara the Driver', cost: 400, key: '1',
    benefit: 'Faster cars, sharper handling (+25% top speed, +30% grip).' },
  { id: 'leo', name: 'Leo the Lookout', cost: 350, key: '2',
    benefit: 'Police spot you later; heat fades twice as fast when laying low.' },
  { id: 'ada', name: 'Ada the Hacker', cost: 600, key: '3',
    benefit: 'Timed jobs get +25 seconds; police cameras go dark faster.' },
];

export const DOUBLOON_REWARD = 150;
export const DOUBLOON_SPOTS = [
  [1550, 620], [420, 900], [2900, 900], [2400, 2100],
  [950, 2050], [2750, 300], [1700, 1650], [600, 1450],
];

// Casino / key landmarks (shared by city, missions, render).
export const CASINO = { x: 1380, y: 430, w: 260, h: 200 }; // between roads y=350 and y=700 — never on a road
export const CASINO_FRONT = { x: 1510, y: 660 };
export const CASINO_VAULT = { x: 1510, y: 640 }; // plaza just south of the casino doors (NOT inside the solid building)
export const HARBOUR_OFFICE = { x: 480, y: 1680 };
export const HARBOUR_DOCK = { x: 330, y: 1700 };
export const AIRSTRIP_GETAWAY = { x: 2620, y: 320 };
export const PLAYER_START = { x: 800, y: 1250 };

export const WEATHERS = ['clear', 'rain', 'haze', 'sunset'];
