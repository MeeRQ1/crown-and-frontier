// Air power: airfields, air wings and their missions.
//
// A wing flies from an airfield (a province project, level 1–2, two wings per
// level) over a target province within its range (province hops). Missions
// cover the target and its neighbours (bombing: the target only):
// - superiority (fighters): air combat value over the area;
// - support (fighters, ground attack): + firepower for our side in battles there;
// - interdiction (ground attack, bombers): enemy armies there lose supply and speed;
// - bombing (bombers): factories in the target lose output each month;
// - recon (reconnaissance): +5% fire for our battles there.
//
// Each week, wings over an area where the enemy also flies lose strength in
// proportion to the enemy's air power (air combat); bombers over fortified
// provinces also lose strength to flak. A side with 1.5 times the enemy's air
// power over a province holds air superiority there: the enemy's support and
// interdiction drop to 40%. Wings at a quiet base regain 8 strength a week,
// paid in materiel. Losing the base forces a wing to rebase (or it is lost).

import { C, WINGS, WING_TYPES } from './config';
import { memoize } from './index';
import { nationMods } from './modifiers';
import { atWar, isFriendly, notify, provName, type Sim } from './state';
import type { AirMission, AirWing, NationId, ProvinceId, StrategicResource, WingId, WingType } from './types';

export const MISSION_LABELS: Record<AirMission, string> = {
  idle: 'Idle',
  superiority: 'Air superiority',
  support: 'Ground support',
  interdiction: 'Interdiction',
  bombing: 'Strategic bombing',
  recon: 'Reconnaissance',
};

const airGen = new WeakMap<object, number>();

/** Call after a wing is added, removed, rebased or given a mission: keeps the wing index exact. */
export function touchWings(sim: Sim): void {
  airGen.set(sim.state, (airGen.get(sim.state) ?? 0) + 1);
}

interface WingIndex {
  gen: number;
  count: number;
  byNation: Map<NationId, AirWing[]>;
  byBase: Map<ProvinceId, AirWing[]>;
  /** wings on bombing missions, by target */
  bombing: Map<ProvinceId, AirWing[]>;
}
const wingIdx = new WeakMap<object, WingIndex>();

/** Wings by realm, base and bombing target, each list in id order. */
function wingIndex(sim: Sim): WingIndex {
  const st = sim.state;
  const gen = airGen.get(st) ?? 0;
  const ids = Object.keys(st.wings);
  const hit = wingIdx.get(st);
  // the count also catches wings added or removed without touchWings (tests editing state directly)
  if (hit && hit.gen === gen && hit.count === ids.length) return hit;
  const x: WingIndex = { gen, count: ids.length, byNation: new Map(), byBase: new Map(), bombing: new Map() };
  for (const id of ids.sort()) {
    const w = st.wings[id];
    (x.byNation.get(w.nation) ?? x.byNation.set(w.nation, []).get(w.nation)!).push(w);
    (x.byBase.get(w.base) ?? x.byBase.set(w.base, []).get(w.base)!).push(w);
    if (w.mission === 'bombing' && w.target) (x.bombing.get(w.target) ?? x.bombing.set(w.target, []).get(w.target)!).push(w);
  }
  wingIdx.set(st, x);
  return x;
}

export function wingsOf(sim: Sim, nid: NationId): AirWing[] {
  return [...(wingIndex(sim).byNation.get(nid) ?? [])];
}

export function wingsAt(sim: Sim, pid: ProvinceId): AirWing[] {
  return [...(wingIndex(sim).byBase.get(pid) ?? [])];
}

export function wingRange(sim: Sim, w: Pick<AirWing, 'nation' | 'type'>): number {
  return WINGS[w.type].range + nationMods(sim, w.nation).airRange;
}

export function inRange(sim: Sim, w: Pick<AirWing, 'nation' | 'type' | 'base'>, target: ProvinceId): boolean {
  const d = sim.world.hop(w.base, target);
  return d !== undefined && d <= wingRange(sim, w);
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
  const w: AirWing = { id, nation: nid, name: `${sim.world.nationDefs[nid].adjective} ${WINGS[type].label} ${count}`, type, base, strength: 100, mission: 'idle', target: null };
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
      createWing(sim, o.nation, pid, o.wing);
      st.nations[o.nation].stats.wingsBuilt++;
      notify(sim, o.nation, 'low', 'air', `A new ${WINGS[o.wing].label.toLowerCase()} is ready at ${provName(sim, pid)}.`, { province: pid });
    }
  }
}

// ───────────────────────────── Missions ─────────────────────────────────────

export function missionProblem(sim: Sim, nid: NationId, wingId: WingId, mission: AirMission, target: ProvinceId | null): string | null {
  const w = sim.state.wings[wingId];
  if (!w || w.nation !== nid) return 'Not our air wing.';
  if (mission === 'idle') return null;
  if (!(WINGS[w.type].missions as string[]).includes(mission)) return `${WINGS[w.type].plural} cannot fly ${MISSION_LABELS[mission].toLowerCase()}.`;
  if (!target || !sim.state.provinces[target]) return 'Choose a target province.';
  if (!inRange(sim, w, target)) return `${provName(sim, target)} is out of range (${wingRange(sim, w)} provinces from ${provName(sim, w.base)}).`;
  if (mission === 'bombing') {
    const c = sim.state.provinces[target].controller;
    if (!c || !atWar(sim, nid, c)) return 'Bombing needs an enemy-held target.';
  }
  return null;
}

export function rebaseProblem(sim: Sim, nid: NationId, wingId: WingId, base: ProvinceId): string | null {
  const w = sim.state.wings[wingId];
  if (!w || w.nation !== nid) return 'Not our air wing.';
  const p = sim.state.provinces[base];
  if (!p) return 'Unknown province.';
  if (base === w.base) return 'The wing is already based there.';
  if (p.airfield < 1 || p.controller !== nid) return 'Wings can rebase only to airfields we hold.';
  if (airfieldRoom(sim, base) <= 0) return 'That airfield is full.';
  return null;
}

/** A wing is busy over its target (a mission other than idle with a target in range). */
export function activeMission(sim: Sim, w: AirWing): boolean {
  return w.mission !== 'idle' && !!w.target && inRange(sim, w, w.target) && w.strength > 0;
}

// ───────────────────────────── Air situation ────────────────────────────────

export interface AirPresence {
  /** air combat power (fighters on superiority or support, everyone's own defence) */
  air: number;
  /** ground-support power */
  support: number;
  interdiction: number;
  recon: number;
}

const ZERO: AirPresence = { air: 0, support: 0, interdiction: 0, recon: 0 };

/** Air presence by province and realm, for the current week (derived, never saved). */
function airMap(sim: Sim): Map<ProvinceId, Map<NationId, AirPresence>> {
  return memoize(sim, 'airMap', '', () => {
    const out = new Map<ProvinceId, Map<NationId, AirPresence>>();
    const add = (pid: ProvinceId, nid: NationId, k: keyof AirPresence, v: number) => {
      const m = out.get(pid) ?? out.set(pid, new Map()).get(pid)!;
      const a = m.get(nid) ?? m.set(nid, { air: 0, support: 0, interdiction: 0, recon: 0 }).get(nid)!;
      a[k] += v;
    };
    for (const id of Object.keys(sim.state.wings).sort()) {
      const w = sim.state.wings[id];
      if (!activeMission(sim, w)) continue;
      const r = WINGS[w.type];
      const q = w.strength / 100;
      const m = nationMods(sim, w.nation);
      const airMul = Math.max(0.2, 1 + m.airAttack);
      const area = w.mission === 'bombing' ? [w.target!] : [w.target!, ...sim.world.prov[w.target!].neighbors];
      for (const pid of area) {
        add(pid, w.nation, 'air', r.air * q * airMul * (w.mission === 'superiority' ? 1 : 0.5));
        if (w.mission === 'support') add(pid, w.nation, 'support', r.ground * q * airMul);
        if (w.mission === 'interdiction') add(pid, w.nation, 'interdiction', (r.ground + r.bomb * 0.5) * q * airMul);
        if (w.mission === 'recon') add(pid, w.nation, 'recon', q);
      }
    }
    return out;
  });
}

export function airAt(sim: Sim, pid: ProvinceId, nid: NationId): AirPresence {
  return airMap(sim).get(pid)?.get(nid) ?? ZERO;
}

/** Air power of `nid`'s side and of its enemies over a province. */
export function airBalance(sim: Sim, pid: ProvinceId, nid: NationId): { ours: number; theirs: number } {
  let ours = 0;
  let theirs = 0;
  const m = airMap(sim).get(pid);
  if (!m) return { ours, theirs };
  for (const [n, a] of m) {
    if (n === nid || (isFriendly(sim, nid, n) && !atWar(sim, nid, n))) ours += a.air;
    else if (atWar(sim, nid, n)) theirs += a.air;
  }
  return { ours, theirs };
}

/** Who holds the sky over a province, from `nid`'s view. */
export function airControl(sim: Sim, pid: ProvinceId, nid: NationId): 'ours' | 'theirs' | 'contested' | 'none' {
  const { ours, theirs } = airBalance(sim, pid, nid);
  if (ours <= 0 && theirs <= 0) return 'none';
  if (ours > 0 && ours >= theirs * C.air.superiority) return 'ours';
  if (theirs > 0 && theirs >= ours * C.air.superiority) return 'theirs';
  return 'contested';
}

/** Firepower bonus from the air for a side of `nations` fighting in a province, with its notes. */
export function airCombatBonus(sim: Sim, pid: ProvinceId, nations: NationId[]): { mul: number; notes: string[] } {
  if (!nations.length || !Object.keys(sim.state.wings).length) return { mul: 1, notes: [] };
  let support = 0;
  let recon = 0;
  for (const n of nations) {
    const a = airAt(sim, pid, n);
    support += a.support;
    recon += a.recon;
  }
  const notes: string[] = [];
  let mul = 1;
  if (support > 0) {
    const ctl = airControl(sim, pid, nations[0]);
    let s = Math.min(C.air.supportMax, C.air.supportPer * support);
    if (ctl === 'theirs') s *= C.air.contested;
    mul += s;
    notes.push(`Air support +${Math.round(s * 100)}%${ctl === 'theirs' ? ' (enemy holds the sky)' : ctl === 'ours' ? ' (air superiority)' : ''}`);
  }
  if (recon > 0) {
    mul += C.air.recon;
    notes.push(`Air reconnaissance +${Math.round(C.air.recon * 100)}%`);
  }
  return { mul, notes };
}

/** Enemy interdiction over an army of `nid` in a province: supply lost and movement slowed. */
export function interdiction(sim: Sim, pid: ProvinceId, nid: NationId): { supply: number; move: number } {
  if (!Object.keys(sim.state.wings).length) return { supply: 0, move: 0 };
  const m = airMap(sim).get(pid);
  if (!m) return { supply: 0, move: 0 };
  let power = 0;
  for (const [n, a] of m) if (atWar(sim, nid, n)) power += a.interdiction;
  if (power <= 0) return { supply: 0, move: 0 };
  if (airControl(sim, pid, nid) === 'ours') power *= C.air.contested;
  return { supply: Math.min(C.air.interdictSupplyMax, C.air.interdictSupply * power), move: Math.min(C.air.interdictMoveMax, C.air.interdictMove * power) };
}

/** Industry lost in a province to enemy bombing this month (0–0.6). */
export function bombingLoss(sim: Sim, pid: ProvinceId): number {
  const owner = sim.state.provinces[pid].owner;
  if (!owner || !Object.keys(sim.state.wings).length) return 0;
  const idx = wingIndex(sim);
  const here = idx.bombing.get(pid);
  if (!here) return 0;
  return memoize(sim, 'bombingLoss', `${pid}|${idx.gen}`, () => {
    let bomb = 0;
    for (const w of here) {
      if (!activeMission(sim, w) || !atWar(sim, w.nation, owner)) continue;
      bomb += WINGS[w.type].bomb * (w.strength / 100) * Math.max(0.2, 1 + nationMods(sim, w.nation).airAttack);
    }
    if (bomb <= 0) return 0;
    bomb *= Math.max(0.1, 1 - nationMods(sim, owner).airDefence);
    return Math.min(C.air.bombIndustryMax, C.air.bombIndustry * bomb);
  });
}

// ───────────────────────────── Weekly air phase ─────────────────────────────

/** The weekly air phase (after movement, before battles): rebasing, missions, air combat, flak, replenishment. */
export function weeklyAir(sim: Sim): void {
  const st = sim.state;
  const ids = Object.keys(st.wings).sort();
  if (!ids.length) return;
  // bases, missions and losses change below: the index is rebuilt when next asked for
  touchWings(sim);
  // lost bases: rebase to the nearest airfield with room, else the wing is gone
  for (const id of ids) {
    const w = st.wings[id];
    const b = st.provinces[w.base];
    if (b.controller === w.nation && b.owner === w.nation && b.airfield > 0) continue;
    const fields = sim.world.provIds.filter((pid) => st.provinces[pid].airfield > 0 && st.provinces[pid].controller === w.nation && pid !== w.base && airfieldRoom(sim, pid) > 0);
    fields.sort((a, c) => (sim.world.hop(w.base, a) ?? 99) - (sim.world.hop(w.base, c) ?? 99) || (a < c ? -1 : 1));
    if (fields.length) {
      notify(sim, w.nation, 'normal', 'air', `${w.name} lost its airfield at ${provName(sim, w.base)} and flew to ${provName(sim, fields[0])}.`, { province: fields[0] });
      w.base = fields[0];
      w.strength = Math.max(10, w.strength - 20);
      if (w.target && !inRange(sim, w, w.target)) (w.mission = 'idle'), (w.target = null);
    } else {
      notify(sim, w.nation, 'normal', 'air', `${w.name} was lost with its airfield at ${provName(sim, w.base)}.`, { province: w.base });
      delete st.wings[id];
    }
  }
  // missions out of range or against a former enemy fall idle
  for (const id of Object.keys(st.wings).sort()) {
    const w = st.wings[id];
    if (w.mission === 'idle') continue;
    if (!w.target || !inRange(sim, w, w.target)) (w.mission = 'idle'), (w.target = null);
    else if (w.mission === 'bombing') {
      const c = st.provinces[w.target].controller;
      if (!c || !atWar(sim, w.nation, c)) (w.mission = 'idle'), (w.target = null);
    }
  }
  // air combat and flak: each active wing loses strength to the enemy air over its area
  const losses = new Map<string, number>();
  for (const id of Object.keys(st.wings).sort()) {
    const w = st.wings[id];
    if (!activeMission(sim, w)) continue;
    const area = w.mission === 'bombing' ? [w.target!] : [w.target!, ...sim.world.prov[w.target!].neighbors];
    let theirs = 0;
    let ours = 0;
    for (const pid of area) {
      const b = airBalance(sim, pid, w.nation);
      if (b.theirs > theirs) (theirs = b.theirs), (ours = b.ours);
    }
    let loss = 0;
    if (theirs > 0) loss += (C.air.combatLoss * theirs) / (theirs + ours + 0.5) * (w.type === 'fighter' ? 0.7 : 1.2);
    if (w.mission === 'bombing' || w.mission === 'interdiction') {
      const p = st.provinces[w.target!];
      if (p.controller && atWar(sim, w.nation, p.controller)) loss += C.air.flak * p.fort * Math.max(0.2, 1 + nationMods(sim, p.controller).airDefence);
    }
    if (loss > 0) losses.set(id, loss);
    st.nations[w.nation].stats.airMissionWeeks++;
    if (w.mission === 'bombing') st.nations[w.nation].stats.bombingWeeks++;
  }
  for (const [id, loss] of losses) {
    const w = st.wings[id];
    w.strength = Math.max(0, w.strength - loss);
    if (w.strength < 5) {
      notify(sim, w.nation, 'normal', 'air', `${w.name} was shot out of the sky over ${provName(sim, w.target ?? w.base)}.`, { province: w.target ?? w.base });
      delete st.wings[id];
    }
  }
  // replenishment at quiet bases
  for (const id of Object.keys(st.wings).sort()) {
    const w = st.wings[id];
    if (w.strength >= 100 || losses.has(id)) continue;
    const n = st.nations[w.nation];
    const gain = Math.min(C.air.replenish, 100 - w.strength);
    const cost = gain * C.air.replenishMateriel;
    if (n.materiel < cost) continue;
    n.materiel -= cost;
    w.strength += gain;
  }
}

// ───────────────────────────── Upkeep and fuel ──────────────────────────────

export function airUpkeep(sim: Sim, nid: NationId): number {
  let u = 0;
  for (const w of Object.values(sim.state.wings)) if (w.nation === nid) u += WINGS[w.type].upkeep;
  return u;
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

export const AIR_TYPES = WING_TYPES;
