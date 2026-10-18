// Standing production orders (format 9): several ships, air wings or regiments of one
// type at once, at one port, airfield or province or spread over several, without a
// click each time a slipway frees.
//
// Rules (the same as ordering each by hand, only repeated for the player):
//  - eligibility per place: ours and held, a port (ships) or an airfield (wings) or a
//    province that may raise troops (regiments), the technology, a treaty's limits
//  - capacity: a slipway per port level (one ship each), wing room per airfield level,
//    at most ten regiments started in a province a week
//  - paid when each unit is laid down or starts training, never in advance: nothing is
//    reserved, so an order cannot overspend or lock money away; an order that cannot
//    pay (or has no free capacity) waits and says why, and starts again by itself
//  - orders start in the order they were given; within an order, places in the order
//    chosen (per place: each place up to its count; total: one at a time in turn)
//  - cancelling stops what has not started (nothing was paid for it); what is on the
//    slipways or in training stays and is cancelled where it is (materiel and
//    resources back, crowns lost), as before
//  - finished units appear where they were built (ships form or join a squadron of
//    the order at that port) and, if the order says so, join an operation of ours,
//    and wings move to the chosen airfield and fleets sail to the chosen zone by the
//    ordinary move orders: nothing is teleported
// Bounded: at most 20 orders a realm, 60 units an order, 40 places.

import { airfieldRoom, startWing, wingCost, wingUnlocked } from './air';
import { applyCommand } from './commands';
import { C, SHIPS, UNITS, WINGS } from './config';
import { armyCap } from './influence';
import { createArmy, orderRecruit, recruitEligible, regimentsOf, unitCost, unitUnlocked } from './military';
import { createFleet, shipCost, shipUnlocked, startShip, zoneName } from './naval';
import { assignUnits } from './ops/operations';
import { notify, provName, type Sim } from './state';
import type { AirWing, Army, Fleet, NationId, ProductionOrder, ProvinceId, Regiment, Ship, ShipType, StrategicResource, UnitType, WingType } from './types';

export const PRODUCTION_LIMITS = { orders: 20, count: 60, places: 40, regimentsPerProvinceWeek: 10 };

export const PRODUCTION_KIND_LABELS: Record<ProductionOrder['kind'], string> = { ship: 'Ships', wing: 'Air wings', regiment: 'Regiments' };

export interface UnitPrice {
  crowns: number;
  materiel: number;
  men: number;
  resources: Partial<Record<StrategicResource, number>>;
  weeks: number;
  /** crowns a month once in service (wings and ships also burn fuel) */
  upkeep: number;
  fuel: { amount: number; kind: 'oil' | 'coal' } | null;
}

export function unitLabel(kind: ProductionOrder['kind'], unit: string, n = 1): string {
  const r = kind === 'ship' ? SHIPS[unit as ShipType] : kind === 'wing' ? WINGS[unit as WingType] : UNITS[unit as UnitType];
  if (!r) return unit;
  return n === 1 ? r.label : r.plural;
}

export function unitKnown(kind: ProductionOrder['kind'], unit: string): boolean {
  return kind === 'ship' ? !!SHIPS[unit as ShipType] : kind === 'wing' ? !!WINGS[unit as WingType] : !!UNITS[unit as UnitType];
}

export function unitPrice(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], unit: string): UnitPrice {
  if (kind === 'ship') {
    const c = shipCost(sim, nid, unit as ShipType);
    const r = SHIPS[unit as ShipType];
    return { crowns: c.crowns, materiel: c.materiel, men: 0, resources: c.resources, weeks: c.weeks, upkeep: r.upkeep, fuel: { amount: r.fuel, kind: r.oil ? 'oil' : 'coal' } };
  }
  if (kind === 'wing') {
    const c = wingCost(sim, nid, unit as WingType);
    const r = WINGS[unit as WingType];
    return { crowns: c.crowns, materiel: c.materiel, men: 0, resources: c.resources, weeks: c.weeks, upkeep: r.upkeep, fuel: { amount: r.fuel, kind: 'oil' } };
  }
  const c = unitCost(sim, nid, unit as UnitType);
  return { crowns: c.crowns, materiel: c.materiel, men: c.manpower, resources: c.resources, weeks: c.weeks, upkeep: UNITS[unit as UnitType].upkeep, fuel: null };
}

/** What is still needed before this type can be ordered at all (technology, a treaty); null: it can. */
export function typeProblem(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], unit: string): string | null {
  if (!unitKnown(kind, unit)) return 'Unknown type.';
  if (kind === 'ship') {
    if (!shipUnlocked(sim, nid, unit as ShipType)) return `${SHIPS[unit as ShipType].plural} need the technology ${SHIPS[unit as ShipType].requires!.replace(/_/g, ' ')}.`;
    if ((unit === 'capital' || unit === 'carrier') && armyCap(sim, nid) !== null) return 'Disarmed by treaty: no battleships or carriers until the limit expires.';
    return null;
  }
  if (kind === 'wing') return wingUnlocked(sim, nid, unit as WingType) ? null : `${WINGS[unit as WingType].plural} need the technology ${WINGS[unit as WingType].requires.replace(/_/g, ' ')}.`;
  return unitUnlocked(sim, nid, unit as UnitType) ? null : `${UNITS[unit as UnitType].plural} need the technology ${UNITS[unit as UnitType].requires!.replace(/_/g, ' ')}.`;
}

/** Why a place cannot build this kind at all (null: it can, given capacity and means). */
export function placeProblem(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], unit: string, pid: ProvinceId): string | null {
  const p = sim.state.provinces[pid];
  if (!p) return 'Unknown province.';
  if (kind === 'regiment') return recruitEligible(sim, nid, pid, unit as UnitType);
  if (p.owner !== nid || p.controller !== nid) return 'Not a province we own and hold.';
  if (kind === 'ship') return p.port >= 1 ? null : 'No port.';
  return p.airfield >= 1 ? null : 'No airfield.';
}

/** Free capacity at a place now (slipways, airfield room, recruits a week). */
export function placeRoom(sim: Sim, kind: ProductionOrder['kind'], pid: ProvinceId, startedThisWeek = 0): number {
  const p = sim.state.provinces[pid];
  if (kind === 'ship') return Math.max(0, p.port - p.dock.length);
  if (kind === 'wing') return Math.max(0, airfieldRoom(sim, pid));
  return Math.max(0, PRODUCTION_LIMITS.regimentsPerProvinceWeek - startedThisWeek);
}

/** The places of ours that can build this kind (for the order form): ports, airfields, provinces that may raise troops. */
export function productionPlaces(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], unit: string): ProvinceId[] {
  return sim.world.provIds.filter((p) => !placeProblem(sim, nid, kind, unit, p));
}

/** In use at a place: our ships on the slipways, wings in training and based there, regiments in training. */
export function placeQueue(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  if (kind === 'ship') return p.dock.filter((o) => o.nation === nid).length;
  if (kind === 'wing') return p.hangar.filter((o) => o.nation === nid).length;
  return p.recruits.filter((o) => o.nation === nid).length;
}

/** The shared pools an order (or a preview) spends from, once each. */
interface Budget {
  crowns: number;
  materiel: number;
  men: number;
  stock: Record<string, number>;
  regiments: number;
  cap: number | null;
}

function budgetOf(sim: Sim, nid: NationId, kind: ProductionOrder['kind']): Budget {
  const n = sim.state.nations[nid];
  return { crowns: n.treasury, materiel: n.materiel, men: n.manpower, stock: { ...n.stock }, regiments: kind === 'regiment' ? regimentsOf(sim, nid) : 0, cap: kind === 'regiment' ? armyCap(sim, nid) : null };
}

/** Why the pools cannot pay for one more (null: they can). */
function payProblem(b: Budget, price: UnitPrice, kind: ProductionOrder['kind']): string | null {
  if (b.crowns < price.crowns) return `needs ${price.crowns} crowns (treasury ${Math.floor(b.crowns)})`;
  if (b.materiel < price.materiel) return `needs ${price.materiel} materiel (stockpile ${Math.floor(b.materiel)})`;
  for (const [r, v] of Object.entries(price.resources)) if ((b.stock[r] ?? 0) < (v ?? 0)) return `needs ${v} ${r} (stockpile ${Math.floor(b.stock[r] ?? 0)})`;
  if (kind === 'regiment') {
    if (b.men < price.men) return `needs ${price.men.toLocaleString()} men (pool ${Math.floor(b.men).toLocaleString()})`;
    if (b.cap !== null && b.regiments >= b.cap) return `disarmed by treaty: at most ${b.cap} regiments`;
  }
  return null;
}

function spend(b: Budget, price: UnitPrice): void {
  b.crowns -= price.crowns;
  b.materiel -= price.materiel;
  b.men -= price.men;
  for (const [r, v] of Object.entries(price.resources)) b.stock[r] = (b.stock[r] ?? 0) - (v ?? 0);
  b.regiments++;
}

const FULL: Record<ProductionOrder['kind'], string> = {
  ship: 'every slipway is in use',
  wing: 'the airfields are full (based wings count: move some away, or choose an airfield to send new ones to)',
  regiment: 'ten regiments a province a week',
};

/** Waiting its turn at full slipways or airfields is not a problem to report. */
const QUEUED = new Set([FULL.ship, FULL.wing, FULL.regiment]);

/**
 * What starts this week: the places in turn, one each a pass, while a place has room
 * (and, per place, its count is not reached) and the pools can pay. The same plan
 * serves the order and its preview, so the preview says what the order will do.
 */
function planStarts(
  sim: Sim,
  nid: NationId,
  kind: ProductionOrder['kind'],
  unit: string,
  places: ProvinceId[],
  mode: 'per' | 'total',
  count: number,
  started: Record<ProvinceId, number>,
  left: number,
  b: Budget,
  weekly: Map<ProvinceId, number>,
): { starts: Record<ProvinceId, number>; why: string | null } {
  const starts: Record<ProvinceId, number> = {};
  const tp = typeProblem(sim, nid, kind, unit);
  if (tp) return { starts, why: tp.replace(/\.$/, '') };
  const price = unitPrice(sim, nid, kind, unit);
  let why: string | null = null;
  const room: Record<ProvinceId, number> = {};
  for (const pid of places) {
    const pp = placeProblem(sim, nid, kind, unit, pid);
    room[pid] = pp ? 0 : placeRoom(sim, kind, pid, weekly.get(pid) ?? 0);
    if (pp) why ??= `${provName(sim, pid)}: ${pp.replace(/\.$/, '').toLowerCase()}`;
  }
  let progress = true;
  while (progress && left > 0) {
    progress = false;
    for (const pid of places) {
      if (left <= 0) break;
      if (mode === 'per' && (started[pid] ?? 0) + (starts[pid] ?? 0) >= count) continue;
      if ((starts[pid] ?? 0) >= room[pid]) {
        why ??= FULL[kind];
        continue;
      }
      const pay = payProblem(b, price, kind);
      if (pay) return { starts, why: pay };
      spend(b, price);
      starts[pid] = (starts[pid] ?? 0) + 1;
      left--;
      progress = true;
    }
  }
  return { starts, why: left > 0 ? why : null };
}

export interface ProductionPreviewRow {
  pid: ProvinceId;
  problem: string | null;
  /** free now (slipways, airfield room, recruits a week) */
  room: number;
  /** ours already there (on the slipways, in training) */
  inQueue: number;
  /** of this order, what this place is to get (per place: its count; in total: an even share) */
  target: number;
  /** what would start at once, given the shared pools */
  startNow: number;
}

export interface ProductionPreview {
  rows: ProductionPreviewRow[];
  typeProblem: string | null;
  price: UnitPrice;
  total: { crowns: number; materiel: number; men: number; resources: Partial<Record<StrategicResource, number>> };
  /** what the realm has of each, now */
  have: { crowns: number; materiel: number; men: number; resources: Partial<Record<StrategicResource, number>> };
  /** what would start this week, and why not more */
  startNow: number;
  limit: string | null;
  /** the whole order */
  count: number;
  /** a month in service, all of it */
  upkeep: number;
  /** fuel a month in service, all of it */
  fuel: { amount: number; kind: 'oil' | 'coal' } | null;
  /** weeks until the last is finished at the current capacity (an estimate; null: they will not all fit) */
  weeks: number | null;
  /** wings: based wings fill an airfield, so more than its room cannot all stay there */
  capacity: string | null;
}

/** The even spread of a total over places (for the preview's targets). */
function shares(places: ProvinceId[], count: number, mode: 'per' | 'total'): Record<ProvinceId, number> {
  const out: Record<ProvinceId, number> = {};
  if (mode === 'per') for (const p of places) out[p] = count;
  else {
    for (const p of places) out[p] = 0;
    for (let i = 0; i < count && places.length; i++) out[places[i % places.length]]++;
  }
  return out;
}

/**
 * What an order would do: per place its target and what starts at once with the shared
 * pools spent once (the order's own plan), the total cost against what the realm has,
 * the upkeep, and an estimate of the weeks to finish from capacity alone.
 */
export function previewProduction(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], unit: string, places: ProvinceId[], count: number, mode: 'per' | 'total', rally: string | null = null): ProductionPreview {
  const n = sim.state.nations[nid];
  const price = unitPrice(sim, nid, kind, unit);
  const tp = typeProblem(sim, nid, kind, unit);
  const ok = places.filter((p) => !placeProblem(sim, nid, kind, unit, p));
  const want = shares(ok, count, mode);
  const total = mode === 'per' ? count * ok.length : ok.length ? count : 0;
  const plan = planStarts(sim, nid, kind, unit, ok, mode, count, {}, total, budgetOf(sim, nid, kind), new Map());
  const rows: ProductionPreviewRow[] = places.map((pid) => {
    const problem = placeProblem(sim, nid, kind, unit, pid);
    return { pid, problem, room: problem ? 0 : placeRoom(sim, kind, pid), inQueue: placeQueue(sim, nid, kind, pid), target: problem ? 0 : (want[pid] ?? 0), startNow: plan.starts[pid] ?? 0 };
  });
  const startNow = Object.values(plan.starts).reduce((a, b) => a + b, 0);
  const resources: Partial<Record<StrategicResource, number>> = {};
  const have: ProductionPreview['have'] = { crowns: Math.floor(n.treasury), materiel: Math.floor(n.materiel), men: Math.floor(n.manpower), resources: {} };
  for (const [r, v] of Object.entries(price.resources) as Array<[StrategicResource, number]>) {
    resources[r] = (v ?? 0) * total;
    have.resources[r] = Math.floor(n.stock[r] ?? 0);
  }
  // the last finishes after the slowest place works through its share at its capacity
  let weeks: number | null = 0;
  let capacity: string | null = null;
  for (const r of rows) {
    if (!r.target) continue;
    const p = sim.state.provinces[r.pid];
    // wings stay based where they are raised unless sent elsewhere: at most the airfield's room
    if (kind === 'wing' && !rally && r.target > r.room) {
      capacity ??= `${provName(sim, r.pid)} has room for ${r.room} more wing${r.room === 1 ? '' : 's'} (${C.air.wingsPerAirfield} a level; based wings count): choose more airfields, or an airfield to send the new wings to`;
      weeks = null;
      continue;
    }
    const per = kind === 'regiment' ? PRODUCTION_LIMITS.regimentsPerProvinceWeek : Math.max(1, kind === 'ship' ? p.port : p.airfield * C.air.wingsPerAirfield);
    if (weeks !== null) weeks = Math.max(weeks, Math.ceil(r.target / per) * price.weeks);
  }
  return {
    rows,
    typeProblem: tp,
    price,
    total: { crowns: price.crowns * total, materiel: price.materiel * total, men: price.men * total, resources },
    have,
    startNow,
    limit: plan.why,
    count: total,
    upkeep: price.upkeep * total,
    fuel: price.fuel ? { amount: price.fuel.amount * total, kind: price.fuel.kind } : null,
    weeks,
    capacity,
  };
}

export function orderProductionProblem(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], unit: string, places: ProvinceId[], count: number, mode: 'per' | 'total', assign?: { op?: string | null; rally?: string | null }): string | null {
  if (!['ship', 'wing', 'regiment'].includes(kind)) return 'Unknown kind of production.';
  const tp = typeProblem(sim, nid, kind, unit);
  if (tp) return tp;
  if (!places.length) return 'Choose where to build.';
  if (places.length > PRODUCTION_LIMITS.places || new Set(places).size !== places.length) return `Each place once, at most ${PRODUCTION_LIMITS.places}.`;
  if (places.some((p) => !sim.state.provinces[p])) return 'Unknown province.';
  if (!Number.isInteger(count) || count < 1 || count > PRODUCTION_LIMITS.count) return `Between 1 and ${PRODUCTION_LIMITS.count} at a time.`;
  if (mode !== 'per' && mode !== 'total') return 'Per place or in total.';
  const ok = places.filter((p) => !placeProblem(sim, nid, kind, unit, p));
  if (!ok.length) return placeProblem(sim, nid, kind, unit, places[0]) ?? 'No place can build it.';
  if ((mode === 'per' ? count * ok.length : count) > PRODUCTION_LIMITS.count) return `At most ${PRODUCTION_LIMITS.count} in one order.`;
  if ((sim.state.nations[nid].production ?? []).length >= PRODUCTION_LIMITS.orders) return `At most ${PRODUCTION_LIMITS.orders} production orders: cancel one first.`;
  if (assign?.op) {
    const op = sim.state.operations[assign.op];
    if (!op || op.nation !== nid || op.status === 'complete') return 'Not an operation of ours that is under way.';
  }
  if (assign?.rally) {
    if (assign.op) return 'New units either join an operation or move to a place, not both.';
    if (kind === 'wing') {
      const r = sim.state.provinces[assign.rally];
      if (!r || r.owner !== nid || r.controller !== nid || r.airfield < 1) return 'Wings move only to an airfield we own and hold.';
    } else if (kind === 'ship') {
      if (!sim.world.zones[assign.rally]) return 'Choose a sea zone for the new ships.';
    } else return 'Regiments gather where they are raised (or join an operation).';
  }
  return null;
}

export function createProductionOrder(sim: Sim, nid: NationId, kind: ProductionOrder['kind'], unit: string, places: ProvinceId[], count: number, mode: 'per' | 'total', assign?: { op?: string | null; rally?: string | null }): ProductionOrder {
  const st = sim.state;
  st.counters.production = (st.counters.production ?? 0) + 1;
  const n = st.nations[nid];
  n.production ??= [];
  const ok = places.filter((p) => !placeProblem(sim, nid, kind, unit, p));
  const order: ProductionOrder = {
    id: `po${st.counters.production}`,
    kind,
    unit,
    places: ok,
    mode,
    count,
    total: mode === 'per' ? count * ok.length : count,
    started: {},
    done: 0,
    paused: false,
    created: st.tick,
    blocked: null,
    assign: { op: assign?.op ?? null, rally: assign?.rally ?? null },
    groups: {},
    formed: [],
  };
  n.production.push(order);
  // what can start at once starts now, as an order by hand would
  runOrder(sim, nid, order);
  return order;
}

/** The order's total and what is left to start. */
export function orderTotals(o: ProductionOrder): { total: number; started: number; left: number } {
  const started = Object.values(o.started).reduce((a, b) => a + b, 0);
  return { total: o.total, started, left: Math.max(0, o.total - started) };
}

/** One order's starts this week: what its plan allows, laid down and paid for as by hand. */
function runOrder(sim: Sim, nid: NationId, o: ProductionOrder, weekly = new Map<ProvinceId, number>()): number {
  if (o.paused) return 0;
  const st = sim.state;
  const t = orderTotals(o);
  if (t.left <= 0) {
    o.blocked = null;
    return 0;
  }
  const plan = planStarts(sim, nid, o.kind, o.unit, o.places, o.mode, o.count, o.started, t.left, budgetOf(sim, nid, o.kind), weekly);
  let started = 0;
  for (const pid of o.places) {
    for (let i = 0; i < (plan.starts[pid] ?? 0); i++) {
      const p = st.provinces[pid];
      if (o.kind === 'ship') {
        startShip(sim, nid, pid, o.unit as ShipType);
        p.dock[p.dock.length - 1].order = o.id;
      } else if (o.kind === 'wing') {
        startWing(sim, nid, pid, o.unit as WingType);
        p.hangar[p.hangar.length - 1].order = o.id;
      } else {
        orderRecruit(sim, nid, pid, o.unit as UnitType);
        p.recruits[p.recruits.length - 1].order = o.id;
        weekly.set(pid, (weekly.get(pid) ?? 0) + 1);
      }
      o.started[pid] = (o.started[pid] ?? 0) + 1;
      started++;
    }
  }
  if (!plan.why || orderTotals(o).left <= 0) o.blocked = null;
  else if (!o.blocked || o.blocked.why !== plan.why) o.blocked = { why: plan.why, since: st.tick };
  return started;
}

/** Weekly (before the yards and depots work): every realm's orders, oldest first. */
export function weeklyProduction(sim: Sim): void {
  const st = sim.state;
  for (const nid of Object.keys(st.nations).sort()) {
    const n = st.nations[nid];
    if (!n.production?.length) continue;
    if (!n.alive) {
      n.production = [];
      continue;
    }
    const weekly = new Map<ProvinceId, number>();
    for (const o of n.production) {
      // places lost or no longer able to build are dropped (said once); per place, their
      // share not yet started goes with them (nothing was paid for it)
      const lost = o.places.filter((p) => placeProblem(sim, nid, o.kind, o.unit, p));
      if (lost.length) {
        const why = placeProblem(sim, nid, o.kind, o.unit, lost[0])!.replace(/\.$/, '').toLowerCase();
        o.places = o.places.filter((p) => !lost.includes(p));
        if (o.mode === 'per') for (const p of lost) o.total -= Math.max(0, o.count - (o.started[p] ?? 0));
        else if (!o.places.length) o.total = orderTotals(o).started;
        notify(sim, nid, 'normal', 'production', `${unitLabel(o.kind, o.unit, 2)} order: ${lost.map((p) => provName(sim, p)).join(', ')} can no longer build them (${why}); ${o.places.length ? 'the rest goes on' : 'nothing more will start'}.`, { province: lost[0] });
      }
      gatherAtRally(sim, nid, o);
      runOrder(sim, nid, o, weekly);
      // told once when an order has waited a month for something other than its turn at the slipways or airfields
      if (o.blocked && st.tick - o.blocked.since === 4 && !QUEUED.has(o.blocked.why)) notify(sim, nid, 'normal', 'production', `${unitLabel(o.kind, o.unit, 2)} order waiting for a month: ${o.blocked.why}.`);
    }
    // finished orders leave the list once everything they started is done (and new squadrons have joined up at their zone)
    n.production = n.production.filter((o) => orderTotals(o).left > 0 || inProgress(sim, nid, o) > 0 || enRoute(sim, o) > 0);
  }
}

/** Units of this order on the slipways or in training. */
export function inProgress(sim: Sim, nid: NationId, o: ProductionOrder): number {
  let k = 0;
  for (const pid of Object.keys(o.started)) {
    const p = sim.state.provinces[pid];
    if (!p) continue;
    const list = o.kind === 'ship' ? p.dock : o.kind === 'wing' ? p.hangar : p.recruits;
    for (const x of list) if (x.nation === nid && x.order === o.id) k++;
  }
  return k;
}

export function setProductionState(sim: Sim, nid: NationId, id: string, state: 'paused' | 'active' | 'cancel'): string {
  const n = sim.state.nations[nid];
  const o = (n.production ?? []).find((x) => x.id === id)!;
  if (state === 'cancel') {
    const { left } = orderTotals(o);
    const busy = inProgress(sim, nid, o);
    n.production = (n.production ?? []).filter((x) => x.id !== id);
    return `Order cancelled: ${left} not started (nothing was paid for them)${busy ? `; ${busy} already under way continue (cancel them at their ${o.kind === 'ship' ? 'port' : o.kind === 'wing' ? 'airfield' : 'province'})` : ''}.`;
  }
  o.paused = state === 'paused';
  if (!o.paused) runOrder(sim, nid, o);
  return o.paused ? 'Order paused: nothing more starts until you resume it.' : 'Order resumed.';
}

/** The order a finished unit came from (null: ordered by hand, or the order is gone). */
function orderOf(sim: Sim, nid: NationId, orderId: string | undefined): ProductionOrder | null {
  if (!orderId) return null;
  return (sim.state.nations[nid]?.production ?? []).find((x) => x.id === orderId) ?? null;
}

/**
 * A ship of an order leaves the yards at `pid`: it joins the squadron the order is
 * forming there (while that squadron is still in the port's zone and carries no troops),
 * or forms a new one. Returns the fleet, or null when the ship was not ordered by one.
 */
export function orderShip(sim: Sim, nid: NationId, orderId: string | undefined, pid: ProvinceId, zone: string, ship: Ship): Fleet | null {
  const o = orderOf(sim, nid, orderId);
  if (!o) return null;
  const st = sim.state;
  const g = st.fleets[o.groups[pid]];
  let f: Fleet;
  if (g && g.nation === nid && g.zone === zone && !g.cargo.length) {
    g.ships.push(ship);
    f = g;
  } else {
    f = createFleet(sim, nid, zone, [ship], pid);
    o.groups[pid] = f.id;
    o.formed.push(f.id);
  }
  producedUnit(sim, nid, o, f.id, 'ship');
  return f;
}

/** A wing of an order is ready at its airfield. */
export function orderWing(sim: Sim, nid: NationId, orderId: string | undefined, w: AirWing): void {
  const o = orderOf(sim, nid, orderId);
  if (o) producedUnit(sim, nid, o, w.id, 'wing');
}

/**
 * A regiment of an order has finished training at `pid`: it joins the army the order
 * is forming there (while that army waits there, not fighting and not full), or forms
 * a new one. Returns the army, or null when it was not ordered by one.
 */
export function orderRegiment(sim: Sim, nid: NationId, orderId: string | undefined, pid: ProvinceId, reg: Regiment, morale: number): Army | null {
  const o = orderOf(sim, nid, orderId);
  if (!o) return null;
  const st = sim.state;
  const g = st.armies[o.groups[pid]];
  let a: Army;
  if (g && g.nation === nid && g.location === pid && !g.battle && !g.retreating && !g.path.length && g.regiments.length < C.army.maxRegiments) {
    const oldMen = g.regiments.reduce((s, x) => s + x.men, 0);
    g.morale = (g.morale * oldMen + morale * reg.men) / (oldMen + reg.men);
    g.regiments.push(reg);
    a = g;
  } else {
    a = createArmy(sim, nid, pid, [reg], morale);
    o.groups[pid] = a.id;
    o.formed.push(a.id);
  }
  producedUnit(sim, nid, o, a.id, 'regiment');
  return a;
}

/**
 * A unit of an order is finished: it joins the order's operation (if it still exists),
 * wings move to the chosen airfield and fleets sail to the chosen zone, by the
 * ordinary orders (respecting range and routes). Told once, when the order is done.
 */
function producedUnit(sim: Sim, nid: NationId, o: ProductionOrder, unitId: string, kind: ProductionOrder['kind']): void {
  const st = sim.state;
  o.done++;
  const op = o.assign.op ? st.operations[o.assign.op] : null;
  if (op && op.nation === nid && op.status !== 'complete') {
    const u = kind === 'ship' ? st.fleets[unitId] : kind === 'wing' ? st.wings[unitId] : st.armies[unitId];
    if (u && u.op !== op.id) assignUnits(sim, op, [unitId]);
  } else if (o.assign.rally) {
    if (kind === 'wing' && st.wings[unitId] && st.wings[unitId].base !== o.assign.rally) applyCommand(sim, { type: 'rebaseWing', nation: nid, wing: unitId, base: o.assign.rally }, { auto: true });
    if (kind === 'ship' && st.fleets[unitId] && st.fleets[unitId].zone !== o.assign.rally && !st.fleets[unitId].path.length) applyCommand(sim, { type: 'moveFleet', nation: nid, fleet: unitId, zone: o.assign.rally }, { auto: true });
  }
  const t = orderTotals(o);
  if (o.done >= t.total) {
    const where = new Set(Object.keys(o.started)).size;
    notify(sim, nid, 'normal', 'production', `Production order complete: ${o.done} ${unitLabel(o.kind, o.unit, o.done).toLowerCase()}${where > 1 ? ` from ${where} places` : ` at ${provName(sim, Object.keys(o.started)[0])}`}${op ? `, with ${op.name}` : o.assign.rally ? `, ${kind === 'ship' ? 'sailing to' : kind === 'wing' ? 'moving to' : 'at'} ${kind === 'ship' ? zoneName(sim, o.assign.rally) : provName(sim, o.assign.rally)}` : ''}.`, { province: Object.keys(o.started)[0] });
  }
}

/** Squadrons of the order still sailing to its zone. */
export function enRoute(sim: Sim, o: ProductionOrder): number {
  if (o.kind !== 'ship' || !o.assign.rally || o.assign.op) return 0;
  return o.formed.filter((id) => sim.state.fleets[id]?.path.at(-1) === o.assign.rally).length;
}

/** Squadrons of an order that have reached its zone join up there (an ordinary merge). */
function gatherAtRally(sim: Sim, nid: NationId, o: ProductionOrder): void {
  const st = sim.state;
  o.formed = o.formed.filter((id) => (o.kind === 'ship' ? st.fleets[id] : st.armies[id]));
  if (o.kind !== 'ship' || !o.assign.rally || o.assign.op) return;
  const here = o.formed.map((id) => st.fleets[id]).filter((f) => f.nation === nid && f.zone === o.assign.rally && !f.path.length && !f.cargo.length && !f.op);
  if (here.length >= 2) applyCommand(sim, { type: 'mergeFleets', nation: nid, fleets: here.map((f) => f.id) }, { auto: true });
  o.formed = o.formed.filter((id) => st.fleets[id]);
}

export function productionSummary(sim: Sim, nid: NationId, o: ProductionOrder): string {
  const t = orderTotals(o);
  const busy = inProgress(sim, nid, o);
  const sailing = enRoute(sim, o);
  return `${o.done} finished, ${busy} under way, ${t.left} to start${sailing ? `, ${sailing} squadron${sailing === 1 ? '' : 's'} sailing to ${zoneName(sim, o.assign.rally!)}` : ''}${o.paused ? ' (paused)' : o.blocked ? ` — waiting: ${o.blocked.why}` : ''}`;
}

