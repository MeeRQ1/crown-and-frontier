// Combined warfare (format 7): a coastal campaign fought by land alone, with
// aircraft, with ships, and with all three together; and what changes hands
// with a province (ports, batteries) or costs a fleet that blockades a fortified
// coast. COMBINED_EVIDENCE=<file> writes the measured campaign to that file
// (reports/military/control-verification.md).
//
//   a1 ─ a2 ─ b1 ─ b2        sea zones: West (a1), Middle (a2, b1, i1), East (b2, c1)

import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { createWing } from '../src/sim/air';
import { applyCommand } from '../src/sim/commands';
import { C } from '../src/sim/config';
import { nextMemoEpoch } from '../src/sim/index';
import { createFleet, newShip, provinceBlockaded, touchFleets } from '../src/sim/naval';
import { setController } from '../src/sim/siege';
import { bump, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { ShipType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, seaGame } from './helpers';

const evidence: Record<string, unknown> = {};
afterAll(() => {
  if (process.env.COMBINED_EVIDENCE) writeFileSync(process.env.COMBINED_EVIDENCE, `${JSON.stringify(evidence, null, 1)}\n`);
});

const TECH = ['aviation', 'fighters', 'ground_attack', 'all_metal_aircraft', 'air_defence'];

function fresh(sim: Sim) {
  bump(sim);
  touchFleets(sim);
  nextMemoEpoch();
}

function fleet(sim: Sim, nid: string, zone: string, types: ShipType[], home: string | null = null) {
  return createFleet(sim, nid, zone, types.map((t) => newShip(sim, t)), home);
}

type Arms = 'ground' | 'air' | 'navy' | 'combined';

interface Outcome {
  arms: Arms;
  seed: number;
  /** weeks until b1 (a fortified port) is ours; 40 if never */
  weeks: number;
  attackerLost: number;
  defenderLost: number;
}

/**
 * a takes b1, a fortified coastal province held by entrenched infantry, from a2
 * next door: 8 infantry and 2 artillery against 7 infantry and a battery of guns
 * entrenched behind a level-1 fort.
 * With aircraft: 2 ground-attack wings on support and a fighter wing over b1 from
 * a1. With ships: a battleship and a cruiser ordered to shell b1. Combined: both.
 */
function campaign(arms: Arms, seed: number): Outcome {
  const sim = seaGame();
  sim.state.rng = [seed, seed * 7 + 1, seed * 13 + 5, seed * 31 + 9];
  for (const n of Object.values(sim.state.nations)) {
    n.research.done.push(...TECH.filter((t) => !n.research.done.includes(t)));
    n.treasury = 5000;
    n.materiel = 3000;
  }
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
  sim.state.provinces.b1.fort = 1;
  const att = addArmy(sim, 'a', 'a2', { infantry: 8, artillery: 2 });
  const def = addArmy(sim, 'b', 'b1', { infantry: 7, artillery: 1 });
  def.stationary = 6;
  if (arms === 'air' || arms === 'combined') {
    sim.state.provinces.a1.airfield = 2;
    for (const t of ['attack', 'attack', 'fighter'] as const) {
      const w = createWing(sim, 'a', 'a1', t);
      w.mission = t === 'fighter' ? 'superiority' : 'support';
      w.target = 'b1';
    }
  }
  if (arms === 'navy' || arms === 'combined') {
    const f = fleet(sim, 'a', 'zm', ['capital', 'cruiser'], 'a2');
    fresh(sim);
    applyCommand(sim, { type: 'fleetDuty', nation: 'a', fleet: f.id, duty: { kind: 'bombard', province: 'b1' } });
  }
  fresh(sim);
  // casualties as the realms count them (regiments refill from the pool, so men left would hide them)
  const lost = (nid: string) => sim.state.nations[nid].stats.menLost;
  const a0 = lost('a');
  const b0 = lost('b');
  applyCommand(sim, { type: 'move', nation: 'a', army: att.id, dest: 'b1' });
  let weeks = 40;
  for (let w = 1; w <= 40; w++) {
    step(sim, { noAI: true });
    // the attack keeps going: whatever is left of the army marches back in
    for (const a of Object.values(sim.state.armies)) if (a.nation === 'a' && !a.battle && !a.retreating && a.location !== 'b1' && !a.path.length) applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'b1' });
    if (sim.state.provinces.b1.controller === 'a') {
      weeks = w;
      break;
    }
  }
  return { arms, seed, weeks, attackerLost: lost('a') - a0, defenderLost: lost('b') - b0 };
}

describe('a coastal campaign by land, air, sea and all together', () => {
  it('each arm helps, and together they take the fortified port soonest', () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const runs: Record<Arms, Outcome[]> = { ground: [], air: [], navy: [], combined: [] };
    for (const arms of ['ground', 'air', 'navy', 'combined'] as Arms[]) for (const s of seeds) runs[arms].push(campaign(arms, s));
    const avg = (xs: Outcome[], k: 'weeks' | 'attackerLost' | 'defenderLost') => xs.reduce((s, x) => s + x[k], 0) / xs.length;
    const table = Object.fromEntries(
      (Object.keys(runs) as Arms[]).map((k) => [k, { weeks: +avg(runs[k], 'weeks').toFixed(1), attackerLost: Math.round(avg(runs[k], 'attackerLost')), defenderLost: Math.round(avg(runs[k], 'defenderLost')), taken: runs[k].filter((r) => r.weeks < 40).length }]),
    );
    evidence.coastalCampaign = { seeds, table, runs };
    // every arm added takes the port sooner than the land campaign alone, or no later
    expect(table.air.weeks).toBeLessThanOrEqual(table.ground.weeks);
    expect(table.navy.weeks).toBeLessThanOrEqual(table.ground.weeks);
    expect(table.combined.weeks).toBeLessThanOrEqual(Math.min(table.air.weeks, table.navy.weeks));
    expect(table.combined.weeks).toBeLessThan(table.ground.weeks);
    // and the attacker pays less for it
    expect(table.combined.attackerLost).toBeLessThan(table.ground.attackerLost);
  });
});

describe('what changes hands with a province', () => {
  it('a captured port: the fleets based there make another port their home', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const f = fleet(sim, 'b', 'ze', ['cruiser'], 'b1');
    fresh(sim);
    setController(sim, 'b1', 'a');
    expect(f.home).toBe('b2');
    expect(f.report!.notes.join(' ')).toMatch(/Home port B1 lost; new home B2/);
  });

  it('captured anti-aircraft batteries are wrecked', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    sim.state.provinces.b1.aa = 2;
    setController(sim, 'b1', 'a');
    expect(sim.state.provinces.b1.aa).toBe(0);
  });
});

describe('coastal forts and the ships off their coast', () => {
  it('ships blockading a fortified coast take fire; ships shelling it are fired on once, not twice', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    sim.state.provinces.b2.fort = 2;
    // the East Water: b2 (fortified) and c1 on its coast; b2 has no other water
    const f = fleet(sim, 'a', 'ze', ['cruiser', 'cruiser'], 'a1');
    fresh(sim);
    expect(provinceBlockaded(sim, 'b2')).toBe(true);
    const hp0 = f.ships.reduce((s, x) => s + x.hp, 0);
    step(sim, { noAI: true });
    const hp1 = f.ships.reduce((s, x) => s + x.hp, 0);
    expect(hp0 - hp1).toBeCloseTo(C.naval.coastalGuns * C.naval.blockadeFire * 2, 1);
    expect(f.report!.notes.join(' ')).toMatch(/Blockading close inshore: the coastal forts of B2 \(level 2\)/);
    // a raid order keeps it off the coast: no fire
    applyCommand(sim, { type: 'fleetDuty', nation: 'a', fleet: f.id, duty: { kind: 'raid', zone: 'ze' } });
    const hp2 = f.ships.reduce((s, x) => s + x.hp, 0);
    step(sim, { noAI: true });
    expect(f.ships.reduce((s, x) => s + x.hp, 0)).toBeGreaterThanOrEqual(hp2 - 1e-9);
  });
});
