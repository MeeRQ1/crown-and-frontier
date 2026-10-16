// The AI's war on the shared ground planner (format 8): failed attacks are not
// repeated at once, marches avoid enemy troops on the way, armies too small to
// fight alone join a larger one, a reserve by personality, and the same seed
// plays the same war.
//
//   a1 ─ a2 ─ a3 ─ b3 ─ b1 ─ b2 ─ c1 ─ c2 ─ a1      a2 ─ m1 ─ b1

import { describe, expect, it } from 'vitest';
import { aiGroundPolicy } from '../src/sim/ai/operational';
import { runAI } from '../src/sim/ai/ai';
import { createGame } from '../src/sim/game';
import { nextMemoEpoch } from '../src/sim/index';
import { bump, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { addArmy, lineGame } from './helpers';

function plan(sim: Sim) {
  bump(sim);
  nextMemoEpoch();
  for (const n of Object.values(sim.state.nations)) n.ai.nextOperational = 0;
  runAI(sim);
}

describe('the AI at war', () => {
  it('does not attack a province again right after an attack there failed', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const a = addArmy(sim, 'a', 'a3', { infantry: 8 });
    addArmy(sim, 'b', 'b3', { infantry: 2 });
    sim.state.reports.push({ id: 'r1', tick: sim.state.tick, province: 'b3', attackerNations: ['a'], defenderNations: ['b'], attStartMen: 8000, defStartMen: 2000, attLosses: 1000, defLosses: 500, winner: 'defender', rounds: 3, factors: [], outcome: '' });
    plan(sim);
    expect(sim.state.nations.a.ai.failures?.b3?.count).toBe(1);
    expect(sim.state.armies[a.id].path).not.toContain('b3');
    expect(sim.state.diagnostics.some((d) => d.nation === 'a' && /B3 left alone: an attack failed/.test(d.summary))).toBe(true);
  });

  it('a worn army falls back around enemy troops, not through them', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    // b's tired army stands in a's land at a3; a's army holds b3, the direct way home
    const tired = addArmy(sim, 'b', 'a3', { infantry: 3 });
    tired.morale = 0.2;
    addArmy(sim, 'a', 'b3', { infantry: 6 });
    sim.state.provinces.a3.controller = 'b';
    plan(sim);
    const path = sim.state.armies[tired.id].path;
    expect(path).not.toContain('b3');
  });

  it('armies too small to fight alone march to join a larger one, and merge there', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const big = addArmy(sim, 'a', 'a2', { infantry: 6 });
    const recruit = addArmy(sim, 'a', 'a1', { infantry: 1 });
    addArmy(sim, 'b', 'b1', { infantry: 12 });
    plan(sim);
    const r = sim.state.armies[recruit.id];
    expect(r.path.at(-1) === sim.state.armies[big.id].location || r.path.at(-1) === sim.state.armies[big.id].path.at(-1) || !sim.state.armies[recruit.id]).toBe(true);
  });

  it('keeps a reserve by personality, none on Easy', () => {
    const sim = lineGame();
    sim.state.nations.a.ai.personality = 'defensive';
    sim.state.nations.b.ai.personality = 'expansionist';
    expect(aiGroundPolicy(sim, 'a').reserve).toBeGreaterThan(aiGroundPolicy(sim, 'b').reserve);
    const easy = lineGame({ difficulty: 'easy' });
    expect(aiGroundPolicy(easy, 'a').reserve).toBe(0);
    expect(aiGroundPolicy(easy, 'a').maxDetach).toBe(0);
  });

  it('the same seed plays the same war (seeded variation only)', () => {
    const run = () => {
      const sim = createGame({ scenario: 'aldmere', seed: 9, playerNation: null });
      for (let w = 0; w < 12; w++) step(sim);
      return JSON.stringify(sim.state);
    };
    expect(run()).toBe(run());
  });
});
