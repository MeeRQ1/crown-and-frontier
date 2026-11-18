// The AI's standing army follows what is around it, not its treasury: at peace the army
// it began with or what its neighbours' armies call for (a share below one, so realms
// watching each other settle instead of arming without end); at war also what the enemy
// side fields; threatened, also the threat's army. A rival about to win is still met with
// everything the treasury allows.
//
//   grid: columns 0–1 realm a (the player), 2–4 realm b, 5–6 realm c

import { describe, expect, it } from 'vitest';
import { armyNeed, peaceNeed, regimentCount } from '../src/sim/ai/strategic';
import { grossIncome } from '../src/sim/economy';
import { createGame } from '../src/sim/game';
import type { Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { addArmy, gridGame } from './helpers';

const regs = (sim: Sim, nid: string) => Object.values(sim.state.armies).filter((a) => a.nation === nid).reduce((s, a) => s + a.regiments.length, 0);

/** b began with `b` regiments; a and c field the given armies. */
function setup(a: number, b: number, c: number): Sim {
  const sim = gridGame();
  addArmy(sim, 'a', 'g01', { infantry: a });
  addArmy(sim, 'b', 'g31', { infantry: b });
  addArmy(sim, 'c', 'g61', { infantry: c });
  sim.state.nations.b.ai.baseArmy = b;
  return sim;
}

describe('the army an AI realm needs', () => {
  it('every new campaign records the army each realm began with', () => {
    const sim = createGame({ scenario: 'europe-1936', seed: 1, playerNation: 'ger' });
    for (const nid of ['fra', 'sov', 'swe']) expect(sim.state.nations[nid].ai.baseArmy).toBe(regs(sim, nid));
  });

  it('at peace with weak neighbours: the army it began with', () => {
    const sim = setup(4, 10, 4);
    expect(armyNeed(sim, 'b', null)).toEqual({ needed: 10, neededFor: 'the standing army we began with' });
  });

  it('a neighbour that arms is answered with a share of its army, below parity', () => {
    const sim = setup(30, 10, 4);
    const need = peaceNeed(sim, 'b');
    expect(need.from).toBe('a');
    // a neutral neighbour: 0.6 of its army, and 0.15 of the others'
    expect(need.need).toBeCloseTo(30 * 0.6 + 4 * 0.6 * 0.15, 6);
    expect(armyNeed(sim, 'b', null).needed).toBe(Math.ceil(need.need));
    expect(armyNeed(sim, 'b', null).needed).toBeLessThan(30);
  });

  it("at war: what the enemy side fields, with a margin; threatened: the threat's army", () => {
    const sim = setup(4, 10, 12);
    declareWar(sim, 'b', 'c', { type: 'conquest', provinces: ['g50'] });
    expect(armyNeed(sim, 'b', null)).toEqual({ needed: Math.ceil(regimentCount(sim, 'c') * 1.3), neededFor: 'the enemy side in our wars' });
    const calm = setup(4, 10, 40);
    expect(armyNeed(calm, 'b', 'c')).toEqual({ needed: 40, neededFor: "C's army" });
  });
});

describe('the AI army on a historical map', () => {
  it('a realm at peace keeps the army it began with while its income grows', () => {
    const sim = createGame({ scenario: 'europe-1936', seed: 1, playerNation: 'ger' });
    const swe = sim.state.nations.swe;
    const income = grossIncome(swe.lastMonth);
    for (let i = 0; i < 52; i++) step(sim);
    expect(Object.values(sim.state.wars).some((w) => w.attackers.includes('swe') || w.defenders.includes('swe'))).toBe(false);
    expect(regs(sim, 'swe')).toBeLessThanOrEqual((swe.ai.baseArmy ?? 0) + 2);
    expect(grossIncome(swe.lastMonth)).toBeGreaterThan(income * 1.1);
  });
});
