// Naval, air and combined warfare: repeatable scenarios through the real weekly
// tick (no AI), with controlled starting conditions. Each scenario checks that an
// effect resolves, and that it stops when its conditions go: range, assignment,
// target, base, carrier, peace. The small sea map of the tests (helpers.ts):
//
//   a1 ─ a2 ─ b1 ─ b2        land; i1 is b's island across a strait from a2;
//    W     M         E       c1 is realm c's island, reached only by sea (zone E)

import { describe, expect, it } from 'vitest';
import { airControl, createWing, deckSlots, missionProblem, relocateAir, wingStatus, wingsAboard } from '../src/sim/air';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { C } from '../src/sim/config';
import { computeLedger } from '../src/sim/economy';
import { nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { createFleet, newShip, raidLoss, touchFleets, tradeOpen } from '../src/sim/naval';
import { bump, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { AirMission, AirWing, Fleet, ShipType, WingType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, seaGame } from './helpers';
import { createGame } from '../src/sim/game';
import { warReach } from '../src/sim/reach';
import { readSave, serialize } from '../src/sim/save';
import { borders } from '../src/sim/state';
import { isBeachhead, supplyConnected } from '../src/sim/supply';
import { applyPeace, declareWarProblem, goalOptions } from '../src/sim/war';

function fresh(sim: Sim) {
  bump(sim);
  touchFleets(sim);
  nextMemoEpoch();
}

const AIR = ['aviation', 'fighters', 'ground_attack', 'strategic_bombing', 'naval_aviation', 'submarines', 'torpedo_boats'];

function equip(sim: Sim) {
  for (const n of Object.values(sim.state.nations)) {
    n.research.done.push(...AIR.filter((t) => !n.research.done.includes(t)));
    n.treasury = 5000;
    n.materiel = 3000;
    for (const r of Object.keys(n.stock) as Array<keyof typeof n.stock>) n.stock[r] = 500;
  }
}

function wing(sim: Sim, nid: string, base: string, type: WingType, mission: AirMission = 'idle', target: string | null = null, zone: string | null = null): AirWing {
  sim.state.provinces[base].airfield = Math.max(2, sim.state.provinces[base].airfield);
  const w = createWing(sim, nid, base, type);
  w.mission = mission;
  w.target = target;
  w.zone = zone;
  return w;
}

function fleet(sim: Sim, nid: string, zone: string, types: ShipType[], home: string | null = null): Fleet {
  return createFleet(sim, nid, zone, types.map((t) => newShip(sim, t)), home);
}

const week = (sim: Sim, n = 1) => {
  for (let i = 0; i < n; i++) step(sim, { noAI: true });
};

/** a attacks b at b1 from a2: 6 infantry against 6 dug-in infantry. */
function landFront() {
  const sim = seaGame();
  equip(sim);
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
  const att = addArmy(sim, 'a', 'a2', { infantry: 6 });
  const def = addArmy(sim, 'b', 'b1', { infantry: 6 });
  def.stationary = 4;
  applyCommand(sim, { type: 'move', nation: 'a', army: att.id, dest: 'b1' });
  fresh(sim);
  return { sim, att, def };
}

/** Marches the attack in and fights the first round; returns the battle. */
function firstRound(sim: Sim) {
  for (let i = 0; i < 4; i++) {
    week(sim);
    const b = Object.values(sim.state.battles)[0];
    if (b) return b;
  }
  throw new Error('no battle');
}

describe('land combat with and without air support', () => {
  it('two ground-attack wings over the battle add fire to that battle, name themselves and cost the defender more men', () => {
    const plain = landFront();
    const b0 = firstRound(plain.sim);
    const air = landFront();
    const w1 = wing(air.sim, 'a', 'a1', 'attack', 'support', 'b1');
    const w2 = wing(air.sim, 'a', 'a1', 'attack', 'support', 'b1');
    fresh(air.sim);
    const b1 = firstRound(air.sim);
    expect(b1.defLosses).toBeGreaterThan(b0.defLosses);
    expect(b1.factors.some((f) => /^Attacker: Air support \+\d+% from 2 wings/.test(f))).toBe(true);
    expect(b1.support!.att.map((l) => l.id).sort()).toEqual([w1.id, w2.id].sort());
    expect(b0.support!.att).toEqual([]);
    // the wings say what they did, and they flew (readiness worn)
    expect(air.sim.state.wings[w1.id].report!.note).toMatch(/Supported the battle of B1/);
    expect(air.sim.state.wings[w1.id].readiness).toBeLessThan(100);
    expect(air.sim.state.nations.a.stats.supportWeeks).toBeGreaterThanOrEqual(2);
  });

  it('a wing supports one battle a week: two battles in its area do not both get it', () => {
    const { sim } = landFront();
    // a second battle in the same area: a also attacks b2 from b1's other side... a lands at b2 instead
    const second = addArmy(sim, 'a', 'b2', { infantry: 4 });
    addArmy(sim, 'b', 'b2', { infantry: 4 });
    void second;
    const w = wing(sim, 'a', 'a1', 'attack', 'support', 'b1');
    fresh(sim);
    week(sim, 3);
    const battles = Object.values(sim.state.battles);
    expect(battles.length).toBe(2);
    const supported = battles.filter((b) => b.support!.att.some((l) => l.id === w.id));
    expect(supported).toHaveLength(1);
    // the battle at its target comes first
    expect(supported[0].province).toBe('b1');
  });

  it('support stops when the order is cancelled, and when the wing is out of range', () => {
    const { sim } = landFront();
    const w = wing(sim, 'a', 'a1', 'attack', 'support', 'b1');
    fresh(sim);
    const b = firstRound(sim);
    expect(b.support!.att).toHaveLength(1);
    applyCommand(sim, { type: 'airMission', nation: 'a', wing: w.id, mission: 'idle', target: null });
    week(sim);
    expect(sim.state.battles[b.id]?.support?.att ?? []).toEqual([]);
    // order it again from an airfield out of reach: grounded, with the reason
    const far = wing(sim, 'a', 'a1', 'attack', 'idle');
    sim.state.provinces.a1.airfield = 2;
    far.base = 'a1';
    far.carrier = null;
    fresh(sim);
    const p = missionProblem(sim, 'a', far.id, 'support', 'c1');
    expect(p).toMatch(/out of range/);
  });
});

describe('contested airspace and interception', () => {
  function raid(escorted: boolean) {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    sim.state.provinces.b1.factories = 3;
    const bomber = wing(sim, 'a', 'a1', 'bomber', 'bombing', 'b1');
    const escort = escorted ? [wing(sim, 'a', 'a1', 'fighter', 'superiority', 'b1'), wing(sim, 'a', 'a2', 'fighter', 'superiority', 'b1')] : [];
    const interceptors = [wing(sim, 'b', 'b2', 'fighter', 'superiority', 'b1'), wing(sim, 'b', 'b2', 'fighter', 'superiority', 'b1')];
    fresh(sim);
    return { sim, bomber, escort, interceptors };
  }

  it('enemy fighters over the target hold the sky and shoot an unescorted bomber down; escorts contest the sky and save it', () => {
    const lone = raid(false);
    expect(airControl(lone.sim, 'b1', 'a')).toBe('theirs');
    week(lone.sim, 3);
    const covered = raid(true);
    expect(airControl(covered.sim, 'b1', 'a')).not.toBe('theirs');
    week(covered.sim, 3);
    const loneLeft = lone.sim.state.wings[lone.bomber.id]?.strength ?? 0;
    const coveredLeft = covered.sim.state.wings[covered.bomber.id]?.strength ?? 0;
    expect(loneLeft).toBeLessThan(coveredLeft);
    // the interceptors are credited with what they shot down
    expect(lone.sim.state.nations.b.stats.airKills).toBeGreaterThan(0);
    expect(lone.sim.state.wings[lone.interceptors[0].id].report!.note).toMatch(/shot down/);
  });

  it('what a mission achieves falls with the sky: the bombing does less where the enemy holds it', () => {
    const lone = raid(false);
    const covered = raid(true);
    const l = computeLedger(lone.sim, 'b').industry;
    const c = computeLedger(covered.sim, 'b').industry;
    // more industry is lost under contested skies than under enemy-held ones
    expect(c).toBeLessThan(l);
  });
});

describe('logistics strikes and their consequences', () => {
  function front() {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    return sim;
  }

  it('interdiction cuts the supply of the enemy armies in its area, and says so', () => {
    const sim = front();
    const def = addArmy(sim, 'b', 'b1', { infantry: 4 });
    week(sim);
    const before = sim.state.armies[def.id].supply;
    const w = wing(sim, 'a', 'a1', 'attack', 'interdiction', 'b1');
    fresh(sim);
    week(sim);
    expect(sim.state.armies[def.id].supply).toBeLessThan(before);
    expect(sim.state.wings[w.id].report!.note).toMatch(/Interdicted 1 enemy army around B1/);
  });

  it('bombing a port stops its shipyard and grounds the aircraft on its airfield; when the bombing stops, so does the damage', () => {
    const sim = front();
    sim.state.provinces.b1.port = 2;
    sim.state.provinces.b1.dock.push({ nation: 'b', ship: 'cruiser', weeksLeft: 10 });
    const victim = wing(sim, 'b', 'b1', 'fighter');
    const bombers = [wing(sim, 'a', 'a1', 'bomber', 'bombing', 'b1'), wing(sim, 'a', 'a1', 'bomber', 'bombing', 'b1')];
    fresh(sim);
    week(sim, 2);
    expect(sim.state.provinces.b1.dock[0].weeksLeft).toBe(10);
    expect(sim.state.wings[victim.id].readiness).toBeLessThan(80);
    expect(sim.state.wings[bombers[0].id].report!.note).toMatch(/shipyard halted.*grounded on the airfield/);
    for (const b of bombers) applyCommand(sim, { type: 'airMission', nation: 'a', wing: b.id, mission: 'idle', target: null });
    week(sim);
    expect(sim.state.provinces.b1.dock[0].weeksLeft).toBe(9);
  });
});

describe('coastal combat with and without shore bombardment', () => {
  function coast(withFleet: 'none' | 'offshore' | 'elsewhere' | 'sailing', fort = 0) {
    const { sim, att, def } = landFront();
    sim.state.provinces.b1.fort = fort;
    let f: Fleet | null = null;
    if (withFleet === 'offshore') f = fleet(sim, 'a', 'zm', ['capital', 'cruiser'], 'a2');
    if (withFleet === 'elsewhere') f = fleet(sim, 'a', 'ze', ['capital', 'cruiser'], 'a2');
    if (withFleet === 'sailing') {
      f = fleet(sim, 'a', 'zm', ['capital', 'cruiser'], 'a2');
      f.path = ['ze'];
    }
    fresh(sim);
    return { sim, att, def, f };
  }

  it('gun ships lying off the coast shell the battle on it: more enemy losses, named in the battle', () => {
    const none = coast('none');
    const b0 = firstRound(none.sim);
    const off = coast('offshore');
    const b1 = firstRound(off.sim);
    expect(b1.factors.some((f) => /^Attacker: Naval gunfire \+\d+% from A First Squadron offshore/.test(f))).toBe(true);
    expect(b1.support!.att.some((l) => l.kind === 'naval' && l.id === off.f!.id)).toBe(true);
    expect(b1.defLosses).toBeGreaterThan(b0.defLosses);
    expect(off.sim.state.nations.a.stats.bombardWeeks).toBeGreaterThan(0);
  });

  it('ships out of position, or under way, do not bombard', () => {
    for (const where of ['elsewhere', 'sailing'] as const) {
      const c = coast(where);
      const b = firstRound(c.sim);
      expect(b.support!.att.filter((l) => l.kind === 'naval'), where).toEqual([]);
    }
  });

  it('coastal forts fire back at the bombarding ships', () => {
    const c = coast('offshore', 2);
    const hp0 = c.f!.ships.reduce((s, x) => s + x.hp, 0);
    firstRound(c.sim);
    const f = c.sim.state.fleets[c.f!.id];
    expect(f.ships.reduce((s, x) => s + x.hp, 0)).toBeLessThan(hp0);
    expect(f.report!.notes.join(' ')).toMatch(/coastal forts \(level 2\) hit back/);
  });

  it('air and naval support together never add more than the cap', () => {
    const c = coast('offshore');
    for (let i = 0; i < 4; i++) wing(c.sim, 'a', 'a1', 'attack', 'support', 'b1');
    fresh(c.sim);
    const b = firstRound(c.sim);
    expect(b.factors.some((f) => /Fire support capped at \+50%/.test(f))).toBe(true);
    const total = b.support!.att.reduce((s, l) => s + l.value, 0);
    expect(total).toBeCloseTo(C.naval.supportCap, 6);
  });
});

describe('raiding, blockade and counterplay', () => {
  function trade() {
    const sim = seaGame();
    equip(sim);
    // b and c trade by sea (b's trade port b1 on the Middle Water, c's c1 on the East Water)
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    fresh(sim);
    return sim;
  }

  it('submarines on the route take a share of the trade between b and c; screens there turn most of them away', () => {
    const sim = trade();
    expect(tradeOpen(sim, 'b', 'c')).toBe(1);
    fleet(sim, 'a', 'ze', ['submarine', 'submarine']);
    fresh(sim);
    const raided = raidLoss(sim, 'b', 'c');
    expect(raided.zones).toEqual(['ze']);
    expect(raided.share).toBeGreaterThan(0.3);
    // no blockade: b1's coast is clear, b2's has only submarines (half weight) against no defenders
    expect(tradeOpen(sim, 'b', 'c')).toBeLessThan(1 - raided.share + 1e-9);
    fleet(sim, 'b', 'ze', ['screen', 'screen', 'screen']);
    fresh(sim);
    const escorted = raidLoss(sim, 'b', 'c');
    expect(escorted.share).toBeLessThan(raided.share / 2);
  });

  it('a reconnaissance patrol over the zone lets the escorts find the submarines: they sink more', () => {
    const run = (patrol: boolean) => {
      const sim = trade();
      fleet(sim, 'a', 'ze', ['submarine', 'submarine', 'submarine']);
      fleet(sim, 'b', 'ze', ['screen', 'screen']);
      if (patrol) wing(sim, 'b', 'b2', 'recon', 'recon', null, 'ze');
      fresh(sim);
      week(sim);
      return Object.values(sim.state.fleets).filter((f) => f.nation === 'a').reduce((s, f) => s + f.ships.reduce((x, sh) => x + sh.hp, 0), 0);
    };
    expect(run(true)).toBeLessThan(run(false));
  });
});

describe('protected and exposed sea transport', () => {
  /** a ships 4 infantry from a1 (West Water) to b2 (East Water) through the Middle Water, which b's strike aircraft watch. */
  function crossing(protect: boolean) {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    const army = addArmy(sim, 'a', 'a1', { infantry: 4 });
    const ships: ShipType[] = protect ? ['transport', 'transport', 'screen', 'screen', 'cruiser'] : ['transport', 'transport'];
    const tf = fleet(sim, 'a', 'zw', ships, 'a1');
    // b's strike aircraft at b1 patrol and strike the Middle Water
    wing(sim, 'b', 'b1', 'attack', 'naval', null, 'zm');
    wing(sim, 'b', 'b1', 'attack', 'naval', null, 'zm');
    wing(sim, 'b', 'b1', 'recon', 'recon', null, 'zm');
    // the protected convoy also has fighters over the Middle Water from a2
    if (protect) {
      wing(sim, 'a', 'a2', 'fighter', 'superiority', null, 'zm');
      wing(sim, 'a', 'a2', 'fighter', 'superiority', null, 'zm');
    }
    fresh(sim);
    expect(applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tf.id, dest: 'b2' }).ok).toBe(true);
    week(sim, 3);
    const a = sim.state.armies[army.id];
    return { sim, tf, army: a, landed: a && !a.embarked && a.location === 'b2', regiments: a?.regiments.length ?? 0 };
  }

  it('an unescorted convoy under enemy strike aircraft loses transports and the troops aboard them', () => {
    const exposed = crossing(false);
    expect(exposed.regiments).toBeLessThan(4);
    expect(checkInvariants(exposed.sim)).toEqual([]);
  });

  it('escorts and fighter cover bring the troops through', () => {
    const exposed = crossing(false);
    const covered = crossing(true);
    expect(covered.regiments).toBeGreaterThan(exposed.regiments);
    expect(covered.landed).toBe(true);
    expect(checkInvariants(covered.sim)).toEqual([]);
  });

  it('troops wait offshore while enemy warships hold the beach waters, and the fleet says why', () => {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    const army = addArmy(sim, 'a', 'b1', { infantry: 2 });
    const tf = fleet(sim, 'a', 'zm', ['transport'], 'a2');
    fleet(sim, 'b', 'ze', ['cruiser', 'cruiser'], 'b2');
    fresh(sim);
    applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tf.id, dest: 'b2' });
    week(sim, 2);
    // the transport either went down with its troops, or waits with them aboard; no army is ever stranded ashore half-landed
    const a = sim.state.armies[army.id];
    if (a) {
      expect(a.embarked).toBeTruthy();
      expect(sim.state.fleets[a.embarked!].report!.notes.join(' ')).toMatch(/enemy warships outgun ours/);
    }
    expect(checkInvariants(sim)).toEqual([]);
  });
});

describe('carriers: mobile air bases', () => {
  /** a at war with c, whose island c1 lies four steps from a1: beyond land-based ground attack. */
  function island() {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'c', { type: 'conquest', provinces: ['c1'] });
    const cv = fleet(sim, 'a', 'ze', ['carrier', 'screen', 'screen'], 'a2');
    const att = addArmy(sim, 'a', 'c1', { infantry: 4 });
    const def = addArmy(sim, 'c', 'c1', { infantry: 4 });
    def.stationary = 4;
    fresh(sim);
    return { sim, cv, att, def };
  }

  it('wings fly aboard within ferry range, only the types a deck takes, up to its capacity', () => {
    const { sim, cv } = island();
    const f1 = wing(sim, 'a', 'a1', 'fighter');
    const a1 = wing(sim, 'a', 'a1', 'attack');
    const a2 = wing(sim, 'a', 'a1', 'attack');
    const bo = wing(sim, 'a', 'a1', 'bomber');
    fresh(sim);
    expect(checkCommand(sim, { type: 'rebaseWing', nation: 'a', wing: bo.id, carrier: cv.id })).toMatch(/too heavy/);
    expect(applyCommand(sim, { type: 'rebaseWing', nation: 'a', wing: f1.id, carrier: cv.id }).ok).toBe(true);
    expect(applyCommand(sim, { type: 'rebaseWing', nation: 'a', wing: a1.id, carrier: cv.id }).ok).toBe(true);
    expect(checkCommand(sim, { type: 'rebaseWing', nation: 'a', wing: a2.id, carrier: cv.id })).toMatch(/decks are full \(2 wings\)/);
    expect(wingsAboard(sim, cv.id).map((w) => w.id)).toEqual([f1.id, a1.id]);
    // flying aboard costs readiness
    expect(sim.state.wings[a1.id].readiness).toBe(100 - C.air.rebase);
  });

  it('a carrier supports a battle beyond the reach of land-based aircraft; the land-based wing is grounded and says why', () => {
    const { sim, cv } = island();
    const land = wing(sim, 'a', 'a1', 'attack', 'support', 'c1');
    const sea = wing(sim, 'a', 'a1', 'attack', 'support', 'c1');
    sea.carrier = cv.id;
    fresh(sim);
    expect(wingStatus(sim, land).state).toBe('grounded');
    expect(wingStatus(sim, land).reason).toMatch(/Out of range: C1 is 4 steps from A1; the range is 3/);
    week(sim);
    const b = Object.values(sim.state.battles)[0];
    expect(b.province).toBe('c1');
    expect(b.support!.att.map((l) => l.id)).toEqual([sea.id]);
  });

  it('an empty carrier gives no air support; a carrier below 40% hull grounds its wings', () => {
    const { sim, cv } = island();
    week(sim);
    expect(Object.values(sim.state.battles)[0].support!.att).toEqual([]);
    const w = wing(sim, 'a', 'a1', 'attack', 'support', 'c1');
    w.carrier = cv.id;
    cv.ships.find((s) => s.type === 'carrier')!.hp = 30;
    fresh(sim);
    expect(wingStatus(sim, w).state).toBe('grounded');
    expect(wingStatus(sim, w).reason).toMatch(/Flight decks out of action/);
  });

  it('a carrier strikes an enemy fleet at sea from beyond its guns', () => {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const cv = fleet(sim, 'a', 'zw', ['carrier', 'screen'], 'a1');
    const target = fleet(sim, 'b', 'zm', ['cruiser', 'cruiser'], 'b1');
    for (const t of ['attack', 'recon'] as const) {
      const w = wing(sim, 'a', 'a1', t, t === 'attack' ? 'naval' : 'recon', null, 'zm');
      w.carrier = cv.id;
    }
    fresh(sim);
    const hp0 = target.ships.reduce((s, x) => s + x.hp, 0);
    week(sim);
    const after = sim.state.fleets[target.id]?.ships.reduce((s, x) => s + x.hp, 0) ?? 0;
    expect(after).toBeLessThan(hp0);
    // no surface battle: the fleets never shared a zone
    expect(sim.state.reports.filter((r) => r.sea)).toEqual([]);
    expect(sim.state.nations.a.stats.navalStrikeHits).toBeGreaterThan(0);
  });

  it('when the carrier goes down its wings fly ashore within reach, or are lost; none keeps flying from it', () => {
    const { sim, cv } = island();
    const w1 = wing(sim, 'a', 'a1', 'fighter', 'superiority');
    const w2 = wing(sim, 'a', 'a1', 'attack', 'naval');
    w1.carrier = cv.id;
    w2.carrier = cv.id;
    sim.state.provinces.a1.airfield = 2;
    // the carrier sinks (as in battle: the ship goes, then the air group is brought in line)
    cv.ships = cv.ships.filter((s) => s.type !== 'carrier');
    relocateAir(sim, cv.id);
    fresh(sim);
    for (const id of [w1.id, w2.id]) {
      const w = sim.state.wings[id];
      if (w) {
        expect(w.carrier).toBeNull();
        expect(sim.state.provinces[w.base].airfield).toBeGreaterThan(0);
      }
    }
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('splitting and merging a carrier fleet keeps each air group with its decks; a fleet with wings aboard cannot be paid off', () => {
    const sim = seaGame();
    equip(sim);
    const cv = fleet(sim, 'a', 'zw', ['carrier', 'carrier', 'screen'], 'a1');
    const ws = [0, 1, 2, 3].map(() => wing(sim, 'a', 'a1', 'fighter'));
    for (const w of ws) w.carrier = cv.id;
    fresh(sim);
    expect(checkCommand(sim, { type: 'disbandFleet', nation: 'a', fleet: cv.id })).toMatch(/Fly the air wings aboard to an airfield first/);
    const second = cv.ships.find((s) => s.type === 'carrier')!.id;
    expect(applyCommand(sim, { type: 'splitFleet', nation: 'a', fleet: cv.id, ships: [second] }).ok).toBe(true);
    const other = Object.values(sim.state.fleets).find((f) => f.id !== cv.id && f.nation === 'a')!;
    expect(wingsAboard(sim, cv.id)).toHaveLength(2);
    expect(wingsAboard(sim, other.id)).toHaveLength(2);
    expect(deckSlots(sim, other).hold).toBe(2);
    expect(applyCommand(sim, { type: 'mergeFleets', nation: 'a', fleets: [cv.id, other.id] }).ok).toBe(true);
    expect(wingsAboard(sim, cv.id)).toHaveLength(4);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('range is measured from where the carrier lies: sailing out of range grounds a fixed target, sailing back resumes it', () => {
    const sim = createGame({ scenario: 'test-longsea', seed: 5, playerNation: null });
    sim.state.armies = {};
    sim.state.fleets = {};
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['q5'] });
    const cv = fleet(sim, 'a', 'z4', ['carrier', 'screen'], 'p0');
    const w = wing(sim, 'a', 'p0', 'attack', 'interdiction', 'q5');
    w.carrier = cv.id;
    fresh(sim);
    expect(wingStatus(sim, w).state).toBe('flying');
    applyCommand(sim, { type: 'moveFleet', nation: 'a', fleet: cv.id, zone: 'z0' });
    week(sim, 4);
    expect(sim.state.fleets[cv.id].zone).toBe('z0');
    fresh(sim);
    expect(wingStatus(sim, sim.state.wings[w.id]).reason).toMatch(/Out of range: Q5 is 6 steps from the carriers of/);
    // the order is kept, not dropped: it resumes when the carrier comes back
    expect(sim.state.wings[w.id].mission).toBe('interdiction');
    expect(sim.state.wings[w.id].report!.note).toMatch(/Out of range/);
    applyCommand(sim, { type: 'moveFleet', nation: 'a', fleet: cv.id, zone: 'z4' });
    week(sim, 4);
    fresh(sim);
    expect(wingStatus(sim, sim.state.wings[w.id]).state).toBe('flying');
  });
});

describe('a prepared war across the sea: Albania on the World, 1914', () => {
  it('Albania may declare war on the Ottoman Empire it does not border; the assessment says it can only go by sea, and how little it can carry', async () => {
    await import('../src/maps/builtin');
    const sim = createGame({ scenario: 'earth', seed: 1, playerNation: null });
    expect(borders(sim, 'alb', 'ott')).toBe(false);
    const goal = goalOptions(sim, 'alb', 'ott').find((g) => g.type === 'conquest')!;
    expect(goal.provinces).toEqual(['aydn', 'karesi']);
    expect(declareWarProblem(sim, 'alb', 'ott', goal)).toBeNull();
    const r = warReach(sim, 'alb', 'ott');
    expect(r.overland).toBe(false);
    expect(r.seaZones).toBe(1);
    expect(r.liftRegiments).toBe(2);
    expect(r.usable).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/carry only 2 regiments/);
  });

  it('after building transports, the army crosses, lands, takes the beach and is supplied by sea while the fleet holds the water', async () => {
    await import('../src/maps/builtin');
    const sim = createGame({ scenario: 'earth', seed: 1, playerNation: null });
    const st = sim.state;
    const alb = st.nations.alb;
    alb.treasury = 400;
    // preparation: two more transports on the slipways of Durazzo (port level 2)
    expect(applyCommand(sim, { type: 'buildShip', nation: 'alb', province: 'durazzo', ship: 'transport' }).ok).toBe(true);
    expect(applyCommand(sim, { type: 'buildShip', nation: 'alb', province: 'durazzo', ship: 'transport' }).ok).toBe(true);
    week(sim, 10);
    const home = Object.values(st.fleets).find((f) => f.nation === 'alb')!;
    expect(home.ships.filter((s) => s.type === 'transport')).toHaveLength(3);
    const army = Object.values(st.armies).find((a) => a.nation === 'alb')!;
    expect(army.regiments.length).toBeLessThanOrEqual(6);
    // the declaration, then the crossing
    const goal = goalOptions(sim, 'alb', 'ott').find((g) => g.type === 'conquest')!;
    expect(applyCommand(sim, { type: 'declareWar', nation: 'alb', target: 'ott', goal }).ok).toBe(true);
    expect(warReach(sim, 'alb', 'ott').liftRegiments).toBe(6);
    expect(applyCommand(sim, { type: 'shipArmies', nation: 'alb', armies: [army.id], fleet: home.id, dest: 'aydn' }).ok).toBe(true);
    // at sea: in no province, out of every land phase
    expect(st.armies[army.id].embarked).toBe(home.id);
    for (let i = 0; i < 4 && st.armies[army.id]?.embarked; i++) week(sim);
    const landed = st.armies[army.id];
    expect(landed.embarked).toBeFalsy();
    expect(landed.location).toBe('aydn');
    // the fleet stays offshore; once the beach is taken it is a supply source by sea
    for (let i = 0; i < 8 && st.provinces.aydn.controller !== 'alb'; i++) week(sim);
    expect(st.provinces.aydn.controller).toBe('alb');
    expect(isBeachhead(sim, 'aydn')).toBe(true);
    expect(supplyConnected(sim, 'alb', 'aydn')).toBe(true);
    expect(checkInvariants(sim)).toEqual([]);
  });
});

describe('peace, cancellation, saves and determinism', () => {
  it('peace ends a bombing campaign: the order falls idle with a reason, and the factories recover', () => {
    const sim = seaGame();
    equip(sim);
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    sim.state.provinces.b1.factories = 3;
    const bomber = wing(sim, 'a', 'a1', 'bomber', 'bombing', 'b1');
    fresh(sim);
    const bombed = computeLedger(sim, 'b').industry;
    applyPeace(sim, w.id, 'a', 'b', { provinces: [], crowns: 0 });
    week(sim);
    expect(sim.state.wings[bomber.id].mission).toBe('idle');
    expect(sim.state.wings[bomber.id].report!.note).toMatch(/no longer held by an enemy/);
    expect(computeLedger(sim, 'b').industry).toBeGreaterThan(bombed);
  });

  it('a campaign with wings on missions, a carrier group and a convoy saves, loads and plays on exactly as before', () => {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    addArmy(sim, 'a', 'a2', { infantry: 4 });
    addArmy(sim, 'b', 'b1', { infantry: 4 });
    const cv = fleet(sim, 'a', 'zm', ['carrier', 'screen', 'cruiser'], 'a2');
    const w = wing(sim, 'a', 'a1', 'attack', 'naval');
    w.carrier = cv.id;
    wing(sim, 'a', 'a1', 'fighter', 'superiority', 'b1');
    wing(sim, 'b', 'b2', 'bomber', 'naval', null, 'zm');
    fleet(sim, 'b', 'ze', ['submarine', 'submarine'], 'b2');
    fresh(sim);
    week(sim, 3);
    const saved = serialize(sim);
    const { sim: loaded, notices } = readSave(saved);
    expect(notices).toEqual([]);
    week(sim, 6);
    week(loaded, 6);
    expect(JSON.stringify(loaded.state)).toBe(JSON.stringify(sim.state));
    expect(checkInvariants(loaded)).toEqual([]);
  });

  it('a format-5 save with wings converts: full readiness, at their airfields, missions kept, and the player is told', () => {
    const sim = seaGame();
    equip(sim);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    wing(sim, 'a', 'a1', 'fighter', 'superiority', 'b1');
    const obj = JSON.parse(serialize(sim));
    // what a format-5 save looked like: no readiness, carrier, sea target or report on a wing
    for (const x of Object.values<any>(obj.state.wings)) {
      delete x.readiness;
      delete x.carrier;
      delete x.zone;
      delete x.report;
    }
    for (const n of Object.values<any>(obj.state.nations)) for (const k of ['supportWeeks', 'airKills', 'navalStrikeHits', 'bombardWeeks', 'raidWeeks']) delete n.stats[k];
    obj.schema = 5;
    obj.state.schema = 5;
    delete obj.checksum;
    const { sim: loaded, notices } = readSave(JSON.stringify(obj));
    expect(notices.join(' ')).toMatch(/naval and air update \(save format 5\).*1 air wing keep their missions/);
    const lw = Object.values(loaded.state.wings)[0];
    expect(lw).toMatchObject({ readiness: 100, carrier: null, zone: null, mission: 'superiority', target: 'b1' });
    week(loaded, 2);
    expect(checkInvariants(loaded)).toEqual([]);
  });

  it('the same campaign and orders give the same war, week by week', () => {
    const run = () => {
      const sim = seaGame();
      equip(sim);
      declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
      fleet(sim, 'a', 'zm', ['cruiser', 'cruiser', 'screen'], 'a2');
      fleet(sim, 'b', 'zm', ['capital', 'screen'], 'b1');
      wing(sim, 'a', 'a1', 'attack', 'naval', null, 'zm');
      wing(sim, 'b', 'b2', 'fighter', 'superiority', null, 'zm');
      fresh(sim);
      week(sim, 8);
      return JSON.stringify(sim.state);
    };
    expect(run()).toBe(run());
  });
});
