// Commanders (format 9): generals, admirals and air marshals. Each has one trait — a
// modest strength with a cost — and is assigned to at most one force of its branch
// (an army, a fleet, an air wing) or to an operation, where it leads the members of
// its branch that have no commander of their own. A force is led by one commander at
// most, so benefits never stack or duplicate. The effects reach the rules through
// the same modifier accounting as the nation's (a force's own source on top of its
// realm's: see `forceSources`), and only where the force fights, recovers or repairs.
// Command limits grow with the forces: generals with regiments, admirals with ships,
// air marshals with wings. Names are generated, not historical.

import { generatedName } from './government';
import { addMods, emptyMods, nationMods, type ModEffects, type Mods, type ModSource } from './modifiers';
import { aliveNations, type Sim } from './state';
import type { Commander, CommanderTrait, NationId } from './types';

export const COMMANDER_TRAITS: Record<CommanderTrait, { label: string; branch: Commander['branch']; effects: ModEffects; summary: string }> = {
  offensive: { label: 'Offensive', branch: 'land', effects: { attack: 0.06, defense: -0.03 }, summary: 'Its armies fire 6% harder in battle; their defensive bonus is 3 points lower.' },
  defensive: { label: 'Defensive', branch: 'land', effects: { defense: 0.08, attack: -0.03 }, summary: 'Defensive bonus +8 points when its armies are attacked; their fire −3%.' },
  organiser: { label: 'Organiser', branch: 'land', effects: { moraleRecovery: 0.15, attack: -0.02 }, summary: 'Morale recovers 15% faster; fire −2%.' },
  logistician: { label: 'Logistician', branch: 'land', effects: { attrition: -0.25, attack: -0.02 }, summary: 'Attrition −25% when short of supply; fire −2%.' },
  gunnery: { label: 'Gunnery', branch: 'sea', effects: { navalAttack: 0.08, repair: -0.1 }, summary: 'Its fleets fire 8% harder; they repair 10% slower.' },
  shipwright: { label: 'Shipwright', branch: 'sea', effects: { repair: 0.3, navalAttack: -0.03 }, summary: 'Repairs 30% faster; fire −3%.' },
  interceptor: { label: 'Interceptor', branch: 'air', effects: { airAttack: 0.08, carrierAir: -0.05 }, summary: 'Its wings strike 8% harder in the air and over the ground; carrier strikes −5%.' },
  striker: { label: 'Striker', branch: 'air', effects: { carrierAir: 0.15, airAttack: -0.03 }, summary: 'Carrier-borne strikes +15%; other air combat −3%.' },
};
export const COMMANDER_TRAIT_IDS = Object.keys(COMMANDER_TRAITS) as CommanderTrait[];
export const BRANCH_LABELS: Record<Commander['branch'], [string, string]> = { land: ['General', 'Generals'], sea: ['Admiral', 'Admirals'], air: ['Air marshal', 'Air marshals'] };

export function commandersOf(sim: Sim, nid: NationId): Commander[] {
  return sim.state.nations[nid]?.commanders ?? [];
}

/** How many commanders of a branch the realm's forces support. */
export function commandLimit(sim: Sim, nid: NationId, branch: Commander['branch']): number {
  const st = sim.state;
  if (branch === 'land') {
    const regs = Object.values(st.armies).reduce((n, a) => n + (a.nation === nid ? a.regiments.length : 0), 0);
    return Math.min(12, 2 + Math.floor(regs / 15));
  }
  if (branch === 'sea') {
    const ships = Object.values(st.fleets).reduce((n, f) => n + (f.nation === nid ? f.ships.length : 0), 0);
    return Math.min(6, ships ? 1 + Math.floor(ships / 8) : 0);
  }
  const wings = Object.values(st.wings).filter((w) => w.nation === nid).length;
  return Math.min(6, wings ? 1 + Math.floor(wings / 4) : 0);
}

export function recruitCommanderCost(sim: Sim, nid: NationId): number {
  return 40 + 10 * commandersOf(sim, nid).length;
}

export function recruitCommanderProblem(sim: Sim, nid: NationId, trait: CommanderTrait): string | null {
  const t = COMMANDER_TRAITS[trait];
  if (!t) return 'Unknown trait.';
  const have = commandersOf(sim, nid).filter((c) => c.branch === t.branch).length;
  const lim = commandLimit(sim, nid, t.branch);
  if (have >= lim) return lim ? `${BRANCH_LABELS[t.branch][1]}: ${have} of ${lim} — the limit grows with our ${t.branch === 'land' ? 'regiments (one more per 15)' : t.branch === 'sea' ? 'ships (one more per 8)' : 'air wings (one more per 4)'}.` : `We have no ${t.branch === 'sea' ? 'ships' : 'air wings'} to command.`;
  const cost = recruitCommanderCost(sim, nid);
  if (sim.state.nations[nid].treasury < cost) return `Needs ${cost} crowns (treasury ${Math.floor(sim.state.nations[nid].treasury)}).`;
  return null;
}

export function recruitCommander(sim: Sim, nid: NationId, trait: CommanderTrait, free = false): Commander {
  const st = sim.state;
  const n = st.nations[nid];
  if (!free) n.treasury -= recruitCommanderCost(sim, nid);
  st.counters.commander = (st.counters.commander ?? 0) + 1;
  const branch = COMMANDER_TRAITS[trait].branch;
  const c: Commander = { id: `cm${st.counters.commander}`, name: generatedName(`${nid}|cm|${st.counters.commander}`), branch, trait, assigned: null };
  (n.commanders ??= []).push(c);
  return c;
}

/** The starting staff: two generals, an admiral with a navy, an air marshal with an air arm. */
export function startingCommanders(sim: Sim, nid: NationId): void {
  const n = sim.state.nations[nid];
  if (n.commanders?.length) return;
  n.commanders = [];
  recruitCommander(sim, nid, 'offensive', true);
  recruitCommander(sim, nid, 'defensive', true);
  if (commandLimit(sim, nid, 'sea') > 0) recruitCommander(sim, nid, 'gunnery', true);
  if (commandLimit(sim, nid, 'air') > 0) recruitCommander(sim, nid, 'interceptor', true);
}

/** What a unit id or operation id is, for a branch. */
function targetBranch(sim: Sim, nid: NationId, id: string): Commander['branch'] | 'op' | null {
  const st = sim.state;
  if (st.armies[id]?.nation === nid) return 'land';
  if (st.fleets[id]?.nation === nid) return 'sea';
  if (st.wings[id]?.nation === nid) return 'air';
  if (st.operations[id]?.nation === nid) return 'op';
  return null;
}

export function assignCommanderProblem(sim: Sim, nid: NationId, cid: string, to: string | null): string | null {
  const c = commandersOf(sim, nid).find((x) => x.id === cid);
  if (!c) return 'Not our commander.';
  if (to === null) return null;
  const b = targetBranch(sim, nid, to);
  if (!b) return 'Not our force or operation.';
  if (b !== 'op' && b !== c.branch) return `${BRANCH_LABELS[c.branch][0]}s lead ${c.branch === 'land' ? 'armies' : c.branch === 'sea' ? 'fleets' : 'air wings'}.`;
  if (b === 'op' && sim.state.operations[to].status === 'complete') return 'That operation is over.';
  return null;
}

/** Assigns (or, with null, relieves); whoever held that post of that branch is relieved. Returns what changed. */
export function assignCommander(sim: Sim, nid: NationId, cid: string, to: string | null): string {
  const list = commandersOf(sim, nid);
  const c = list.find((x) => x.id === cid)!;
  if (to === null) {
    c.assigned = null;
    return `${c.name} is relieved and waits for a new command.`;
  }
  // one commander per force (or per branch of an operation)
  const prev = list.find((x) => x.id !== cid && x.assigned === to && x.branch === c.branch);
  if (prev) prev.assigned = null;
  c.assigned = to;
  const what = sim.state.armies[to]?.name ?? sim.state.fleets[to]?.name ?? sim.state.wings[to]?.name ?? sim.state.operations[to]?.name ?? to;
  return `${c.name} takes command of ${what}${prev ? ` (${prev.name} is relieved)` : ''}.`;
}

/** Weekly: commanders of forces that are gone wait for a new command. */
export function weeklyCommanders(sim: Sim): void {
  const st = sim.state;
  for (const nid of Object.keys(st.nations)) {
    for (const c of st.nations[nid].commanders ?? []) {
      if (!c.assigned) continue;
      const b = targetBranch(sim, nid, c.assigned);
      if (!b || (b === 'op' && st.operations[c.assigned].status === 'complete')) c.assigned = null;
    }
  }
}

/** The commander leading a force: its own, else its operation's for that branch. */
export function commanderOf(sim: Sim, unitId: string): Commander | null {
  const st = sim.state;
  const u = st.armies[unitId] ?? st.fleets[unitId] ?? st.wings[unitId];
  if (!u) return null;
  const branch: Commander['branch'] = st.armies[unitId] ? 'land' : st.fleets[unitId] ? 'sea' : 'air';
  const list = st.nations[u.nation]?.commanders ?? [];
  const own = list.find((c) => c.assigned === unitId);
  if (own) return own;
  if (u.op) return list.find((c) => c.assigned === u.op && c.branch === branch) ?? null;
  return null;
}

/** A force's modifier sources: its realm's and its commander's (the one accounting path). */
export function forceSources(sim: Sim, unitId: string, national: ModSource[]): ModSource[] {
  const c = commanderOf(sim, unitId);
  if (!c) return national;
  return [...national, { kind: 'commander', label: `${BRANCH_LABELS[c.branch][0]} ${c.name} (${COMMANDER_TRAITS[c.trait].label.toLowerCase()})`, effects: COMMANDER_TRAITS[c.trait].effects }];
}

/** The commander's share of one modifier for a force (0 without one): added to its realm's where the force acts. */
export function commanderMod(sim: Sim, unitId: string, key: keyof Mods): number {
  const c = commanderOf(sim, unitId);
  return c ? (COMMANDER_TRAITS[c.trait].effects[key] ?? 0) : 0;
}

/** A force's effective modifiers: its realm's plus its commander's. */
export function forceMods(sim: Sim, nid: NationId, unitId: string): Mods {
  const c = commanderOf(sim, unitId);
  if (!c) return nationMods(sim, nid);
  const m = emptyMods();
  addMods(m, nationMods(sim, nid));
  addMods(m, COMMANDER_TRAITS[c.trait].effects);
  return m;
}

/** AI: every commander leads; a general for each of the largest armies, an admiral for the largest fleets, an air marshal for the wings. */
export function aiCommanders(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  if (!n.commanders) startingCommanders(sim, nid);
  // recruit to the limit when the treasury is comfortable (the same price as for anyone)
  for (const trait of ['offensive', 'gunnery', 'interceptor'] as CommanderTrait[]) {
    if (n.treasury > 400 && !recruitCommanderProblem(sim, nid, trait)) recruitCommander(sim, nid, trait);
  }
  const led = new Set((n.commanders ?? []).map((c) => c.assigned).filter((x): x is string => !!x));
  for (const c of n.commanders ?? []) {
    if (c.assigned) continue;
    const pool =
      c.branch === 'land'
        ? Object.values(st.armies).filter((a) => a.nation === nid).sort((a, b) => b.regiments.length - a.regiments.length || (a.id < b.id ? -1 : 1))
        : c.branch === 'sea'
          ? Object.values(st.fleets).filter((f) => f.nation === nid).sort((a, b) => b.ships.length - a.ships.length || (a.id < b.id ? -1 : 1))
          : Object.values(st.wings).filter((w) => w.nation === nid).sort((a, b) => b.strength - a.strength || (a.id < b.id ? -1 : 1));
    const pick = pool.find((u) => !led.has(u.id));
    if (pick) {
      c.assigned = pick.id;
      led.add(pick.id);
    }
  }
}

/** Every realm's starting staff (a new campaign, or one converted to format 9). */
export function initCommanders(sim: Sim): void {
  for (const nid of aliveNations(sim)) startingCommanders(sim, nid);
}

export function commanderLine(sim: Sim, c: Commander): string {
  const st = sim.state;
  const where = c.assigned ? (st.armies[c.assigned]?.name ?? st.fleets[c.assigned]?.name ?? st.wings[c.assigned]?.name ?? (st.operations[c.assigned] ? `operation ${st.operations[c.assigned].name}` : '—')) : 'unassigned';
  return `${BRANCH_LABELS[c.branch][0]} ${c.name} (${COMMANDER_TRAITS[c.trait].label}) · ${where}`;
}

