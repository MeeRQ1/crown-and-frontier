// Air power: airfields, carriers, air wings and their missions.
//
// A wing flies from an airfield (a province project, level 1–2, two wings per
// level) or from the carriers of a fleet (two wings a carrier, three with Fleet
// Carriers; fighters, ground-attack and reconnaissance only). Range is counted in
// steps over land and sea from where it is based (reach.ts): from a carrier, from
// the zone the fleet lies in this week.
//
// Missions over land cover the target province and its neighbours (bombing: the
// target only); missions over the sea cover one zone (aboard a carrier, no zone
// means the zone the fleet is in):
// - superiority (fighters): patrols the area, intercepts every enemy wing flying
//   there and covers our own; over a zone it is the fleet's air cover;
// - support (ground attack, fighters): on call over the area; each week it joins
//   ONE of our battles there (the battle at its target first, else the largest)
//   and adds fire to that battle only;
// - interdiction (ground attack, bombers): enemy armies in the area lose supply
//   and speed;
// - bombing (bombers): an enemy-held province's factories lose output, its port
//   builds no ships and repairs at half rate, and wings on its airfield lose
//   readiness, for as long as the bombing goes on;
// - naval strike (ground attack, bombers): strikes enemy ships in the zone, if it
//   finds them (always under our patrol, else 60%), through their anti-aircraft
//   fire and air cover;
// - recon: over land +5% fire in our battles there and +20% to our support and
//   interdiction there; over the sea it finds ships and exposes submarines.
//
// What a mission achieves is scaled by the wing's strength and readiness and by
// who holds the sky: in skies the enemy holds (1.5× our air power) to 40%, in
// contested skies to 75%. Every week a wing flies it is exposed: enemy fighters
// over its area intercept it, forts and armies shoot at bombers and support, and
// ships' anti-aircraft fire at naval strikes. Flying wears readiness (−10 a
// week, restored by rest at 25 × (1 − readiness)): sustained operations settle
// near 60%; a wing below 25% is grounded until it recovers, and without oil it
// does not recover. Strength lost is replaced at a quiet base, paid in materiel
// (aboard a carrier only off a friendly port). Losing the base forces a wing to
// rebase within twice its range, or it is lost; so is a carrier's air group when
// the carrier goes down.
//
// Weekly order (tick.ts): the naval phase moves the fleets, then flies the sea
// missions (seaAir); battles are detected after movement; the air phase flies the
// land missions, plans ground support for this week's battles, resolves losses,
// readiness and replacements; the battle round then reads the support plan.

import { commanderMod } from './commanders';
import { aaAgainst } from './airborne';
import { noteOpLoss } from './ops/losses';
import { C, SHIPS, WINGS, WING_TYPES } from './config';
import { armiesIn, battleGen, geoRev, memoEpochNow } from './index';
import { nationMods } from './modifiers';
import { fleetEpoch, fleetsIn, zoneName } from './naval';
import { opDistance, placesWithin, type Place } from './reach';
import { orderWing } from './production';
import { chance, range } from './rng';
import { atWar, isFriendly, notify, provName, type Sim } from './state';
import type { AirMission, AirWing, Battle, Fleet, FleetId, NationId, ProvinceId, Ship, StrategicResource, SupportLine, WingId, WingType, ZoneId } from './types';

export const MISSION_LABELS: Record<AirMission, string> = {
  idle: 'Idle',
  superiority: 'Air superiority',
  support: 'Ground support',
  interdiction: 'Interdiction',
  bombing: 'Strategic bombing',
  naval: 'Naval strike',
  recon: 'Reconnaissance',
};

/** What each mission does, one line (interface and order dialogs). */
export const MISSION_HELP: Record<AirMission, string> = {
  idle: 'Rests at its base: readiness and strength recover.',
  superiority: `Patrols the area, intercepts enemy aircraft there and covers our own missions; with ${C.air.superiority}× the enemy's air power we hold the sky and their missions achieve ${Math.round(C.air.contested * 100)}%. Over a sea zone: air cover for our fleets.`,
  support: `On call over the area: each week it joins one of our battles there (the one at its target first) for up to +${Math.round(C.air.supportMax * 100)}% fire from all air support. It flies only when there is a battle.`,
  interdiction: `Enemy armies in the area lose up to ${Math.round(C.air.interdictSupplyMax * 100)}% supply and ${Math.round(C.air.interdictMoveMax * 100)}% speed.`,
  bombing: `An enemy-held province: its factories lose up to ${Math.round(C.air.bombIndustryMax * 100)}% of their output, its shipyard stops and repairs halve, and aircraft on its airfield are grounded. Forts shoot back.`,
  naval: `Strikes enemy ships in the zone, if it finds them (always under our reconnaissance patrol, else ${Math.round(C.air.detect * 100)}%). Anti-aircraft fire and enemy air cover blunt it.`,
  recon: `Over land: our battles in the area fire ${Math.round(C.air.recon * 100)}% harder and our support and interdiction there strike ${Math.round(C.air.reconBoost * 100)}% harder. Over a sea zone: our strikes find their targets and enemy submarines lose their cover.`,
};

/** Missions that can be flown over a sea zone, and those flown only over land. */
export const SEA_MISSIONS: readonly AirMission[] = ['superiority', 'naval', 'recon'];
export const LAND_MISSIONS: readonly AirMission[] = ['superiority', 'support', 'interdiction', 'bombing', 'recon'];

const airGen = new WeakMap<object, number>();

/** Call after a wing is added, removed, rebased or given a mission: keeps the wing index exact. */
export function touchWings(sim: Sim): void {
  airGen.set(sim.state, (airGen.get(sim.state) ?? 0) + 1);
}

function wingGen(sim: Sim): number {
  return airGen.get(sim.state) ?? 0;
}

/**
 * The air situation of the week (statuses, presence, support and bombing plans)
 * depends only on the wings, the fleets, the geography (control, wars), the
 * battles and the week: kept across the phases of a week while none of them
 * changes, instead of being rebuilt in every phase.
 */
interface AirTable {
  tick: number;
  gen: number;
  geo: number;
  battles: number;
  sig: string;
  values: Map<string, unknown>;
}
const airWeek = new WeakMap<object, Map<string, AirTable>>();

/**
 * Fleets matter to the air only where wings fly from them: the zone and the
 * working decks of every fleet with wings aboard (not every fleet move).
 */
interface CarrierInfo {
  tick: number;
  gen: number;
  fleets: number;
  sig: string;
  /** per wing aboard: its carrier's zone, working decks, and its place in the air group */
  wing: Map<WingId, string>;
}
const carrierInfoCache = new WeakMap<object, CarrierInfo>();

function carrierInfo(sim: Sim): CarrierInfo {
  const st = sim.state;
  const gen = wingGen(sim);
  const fleets = fleetEpoch(sim);
  const hit = carrierInfoCache.get(st);
  if (hit && hit.tick === st.tick && hit.gen === gen && hit.fleets === fleets) return hit;
  let sig = '';
  const wing = new Map<WingId, string>();
  for (const [fid, list] of wingIndex(sim).byCarrier) {
    const f = st.fleets[fid];
    const d = f ? `${f.zone}:${deckSlots(sim, f).operate}` : '-';
    sig += `${fid}@${d};`;
    list.forEach((w, i) => wing.set(w.id, `${d}:${i}`));
  }
  const info = { tick: st.tick, gen, fleets, sig, wing };
  carrierInfoCache.set(st, info);
  return info;
}

function carrierSig(sim: Sim): string {
  return carrierInfo(sim).sig;
}

/** `wide`: also keyed on the wings and the carriers (presence, plans); else only the week, geography and battles (per-wing statuses keyed on the wing itself). */
function airCached<T>(sim: Sim, table: string, sub: string, compute: () => T, wide = true): T {
  const st = sim.state;
  const gen = wide ? wingGen(sim) : 0;
  const geo = geoRev(sim);
  const battles = battleGen(sim);
  const sig = wide ? carrierSig(sim) : '';
  let per = airWeek.get(st);
  if (!per) airWeek.set(st, (per = new Map()));
  let t = per.get(table);
  if (!t || t.tick !== st.tick || t.gen !== gen || t.geo !== geo || t.battles !== battles || t.sig !== sig) per.set(table, (t = { tick: st.tick, gen, geo, battles, sig, values: new Map() }));
  if (t.values.has(sub)) return t.values.get(sub) as T;
  const v = compute();
  t.values.set(sub, v);
  return v;
}

interface WingIndex {
  gen: number;
  /** memo epoch it was last checked against the state (the count is verified once an epoch) */
  epoch: number;
  count: number;
  byNation: Map<NationId, AirWing[]>;
  /** wings at airfields (not aboard carriers), by airfield */
  byBase: Map<ProvinceId, AirWing[]>;
  /** wings aboard carriers, by fleet */
  byCarrier: Map<FleetId, AirWing[]>;
}
const wingIdx = new WeakMap<object, WingIndex>();

/** Wings by realm, airfield and carrier, each list in id order. */
function wingIndex(sim: Sim): WingIndex {
  const st = sim.state;
  const gen = wingGen(sim);
  const hit = wingIdx.get(st);
  const epoch = memoEpochNow();
  if (hit && hit.gen === gen && hit.epoch === epoch) return hit;
  const ids = Object.keys(st.wings);
  // the count also catches wings added or removed without touchWings (tests editing state directly)
  if (hit && hit.gen === gen && hit.count === ids.length) {
    hit.epoch = epoch;
    return hit;
  }
  const x: WingIndex = { gen, epoch, count: ids.length, byNation: new Map(), byBase: new Map(), byCarrier: new Map() };
  for (const id of ids.sort()) {
    const w = st.wings[id];
    (x.byNation.get(w.nation) ?? x.byNation.set(w.nation, []).get(w.nation)!).push(w);
    if (w.carrier) (x.byCarrier.get(w.carrier) ?? x.byCarrier.set(w.carrier, []).get(w.carrier)!).push(w);
    else (x.byBase.get(w.base) ?? x.byBase.set(w.base, []).get(w.base)!).push(w);
  }
  wingIdx.set(st, x);
  return x;
}

export function wingsOf(sim: Sim, nid: NationId): AirWing[] {
  return [...(wingIndex(sim).byNation.get(nid) ?? [])];
}

/** Wings at an airfield (aboard carriers they are elsewhere). */
export function wingsAt(sim: Sim, pid: ProvinceId): AirWing[] {
  return [...(wingIndex(sim).byBase.get(pid) ?? [])];
}

/** Wings aboard a fleet's carriers, in id order. */
export function wingsAboard(sim: Sim, fid: FleetId): AirWing[] {
  return [...(wingIndex(sim).byCarrier.get(fid) ?? [])];
}

/** Where a wing flies from this week: its airfield, or the zone its carrier lies in. */
export function wingPlace(sim: Sim, w: Pick<AirWing, 'base' | 'carrier'>): Place {
  const f = w.carrier ? sim.state.fleets[w.carrier] : undefined;
  return f ? { zone: f.zone } : { prov: w.base };
}

/** "Durazzo" or "the carriers of the Italian Home Fleet (Sardinia Bight)". */
export function wingHome(sim: Sim, w: Pick<AirWing, 'base' | 'carrier'>): string {
  const f = w.carrier ? sim.state.fleets[w.carrier] : undefined;
  return f ? `the carriers of ${f.name} (${zoneName(sim, f.zone)})` : provName(sim, w.base);
}

export function wingRange(sim: Sim, w: Pick<AirWing, 'nation' | 'type'>): number {
  return WINGS[w.type].range + nationMods(sim, w.nation).airRange;
}

/** Is the mission flown over a sea zone (naval strike always; superiority and recon when they name a zone, or aboard a carrier with no target province)? */
export function seaMission(w: Pick<AirWing, 'mission' | 'zone' | 'target' | 'carrier'>): boolean {
  if (w.mission === 'naval') return true;
  if (w.mission !== 'superiority' && w.mission !== 'recon') return false;
  return w.zone !== null || (!!w.carrier && w.target === null);
}

/** The place a mission covers: the target province, or the zone (aboard a carrier, by default its fleet's zone). */
export function missionPlace(sim: Sim, w: AirWing): Place | null {
  if (w.mission === 'idle') return null;
  if (seaMission(w)) {
    if (w.zone) return { zone: w.zone };
    const f = w.carrier ? sim.state.fleets[w.carrier] : undefined;
    return f ? { zone: f.zone } : null;
  }
  return w.target ? { prov: w.target } : null;
}

export function placeName(sim: Sim, p: Place | null): string {
  if (!p) return 'nowhere';
  return p.prov !== undefined ? provName(sim, p.prov) : zoneName(sim, p.zone);
}

/** Steps from the wing's base (or carrier) to a place. */
export function stepsTo(sim: Sim, w: Pick<AirWing, 'base' | 'carrier'>, to: Place): number {
  return opDistance(sim, wingPlace(sim, w), to);
}

export function inRangeOf(sim: Sim, w: Pick<AirWing, 'nation' | 'type' | 'base' | 'carrier'>, to: Place): boolean {
  return stepsTo(sim, w, to) <= wingRange(sim, w);
}

/** Is a province within the wing's range of its base or carrier? */
export function inRange(sim: Sim, w: Pick<AirWing, 'nation' | 'type' | 'base' | 'carrier'>, target: ProvinceId): boolean {
  return inRangeOf(sim, w, { prov: target });
}

/** Provinces and zones a wing can reach (range overlay). */
export function wingCoverage(sim: Sim, w: AirWing): { provs: ProvinceId[]; zones: ZoneId[] } {
  return placesWithin(sim, wingPlace(sim, w), wingRange(sim, w));
}

export function wingUnlocked(sim: Sim, nid: NationId, type: WingType): boolean {
  return sim.state.nations[nid].research.done.includes(WINGS[type].requires);
}

export interface WingCost {
  crowns: number;
  materiel: number;
  resources: Partial<Record<StrategicResource, number>>;
  weeks: number;
}

export function wingCost(sim: Sim, nid: NationId, type: WingType): WingCost {
  const r = WINGS[type];
  return { crowns: r.cost, materiel: Math.round(r.materiel * Math.max(0.3, 1 + nationMods(sim, nid).materielCost)), resources: { ...r.resources }, weeks: r.weeks };
}

/** Wings based or being built at an airfield. */
function airfieldLoad(sim: Sim, pid: ProvinceId): number {
  return wingsAt(sim, pid).length + sim.state.provinces[pid].hangar.length;
}

export function airfieldRoom(sim: Sim, pid: ProvinceId): number {
  return sim.state.provinces[pid].airfield * C.air.wingsPerAirfield - airfieldLoad(sim, pid);
}

export function buildWingProblem(sim: Sim, nid: NationId, pid: ProvinceId, type: WingType): string | null {
  const st = sim.state;
  const n = st.nations[nid];
  const p = st.provinces[pid];
  if (!n?.alive) return 'Your realm has fallen.';
  if (!p) return 'Unknown province.';
  if (!WINGS[type]) return 'Unknown aircraft type.';
  if (p.owner !== nid || p.controller !== nid) return 'Air wings are raised only at airfields we own and hold.';
  if (p.airfield < 1) return 'This province has no airfield. Build one first (needs Aviation).';
  if (!wingUnlocked(sim, nid, type)) return `${WINGS[type].plural} need the technology ${WINGS[type].requires.replace(/_/g, ' ')}.`;
  if (airfieldRoom(sim, pid) <= 0) return `The airfield is full (${C.air.wingsPerAirfield} wings per level).`;
  const c = wingCost(sim, nid, type);
  if (n.treasury < c.crowns) return `Needs ${c.crowns} crowns (treasury ${Math.floor(n.treasury)}).`;
  if (n.materiel < c.materiel) return `Needs ${c.materiel} materiel (stockpile ${Math.floor(n.materiel)}).`;
  for (const [r, v] of Object.entries(c.resources)) if ((n.stock[r as StrategicResource] ?? 0) < (v ?? 0)) return `Needs ${v} ${r} (stockpile ${Math.floor(n.stock[r as StrategicResource])}).`;
  return null;
}

export function startWing(sim: Sim, nid: NationId, pid: ProvinceId, type: WingType): void {
  const n = sim.state.nations[nid];
  const c = wingCost(sim, nid, type);
  n.treasury -= c.crowns;
  n.materiel -= c.materiel;
  for (const [r, v] of Object.entries(c.resources)) n.stock[r as StrategicResource] -= v ?? 0;
  sim.state.provinces[pid].hangar.push({ nation: nid, wing: type, weeksLeft: c.weeks });
}

export function cancelWing(sim: Sim, nid: NationId, pid: ProvinceId): boolean {
  const p = sim.state.provinces[pid];
  const i = p.hangar.map((o) => o.nation).lastIndexOf(nid);
  if (i < 0) return false;
  const o = p.hangar[i];
  const c = wingCost(sim, nid, o.wing);
  const n = sim.state.nations[nid];
  n.materiel += c.materiel;
  for (const [r, v] of Object.entries(c.resources)) n.stock[r as StrategicResource] += v ?? 0;
  p.hangar.splice(i, 1);
  return true;
}

export function createWing(sim: Sim, nid: NationId, base: ProvinceId, type: WingType): AirWing {
  const st = sim.state;
  st.counters.wing++;
  const id = `w${st.counters.wing}`;
  const count = wingsOf(sim, nid).filter((w) => w.type === type).length + 1;
  const w: AirWing = { id, nation: nid, name: `${sim.world.nationDefs[nid].adjective} ${WINGS[type].label} ${count}`, type, base, carrier: null, strength: 100, readiness: 100, mission: 'idle', target: null, zone: null, report: null };
  st.wings[id] = w;
  touchWings(sim);
  return w;
}

export function weeklyHangars(sim: Sim): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.hangar.length) continue;
    for (let i = p.hangar.length - 1; i >= 0; i--) {
      const o = p.hangar[i];
      if (p.owner !== o.nation || !st.nations[o.nation]?.alive) {
        p.hangar.splice(i, 1);
        continue;
      }
      if (p.controller !== o.nation) continue;
      o.weeksLeft--;
      if (o.weeksLeft > 0) continue;
      p.hangar.splice(i, 1);
      const w = createWing(sim, o.nation, pid, o.wing);
      st.nations[o.nation].stats.wingsBuilt++;
      if (o.order) {
        orderWing(sim, o.nation, o.order, w);
        continue;
      }
      notify(sim, o.nation, 'low', 'air', `A new ${WINGS[o.wing].label.toLowerCase()} is ready at ${provName(sim, pid)}.`, { province: pid });
    }
  }
}

// ───────────────────────────── Carriers ─────────────────────────────────────

/** Air wings a carrier holds for a realm. */
export function deckPerCarrier(sim: Sim, nid: NationId): number {
  return SHIPS.carrier.deck + nationMods(sim, nid).carrierDeck;
}

/** Wings a fleet's carriers can hold (every carrier afloat), and operate (carriers above the hull limit). */
export function deckSlots(sim: Sim, f: Fleet): { hold: number; operate: number } {
  const per = deckPerCarrier(sim, f.nation);
  let hold = 0;
  let operate = 0;
  for (const s of f.ships) {
    if (!SHIPS[s.type].deck) continue;
    hold += per;
    if (s.hp >= C.air.deckHull) operate += per;
  }
  return { hold, operate };
}

export function deckRoom(sim: Sim, f: Fleet): number {
  return deckSlots(sim, f).hold - wingsAboard(sim, f.id).length;
}

/** Twice a wing's combat range: how far it can fly to change base. */
export function ferryRange(sim: Sim, w: Pick<AirWing, 'nation' | 'type'>): number {
  return 2 * wingRange(sim, w);
}

/** Airfields of `nid` with room within ferry range of a place, nearest first. */
function fieldsNear(sim: Sim, w: AirWing, from: Place, exclude?: ProvinceId): ProvinceId[] {
  const st = sim.state;
  const reach = ferryRange(sim, w);
  return sim.world.provIds
    .filter((pid) => pid !== exclude && st.provinces[pid].airfield > 0 && st.provinces[pid].owner === w.nation && st.provinces[pid].controller === w.nation && airfieldRoom(sim, pid) > 0)
    .map((pid) => ({ pid, d: opDistance(sim, from, { prov: pid }) }))
    .filter((x) => x.d <= reach)
    .sort((a, b) => a.d - b.d || (a.pid < b.pid ? -1 : 1))
    .map((x) => x.pid);
}

/**
 * Brings a fleet's air group in line with its decks after ships were sunk, the
 * fleet was split, or it was removed (`zone`: where it was). Wings beyond the
 * room left fly to the nearest airfield of theirs within ferry range, or are lost.
 */
export function relocateAir(sim: Sim, fid: FleetId, zone?: ZoneId): void {
  const aboard = wingsAboard(sim, fid);
  if (!aboard.length) return;
  const f = sim.state.fleets[fid];
  const hold = f ? deckSlots(sim, f).hold : 0;
  const where: ZoneId | undefined = f?.zone ?? zone;
  for (const w of aboard.slice(hold).reverse()) {
    const from: Place = where ? { zone: where } : { prov: w.base };
    const field = fieldsNear(sim, w, from)[0];
    const name = f?.name ?? 'its fleet';
    if (field) {
      w.carrier = null;
      w.base = field;
      w.readiness = Math.max(0, w.readiness - C.air.rebase);
      notify(sim, w.nation, 'normal', 'air', `${w.name} lost its carrier deck with ${name} and flew to ${provName(sim, field)}.`, { province: field });
    } else {
      notify(sim, w.nation, 'normal', 'air', `${w.name} went down with the carriers of ${name}: no airfield of ours within reach.`);
      delete sim.state.wings[w.id];
    }
  }
  touchWings(sim);
}

/** Wings aboard a fleet move with its carriers when a fleet is split; whatever does not fit stays. */
export function splitAir(sim: Sim, from: Fleet, to: Fleet): void {
  const aboard = wingsAboard(sim, from.id);
  if (!aboard.length) return;
  let keep = deckSlots(sim, from).hold;
  let room = deckSlots(sim, to).hold;
  for (const w of aboard) {
    if (keep > 0) keep--;
    else if (room > 0) {
      w.carrier = to.id;
      room--;
    }
  }
  touchWings(sim);
  relocateAir(sim, from.id);
}

/** Wings aboard merged fleets now fly from the fleet they joined. */
export function mergeAir(sim: Sim, into: Fleet, from: FleetId): void {
  for (const w of wingsAboard(sim, from)) w.carrier = into.id;
  touchWings(sim);
}

// ───────────────────────────── Orders ───────────────────────────────────────

export function missionProblem(sim: Sim, nid: NationId, wingId: WingId, mission: AirMission, target: ProvinceId | null, zone: ZoneId | null = null): string | null {
  const st = sim.state;
  const w = st.wings[wingId];
  if (!w || w.nation !== nid) return 'Not our air wing.';
  if (mission === 'idle') return null;
  const r = WINGS[w.type];
  if (!(r.missions as string[]).includes(mission)) return `${r.plural} cannot fly ${MISSION_LABELS[mission].toLowerCase()} (they fly ${r.missions.map((m) => MISSION_LABELS[m].toLowerCase()).join(', ')}).`;
  if (target && !st.provinces[target]) return 'Unknown province.';
  if (zone && !sim.world.zones[zone]) return 'Unknown sea zone.';
  if (target && zone) return 'Choose a province or a sea zone, not both.';
  if (mission === 'naval' && target) return 'Naval strikes are flown over a sea zone: choose one (or, from a carrier, the fleet’s own waters).';
  if (zone && !SEA_MISSIONS.includes(mission)) return `${MISSION_LABELS[mission]} is flown over land: choose a province.`;
  const probe: AirWing = { ...w, mission, target, zone };
  const place = missionPlace(sim, probe);
  if (!place) return w.carrier ? 'Choose a target province or sea zone.' : seaMission(probe) ? 'Choose a sea zone.' : 'Choose a target province.';
  const d = stepsTo(sim, w, place);
  const rng = wingRange(sim, w);
  if (d > rng) return `${placeName(sim, place)} is out of range: ${d === Infinity ? 'more than 8' : d} steps from ${wingHome(sim, w)}; the range is ${rng}.`;
  if (mission === 'bombing') {
    const c = st.provinces[target!].controller;
    if (!c || !atWar(sim, nid, c)) return 'Bombing needs a province held by an enemy.';
  }
  return null;
}

export function rebaseProblem(sim: Sim, nid: NationId, wingId: WingId, base: ProvinceId | null, carrier: FleetId | null = null): string | null {
  const st = sim.state;
  const w = st.wings[wingId];
  if (!w || w.nation !== nid) return 'Not our air wing.';
  if (carrier) {
    const f = st.fleets[carrier];
    if (!f || f.nation !== nid) return 'Not our fleet.';
    if (w.carrier === carrier) return 'The wing is already aboard.';
    if (!WINGS[w.type].carrier) return `${WINGS[w.type].plural} are too heavy for a carrier deck.`;
    const deck = deckSlots(sim, f);
    if (!deck.hold) return `${f.name} has no carrier.`;
    if (deckRoom(sim, f) <= 0) return `${f.name}'s decks are full (${deck.hold} wings).`;
    if (!deck.operate) return `${f.name}'s carriers are too badly damaged to take aircraft aboard.`;
    const d = stepsTo(sim, w, { zone: f.zone });
    if (d > ferryRange(sim, w)) return `${f.name} is ${d === Infinity ? 'more than 8' : d} steps away; the wing can fly ${ferryRange(sim, w)} to change base.`;
    return null;
  }
  if (!base) return 'Choose an airfield or a carrier.';
  const p = st.provinces[base];
  if (!p) return 'Unknown province.';
  if (base === w.base && !w.carrier) return 'The wing is already based there.';
  if (p.airfield < 1 || p.controller !== nid || p.owner !== nid) return 'Wings can rebase only to airfields we own and hold.';
  if (airfieldRoom(sim, base) <= 0) return 'That airfield is full.';
  if (w.carrier) {
    const d = stepsTo(sim, w, { prov: base });
    if (d > ferryRange(sim, w)) return `${provName(sim, base)} is ${d === Infinity ? 'more than 8' : d} steps from the carrier; the wing can fly ${ferryRange(sim, w)} to change base.`;
  }
  return null;
}

/** Moves a wing to an airfield or aboard a fleet's carriers: re-establishing it costs readiness. */
export function rebaseWing(sim: Sim, w: AirWing, base: ProvinceId | null, carrier: FleetId | null): void {
  // a mission over "the fleet's own waters" means nothing ashore
  const overFleet = !!w.carrier && seaMission(w) && w.zone === null;
  if (carrier) w.carrier = carrier;
  else if (base) {
    w.carrier = null;
    w.base = base;
  }
  if (overFleet && !w.carrier) w.mission = 'idle';
  w.readiness = Math.max(0, w.readiness - C.air.rebase);
  touchWings(sim);
}

// ───────────────────────────── Status ───────────────────────────────────────

/**
 * - idle: no mission (resting);
 * - flying: flies its mission this week (wears readiness, exposed to the enemy);
 * - standby: on call, nothing to do this week (support with no battle in its area);
 * - grounded: has a mission it cannot fly (the reason says why).
 */
export type WingState = 'idle' | 'flying' | 'standby' | 'grounded';

export interface WingStatus {
  state: WingState;
  reason: string;
  /** what its values count for when flying: strength × readiness (0.5–1) */
  eff: number;
  place: Place | null;
}

function shortOfOil(sim: Sim, nid: NationId): boolean {
  return (sim.state.nations[nid]?.shortages ?? []).includes('oil');
}

/** Readiness factor of a wing's values: 50% at no readiness, 100% at full. */
export function readyFactor(w: Pick<AirWing, 'readiness'>): number {
  return 0.5 + 0.5 * Math.max(0, Math.min(100, w.readiness)) / 100;
}

function computeStatus(sim: Sim, w: AirWing): WingStatus {
  const st = sim.state;
  const eff = (w.strength / 100) * readyFactor(w);
  if (w.mission === 'idle') return { state: 'idle', reason: `Resting at ${wingHome(sim, w)}${w.readiness < 99.5 ? ` (readiness ${Math.round(w.readiness)}%)` : ''}.`, eff, place: null };
  if (w.carrier) {
    const f = st.fleets[w.carrier];
    if (!f) return { state: 'grounded', reason: 'Its carrier is gone.', eff, place: null };
    const deck = deckSlots(sim, f);
    const aboard = wingsAboard(sim, f.id);
    if (aboard.indexOf(w) >= deck.operate) return { state: 'grounded', reason: deck.operate ? `${f.name} has deck room to operate only ${deck.operate} of its ${aboard.length} wings: a carrier is badly damaged.` : `Flight decks out of action: ${f.name}'s carriers are below ${C.air.deckHull}% hull. Repair them in port.`, eff, place: null };
  }
  const place = missionPlace(sim, w);
  if (!place) return { state: 'grounded', reason: 'No target.', eff, place: null };
  const d = stepsTo(sim, w, place);
  const rng = wingRange(sim, w);
  if (d > rng) return { state: 'grounded', reason: `Out of range: ${placeName(sim, place)} is ${d === Infinity ? 'more than 8' : d} steps from ${wingHome(sim, w)}; the range is ${rng}.`, eff, place };
  if (w.mission === 'bombing') {
    const c = st.provinces[w.target!].controller;
    if (!c || !atWar(sim, w.nation, c)) return { state: 'grounded', reason: `${provName(sim, w.target!)} is not held by an enemy.`, eff, place };
  }
  if (w.readiness < C.air.minReady) {
    return { state: 'grounded', reason: shortOfOil(sim, w.nation) ? `Grounded: readiness ${Math.round(w.readiness)}% and no oil to recover. Import or produce oil.` : `Not ready: readiness ${Math.round(w.readiness)}% (flies again at ${C.air.minReady}%).`, eff, place };
  }
  if (w.mission === 'support' && !supportBattle(sim, w)) return { state: 'standby', reason: `On call over ${placeName(sim, place)}: no battle of ours in the area this week.`, eff, place };
  return { state: 'flying', reason: '', eff, place };
}

/** A wing's status this week (memoized per phase). */
export function wingStatus(sim: Sim, w: AirWing): WingStatus {
  // everything a status depends on that is not the week, geography or battles: the wing itself, and its carrier
  const deck = w.carrier ? (carrierInfo(sim).wing.get(w.id) ?? '-') : '';
  return airCached(sim, 'wingStatus', `${w.id}|${w.strength}|${w.readiness}|${w.mission}|${w.target}|${w.zone}|${w.carrier}|${w.base}|${deck}`, () => computeStatus(sim, w), false);
}

/** A wing has an order it can carry out this week (flying, or on call). */
export function activeMission(sim: Sim, w: AirWing): boolean {
  const s = wingStatus(sim, w).state;
  return s === 'flying' || s === 'standby';
}

/** Land provinces a land mission covers (bombing: the target only). */
export function missionArea(sim: Sim, w: AirWing): ProvinceId[] {
  if (!w.target || seaMission(w)) return [];
  return w.mission === 'bombing' ? [w.target] : [w.target, ...sim.world.prov[w.target].neighbors];
}

// ───────────────────────────── Ground support plan ──────────────────────────

/** Which side of a battle is friendly to `nid` (null: neither). */
function friendlySide(sim: Sim, b: Battle, nid: NationId): 'att' | 'def' | null {
  const ours = (list: NationId[]) => list.some((n) => n === nid || (isFriendly(sim, nid, n) && !atWar(sim, nid, n)));
  const theirs = (list: NationId[]) => list.some((n) => atWar(sim, nid, n));
  if (ours(b.attackerNations) && theirs(b.defenderNations)) return 'att';
  if (ours(b.defenderNations) && theirs(b.attackerNations)) return 'def';
  return null;
}

function battleMen(sim: Sim, b: Battle): number {
  let m = 0;
  for (const id of [...b.attackers, ...b.defenders]) for (const r of sim.state.armies[id]?.regiments ?? []) m += r.men;
  return m;
}

/** The battle a support wing joins this week: the one at its target, else the largest in its area. */
export function supportBattle(sim: Sim, w: AirWing): Battle | null {
  const area = missionArea(sim, w);
  if (!area.length) return null;
  let best: Battle | null = null;
  let bestMen = -1;
  for (const id of Object.keys(sim.state.battles).sort()) {
    const b = sim.state.battles[id];
    if (!area.includes(b.province) || !friendlySide(sim, b, w.nation)) continue;
    if (b.province === w.target) return b;
    const m = battleMen(sim, b);
    if (m > bestMen) (bestMen = m), (best = b);
  }
  return best;
}

export interface SidePlan {
  lines: SupportLine[];
  /** ground value committed, before air control and caps */
  ground: number;
  recon: boolean;
}

/** This week's ground support, by battle and side (memoized per phase). */
export function supportPlan(sim: Sim): Map<string, { att: SidePlan; def: SidePlan }> {
  return airCached(sim, 'supportPlan', '', () => {
    const out = new Map<string, { att: SidePlan; def: SidePlan }>();
    const st = sim.state;
    if (!Object.keys(st.wings).length || !Object.keys(st.battles).length) return out;
    const slot = (b: Battle) => out.get(b.id) ?? out.set(b.id, { att: { lines: [], ground: 0, recon: false }, def: { lines: [], ground: 0, recon: false } }).get(b.id)!;
    for (const id of Object.keys(st.wings).sort()) {
      const w = st.wings[id];
      if (w.mission !== 'support' && w.mission !== 'recon') continue;
      if (w.mission === 'recon' && seaMission(w)) continue;
      const s = wingStatus(sim, w);
      if (s.state !== 'flying') continue;
      if (w.mission === 'support') {
        const b = supportBattle(sim, w)!;
        const side = friendlySide(sim, b, w.nation)!;
        const g = WINGS[w.type].ground * s.eff * Math.max(0.2, 1 + nationMods(sim, w.nation).airAttack + commanderMod(sim, w.id, 'airAttack')) * (reconOver(sim, b.province, w.nation) ? 1 + C.air.reconBoost : 1) * aaFactor(sim, b.province, w.nation);
        const p = slot(b)[side];
        p.ground += g;
        p.lines.push({ kind: 'air', id: w.id, nation: w.nation, name: w.name, value: g });
      } else {
        // reconnaissance: every battle of ours in its area
        for (const pid of missionArea(sim, w)) {
          for (const bid of Object.keys(st.battles).sort()) {
            const b = st.battles[bid];
            if (b.province !== pid) continue;
            const side = friendlySide(sim, b, w.nation);
            if (!side) continue;
            const p = slot(b)[side];
            if (p.recon) continue;
            p.recon = true;
            p.lines.push({ kind: 'recon', id: w.id, nation: w.nation, name: w.name, value: C.air.recon });
          }
        }
      }
    }
    return out;
  });
}

/** What a mission over a province still achieves through its anti-aircraft fire (8% less a level). */
export function aaFactor(sim: Sim, pid: ProvinceId, by: NationId): number {
  const aa = aaAgainst(sim, pid, by).total;
  return aa > 0 ? Math.max(0.2, 1 - C.air.aaEffect * aa) : 1;
}

/** Do we (or friends) fly reconnaissance over this province? */
export function reconOver(sim: Sim, pid: ProvinceId, nid: NationId): boolean {
  const m = airMap(sim).get(pid);
  if (!m) return false;
  for (const [n, a] of m) if (a.recon > 0 && (n === nid || (isFriendly(sim, nid, n) && !atWar(sim, nid, n)))) return true;
  return false;
}

/**
 * Fire support from the air for one side of a battle this week: wings committed
 * to it (support and reconnaissance), scaled by who holds the sky over it.
 * Returns the multiplier share (before the overall support cap), notes and lines.
 */
export function airSupportFor(sim: Sim, b: Battle, side: 'att' | 'def'): { share: number; notes: string[]; lines: SupportLine[] } {
  const plan = supportPlan(sim).get(b.id)?.[side];
  if (!plan || !plan.lines.length) return { share: 0, notes: [], lines: [] };
  const lead = (side === 'att' ? b.attackerNations : b.defenderNations)[0];
  const ctl = airControl(sim, { prov: b.province }, lead);
  const k = controlFactor(ctl);
  let share = 0;
  const notes: string[] = [];
  const lines: SupportLine[] = [];
  if (plan.ground > 0) {
    const raw = Math.min(C.air.supportMax, C.air.supportPer * plan.ground);
    const s = raw * k;
    share += s;
    // each wing's part of the support, in proportion to what it brought
    for (const l of plan.lines) if (l.kind === 'air') lines.push({ ...l, value: (s * l.value) / plan.ground });
    const names = plan.lines.filter((l) => l.kind === 'air').map((l) => l.name);
    notes.push(`Air support +${Math.round(s * 100)}% from ${names.length === 1 ? names[0] : `${names.length} wings`}${ctl === 'theirs' ? ' (the enemy holds the sky)' : ctl === 'contested' ? ' (contested sky)' : ctl === 'ours' ? ' (air superiority)' : ''}`);
  }
  if (plan.recon) {
    share += C.air.recon;
    const r = plan.lines.find((l) => l.kind === 'recon')!;
    lines.push({ ...r, value: C.air.recon });
    notes.push(`Air reconnaissance +${Math.round(C.air.recon * 100)}%`);
  }
  return { share, notes, lines };
}

/** What support a hypothetical battle in `pid` could expect from the air now (forecasts). */
export function airSupportForecast(sim: Sim, pid: ProvinceId, nations: NationId[]): { share: number; notes: string[] } {
  if (!nations.length || !Object.keys(sim.state.wings).length) return { share: 0, notes: [] };
  const busy = new Set<string>();
  for (const p of supportPlan(sim).values()) for (const l of [...p.att.lines, ...p.def.lines]) if (l.kind === 'air') busy.add(l.id);
  let ground = 0;
  let recon = false;
  let n = 0;
  for (const id of Object.keys(sim.state.wings).sort()) {
    const w = sim.state.wings[id];
    if (!nations.includes(w.nation)) continue;
    if (w.mission === 'recon' && !seaMission(w) && missionArea(sim, w).includes(pid) && wingStatus(sim, w).state === 'flying') recon = true;
    if (w.mission !== 'support' || busy.has(w.id) || !missionArea(sim, w).includes(pid)) continue;
    const s = wingStatus(sim, w);
    if (s.state === 'grounded' || s.state === 'idle') continue;
    ground += WINGS[w.type].ground * s.eff * Math.max(0.2, 1 + nationMods(sim, w.nation).airAttack + commanderMod(sim, w.id, 'airAttack'));
    n++;
  }
  const notes: string[] = [];
  let share = 0;
  if (ground > 0) {
    const ctl = airControl(sim, { prov: pid }, nations[0]);
    const s = Math.min(C.air.supportMax, C.air.supportPer * ground) * controlFactor(ctl);
    share += s;
    notes.push(`Air support on call +${Math.round(s * 100)}% (${n} wing${n === 1 ? '' : 's'}${ctl === 'theirs' ? ', the enemy holds the sky' : ctl === 'contested' ? ', contested sky' : ctl === 'ours' ? ', air superiority' : ''})`);
  }
  if (recon) {
    share += C.air.recon;
    notes.push(`Air reconnaissance +${Math.round(C.air.recon * 100)}%`);
  }
  return { share, notes };
}

// ───────────────────────────── Air situation ────────────────────────────────

export interface AirPresence {
  /** air combat power: fighters on patrol count in full, everything else defends itself at half */
  air: number;
  /** interceptors: fighters flying superiority */
  fighters: number;
  interdiction: number;
  recon: number;
}

const ZERO: AirPresence = Object.freeze({ air: 0, fighters: 0, interdiction: 0, recon: 0 }) as AirPresence;

/** Places a flying wing is over this week (support: its battle's province). */
export function wingCells(sim: Sim, w: AirWing): string[] {
  if (seaMission(w)) {
    const p = missionPlace(sim, w);
    return p?.zone ? [`z:${p.zone}`] : [];
  }
  if (w.mission === 'support') {
    const b = supportBattle(sim, w);
    return b ? [`p:${b.province}`] : [];
  }
  return missionArea(sim, w).map((p) => `p:${p}`);
}

/** Air presence by place ("p:" province or "z:" zone) and realm, for the current week (derived, never saved). */
function cellMap(sim: Sim): Map<string, Map<NationId, AirPresence>> {
  return airCached(sim, 'airCells', '', () => {
    const out = new Map<string, Map<NationId, AirPresence>>();
    const add = (cell: string, nid: NationId, k: keyof AirPresence, v: number) => {
      const m = out.get(cell) ?? out.set(cell, new Map()).get(cell)!;
      const a = m.get(nid) ?? m.set(nid, { air: 0, fighters: 0, interdiction: 0, recon: 0 }).get(nid)!;
      a[k] += v;
    };
    for (const id of Object.keys(sim.state.wings).sort()) {
      const w = sim.state.wings[id];
      const s = wingStatus(sim, w);
      if (s.state !== 'flying') continue;
      const r = WINGS[w.type];
      const airMul = Math.max(0.2, 1 + nationMods(sim, w.nation).airAttack + commanderMod(sim, w.id, 'airAttack'));
      for (const cell of wingCells(sim, w)) {
        const patrol = w.mission === 'superiority';
        add(cell, w.nation, 'air', r.air * s.eff * airMul * (patrol ? 1 : 0.5));
        if (patrol) add(cell, w.nation, 'fighters', r.air * s.eff * airMul);
        if (w.mission === 'interdiction') add(cell, w.nation, 'interdiction', (r.ground + r.bomb * 0.5) * s.eff * airMul);
        if (w.mission === 'recon') add(cell, w.nation, 'recon', s.eff);
      }
    }
    return out;
  });
}

/** Presence over land provinces only (interdiction, recon). */
function airMap(sim: Sim): Map<ProvinceId, Map<NationId, AirPresence>> {
  return airCached(sim, 'airMapProv', '', () => {
    const out = new Map<ProvinceId, Map<NationId, AirPresence>>();
    for (const [cell, m] of cellMap(sim)) if (cell[0] === 'p') out.set(cell.slice(2), m);
    return out;
  });
}

const cellKey = (p: Place): string => (p.prov !== undefined ? `p:${p.prov}` : `z:${p.zone}`);

/** Every place with aircraft over it this week ("p:" province or "z:" zone), and who flies there (map overlays). */
export function airCells(sim: Sim): ReadonlyMap<string, Map<NationId, AirPresence>> {
  return cellMap(sim);
}

/** Every sea zone with aircraft over it this week, and who flies there (for AI heuristics). */
export function skiesAtSea(sim: Sim): Array<[ZoneId, Map<NationId, AirPresence>]> {
  return airCached(sim, 'skiesAtSea', '', () => {
    const out: Array<[ZoneId, Map<NationId, AirPresence>]> = [];
    for (const [cell, m] of cellMap(sim)) if (cell[0] === 'z') out.push([cell.slice(2), m]);
    return out;
  });
}

export function airAt(sim: Sim, place: Place, nid: NationId): AirPresence {
  return cellMap(sim).get(cellKey(place))?.get(nid) ?? ZERO;
}

/** Air power of `nid`'s side and of its enemies over a place (and their fighters on patrol). */
export function airBalance(sim: Sim, place: Place, nid: NationId): { ours: number; theirs: number; ourFighters: number; theirFighters: number } {
  let ours = 0;
  let theirs = 0;
  let ourFighters = 0;
  let theirFighters = 0;
  const m = cellMap(sim).get(cellKey(place));
  if (!m) return { ours, theirs, ourFighters, theirFighters };
  for (const [n, a] of m) {
    if (n === nid || (isFriendly(sim, nid, n) && !atWar(sim, nid, n))) (ours += a.air), (ourFighters += a.fighters);
    else if (atWar(sim, nid, n)) (theirs += a.air), (theirFighters += a.fighters);
  }
  return { ours, theirs, ourFighters, theirFighters };
}

export type AirControl = 'ours' | 'theirs' | 'contested' | 'none';

/** Who holds the sky over a province or zone, from `nid`'s view. */
export function airControl(sim: Sim, place: Place | ProvinceId, nid: NationId): AirControl {
  const p: Place = typeof place === 'string' ? { prov: place } : place;
  const { ours, theirs } = airBalance(sim, p, nid);
  if (ours <= 0 && theirs <= 0) return 'none';
  if (ours > 0 && ours >= theirs * C.air.superiority) return 'ours';
  if (theirs > 0 && theirs >= ours * C.air.superiority) return 'theirs';
  return 'contested';
}

/** What a mission achieves under each state of the sky. */
export function controlFactor(c: AirControl): number {
  return c === 'theirs' ? C.air.contested : c === 'contested' ? C.air.disputed : 1;
}

/** Enemy interdiction over an army of `nid` in a province: supply lost and movement slowed. */
export function interdiction(sim: Sim, pid: ProvinceId, nid: NationId): { supply: number; move: number } {
  if (!Object.keys(sim.state.wings).length) return { supply: 0, move: 0 };
  const m = airMap(sim).get(pid);
  if (!m) return { supply: 0, move: 0 };
  let power = 0;
  let by: NationId | null = null;
  for (const [n, a] of m) {
    if (!atWar(sim, nid, n) || a.interdiction <= 0) continue;
    power += a.interdiction;
    by ??= n;
  }
  if (power <= 0) return { supply: 0, move: 0 };
  // their sky, our sky: what their aircraft achieve over our army
  if (by) {
    power *= controlFactor(airControl(sim, { prov: pid }, by)) * aaFactor(sim, pid, by);
    if (reconOver(sim, pid, by)) power *= 1 + C.air.reconBoost;
  }
  return { supply: Math.min(C.air.interdictSupplyMax, C.air.interdictSupply * power), move: Math.min(C.air.interdictMoveMax, C.air.interdictMove * power) };
}

/** Bombing power over every bombed province this week, after air defence and the sky (one pass over the wings). */
function bombingMap(sim: Sim): Map<ProvinceId, number> {
  return airCached(sim, 'bombingMap', '', () => {
    const st = sim.state;
    const raw = new Map<ProvinceId, { bomb: number; by: NationId }>();
    for (const id of Object.keys(st.wings).sort()) {
      const w = st.wings[id];
      if (w.mission !== 'bombing' || !w.target) continue;
      const ctl = st.provinces[w.target].controller;
      if (!ctl || !atWar(sim, w.nation, ctl)) continue;
      const s = wingStatus(sim, w);
      if (s.state !== 'flying') continue;
      const v = WINGS[w.type].bomb * s.eff * Math.max(0.2, 1 + nationMods(sim, w.nation).airAttack + commanderMod(sim, w.id, 'airAttack'));
      const cur = raw.get(w.target);
      if (cur) cur.bomb += v;
      else raw.set(w.target, { bomb: v, by: w.nation });
    }
    const out = new Map<ProvinceId, number>();
    for (const [pid, { bomb, by }] of raw) {
      const ctl = st.provinces[pid].controller!;
      out.set(pid, bomb * Math.max(0.1, 1 - nationMods(sim, ctl).airDefence) * controlFactor(airControl(sim, { prov: pid }, by)) * aaFactor(sim, pid, by));
    }
    return out;
  });
}

/** Bombing power over an enemy-held province this week, after air defence and the sky. */
const lastBombing = new WeakMap<object, { tick: number; gen: number; geo: number; battles: number; fleets: number; map: Map<ProvinceId, number> }>();

export function bombingPower(sim: Sim, pid: ProvinceId): number {
  const st = sim.state;
  if (!st.provinces[pid].controller || !st.counters.wing) return 0;
  // the economy asks for every province with factories: a cheap check of the last map first
  const gen = wingGen(sim);
  const geo = geoRev(sim);
  const battles = battleGen(sim);
  const fleets = fleetEpoch(sim);
  const l = lastBombing.get(st);
  if (l && l.tick === st.tick && l.gen === gen && l.geo === geo && l.battles === battles && l.fleets === fleets) return l.map.get(pid) ?? 0;
  const map = bombingMap(sim);
  lastBombing.set(st, { tick: st.tick, gen, geo, battles, fleets, map });
  return map.get(pid) ?? 0;
}

/** Industry lost in a province to enemy bombing this month (0–0.6). */
export function bombingLoss(sim: Sim, pid: ProvinceId): number {
  const owner = sim.state.provinces[pid].owner;
  if (!owner) return 0;
  const b = bombingPower(sim, pid);
  return b > 0 ? Math.min(C.air.bombIndustryMax, C.air.bombIndustry * b) : 0;
}

/** A port under enough bombing builds no ships and repairs at half rate. */
export function portBombed(sim: Sim, pid: ProvinceId): boolean {
  return bombingPower(sim, pid) >= C.air.bombPort;
}

// ───────────────────────────── Weekly air phase ─────────────────────────────

interface Sortie {
  flew: boolean;
  kills: number;
  hits: number;
  lost: number;
  note: string;
}
/** Sea missions flown in this week's naval phase, read by the air phase (never saved: a week is never split by a save). */
const seaSorties = new WeakMap<object, { tick: number; by: Map<WingId, Sortie> }>();
/** Fleets struck from the air this week with no air cover of their own: their guns are out-ranged in this week's surface battle. */
const outranged = new WeakMap<object, { tick: number; fleets: Set<FleetId> }>();

/** Was this fleet struck from the air this week while the enemy held the sky over it? */
export function outrangedThisWeek(sim: Sim, fid: FleetId): boolean {
  const o = outranged.get(sim.state);
  return !!o && o.tick === sim.state.tick && o.fleets.has(fid);
}

function seaSortiesOf(sim: Sim): Map<WingId, Sortie> {
  const st = sim.state;
  let s = seaSorties.get(st);
  if (!s || s.tick !== st.tick) seaSorties.set(st, (s = { tick: st.tick, by: new Map() }));
  return s.by;
}

/** Fighters on patrol by place, each with its air value (for interception and credit). */
function patrols(sim: Sim): Map<string, Array<[AirWing, number]>> {
  return airCached(sim, 'patrols', '', () => {
    const out = new Map<string, Array<[AirWing, number]>>();
    for (const id of Object.keys(sim.state.wings).sort()) {
      const w = sim.state.wings[id];
      if (w.mission !== 'superiority') continue;
      const s = wingStatus(sim, w);
      if (s.state !== 'flying') continue;
      const v = WINGS[w.type].air * s.eff;
      for (const c of wingCells(sim, w)) (out.get(c) ?? out.set(c, []).get(c)!).push([w, v]);
    }
    return out;
  });
}

/** Intercepting fighters over the place a wing flies in, and our cover there: the strength it loses. */
function interception(sim: Sim, w: AirWing, cells: string[], eff: number): { loss: number; cell: string | null; theirs: number } {
  let worst = 0;
  let at: string | null = null;
  let enemy = 0;
  const pat = patrols(sim);
  for (const c of cells) {
    // nobody patrols here: nothing to intercept us
    if (!pat.has(c)) continue;
    const place: Place = c[0] === 'p' ? { prov: c.slice(2) } : { zone: c.slice(2) };
    const b = airBalance(sim, place, w.nation);
    if (b.theirFighters <= 0) continue;
    // our fighters (this one too) engage theirs; the rest of our aircraft hide behind them
    const p = b.theirFighters / (b.theirFighters + b.ourFighters + 0.5);
    if (p > worst) (worst = p), (at = c), (enemy = b.theirFighters);
  }
  if (!at) return { loss: 0, cell: null, theirs: 0 };
  const defence = Math.max(0.2, 1 + nationMods(sim, w.nation).airAttack + commanderMod(sim, w.id, 'airAttack'));
  void eff;
  return { loss: (C.air.combatLoss * worst * WINGS[w.type].vulnerability) / defence, cell: at, theirs: enemy };
}

/** Credits shot-down strength to the enemy fighters patrolling a place. */
function creditKills(sim: Sim, cell: string, victim: NationId, lost: number, kills: Map<WingId, number>): void {
  let total = 0;
  const shooters: Array<[AirWing, number]> = [];
  for (const [w, v] of patrols(sim).get(cell) ?? []) {
    if (!atWar(sim, w.nation, victim)) continue;
    shooters.push([w, v]);
    total += v;
  }
  for (const [w, v] of shooters) kills.set(w.id, (kills.get(w.id) ?? 0) + (lost * v) / Math.max(1e-9, total));
}

/**
 * The sea missions, in the naval phase after fleets move and before surface
 * battles: air cover, patrols and naval strikes, zone by zone.
 */
export function seaAir(sim: Sim): Fleet[] {
  const st = sim.state;
  const ids = Object.keys(st.wings).sort();
  if (!ids.length) return [];
  const sorties = seaSortiesOf(sim);
  const flying: AirWing[] = [];
  for (const id of ids) {
    const w = st.wings[id];
    if (!seaMission(w)) continue;
    if (wingStatus(sim, w).state === 'flying') flying.push(w);
  }
  if (!flying.length) return [];
  const losses = new Map<WingId, number>();
  const kills = new Map<WingId, number>();
  const notes = new Map<WingId, string>();
  const hitsBy = new Map<WingId, number>();
  // interception over each zone
  for (const w of flying) {
    const s = wingStatus(sim, w);
    const cells = wingCells(sim, w);
    const i = interception(sim, w, cells, s.eff);
    if (i.loss > 0 && i.cell) {
      losses.set(w.id, (losses.get(w.id) ?? 0) + i.loss);
      creditKills(sim, i.cell, w.nation, i.loss, kills);
    }
  }
  // naval strikes, by zone and striking realm
  const strikes = new Map<string, AirWing[]>();
  for (const w of flying) {
    if (w.mission !== 'naval') continue;
    const z = missionPlace(sim, w)!.zone!;
    const k = `${z}|${w.nation}`;
    (strikes.get(k) ?? strikes.set(k, []).get(k)!).push(w);
  }
  const touched = new Set<Fleet>();
  for (const k of [...strikes.keys()].sort()) {
    const [zone, nid] = k.split('|');
    const group = strikes.get(k)!;
    const targets = fleetsIn(sim, zone).filter((f) => atWar(sim, nid, f.nation) && f.ships.length);
    if (!targets.length) {
      for (const w of group) notes.set(w.id, `Searched ${zoneName(sim, zone)}: no enemy ships there.`);
      continue;
    }
    const patrol = airBalanceRecon(sim, zone, nid);
    if (!patrol && !chance(st.rng, C.air.detect)) {
      for (const w of group) notes.set(w.id, `Searched ${zoneName(sim, zone)} but did not find the enemy ships (a reconnaissance patrol there always finds them).`);
      continue;
    }
    const ctl = airControl(sim, { zone }, nid);
    let raw = 0;
    const share = new Map<WingId, number>();
    for (const w of group) {
      const s = wingStatus(sim, w);
      const m = nationMods(sim, nid);
      const v = WINGS[w.type].naval * s.eff * Math.max(0.2, 1 + m.airAttack + commanderMod(sim, w.id, 'airAttack')) * (w.carrier ? Math.max(0.2, 1 + m.carrierAir + commanderMod(sim, w.id, 'carrierAir')) : 1);
      share.set(w.id, v);
      raw += v;
    }
    const power = raw * controlFactor(ctl) * C.air.navalStrike;
    // anti-aircraft fire of the ships attacked
    let aa = 0;
    for (const f of targets) for (const s of f.ships) aa += SHIPS[s.type].aa * (s.hp / 100);
    const through = power * (C.naval.aaScale / (C.naval.aaScale + aa));
    const live: Ship[] = targets.flatMap((f) => f.ships);
    const escorts = live.filter((s) => s.type === 'screen' || s.type === 'cruiser').length;
    const valuables = live.filter((s) => s.type === 'transport' || s.type === 'carrier').length;
    const screened = escorts > 0 && escorts >= valuables;
    const weighted = live
      .filter((s) => s.type !== 'submarine' || patrol)
      .map((s) => {
        let wgt = Math.sqrt(SHIPS[s.type].hull);
        if (s.type === 'capital' || s.type === 'carrier') wgt *= 2;
        if (s.type === 'transport') wgt *= 1.5;
        if (s.type === 'submarine') wgt *= 0.5;
        if (screened && (s.type === 'transport' || s.type === 'carrier')) wgt *= 0.5;
        return { s, w: wgt };
      });
    let sum = 0;
    for (const t of weighted) sum += t.w;
    const roll = range(st.rng, C.combat.rollMin, C.combat.rollMax);
    let dealt = 0;
    let sunkBefore = 0;
    for (const t of weighted) {
      const dmg = (through * C.naval.damage * roll * (t.w / Math.max(1e-9, sum))) / SHIPS[t.s.type].hull;
      const real = Math.min(t.s.hp, dmg);
      t.s.hp = Math.max(0, t.s.hp - dmg);
      dealt += real;
      if (t.s.hp <= 0.5) sunkBefore++;
    }
    for (const f of targets) touched.add(f);
    // a fleet struck while the enemy holds the sky over it fights this week's surface battle out-ranged
    let o = outranged.get(st);
    if (!o || o.tick !== st.tick) outranged.set(st, (o = { tick: st.tick, fleets: new Set() }));
    for (const f of targets) if (airControl(sim, { zone }, f.nation) === 'theirs') o.fleets.add(f.id);
    // strike aircraft lose strength to the ships' anti-aircraft fire
    const aaLoss = Math.min(C.air.aaLossMax, C.air.aaLoss * aa);
    for (const w of group) {
      losses.set(w.id, (losses.get(w.id) ?? 0) + aaLoss * WINGS[w.type].vulnerability);
      hitsBy.set(w.id, (hitsBy.get(w.id) ?? 0) + (dealt * share.get(w.id)!) / Math.max(1e-9, raw));
      notes.set(w.id, `Struck ${targets.length === 1 ? targets[0].name : `${targets.length} enemy fleets`} in ${zoneName(sim, zone)}: ${Math.round(dealt)} hull damage${sunkBefore ? `, ${sunkBefore} ship${sunkBefore === 1 ? '' : 's'} sunk` : ''}${ctl === 'theirs' ? ' (the enemy holds the sky)' : ''}.`);
    }
    st.nations[nid].stats.navalStrikeHits += dealt / 100;
    for (const f of targets) {
      const lost = f.ships.filter((s) => s.hp <= 0.5).length;
      reportFleet(sim, f, `Attacked by ${sim.world.nationDefs[nid].short} aircraft in ${zoneName(sim, zone)}${lost ? `: ${lost} ship${lost === 1 ? '' : 's'} sunk` : ''}.`);
      notify(sim, f.nation, lost ? 'urgent' : 'normal', 'navy', `Enemy aircraft of ${sim.world.nationDefs[nid].short} struck ${f.name} in ${zoneName(sim, zone)}${lost ? `: ${lost} ship${lost === 1 ? '' : 's'} sunk` : ''}.`);
    }
  }
  // sea patrols and air cover: a line each
  for (const w of flying) {
    if (notes.has(w.id)) continue;
    const z = missionPlace(sim, w)!.zone!;
    const k = kills.get(w.id) ?? 0;
    notes.set(w.id, w.mission === 'superiority' ? (k > 0 ? `Air cover over ${zoneName(sim, z)}: shot down ${Math.round(k)}% of an enemy wing.` : `Air cover over ${zoneName(sim, z)}: no enemy aircraft came.`) : `Patrolled ${zoneName(sim, z)}: ships there are found and submarines exposed.`);
  }
  for (const w of flying) sorties.set(w.id, { flew: true, kills: kills.get(w.id) ?? 0, hits: hitsBy.get(w.id) ?? 0, lost: losses.get(w.id) ?? 0, note: notes.get(w.id) ?? '' });
  applyLosses(sim, losses, kills);
  // the fleets struck: naval.ts removes the ships sunk (troops aboard drown, carriers' air groups relocate)
  return [...touched];
}

/** A reconnaissance patrol of ours (or a friend's) over a zone. */
function airBalanceRecon(sim: Sim, zone: ZoneId, nid: NationId): boolean {
  const m = cellMap(sim).get(`z:${zone}`);
  if (!m) return false;
  for (const [n, a] of m) if (a.recon > 0 && (n === nid || (isFriendly(sim, nid, n) && !atWar(sim, nid, n)))) return true;
  return false;
}

/** Enemy submarines in a zone are exposed (a patrol of `nid`'s side flies over it). */
export function subsExposed(sim: Sim, zone: ZoneId, nid: NationId): boolean {
  return airBalanceRecon(sim, zone, nid);
}

/** Adds a line to a fleet's report for this week. */
export function reportFleet(sim: Sim, f: Fleet, note: string): void {
  const tick = sim.state.tick;
  if (!f.report || f.report.tick !== tick) f.report = { tick, notes: [] };
  if (f.report.notes.length < 6) f.report.notes.push(note);
}

/** Applies strength lost and kills: wings below 5 are shot out of the sky. */
function applyLosses(sim: Sim, losses: Map<WingId, number>, kills: Map<WingId, number>): void {
  const st = sim.state;
  for (const [id, k] of kills) {
    const w = st.wings[id];
    if (w) st.nations[w.nation].stats.airKills += k / 100;
  }
  for (const id of [...losses.keys()].sort()) {
    const w = st.wings[id];
    if (!w) continue;
    noteOpLoss(sim, w.op, 'wings', Math.min(w.strength, losses.get(id)!));
    w.strength = Math.max(0, w.strength - losses.get(id)!);
    if (w.strength < 5) {
      const where = placeName(sim, missionPlace(sim, w));
      notify(sim, w.nation, 'normal', 'air', `${w.name} was shot out of the sky over ${where}.`, w.target ? { province: w.target } : undefined);
      delete st.wings[id];
    }
  }
  touchWings(sim);
}

/** The weekly air phase (after movement and battle contact, before the battle round). */
export function weeklyAir(sim: Sim): void {
  const st = sim.state;
  const ids = Object.keys(st.wings).sort();
  if (!ids.length) return;
  // bases, missions and losses change below: the index is rebuilt when next asked for
  touchWings(sim);
  // lost airfields: rebase within ferry range, else the wing is gone
  for (const id of ids) {
    const w = st.wings[id];
    if (w.carrier) {
      if (!st.fleets[w.carrier]) relocateAir(sim, w.carrier);
      continue;
    }
    const b = st.provinces[w.base];
    if (b.controller === w.nation && b.owner === w.nation && b.airfield > 0) continue;
    const field = fieldsNear(sim, w, { prov: w.base }, w.base)[0];
    if (field) {
      notify(sim, w.nation, 'normal', 'air', `${w.name} lost its airfield at ${provName(sim, w.base)} and flew to ${provName(sim, field)}.`, { province: field });
      w.base = field;
      w.strength = Math.max(10, w.strength - 20);
      w.readiness = Math.max(0, w.readiness - C.air.rebase);
    } else {
      notify(sim, w.nation, 'normal', 'air', `${w.name} was lost with its airfield at ${provName(sim, w.base)}: no airfield of ours within reach.`, { province: w.base });
      delete st.wings[id];
    }
  }
  touchWings(sim);
  // bombing a province no longer held by an enemy ends (peace, or the province fell to us)
  for (const id of Object.keys(st.wings).sort()) {
    const w = st.wings[id];
    if (w.mission !== 'bombing' || !w.target) continue;
    const c = st.provinces[w.target].controller;
    if (c && atWar(sim, w.nation, c)) continue;
    w.report = { tick: st.tick, flew: false, note: `Bombing of ${provName(sim, w.target)} ended: it is no longer held by an enemy.`, kills: 0, hits: 0, lost: 0 };
    w.mission = 'idle';
    w.target = null;
  }
  touchWings(sim);
  // land missions: who flies, and what they meet
  const losses = new Map<WingId, number>();
  const kills = new Map<WingId, number>();
  const flew = new Set<WingId>();
  const land: AirWing[] = [];
  for (const id of Object.keys(st.wings).sort()) {
    const w = st.wings[id];
    if (seaMission(w)) continue;
    const s = wingStatus(sim, w);
    if (s.state !== 'flying') continue;
    land.push(w);
    flew.add(w.id);
    const cells = wingCells(sim, w);
    const i = interception(sim, w, cells, s.eff);
    let loss = i.loss;
    if (i.loss > 0 && i.cell) creditKills(sim, i.cell, w.nation, i.loss, kills);
    // flak over enemy forts; ground fire over the battle supported; anti-aircraft
    // batteries and mobile guns where it flies (airborne.ts)
    if (w.mission === 'bombing' || w.mission === 'interdiction') {
      const p = st.provinces[w.target!];
      if (p.controller && atWar(sim, w.nation, p.controller) && p.fort > 0) loss += C.air.flak * p.fort * Math.max(0.2, 1 + nationMods(sim, p.controller).airDefence);
      loss += C.air.aaPer * aaAgainst(sim, w.target!, w.nation).total * WINGS[w.type].vulnerability;
    }
    if (w.mission === 'support') {
      const b = supportBattle(sim, w);
      const enemy = b ? (friendlySide(sim, b, w.nation) === 'att' ? b.defenderNations : b.attackerNations)[0] : null;
      loss += C.air.groundFire * (enemy ? Math.max(0.2, 1 + nationMods(sim, enemy).airDefence) : 1);
      if (b) loss += C.air.aaPer * aaAgainst(sim, b.province, w.nation).total * WINGS[w.type].vulnerability;
    }
    if (loss > 0) losses.set(w.id, loss);
    st.nations[w.nation].stats.airMissionWeeks++;
    if (w.mission === 'bombing') st.nations[w.nation].stats.bombingWeeks++;
    if (w.mission === 'support') st.nations[w.nation].stats.supportWeeks++;
  }
  // what the land missions achieved this week (before the losses change the sky)
  const notes = new Map<WingId, string>();
  for (const w of land) notes.set(w.id, landNote(sim, w, kills));
  const bombedFields: Array<[ProvinceId, number]> = [];
  for (const w of land) if (w.mission === 'bombing' && st.provinces[w.target!].airfield > 0) bombedFields.push([w.target!, bombingPower(sim, w.target!)]);
  const sea = seaSortiesOf(sim);
  for (const id of sea.keys()) {
    flew.add(id);
    const w = st.wings[id];
    if (w) st.nations[w.nation].stats.airMissionWeeks++;
  }
  applyLosses(sim, losses, kills);
  // aircraft caught on a bombed airfield are grounded for a while
  for (const [pid, power] of bombedFields) {
    if (power <= 0) continue;
    for (const w of wingsAt(sim, pid)) w.readiness = Math.max(0, w.readiness - C.air.bombAirfield * power);
  }
  // readiness and replacements; this week's report
  for (const id of Object.keys(st.wings).sort()) {
    const w = st.wings[id];
    const n = st.nations[w.nation];
    const didFly = flew.has(id);
    const recover = shortOfOil(sim, w.nation) ? 0 : C.air.recover * (1 - w.readiness / 100);
    w.readiness = Math.max(0, Math.min(100, w.readiness + recover - (didFly ? C.air.wear : 0)));
    const lostNow = losses.get(id) ?? sea.get(id)?.lost ?? 0;
    // strength comes back at a quiet base (a carrier: off a friendly port), paid in materiel
    if (w.strength < 100 && lostNow <= 0 && atHomeBase(sim, w)) {
      const gain = Math.min(C.air.replenish, 100 - w.strength);
      const cost = gain * C.air.replenishMateriel;
      if (n.materiel >= cost) {
        n.materiel -= cost;
        w.strength += gain;
      }
    }
    const s = sea.get(id);
    const k = kills.get(id) ?? s?.kills ?? 0;
    if (s) w.report = { tick: st.tick, flew: true, note: s.note, kills: k, hits: s.hits, lost: s.lost };
    else if (didFly) w.report = { tick: st.tick, flew: true, note: notes.get(id) ?? '', kills: k, hits: 0, lost: lostNow };
    else if (!w.report || w.report.tick !== st.tick) w.report = { tick: st.tick, flew: false, note: wingStatus(sim, w).reason, kills: 0, hits: 0, lost: 0 };
    // its service so far (format 7): weeks flown, what it shot down and hit, what it lost
    if (w.report.tick === st.tick && w.report.flew) {
      const r = (w.record ??= { weeks: 0, kills: 0, hits: 0, lost: 0 });
      r.weeks++;
      r.kills += w.report.kills;
      r.hits += w.report.hits;
      r.lost += w.report.lost;
    }
  }
  touchWings(sim);
}

/** Can a wing replace losses where it is? At its airfield always; aboard a carrier only off a friendly port. */
function atHomeBase(sim: Sim, w: AirWing): boolean {
  if (!w.carrier) return true;
  const f = sim.state.fleets[w.carrier];
  if (!f) return false;
  for (const pid of sim.world.zones[f.zone]?.coasts ?? []) {
    const p = sim.state.provinces[pid];
    if (p.port > 0 && p.owner === p.controller && p.controller && isFriendly(sim, w.nation, p.controller)) return true;
  }
  return false;
}

/** One line on what a land mission did this week. */
function landNote(sim: Sim, w: AirWing, kills: Map<WingId, number>): string {
  const st = sim.state;
  const where = provName(sim, w.target!);
  const k = kills.get(w.id) ?? 0;
  const ctl = airControl(sim, { prov: w.target! }, w.nation);
  const sky = ctl === 'theirs' ? ' (the enemy holds the sky)' : ctl === 'contested' ? ' (contested sky)' : '';
  switch (w.mission) {
    case 'superiority': {
      const b = airBalance(sim, { prov: w.target! }, w.nation);
      if (b.theirs <= 0) return `Patrolled over ${where}: no enemy aircraft came.`;
      return `Fought for the sky over ${where}${k > 0 ? `: shot down ${Math.round(k)}% of an enemy wing` : ''}${ctl === 'ours' ? '; we hold it' : ctl === 'theirs' ? '; the enemy holds it' : '; contested'}.`;
    }
    case 'support': {
      const b = supportBattle(sim, w);
      return b ? `Supported the battle of ${provName(sim, b.province)}${sky}.` : `On call over ${where}.`;
    }
    case 'interdiction': {
      let armies = 0;
      for (const pid of missionArea(sim, w)) for (const a of armiesIn(sim, pid)) if (atWar(sim, w.nation, a.nation)) armies++;
      return armies ? `Interdicted ${armies} enemy arm${armies === 1 ? 'y' : 'ies'} around ${where}${sky}.` : `Flew over ${where}: no enemy armies in the area to interdict.`;
    }
    case 'bombing': {
      const p = st.provinces[w.target!];
      const parts: string[] = [];
      const loss = bombingLoss(sim, w.target!);
      if (p.factories > 0) parts.push(`factories −${Math.round(loss * 100)}%`);
      if (p.port > 0 && portBombed(sim, w.target!)) parts.push('shipyard halted, repairs halved');
      if (p.airfield > 0 && wingsAt(sim, w.target!).length) parts.push(`${wingsAt(sim, w.target!).length} enemy wing${wingsAt(sim, w.target!).length === 1 ? '' : 's'} grounded on the airfield`);
      return `Bombed ${where}${parts.length ? `: ${parts.join('; ')}` : ': no factories, port or airfield there to hit'}${sky}.`;
    }
    case 'recon':
      return `Spotted over ${where}: our battles there fire harder, our strikes there hit harder.`;
    default:
      return '';
  }
}

// ───────────────────────────── Upkeep and fuel ──────────────────────────────

export function airUpkeep(sim: Sim, nid: NationId): number {
  let u = 0;
  for (const w of wingIndex(sim).byNation.get(nid) ?? []) u += WINGS[w.type].upkeep;
  return u * Math.max(0.2, 1 + nationMods(sim, nid).airUpkeep);
}

export function airFuel(sim: Sim, nid: NationId): number {
  let f = 0;
  for (const w of wingIndex(sim).byNation.get(nid) ?? []) f += WINGS[w.type].fuel * (w.mission === 'idle' ? 0.3 : 1);
  return f;
}

export function removeAir(sim: Sim, nid: NationId): void {
  for (const [id, w] of Object.entries(sim.state.wings)) if (w.nation === nid) delete sim.state.wings[id];
  touchWings(sim);
  for (const pid of sim.world.provIds) {
    const p = sim.state.provinces[pid];
    p.hangar = p.hangar.filter((o) => o.nation !== nid);
  }
}

/** The zone a carrier wing's mission covers by default (its fleet's), for labels. */
export function fleetCoverZone(sim: Sim, w: AirWing): ZoneId | null {
  const f = w.carrier ? sim.state.fleets[w.carrier] : undefined;
  return f ? f.zone : null;
}

export const AIR_TYPES = WING_TYPES;
