import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { signTreaty } from '../src/sim/diplomacy';
import { findPath, moveCost } from '../src/sim/movement';
import { step } from '../src/sim/tick';
import { declareWar, endWar } from '../src/sim/war';
import { getWorld } from '../src/sim/world';
import { addArmy, lineGame } from './helpers';

describe('movement', () => {
  it('cannot path through a neutral realm', () => {
    const sim = lineGame();
    expect(findPath(sim, 'a', 'a2', 'b1')).toBeNull();
    expect(checkCommand(sim, { type: 'move', nation: 'a', army: addArmy(sim, 'a', 'a2', { infantry: 1 }).id, dest: 'b1' })).toMatch(/access/);
    // unclaimed wilds are open
    expect(findPath(sim, 'a', 'a2', 'm1')?.path).toEqual(['m1']);
  });

  it('war and alliances grant access; paths are contiguous and costed', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const r = findPath(sim, 'a', 'a1', 'b1')!;
    expect(r).not.toBeNull();
    let from = 'a1';
    let cost = 0;
    for (const p of r.path) {
      expect(sim.world.prov[from].neighbors).toContain(p);
      cost += moveCost(sim, from, p);
      from = p;
    }
    expect(r.cost).toBeCloseTo(cost, 6);
    // alliance with c opens c's land
    expect(findPath(sim, 'a', 'a1', 'c1')).toBeNull();
    signTreaty(sim, 'alliance', 'a', 'c');
    expect(findPath(sim, 'a', 'a1', 'c1')).not.toBeNull();
  });

  it('terrain, roads and straits change movement cost', () => {
    const sim = lineGame();
    expect(moveCost(sim, 'a1', 'a2')).toBe(2);
    expect(moveCost(sim, 'a2', 'm1')).toBe(5);
    expect(moveCost(sim, 'a1', 'c2')).toBe(4); // plains + strait
    sim.state.provinces.a1.infra = 2;
    sim.state.provinces.a2.infra = 2;
    expect(moveCost(sim, 'a1', 'a2')).toBeCloseTo(2 * (1 - 0.24), 6);
  });

  it('foot crossing plains takes two weeks; the route is shown before arrival', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a1', { infantry: 1 });
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'a2' }).ok).toBe(true);
    step(sim, { noAI: true });
    expect(a.location).toBe('a1');
    step(sim, { noAI: true });
    expect(a.location).toBe('a2');
    expect(a.path).toEqual([]);
  });

  it('an army halts when peace closes its route', () => {
    const sim = lineGame();
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const a = addArmy(sim, 'a', 'a2', { infantry: 1 });
    applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'b3' });
    endWar(sim, w.id, 'test');
    for (let i = 0; i < 6; i++) step(sim, { noAI: true });
    expect(a.path).toEqual([]);
    expect(['a2', 'a3']).toContain(a.location);
    expect(sim.state.notifications.some((n) => n.kind === 'move' && /halted/.test(n.text))).toBe(true);
  });

  it('hostile armies crossing on the same edge always meet', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const x = addArmy(sim, 'a', 'a3', { infantry: 3 });
    const y = addArmy(sim, 'b', 'b3', { infantry: 3 });
    applyCommand(sim, { type: 'move', nation: 'a', army: x.id, dest: 'b3' });
    applyCommand(sim, { type: 'move', nation: 'b', army: y.id, dest: 'a3' });
    for (let i = 0; i < 4 && !Object.keys(sim.state.battles).length; i++) step(sim, { noAI: true });
    expect(Object.keys(sim.state.battles).length).toBe(1);
    expect(x.location).toBe(y.location);
  });

  it('the Greyspine can only be crossed through its three passes', () => {
    const w = getWorld('reach');
    const west = new Set(['caldris', 'lakeholm', 'harrowgate', 'tolland', 'corvo', 'belcrest', 'ironcrag', 'sedge', 'pellin', 'mirewick']);
    const passes = new Set(['northgate', 'kestrel', 'southgap']);
    for (const p of west) for (const nb of w.prov[p].neighbors) {
      const east = ['garrow', 'hask', 'dunmore', 'beyla', 'wexley', 'tarnwood', 'emberlin', 'rookhill'];
      if (east.includes(nb)) throw new Error(`${p}-${nb} bypasses the passes`);
    }
    expect([...passes].every((p) => w.prov[p])).toBe(true);
  });
});
