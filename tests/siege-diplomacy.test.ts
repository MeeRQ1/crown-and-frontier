import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { evaluateTreaty, monthlyDiplomacy, opinionParts, signTreaty } from '../src/sim/diplomacy';
import { checkInvariants } from '../src/sim/invariants';
import { siegeInfo } from '../src/sim/siege';
import { atWar, hasTreaty, months, truceUntil } from '../src/sim/state';
import { runTicks, step } from '../src/sim/tick';
import { applyPeace, declareWar, evaluatePeace, joinWar, returnStrandedArmies, transferProvince } from '../src/sim/war';
import { addArmy, lineGame } from './helpers';

describe('sieges and occupation', () => {
  it('an unfortified province falls in two weeks; a fort needs enough regiments', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    sim.state.provinces.b1.fort = 1;
    addArmy(sim, 'a', 'b1', { foot: 1 });
    expect(siegeInfo(sim, 'b1')!.weeklyRate).toBe(0);
    expect(siegeInfo(sim, 'b1')!.notes.join(' ')).toMatch(/Needs 2 regiments/);
    addArmy(sim, 'a', 'b1', { foot: 1 });
    expect(siegeInfo(sim, 'b1')!.weeklyRate).toBeCloseTo(10, 6);
    addArmy(sim, 'a', 'b3', { foot: 1 });
    step(sim, { noAI: true });
    step(sim, { noAI: true });
    expect(sim.state.provinces.b3.controller).toBe('a');
    expect(sim.state.provinces.b1.controller).toBe('b');
  });

  it('owners retake their own land twice as fast', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    sim.state.provinces.b1.fort = 1;
    sim.state.provinces.b1.controller = 'a';
    addArmy(sim, 'b', 'b1', { foot: 2 });
    expect(siegeInfo(sim, 'b1')!.liberation).toBe(true);
    expect(siegeInfo(sim, 'b1')!.weeklyRate).toBeCloseTo(20, 6);
  });
});

describe('diplomacy and wars', () => {
  it('a pact forbids war until it expires', () => {
    const sim = lineGame();
    signTreaty(sim, 'nap', 'a', 'b');
    expect(checkCommand(sim, { type: 'declareWar', nation: 'a', target: 'b', goal: { type: 'conquest', provinces: ['b3'] } })).toMatch(/non-aggression/);
    sim.state.tick = months(60);
    monthlyDiplomacy(sim);
    expect(hasTreaty(sim, 'nap', 'a', 'b')).toBe(false);
    expect(checkCommand(sim, { type: 'declareWar', nation: 'a', target: 'b', goal: { type: 'conquest', provinces: ['b3'] } })).toBeNull();
  });

  it('defensive allies are called; conflicting commitments are respected', () => {
    const sim = lineGame();
    signTreaty(sim, 'alliance', 'b', 'c');
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    expect(w.defenders).toContain('c');
    const sim2 = lineGame();
    signTreaty(sim2, 'alliance', 'b', 'c');
    signTreaty(sim2, 'alliance', 'a', 'c');
    const w2 = declareWar(sim2, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    expect(w2.defenders).not.toContain('c');
    expect(checkInvariants(sim2)).toEqual([]);
  });

  it('an alliance cannot be signed with the ally of an enemy', () => {
    const sim = lineGame();
    signTreaty(sim, 'alliance', 'b', 'c');
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    // c joined b's war; now c is our enemy: no alliance possible
    expect(checkCommand(sim, { type: 'propose', nation: 'a', target: 'c', treaty: 'alliance' })).toBeTruthy();
  });

  it('separate peace removes one participant and leaves a truce', () => {
    const sim = lineGame();
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    joinWar(sim, w, 'c', 'defender');
    applyPeace(sim, w.id, 'c', 'a', { mode: 'white', provinces: [], gold: 0 });
    expect(sim.state.wars[w.id].defenders).toEqual(['b']);
    expect(atWar(sim, 'a', 'c')).toBe(false);
    expect(truceUntil(sim, 'a', 'c')).toBeGreaterThan(sim.state.tick);
    expect(checkCommand(sim, { type: 'declareWar', nation: 'a', target: 'c', goal: { type: 'conquest', provinces: ['c2'] } })).toMatch(/Truce/);
  });

  it('a secondary defender is not held to the war goal, but allies left fighting resent a separate peace', () => {
    const sim = lineGame();
    signTreaty(sim, 'alliance', 'b', 'c');
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    expect(w.defenders).toContain('c');
    const labels = (from: string) => evaluatePeace(sim, w.id, from, 'a', { mode: 'white', provinces: [], gold: 0 }).reasons.map((r) => r.label);
    expect(labels('b')).toContain('Our war goals are unmet');
    expect(labels('c')).not.toContain('Our war goals are unmet');
    applyPeace(sim, w.id, 'c', 'a', { mode: 'white', provinces: [], gold: 0 });
    const resent = opinionParts(sim, 'b', 'c').find((p) => /separate peace/.test(p.label));
    expect(resent?.value).toBeLessThan(0);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('an army with no legal route home returns under safe conduct', () => {
    const sim = lineGame();
    const army = addArmy(sim, 'a', 'c1', { foot: 2 });
    returnStrandedArmies(sim);
    expect(sim.state.provinces[sim.state.armies[army.id].location].owner).toBe('a');
    expect(sim.state.notifications.some((n) => n.nation === 'a' && /safe conduct/.test(n.text))).toBe(true);
    // an army in a friend's land that can still march home stays put
    const sim2 = lineGame();
    signTreaty(sim2, 'alliance', 'a', 'b');
    const guest = addArmy(sim2, 'a', 'b1', { foot: 2 });
    returnStrandedArmies(sim2);
    expect(sim2.state.armies[guest.id].location).toBe('b1');
  });

  it('peace transfers ceded land at low integration and ends the war', () => {
    const sim = lineGame();
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    sim.state.provinces.b3.controller = 'a';
    applyPeace(sim, w.id, 'a', 'b', { mode: 'demand', provinces: ['b3'], gold: 0 });
    expect(sim.state.provinces.b3.owner).toBe('a');
    expect(sim.state.provinces.b3.integration).toBe(10);
    expect(sim.state.provinces.b3.claims).toContain('b');
    expect(sim.state.wars[w.id]).toBeUndefined();
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('eliminated realms leave no dangling treaties or wars', () => {
    const sim = lineGame();
    signTreaty(sim, 'trade', 'b', 'c');
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    addArmy(sim, 'b', 'b2', { foot: 2 });
    for (const p of ['b1', 'b2', 'b3']) transferProvince(sim, p, 'a');
    expect(sim.state.nations.b.alive).toBe(false);
    expect(sim.state.wars[w.id]).toBeUndefined();
    expect(sim.state.treaties.some((t) => t.a === 'b' || t.b === 'b')).toBe(false);
    expect(Object.values(sim.state.armies).some((a) => a.nation === 'b')).toBe(false);
    expect(checkInvariants(sim)).toEqual([]);
    runTicks(sim, 8, { noAI: true });
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('acceptance is an explained sum of visible factors', () => {
    const sim = lineGame();
    const ev = evaluateTreaty(sim, 'a', 'b', 'trade');
    const sum = ev.reasons.reduce((s, r) => s + r.value, 0);
    expect(Math.abs(sum - ev.score)).toBeLessThan(1e-9);
    expect(ev.accept).toBe(ev.score >= 0);
    const r = applyCommand(sim, { type: 'propose', nation: 'a', target: 'b', treaty: 'trade' });
    if (!r.ok) expect(r.reason).toMatch(/declines \(score/);
  });
});
