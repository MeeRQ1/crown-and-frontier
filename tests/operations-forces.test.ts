// Operations (format 8): the navy, the air arm and airborne troops under an
// operation, coordinated with the ground plan; landings; rebasing by permission.
//
//   sea:  a1 ─ a2 ─ b1 ─ b2      zones W (a1), M (a2, b1, i1), E (b2, c1); i1 b's island off a2
//   line: a1 ─ a2 ─ a3 ─ b3 ─ b1 ─ b2 ─ c1 ─ c2 ─ a1

import { describe, expect, it } from 'vitest';
import { createWing, inRange } from '../src/sim/air';
import { applyCommand } from '../src/sim/commands';
import { C } from '../src/sim/config';
import { nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { createFleet, newShip, touchFleets } from '../src/sim/naval';
import { bump, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { OperationKind, OperationSettings, ShipType, WingType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, gridGame, lineGame, seaGame } from './helpers';

const TECH = ['aviation', 'fighters', 'ground_attack', 'strategic_bombing', 'all_metal_aircraft', 'air_defence', 'airborne_forces', 'naval_aviation'];

function prep(sim: Sim) {
  for (const n of Object.values(sim.state.nations)) {
    n.research.done.push(...TECH.filter((t) => !n.research.done.includes(t)));
    n.treasury = 5000;
    n.materiel = 3000;
  }
}

function op(sim: Sim, kind: OperationKind, area: string[], units: string[], settings: Partial<OperationSettings> = {}, zones: string[] = []) {
  const r = applyCommand(sim, { type: 'createOp', nation: 'a', kind, area, zones, units, settings, activate: true });
  expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  return Object.values(sim.state.operations).at(-1)!;
}

const fleet = (sim: Sim, nid: string, zone: string, types: ShipType[], home: string | null) => {
  const f = createFleet(sim, nid, zone, types.map((t) => newShip(sim, t)), home);
  touchFleets(sim);
  return f;
};
const wing = (sim: Sim, nid: string, base: string, type: WingType) => createWing(sim, nid, base, type);
const weeks = (sim: Sim, n: number) => {
  for (let i = 0; i < n; i++) step(sim, { noAI: true });
};
const fresh = (sim: Sim) => {
  bump(sim);
  nextMemoEpoch();
};

describe('aircraft under an operation', () => {
  it('fighters keep the sky and ground-attack wings support the main effort, without a click per mission', () => {
    const sim = lineGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    sim.state.provinces.a2.airfield = 2;
    const army = addArmy(sim, 'a', 'a3', { infantry: 6 });
    addArmy(sim, 'b', 'b3', { infantry: 2 });
    const f = wing(sim, 'a', 'a2', 'fighter');
    const at = wing(sim, 'a', 'a2', 'attack');
    fresh(sim);
    const o = op(sim, 'conquer', ['b3'], [army.id, f.id, at.id], { reserve: 0 });
    weeks(sim, 1);
    expect(sim.state.wings[f.id].mission).toBe('superiority');
    expect(sim.state.wings[f.id].target).toBe('b3');
    expect(['support', 'interdiction']).toContain(sim.state.wings[at.id].mission);
    expect(o.tasks[f.id].kind).toBe('cover');
    expect(sim.state.playerLog.map((x) => x.cmd.type)).toEqual(['createOp']);
  });

  it('a wing out of range is reported (no rebasing without leave); with leave it moves to an airfield in range with room', () => {
    const run = (rebase: boolean) => {
      const sim = gridGame();
      prep(sim);
      declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g41'] });
      // the wing sits at g00, the fight is at g41 (five steps, beyond its range); g10 has a free airfield in range
      sim.state.provinces.g00.airfield = 1;
      sim.state.provinces.g10.airfield = 1;
      for (const p of ['g20', 'g21', 'g30', 'g31']) sim.state.provinces[p].controller = 'a';
      const army = addArmy(sim, 'a', 'g31', { infantry: 6 });
      const f = wing(sim, 'a', 'g00', 'fighter');
      fresh(sim);
      expect(inRange(sim, f, 'g41')).toBe(false);
      const o = op(sim, 'conquer', ['g41'], [army.id, f.id], { reserve: 0, rebase, supplyLimit: false });
      weeks(sim, 1);
      return { sim, o, f: sim.state.wings[f.id] };
    };
    const no = run(false);
    expect(no.f.base).toBe('g00');
    expect(no.o.tasks[no.f.id].note).toMatch(/out of range.*Rebasing is not allowed/);
    expect(no.o.issue?.code).toBe('air-range');
    const yes = run(true);
    expect(yes.f.base).toBe('g10');
    expect(yes.f.mission).toBe('superiority');
    expect(yes.o.log.some((l) => /moved to the airfield at G10/.test(l.text))).toBe(true);
  });

  it('worn wings stand down to rest and fly again once ready', () => {
    const sim = lineGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    sim.state.provinces.a2.airfield = 2;
    const army = addArmy(sim, 'a', 'a3', { infantry: 6 });
    const f = wing(sim, 'a', 'a2', 'fighter');
    f.readiness = 20;
    fresh(sim);
    const o = op(sim, 'conquer', ['b3'], [army.id, f.id], { reserve: 0 });
    weeks(sim, 1);
    expect(sim.state.wings[f.id].mission).toBe('idle');
    expect(o.tasks[f.id].kind).toBe('rest');
  });
});

describe('fleets under an operation', () => {
  it('warships shell the coast province where the operation’s army fights; worn fleets go to port to repair', () => {
    const sim = seaGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const army = addArmy(sim, 'a', 'a2', { infantry: 8 });
    addArmy(sim, 'b', 'b1', { infantry: 2 });
    const gun = fleet(sim, 'a', 'zm', ['capital', 'cruiser'], 'a2');
    const worn = fleet(sim, 'a', 'zm', ['cruiser'], 'a2');
    worn.ships[0].hp = 30;
    fresh(sim);
    const o = op(sim, 'conquer', ['b1'], [army.id, gun.id, worn.id], { reserve: 0 });
    weeks(sim, 1);
    expect(sim.state.fleets[gun.id].duty?.kind).toBe('bombard');
    expect(sim.state.fleets[gun.id].duty?.province).toBe('b1');
    expect(o.tasks[gun.id].kind).toBe('bombard');
    expect(sim.state.fleets[worn.id].duty?.kind).toBe('port');
    expect(o.tasks[worn.id].kind).toBe('repair');
  });

  it('keeping the seas: the strongest group intercepts enemy ships in the zones, our loaded ships get an escort', () => {
    const sim = seaGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const strong = fleet(sim, 'a', 'zw', ['capital', 'cruiser', 'cruiser'], 'a1');
    const light = fleet(sim, 'a', 'zw', ['cruiser'], 'a1');
    fleet(sim, 'b', 'ze', ['cruiser'], 'b2');
    fresh(sim);
    const o = op(sim, 'sea', [], [strong.id, light.id], {}, ['zm', 'ze']);
    weeks(sim, 1);
    expect(sim.state.fleets[strong.id].duty?.kind).toBe('patrol');
    expect(sim.state.fleets[strong.id].duty?.zone).toBe('ze');
    expect(o.tasks[strong.id].note).toMatch(/intercepting/);
    expect(sim.state.fleets[light.id].duty?.kind).toBe('patrol');
  });
});

describe('a landing', () => {
  it('gathers at a port with the transports and an escort, sails, lands and then takes the area', () => {
    const sim = seaGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['i1'] });
    const army = addArmy(sim, 'a', 'a1', { infantry: 4 });
    const lift = fleet(sim, 'a', 'zw', ['transport', 'transport'], 'a1');
    const escort = fleet(sim, 'a', 'zw', ['cruiser'], 'a1');
    fresh(sim);
    const o = op(sim, 'landing', ['i1'], [army.id, lift.id, escort.id], { reserve: 0 });
    let stages: string[] = [];
    for (let w = 0; w < 20 && o.status !== 'complete'; w++) {
      weeks(sim, 1);
      stages.push(o.landing!.stage);
    }
    stages = [...new Set(stages)];
    expect(stages).toContain('sail');
    expect(sim.state.provinces.i1.controller).toBe('a');
    expect(o.stats.landings).toBe(1);
    expect(o.log.some((l) => /embarked at .* for I1, escorted by/.test(l.text))).toBe(true);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('says what is missing: no transports, or not enough room', () => {
    const sim = seaGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['i1'] });
    const army = addArmy(sim, 'a', 'a1', { infantry: 6 });
    const lift = fleet(sim, 'a', 'zw', ['transport'], 'a1');
    fresh(sim);
    const o = op(sim, 'landing', ['i1'], [army.id], { reserve: 0 });
    weeks(sim, 1);
    expect(o.issue?.text).toMatch(/No transports are assigned/);
    applyCommand(sim, { type: 'assignOp', nation: 'a', op: o.id, units: [lift.id] });
    weeks(sim, 1);
    expect(o.issue?.text).toMatch(/6 regiments but .* carries 2/);
  });
});

describe('airborne troops under a mandate', () => {
  function airborneSetup(settings: Partial<OperationSettings>, aa = 0) {
    const sim = lineGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    sim.state.provinces.a2.airfield = 2;
    sim.state.provinces.b1.aa = aa;
    const para = addArmy(sim, 'a', 'a2', { airborne: 2 });
    const ground = addArmy(sim, 'a', 'a3', { infantry: 6 });
    const t1 = wing(sim, 'a', 'a2', 'transport');
    const t2 = wing(sim, 'a', 'a2', 'transport');
    // a transport of ours NOT in the operation: never used by it
    const spare = wing(sim, 'a', 'a2', 'transport');
    fresh(sim);
    const o = op(sim, 'conquer', ['b3', 'b1'], [para.id, ground.id, t1.id, t2.id], { reserve: 0, ...settings });
    return { sim, o, para, ground, t1, t2, spare };
  }

  it('without the mandate no drop is made: paratroopers stay ground troops', () => {
    const { sim, para } = airborneSetup({ airborne: 'off' });
    weeks(sim, 2);
    expect(sim.state.armies[para.id]?.drop ?? null).toBeNull();
    expect(sim.state.nations.a.stats.airborneDrops ?? 0).toBe(0);
  });

  it('with "once", one drop inside the area with the operation’s own transports; then the mandate ends', () => {
    const { sim, o, para, t1, t2, spare } = airborneSetup({ airborne: 'once', airborneRisk: 0.3 });
    weeks(sim, 1);
    expect(o.stats.drops).toBe(1);
    expect(o.airborne).toBe('off');
    expect(sim.state.nations.a.stats.airborneDrops).toBe(1);
    // flown by t1 and t2: the spare transport stayed at home and fit
    expect(sim.state.wings[spare.id].readiness).toBeGreaterThan(sim.state.wings[t1.id].readiness);
    expect(sim.state.wings[t2.id].readiness).toBeLessThan(100);
    expect(['b3', 'b1']).toContain(sim.state.armies[para.id].location);
    expect(o.log.some((l) => /ordered to drop on/.test(l.text) && /mandate is used/.test(o.log.map((x) => x.text).join(' ')))).toBe(true);
  });

  it('a target defended beyond the loss limit is not dropped on, and the reason is shown', () => {
    const { sim, o, para } = airborneSetup({ airborne: 'repeat', airborneRisk: 0.05 }, 3);
    // b3 is next to our armies; give it guns too so every target is beyond the limit
    sim.state.provinces.b3.aa = 3;
    weeks(sim, 1);
    expect(o.stats.drops).toBe(0);
    expect(o.tasks[para.id].note).toMatch(/no drop: .*(would cost about|beyond the reach)/);
    expect(C.air.dropAA * 3).toBeGreaterThan(0.05);
  });
});

describe('a landing overtaken by events', () => {
  it('a beach taken by other means ends the landing: no crossing, no warning, the area is held', () => {
    const sim = seaGame({ playerNation: 'a' });
    prep(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['i1'] });
    const army = addArmy(sim, 'a', 'a1', { infantry: 4 });
    const lift = fleet(sim, 'a', 'zw', ['transport', 'transport'], 'a1');
    fresh(sim);
    const o = op(sim, 'landing', ['i1'], [army.id, lift.id], { reserve: 0 });
    sim.state.provinces.i1.controller = 'a';
    fresh(sim);
    weeks(sim, 2);
    expect(o.status).toBe('complete');
    expect(o.landing!.stage).toBe('ashore');
    expect(o.issue).toBeNull();
    expect(sim.state.armies[army.id].embarked ?? null).toBeNull();
  });
});
