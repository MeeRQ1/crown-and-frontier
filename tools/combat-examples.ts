// Prints the worked combat examples used in DESIGN.md, computed by the real
// combat code (deterministic forecast: unlucky / even / lucky rolls).
//   npx tsx tools/combat-examples.ts

import { forecastBattle } from '../src/sim/combat';
import { createGame } from '../src/sim/game';
import { createArmy, newRegiment } from '../src/sim/military';
import type { Sim } from '../src/sim/state';
import type { UnitType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { lineScenario } from '../tests/helpers';

void lineScenario;

function army(sim: Sim, nid: string, pid: string, units: Partial<Record<UnitType, number>>) {
  const regs = [];
  for (const t of ['foot', 'horse', 'guns'] as UnitType[]) for (let i = 0; i < (units[t] ?? 0); i++) regs.push(newRegiment(sim, t));
  return createArmy(sim, nid, pid, regs);
}

function fresh(): Sim {
  const sim = createGame({ scenario: 'test-line', seed: 1, playerNation: null });
  sim.state.armies = {};
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  return sim;
}

function show(title: string, f: ReturnType<typeof forecastBattle>) {
  console.log(`\n### ${title}`);
  console.log(`Verdict: ${f.verdict} (unlucky/even/lucky: ${f.outcomes.map((o) => (o === 'attacker' ? 'attacker wins' : 'defender holds')).join(' / ')})`);
  console.log(`Men: ${f.attMen} vs ${f.defMen}; expected losses (even rolls): attacker ${f.attLoss}, defender ${f.defLoss}; ~${f.rounds} week(s)`);
  if (f.factors.length) console.log(`Factors: ${f.factors.join('; ')}`);
}

// 1. comparable armies on plains
{
  const sim = fresh();
  const a = army(sim, 'a', 'b1', { foot: 6, horse: 2 });
  const d = army(sim, 'b', 'b1', { foot: 6, horse: 2 });
  show('1. Comparable armies on plains (6 foot + 2 horse each)', forecastBattle(sim, 'b1', [a], [d]));
}
// 2. smaller supplied, entrenched defender in mountains with a fort
{
  const sim = fresh();
  Object.assign(sim.state.provinces.m1, { owner: 'b', controller: 'b', integration: 100, fort: 1 });
  const a = army(sim, 'a', 'm1', { foot: 9 });
  const d = army(sim, 'b', 'm1', { foot: 5 });
  d.stationary = 6;
  show('2. 5 entrenched foot in fortified mountains vs 9 foot', forecastBattle(sim, 'm1', [a], [d]));
  const sim2 = fresh();
  const a2 = army(sim2, 'a', 'b1', { foot: 9 });
  const d2 = army(sim2, 'b', 'b1', { foot: 5 });
  show('2b. The same armies on open plains', forecastBattle(sim2, 'b1', [a2], [d2]));
}
// 3. larger unsupplied attacker
{
  const sim = fresh();
  const a = army(sim, 'a', 'b1', { foot: 8 });
  const d = army(sim, 'b', 'b1', { foot: 6 });
  d.stationary = 3;
  a.supply = 1;
  show('3a. 8 supplied foot attack 6 dug-in foot on plains', forecastBattle(sim, 'b1', [a], [d]));
  a.supply = 0.2;
  show('3b. The same attack, attackers unsupplied (20% supply)', forecastBattle(sim, 'b1', [a], [d]));
}
