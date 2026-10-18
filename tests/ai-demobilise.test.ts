// After a war, an AI realm returns to its peace-time army (format 9) by the ordinary
// split and disband orders, unless a bordering realm is much stronger or it plans a war.
//
//   grid: columns 0–1 realm a, 2–4 realm b, 5–6 realm c

import { describe, expect, it } from 'vitest';
import { checkInvariants } from '../src/sim/invariants';
import type { Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { addArmy, gridGame } from './helpers';

const regs = (sim: Sim, nid: string) => Object.values(sim.state.armies).filter((a) => a.nation === nid).reduce((s, a) => s + a.regiments.length, 0);

function warTimeArmy(strongNeighbour: boolean): Sim {
  // realm a is the player's (its army stays as it is)
  const sim = gridGame();
  addArmy(sim, 'b', 'g31', { infantry: 30 });
  addArmy(sim, 'a', 'g01', { infantry: strongNeighbour ? 60 : 4 });
  addArmy(sim, 'c', 'g61', { infantry: 4 });
  // the war ended half a year ago
  sim.state.nations.b.ai.lastWarEnd = -26;
  return sim;
}

describe('AI demobilisation after a war', () => {
  it('stands down what exceeds its peace-time target, a part each month, with the men back in the pool', () => {
    const sim = warTimeArmy(false);
    const before = regs(sim, 'b');
    const pool = sim.state.nations.b.manpower;
    for (let i = 0; i < 30; i++) step(sim);
    const target = sim.state.nations.b.ai.armyTarget;
    expect(target).toBeLessThan(before);
    expect(regs(sim, 'b')).toBeLessThan(before);
    expect(regs(sim, 'b')).toBeGreaterThanOrEqual(Math.min(before, Math.ceil(target * 1.2) + 2) - 6);
    expect(sim.state.nations.b.manpower).toBeGreaterThan(pool);
    expect(sim.state.diagnostics.some((d) => d.nation === 'b' && /Stood down \d+ regiments after the war/.test(d.summary))).toBe(true);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('keeps its army while a bordering realm that is not friendly is much stronger', () => {
    const sim = warTimeArmy(true);
    // a is alarmed by b: not a friendly neighbour
    sim.state.alarm.a = { ...sim.state.alarm.a, b: 40 };
    // (while the alarm lasts: as it fades, a becomes a friendly neighbour again)
    for (let i = 0; i < 12; i++) step(sim);
    expect(sim.state.diagnostics.some((d) => d.nation === 'b' && /Stood down/.test(d.summary))).toBe(false);
  });
});
