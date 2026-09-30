// Core state access helpers shared by all simulation modules.

import { C } from './config';
import type {
  Army,
  ArmyId,
  GameState,
  NationId,
  NationState,
  Notification,
  ProvinceId,
  ProvinceState,
  TreatyType,
  War,
  World,
} from './types';

export interface Sim {
  world: World;
  state: GameState;
}

export const WEEKS_PER_MONTH = C.time.weeksPerMonth;
export const WEEKS_PER_YEAR = C.time.weeksPerMonth * C.time.monthsPerYear;

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function months(n: number): number {
  return n * WEEKS_PER_MONTH;
}

export function isMonthStart(tick: number): boolean {
  return tick % WEEKS_PER_MONTH === 0;
}

export function dateOf(sim: Sim, tick = sim.state.tick) {
  const year = sim.world.scenario.startYear + Math.floor(tick / WEEKS_PER_YEAR);
  const month = Math.floor(tick / WEEKS_PER_MONTH) % C.time.monthsPerYear;
  const week = (tick % WEEKS_PER_MONTH) + 1;
  return { year, month, week, label: `Wk ${week}, ${MONTH_NAMES[month]} ${year}`, short: `${MONTH_NAMES[month]} ${year}` };
}

export function endTick(sim: Sim): number {
  return sim.state.settings.campaignYears * WEEKS_PER_YEAR;
}

export function nation(sim: Sim, id: NationId): NationState {
  return sim.state.nations[id];
}

export function prov(sim: Sim, id: ProvinceId): ProvinceState {
  return sim.state.provinces[id];
}

export function nationName(sim: Sim, id: NationId | null): string {
  if (!id) return 'Unclaimed';
  return sim.world.nationDefs[id]?.short ?? id;
}

export function provName(sim: Sim, id: ProvinceId): string {
  return sim.world.prov[id]?.name ?? id;
}

export function aliveNations(sim: Sim): NationId[] {
  return sim.world.nationIds.filter((n) => sim.state.nations[n].alive);
}

export function ownedProvinces(sim: Sim, nid: NationId): ProvinceId[] {
  return sim.world.provIds.filter((p) => sim.state.provinces[p].owner === nid);
}

export function controlledProvinces(sim: Sim, nid: NationId): ProvinceId[] {
  return sim.world.provIds.filter((p) => sim.state.provinces[p].controller === nid);
}

export function armiesOf(sim: Sim, nid: NationId): Army[] {
  const out: Army[] = [];
  for (const id in sim.state.armies) {
    const a = sim.state.armies[id];
    if (a.nation === nid) out.push(a);
  }
  return out;
}

export function armiesAt(sim: Sim, pid: ProvinceId): Army[] {
  const out: Army[] = [];
  for (const id in sim.state.armies) {
    const a = sim.state.armies[id];
    if (a.location === pid) out.push(a);
  }
  return out;
}

export function army(sim: Sim, id: ArmyId): Army | undefined {
  return sim.state.armies[id];
}

export function menOf(a: Army): number {
  let m = 0;
  for (const r of a.regiments) m += r.men;
  return m;
}

export function countType(a: Army, t: 'foot' | 'horse' | 'guns'): number {
  let c = 0;
  for (const r of a.regiments) if (r.type === t) c++;
  return c;
}

// ───────────────────────────── Diplomatic relations ─────────────────────────

export function warsOf(sim: Sim, nid: NationId): War[] {
  const out: War[] = [];
  for (const id in sim.state.wars) {
    const w = sim.state.wars[id];
    if (w.attackers.includes(nid) || w.defenders.includes(nid)) out.push(w);
  }
  return out;
}

export function sideOf(w: War, nid: NationId): 'attacker' | 'defender' | null {
  if (w.attackers.includes(nid)) return 'attacker';
  if (w.defenders.includes(nid)) return 'defender';
  return null;
}

/** Two nations are hostile when they are on opposite sides of any active war. */
export function atWar(sim: Sim, a: NationId, b: NationId): boolean {
  if (a === b) return false;
  for (const id in sim.state.wars) {
    const w = sim.state.wars[id];
    if ((w.attackers.includes(a) && w.defenders.includes(b)) || (w.defenders.includes(a) && w.attackers.includes(b))) return true;
  }
  return false;
}

export function enemiesOf(sim: Sim, nid: NationId): NationId[] {
  const s = new Set<NationId>();
  for (const w of warsOf(sim, nid)) {
    const other = w.attackers.includes(nid) ? w.defenders : w.attackers;
    for (const o of other) s.add(o);
  }
  return [...s].sort();
}

export function hasTreaty(sim: Sim, type: TreatyType, a: NationId, b: NationId): boolean {
  return sim.state.treaties.some((t) => t.type === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a)));
}

export function treatyPartners(sim: Sim, type: TreatyType, nid: NationId): NationId[] {
  const out: NationId[] = [];
  for (const t of sim.state.treaties) {
    if (t.type !== type) continue;
    if (t.a === nid) out.push(t.b);
    else if (t.b === nid) out.push(t.a);
  }
  return out.sort();
}

export function alliesOf(sim: Sim, nid: NationId): NationId[] {
  return treatyPartners(sim, 'alliance', nid);
}

export function truceUntil(sim: Sim, a: NationId, b: NationId): number {
  let u = 0;
  for (const t of sim.state.truces) if ((t.a === a && t.b === b) || (t.a === b && t.b === a)) u = Math.max(u, t.until);
  return u;
}

/** Same nation, allied, or fighting on the same side of a war. */
export function isFriendly(sim: Sim, a: NationId, b: NationId | null): boolean {
  if (!b) return false;
  if (a === b) return true;
  if (hasTreaty(sim, 'alliance', a, b)) return true;
  for (const id in sim.state.wars) {
    const w = sim.state.wars[id];
    if ((w.attackers.includes(a) && w.attackers.includes(b)) || (w.defenders.includes(a) && w.defenders.includes(b))) return true;
  }
  return false;
}

/** Marks derived caches (supply network etc.) stale after a control/diplomatic change. */
export function bump(sim: Sim): void {
  sim.state.rev++;
}

/** May armies of `nid` enter a province controlled by `ctrl` (owned by `owner`)? */
export function hasAccess(sim: Sim, nid: NationId, owner: NationId | null, ctrl: NationId | null): boolean {
  if (ctrl === nid || owner === nid) return true;
  if (ctrl === null && owner === null) return true; // unclaimed wilds are open
  if (ctrl && atWar(sim, nid, ctrl)) return true;
  if (owner && atWar(sim, nid, owner)) return true;
  if (ctrl && hasTreaty(sim, 'alliance', nid, ctrl)) return true;
  // armies of a co-belligerent may pass through each other's territory
  if (ctrl) {
    for (const w of warsOf(sim, nid)) {
      const side = sideOf(w, nid);
      if (side && sideOf(w, ctrl) === side) return true;
    }
  }
  return false;
}

export function borders(sim: Sim, a: NationId, b: NationId): boolean {
  for (const pid of sim.world.provIds) {
    if (sim.state.provinces[pid].owner !== a) continue;
    for (const n of sim.world.prov[pid].neighbors) if (sim.state.provinces[n].owner === b) return true;
  }
  return false;
}

/** Shortest hop distance between any province of a and any of b (Infinity if none). */
export function nationDistance(sim: Sim, a: NationId, b: NationId): number {
  const pa = ownedProvinces(sim, a);
  const pb = ownedProvinces(sim, b);
  let best = Infinity;
  for (const x of pa) {
    const h = sim.world.hops[x];
    for (const y of pb) {
      const d = h[y];
      if (d !== undefined && d < best) best = d;
    }
  }
  return best;
}

// ───────────────────────────── Notifications ────────────────────────────────

export function notify(
  sim: Sim,
  nid: NationId | null,
  priority: Notification['priority'],
  kind: string,
  text: string,
  extra: { province?: ProvinceId; army?: ArmyId } = {},
): void {
  const st = sim.state;
  st.counters.note++;
  st.notifications.push({ id: st.counters.note, tick: st.tick, priority, nation: nid, text, kind, ...extra });
  if (st.notifications.length > 400) st.notifications.splice(0, st.notifications.length - 400);
}

export function diag(sim: Sim, nid: NationId, layer: 'strategic' | 'operational' | 'execution', summary: string, detail?: string[]): void {
  const st = sim.state;
  st.diagnostics.push({ tick: st.tick, nation: nid, layer, summary, detail });
  if (st.diagnostics.length > C.ai.diagnosticsKept) st.diagnostics.splice(0, st.diagnostics.length - C.ai.diagnosticsKept);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
