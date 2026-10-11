// Stage B: resources, industry, trade, the industrial roster and their rules.

import { describe, expect, it } from 'vitest';
import { C, UNITS } from '../src/sim/config';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { forecastBattle } from '../src/sim/combat';
import { computeLedger, monthlyEconomy, provinceDeposit, resourceCap } from '../src/sim/economy';
import { nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { bump } from '../src/sim/state';
import { runTicks } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { addArmy, lineGame } from './helpers';

/** Settles a month with fresh derived values (tests edit the state directly). */
function settle(sim: ReturnType<typeof lineGame>) {
  bump(sim);
  nextMemoEpoch();
  monthlyEconomy(sim);
  nextMemoEpoch();
}

describe('resources', () => {
  it('a deposit yields its resource each month, up to the stockpile cap', () => {
    const sim = lineGame();
    const a = sim.state.nations.a;
    const d = provinceDeposit(sim, 'a2')!;
    expect(d.res).toBe('coal');
    expect(d.amount).toBeGreaterThan(0);
    a.stock.coal = 0;
    sim.state.provinces.a1.factories = 0;
    sim.state.provinces.a2.factories = 0;
    sim.state.provinces.a3.factories = 0;
    settle(sim);
    expect(a.stock.coal).toBeCloseTo(d.amount, 5);
    a.stock.coal = resourceCap(sim, 'a');
    settle(sim);
    expect(a.stock.coal).toBe(resourceCap(sim, 'a'));
  });

  it('an occupied deposit yields nothing to its owner', () => {
    const sim = lineGame();
    sim.state.provinces.a2.controller = 'b';
    bump(sim);
    expect(provinceDeposit(sim, 'a2')!.amount).toBe(0);
  });
});

describe('industry', () => {
  it('factories burn coal and make materiel; without coal they run at a fraction and a shortage is reported', () => {
    const sim = lineGame();
    const b = sim.state.nations.b; // b has no coal deposit
    sim.state.provinces.b1.factories = 3;
    b.materiel = 0;
    b.stock.coal = 100;
    settle(sim);
    const withCoal = b.lastMonth.industry;
    expect(withCoal).toBeGreaterThan(0);
    expect(b.materiel).toBeGreaterThan(0);
    expect(b.shortages).not.toContain('coal');
    b.stock.coal = 0;
    b.materiel = 0;
    settle(sim);
    expect(b.lastMonth.industry).toBeCloseTo(withCoal * C.industry.unpowered, 9);
    expect(b.shortages).toContain('coal');
    expect(sim.state.notifications.some((n) => n.nation === 'b' && n.kind === 'shortage')).toBe(true);
  });

  it('output beyond the materiel cap is sold as manufactured goods', () => {
    const sim = lineGame();
    const a = sim.state.nations.a;
    sim.state.provinces.a1.factories = 3;
    a.stock.coal = 100;
    a.materiel = 1e6;
    bump(sim);
    nextMemoEpoch();
    const l = computeLedger(sim, 'a');
    expect(l.materielIn).toBe(0);
    expect(l.income['Manufactured goods']).toBeGreaterThan(0);
  });

  it('a factory is a construction project that needs iron and integration', () => {
    const sim = lineGame();
    const a = sim.state.nations.a;
    a.treasury = 1000;
    a.stock.iron = 0;
    expect(checkCommand(sim, { type: 'build', nation: 'a', province: 'a1', project: 'factory' })).toMatch(/iron/);
    a.stock.iron = 50;
    sim.state.provinces.a1.integration = 30;
    expect(checkCommand(sim, { type: 'build', nation: 'a', province: 'a1', project: 'factory' })).toMatch(/Integrate/);
    sim.state.provinces.a1.integration = 100;
    const before = sim.state.provinces.a1.factories;
    expect(applyCommand(sim, { type: 'build', nation: 'a', province: 'a1', project: 'factory' }).ok).toBe(true);
    expect(a.stock.iron).toBe(50 - C.construction.factoryIron);
    runTicks(sim, C.construction.factoryWeeks, { noAI: true });
    expect(sim.state.provinces.a1.factories).toBe(before + 1);
  });

  it('replacing losses costs materiel; without it, armies stay understrength', () => {
    // one week from tick 0 (no month end, so no factory output muddles the stockpile)
    const run = (materiel: number) => {
      const sim = lineGame();
      const a = sim.state.nations.a;
      const army = addArmy(sim, 'a', 'a1', { infantry: 3 }, 500);
      a.manpower = 10000;
      a.materiel = materiel;
      runTicks(sim, 1, { noAI: true });
      return { men: sim.state.armies[army.id].regiments.map((r) => r.men), materiel: a.materiel };
    };
    expect(run(0).men).toEqual([500, 500, 500]);
    const r = run(100);
    expect(r.men.every((m) => m > 500)).toBe(true);
    const gained = r.men.reduce((s, m) => s + m - 500, 0);
    expect(r.materiel).toBeCloseTo(100 - (gained / C.regimentSize) * UNITS.infantry.materiel * C.industry.reinforceMateriel, 9);
  });
});

// trade between realms: tests/trade.test.ts (contracts, format 5)

describe('industrial roster', () => {
  it('armour and engineers need their technology', () => {
    const sim = lineGame();
    const a = sim.state.nations.a;
    a.treasury = 1000;
    a.materiel = 1000;
    a.manpower = 10000;
    for (const r of ['iron', 'oil', 'rubber', 'nitrates'] as const) a.stock[r] = 100;
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'armour' })).toMatch(/Tanks/);
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'engineers' })).toMatch(/Engineering Corps/);
    a.research.done.push('tanks', 'engineering_corps');
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'armour' })).toBeNull();
    expect(applyCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'armour' }).ok).toBe(true);
    expect(a.stock.rubber).toBe(100 - UNITS.armour.resources.rubber!);
    // cancelling returns materiel and resources (crowns are lost)
    applyCommand(sim, { type: 'cancelRecruit', nation: 'a', province: 'a1' });
    expect(a.stock.rubber).toBe(100);
  });

  it('machine guns cut cavalry fire', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const att = addArmy(sim, 'a', 'a2', { cavalry: 6 });
    const def = addArmy(sim, 'b', 'b1', { infantry: 4 });
    const before = forecastBattle(sim, 'b1', [att], [def]);
    sim.state.nations.b.research.done.push('machine_guns');
    sim.state.tick++; // modifiers are cached per week
    const after = forecastBattle(sim, 'b1', [att], [def]);
    expect(after.defLoss).toBeLessThan(before.defLoss);
    expect(after.factors.some((f) => /Machine guns/.test(f))).toBe(true);
  });

  it('armour breaks through forts and trenches; without oil it fights at half strength', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    sim.state.provinces.b1.fort = 3;
    const def = addArmy(sim, 'b', 'b1', { infantry: 6 });
    sim.state.armies[def.id].stationary = 8;
    const inf = addArmy(sim, 'a', 'a2', { infantry: 6 });
    const tanks = addArmy(sim, 'a', 'a2', { infantry: 3, armour: 3 });
    const f1 = forecastBattle(sim, 'b1', [inf], [def]);
    const f2 = forecastBattle(sim, 'b1', [tanks], [def]);
    expect(f2.factors.some((f) => /Armour breaks through/.test(f))).toBe(true);
    expect(f2.defLoss).toBeGreaterThan(f1.defLoss);
    sim.state.nations.a.shortages = ['oil'];
    const f3 = forecastBattle(sim, 'b1', [tanks], [def]);
    // a weaker push: dearer for the attacker and a less certain result
    expect(f3.attLoss).toBeGreaterThan(f2.attLoss);
    const wins = (f: typeof f2) => f.outcomes.filter((o) => o === 'attacker').length;
    expect(wins(f3)).toBeLessThan(wins(f2));
    expect(f3.factors.some((f) => /short of oil/.test(f))).toBe(true);
  });

  it('engineers halve the river bonus and dig in twice as fast', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const def = addArmy(sim, 'b', 'b3', { infantry: 4 });
    const plain = addArmy(sim, 'a', 'a3', { infantry: 6 });
    const sappers = addArmy(sim, 'a', 'a3', { infantry: 5, engineers: 1 });
    const river = (f: ReturnType<typeof forecastBattle>) => f.factors.find((x) => /river/i.test(x)) ?? '';
    expect(river(forecastBattle(sim, 'b3', [plain], [def]))).toMatch(/\+20%/);
    expect(river(forecastBattle(sim, 'b3', [sappers], [def]))).toMatch(/\+10%.*engineers/);
  });

  it('a campaign with the industrial roster keeps a consistent world', () => {
    const sim = lineGame({}, true);
    for (const n of Object.values(sim.state.nations)) n.research.done.push('engineering_corps', 'tanks');
    runTicks(sim, 48 * 3);
    expect(checkInvariants(sim)).toEqual([]);
  });
});
