// Derived lookups that many rules query every week: armies by province and by
// realm, provinces by owner and controller, and who is at war or allied with
// whom. Each is rebuilt lazily when its key changes and is never saved.
//
// Keys: army lookups change whenever an army is created, removed or moved
// (touchArmies() at those few places); province and relation lookups change
// with the state revision (bump()), which every ownership, control, war and
// treaty change advances. Every key also includes the week, so nothing can
// outlive a tick.

import type { Army, NationId, ProvinceId, TreatyType } from './types';
import type { Sim } from './state';

// keyed by the armies object itself, so replacing it (loading, tests) starts afresh
const armyGen = new WeakMap<object, number>();

/** Call after creating, removing or relocating an army. */
export function touchArmies(sim: Sim): void {
  armyGen.set(sim.state.armies, (armyGen.get(sim.state.armies) ?? 0) + 1);
}

interface ArmyIndex {
  key: string;
  at: Map<ProvinceId, Army[]>;
  of: Map<NationId, Army[]>;
}
const armyIdx = new WeakMap<object, ArmyIndex>();
const NO_ARMIES: readonly Army[] = Object.freeze([]);

function armyIndex(sim: Sim): ArmyIndex {
  const st = sim.state;
  const key = `${st.tick}|${armyGen.get(st.armies) ?? 0}`;
  let ix = armyIdx.get(st.armies);
  if (ix && ix.key === key) return ix;
  const at = new Map<ProvinceId, Army[]>();
  const of = new Map<NationId, Army[]>();
  // insertion order of state.armies, exactly as a full scan would visit them
  for (const id in st.armies) {
    const a = st.armies[id];
    // armies aboard a fleet are at sea: in no province
    if (!a.embarked) (at.get(a.location) ?? at.set(a.location, []).get(a.location)!).push(a);
    (of.get(a.nation) ?? of.set(a.nation, []).get(a.nation)!).push(a);
  }
  ix = { key, at, of };
  armyIdx.set(st.armies, ix);
  return ix;
}

/** Armies standing in a province (shared array: do not modify). */
export function armiesIn(sim: Sim, pid: ProvinceId): readonly Army[] {
  return armyIndex(sim).at.get(pid) ?? NO_ARMIES;
}

/** Armies of a realm (shared array: do not modify). */
export function armiesOfNation(sim: Sim, nid: NationId): readonly Army[] {
  return armyIndex(sim).of.get(nid) ?? NO_ARMIES;
}

interface ProvIndex {
  key: string;
  owned: Map<NationId, ProvinceId[]>;
  controlled: Map<NationId, ProvinceId[]>;
}
const provIdx = new WeakMap<object, ProvIndex>();
const NO_PROVS: readonly ProvinceId[] = Object.freeze([]);

function provIndex(sim: Sim): ProvIndex {
  const st = sim.state;
  const key = `${st.tick}|${st.rev}`;
  let ix = provIdx.get(st);
  if (ix && ix.key === key) return ix;
  const owned = new Map<NationId, ProvinceId[]>();
  const controlled = new Map<NationId, ProvinceId[]>();
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (p.owner) (owned.get(p.owner) ?? owned.set(p.owner, []).get(p.owner)!).push(pid);
    if (p.controller) (controlled.get(p.controller) ?? controlled.set(p.controller, []).get(p.controller)!).push(pid);
  }
  ix = { key, owned, controlled };
  provIdx.set(st, ix);
  return ix;
}

/** Provinces owned by a realm, in world order (shared array: do not modify). */
export function ownedBy(sim: Sim, nid: NationId): readonly ProvinceId[] {
  return provIndex(sim).owned.get(nid) ?? NO_PROVS;
}

/** Provinces controlled by a realm, in world order (shared array: do not modify). */
export function controlledBy(sim: Sim, nid: NationId): readonly ProvinceId[] {
  return provIndex(sim).controlled.get(nid) ?? NO_PROVS;
}

// Relations as a small bit matrix over realm indices (N×N bytes).
const HOSTILE = 1;
const SAME_SIDE = 2;
const TREATY_BIT: Record<TreatyType, number> = { nap: 4, trade: 8, alliance: 16 };

interface RelIndex {
  state: object;
  tick: number;
  rev: number;
  wars: object;
  treaties: object;
  nTreaties: number;
  n: number;
  bits: Uint8Array;
}
const relIdx = new WeakMap<object, RelIndex>();
let lastRel: RelIndex | null = null;
let lastWorld: object | null = null;
let lastNationIndex = new Map<NationId, number>();

function nidx(sim: Sim, nid: NationId): number {
  if (sim.world !== lastWorld) {
    lastWorld = sim.world;
    lastNationIndex = new Map(sim.world.nationIds.map((n, i) => [n, i]));
  }
  return lastNationIndex.get(nid) ?? -1;
}

// Valid while the week, the revision and the war and treaty collections are
// unchanged (wars are created and ended with a revision bump; treaties are
// replaced or appended, which changes their identity or length).
function current(ix: RelIndex | null | undefined, sim: Sim): ix is RelIndex {
  const st = sim.state;
  return !!ix && ix.state === st && ix.tick === st.tick && ix.rev === st.rev && ix.wars === st.wars && ix.treaties === st.treaties && ix.nTreaties === st.treaties.length;
}

function relIndex(sim: Sim): RelIndex {
  if (current(lastRel, sim)) return lastRel;
  const st = sim.state;
  const cached = relIdx.get(st);
  if (current(cached, sim)) return (lastRel = cached);
  const n = sim.world.nationIds.length;
  const bits = new Uint8Array(n * n);
  const set = (a: NationId, b: NationId, bit: number) => {
    const i = nidx(sim, a);
    const j = nidx(sim, b);
    if (i < 0 || j < 0) return;
    bits[i * n + j] |= bit;
    bits[j * n + i] |= bit;
  };
  for (const id in st.wars) {
    const w = st.wars[id];
    for (const a of w.attackers) {
      for (const d of w.defenders) set(a, d, HOSTILE);
      for (const b of w.attackers) if (a !== b) set(a, b, SAME_SIDE);
    }
    for (const a of w.defenders) for (const b of w.defenders) if (a !== b) set(a, b, SAME_SIDE);
  }
  for (const t of st.treaties) set(t.a, t.b, TREATY_BIT[t.type]);
  const fresh: RelIndex = { state: st, tick: st.tick, rev: st.rev, wars: st.wars, treaties: st.treaties, nTreaties: st.treaties.length, n, bits };
  relIdx.set(st, fresh);
  lastRel = fresh;
  return fresh;
}

function relBits(sim: Sim, a: NationId, b: NationId): number {
  const i = nidx(sim, a);
  const j = nidx(sim, b);
  if (i < 0 || j < 0) return 0;
  const ix = relIndex(sim);
  return ix.bits[i * ix.n + j];
}

export function hostilePair(sim: Sim, a: NationId, b: NationId): boolean {
  return a !== b && (relBits(sim, a, b) & HOSTILE) !== 0;
}

export function sameSidePair(sim: Sim, a: NationId, b: NationId): boolean {
  return a !== b && (relBits(sim, a, b) & SAME_SIDE) !== 0;
}

export function treatyPair(sim: Sim, type: TreatyType, a: NationId, b: NationId): boolean {
  return a !== b && (relBits(sim, a, b) & TREATY_BIT[type]) !== 0;
}

// Memo tables for pure lookups whose inputs change only with a revision bump
// or between phases of the week (province output changes when projects finish,
// in the monthly settlement and through event choices). A memo lives for one
// phase: step() and event choices advance the epoch.
interface Memo {
  state: object;
  tick: number;
  rev: number;
  epoch: number;
  tables: Map<string, Map<string, unknown>>;
}
const memoBy = new WeakMap<object, Memo>();
let lastMemo: Memo | null = null;
let memoEpoch = 0;

/** Ends every memo (called between phases and after state edits outside the rules). */
export function nextMemoEpoch(): void {
  memoEpoch++;
}

/** The current memo epoch (drawing caches key on it, with the tick and revision). */
export function memoEpochNow(): number {
  return memoEpoch;
}

export function memoize<T>(sim: Sim, table: string, key: string, compute: () => T): T {
  const st = sim.state;
  let m = lastMemo && lastMemo.state === st ? lastMemo : memoBy.get(st);
  if (!m || m.tick !== st.tick || m.rev !== st.rev || m.epoch !== memoEpoch) {
    m = { state: st, tick: st.tick, rev: st.rev, epoch: memoEpoch, tables: new Map() };
    memoBy.set(st, m);
  }
  lastMemo = m;
  let t = m.tables.get(table);
  if (!t) m.tables.set(table, (t = new Map()));
  if (t.has(key)) return t.get(key) as T;
  const v = compute();
  t.set(key, v);
  return v;
}

/**
 * Consistency check for tests and AI campaigns: every index that is current for
 * its key must match a fresh scan. A mismatch means some code changed armies,
 * ownership, control, wars or treaties without invalidating (touchArmies/bump).
 */
export function checkIndexes(sim: Sim): string[] {
  const out: string[] = [];
  const st = sim.state;
  const ai = armyIdx.get(st.armies);
  if (ai && ai.key === `${st.tick}|${armyGen.get(st.armies) ?? 0}`) {
    for (const id in st.armies) {
      const a = st.armies[id];
      if (!(ai.at.get(a.location) ?? []).includes(a)) out.push(`army index stale: ${id} at ${a.location}`);
    }
    for (const [pid, list] of ai.at) for (const a of list) if (st.armies[a.id] !== a || a.location !== pid) out.push(`army index stale: ${a.id} listed at ${pid}`);
  }
  const pi = provIdx.get(st);
  if (pi && pi.key === `${st.tick}|${st.rev}`) {
    for (const pid of sim.world.provIds) {
      const p = st.provinces[pid];
      if (p.owner && !(pi.owned.get(p.owner) ?? []).includes(pid)) out.push(`ownership index stale: ${pid}`);
      if (p.controller && !(pi.controlled.get(p.controller) ?? []).includes(pid)) out.push(`control index stale: ${pid}`);
    }
    for (const [nid, list] of pi.owned) for (const pid of list) if (st.provinces[pid].owner !== nid) out.push(`ownership index stale: ${pid} listed for ${nid}`);
  }
  const ri = relIdx.get(st);
  if (current(ri, sim)) {
    for (const id in st.wars) for (const a of st.wars[id].attackers) for (const d of st.wars[id].defenders) if (!hostilePair(sim, a, d)) out.push(`war index stale: ${a}/${d}`);
    for (const t of st.treaties) if (!treatyPair(sim, t.type, t.a, t.b)) out.push(`treaty index stale: ${t.type} ${t.a}/${t.b}`);
    let pairs = 0;
    for (const id in st.wars) pairs += st.wars[id].attackers.length * st.wars[id].defenders.length;
    if (pairs === 0) for (const x of ri.bits) if (x & HOSTILE) out.push('war index stale: hostility without a war');
  }
  return out;
}

