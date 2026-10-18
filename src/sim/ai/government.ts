// The AI's government decisions (format 9), through the same commands and limits as
// the player's: its commanders lead its largest forces; it forms a nation when it
// qualifies and can afford it; and, rarely, it changes its form or head of government
// to suit its goal and outlook — never in the campaign's first five years (the
// scenario's governments are history), at most once a year per realm, and only when
// the change is affordable at peace. It prefers what serves its strategy, not the
// largest military bonus: commerce and diplomacy favour democracy, a defensive realm
// its crown, expansion an authoritarian state (fascism only for a conqueror with claims).

import { aiCommanders } from '../commanders';
import { claimsOn } from '../diplomacy';
import { checkFormable, formablesFor, ideologyCost, ideologyOf, ideologyProblem, leaderOf, LEADER_TRAITS, replaceLeaderCost, replaceLeaderProblem } from '../government';
import { aliveNations, dateOf, type Sim } from '../state';
import type { IdeologyId, LeaderTrait, NationId } from '../types';
import { issue } from './common';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function preferredIdeology(sim: Sim, nid: NationId): IdeologyId {
  const n = sim.state.nations[nid];
  const pers = n.ai.personality;
  const goal = n.ai.goal.victory;
  if (pers === 'commercial' || pers === 'diplomat' || goal === 'economic' || goal === 'diplomatic') return 'democracy';
  if (pers === 'defensive') return ideologyOf(sim, nid) === 'monarchy' ? 'monarchy' : 'authoritarian';
  if (pers === 'expansionist') {
    const claims = aliveNations(sim).some((o) => o !== nid && claimsOn(sim, nid, o).length > 0);
    return claims && dateOf(sim).year >= 1922 ? 'fascism' : 'authoritarian';
  }
  return ideologyOf(sim, nid);
}

function preferredTrait(sim: Sim, nid: NationId): LeaderTrait {
  const n = sim.state.nations[nid];
  const goal = n.ai.goal.victory;
  if (n.lastMonth.net < 0) return 'financier';
  if (goal === 'economic') return 'industrialist';
  if (goal === 'diplomatic') return 'diplomat';
  if (n.ai.warPlan) return 'militarist';
  return leaderOf(sim, nid).trait;
}

/** Monthly, from the strategic pass. */
export function aiGovernment(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  aiCommanders(sim, nid);
  // a nation to proclaim, when it qualifies and the treasury can spare it
  for (const id of formablesFor(sim, nid)) {
    const c = checkFormable(sim, nid, id);
    if (c.ok && n.treasury >= c.cost * 1.5) {
      issue(sim, { type: 'formNation', nation: nid, formable: id }, `Proclaimed ${id}`);
      break;
    }
  }
  // the rest once a year (in a month of its own), and never in the campaign's first five years
  if (st.tick < 5 * 52 || Math.floor(st.tick / 4) % 12 !== hash(nid) % 12) return;
  const want = preferredIdeology(sim, nid);
  if (want !== ideologyOf(sim, nid) && hash(`${nid}|${dateOf(sim).year}`) % 3 === 0 && n.treasury >= ideologyCost(sim, nid) * 2 && !ideologyProblem(sim, nid, want)) {
    issue(sim, { type: 'setIdeology', nation: nid, ideology: want }, `Changed the government to ${want}`);
    return;
  }
  const trait = preferredTrait(sim, nid);
  if (trait !== leaderOf(sim, nid).trait && LEADER_TRAITS[trait] && n.treasury >= replaceLeaderCost(sim, nid) * 2 && !replaceLeaderProblem(sim, nid, trait)) {
    issue(sim, { type: 'replaceLeader', nation: nid, trait }, `Replaced the head of government (${trait})`);
  }
}
