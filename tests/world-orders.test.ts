import { readFileSync } from 'node:fs';
import { touchArmies } from '../src/sim/index';
import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { forecastBattle } from '../src/sim/combat';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { findPath, moveCost, STRAIT_COST } from '../src/sim/movement';
import { deserialize, serialize } from '../src/sim/save';
import { bump, ownedProvinces } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { edgeKey, getWorld, validateScenario } from '../src/sim/world';
import { addArmy, lineGame } from './helpers';

function reachable(world: ReturnType<typeof getWorld>, from: string, within?: Set<string>): Set<string> {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const c = q.pop()!;
    for (const n of world.prov[c].neighbors) if (!seen.has(n) && (!within || within.has(n))) (seen.add(n), q.push(n));
  }
  return seen;
}

describe('Aldmere, the standard map', () => {
  const w = getWorld('aldmere');

  it('is valid, about three times the Reach, and fully connected (islands by strait)', () => {
    expect(validateScenario(w.scenario)).toEqual([]);
    expect(w.provIds.length).toBeGreaterThanOrEqual(280);
    expect(w.provIds.length).toBeLessThanOrEqual(320);
    expect(w.nationIds.length).toBe(14);
    expect(reachable(w, w.provIds[0]).size).toBe(w.provIds.length);
    // every strait links provinces that are listed as neighbours both ways
    for (const [a, b] of w.scenario.straits) expect(w.prov[a].neighbors).toContain(b);
  });

  it('every river is a crossable border, and passes are fortified mountain provinces', () => {
    const rivers = w.scenario.rivers ?? [];
    expect(rivers.length).toBeGreaterThan(40);
    for (const [a, b] of rivers) expect(w.prov[a].neighbors).toContain(b);
    for (const id of ['northgate', 'kestrel', 'southgap', 'glenardach', 'frostgate', 'irongate']) {
      expect(w.prov[id].terrain).toBe('mountains');
      expect(w.prov[id].fort).toBeGreaterThanOrEqual(1);
    }
  });

  it('every realm holds a connected homeland around its capital and has somewhere to grow', () => {
    const sim = createGame({ scenario: 'aldmere', seed: 3, playerNation: null });
    for (const nid of w.nationIds) {
      const mine = new Set(ownedProvinces(sim, nid));
      const cap = w.nationDefs[nid].capital;
      const home = reachable(w, cap, mine);
      // straits count as links: island holdings are part of the homeland
      expect(home.size, `${nid} homeland`).toBe(mine.size);
      const borders = new Set<string>();
      for (const p of mine) for (const n of w.prov[p].neighbors) if (!mine.has(n)) borders.add(sim.state.provinces[n].owner ?? 'frontier');
      expect(borders.size, `${nid} neighbours`).toBeGreaterThanOrEqual(2);
    }
  });

  it("Hrafnmark's longships cross straits at no extra cost", () => {
    const sim = createGame({ scenario: 'aldmere', seed: 3, playerNation: null });
    const [a, b] = w.scenario.straits.find(([x, y]) => sim.state.provinces[x].owner === 'hra' || sim.state.provinces[y].owner === 'hra')!;
    expect(moveCost(sim, a, b, 'hra')).toBeCloseTo(moveCost(sim, a, b, 'dre') - STRAIT_COST, 6);
    expect(moveCost(sim, a, b, 'dre')).toBeCloseTo(moveCost(sim, a, b) , 6);
  });

  it('AI realms play five years on Aldmere without breaking the world', () => {
    const sim = createGame({ scenario: 'aldmere', seed: 11, playerNation: null, campaignYears: 60 });
    for (let i = 0; i < 5 * 48; i++) step(sim);
    expect(checkInvariants(sim)).toEqual([]);
    expect(Object.values(sim.state.nations).filter((n) => n.alive).length).toBeGreaterThanOrEqual(12);
  }, 60_000);
});

describe('saves keep their map', () => {
  it('a Reach save written by the previous release loads on the Reach and plays on', () => {
    const text = readFileSync(new URL('./fixtures/reach-save-main-c29aea6.json', import.meta.url), 'utf8');
    const sim = deserialize(text);
    expect(sim.state.scenarioId).toBe('reach');
    expect(sim.world.provIds.length).toBe(99);
    expect(sim.world.prov.aurelon.name).toBe('Aurelon');
    for (let i = 0; i < 48; i++) step(sim);
    expect(checkInvariants(sim)).toEqual([]);
    // and it saves again in the current format
    expect(deserialize(serialize(sim)).state.tick).toBe(sim.state.tick);
  });

  it('an Aldmere save round-trips on Aldmere', () => {
    const sim = createGame({ scenario: 'aldmere', seed: 4, playerNation: 'les' });
    for (let i = 0; i < 12; i++) step(sim);
    const back = deserialize(serialize(sim));
    expect(back.state.scenarioId).toBe('aldmere');
    expect(back.world.provIds.length).toBe(sim.world.provIds.length);
  });
});

describe('rivers', () => {
  it('attackers who cross a river to open a battle fight at a disadvantage', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const def = addArmy(sim, 'b', 'b3', { foot: 4 });
    const att = addArmy(sim, 'a', 'a3', { foot: 6 });
    const f = forecastBattle(sim, 'b3', [att], [def]);
    expect(f.factors.some((x) => /river/i.test(x))).toBe(true);
    // the same fight from the far side of b3 (not across the river) has no river factor
    sim.state.armies[att.id].location = 'b1';
    touchArmies(sim); // direct edit: refresh derived lookups
    expect(forecastBattle(sim, 'b3', [att], [def]).factors.some((x) => /river/i.test(x))).toBe(false);
    sim.state.armies[att.id].location = 'a3';
    touchArmies(sim); // direct edit: refresh derived lookups
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: att.id, dest: 'b3' }).ok).toBe(true);
    for (let i = 0; i < 4 && !Object.keys(sim.state.battles).length; i++) step(sim, { noAI: true });
    const b = Object.values(sim.state.battles)[0];
    expect(b).toBeDefined();
    expect(b.river).toBe(true);
    expect(sim.world.riverSet.has(edgeKey('a3', 'b3'))).toBe(true);
  });
});

describe('army groups and standing orders', () => {
  it('groups are numbered 1 to 9 and survive a split', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a1', { foot: 4 });
    expect(checkCommand(sim, { type: 'setGroup', nation: 'a', army: a.id, group: 12 })).toMatch(/1 to 9/);
    expect(applyCommand(sim, { type: 'setGroup', nation: 'a', army: a.id, group: 2 }).ok).toBe(true);
    expect(applyCommand(sim, { type: 'split', nation: 'a', army: a.id, counts: { foot: 2 } }).ok).toBe(true);
    const groups = Object.values(sim.state.armies).filter((x) => x.nation === 'a').map((x) => x.group);
    expect(groups).toEqual([2, 2]);
    expect(checkCommand(sim, { type: 'setGroup', nation: 'b', army: a.id, group: 1 })).toMatch(/Not your army/);
  });

  it('a stationed army marches back whenever it is idle elsewhere, and a new march cancels the order', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a2', { foot: 2 });
    expect(checkCommand(sim, { type: 'setOrder', nation: 'a', army: a.id, order: { kind: 'station', province: 'b1' } })).toMatch(/control/);
    expect(applyCommand(sim, { type: 'setOrder', nation: 'a', army: a.id, order: { kind: 'station', province: 'a1' } }).ok).toBe(true);
    for (let i = 0; i < 4; i++) step(sim, { noAI: true });
    expect(a.location).toBe('a1');
    // pushed away (as after a retreat), it returns on its own
    a.location = 'a3';
    touchArmies(sim); // direct edit: refresh derived lookups
    a.path = [];
    for (let i = 0; i < 8; i++) step(sim, { noAI: true });
    expect(a.location).toBe('a1');
    expect(a.order?.province).toBe('a1');
    // a manual march elsewhere replaces the standing order
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'a2' }).ok).toBe(true);
    expect(a.order).toBeNull();
  });

  it('a station lost to the enemy cancels the order with a notice', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a1', { foot: 2 });
    applyCommand(sim, { type: 'setOrder', nation: 'a', army: a.id, order: { kind: 'station', province: 'a3' } });
    declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a3'] });
    sim.state.provinces.a3.controller = 'b';
    bump(sim); // direct edit: refresh derived lookups
    step(sim, { noAI: true });
    expect(a.order).toBeNull();
    expect(sim.state.notifications.some((n) => n.nation === 'a' && /no longer stationed/.test(n.text))).toBe(true);
  });

  it('waypoints extend the current route instead of replacing it', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a1', { foot: 1 });
    applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'a2' });
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'a3', append: true }).ok).toBe(true);
    expect(a.path).toEqual(['a2', 'a3']);
    expect(findPath(sim, 'a', 'a1', 'a3')?.path).toEqual(['a2', 'a3']);
  });
});

describe('AI on several fronts', () => {
  it('finds one front per enemy, placed toward that enemy’s armies and weighted by their strength', async () => {
    const { frontPosts } = await import('../src/sim/ai/operational');
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    declareWar(sim, 'c', 'b', { type: 'conquest', provinces: ['b2'] });
    addArmy(sim, 'a', 'a3', { foot: 6 });
    addArmy(sim, 'c', 'c1', { foot: 2 });
    const posts = frontPosts(sim, 'b');
    expect(posts.map((p) => [p.enemy, p.post])).toEqual([
      ['a', 'b3'],
      ['c', 'b2'],
    ]);
    expect(posts[0].threat).toBeGreaterThan(posts[1].threat);
  });
});
