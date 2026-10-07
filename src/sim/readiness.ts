// Explanations for armies, computed from the same rules the simulation applies:
// why an order is or is not progressing, and what the army's composition, the
// ground it stands on, its supply and its condition mean for a fight. Everything
// here is information the game already shows every player (there is no fog of
// war); AI plans and intentions are never included.

import { interdiction } from './air';
import { C, TERRAIN } from './config';
import { entrenchBonus } from './combat';
import { isShort } from './economy';
import { maxMorale } from './military';
import { canEnter, etaWeeks, hostilePinned, stepClosed } from './movement';
import { atWar, enemiesOf, provName, type Sim } from './state';
import { armySupplyInfo } from './supply';
import type { Army } from './types';

export type OrderState = 'at sea' | 'battle' | 'retreating' | 'pinned' | 'blocked' | 'moving' | 'stationed' | 'besieging' | 'holding';

export interface OrderStatus {
  state: OrderState;
  /** one line for the inspector header and the roster */
  text: string;
  /** why it is not progressing as ordered, or what slows it (empty when nothing does) */
  reasons: string[];
  /** weeks to the destination when moving */
  eta?: number;
}

/** What the army is doing about its order this week, and why. */
export function orderStatus(sim: Sim, a: Army): OrderStatus {
  const st = sim.state;
  const here = provName(sim, a.location);
  if (a.embarked) {
    const f = st.fleets[a.embarked];
    return { state: 'at sea', text: f?.landing ? `At sea aboard ${f.name}, bound for ${provName(sim, f.landing)}` : `At sea aboard ${f?.name ?? 'a fleet'}`, reasons: ['Embarked armies take orders again once they land.'] };
  }
  if (a.battle) return { state: 'battle', text: `In battle at ${here}`, reasons: ['An army in battle cannot move until the battle ends.'] };
  if (a.retreating) return { state: 'retreating', text: `Retreating to ${provName(sim, a.path[0])}`, reasons: ['A retreating army takes no orders until it reaches safety.'] };
  if (a.path.length) {
    const dest = a.path[a.path.length - 1];
    const reasons: string[] = [];
    if (hostilePinned(sim, a)) {
      return { state: 'pinned', text: `Pinned at ${here}, ordered to ${provName(sim, dest)}`, reasons: [`Enemy troops stand in ${here}: an army cannot march out of a province that holds a hostile army. Win the battle or wait for them to leave.`] };
    }
    const next = a.path[0];
    if (!canEnter(sim, a.nation, next)) reasons.push(`No access to ${provName(sim, next)} any more: the route will be re-planned next week, or the march halted if none is left.`);
    else if (stepClosed(sim, a.nation, a.location, next)) reasons.push(`The strait to ${provName(sim, next)} is closed by enemy ships: the route will be re-planned next week.`);
    const slow = interdiction(sim, a.location, a.nation).move;
    if (slow > 0.005) reasons.push(`Enemy aircraft slow the march by ${Math.round(slow * 100)}%.`);
    const eta = etaWeeks(sim, a, a.path, a.progress);
    if (reasons.length && reasons[0].startsWith('No access')) return { state: 'blocked', text: `Route to ${provName(sim, dest)} blocked`, reasons, eta };
    return { state: 'moving', text: `Marching to ${provName(sim, dest)} · ${eta} week${eta === 1 ? '' : 's'}`, reasons, eta };
  }
  if (st.provinces[a.location].siege?.nation === a.nation) return { state: 'besieging', text: `Besieging ${here}`, reasons: [] };
  if (a.order?.kind === 'station') {
    const at = a.order.province;
    return { state: 'stationed', text: at === a.location ? `Stationed at ${here}` : `Stationed at ${provName(sim, at)}`, reasons: at === a.location ? [] : [`Returning to its station at ${provName(sim, at)} after the last march.`] };
  }
  return { state: 'holding', text: `Holding ${here}`, reasons: [] };
}

export interface ReadinessNote {
  /** good, neutral, or a weakness */
  tone: 'good' | 'neutral' | 'bad';
  text: string;
}

/**
 * The trade-offs of this army where it stands: frontage and reserves, the
 * terrain's effect on cavalry and armour, guns without a screen or shells,
 * armour without oil, entrenchment, supply and condition.
 */
export function readiness(sim: Sim, a: Army): ReadinessNote[] {
  const out: ReadinessNote[] = [];
  const terr = TERRAIN[sim.world.prov[a.location].terrain];
  const count = (pred: (t: string) => boolean) => a.regiments.filter((r) => pred(r.type)).length;
  // line regiments hold the frontage; artillery and engineers support from behind
  const line = count((t) => t === 'infantry' || t === 'cavalry' || t === 'armour');
  const support = a.regiments.length - line;
  const cav = count((t) => t === 'cavalry');
  const armour = count((t) => t === 'armour');
  const guns = count((t) => t === 'artillery');
  const engineers = count((t) => t === 'engineers');
  const atWarNow = enemiesOf(sim, a.nation).length > 0;
  // frontage
  if (line > terr.frontage) out.push({ tone: 'neutral', text: `${terr.label} allows ${terr.frontage} line regiments in battle: ${line - terr.frontage} of ${line} would wait in reserve (they replace losses).` });
  else out.push({ tone: 'neutral', text: `${terr.label}: frontage ${terr.frontage}, so all ${line} line regiment${line === 1 ? '' : 's'} can fight; defenders here get +${Math.round(terr.defense * 100)}%.` });
  // supporting arms need a screen
  if (support > Math.ceil(terr.frontage / 2)) out.push({ tone: 'bad', text: `Only ${Math.ceil(terr.frontage / 2)} supporting regiments (artillery, engineers) can fire here; ${support - Math.ceil(terr.frontage / 2)} would stand idle.` });
  if (support > line) out.push({ tone: 'bad', text: `More guns and sappers (${support}) than line regiments (${line}) to screen them: the unscreened fire at half strength.` });
  // terrain and arms
  if (cav) {
    const share = cav / Math.max(1, line);
    if (terr.cav > 0 && share >= C.combat.flankCavalryShare) out.push({ tone: 'good', text: `Cavalry (${Math.round(share * 100)}% of the line) can flank on open ${terr.label.toLowerCase()}: +${Math.round(C.combat.flankBonus * 100)}% fire.` });
    if (terr.cav !== 0) out.push({ tone: terr.cav > 0 ? 'good' : 'bad', text: `Cavalry ${terr.cav > 0 ? 'favoured' : 'hampered'} by ${terr.label.toLowerCase()}: ${terr.cav > 0 ? '+' : ''}${Math.round(terr.cav * 100)}%.` });
  }
  if (armour) {
    if (terr.armour !== 0) out.push({ tone: terr.armour > 0 ? 'good' : 'bad', text: `Armour ${terr.armour > 0 ? 'favoured' : 'hampered'} by ${terr.label.toLowerCase()}: ${terr.armour > 0 ? '+' : ''}${Math.round(terr.armour * 100)}%.` });
    if (isShort(sim, a.nation, 'oil')) out.push({ tone: 'bad', text: `The realm is short of oil: armour fights at ${Math.round(C.combat.unfuelled * 100)}%.` });
  }
  if (guns && atWarNow && isShort(sim, a.nation, 'nitrates')) out.push({ tone: 'bad', text: 'The realm is short of nitrates: the guns lack shells (−40% fire).' });
  // digging in
  const ent = entrenchBonus(sim, a.nation, a.stationary, engineers > 0);
  if (!a.path.length) {
    if (ent > 0) out.push({ tone: 'good', text: `Dug in after ${a.stationary} weeks here: defenders +${Math.round(ent * 100)}%${engineers ? ' (engineers dig twice as fast)' : ''}.` });
    else out.push({ tone: 'neutral', text: `Digs in if it holds: +${Math.round(C.army.entrenchBonus[0] * 100)}% after ${Math.ceil(C.army.entrenchWeeks[0] / (engineers ? C.army.engineerEntrench : 1))} weeks${engineers ? ' (engineers dig twice as fast)' : ''}.` });
  }
  // supply and condition
  const sup = armySupplyInfo(sim, a);
  if (sup.status === 'strained') out.push({ tone: 'bad', text: 'Supply strained: no reinforcement, half morale recovery, −10% in battle.' });
  if (sup.status === 'unsupplied') out.push({ tone: 'bad', text: 'Unsupplied: 2% attrition a week, falling morale, −25% in battle.' });
  const mm = maxMorale(sim, a.nation);
  if (a.morale < mm * 0.5) out.push({ tone: 'bad', text: `Morale ${a.morale.toFixed(1)} of ${mm.toFixed(1)}: an army breaks at 25%; it recovers while resting in supply.` });
  const under = a.regiments.filter((r) => r.men < C.regimentSize * 0.75).length;
  if (under) out.push({ tone: 'bad', text: `${under} regiment${under === 1 ? '' : 's'} below three-quarters strength; reinforcement needs men, materiel and supply.` });
  if (atWarNow && !a.path.length && !a.battle) {
    const threats = sim.world.prov[a.location].neighbors.filter((n) => Object.values(sim.state.armies).some((x) => x.location === n && atWar(sim, a.nation, x.nation)));
    if (threats.length) out.push({ tone: 'neutral', text: `Enemy armies next door: ${threats.map((n) => provName(sim, n)).join(', ')}.` });
  }
  return out;
}
