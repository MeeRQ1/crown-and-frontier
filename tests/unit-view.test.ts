// The unit-view modes (ui/map/visibility.ts): what "All", "Mine + enemies" and
// "Relevant" show of armies, fleets and air wings, for our own forces, enemies,
// allies and neutral realms, and how the set follows war, peace and alliances.
//
//   a1 ─ a2 ─ a3 ─ b3 ─ b1 ─ b2 ─ c1 ─ c2 ─ a1      a: us; b: enemy; c: neutral, later allied

import { describe, expect, it } from 'vitest';
import { createWing } from '../src/sim/air';
import { signTreaty } from '../src/sim/diplomacy';
import { createFleet, newShip } from '../src/sim/naval';
import type { Sim } from '../src/sim/state';
import { declareWar, endWar } from '../src/sim/war';
import { provincesNear, unitFilter, viewCounts, type Focus, type UnitView } from '../src/ui/map/visibility';
import { addArmy, lineGame, seaGame } from './helpers';

function shown(sim: Sim, mode: UnitView, opts: { allies?: boolean; focus?: Focus | null } = {}) {
  const f = unitFilter(sim, 'a', mode, { allies: opts.allies ?? true, focus: opts.focus ?? null });
  const st = sim.state;
  return {
    armies: Object.values(st.armies).filter((a) => f.shows(a.nation, { prov: a.location })).map((a) => a.nation).sort(),
    fleets: Object.values(st.fleets).filter((x) => f.shows(x.nation, { zone: x.zone })).map((x) => x.nation).sort(),
    wings: Object.values(st.wings).filter((w) => f.shows(w.nation, { prov: w.base })).map((w) => w.nation).sort(),
    counts: viewCounts(sim, f),
  };
}

function setup(): Sim {
  const sim = lineGame({ playerNation: 'a' });
  addArmy(sim, 'a', 'a2', { infantry: 2 });
  addArmy(sim, 'b', 'b1', { infantry: 2 });
  addArmy(sim, 'b', 'b2', { infantry: 1 });
  addArmy(sim, 'c', 'c1', { infantry: 2 });
  for (const n of ['a', 'b', 'c']) sim.state.nations[n].research.done.push('aviation', 'fighters');
  createWing(sim, 'a', 'a1', 'fighter');
  createWing(sim, 'b', 'b2', 'fighter');
  createWing(sim, 'c', 'c2', 'fighter');
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  return sim;
}

describe('unit-view modes', () => {
  it('"Mine + enemies" shows ours and every enemy force, however far, and no neutral', () => {
    const sim = setup();
    const v = shown(sim, 'mine');
    expect(v.armies).toEqual(['a', 'b', 'b']);
    expect(v.wings).toEqual(['a', 'b']);
    expect(v.counts.hidden.neutral).toBe(2);
    expect(v.counts.shown.enemy).toBe(3);
  });

  it('"Relevant" never pulls a neutral realm in, wherever its forces stand', () => {
    const sim = setup();
    // c's army stands next to our war: still neutral, still hidden
    sim.state.armies[Object.values(sim.state.armies).find((a) => a.nation === 'c')!.id].location = 'b2';
    const v = shown(sim, 'relevant');
    expect(v.armies).toEqual(['a', 'b', 'b']);
    expect(v.wings).toEqual(['a', 'b']);
  });

  it('allies appear in "Relevant" by the setting, and never in "Mine + enemies"', () => {
    const sim = setup();
    signTreaty(sim, 'alliance', 'a', 'c');
    expect(shown(sim, 'relevant').armies).toEqual(['a', 'b', 'b', 'c']);
    expect(shown(sim, 'relevant', { allies: false }).armies).toEqual(['a', 'b', 'b']);
    expect(shown(sim, 'mine').armies).toEqual(['a', 'b', 'b']);
    expect(shown(sim, 'all').armies).toEqual(['a', 'b', 'b', 'c']);
  });

  it('with a selection, "Relevant" keeps the enemy forces near it; "Mine + enemies" keeps them all', () => {
    const sim = setup();
    // an enemy army far off, beyond c's land
    addArmy(sim, 'b', 'c2', { infantry: 1 });
    const focus: Focus = { label: 'our army at a3', provinces: provincesNear(sim, ['a3'], 2), zones: new Set() };
    expect(focus.provinces.has('b1')).toBe(true);
    expect(focus.provinces.has('b2')).toBe(false);
    expect(focus.provinces.has('c2')).toBe(false);
    // b's army at b1 is near; the ones at b2 and c2 are not
    const rel = shown(sim, 'relevant', { focus });
    expect(rel.armies.filter((n) => n === 'b')).toHaveLength(1);
    expect(rel.counts.hidden.enemy).toBeGreaterThanOrEqual(2);
    expect(shown(sim, 'mine', { focus }).armies.filter((n) => n === 'b')).toHaveLength(3);
  });

  it('peace takes a former enemy out of "Mine + enemies"; "All" is unchanged', () => {
    const sim = setup();
    expect(shown(sim, 'mine').armies).toContain('b');
    endWar(sim, Object.keys(sim.state.wars)[0], 'test');
    expect(shown(sim, 'mine').armies).toEqual(['a']);
    expect(shown(sim, 'all').armies).toEqual(['a', 'b', 'b', 'c']);
  });

  it('fleets follow the same rule as armies', () => {
    const sim = seaGame({ playerNation: 'a' });
    createFleet(sim, 'a', 'zw', [newShip(sim, 'cruiser')], 'a1');
    createFleet(sim, 'b', 'ze', [newShip(sim, 'cruiser')], 'b2');
    createFleet(sim, 'c', 'ze', [newShip(sim, 'cruiser')], 'c1');
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    expect(shown(sim, 'mine').fleets).toEqual(['a', 'b']);
    expect(shown(sim, 'relevant').fleets).toEqual(['a', 'b']);
    expect(shown(sim, 'all').fleets).toEqual(['a', 'b', 'c']);
  });

  it('without a realm (observer), every mode shows everything', () => {
    const sim = setup();
    for (const m of ['all', 'relevant', 'mine'] as UnitView[]) expect(unitFilter(sim, null, m, { allies: true, focus: null }).shows('c', { prov: 'c1' })).toBe(true);
  });
});
