// Worked examples for the navy and the air arm (Stage C), computed by the real
// code on the small sea scenario of the tests (realms a, b and an island realm
// c; zones West, Middle and East Water). Printed by tools/combat-examples.ts
// and checked by tests/worked-sea-air.test.ts; DESIGN.md quotes them.

import { createWing } from '../src/sim/air';
import { applyCommand } from '../src/sim/commands';
import { forecastBattle, type Forecast } from '../src/sim/combat';
import { provinceCrowns } from '../src/sim/economy';
import { nextMemoEpoch } from '../src/sim/index';
import { createFleet, newShip, provinceBlockaded, touchFleets, tradeOpen } from '../src/sim/naval';
import { bump, type Sim } from '../src/sim/state';
import type { AirMission, ShipType, WingType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, seaGame } from '../tests/helpers';

function fresh(sim: Sim) {
  bump(sim);
  touchFleets(sim);
  nextMemoEpoch();
}

function fleet(sim: Sim, nid: string, zone: string, types: ShipType[], home: string | null = null) {
  return createFleet(sim, nid, zone, types.map((t) => newShip(sim, t)), home);
}

function wing(sim: Sim, nid: string, base: string, type: WingType, mission: AirMission, target: string) {
  sim.state.provinces[base].airfield = Math.max(1, sim.state.provinces[base].airfield);
  const w = createWing(sim, nid, base, type);
  w.mission = mission;
  w.target = target;
  return w;
}

export interface Example {
  title: string;
  forecast?: Forecast;
  values?: Record<string, number | string | boolean>;
}

/** A landing on b's coast against the same attack made overland, and with Amphibious Warfare. */
export function invasionExamples(): Example[] {
  const out: Example[] = [];
  const setup = (amphibious: boolean) => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    if (amphibious) sim.state.nations.a.research.done.push('naval_bases', 'amphibious_warfare');
    const tr = fleet(sim, 'a', 'zm', ['transport', 'transport', 'transport', 'cruiser'], 'a2');
    const army = addArmy(sim, 'a', 'a2', { infantry: 5 });
    const def = addArmy(sim, 'b', 'b1', { infantry: 4 });
    def.stationary = 3;
    fresh(sim);
    return { sim, tr, army, def };
  };
  {
    const { sim, army, def } = setup(false);
    out.push({ title: 'Overland: 5 infantry from a2 attack 4 dug-in infantry in b1 (plains)', forecast: forecastBattle(sim, 'b1', [army], [def], 'a2') });
  }
  {
    const { sim, tr, army, def } = setup(false);
    const ok = applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tr.id, dest: 'b1' }).ok;
    out.push({ title: 'By sea: the same 5 infantry land on b1 from the Middle Water', forecast: forecastBattle(sim, 'b1', [sim.state.armies[army.id]], [def]), values: { shipped: ok } });
  }
  {
    const { sim, tr, army, def } = setup(true);
    applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tr.id, dest: 'b1' });
    out.push({ title: 'By sea with Amphibious Warfare (half the landing penalty)', forecast: forecastBattle(sim, 'b1', [sim.state.armies[army.id]], [def]) });
  }
  return out;
}

/** b's eastern port b2 sits on the East Water only; a's cruisers there blockade it. */
export function blockadeExamples(): Example[] {
  const out: Example[] = [];
  const base = () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    fresh(sim);
    return sim;
  };
  const measure = (sim: Sim) => ({
    blockaded: provinceBlockaded(sim, 'b2'),
    crowns: Math.round(provinceCrowns(sim, 'b2') * 100) / 100,
    tradeWithIsland: Math.round(tradeOpen(sim, 'b', 'c') * 1000) / 1000,
    tradeWithNeighbour: tradeOpen(sim, 'b', 'a'),
  });
  {
    const sim = base();
    out.push({ title: 'Peace on the East Water', values: measure(sim) });
  }
  {
    const sim = base();
    fleet(sim, 'a', 'ze', ['cruiser', 'cruiser']);
    fresh(sim);
    out.push({ title: 'Two of a’s cruisers in the East Water, no b warships', values: measure(sim) });
  }
  {
    const sim = base();
    fleet(sim, 'a', 'ze', ['cruiser', 'cruiser']);
    fleet(sim, 'b', 'ze', ['cruiser']);
    fresh(sim);
    out.push({ title: 'The same, with one b cruiser in the zone (2 × 1 cruiser ≥ 2 cruisers: no blockade)', values: measure(sim) });
  }
  {
    const sim = base();
    sim.state.nations.a.research.done.push('submarines');
    fleet(sim, 'a', 'ze', ['submarine', 'submarine']);
    fresh(sim);
    out.push({ title: 'Two of a’s submarines in the East Water (they count half, enough against no defenders)', values: measure(sim) });
  }
  return out;
}

/** 6 infantry attack 6 infantry in b1; a's attack wings support it; then b's fighters take the sky. */
export function airExamples(): Example[] {
  const out: Example[] = [];
  const sim = seaGame();
  for (const n of ['a', 'b']) sim.state.nations[n].research.done.push('aviation', 'fighters', 'ground_attack');
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
  const att = addArmy(sim, 'a', 'a2', { infantry: 6 });
  const def = addArmy(sim, 'b', 'b1', { infantry: 6 });
  def.stationary = 2;
  fresh(sim);
  out.push({ title: 'No aircraft: 6 infantry from a2 attack 6 infantry in b1', forecast: forecastBattle(sim, 'b1', [att], [def], 'a2') });
  wing(sim, 'a', 'a1', 'attack', 'support', 'b1');
  wing(sim, 'a', 'a1', 'attack', 'support', 'b1');
  fresh(sim);
  out.push({ title: 'Two of a’s ground-attack wings support the attack', forecast: forecastBattle(sim, 'b1', [att], [def], 'a2') });
  for (let i = 0; i < 3; i++) wing(sim, 'b', 'b2', 'fighter', 'superiority', 'b1');
  fresh(sim);
  out.push({ title: 'Three of b’s fighter wings hold the sky over b1 (a’s support falls to 40%)', forecast: forecastBattle(sim, 'b1', [att], [def], 'a2') });
  for (let i = 0; i < 3; i++) wing(sim, 'a', 'a1', 'fighter', 'superiority', 'b1');
  fresh(sim);
  out.push({ title: 'a answers with three fighter wings of its own (the sky is contested again)', forecast: forecastBattle(sim, 'b1', [att], [def], 'a2') });
  return out;
}

export function describeExample(e: Example): string[] {
  const lines = [`### ${e.title}`];
  const f = e.forecast;
  if (f) {
    lines.push(`Verdict: ${f.verdict} (unlucky/even/lucky: ${f.outcomes.map((o) => (o === 'attacker' ? 'attacker wins' : 'defender holds')).join(' / ')})`);
    lines.push(`Men: ${f.attMen} vs ${f.defMen}; expected losses (even rolls): attacker ${f.attLoss}, defender ${f.defLoss}; ~${f.rounds} week(s)`);
    if (f.factors.length) lines.push(`Factors: ${f.factors.join('; ')}`);
  }
  if (e.values) lines.push(Object.entries(e.values).map(([k, v]) => `${k}: ${v}`).join('; '));
  return lines;
}
