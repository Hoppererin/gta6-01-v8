// Isla Fortuna — crew.js
// Hiring the crew (pause menu, keys 1/2/3). Each member is a real
// gameplay benefit, checked by the systems that use them.

import { CREW } from './config.js';

export { CREW };

export function hire(world, crewId) {
  const member = CREW.find((c) => c.id === crewId);
  if (!member) return { ok: false, msg: 'No such crew member.' };
  if (world.crew[crewId]) return { ok: false, msg: `${member.name} is already on your crew.` };
  if (world.cash < member.cost) {
    return { ok: false, msg: `Need $${member.cost} to hire ${member.name} — you have $${world.cash}.` };
  }
  world.cash -= member.cost;
  world.crew[crewId] = true;
  return { ok: true, msg: `${member.name} joined the crew! ${member.benefit}` };
}

// Car top speed multiplier from Mara the Driver (+25% when hired).
export function carSpeedMult(world) { return world.crew.mara ? 1.25 : 1; }
// Extra seconds Ada adds to timed jobs.
export function timerBonus(world) { return world.crew.ada ? 25 : 0; }
