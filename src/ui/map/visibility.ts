// Which forces the map shows: one rule for army, fleet and air markers, the
// province card's list, the selection and the counts under the mode switch.
// It changes presentation only: combat, targeting, diplomacy and the
// simulation never read it. Everything shown is public information (there is
// no fog of war), so "All" is always the whole picture.
//
//   All             every realm's forces
//   Mine + enemies  ours, and every force of a realm we are at war with now
//   Relevant        ours and the forces in our wars: enemies, and (setting
//                   "Allies in Relevant", on by default) realms allied to us by
//                   treaty or fighting on our side. With an army, fleet, wing or
//                   operation selected, enemy and allied forces are limited to
//                   those within three marches (two sea zones) of it, its route
//                   or its operation's area. Neutral realms never appear.
// The selected unit is always shown. The same set is shown at every zoom:
// at a distance markers are grouped by place and realm, never dropped.

import type { Sim } from '../../sim/state';
import { atWar, isFriendly } from '../../sim/state';
import type { NationId, ProvinceId, ZoneId } from '../../sim/types';

export type UnitView = 'all' | 'relevant' | 'mine';
export type Relation = 'own' | 'enemy' | 'allied' | 'neutral';

export const VIEW_LABELS: Record<UnitView, string> = { all: 'All', relevant: 'Relevant', mine: 'Mine + enemies' };
export const VIEW_HELP: Record<UnitView, string> = {
  all: 'Every realm’s armies, fleets and air wings.',
  relevant: 'Ours and the forces in our wars. With a force or operation selected, only enemy and allied forces near it. Neutral realms are hidden.',
  mine: 'Ours and every force of a realm we are at war with, anywhere. Allies and neutral realms are hidden.',
};

/** The places a selection is about: forces outside them drop out of "Relevant". */
export interface Focus {
  label: string;
  provinces: Set<ProvinceId>;
  zones: Set<ZoneId>;
}

/** Where a force is: a province (army, wing at an airfield) or a sea zone (fleet, wing aboard). */
export interface Place {
  prov?: ProvinceId | null;
  zone?: ZoneId | null;
}

export interface UnitFilter {
  mode: UnitView;
  me: NationId | null;
  relation(nid: NationId): Relation;
  /** whether a force of this realm at this place is shown */
  shows(nid: NationId, at: Place): boolean;
  /** what the current mode shows, in words (for the count line and the province card) */
  context: string;
}

export function relationOf(sim: Sim, me: NationId | null, nid: NationId): Relation {
  if (!me) return 'neutral';
  if (nid === me) return 'own';
  if (atWar(sim, me, nid)) return 'enemy';
  if (isFriendly(sim, me, nid)) return 'allied';
  return 'neutral';
}

export function unitFilter(sim: Sim, me: NationId | null, mode: UnitView, opts: { allies: boolean; focus: Focus | null }): UnitFilter {
  const rel = new Map<NationId, Relation>();
  const relation = (nid: NationId): Relation => {
    let r = rel.get(nid);
    if (!r) rel.set(nid, (r = relationOf(sim, me, nid)));
    return r;
  };
  const focus = mode === 'relevant' ? opts.focus : null;
  const inFocus = (at: Place) => !focus || (!!at.prov && focus.provinces.has(at.prov)) || (!!at.zone && focus.zones.has(at.zone));
  const shows = (nid: NationId, at: Place): boolean => {
    if (mode === 'all' || !me) return true;
    const r = relation(nid);
    if (r === 'own') return true;
    if (mode === 'mine') return r === 'enemy';
    if (r === 'neutral') return false;
    if (r === 'allied' && !opts.allies) return false;
    return inFocus(at);
  };
  const atPeace = !!me && !Object.values(sim.state.wars).some((w) => w.attackers.includes(me) || w.defenders.includes(me));
  let context: string;
  if (mode === 'all' || !me) context = 'Every realm’s forces.';
  else if (mode === 'mine') context = atPeace ? 'Our forces (we are at war with no one).' : 'Our forces and every enemy force.';
  else if (focus) context = `Our forces, and enemy${opts.allies ? ' and allied' : ''} forces near ${focus.label}.`;
  else context = atPeace ? `Our forces${opts.allies ? ' and our allies’' : ''} (at peace; select a force to focus).` : `Our forces and the forces in our wars${opts.allies ? ' (allies included)' : ''}.`;
  return { mode, me, relation, shows, context };
}

/** Provinces within `hops` marches of any anchor (the hop table: no access rules, as a reach estimate). */
export function provincesNear(sim: Sim, anchors: Iterable<ProvinceId>, hops: number): Set<ProvinceId> {
  const out = new Set<ProvinceId>();
  const ids = sim.world.provIds;
  for (const a of anchors) {
    const row = sim.world.hopRow(a);
    if (!row) continue;
    for (let i = 0; i < ids.length; i++) if (row[i] <= hops) out.add(ids[i]);
  }
  return out;
}

/** Sea zones within `steps` of any anchor zone, and the zones off the given coasts. */
export function zonesNear(sim: Sim, anchors: Iterable<ZoneId>, steps: number, coasts: Iterable<ProvinceId> = []): Set<ZoneId> {
  const out = new Set<ZoneId>();
  let frontier = [...anchors].filter((z) => sim.world.zones[z]);
  for (const p of coasts) for (const z of sim.world.provZones[p] ?? []) if (!out.has(z)) frontier.push(z);
  for (const z of frontier) out.add(z);
  for (let i = 0; i < steps; i++) {
    const next: ZoneId[] = [];
    for (const z of frontier) for (const n of sim.world.zones[z].neighbors) if (!out.has(n)) (out.add(n), next.push(n));
    frontier = next;
  }
  return out;
}

/** Forces by relation: how many there are, and how many the filter hides (for the count line). */
export interface ViewCounts {
  shown: Record<Relation, number>;
  hidden: Record<Relation, number>;
}

export function viewCounts(sim: Sim, f: UnitFilter, selected: Set<string> = new Set()): ViewCounts {
  const zero = (): Record<Relation, number> => ({ own: 0, enemy: 0, allied: 0, neutral: 0 });
  const out: ViewCounts = { shown: zero(), hidden: zero() };
  const st = sim.state;
  const add = (id: string, nid: NationId, at: Place) => {
    const r = f.relation(nid);
    if (selected.has(id) || f.shows(nid, at)) out.shown[r]++;
    else out.hidden[r]++;
  };
  for (const a of Object.values(st.armies)) if (!a.embarked) add(a.id, a.nation, { prov: a.location });
  for (const fl of Object.values(st.fleets)) add(fl.id, fl.nation, { zone: fl.zone });
  for (const w of Object.values(st.wings)) {
    const c = w.carrier ? st.fleets[w.carrier] : undefined;
    add(w.id, w.nation, c ? { zone: c.zone } : { prov: w.base });
  }
  return out;
}
