// Operations (format 8): the player assigns armies, fleets and air wings to an
// objective with constraints, and the planner carries out the routine orders
// once a week, through the same command path, rules and information as the
// player's own orders. An operation never declares war, makes peace, signs
// anything, spends on new forces or construction, or takes forces that were
// not assigned to it; it targets only land held by realms we are at war with.
//
// Authority and override: every player order to a member (march, stop,
// station, split or merge, fleet or air order, airborne drop) takes it under
// direct command at once (`opHold`): the operation leaves it alone, says so,
// and takes it back only when the player resumes it or, if the operation is
// set to, once that order has been carried out. Release detaches a member.
//
// Weekly, after the AI and before the standing orders, each active operation
// of a player realm is planned (priority first): failures and captures are
// recorded, the ground planner (ops/ground.ts) and the naval, air and airborne
// planner (ops/forces.ts) give the members their tasks, completion and issues
// are checked. Routine events go to the operation's log; only a decision the
// player has to make (or the end of the operation) is a notification.

import { C } from '../config';
import { applyCommand } from '../commands';
import { armyStrength } from '../military';
import { armiesOf, atWar, enemiesOf, isFriendly, menOf, nationName, notify, provName, type Sim } from '../state';
import type { AirWing, Army, Command, CommandResult, Fleet, NationId, Operation, OperationKind, OperationSettings, OpPosture, OpStrategy, ProvinceId, RealmCommand, ZoneId } from '../types';
import { projectedThreat, reachFrom } from '../ai/common';
import { fleetCapacity, pathToCoast, portsOf } from '../naval';
import { SHIPS } from '../config';
import { areaTargets, planGround, recordFailures, restingPlace, type GroundOutcome, type GroundPolicy, type GroundTarget } from './ground';
import { planForces } from './forces';

export const OP_LABELS: Record<OperationKind, string> = {
  conquer: 'Conquer an area',
  advance: 'Advance to a province',
  hold: 'Hold an area',
  sea: 'Keep the seas',
  landing: 'Landing',
  war: 'Auto-conquer',
};

export const OP_HELP: Record<OperationKind, string> = {
  conquer: 'Take every enemy-held province in the area: armies march, fight and besiege until it is ours; aircraft and ships support them.',
  advance: 'Push through to one province, taking the enemy-held land on the way there.',
  hold: 'Defend the area: cover its threatened border, counter-attack enemies inside it, retake what is lost.',
  sea: 'Keep the chosen sea zones: patrol and intercept enemy fleets, escort our ships, strike at sea from the air.',
  landing: 'Carry the armies by sea to the beach under escort and air cover, land them, then take the area.',
  war: 'Win the war with the chosen enemies: every free army, fleet and air wing of ours is used, the enemies\' land is taken, ours is defended against anyone at war with us, and the forces recover, regroup and change targets as the war goes. It never declares war, makes peace or spends.',
};

export const STRATEGY_LABELS: Record<OpStrategy, string> = {
  none: 'No particular priority',
  manpower: 'Spare our men',
  ports: 'Take and keep ports',
  industry: 'Protect our industry',
  focus: 'Concentrate on one enemy',
};

export const STRATEGY_HELP: Record<OpStrategy, string> = {
  none: 'The nearest and most valuable objectives first, our land defended first.',
  manpower: 'Attacks only with a forecast of victory and a clear edge, a larger reserve, armies rest earlier: slower, with fewer losses.',
  ports: 'Enemy ports and coasts count for more as objectives; our own ports are defended first.',
  industry: 'Our provinces with factories are covered and defended first; enemy industry counts for more as an objective.',
  focus: 'The chosen enemy\'s land counts for much more than the others\' (the others are still fought where they attack).',
};

export const POSTURE_HELP: Record<OpPosture, string> = {
  cautious: 'Attacks only with a clear edge (1.5× the defenders) and a forecast of victory; rests armies early; waits 12 weeks before trying a failed target again.',
  balanced: 'Attacks with 1.2× the defenders unless the forecast is defeat; waits 8 weeks after a failed attack.',
  aggressive: 'Attacks with roughly equal strength unless the forecast is defeat; presses on with tired armies; tries a failed target again after 4 weeks. Never ignores your limits or attacks a neutral realm.',
};

export const COMPLETION_LABELS: Record<Operation['onComplete'], string> = {
  hold: 'Hold the area',
  regroup: 'Regroup in the area',
  return: 'Return home',
  await: 'Stop and await orders',
};

export const DEFAULT_OP_SETTINGS: OperationSettings = {
  posture: 'balanced',
  priority: 2,
  reserve: 0.15,
  commitReserve: 'battles',
  minReadiness: 0.45,
  supplyLimit: true,
  reorganize: true,
  rebase: true,
  airborne: 'off',
  airborneRisk: 0.2,
  resumeAfterOrder: false,
  onComplete: 'hold',
};

/** Auto-conquer's visible defaults: every free force joins, aircraft move to reach the fighting, no airborne drops without leave. */
export const WAR_DEFAULTS: Partial<OperationSettings> = { autoAssign: true, rebase: true, airborne: 'off', strategy: 'none', focus: null, onComplete: 'regroup', reserve: 0.15 };

const POLICY: Record<OpPosture, Pick<GroundPolicy, 'margin' | 'accept' | 'failWait' | 'withdraw' | 'uncertainWins'>> = {
  cautious: { margin: 1.5, accept: ['Likely victory'], failWait: 12, withdraw: 1.2 },
  balanced: { margin: 1.2, accept: ['Likely victory', 'Uncertain'], uncertainWins: 2, failWait: 8, withdraw: 1.6 },
  aggressive: { margin: 0.95, accept: ['Likely victory', 'Uncertain'], uncertainWins: 1, failWait: 4, withdraw: 2.2 },
};

/** At most this many operations a realm, detachments an operation, provinces and zones an area. */
export const OP_LIMITS = { perRealm: 12, detachments: 6, area: 250, zones: 30, log: 40 };

// ───────────────────────────── Membership ───────────────────────────────────

export interface OpForces {
  armies: Army[];
  fleets: Fleet[];
  wings: AirWing[];
}

/** The members of an operation (unit ids sorted). */
export function opForces(sim: Sim, opId: string): OpForces {
  const st = sim.state;
  const by = <T extends { id: string; op?: string | null }>(r: Record<string, T>) => Object.values(r).filter((u) => u.op === opId).sort((a, b) => (a.id < b.id ? -1 : 1));
  return { armies: by(st.armies), fleets: by(st.fleets), wings: by(st.wings) };
}

export type UnitRef = { kind: 'army'; unit: Army } | { kind: 'fleet'; unit: Fleet } | { kind: 'wing'; unit: AirWing };

export function unitRef(sim: Sim, id: string): UnitRef | null {
  const st = sim.state;
  if (st.armies[id]) return { kind: 'army', unit: st.armies[id] };
  if (st.fleets[id]) return { kind: 'fleet', unit: st.fleets[id] };
  if (st.wings[id]) return { kind: 'wing', unit: st.wings[id] };
  return null;
}

export function opsOf(sim: Sim, nid: NationId): Operation[] {
  return Object.values(sim.state.operations ?? {})
    .filter((o) => o.nation === nid)
    .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
}

// ───────────────────────────── Log, issues, losses ──────────────────────────

export function opLog(sim: Sim, op: Operation, text: string, tone?: 'good' | 'bad'): void {
  op.log.push({ tick: sim.state.tick, text, ...(tone ? { tone } : {}) });
  if (op.log.length > OP_LIMITS.log) op.log.splice(0, op.log.length - OP_LIMITS.log);
}

/** Asks the player for a decision (once: the same issue is not raised again while it stands). */
export function raiseIssue(sim: Sim, op: Operation, code: string, text: string): void {
  if (op.issue?.code === code && op.issue.text === text) return;
  const fresh = op.issue?.code !== code;
  op.issue = { code, text, since: fresh ? sim.state.tick : op.issue!.since };
  if (fresh) {
    opLog(sim, op, text, 'bad');
    notify(sim, op.nation, 'urgent', 'operation', `${op.name}: ${text}`);
  }
}

export function clearIssue(op: Operation, code?: string): void {
  if (op.issue && (!code || op.issue.code === code)) op.issue = null;
}

export { noteOpLoss } from './losses';

// ───────────────────────────── Lifecycle ────────────────────────────────────

function areaProblem(sim: Sim, nid: NationId, kind: OperationKind, area: ProvinceId[], zones: ZoneId[]): string | null {
  const st = sim.state;
  if (area.length > OP_LIMITS.area) return `An operation's area holds at most ${OP_LIMITS.area} provinces.`;
  if (zones.length > OP_LIMITS.zones) return `An operation keeps at most ${OP_LIMITS.zones} sea zones.`;
  if (area.some((p) => !st.provinces[p])) return 'Unknown province in the area.';
  if (zones.some((z) => !sim.world.zones[z])) return 'Unknown sea zone.';
  if (new Set(area).size !== area.length || new Set(zones).size !== zones.length) return 'A province or zone is listed twice.';
  if (kind === 'sea') {
    if (!zones.length) return 'Choose the sea zones to keep.';
    return null;
  }
  if (!area.length) return kind === 'advance' ? 'Choose the province to advance to.' : kind === 'landing' ? 'Choose the beach to land on.' : 'Choose the provinces of the area.';
  if (kind === 'advance' && area.length !== 1) return 'An advance has one destination.';
  if (kind === 'landing') {
    if (!sim.world.provZones[area[0]]?.length) return `${provName(sim, area[0])} has no coast to land on.`;
    const c = st.provinces[area[0]].controller;
    if (c && isFriendly(sim, nid, c)) return `${provName(sim, area[0])} is already held by our side: land there by sea from the fleet's card.`;
  }
  void nid;
  return null;
}

function settingsProblem(s: Partial<OperationSettings>): string | null {
  if (s.posture !== undefined && !['cautious', 'balanced', 'aggressive'].includes(s.posture)) return 'Unknown posture.';
  if (s.priority !== undefined && ![1, 2, 3].includes(s.priority)) return 'Priority is 1, 2 or 3.';
  if (s.reserve !== undefined && !(s.reserve >= 0 && s.reserve <= 0.4)) return 'The reserve is 0–40% of the strength.';
  if (s.commitReserve !== undefined && !['never', 'battles', 'freely'].includes(s.commitReserve)) return 'Unknown reserve rule.';
  if (s.minReadiness !== undefined && !(s.minReadiness >= 0.2 && s.minReadiness <= 0.8)) return 'The readiness limit is 20–80% of full morale.';
  if (s.airborne !== undefined && !['off', 'once', 'repeat'].includes(s.airborne)) return 'Unknown airborne setting.';
  if (s.airborneRisk !== undefined && !(s.airborneRisk >= 0.05 && s.airborneRisk <= 0.5)) return 'The airborne loss limit is 5–50%.';
  if (s.onComplete !== undefined && !['hold', 'regroup', 'return', 'await'].includes(s.onComplete)) return 'Unknown completion rule.';
  return null;
}

function unitsProblem(sim: Sim, nid: NationId, units: string[]): string | null {
  for (const id of units) {
    const r = unitRef(sim, id);
    if (!r || r.unit.nation !== nid) return 'Not our force.';
  }
  if (new Set(units).size !== units.length) return 'A force is listed twice.';
  return null;
}

export function createOpProblem(sim: Sim, nid: NationId, kind: OperationKind, area: ProvinceId[], zones: ZoneId[], settings: Partial<OperationSettings>, units: string[], enemies: NationId[] = []): string | null {
  if (!(kind in OP_LABELS)) return 'Unknown kind of operation.';
  if (opsOf(sim, nid).length >= OP_LIMITS.perRealm) return `At most ${OP_LIMITS.perRealm} operations at once: cancel one first.`;
  if (kind === 'war') return enemiesProblem(sim, nid, enemies, null) ?? settingsProblem(settings) ?? unitsProblem(sim, nid, units);
  return areaProblem(sim, nid, kind, area, zones) ?? settingsProblem(settings) ?? unitsProblem(sim, nid, units);
}

/** The enemies of an Auto-conquer: realms we are at war with now, each in at most one mandate of ours. */
export function enemiesProblem(sim: Sim, nid: NationId, enemies: NationId[], self: string | null): string | null {
  if (!enemies.length) return 'Choose at least one realm we are at war with.';
  if (new Set(enemies).size !== enemies.length) return 'A realm is listed twice.';
  for (const e of enemies) {
    if (!sim.state.nations[e]?.alive) return 'Unknown realm.';
    if (!atWar(sim, nid, e)) return `We are not at war with ${nationName(sim, e)}: Auto-conquer never starts a war.`;
    const other = opsOf(sim, nid).find((o) => o.kind === 'war' && o.id !== self && o.status !== 'complete' && o.enemies?.includes(e));
    if (other) return `${nationName(sim, e)} is already in ${other.name}.`;
  }
  return null;
}

/**
 * An Auto-conquer's area this week: the land the chosen enemies own or hold, and
 * ours they hold. (Ownership changes only at peace, so what we take stays in it
 * and counts as taken.)
 */
export function warArea(sim: Sim, op: Operation): ProvinceId[] {
  const st = sim.state;
  const foes = new Set(op.enemies ?? []);
  return sim.world.provIds.filter((p) => {
    const ps = st.provinces[p];
    return (ps.owner && foes.has(ps.owner)) || (ps.controller && foes.has(ps.controller));
  });
}

export function createOperation(sim: Sim, nid: NationId, kind: OperationKind, area: ProvinceId[], zones: ZoneId[], settings: Partial<OperationSettings>, units: string[], name: string | undefined, activate: boolean, enemies: NationId[] = []): Operation {
  const st = sim.state;
  st.counters.op = (st.counters.op ?? 0) + 1;
  const id = `op${st.counters.op}`;
  const n = opsOf(sim, nid).length + 1;
  const op: Operation = {
    ...DEFAULT_OP_SETTINGS,
    ...(kind === 'war' ? WAR_DEFAULTS : {}),
    ...settings,
    id,
    nation: nid,
    name: name?.trim().slice(0, 40) || defaultName(sim, kind, area, zones, n, enemies),
    kind,
    status: activate ? 'active' : 'paused',
    area: [...area],
    zones: [...zones],
    created: st.tick,
    since: st.tick,
    tasks: {},
    assigned: {},
    held: [],
    failures: {},
    detached: [],
    reorganized: {},
    log: [],
    issue: null,
    stats: { taken: 0, lost: 0, menLost: 0, shipsLost: 0, wingStrengthLost: 0, drops: 0, landings: 0 },
    landing: kind === 'landing' ? { stage: 'gather', port: null } : null,
    ...(kind === 'war' ? { enemies: [...enemies] } : {}),
  };
  st.operations[id] = op;
  if (kind === 'war') {
    op.area = warArea(sim, op);
    op.startLand = op.area.filter((p) => !isFriendly(sim, nid, st.provinces[p].controller)).length;
  }
  op.held = op.area.filter((p) => isFriendly(sim, nid, st.provinces[p].controller));
  opLog(sim, op, `${OP_LABELS[kind]}: ${describeArea(sim, op)}. ${activate ? 'Active.' : 'Prepared, not yet active.'}`);
  assignUnits(sim, op, units);
  if (kind === 'war' && op.autoAssign) autoAssign(sim, op);
  return op;
}

function defaultName(sim: Sim, kind: OperationKind, area: ProvinceId[], zones: ZoneId[], n: number, enemies: NationId[] = []): string {
  if (kind === 'war') return `Auto-conquer: ${enemies.map((e) => sim.world.nationDefs[e]?.short ?? e).join(', ')}`.slice(0, 40);
  // one province: its name; an area: the realms that hold most of it
  const holders = new Map<string, number>();
  for (const p of area) {
    const c = sim.state.provinces[p]?.controller;
    if (c) holders.set(c, (holders.get(c) ?? 0) + 1);
  }
  const top = [...holders].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 2).map(([nid]) => sim.world.nationDefs[nid]?.short ?? nid);
  const where = kind === 'sea' ? sim.world.zones[zones[0]]?.name : area.length === 1 || kind === 'advance' || kind === 'landing' ? provName(sim, area[0]) : top.join(' and ');
  const word: Record<OperationKind, string> = { conquer: 'Conquest', advance: 'Advance', hold: 'Defence', sea: 'Sea control', landing: 'Landing', war: 'Auto-conquer' };
  return `${word[kind]} of ${where || `area ${n}`}`.slice(0, 40);
}

export function describeArea(sim: Sim, op: Pick<Operation, 'kind' | 'area' | 'zones'> & { enemies?: NationId[] }): string {
  if (op.kind === 'war') return `against ${(op.enemies ?? []).map((e) => nationName(sim, e)).join(', ') || 'no enemy'}`;
  if (op.kind === 'sea') return `${op.zones.length} sea zone${op.zones.length === 1 ? '' : 's'} (${op.zones.slice(0, 3).map((z) => sim.world.zones[z].name).join(', ')}${op.zones.length > 3 ? '…' : ''})`;
  if (op.kind === 'advance') return `to ${provName(sim, op.area[0])}`;
  if (op.kind === 'landing') return `on ${provName(sim, op.area[0])}${op.area.length > 1 ? `, then ${op.area.length - 1} more province${op.area.length === 2 ? '' : 's'}` : ''}`;
  return `${op.area.length} province${op.area.length === 1 ? '' : 's'} (${op.area.slice(0, 3).map((p) => provName(sim, p)).join(', ')}${op.area.length > 3 ? '…' : ''})`;
}

export function editOpProblem(sim: Sim, nid: NationId, opId: string, area: ProvinceId[] | undefined, zones: ZoneId[] | undefined, settings: Partial<OperationSettings>, enemies?: NationId[]): string | null {
  const op = sim.state.operations?.[opId];
  if (!op || op.nation !== nid) return 'Not our operation.';
  if (op.kind === 'war') {
    if (enemies) return enemiesProblem(sim, nid, enemies, op.id) ?? settingsProblem(settings);
    if (settings.focus && !(op.enemies ?? []).includes(settings.focus)) return 'Concentrate on one of the mandate\'s enemies.';
    return settingsProblem(settings);
  }
  return areaProblem(sim, nid, op.kind, area ?? op.area, zones ?? op.zones) ?? settingsProblem(settings);
}

export function editOperation(sim: Sim, op: Operation, area: ProvinceId[] | undefined, zones: ZoneId[] | undefined, settings: Partial<OperationSettings>, name?: string, enemies?: NationId[]): void {
  const changed: string[] = [];
  if (op.kind === 'war' && enemies) {
    op.enemies = [...enemies];
    if (op.focus && !enemies.includes(op.focus)) op.focus = null;
    op.area = warArea(sim, op);
    op.held = op.area.filter((p) => isFriendly(sim, op.nation, sim.state.provinces[p].controller));
    op.failures = {};
    if (op.status === 'complete') op.status = 'active';
    changed.push(`enemies ${describeArea(sim, op)}`);
  }
  if (area) {
    op.area = [...area];
    op.held = op.area.filter((p) => isFriendly(sim, op.nation, sim.state.provinces[p].controller));
    changed.push(`area ${describeArea(sim, op)}`);
  }
  if (zones) {
    op.zones = [...zones];
    changed.push(`zones ${describeArea(sim, op)}`);
  }
  for (const [k, v] of Object.entries(settings) as Array<[keyof OperationSettings, never]>) {
    if (v === undefined || op[k] === v) continue;
    (op as unknown as Record<string, unknown>)[k] = v;
    changed.push(k);
  }
  if (name?.trim()) op.name = name.trim().slice(0, 40);
  // a new area or new limits: decide afresh (finished operations take up a widened area)
  if (area || zones) {
    op.failures = {};
    if (op.status === 'complete') op.status = 'active';
  }
  clearIssue(op);
  if (changed.length) opLog(sim, op, `Changed: ${changed.join(', ')}.`);
}

/** Members join (from direct command or another operation); they are under the operation's command at once. */
export function assignUnits(sim: Sim, op: Operation, ids: string[]): void {
  const moved: string[] = [];
  for (const id of ids) {
    const r = unitRef(sim, id);
    if (!r) continue;
    const u = r.unit;
    if (u.op && u.op !== op.id) {
      const prev = sim.state.operations[u.op];
      if (prev) {
        opLog(sim, prev, `${u.name} reassigned to ${op.name}.`);
        delete prev.tasks[id];
        delete prev.assigned[id];
      }
    }
    u.op = op.id;
    u.opHold = false;
    moved.push(u.name);
  }
  if (moved.length) opLog(sim, op, `Assigned: ${moved.slice(0, 6).join(', ')}${moved.length > 6 ? ` and ${moved.length - 6} more` : ''}.`);
}

/** Members leave their operations (detached): they keep their last orders under direct command. */
export function releaseUnits(sim: Sim, ids: string[], why = 'detached'): void {
  for (const id of ids) {
    const r = unitRef(sim, id);
    if (!r || !r.unit.op) continue;
    const op = sim.state.operations[r.unit.op];
    r.unit.op = null;
    r.unit.opHold = false;
    // taken out of an Auto-conquer by the player: it is not taken back the next week
    if (op?.kind === 'war' && op.autoAssign) r.unit.reserved = true;
    if (op) {
      delete op.tasks[id];
      delete op.assigned[id];
      opLog(sim, op, `${r.unit.name} ${why}: under direct command${op.kind === 'war' && op.autoAssign ? ' (reserved: Auto-conquer will not take it again until you allow it)' : ''}.`);
    }
  }
}

/**
 * Auto-conquer's forces: every army, fleet and air wing of ours that is in no other
 * operation and not reserved for direct command joins (forces at sea with troops
 * aboard, and airborne troops, only once they are free). Told once in the log.
 */
export function autoAssign(sim: Sim, op: Operation): void {
  const st = sim.state;
  const nid = op.nation;
  const free = (u: { nation: NationId; op?: string | null; reserved?: boolean }) => u.nation === nid && !u.op && !u.reserved;
  const ids: string[] = [];
  for (const a of Object.values(st.armies)) if (free(a) && !a.embarked && !a.drop) ids.push(a.id);
  for (const f of Object.values(st.fleets)) if (free(f) && !f.cargo.length) ids.push(f.id);
  for (const w of Object.values(st.wings)) if (free(w)) ids.push(w.id);
  if (ids.length) assignUnits(sim, op, ids.sort());
}

/** Forces the player keeps for direct command (Auto-conquer never takes them), or hands back to it. */
export function reserveUnits(sim: Sim, ids: string[], reserved: boolean): void {
  for (const id of ids) {
    const r = unitRef(sim, id);
    if (!r) continue;
    if (reserved && r.unit.op && sim.state.operations[r.unit.op]?.kind === 'war') releaseUnits(sim, [id], 'reserved for direct command');
    r.unit.reserved = reserved || undefined;
    if (!reserved) delete r.unit.reserved;
  }
}

export function setOpStatus(sim: Sim, op: Operation, status: 'active' | 'paused'): void {
  if (op.status === status) return;
  op.status = status;
  op.since = sim.state.tick;
  clearIssue(op);
  opLog(sim, op, status === 'active' ? 'Resumed: the planner takes up the routine orders again.' : 'Paused: members keep their current orders, and take new ones only from you.');
}

/** Cancels an operation: every member returns to direct command with its last orders. */
export function cancelOperation(sim: Sim, op: Operation): void {
  const f = opForces(sim, op.id);
  for (const u of [...f.armies, ...f.fleets, ...f.wings]) {
    u.op = null;
    u.opHold = false;
  }
  delete sim.state.operations[op.id];
}

export function resumeUnits(sim: Sim, ids: string[]): void {
  for (const id of ids) {
    const r = unitRef(sim, id);
    if (!r || !r.unit.op || !r.unit.opHold) continue;
    r.unit.opHold = false;
    const op = sim.state.operations[r.unit.op];
    if (op) {
      delete op.tasks[id];
      opLog(sim, op, `${r.unit.name} back under the operation's command.`);
    }
  }
}

/** The units a player command gives an order to (the manual override). */
function orderedUnits(cmd: Command): string[] {
  switch (cmd.type) {
    case 'move':
    case 'stop':
    case 'setOrder':
    case 'split':
    case 'airDrop':
    case 'cancelDrop':
      return [cmd.army];
    case 'merge':
      return cmd.armies;
    case 'shipArmies':
      return [...cmd.armies, cmd.fleet];
    case 'moveFleet':
    case 'stopFleet':
    case 'fleetDuty':
    case 'splitFleet':
      return [cmd.fleet];
    case 'mergeFleets':
      return cmd.fleets;
    case 'airMission':
    case 'rebaseWing':
      return [cmd.wing];
    default:
      return [];
  }
}

/** A player's order to a member takes it under direct command (called before the order is carried out). */
export function takeUnderDirectCommand(sim: Sim, cmd: Command): void {
  for (const id of orderedUnits(cmd)) {
    const r = unitRef(sim, id);
    if (!r || !r.unit.op || r.unit.opHold) continue;
    const op = sim.state.operations[r.unit.op];
    r.unit.opHold = true;
    if (!op) continue;
    op.tasks[id] = { kind: 'manual', target: null, note: `under your direct command${op.resumeAfterOrder ? ' until this order is carried out' : ': resume it to hand it back'}`, since: sim.state.tick };
    delete op.assigned[id];
    opLog(sim, op, `${r.unit.name} taken under direct command by your order${op.resumeAfterOrder ? ' (rejoins once it is carried out)' : ''}.`);
  }
}

// ───────────────────────────── Weekly planning ──────────────────────────────

/**
 * The only orders an operation may give: moving, reorganising and employing the
 * forces assigned to it. Never diplomacy, war or peace, purchases, construction,
 * research or national policy (refused here whatever the planner asks).
 */
export const OP_ORDERS: ReadonlySet<RealmCommand['type']> = new Set<RealmCommand['type']>([
  'move', 'stop', 'split', 'merge', 'fleetDuty', 'moveFleet', 'stopFleet', 'shipArmies', 'airMission', 'rebaseWing', 'airDrop', 'cancelDrop',
]);

/** The operation's own command path: not a player order, so no override and no entry in the player's command log. */
function opIssue(sim: Sim): (cmd: RealmCommand, why?: string) => CommandResult {
  return (cmd) => (OP_ORDERS.has(cmd.type) ? applyCommand(sim, cmd, { auto: true }) : { ok: false, reason: `An operation may not order ${cmd.type}.` });
}

/** Where the operation's reserve and resting armies gather: the province of ours nearest both the area and the armies. */
export function opBase(sim: Sim, op: Operation, armies: Army[]): ProvinceId | null {
  const st = sim.state;
  const nid = op.nation;
  const area = op.kind === 'landing' && op.landing?.stage !== 'ashore' ? [] : op.area;
  const friendly = (p: ProvinceId) => isFriendly(sim, nid, st.provinces[p]?.controller ?? null);
  // our provinces in or next to the area
  const cands = new Set<ProvinceId>();
  for (const p of area) {
    if (friendly(p)) cands.add(p);
    for (const nb of sim.world.prov[p].neighbors) if (friendly(nb)) cands.add(nb);
  }
  if (!cands.size) for (const a of armies) if (friendly(a.location)) cands.add(a.location);
  if (!cands.size) return st.nations[nid].capital;
  let best: ProvinceId | null = null;
  let bs = Infinity;
  for (const p of [...cands].sort()) {
    let s = 0;
    for (const a of armies) s += sim.world.hop(a.location, p) ?? 50;
    // the side facing the enemy, but not a province they stand in
    if (Object.values(st.armies).some((x) => x.location === p && atWar(sim, nid, x.nation))) s += 100;
    s -= st.provinces[p].fort * 2 + st.provinces[p].infra;
    if (s < bs) {
      bs = s;
      best = p;
    }
  }
  return best;
}

/** The ground targets of an operation this week. */
export function opTargets(sim: Sim, op: Operation, armies: Army[], margin: number): { targets: GroundTarget[]; posts: Array<{ pid: ProvinceId; threat: number }> } {
  const st = sim.state;
  const nid = op.nation;
  const kind = op.status === 'complete' && op.onComplete === 'hold' ? 'hold' : op.kind;
  if (kind === 'sea') return { targets: [], posts: [] };
  if (kind === 'landing' && op.landing?.stage !== 'ashore') return { targets: [], posts: [] };
  if (kind === 'war') return warTargets(sim, op, armies, margin);
  if (kind === 'advance') {
    // the enemy-held provinces on the way from our main body to the destination
    const dest = op.area[0];
    const lead = armies.length ? armies.reduce((x, y) => (armyStrength(sim, y) > armyStrength(sim, x) ? y : x)) : null;
    const route = new Set<ProvinceId>([dest]);
    if (lead) {
      const r = reachFrom(sim, nid, lead.location);
      let c: ProvinceId | undefined = dest;
      let guard = 0;
      while (c && c !== lead.location && guard++ < 200) {
        route.add(c);
        c = r.prev[c];
      }
    }
    return { targets: areaTargets(sim, nid, route, margin), posts: [] };
  }
  if (kind === 'hold') {
    const targets = areaTargets(sim, nid, op.area, margin, true);
    // the area's threatened border: enemy strength within two marches of each province we hold
    const posts: Array<{ pid: ProvinceId; threat: number }> = [];
    const enemies = new Set(enemiesOf(sim, nid));
    if (enemies.size) {
      const foes = [...enemies].flatMap((e) => armiesOf(sim, e)).filter((a) => !a.retreating);
      for (const p of op.area) {
        if (!isFriendly(sim, nid, st.provinces[p].controller)) continue;
        let threat = 0;
        for (const f of foes) {
          const d = sim.world.hop(p, f.location) ?? 99;
          if (d >= 1 && d <= 2) threat += armyStrength(sim, f) * (d === 1 ? 1 : 0.5);
        }
        if (threat > 0) posts.push({ pid: p, threat });
      }
      posts.sort((a, b) => b.threat - a.threat || (a.pid < b.pid ? -1 : 1));
    }
    return { targets, posts: posts.slice(0, 12) };
  }
  // conquer (and a landing once ashore): the area's enemy-held land; the nearer and the
  // more valuable first, at most a working set at a time; and our own provinces next to
  // the area or holding its airfields and ports, when the enemy strikes there (counter-attacks)
  const all = areaTargets(sim, nid, op.area, margin);
  const inArea = new Set(op.area);
  const guard = new Set<ProvinceId>();
  for (const p of op.area) for (const nb of sim.world.prov[p].neighbors) if (!inArea.has(nb)) guard.add(nb);
  for (const w of Object.values(st.wings)) if (w.op === op.id && !w.carrier) guard.add(w.base);
  for (const f of Object.values(st.fleets)) if (f.op === op.id && f.home) guard.add(f.home);
  // ours next to the area (or our bases) under attack, and ours the enemy has already taken there
  for (const t of areaTargets(sim, nid, guard, margin)) if (t.kind === 'defend' || t.kind === 'liberate') all.push(t);
  if (all.length <= 24) return { targets: all, posts: [] };
  const near = (pid: ProvinceId) => {
    let d = 99;
    for (const a of armies) d = Math.min(d, sim.world.hop(a.location, pid) ?? 99);
    return d;
  };
  const scored = all.map((t) => ({ t, s: (t.kind === 'defend' ? -100 : t.kind === 'liberate' && !inArea.has(t.pid) ? -60 : 0) + near(t.pid) * 3 - t.value })).sort((a, b) => a.s - b.s || (a.t.pid < b.t.pid ? -1 : 1));
  return { targets: scored.slice(0, 24).map((x) => x.t), posts: [] };
}

/**
 * Auto-conquer's targets: the chosen enemies' land (and ours they hold), our own land
 * entered or held by anyone at war with us (defended first, whoever attacks), and the
 * posts on our borders facing an enemy army; weighed by the mandate's priority.
 * Never a province of a realm outside the mandate unless it is ours.
 */
function warTargets(sim: Sim, op: Operation, armies: Army[], margin: number): { targets: GroundTarget[]; posts: Array<{ pid: ProvinceId; threat: number }> } {
  const st = sim.state;
  const nid = op.nation;
  const inArea = new Set(op.area);
  const all = areaTargets(sim, nid, op.area, margin);
  // our land under attack or occupied by any enemy (homeland defence)
  const home = sim.world.provIds.filter((p) => {
    if (inArea.has(p) || st.provinces[p].owner !== nid) return false;
    const c = st.provinces[p].controller;
    return (c && atWar(sim, nid, c)) || Object.values(st.armies).some((a) => a.location === p && !a.retreating && atWar(sim, nid, a.nation));
  });
  for (const t of areaTargets(sim, nid, home, margin)) if (t.kind === 'defend' || t.kind === 'liberate') all.push(t);
  // the priority
  const strat = op.strategy ?? 'none';
  for (const t of all) {
    const ps = st.provinces[t.pid];
    const ours = ps.owner === nid;
    if (strat === 'ports' && ps.port > 0) t.value += ours ? 3 : 4;
    if (strat === 'industry' && ps.factories > 0) t.value += ours ? ps.factories * 2 : ps.factories * 1.5;
    if (strat === 'focus' && op.focus && !ours) t.value = ps.owner === op.focus || ps.controller === op.focus ? t.value * 1.5 + 3 : t.value * 0.7;
  }
  // posts: our border provinces with an enemy army (any realm at war with us) within two marches
  const posts: Array<{ pid: ProvinceId; threat: number }> = [];
  const foes = Object.values(st.armies).filter((a) => !a.retreating && !a.embarked && atWar(sim, nid, a.nation));
  if (foes.length) {
    for (const p of sim.world.provIds) {
      const ps = st.provinces[p];
      if (ps.owner !== nid || ps.controller !== nid) continue;
      if (!sim.world.prov[p].neighbors.some((n) => !isFriendly(sim, nid, st.provinces[n].controller))) continue;
      let threat = 0;
      for (const f of foes) {
        const d = sim.world.hop(p, f.location) ?? 99;
        if (d >= 1 && d <= 2) threat += armyStrength(sim, f) * (d === 1 ? 1 : 0.5);
      }
      if (threat <= 0) continue;
      if (strat === 'industry') threat *= 1 + 0.3 * ps.factories;
      if (strat === 'ports' && ps.port > 0) threat *= 1.3;
      posts.push({ pid: p, threat });
    }
    posts.sort((a, b) => b.threat - a.threat || (a.pid < b.pid ? -1 : 1));
  }
  if (all.length <= 24) return { targets: all, posts: posts.slice(0, 12) };
  const near = (pid: ProvinceId) => {
    let d = 99;
    for (const a of armies) d = Math.min(d, sim.world.hop(a.location, pid) ?? 99);
    return d;
  };
  const scored = all.map((t) => ({ t, s: (t.kind === 'defend' ? -100 : t.kind === 'liberate' && !inArea.has(t.pid) ? -60 : 0) + near(t.pid) * 3 - t.value })).sort((a, b) => a.s - b.s || (a.t.pid < b.t.pid ? -1 : 1));
  return { targets: scored.slice(0, 24).map((x) => x.t), posts: posts.slice(0, 12) };
}

/**
 * The enemies still at war with us (a peace drops one, told once); none left: the
 * mandate is complete. Its area follows the enemies' land.
 */
function refreshWar(sim: Sim, op: Operation): string | null {
  const nid = op.nation;
  const before = op.enemies ?? [];
  const still = before.filter((e) => sim.state.nations[e]?.alive && atWar(sim, nid, e));
  const gone = before.filter((e) => !still.includes(e));
  if (gone.length) {
    opLog(sim, op, `No longer at war with ${gone.map((e) => nationName(sim, e)).join(', ')}: ${still.length ? 'the mandate goes on against the others' : 'the mandate is complete'}.`, 'good');
    op.enemies = still;
    if (op.focus && !still.includes(op.focus)) op.focus = null;
  }
  op.area = warArea(sim, op);
  if (!still.length) return gone.length ? `the war${gone.length > 1 ? 's' : ''} with ${gone.map((e) => nationName(sim, e)).join(', ')} ended` : 'no enemy left';
  return null;
}

/** Regiments a landing Auto-conquer organises carries at the least. */
const AUTO_LANDING_MIN = 4;

/**
 * Auto-conquer's sea crossings: when the enemies' land left to take lies overseas
 * (none of our armies can reach it by land, or almost all that can is taken) and the
 * mandate has transports, it organises a landing under the ordinary landing rules:
 * the least defended beach with a sea route from a port of ours, the transports with
 * the warships to escort them, and the armies nearest the port that fit aboard.
 * One at a time; the forces return to the mandate when it is done.
 */
function autoLanding(sim: Sim, war: Operation, f: OpForces): void {
  const st = sim.state;
  const nid = war.nation;
  if (Object.values(st.operations).some((o) => o.parent === war.id)) return;
  if (war.landingWait && st.tick < war.landingWait) return;
  const armies = f.armies.filter((a) => !a.opHold && !a.battle && !a.embarked && !a.retreating && a.regiments.some((r) => r.type !== 'airborne'));
  if (!armies.length) return;
  const enemyHeld = war.area.filter((p) => {
    const c = st.provinces[p].controller;
    return c && atWar(sim, nid, c);
  });
  const reach = armies.map((a) => reachFrom(sim, nid, a.location));
  const byLand = enemyHeld.filter((p) => reach.some((r) => r.dist[p] !== undefined));
  const overseas = enemyHeld.filter((p) => !byLand.includes(p) && (sim.world.provZones[p] ?? []).length);
  if (!overseas.length || byLand.length > 2) return;
  const lift = f.fleets.filter((x) => !x.opHold && !x.cargo.length && fleetCapacity(x) >= AUTO_LANDING_MIN).sort((a, b) => fleetCapacity(b) - fleetCapacity(a) || (a.id < b.id ? -1 : 1));
  if (!lift.length) {
    raiseIssue(sim, war, 'auto-landing', `${provName(sim, overseas[0])}${overseas.length > 1 ? ` and ${overseas.length - 1} more` : ''} lie overseas: Auto-conquer needs a fleet with transports (2 regiments each, at least ${AUTO_LANDING_MIN / 2}) to land there. Build or assign transports.`);
    return;
  }
  clearIssue(war, 'auto-landing');
  const carrier = lift[0];
  // the beach: overseas enemy coast with a sea route from one of our ports, the weakest held first, then the nearest
  const ports = portsOf(sim, nid).filter((p) => st.provinces[p].controller === nid);
  let best: { beach: ProvinceId; port: ProvinceId; score: number } | null = null;
  for (const b of overseas) {
    const held = projectedThreat(sim, nid, b, 0.7);
    for (const port of ports) {
      const route = (sim.world.provZones[port] ?? []).map((z) => pathToCoast(sim, z, b)).filter((x): x is string[] => !!x).sort((x, y) => x.length - y.length)[0];
      if (!route) continue;
      const score = held * 3 + route.length;
      if (!best || score < best.score || (score === best.score && b < best.beach)) best = { beach: b, port, score };
    }
  }
  if (!best) {
    raiseIssue(sim, war, 'auto-landing', `No port of ours has a sea route to the enemy land overseas (${provName(sim, overseas[0])}).`);
    return;
  }
  // the landing force: armies nearest the port that fit aboard, the strongest first
  const cap = fleetCapacity(carrier);
  const r = reachFrom(sim, nid, best.port);
  const cands = armies
    .filter((a) => r.dist[a.location] !== undefined || a.location === best!.port)
    .sort((x, y) => (r.dist[x.location] ?? 0) - (r.dist[y.location] ?? 0) || y.regiments.length - x.regiments.length || (x.id < y.id ? -1 : 1));
  const force: Army[] = [];
  let regs = 0;
  for (const a of cands) if (regs + a.regiments.length <= cap) (force.push(a), (regs += a.regiments.length));
  if (regs < AUTO_LANDING_MIN) return;
  const escorts = f.fleets.filter((x) => x.id !== carrier.id && !x.opHold && !x.cargo.length && x.ships.some((s) => SHIPS[s.type].gun > 0)).slice(0, 1);
  const area = [best.beach, ...overseas.filter((p) => p !== best!.beach && (sim.world.hop(p, best!.beach) ?? 9) <= 3)].slice(0, 12);
  const sub = createOperation(sim, nid, 'landing', area, [], { posture: war.posture, reserve: 0, airborne: 'off', onComplete: 'hold', rebase: war.rebase }, [carrier.id, ...escorts.map((x) => x.id), ...force.map((a) => a.id)], `Landing at ${provName(sim, best.beach)}`.slice(0, 40), true);
  sub.parent = war.id;
  opLog(sim, war, `The enemy land left lies overseas: a landing at ${provName(sim, best.beach)} is organised with ${force.map((a) => a.name).join(', ')} (${regs} regiments), ${carrier.name}${escorts.length ? ` and ${escorts[0].name}` : ''}.`);
}

/** Landings Auto-conquer organised: done, their forces return; stuck for six weeks, called off (and none for eight weeks). */
function reclaimLandings(sim: Sim, war: Operation): void {
  const st = sim.state;
  for (const sub of Object.values(st.operations).filter((o) => o.parent === war.id)) {
    const stuck = sub.issue && st.tick - sub.issue.since >= 6 && sub.landing?.stage !== 'ashore';
    if (sub.status !== 'complete' && !stuck) continue;
    const g = opForces(sim, sub.id);
    const ids = [...g.armies, ...g.fleets, ...g.wings].filter((u) => !u.opHold).map((u) => u.id);
    if (stuck) {
      war.landingWait = st.tick + 8;
      opLog(sim, war, `${sub.name} called off: ${sub.issue!.text}`, 'bad');
    } else opLog(sim, war, `${sub.name} done: its forces return to the mandate.`, 'good');
    cancelOperation(sim, sub);
    assignUnits(sim, war, ids);
  }
}

export function groundPolicy(op: Operation): GroundPolicy {
  const p = POLICY[op.posture];
  const live = op.detached.length;
  return {
    margin: p.margin,
    accept: p.accept,
    uncertainWins: p.uncertainWins,
    minReadiness: op.posture === 'aggressive' ? Math.max(0.2, op.minReadiness - 0.1) : op.minReadiness,
    reserve: op.reserve,
    commitReserve: op.commitReserve,
    coordinate: true,
    merge: op.reorganize,
    maxDetach: op.reorganize ? Math.max(0, OP_LIMITS.detachments - live) : 0,
    minDetach: 2,
    failWait: p.failWait,
    maxCost: 40,
    supplyLimit: op.supplyLimit,
    withdraw: p.withdraw,
    // sparing men: only clear victories, a larger reserve, rest earlier
    ...(op.kind === 'war' && op.strategy === 'manpower'
      ? { accept: ['Likely victory'] as const, margin: Math.max(p.margin, 1.4), reserve: Math.min(0.4, op.reserve + 0.1), minReadiness: Math.max(op.minReadiness, 0.55), withdraw: Math.min(p.withdraw, 1.3) }
      : {}),
  };
}

/** The ground plan of an operation (dry: the preview, nothing issued). */
export function planOpGround(sim: Sim, op: Operation, armies: Army[], dry: boolean): GroundOutcome {
  const pol = groundPolicy(op);
  // a landing's beachhead and the land next to it lie beyond supply by nature
  if (op.kind === 'landing' && op.area.length) pol.supplyExempt = new Set([op.area[0], ...sim.world.prov[op.area[0]].neighbors]);
  const { targets, posts } = opTargets(sim, op, armies, pol.margin);
  const base = opBase(sim, op, armies);
  const memory = dry
    ? { assigned: { ...op.assigned }, failures: { ...op.failures }, reorganized: { ...op.reorganized } }
    : { assigned: op.assigned, failures: op.failures, reorganized: op.reorganized };
  return planGround(sim, armies, targets, { nation: op.nation, policy: pol, memory, base, posts, issue: opIssue(sim), note: (t, tone) => (dry ? undefined : opLog(sim, op, t, tone)), dry }, op.tasks);
}

/** Members given a direct order rejoin once it is carried out (when the operation is set to). */
function resumeIdle(sim: Sim, op: Operation, f: OpForces): void {
  if (!op.resumeAfterOrder) return;
  const back: string[] = [];
  for (const a of f.armies) if (a.opHold && !a.path.length && !a.battle && !a.retreating && !a.drop && !a.embarked) (a.opHold = false), back.push(a.name);
  for (const x of f.fleets) if (x.opHold && !x.path.length && !x.cargo.length && (!x.duty || x.duty.kind === 'hold')) (x.opHold = false), back.push(x.name);
  for (const w of f.wings) if (w.opHold && w.mission === 'idle') (w.opHold = false), back.push(w.name);
  if (back.length) opLog(sim, op, `${back.join(', ')} carried out ${back.length === 1 ? 'its' : 'their'} order${back.length === 1 ? '' : 's'} and rejoined.`);
}

/** What changed hands in the area since last week (taken and lost), told once. */
function countCaptures(sim: Sim, op: Operation): void {
  const st = sim.state;
  const now = op.area.filter((p) => isFriendly(sim, op.nation, st.provinces[p].controller));
  const before = new Set(op.held);
  const after = new Set(now);
  const taken = now.filter((p) => !before.has(p));
  const lost = op.held.filter((p) => !after.has(p) && st.provinces[p]);
  if (taken.length) {
    op.stats.taken += taken.length;
    opLog(sim, op, `Took ${taken.slice(0, 5).map((p) => provName(sim, p)).join(', ')}${taken.length > 5 ? ` and ${taken.length - 5} more` : ''}.`, 'good');
  }
  if (lost.length) {
    op.stats.lost += lost.length;
    opLog(sim, op, `Lost ${lost.slice(0, 5).map((p) => provName(sim, p)).join(', ')}${lost.length > 5 ? ` and ${lost.length - 5} more` : ''}.`, 'bad');
  }
  op.held = now;
}

/** Done: no enemy-held land or enemy army left in the area (conquer, landing), or the destination is ours (advance). */
function finished(sim: Sim, op: Operation): string | null {
  const st = sim.state;
  const nid = op.nation;
  if (op.kind === 'sea' || op.kind === 'hold' || op.kind === 'war') return null;
  if (op.kind === 'landing' && op.landing?.stage !== 'ashore') {
    const c = st.provinces[op.area[0]].controller;
    return c && isFriendly(sim, nid, c) ? `${provName(sim, op.area[0])} is held by our side` : null;
  }
  if (op.kind === 'advance') return isFriendly(sim, nid, st.provinces[op.area[0]].controller) ? `${provName(sim, op.area[0])} reached` : null;
  const left = op.area.filter((p) => {
    const c = st.provinces[p].controller;
    return (c && atWar(sim, nid, c)) || Object.values(st.armies).some((a) => a.location === p && atWar(sim, nid, a.nation));
  });
  if (left.length) return null;
  const hostileNow = op.area.some((p) => {
    const c = st.provinces[p].controller;
    return c && !isFriendly(sim, nid, c);
  });
  return hostileNow ? 'no enemy-held land left in the area (the rest belongs to realms we are not at war with)' : 'the whole area is held by our side';
}

function complete(sim: Sim, op: Operation, why: string, f: OpForces): void {
  op.status = 'complete';
  op.since = sim.state.tick;
  // a beach taken by other means needs no crossing: the landing is over, the area is held like any other
  if (op.landing && op.landing.stage !== 'ashore') op.landing.stage = 'ashore';
  clearIssue(op);
  opLog(sim, op, `Objective reached: ${why}. ${COMPLETION_LABELS[op.onComplete]}.`, 'good');
  notify(sim, op.nation, 'normal', 'operation', `${op.name}: objective reached (${why}). ${COMPLETION_LABELS[op.onComplete]}.`);
  afterCompletion(sim, op, f, true);
}

/** What the members do once the objective is reached. */
function afterCompletion(sim: Sim, op: Operation, f: OpForces, first: boolean): void {
  const st = sim.state;
  const nid = op.nation;
  const armies = f.armies.filter((a) => !a.opHold && !a.battle && !a.retreating && !a.embarked);
  const issue = opIssue(sim);
  if (op.onComplete === 'await') {
    if (first) for (const a of armies) if (a.path.length) issue({ type: 'stop', nation: nid, army: a.id });
    for (const a of armies) op.tasks[a.id] = { kind: 'wait', target: a.location, note: 'awaiting orders: the objective is reached', since: op.tasks[a.id]?.kind === 'wait' ? op.tasks[a.id].since : st.tick };
    return;
  }
  if (op.onComplete === 'return') {
    for (const a of armies) {
      const home = restingPlace(sim, nid, a.location, st.nations[nid].capital);
      const dest = home ?? a.location;
      op.tasks[a.id] = { kind: 'return', target: dest, note: `returning to ${provName(sim, dest)}`, since: op.tasks[a.id]?.kind === 'return' ? op.tasks[a.id].since : st.tick };
      if (a.location !== dest && a.path[a.path.length - 1] !== dest) issue({ type: 'move', nation: nid, army: a.id, dest });
    }
    return;
  }
  if (op.onComplete === 'regroup') {
    const base = opBase(sim, op, armies);
    if (!base) return;
    for (const a of armies) {
      op.tasks[a.id] = { kind: 'regroup', target: base, note: `regrouping at ${provName(sim, base)}`, since: op.tasks[a.id]?.kind === 'regroup' ? op.tasks[a.id].since : st.tick };
      if (a.location !== base && a.path[a.path.length - 1] !== base) issue({ type: 'move', nation: nid, army: a.id, dest: base });
    }
    const there = armies.filter((a) => a.location === base && !a.path.length && !a.keep);
    if (op.reorganize && there.length > 1 && there.reduce((n, a) => n + a.regiments.length, 0) <= C.army.maxRegiments) {
      if (issue({ type: 'merge', nation: nid, armies: there.map((a) => a.id) }).ok) opLog(sim, op, `${there.length} armies regrouped at ${provName(sim, base)}.`);
    }
  }
  // hold: planned as a hold operation over the area every week (opTargets)
}

/** Explains a standstill once: the operation cannot progress without a decision. */
function checkProgress(sim: Sim, op: Operation, g: GroundOutcome, f: OpForces): void {
  const ground = op.kind !== 'sea' && !(op.kind === 'landing' && op.landing?.stage !== 'ashore');
  if (!ground) return;
  const live = f.armies.filter((a) => !a.opHold);
  if (!f.armies.length) {
    raiseIssue(sim, op, 'no-forces', 'No armies are assigned: assign forces, or cancel the operation.');
    return;
  }
  if (!live.length) {
    raiseIssue(sim, op, 'all-manual', 'Every army is under your direct command: resume them to let the operation continue.');
    return;
  }
  const active = Object.values(g.tasks).filter((t) => ['attack', 'occupy', 'defend', 'stage'].includes(t.kind)).length;
  const failed = Object.entries(op.failures).filter(([, x]) => x.count >= 2 && sim.state.tick - x.tick < 8);
  if (failed.length) {
    const [p, x] = failed[0];
    raiseIssue(sim, op, 'failed', `Attacks on ${provName(sim, p)} have failed ${x.count} times. Add forces, change the posture, take ${provName(sim, p)} out of the area, or take direct command.`);
    return;
  }
  if (!active && g.blocked.length && op.status === 'active') {
    const resting = Object.values(g.tasks).filter((t) => t.kind === 'recover').length;
    const why = g.blocked.slice(0, 2).map((b) => `${provName(sim, b.pid)}: ${b.why}`).join('; ');
    raiseIssue(sim, op, 'blocked', `Cannot make progress${resting ? ` (${resting} arm${resting === 1 ? 'y' : 'ies'} resting)` : ''}: ${why}. Add forces, change the posture or the area, or wait.`);
    return;
  }
  if (op.issue && ['no-forces', 'all-manual', 'blocked', 'failed'].includes(op.issue.code)) clearIssue(op);
}

/** One operation's week. */
export function planOperation(sim: Sim, op: Operation): void {
  const st = sim.state;
  const f = opForces(sim, op.id);
  // forget detachments that are gone; keep the count of those still serving
  op.detached = op.detached.filter((id) => st.armies[id]?.op === op.id);
  for (const id of Object.keys(op.tasks)) if (!unitRef(sim, id) || unitRef(sim, id)!.unit.op !== op.id) delete op.tasks[id];
  if (op.kind === 'war' && op.status !== 'complete') {
    const over = refreshWar(sim, op);
    if (over) {
      countCaptures(sim, op);
      complete(sim, op, over, f);
      return;
    }
  }
  countCaptures(sim, op);
  if (op.status === 'paused') return;
  if (op.kind === 'war' && op.autoAssign) {
    const before = f.armies.length + f.fleets.length + f.wings.length;
    autoAssign(sim, op);
    const now = opForces(sim, op.id);
    if (now.armies.length + now.fleets.length + now.wings.length !== before) Object.assign(f, now);
  }
  if (op.kind === 'war' && op.status === 'active') {
    reclaimLandings(sim, op);
    autoLanding(sim, op, f);
    Object.assign(f, opForces(sim, op.id));
  }
  resumeIdle(sim, op, f);
  const fresh = recordFailures(sim, op.nation, { assigned: op.assigned, failures: op.failures, reorganized: op.reorganized }, Math.max(op.since, st.tick - 2), new Set(op.area));
  for (const p of fresh) opLog(sim, op, `The attack on ${provName(sim, p)} failed: no new attack there for ${POLICY[op.posture].failWait} weeks, and then only stronger.`, 'bad');
  if (op.status === 'active') {
    const why = finished(sim, op);
    if (why) {
      complete(sim, op, why, f);
      return;
    }
  }
  if (op.status === 'complete' && op.onComplete !== 'hold') {
    afterCompletion(sim, op, f, false);
    return;
  }
  const armies = f.armies.filter((a) => !a.opHold);
  // forces first decide what is needed of them (landing, airborne), then the ground plan, then support
  const forces = planForces(sim, op, { ...f, armies: f.armies.filter((a) => !a.opHold), fleets: f.fleets.filter((x) => !x.opHold), wings: f.wings.filter((w) => !w.opHold) }, opIssue(sim));
  const ground = planOpGround(
    sim,
    op,
    armies.filter((a) => !forces.reserved.has(a.id)),
    false,
  );
  for (const d of ground.detached) {
    op.detached.push(d);
    st.armies[d].op = op.id;
  }
  // support follows the ground plan (where the armies fight and besiege)
  forces.support(ground);
  for (const [id, t] of Object.entries(ground.tasks)) op.tasks[id] = t;
  for (const [id, t] of Object.entries(forces.tasks)) op.tasks[id] = t;
  checkProgress(sim, op, ground, f);
}

/** Every active operation of every player realm (priority first): the weekly operations phase. */
export function weeklyOperations(sim: Sim): void {
  const steps = weeklyOperationsSteps(sim);
  while (!steps.next().done);
}

/** The operations phase one operation at a time (a slice each in the browser, see weekSlices); the result is weeklyOperations'. */
export function* weeklyOperationsSteps(sim: Sim): Generator<void, void, void> {
  const st = sim.state;
  if (!st.operations) return;
  const realms = [...new Set(Object.values(st.operations).map((o) => o.nation))].sort();
  for (const nid of realms) {
    const n = st.nations[nid];
    if (!n?.alive) {
      for (const op of opsOf(sim, nid)) cancelOperation(sim, op);
      continue;
    }
    for (const op of opsOf(sim, nid)) {
      if (!st.operations[op.id]) continue;
      planOperation(sim, op);
      yield;
    }
  }
}

/** Men under an operation's command (for the panel). */
export function opMen(f: OpForces): number {
  return f.armies.reduce((s, a) => s + menOf(a), 0);
}

export function opSummaryLine(sim: Sim, op: Operation): string {
  const f = opForces(sim, op.id);
  const regs = f.armies.reduce((n, a) => n + a.regiments.length, 0);
  const parts = [`${f.armies.length} arm${f.armies.length === 1 ? 'y' : 'ies'} (${regs} regiments)`];
  if (f.fleets.length) parts.push(`${f.fleets.length} fleet${f.fleets.length === 1 ? '' : 's'}`);
  if (f.wings.length) parts.push(`${f.wings.length} wing${f.wings.length === 1 ? '' : 's'}`);
  return parts.join(', ');
}

export function opNationName(sim: Sim, op: Operation): string {
  return nationName(sim, op.nation);
}
