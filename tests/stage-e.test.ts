// Stage E: national focus trees, peace settlements with several parties,
// guarantees, influence and spheres, loans and trade blocs.

import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { C } from '../src/sim/config';
import { validateFocuses } from '../src/sim/content';
import { GENERIC_FOCUSES, NATIONAL_NAMES } from '../src/sim/data/focus';
import { addMemory, opinion, signTreaty } from '../src/sim/diplomacy';
import { computeLedger } from '../src/sim/economy';
import { applyReward, focusTree, GENERIC_BY_ID, getFocus, nationalFocuses } from '../src/sim/focus';
import { createGame } from '../src/sim/game';
import { addInfluence, blocOf, blocSolidarity, influenceOver, makeLoan, monthlyInfluence, sphereOf } from '../src/sim/influence';
import { checkInvariants } from '../src/sim/invariants';
import { BUILTIN_MAPS } from '../src/maps/builtin';
import { applySettlement, buildSettlement, contributionShares, counterOffer, demandCost, evaluateSettlement, settlementCost } from '../src/sim/settlement';
import { months } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { influenceByPartner } from '../src/sim/victory';
import { declareWar, goalOptions } from '../src/sim/war';
import { addArmy, lineGame } from './helpers';
import type { Demand } from '../src/sim/types';

/** a and c at war with b (a leads); a and c each hold one of b's provinces. */
function twoAgainstOne() {
  const sim = lineGame();
  const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  w.attackers.push('c');
  sim.state.provinces.b3.controller = 'a';
  sim.state.provinces.b2.controller = 'c';
  w.contrib = { a: 3, c: 9 };
  w.score = 60;
  sim.state.nations.b.warExhaustion = 40;
  return { sim, w };
}

describe('national focus', () => {
  it('every realm on every built-in map has a valid tree with its own national branch', () => {
    for (const id of BUILTIN_MAPS) {
      const sim = createGame({ scenario: id, playerNation: null });
      for (const nid of sim.world.nationIds) {
        const tree = focusTree(sim, nid);
        expect(validateFocuses(tree), `${id}/${nid}`).toEqual([]);
        const national = nationalFocuses(sim.world, nid);
        expect(national.length, `${id}/${nid}`).toBeGreaterThanOrEqual(5);
        expect(national.map((d) => d.template)).toEqual(expect.arrayContaining(['heritage', 'develop', 'resource', 'sea', 'ambition']));
      }
    }
  });

  it('the hand-made maps use their own names; claims point at real neighbouring regions', () => {
    const sim = createGame({ scenario: 'baltic', playerNation: null });
    const ger = nationalFocuses(sim.world, 'ger');
    expect(ger.find((d) => d.template === 'sea')!.name).toBe(NATIONAL_NAMES.baltic.ger.sea![0]);
    expect(ger.find((d) => d.template === 'resource')!.effects).toEqual({ coalOutput: 0.3 });
    const dan = nationalFocuses(sim.world, 'dan').filter((d) => d.template === 'claim');
    expect(dan.length).toBeGreaterThan(0);
    for (const d of dan) for (const p of d.provinces!) expect(sim.state.provinces[p].owner).not.toBe('dan');
    // two claim focuses exclude each other
    const swe = nationalFocuses(sim.world, 'swe').filter((d) => d.template === 'claim');
    if (swe.length === 2) expect(swe[0].excludes).toEqual([swe[1].id]);
  });

  it('a claim focus grants claims on the region, giving a war goal', () => {
    const sim = lineGame();
    const claim = nationalFocuses(sim.world, 'a').find((d) => d.template === 'claim')!;
    expect(claim).toBeDefined();
    expect(goalOptions(sim, 'a', 'b').some((g) => g.type === 'claim')).toBe(false);
    applyReward(sim, 'a', claim);
    for (const p of sim.world.regionProvinces[claim.reward!.claimRegion!]) if (sim.state.provinces[p].owner !== 'a') expect(sim.state.provinces[p].claims).toContain('a');
    expect(goalOptions(sim, 'a', sim.state.provinces[claim.provinces![0]].owner!).some((g) => g.type === 'claim')).toBe(true);
  });

  it('Concord of Nations allows wars only over claims', () => {
    const sim = lineGame();
    expect(goalOptions(sim, 'a', 'b').some((g) => g.type === 'conquest')).toBe(true);
    sim.state.nations.a.focus.done.push('dip_service', 'dip_concord');
    expect(goalOptions(sim, 'a', 'b').some((g) => g.type === 'conquest')).toBe(false);
    expect(checkCommand(sim, { type: 'declareWar', nation: 'a', target: 'b', goal: { type: 'conquest', provinces: ['b3'] } })).toMatch(/only over claims/);
  });

  it('switching focus loses the progress, rewards land where they say', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    applyCommand(sim, { type: 'focus', nation: 'a', focus: 'ind_rail' });
    n.focus.progress = 5;
    applyCommand(sim, { type: 'focus', nation: 'a', focus: 'army_staff' });
    expect(n.focus.progress).toBe(0);
    const before = sim.state.provinces.a1.factories + sim.state.provinces.a2.factories + sim.state.provinces.a3.factories;
    applyReward(sim, 'a', GENERIC_BY_ID.ind_heavy);
    const after = sim.state.provinces.a1.factories + sim.state.provinces.a2.factories + sim.state.provinces.a3.factories;
    expect(after - before).toBe(2);
  });

  it('every generic focus is reachable: no exclusion makes a branch impossible', () => {
    expect(validateFocuses(GENERIC_FOCUSES)).toEqual([]);
    for (const d of GENERIC_FOCUSES) for (const r of d.requires) expect(d.excludes ?? []).not.toContain(r);
  });

  it('the AI chooses focuses that fit its realm', () => {
    const sim = createGame({ scenario: 'aldmere', seed: 3, playerNation: null });
    for (let i = 0; i < 48 * 4; i++) step(sim);
    const alive = Object.values(sim.state.nations).filter((n) => n.alive);
    for (const n of alive) expect(n.focus.done.length + (n.focus.current ? 1 : 0), n.id).toBeGreaterThanOrEqual(3);
    // landlocked realms never take coastal focuses
    for (const nid of ['cal', 'mor']) for (const f of sim.state.nations[nid].focus.done) expect(getFocus(sim, nid, f)?.coastal ?? false).toBe(false);
    expect(checkInvariants(sim)).toEqual([]);
  });
});

describe('peace settlements', () => {
  it('shares the spoils by contribution, the leader counting 25% more', () => {
    const { w } = twoAgainstOne();
    const s = contributionShares(w, ['a', 'c']);
    expect(s.a + s.c).toBeCloseTo(1, 9);
    // (1 + 3) * 1.25 = 5 against (1 + 9) = 10
    expect(s.a).toBeCloseTo(5 / 15, 9);
    expect(s.c).toBeCloseTo(10 / 15, 9);
  });

  it('grades demands: occupied land is cheaper, claims cheaper still', () => {
    const { sim, w } = twoAgainstOne();
    const occupied = demandCost(sim, w, { kind: 'cede', from: 'b', to: 'a', province: 'b3' });
    const free = demandCost(sim, w, { kind: 'cede', from: 'b', to: 'a', province: 'b1' });
    expect(free).toBeGreaterThan(occupied);
    sim.state.provinces.b3.claims.push('a');
    expect(demandCost(sim, w, { kind: 'cede', from: 'b', to: 'a', province: 'b3' })).toBeLessThan(occupied);
    expect(demandCost(sim, w, { kind: 'reparations', from: 'b', to: 'a', amount: 0.2 })).toBe(Math.round(0.2 * C.settlement.reparationsCost));
  });

  it('a multi-party settlement gives each winner its demands and ends the war for all', () => {
    const { sim, w } = twoAgainstOne();
    sim.state.nations.b.treasury = 300;
    const demands: Demand[] = [
      { kind: 'cede', from: 'b', to: 'a', province: 'b3' },
      { kind: 'cede', from: 'b', to: 'c', province: 'b2' },
      { kind: 'reparations', from: 'b', to: 'c', amount: 0.1 },
      { kind: 'disarm', from: 'b', to: 'a' },
      { kind: 'renounce', from: 'b', to: 'a' },
    ];
    addArmy(sim, 'b', 'b1', { infantry: 8 });
    sim.state.provinces.a1.claims.push('b');
    expect(checkCommand(sim, { type: 'settle', nation: 'a', war: w.id, demands })).toBeNull();
    applySettlement(sim, w.id, 'a', 'b', demands);
    expect(sim.state.wars[w.id]).toBeUndefined();
    expect(sim.state.provinces.b3.owner).toBe('a');
    expect(sim.state.provinces.b2.owner).toBe('c');
    expect(sim.state.reparations).toEqual([expect.objectContaining({ from: 'b', to: 'c', share: 0.1 })]);
    // disarmed: half of 8 regiments
    expect(sim.state.disarmaments[0]).toEqual(expect.objectContaining({ nation: 'b', cap: 4 }));
    expect(checkCommand(sim, { type: 'recruit', nation: 'b', province: 'b1', unit: 'infantry' })).toMatch(/Disarmed by treaty/);
    // renounced: no claims on a, no war on a for ten years
    expect(sim.state.provinces.a1.claims).not.toContain('b');
    expect(checkCommand(sim, { type: 'declareWar', nation: 'b', target: 'a', goal: { type: 'conquest', provinces: ['a3'] } })).toMatch(/Truce/);
    sim.state.tick += months(61);
    expect(checkCommand(sim, { type: 'declareWar', nation: 'b', target: 'a', goal: { type: 'conquest', provinces: ['b3'].filter(() => false).concat(['a3']) } })).toMatch(/Truce/);
    expect(sim.state.nations.c.stats.demandsWon).toBe(2);
    expect(sim.state.nations.a.stats.settlementsShared).toBe(1);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('reparations are paid from the giver’s income each month', () => {
    const { sim, w } = twoAgainstOne();
    applySettlement(sim, w.id, 'a', 'b', [{ kind: 'reparations', from: 'b', to: 'c', amount: 0.2 }]);
    sim.state.nations.b.lastMonth = computeLedger(sim, 'b');
    const payer = computeLedger(sim, 'b');
    const receiver = computeLedger(sim, 'c');
    expect(payer.expenses['Reparations']).toBeGreaterThan(0);
    expect(receiver.income['Reparations received']).toBeCloseTo(payer.expenses['Reparations'], 9);
  });

  it('an ally given less than half its share resents the leader', () => {
    const { sim, w } = twoAgainstOne();
    const before = opinion(sim, 'c', 'a');
    applySettlement(sim, w.id, 'a', 'b', [
      { kind: 'cede', from: 'b', to: 'a', province: 'b3' },
      { kind: 'cede', from: 'b', to: 'a', province: 'b2' },
    ]);
    expect(opinion(sim, 'c', 'a')).toBeLessThan(before);
  });

  it('the loser refuses greedy terms but names the part it would accept', () => {
    const { sim, w } = twoAgainstOne();
    w.score = 25;
    sim.state.nations.b.warExhaustion = 10;
    sim.state.nations.b.treasury = 500;
    const greedy: Demand[] = [
      { kind: 'cede', from: 'b', to: 'a', province: 'b3' },
      { kind: 'reparations', from: 'b', to: 'c', amount: 0.3 },
      { kind: 'gold', from: 'b', to: 'c', amount: 400 },
    ];
    expect(evaluateSettlement(sim, w.id, 'b', greedy).accept).toBe(false);
    const counter = counterOffer(sim, w.id, 'b', greedy);
    expect(counter).not.toBeNull();
    expect(counter!.length).toBeLessThan(greedy.length);
    expect(evaluateSettlement(sim, w.id, 'b', counter!).accept).toBe(true);
    expect(settlementCost(sim, w, counter!)).toBeLessThan(settlementCost(sim, w, greedy));
  });

  it('a player offered a settlement can counter by striking demands; the AI judges the counter', () => {
    const { sim, w } = twoAgainstOne();
    sim.state.nations.b.isPlayer = true;
    sim.state.settings.playerNation = 'b';
    const demands = buildSettlement(sim, w.id, 'a');
    expect(demands.length).toBeGreaterThan(0);
    const r = applyCommand(sim, { type: 'settle', nation: 'a', war: w.id, demands });
    expect(r.ok).toBe(true);
    const p = sim.state.proposals.find((x) => x.kind === 'settlement')!;
    expect(p.demands).toEqual(demands);
    expect(checkCommand(sim, { type: 'respond', nation: 'b', proposal: p.id, accept: true, drop: demands.map((_, i) => i) })).toMatch(/at least one/);
    const res = applyCommand(sim, { type: 'respond', nation: 'b', proposal: p.id, accept: true, drop: demands.length > 1 ? [0] : [] });
    expect(res.ok).toBe(true);
    // either accepted (war over) or rejected (war goes on), never half-applied
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('the AI winner builds demands for its allies by contribution', () => {
    const { sim, w } = twoAgainstOne();
    sim.state.nations.b.treasury = 400;
    const d = buildSettlement(sim, w.id, 'a');
    expect(d.some((x) => x.to === 'c')).toBe(true);
    expect(d.every((x) => x.from === 'b' && (x.to === 'a' || x.to === 'c'))).toBe(true);
    expect(checkCommand(sim, { type: 'settle', nation: 'a', war: w.id, demands: d })).toBeNull();
  });
});

describe('guarantees, influence, loans and trade blocs', () => {
  it('a guarantor is called to arms when the guaranteed realm is attacked', () => {
    const sim = lineGame();
    sim.state.provinces.a1.dev = 8;
    expect(applyCommand(sim, { type: 'guarantee', nation: 'a', target: 'c' }).ok).toBe(true);
    expect(opinion(sim, 'c', 'a')).toBeGreaterThan(0);
    const w = declareWar(sim, 'b', 'c', { type: 'conquest', provinces: ['c1'] });
    expect(w.defenders).toContain('a');
    expect(sim.state.nations.a.stats.guaranteeCalls).toBe(1);
  });

  it('a player guarantor who declines loses the guarantee and trust', () => {
    const sim = lineGame({ playerNation: 'a' });
    applyCommand(sim, { type: 'guarantee', nation: 'a', target: 'c' });
    const trust = sim.state.nations.a.trust;
    declareWar(sim, 'b', 'c', { type: 'conquest', provinces: ['c1'] });
    const p = sim.state.proposals.find((x) => x.kind === 'callToArms' && x.to === 'a')!;
    expect(p).toBeDefined();
    applyCommand(sim, { type: 'respond', nation: 'a', proposal: p.id, accept: false });
    expect(sim.state.guarantees).toEqual([]);
    expect(sim.state.nations.a.trust).toBe(trust - C.guarantee.trustLoss);
  });

  it('envoys build influence; a larger realm with enough draws a smaller one into its sphere', () => {
    const sim = lineGame();
    for (const p of ['a1', 'a2', 'a3']) sim.state.provinces[p].dev = 8;
    sim.state.envoys.push({ from: 'a', to: 'c', until: sim.state.tick + months(120) });
    for (let m = 0; m < 40 && !sphereOf(sim, 'c'); m++) {
      monthlyInfluence(sim);
      sim.state.rev++;
    }
    expect(influenceOver(sim, 'a', 'c')).toBeGreaterThanOrEqual(C.influence.sphere);
    expect(sphereOf(sim, 'c')).toBe('a');
    // a sphere member thinks better of its patron and is defended by it
    expect(opinion(sim, 'c', 'a')).toBeGreaterThanOrEqual(C.influence.sphereOpinion - 10);
    const w = declareWar(sim, 'b', 'c', { type: 'conquest', provinces: ['c1'] });
    expect(w.defenders).toContain('a');
  });

  it('a rival’s influence keeps a realm out of any sphere', () => {
    const sim = lineGame();
    for (const p of ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']) sim.state.provinces[p].dev = 8;
    addInfluence(sim, 'a', 'c', 50);
    addInfluence(sim, 'b', 'c', 45);
    expect(sphereOf(sim, 'c')).toBeNull();
    addInfluence(sim, 'b', 'c', -30);
    sim.state.rev++;
    expect(sphereOf(sim, 'c')).toBe('a');
  });

  it('a loan moves crowns, is repaid with interest through the ledger, and war repudiates it', () => {
    const sim = lineGame();
    sim.state.nations.a.treasury = 500;
    const t0 = sim.state.nations.c.treasury;
    makeLoan(sim, 'a', 'c', 200);
    expect(sim.state.nations.c.treasury).toBe(t0 + 200);
    expect(influenceOver(sim, 'a', 'c')).toBeGreaterThan(0);
    const l = sim.state.loans[0];
    expect(l.remaining).toBeCloseTo(200 * (1 + C.loan.interest), 6);
    expect(computeLedger(sim, 'c').expenses['Loan repayments']).toBeCloseTo(l.monthly, 6);
    expect(computeLedger(sim, 'a').income['Loans repaid to us']).toBeCloseTo(l.monthly, 6);
    for (let i = 0; i < 4; i++) step(sim, { noAI: true });
    expect(sim.state.loans[0].remaining).toBeCloseTo(200 * (1 + C.loan.interest) - l.monthly, 6);
    declareWar(sim, 'c', 'a', { type: 'conquest', provinces: ['a1'] });
    expect(sim.state.loans).toEqual([]);
  });

  it('a trade bloc is founded with a partner; members buy cheaper and share blockade losses', () => {
    const sim = lineGame();
    signTreaty(sim, 'trade', 'a', 'b');
    addMemory(sim, 'b', 'a', 'envoy', 60, 0);
    sim.state.nations.a.treasury = 500;
    expect(checkCommand(sim, { type: 'foundBloc', nation: 'a', target: 'c' })).toMatch(/trade agreement/);
    const r = applyCommand(sim, { type: 'foundBloc', nation: 'a', target: 'b' });
    expect(r.ok).toBe(true);
    const b = blocOf(sim, 'a')!;
    expect(b.members).toEqual(['a', 'b']);
    expect(blocOf(sim, 'b')).toBe(b);
    // losses: a loses 10, b nothing; with equal taxes each bears 5
    sim.state.nations.a.lastMonth.income['Provincial taxes'] = 50;
    sim.state.nations.b.lastMonth.income['Provincial taxes'] = 50;
    const share = blocSolidarity(sim, (n) => (n === 'a' ? 10 : 0));
    expect(share.get('a')).toBeCloseTo(5, 9);
    expect(share.get('b')).toBeCloseTo(-5, 9);
    // war between members: the attacker leaves, and a bloc of one dissolves
    declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a3'] });
    expect(sim.state.blocs).toEqual([]);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('diplomatic influence counts each partner once for its strongest bond', () => {
    const sim = lineGame();
    for (const p of ['a1', 'a2', 'a3']) sim.state.provinces[p].dev = 8;
    signTreaty(sim, 'alliance', 'a', 'c');
    signTreaty(sim, 'trade', 'a', 'c');
    addInfluence(sim, 'a', 'c', 80);
    applyCommand(sim, { type: 'guarantee', nation: 'a', target: 'b' });
    addMemory(sim, 'c', 'a', 'envoy', 80, 0);
    addMemory(sim, 'b', 'a', 'envoy', 80, 0);
    sim.state.tick += months(40);
    sim.state.rev++;
    const by = influenceByPartner(sim, 'a');
    // c: alliance or sphere (2, not 4) + trade 1; b: guarantee 1
    expect(by.c).toBe(3);
    expect(by.b).toBe(1);
  });
});
