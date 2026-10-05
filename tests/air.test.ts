// Stage C: airfields, air wings, missions and their effects on battles,
// supply, movement and industry.

import { describe, expect, it } from 'vitest';
import { airCombatBonus, airControl, bombingLoss, createWing, interdiction, weeklyAir } from '../src/sim/air';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { C, WINGS } from '../src/sim/config';
import { forecastBattle } from '../src/sim/combat';
import { computeLedger } from '../src/sim/economy';
import { nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { bump, type Sim } from '../src/sim/state';
import { runTicks } from '../src/sim/tick';
import type { AirMission, WingType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, seaGame } from './helpers';

function fresh(sim: Sim) {
  bump(sim);
  nextMemoEpoch();
}

function wing(sim: Sim, nid: string, base: string, type: WingType, mission: AirMission = 'idle', target: string | null = null) {
  sim.state.provinces[base].airfield = Math.max(1, sim.state.provinces[base].airfield);
  const w = createWing(sim, nid, base, type);
  w.mission = mission;
  w.target = target;
  return w;
}

function allTech(sim: Sim, nid: string) {
  sim.state.nations[nid].research.done.push('aviation', 'fighters', 'ground_attack', 'strategic_bombing');
}

describe('airfields and wings', () => {
  it('airfields need Aviation; wings need their technology and room on an airfield', () => {
    const sim = seaGame();
    const a = sim.state.nations.a;
    a.treasury = 2000;
    a.materiel = 500;
    a.stock.rubber = 50;
    a.stock.iron = 50;
    expect(checkCommand(sim, { type: 'build', nation: 'a', province: 'a1', project: 'airfield' })).toMatch(/Aviation/);
    a.research.done.push('aviation');
    expect(applyCommand(sim, { type: 'build', nation: 'a', province: 'a1', project: 'airfield' }).ok).toBe(true);
    runTicks(sim, C.construction.airfieldWeeks, { noAI: true });
    expect(sim.state.provinces.a1.airfield).toBe(1);
    expect(checkCommand(sim, { type: 'buildWing', nation: 'a', province: 'a1', wing: 'fighter' })).toMatch(/technology/);
    expect(applyCommand(sim, { type: 'buildWing', nation: 'a', province: 'a1', wing: 'recon' }).ok).toBe(true);
    expect(applyCommand(sim, { type: 'buildWing', nation: 'a', province: 'a1', wing: 'recon' }).ok).toBe(true);
    expect(checkCommand(sim, { type: 'buildWing', nation: 'a', province: 'a1', wing: 'recon' })).toMatch(/full/);
    runTicks(sim, WINGS.recon.weeks, { noAI: true });
    expect(Object.values(sim.state.wings).filter((w) => w.nation === 'a')).toHaveLength(2);
    expect(a.stats.wingsBuilt).toBe(2);
  });

  it('missions must be in range and fit the aircraft; bombing needs an enemy target', () => {
    const sim = seaGame();
    allTech(sim, 'a');
    const f = wing(sim, 'a', 'a1', 'fighter');
    const b = wing(sim, 'a', 'a1', 'bomber');
    expect(checkCommand(sim, { type: 'airMission', nation: 'a', wing: f.id, mission: 'bombing', target: 'b1' })).toMatch(/cannot fly/);
    expect(checkCommand(sim, { type: 'airMission', nation: 'a', wing: b.id, mission: 'bombing', target: 'b1' })).toMatch(/enemy-held/);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    expect(checkCommand(sim, { type: 'airMission', nation: 'a', wing: b.id, mission: 'bombing', target: 'b1' })).toBeNull();
    // c's island is not connected by land: no hop distance, out of range
    expect(checkCommand(sim, { type: 'airMission', nation: 'a', wing: f.id, mission: 'superiority', target: 'c1' })).toMatch(/out of range/);
  });
});

describe('air power at war', () => {
  function front() {
    const sim = seaGame();
    allTech(sim, 'a');
    allTech(sim, 'b');
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const att = addArmy(sim, 'a', 'a2', { infantry: 6 });
    const def = addArmy(sim, 'b', 'b1', { infantry: 6 });
    return { sim, att, def };
  }

  it('ground support raises our firepower; enemy air superiority blunts it', () => {
    const { sim, att, def } = front();
    const base = forecastBattle(sim, 'b1', [att], [def]);
    wing(sim, 'a', 'a1', 'attack', 'support', 'b1');
    wing(sim, 'a', 'a1', 'attack', 'support', 'b1');
    fresh(sim);
    const supported = forecastBattle(sim, 'b1', [att], [def]);
    expect(supported.defLoss).toBeGreaterThan(base.defLoss);
    expect(supported.factors.some((x) => /Air support \+/.test(x))).toBe(true);
    // the enemy wins the sky over the battlefield
    for (let i = 0; i < 3; i++) wing(sim, 'b', 'b2', 'fighter', 'superiority', 'b1');
    fresh(sim);
    expect(airControl(sim, 'b1', 'a')).toBe('theirs');
    const contested = forecastBattle(sim, 'b1', [att], [def]);
    expect(contested.factors.some((x) => /enemy holds the sky/.test(x))).toBe(true);
    // the support bonus itself falls to 40%
    const full = 2 * WINGS.attack.ground * C.air.supportPer;
    expect(airCombatBonus(sim, 'b1', ['a']).mul).toBeCloseTo(1 + Math.min(C.air.supportMax, full) * C.air.contested, 9);
  });

  it('interdiction cuts an enemy army’s supply and speed', () => {
    const { sim, def } = front();
    expect(interdiction(sim, 'b1', 'b').supply).toBe(0);
    wing(sim, 'a', 'a1', 'attack', 'interdiction', 'b1');
    fresh(sim);
    const i = interdiction(sim, 'b1', 'b');
    expect(i.supply).toBeGreaterThan(0);
    expect(i.move).toBeGreaterThan(0);
    runTicks(sim, 1, { noAI: true });
    expect(sim.state.armies[def.id].supply).toBeLessThan(1);
  });

  it('bombing costs the enemy industry in the target province', () => {
    const { sim } = front();
    const before = computeLedger(sim, 'b').industry;
    wing(sim, 'a', 'a1', 'bomber', 'bombing', 'b1');
    fresh(sim);
    expect(bombingLoss(sim, 'b1')).toBeGreaterThan(0);
    expect(computeLedger(sim, 'b').industry).toBeLessThan(before);
  });

  it('fighters shoot down unescorted bombers', () => {
    const { sim } = front();
    const bomber = wing(sim, 'a', 'a1', 'bomber', 'bombing', 'b1');
    wing(sim, 'b', 'b2', 'fighter', 'superiority', 'b1');
    wing(sim, 'b', 'b2', 'fighter', 'superiority', 'b1');
    for (let i = 0; i < 4; i++) {
      fresh(sim);
      weeklyAir(sim);
    }
    expect(sim.state.wings[bomber.id]?.strength ?? 0).toBeLessThan(75);
    expect(sim.state.nations.a.stats.bombingWeeks).toBeGreaterThan(0);
  });

  it('a wing whose airfield falls rebases or is lost', () => {
    const { sim } = front();
    const w = wing(sim, 'b', 'b1', 'fighter');
    sim.state.provinces.b2.airfield = 1;
    sim.state.provinces.b1.controller = 'a';
    fresh(sim);
    weeklyAir(sim);
    expect(sim.state.wings[w.id].base).toBe('b2');
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('AI realms with aviation build airfields and fly missions in a war', () => {
    const sim = seaGame();
    sim.state.armies = {};
    for (const n of Object.values(sim.state.nations)) {
      n.treasury = 3000;
      n.materiel = 500;
      n.stock.rubber = 60;
      n.stock.iron = 60;
      n.stock.oil = 60;
      n.research.done.push('aviation', 'fighters', 'ground_attack');
    }
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    runTicks(sim, 48 * 2);
    const built = Object.values(sim.state.nations).reduce((s, n) => s + n.stats.wingsBuilt, 0);
    expect(built).toBeGreaterThan(0);
    expect(checkInvariants(sim)).toEqual([]);
  });
});
