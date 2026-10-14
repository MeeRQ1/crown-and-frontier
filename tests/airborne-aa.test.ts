// Airborne operations and anti-aircraft defence (format 7).
//
//   a1 ─ a2 ─ a3 ─ b3 ─ b1 ─ b2 ─ c1 ─ c2 ─ a1      a's airfield at a2; b's capital b1

import { describe, expect, it } from 'vitest';
import { bombingPower, createWing } from '../src/sim/air';
import { aaAgainst, airDropRisk } from '../src/sim/airborne';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { C } from '../src/sim/config';
import { computeLedger } from '../src/sim/economy';
import { nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { readSave, serialize } from '../src/sim/save';
import { bump, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { AirMission, WingType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, lineGame } from './helpers';

const TECH = ['aviation', 'fighters', 'ground_attack', 'strategic_bombing', 'all_metal_aircraft', 'air_defence', 'airborne_forces'];

function setup(): Sim {
  const sim = lineGame({ playerNation: 'a' });
  for (const n of Object.values(sim.state.nations)) {
    n.research.done.push(...TECH.filter((t) => !n.research.done.includes(t)));
    n.treasury = 5000;
    n.materiel = 3000;
  }
  sim.state.provinces.a2.airfield = 2;
  sim.state.provinces.b2.airfield = 1;
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  return sim;
}

function wing(sim: Sim, nid: string, base: string, type: WingType, mission: AirMission = 'idle', target: string | null = null) {
  const w = createWing(sim, nid, base, type);
  w.mission = mission;
  w.target = target;
  return w;
}

const fresh = (sim: Sim) => {
  bump(sim);
  nextMemoEpoch();
};
const week = (sim: Sim, n = 1) => {
  for (let i = 0; i < n; i++) step(sim, { noAI: true });
};
const men = (sim: Sim, id: string) => sim.state.armies[id]?.regiments.reduce((s, r) => s + r.men, 0) ?? 0;

describe('airborne operations: preparation and reasons', () => {
  it('a drop needs the technology, airborne regiments only, an airfield, enough ready transports and range', () => {
    const sim = setup();
    const para = addArmy(sim, 'a', 'a2', { airborne: 2 });
    const mixed = addArmy(sim, 'a', 'a2', { airborne: 1, infantry: 1 });
    const away = addArmy(sim, 'a', 'a1', { airborne: 1 });
    const why = (army: string, target: string) => checkCommand(sim, { type: 'airDrop', nation: 'a', army, target });
    wing(sim, 'a', 'a2', 'transport');
    expect(why(para.id, 'b3')).toMatch(/Needs 2 ready transport wings at A2 \(one regiment each\); 1 of 1 there is ready/);
    wing(sim, 'a', 'a2', 'transport');
    expect(why(para.id, 'b3')).toBeNull();
    expect(why(mixed.id, 'b3')).toMatch(/Only airborne regiments can be dropped/);
    expect(why(away.id, 'b3')).toMatch(/must stand at one of our airfields/);
    expect(why(para.id, 'a2')).toMatch(/already there/);
    sim.state.nations.a.research.done = sim.state.nations.a.research.done.filter((t) => t !== 'airborne_forces');
    expect(why(para.id, 'b3')).toMatch(/Airborne Forces technology/);
  });

  it('the army waits at the airfield until it is flown, and the drop can be called off', () => {
    const sim = setup();
    const para = addArmy(sim, 'a', 'a2', { airborne: 1 });
    wing(sim, 'a', 'a2', 'transport');
    expect(applyCommand(sim, { type: 'airDrop', nation: 'a', army: para.id, target: 'b3' }).ok).toBe(true);
    expect(checkCommand(sim, { type: 'move', nation: 'a', army: para.id, dest: 'a1' })).toMatch(/waiting at the airfield/);
    // a second operation cannot use the same transports
    const other = addArmy(sim, 'a', 'a2', { airborne: 1 });
    expect(checkCommand(sim, { type: 'airDrop', nation: 'a', army: other.id, target: 'b3' })).toMatch(/0 of 1 there are ready/);
    expect(applyCommand(sim, { type: 'cancelDrop', nation: 'a', army: para.id }).ok).toBe(true);
    week(sim);
    expect(sim.state.armies[para.id].location).toBe('a2');
  });
});

describe('airborne operations: the drop', () => {
  it('troops dropped on undefended enemy land take it like any army: the only way aircraft take ground', () => {
    const sim = setup();
    const para = addArmy(sim, 'a', 'a2', { airborne: 2 });
    wing(sim, 'a', 'a2', 'transport');
    wing(sim, 'a', 'a2', 'transport');
    expect(applyCommand(sim, { type: 'airDrop', nation: 'a', army: para.id, target: 'b3' }).ok).toBe(true);
    week(sim);
    const a = sim.state.armies[para.id];
    expect(a.location).toBe('b3');
    expect(a.drop).toBeNull();
    expect(sim.state.nations.a.stats.airborneDrops).toBe(1);
    // the transports flew it, and came back worn
    const ts = Object.values(sim.state.wings).filter((w) => w.type === 'transport');
    expect(ts.every((w) => w.report?.note.startsWith('Dropped 1st Army') || w.report?.note.startsWith('Dropped'))).toBe(true);
    expect(ts.every((w) => w.readiness < 100 - C.air.dropWear + C.air.recover)).toBe(true);
    for (let i = 0; i < 4 && sim.state.provinces.b3.controller !== 'a'; i++) week(sim);
    expect(sim.state.provinces.b3.controller).toBe('a');
  });

  it('enemy fighters over the target and anti-aircraft guns there take their share of the men, capped', () => {
    const loss = (fighters: number, aa: number) => {
      const sim = setup();
      sim.state.provinces.b3.aa = aa;
      for (let i = 0; i < fighters; i++) wing(sim, 'b', 'b2', 'fighter', 'superiority', 'b3');
      fresh(sim);
      return airDropRisk(sim, 'a', 'b3').loss;
    };
    expect(loss(0, 0)).toBe(0);
    expect(loss(0, 3)).toBeCloseTo(3 * C.air.dropAA, 9);
    expect(loss(3, 0)).toBeCloseTo(C.air.dropIntercept, 9);
    expect(loss(3, 3)).toBeLessThanOrEqual(C.air.dropLossMax);
    expect(loss(3, 3)).toBeGreaterThan(loss(3, 0));
    // and the men are really lost
    const sim = setup();
    sim.state.provinces.b3.aa = 3;
    const para = addArmy(sim, 'a', 'a2', { airborne: 1 });
    wing(sim, 'a', 'a2', 'transport');
    const before = men(sim, para.id);
    applyCommand(sim, { type: 'airDrop', nation: 'a', army: para.id, target: 'b3' });
    week(sim);
    expect(men(sim, para.id)).toBeLessThan(before * (1 - 3 * C.air.dropAA) + 1);
  });

  it('dropped on enemy troops, the landing troops fight at a disadvantage that week', () => {
    const sim = setup();
    const para = addArmy(sim, 'a', 'a2', { airborne: 2 });
    addArmy(sim, 'b', 'b3', { infantry: 2 });
    wing(sim, 'a', 'a2', 'transport');
    wing(sim, 'a', 'a2', 'transport');
    applyCommand(sim, { type: 'airDrop', nation: 'a', army: para.id, target: 'b3' });
    week(sim);
    // the battle on the drop zone, fought this week: its factors name the landing
    const b = Object.values(sim.state.battles).find((x) => x.province === 'b3');
    const rep = sim.state.reports.find((r) => r.province === 'b3');
    const factors = b?.factors ?? rep?.factors ?? [];
    expect(factors.some((f) => /Dropped from the air this week, still gathering −30%/.test(f))).toBe(true);
  });

  it('a drop whose airfield falls before it is flown is called off, and the army stays', () => {
    const sim = setup();
    const para = addArmy(sim, 'a', 'a2', { airborne: 1 });
    wing(sim, 'a', 'a2', 'transport');
    applyCommand(sim, { type: 'airDrop', nation: 'a', army: para.id, target: 'b3' });
    sim.state.provinces.a2.controller = 'b';
    week(sim);
    expect(sim.state.armies[para.id]?.drop ?? null).toBeNull();
    expect(sim.state.notifications.some((n) => /drop of .* was called off: the airfield at A2 is no longer ours/.test(n.text))).toBe(true);
  });

  it('a pending drop survives a save and load', () => {
    const sim = setup();
    const para = addArmy(sim, 'a', 'a2', { airborne: 1 });
    wing(sim, 'a', 'a2', 'transport');
    applyCommand(sim, { type: 'airDrop', nation: 'a', army: para.id, target: 'b3' });
    const back = readSave(serialize(sim)).sim;
    expect(back.state.armies[para.id].drop).toEqual(sim.state.armies[para.id].drop);
    expect(checkInvariants(back)).toEqual([]);
  });
});

describe('anti-aircraft defence', () => {
  it('batteries and mobile guns add up to a cap: more guns do not stack without limit', () => {
    const sim = setup();
    sim.state.provinces.b3.aa = 3;
    addArmy(sim, 'b', 'b3', { artillery: 10 });
    fresh(sim);
    const aa = aaAgainst(sim, 'b3', 'a');
    expect(aa.batteries).toBe(3);
    expect(aa.mobile).toBe(C.air.mobileAAMax);
    expect(aa.total).toBe(C.air.aaMax);
    // without Air Defence, artillery has no anti-aircraft fire
    sim.state.nations.b.research.done = sim.state.nations.b.research.done.filter((t) => t !== 'air_defence');
    fresh(sim);
    expect(aaAgainst(sim, 'b3', 'a').mobile).toBe(0);
  });

  it('anti-aircraft fire blunts bombing and costs the bombers strength', () => {
    const run = (aa: number) => {
      const sim = setup();
      sim.state.provinces.b1.aa = aa;
      sim.state.provinces.b1.fort = 0;
      const w = wing(sim, 'a', 'a2', 'bomber', 'bombing', 'b1');
      fresh(sim);
      const power = bombingPower(sim, 'b1');
      week(sim);
      return { power, strength: sim.state.wings[w.id]?.strength ?? 0 };
    };
    const open = run(0);
    const defended = run(3);
    expect(defended.power).toBeLessThan(open.power);
    expect(defended.power).toBeCloseTo(open.power * (1 - 3 * C.air.aaEffect), 6);
    expect(defended.strength).toBeLessThan(open.strength);
  });

  it('batteries are built as a project with the technology, up to their limit, and cost upkeep', () => {
    const sim = setup();
    expect(checkCommand(sim, { type: 'build', nation: 'a', province: 'a2', project: 'flak' })).toBeNull();
    sim.state.provinces.a2.aa = C.construction.flakMax;
    expect(checkCommand(sim, { type: 'build', nation: 'a', province: 'a2', project: 'flak' })).toMatch(/maximum level/);
    sim.state.nations.a.research.done = sim.state.nations.a.research.done.filter((t) => t !== 'air_defence');
    sim.state.provinces.a2.aa = 0;
    expect(checkCommand(sim, { type: 'build', nation: 'a', province: 'a2', project: 'flak' })).toMatch(/Air Defence technology/);
    sim.state.provinces.a2.aa = 2;
    expect(computeLedger(sim, 'a').expenses['Anti-aircraft batteries']).toBeCloseTo(2 * C.construction.flakUpkeep, 9);
  });
});
