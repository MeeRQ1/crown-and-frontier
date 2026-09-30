import { describe, expect, it } from 'vitest';
import { forecastBattle } from '../src/sim/combat';
import { armiesAt } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { addArmy, lineGame, totalMen } from './helpers';
import { checkInvariants } from '../src/sim/invariants';
import { maxMorale } from '../src/sim/military';

function atWarGame() {
  const sim = lineGame();
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  return sim;
}

describe('combat — worked examples', () => {
  it('comparable armies on plains: the outcome depends on the rolls', () => {
    const sim = atWarGame();
    const att = addArmy(sim, 'a', 'b1', { foot: 6, horse: 2 });
    const def = addArmy(sim, 'b', 'b1', { foot: 6, horse: 2 });
    def.stationary = 0;
    const f = forecastBattle(sim, 'b1', [att], [def]);
    expect(f.verdict).toBe('Uncertain');
    expect(Math.abs(f.attLoss - f.defLoss) / Math.max(f.attLoss, f.defLoss)).toBeLessThan(0.25);
  });

  it('a smaller, supplied, entrenched defender in the mountains beats a larger attacker', () => {
    const sim = atWarGame();
    sim.state.provinces.m1.owner = 'b';
    sim.state.provinces.m1.controller = 'b';
    sim.state.provinces.m1.integration = 100;
    sim.state.provinces.m1.fort = 1;
    const att = addArmy(sim, 'a', 'm1', { foot: 9 });
    const def = addArmy(sim, 'b', 'm1', { foot: 5 });
    def.stationary = 6;
    const f = forecastBattle(sim, 'm1', [att], [def]);
    expect(f.verdict).toBe('Likely defeat');
    expect(f.factors.join(' ')).toMatch(/Mountains/);
    expect(f.factors.join(' ')).toMatch(/Frontage 6/);
    // the same armies on open plains favour the larger side
    const att2 = addArmy(sim, 'a', 'b1', { foot: 9 });
    const def2 = addArmy(sim, 'b', 'b1', { foot: 5 });
    expect(forecastBattle(sim, 'b1', [att2], [def2]).verdict).toBe('Likely victory');
  });

  it('a larger but unsupplied attacker fares worse than the same army supplied', () => {
    const sim = atWarGame();
    const att = addArmy(sim, 'a', 'b1', { foot: 8 });
    const def = addArmy(sim, 'b', 'b1', { foot: 6 });
    def.stationary = 3;
    att.supply = 1;
    const supplied = forecastBattle(sim, 'b1', [att], [def]);
    att.supply = 0.2;
    const starving = forecastBattle(sim, 'b1', [att], [def]);
    expect(supplied.verdict).not.toBe('Likely defeat');
    expect(starving.attLoss).toBeGreaterThan(supplied.attLoss);
    expect(starving.factors.join(' ')).toMatch(/Unsupplied/);
    expect(['Uncertain', 'Likely defeat']).toContain(starving.verdict);
  });
});

describe('combat — live battles', () => {
  it('conserves men: every lost soldier is reported as a casualty', () => {
    const sim = atWarGame();
    addArmy(sim, 'a', 'b1', { foot: 6, horse: 2 });
    addArmy(sim, 'b', 'b1', { foot: 5, guns: 1 });
    const before = totalMen(sim);
    for (let i = 0; i < 12 && (Object.keys(sim.state.battles).length || sim.state.reports.length === 0); i++) step(sim, { noAI: true });
    const rep = sim.state.reports[0];
    expect(rep).toBeDefined();
    // regiments may reinforce after the battle (pool → regiments); check the battle-week balance instead
    const lost = rep.attLosses + rep.defLosses;
    expect(lost).toBeGreaterThan(0);
    expect(before - lost).toBeLessThanOrEqual(totalMen(sim) + 1);
    expect(checkInvariants(sim)).toEqual([]);
    for (const a of Object.values(sim.state.armies)) {
      expect(a.morale).toBeGreaterThanOrEqual(0);
      expect(a.morale).toBeLessThanOrEqual(maxMorale(sim, a.nation) + 1e-9);
    }
  });

  it('an army with no legal retreat surrenders', () => {
    const sim = atWarGame();
    // b's army stands in a3; a holds both neighbours (a2, b3) with troops
    const trapped = addArmy(sim, 'b', 'a3', { foot: 2 });
    addArmy(sim, 'a', 'a3', { foot: 8 });
    addArmy(sim, 'a', 'a2', { foot: 2 });
    addArmy(sim, 'a', 'b3', { foot: 2 });
    for (let i = 0; i < 10 && sim.state.armies[trapped.id]; i++) step(sim, { noAI: true });
    expect(sim.state.armies[trapped.id]).toBeUndefined();
    expect(sim.state.notifications.some((n) => n.kind === 'surrender' && n.nation === 'b')).toBe(true);
  });

  it('armies arriving during a battle join the right side', () => {
    const sim = atWarGame();
    addArmy(sim, 'a', 'b1', { foot: 6 });
    addArmy(sim, 'b', 'b1', { foot: 7 });
    step(sim, { noAI: true });
    const b = Object.values(sim.state.battles)[0];
    expect(b).toBeDefined();
    const late = addArmy(sim, 'b', 'b1', { foot: 2 });
    step(sim, { noAI: true });
    const b2 = sim.state.battles[b.id];
    if (b2) expect(b2.defenders).toContain(late.id);
    else expect(sim.state.reports.at(-1)!.defStartMen).toBeGreaterThanOrEqual(9000);
  });

  it('winning a battle does not transfer the province; a siege does', () => {
    const sim = atWarGame();
    addArmy(sim, 'a', 'b2', { foot: 6 });
    step(sim, { noAI: true });
    expect(sim.state.provinces.b2.controller).toBe('b');
    step(sim, { noAI: true });
    step(sim, { noAI: true });
    expect(sim.state.provinces.b2.controller).toBe('a');
    expect(armiesAt(sim, 'b2').length).toBe(1);
  });
});
