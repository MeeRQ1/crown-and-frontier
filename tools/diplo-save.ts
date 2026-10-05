// A prepared campaign for the Stage E browser checks and screenshots, built
// with the real simulation code (tools/verify-web.ts, tools/shots-stage-e.ts).

import { addMemory, signTreaty } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import type { Demand } from '../src/sim/types';
import { computeWarScore, declareWar, joinWar } from '../src/sim/war';

/**
 * A Reach campaign as Aurel, ten years in:
 *  - Aurel leads a war on Vostmark with Calder as its ally, and is winning: Aurel
 *    holds Vostburg and Harnfeld, Calder holds Rethel, and Vostmark is exhausted;
 *  - Istrel has attacked Aurel, holds Elmsgate and has proposed a settlement;
 *  - the Serene League trades with Aurel and thinks well of it (a trade bloc partner);
 *  - the Tarsk treasury is in debt (a loan it will take), and the Fenward Compact
 *    is small (a guarantee).
 */
export function diploSave(): { text: string; ids: Record<string, string> } {
  const sim = createGame({ scenario: 'reach', seed: 7, playerNation: 'aur' });
  const st = sim.state;
  st.tick = 10 * 48;
  st.nations.aur.treasury = 900;
  // the war we are winning, with an ally
  const w1 = declareWar(sim, 'aur', 'vos', { type: 'conquest', provinces: ['vostburg', 'harnfeld'] });
  if (!w1.attackers.includes('cal')) joinWar(sim, w1, 'cal', 'attacker');
  for (const [pid, by] of [
    ['vostburg', 'aur'],
    ['harnfeld', 'aur'],
    ['rethel', 'cal'],
  ] as const)
    st.provinces[pid].controller = by;
  for (const a of Object.values(st.armies)) if (['vostburg', 'harnfeld', 'rethel'].includes(a.location)) delete st.armies[a.id];
  w1.contrib = { aur: 4, cal: 6 };
  w1.battleScore = 25;
  w1.goalScore = 10;
  st.nations.vos.warExhaustion = 70;
  // the war we are losing: Istrel holds Elmsgate and offers terms
  const w2 = declareWar(sim, 'ist', 'aur', { type: 'conquest', provinces: ['elmsgate'] });
  st.provinces.elmsgate.controller = 'ist';
  for (const a of Object.values(st.armies)) if (a.location === 'elmsgate') delete st.armies[a.id];
  w2.battleScore = 20;
  const demands: Demand[] = [
    { kind: 'cede', from: 'aur', to: 'ist', province: 'elmsgate' },
    { kind: 'gold', from: 'aur', to: 'ist', amount: 150 },
  ];
  st.counters.proposal++;
  st.proposals.push({ id: `pr${st.counters.proposal}`, kind: 'settlement', from: 'ist', to: 'aur', tick: st.tick, expires: st.tick + 4, war: w2.id, demands });
  // partners
  signTreaty(sim, 'trade', 'aur', 'ser');
  addMemory(sim, 'ser', 'aur', 'envoy', 60, 0);
  st.nations.tar.treasury = -60;
  for (const w of Object.values(st.wars)) w.score = computeWarScore(sim, w).total;
  return { text: serialize(sim), ids: { winWar: w1.id, loseWar: w2.id, ally: 'cal', enemy: 'vos', attacker: 'ist', partner: 'ser', borrower: 'tar', protege: 'fen' } };
}
