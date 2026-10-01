import { describe, expect, it } from 'vitest';
import { forecastBattle } from '../src/sim/combat';
import { armiesAt, bump } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { addArmy, lineGame, totalMen } from './helpers';
import { checkInvariants } from '../src/sim/invariants';
import { maxMorale } from '../src/sim/military';
import { C } from '../src/sim/config';
import { reserveCap } from '../src/sim/economy';
import { nationMods } from '../src/sim/modifiers';

function atWarGame() {
  const sim = lineGame();
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  return sim;
}

describe('combat — worked examples', () => {
  it('comparable armies on plains: the outcome depends on the rolls', () => {
    const sim = atWarGame();
    const att = addArmy(sim, 'a', 'b1', { infantry: 6, cavalry: 2 });
    const def = addArmy(sim, 'b', 'b1', { infantry: 6, cavalry: 2 });
    def.stationary = 0;
    const f = forecastBattle(sim, 'b1', [att], [def]);
    expect(f.verdict).toBe('Uncertain');
    expect(Math.abs(f.attLoss - f.defLoss) / Math.max(f.attLoss, f.defLoss)).toBeLessThan(0.25);
  });

  it('a smaller, supplied, entrenched defender in the mountains beats a larger attacker', () => {
    const sim = atWarGame();
    sim.state.provinces.m1.owner = 'b';
    sim.state.provinces.m1.controller = 'b';
    bump(sim); // direct edit: refresh derived lookups
    sim.state.provinces.m1.integration = 100;
    sim.state.provinces.m1.fort = 1;
    const att = addArmy(sim, 'a', 'm1', { infantry: 9 });
    const def = addArmy(sim, 'b', 'm1', { infantry: 5 });
    def.stationary = 6;
    const f = forecastBattle(sim, 'm1', [att], [def]);
    expect(f.verdict).toBe('Likely defeat');
    expect(f.factors.join(' ')).toMatch(/Mountains/);
    expect(f.factors.join(' ')).toMatch(/Frontage 6/);
    // the same armies on open plains favour the larger side
    const att2 = addArmy(sim, 'a', 'b1', { infantry: 9 });
    const def2 = addArmy(sim, 'b', 'b1', { infantry: 5 });
    expect(forecastBattle(sim, 'b1', [att2], [def2]).verdict).toBe('Likely victory');
  });

  it('a larger but unsupplied attacker fares worse than the same army supplied', () => {
    const sim = atWarGame();
    const att = addArmy(sim, 'a', 'b1', { infantry: 8 });
    const def = addArmy(sim, 'b', 'b1', { infantry: 6 });
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
    addArmy(sim, 'a', 'b1', { infantry: 6, cavalry: 2 });
    addArmy(sim, 'b', 'b1', { infantry: 5, artillery: 1 });
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
    const trapped = addArmy(sim, 'b', 'a3', { infantry: 2 });
    addArmy(sim, 'a', 'a3', { infantry: 8 });
    addArmy(sim, 'a', 'a2', { infantry: 2 });
    addArmy(sim, 'a', 'b3', { infantry: 2 });
    for (let i = 0; i < 10 && sim.state.armies[trapped.id]; i++) step(sim, { noAI: true });
    expect(sim.state.armies[trapped.id]).toBeUndefined();
    expect(sim.state.notifications.some((n) => n.kind === 'surrender' && n.nation === 'b')).toBe(true);
  });

  // Stage A fix: men lost to pursuit and surrender used to count in the statistics
  // but not in war exhaustion, so a rout cost the loser less than a long fight.
  it('every man lost in battle adds to war exhaustion, including pursuit and surrender', () => {
    const lastWeek = (setup: (sim: ReturnType<typeof atWarGame>) => string) => {
      const sim = atWarGame();
      const loser = setup(sim);
      let ex = 0;
      let lost = 0;
      for (let i = 0; i < 12 && sim.state.reports.length === 0; i++) {
        ex = sim.state.nations.b.warExhaustion;
        lost = sim.state.nations.b.stats.menLost;
        step(sim, { noAI: true });
      }
      expect(sim.state.reports.length).toBe(1);
      const men = sim.state.nations.b.stats.menLost - lost;
      const expected = (men / Math.max(5000, reserveCap(sim, 'b'))) * C.war.exhaustionPerLossShare * Math.max(0.1, 1 + nationMods(sim, 'b').warExhaustion);
      return { gained: sim.state.nations.b.warExhaustion - ex, expected, men, gone: !sim.state.armies[loser] };
    };
    // surrounded: the beaten army surrenders
    const trapped = lastWeek((sim) => {
      const t = addArmy(sim, 'b', 'a3', { infantry: 2 });
      addArmy(sim, 'a', 'a3', { infantry: 8 });
      addArmy(sim, 'a', 'a2', { infantry: 2 });
      addArmy(sim, 'a', 'b3', { infantry: 2 });
      return t.id;
    });
    expect(trapped.gone).toBe(true);
    expect(trapped.men).toBeGreaterThan(1000);
    expect(trapped.gained).toBeGreaterThan(trapped.expected * 0.9);
    // routed in the open: the winners' horse pursue
    const routed = lastWeek((sim) => {
      const r = addArmy(sim, 'b', 'b1', { infantry: 3 });
      addArmy(sim, 'a', 'b1', { infantry: 4, cavalry: 8 });
      return r.id;
    });
    expect(routed.gained).toBeGreaterThan(routed.expected * 0.9);
  });

  it('armies arriving during a battle join the right side', () => {
    const sim = atWarGame();
    addArmy(sim, 'a', 'b1', { infantry: 6 });
    addArmy(sim, 'b', 'b1', { infantry: 7 });
    step(sim, { noAI: true });
    const b = Object.values(sim.state.battles)[0];
    expect(b).toBeDefined();
    const late = addArmy(sim, 'b', 'b1', { infantry: 2 });
    step(sim, { noAI: true });
    const b2 = sim.state.battles[b.id];
    if (b2) expect(b2.defenders).toContain(late.id);
    else expect(sim.state.reports.at(-1)!.defStartMen).toBeGreaterThanOrEqual(9000);
  });

  it('winning a battle does not transfer the province; a siege does', () => {
    const sim = atWarGame();
    addArmy(sim, 'a', 'b2', { infantry: 6 });
    step(sim, { noAI: true });
    expect(sim.state.provinces.b2.controller).toBe('b');
    step(sim, { noAI: true });
    step(sim, { noAI: true });
    expect(sim.state.provinces.b2.controller).toBe('a');
    expect(armiesAt(sim, 'b2').length).toBe(1);
  });
});
