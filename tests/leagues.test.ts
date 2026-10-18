// Voluntary offensive leagues (format 9): allies who explicitly agreed to join each
// other's deliberate wars.
//
//   grid: columns 0–1 realm a (the player), 2–4 realm b, 5–6 realm c

import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { addMemory, removeTreaty, signTreaty } from '../src/sim/diplomacy';
import { checkInvariants } from '../src/sim/invariants';
import { leagueOf, leaguePreview, monthlyLeagues, proposeLeague } from '../src/sim/leagues';
import { readSave, serialize } from '../src/sim/save';
import type { Sim } from '../src/sim/state';
import { gridGame } from './helpers';

/** a and b allied and friendly (eligible); b warlike enough to accept */
function friends(): Sim {
  const sim = gridGame();
  signTreaty(sim, 'alliance', 'a', 'b');
  addMemory(sim, 'a', 'b', 'event', 40, 0);
  addMemory(sim, 'b', 'a', 'event', 40, 0);
  sim.state.nations.b.ai.personality = 'expansionist';
  return sim;
}

const conquest = (sim: Sim, by: string, target: string) => {
  const pid = sim.world.provIds.find((p) => sim.state.provinces[p].owner === target)!;
  return applyCommand(sim, { type: 'declareWar', nation: by, target, goal: { type: 'conquest', provinces: [pid] } });
};

describe('offensive leagues', () => {
  it('need an alliance and good relations; eligibility is not acceptance', () => {
    const sim = gridGame();
    expect(checkCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' })).toMatch(/not allied/);
    signTreaty(sim, 'alliance', 'a', 'b');
    // allies who think poorly of each other are not eligible
    addMemory(sim, 'b', 'a', 'event', -60, 0);
    expect(checkCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' })).toMatch(/opinion between/);
    // friendly allies are eligible, and a commercial realm weighs it and says no
    const fresh = gridGame();
    signTreaty(fresh, 'alliance', 'a', 'b');
    addMemory(fresh, 'a', 'b', 'event', 40, 0);
    addMemory(fresh, 'b', 'a', 'event', 40, 0);
    expect(checkCommand(fresh, { type: 'proposeLeague', nation: 'a', to: 'b' })).toBeNull();
    const r = applyCommand(fresh, { type: 'proposeLeague', nation: 'a', to: 'b' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/declines \(score -?\d+\): .*binds us to their wars/);
    expect(leagueOf(fresh, 'a')).toBeNull();
    // not asked again within a year
    expect(checkCommand(fresh, { type: 'proposeLeague', nation: 'a', to: 'b' })).toMatch(/less than a year ago/);
  });

  it('a warlike ally accepts; an AI proposal to the player waits for an explicit answer', () => {
    const sim = friends();
    const r = applyCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' });
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(leagueOf(sim, 'a')?.members.sort()).toEqual(['a', 'b']);
    // the other way: the player is asked
    const sim2 = friends();
    expect(proposeLeague(sim2, 'b', 'a').ok).toBe(true);
    expect(leagueOf(sim2, 'a')).toBeNull();
    const p = sim2.state.proposals.find((x) => x.kind === 'league' && x.to === 'a')!;
    expect(applyCommand(sim2, { type: 'respond', nation: 'a', proposal: p.id, accept: true }).ok).toBe(true);
    expect(leagueOf(sim2, 'a')?.members.sort()).toEqual(['a', 'b']);
  });

  it('a member’s deliberate war brings every bound member in at once, once; nothing more is declared', () => {
    const sim = friends();
    applyCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' });
    expect(leaguePreview(sim, 'a', 'c').joining).toEqual(['b']);
    const r = conquest(sim, 'a', 'c');
    expect(r.ok && r.message).toMatch(/B joins us/);
    const wars = Object.values(sim.state.wars);
    expect(wars).toHaveLength(1);
    expect(wars[0].attackers.sort()).toEqual(['a', 'b']);
    expect(leagueOf(sim, 'a')!.record.at(-1)).toMatchObject({ by: 'a', target: 'c', joined: ['b'], refused: [] });
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('a member the ordinary rules forbid to join says why, and nothing else happens', () => {
    const sim = friends();
    applyCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' });
    signTreaty(sim, 'nap', 'b', 'c');
    expect(leaguePreview(sim, 'a', 'c').cannot).toEqual([{ nid: 'b', why: 'a non-aggression pact with C' }]);
    conquest(sim, 'a', 'c');
    const w = Object.values(sim.state.wars)[0];
    expect(w.attackers).toEqual(['a']);
    expect(leagueOf(sim, 'a')!.record.at(-1)!.refused).toEqual([{ nid: 'b', why: 'a non-aggression pact with C' }]);
    // no penalty was invented: still allied, still in the league
    expect(leagueOf(sim, 'b')).not.toBeNull();
    expect(sim.state.treaties.some((t) => t.type === 'alliance' && [t.a, t.b].sort().join() === 'a,b')).toBe(true);
  });

  it('joining never enrols a realm in a war already under way', () => {
    const sim = friends();
    conquest(sim, 'a', 'c');
    applyCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' });
    expect(leagueOf(sim, 'b')).not.toBeNull();
    expect(Object.values(sim.state.wars)[0].attackers).toEqual(['a']);
  });

  it('a broken alliance suspends and dissolves it; leaving keeps the wars joined and waits two years', () => {
    const sim = friends();
    applyCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' });
    removeTreaty(sim, 'alliance', 'a', 'b');
    monthlyLeagues(sim);
    expect(leagueOf(sim, 'a')).toBeNull();
    const sim2 = friends();
    applyCommand(sim2, { type: 'proposeLeague', nation: 'a', to: 'b' });
    conquest(sim2, 'a', 'c');
    const r = applyCommand(sim2, { type: 'leaveLeague', nation: 'a' });
    expect(r.ok && r.message).toMatch(/the wars we joined go on/);
    expect(Object.values(sim2.state.wars)[0].attackers.sort()).toEqual(['a', 'b']);
    expect(checkCommand(sim2, { type: 'proposeLeague', nation: 'a', to: 'b' })).toMatch(/left a league recently/);
  });

  it('a league survives a save', () => {
    const sim = friends();
    applyCommand(sim, { type: 'proposeLeague', nation: 'a', to: 'b' });
    const back = readSave(serialize(sim)).sim;
    expect(leagueOf(back, 'b')?.members.sort()).toEqual(['a', 'b']);
  });
});
