// The navy: ports and shipyards, fleets moving between sea zones, naval
// battles, sea control (straits, blockades and raiding), shore bombardment and
// armies carried by sea.
//
// Weekly, before armies move (tick.ts): fleets move one zone per movement point
// (a fleet entering a zone held by enemy warships stops there); aircraft fly
// their sea missions (air.ts seaAir: air cover, patrols, naval strikes); hostile
// fleets sharing a zone fight up to three rounds; carried armies land on their
// target coast; fleets near a friendly port repair, and fleets far from every
// friendly port wear down. Shipyards deliver ships later in the week.
//
// Battle round: both sides fire at once. Guns hit surface ships (transports and
// carriers behind enough screens and cruisers are hard to hit), submarine
// torpedoes go for the big ships, and anti-submarine fire is the only thing that
// hurts submarines (half as much again under a reconnaissance patrol of ours).
// Aircraft take no part in the surface battle: carriers' wings strike in the air
// phase before it, from wherever they reach; a side struck that week with no air
// cover of its own is out-ranged (its guns fire at 30%, then 60%, then in full).
// Damage is fire × 32 × roll ÷ the
// target's hull, spread over targets by size. A side falling below half its
// starting fighting value withdraws towards its home port.
//
// Sea control: a realm's crossing of a strait is closed while enemy surface
// warships in the commanding zone outgun its own there. A coastal province is
// blockaded when every zone on its coast holds enemy warships (submarines count
// half) at least twice our surface power there: it loses a quarter of its
// crowns, its shipyard stops, and the realm's sea trade shrinks with the
// blockaded share of its coast. Raiders (submarines, cruisers) in any zone on the
// sea route between two trading realms take a share of what passes, less what
// escorts there (screens, cruisers) stop. Gun ships lying still off a coast where
// our armies fight shell the enemy (combat.ts reads bombardPlan); coastal forts
// fire back.

import { mergeAir, outrangedThisWeek, portBombed, relocateAir, reportFleet, seaAir, splitAir, subsExposed, wingsAboard } from './air';
import { C, SHIPS, SHIP_TYPES } from './config';
import { memoGeo, memoize, touchArmies } from './index';
import { armyCap } from './influence';
import { nationMods } from './modifiers';
import { range } from './rng';
import { addContribution, atWar, borders, isFriendly, notify, provName, type Sim } from './state';
import type { Army, BattleReport, Fleet, FleetId, NationId, ProvinceId, Ship, ShipType, StrategicResource, ZoneId } from './types';
import { edgeKey } from './world';

// ───────────────────────────── Lookups ──────────────────────────────────────

const fleetGen = new WeakMap<object, number>();

/** Call after creating, removing or moving a fleet. */
export function touchFleets(sim: Sim): void {
  fleetGen.set(sim.state.fleets, (fleetGen.get(sim.state.fleets) ?? 0) + 1);
}

/** Changes whenever fleets change (a cache key for anything that depends on sea control). */
export function fleetEpoch(sim: Sim): number {
  return fleetGen.get(sim.state.fleets) ?? 0;
}

interface FleetIndex {
  key: string;
  at: Map<ZoneId, Fleet[]>;
  of: Map<NationId, Fleet[]>;
}
const fleetIdx = new WeakMap<object, FleetIndex>();
const NONE: readonly Fleet[] = Object.freeze([]);

function fleetIndex(sim: Sim): FleetIndex {
  const st = sim.state;
  const key = `${st.tick}|${fleetGen.get(st.fleets) ?? 0}`;
  let ix = fleetIdx.get(st.fleets);
  if (ix && ix.key === key) return ix;
  const at = new Map<ZoneId, Fleet[]>();
  const of = new Map<NationId, Fleet[]>();
  for (const id of Object.keys(st.fleets).sort()) {
    const f = st.fleets[id];
    (at.get(f.zone) ?? at.set(f.zone, []).get(f.zone)!).push(f);
    (of.get(f.nation) ?? of.set(f.nation, []).get(f.nation)!).push(f);
  }
  ix = { key, at, of };
  fleetIdx.set(st.fleets, ix);
  return ix;
}

/** Fleets in a sea zone, in id order (shared array: do not modify). */
export function fleetsIn(sim: Sim, zone: ZoneId): readonly Fleet[] {
  return fleetIndex(sim).at.get(zone) ?? NONE;
}

/** Fleets of a realm, in id order (shared array: do not modify). */
export function fleetsOf(sim: Sim, nid: NationId): readonly Fleet[] {
  return fleetIndex(sim).of.get(nid) ?? NONE;
}

export function zoneName(sim: Sim, zone: ZoneId): string {
  return sim.world.zones[zone]?.name ?? zone;
}

/** The sea zone a port launches into (the first zone on its coast). */
export function portZone(sim: Sim, pid: ProvinceId): ZoneId | null {
  return sim.world.provZones[pid]?.[0] ?? null;
}

export function isCoastal(sim: Sim, pid: ProvinceId): boolean {
  return !!sim.world.provZones[pid]?.length;
}

/** Ports a realm owns and controls (level ≥ 1). */
export function portsOf(sim: Sim, nid: NationId): ProvinceId[] {
  return sim.world.provIds.filter((pid) => {
    const p = sim.state.provinces[pid];
    return p.port > 0 && p.owner === nid && p.controller === nid;
  });
}

// ───────────────────────────── Ships ────────────────────────────────────────

/** Does the ship burn oil (always for submarines and carriers; others after Oil-Fired Boilers)? */
export function burnsOil(sim: Sim, nid: NationId, type: ShipType): boolean {
  return SHIPS[type].oil || nationMods(sim, nid).oilFiring > 0;
}

/** A realm short of a fleet's fuel: ships fight weaker and sail slower. */
function fuelled(sim: Sim, nid: NationId, type: ShipType): boolean {
  const short = sim.state.nations[nid]?.shortages ?? [];
  return !short.includes(burnsOil(sim, nid, type) ? 'oil' : 'coal');
}

export function fleetSpeed(sim: Sim, f: Fleet): number {
  if (!f.ships.length) return 1;
  let s = Infinity;
  let dry = false;
  for (const sh of f.ships) {
    s = Math.min(s, SHIPS[sh.type].speed);
    if (!fuelled(sim, f.nation, sh.type)) dry = true;
  }
  return s * Math.max(0.3, 1 + nationMods(sim, f.nation).fleetSpeed) * (dry ? 0.5 : 1);
}

/** Regiments a fleet can carry (transports afloat). */
export function fleetCapacity(f: Fleet): number {
  let c = 0;
  for (const s of f.ships) c += SHIPS[s.type].capacity;
  return c;
}

export function cargoRegiments(sim: Sim, f: Fleet): number {
  let n = 0;
  for (const id of f.cargo) n += sim.state.armies[id]?.regiments.length ?? 0;
  return n;
}

/** Surface fighting power (guns and torpedoes) of a fleet's warships; a carrier's guns are light, its strength is its aircraft. */
export function surfacePower(f: Fleet): number {
  let p = 0;
  for (const s of f.ships) {
    if (s.type === 'submarine' || s.type === 'transport') continue;
    const r = SHIPS[s.type];
    p += (r.gun + r.torpedo) * (s.hp / 100);
  }
  return p;
}

export function subPower(f: Fleet): number {
  let p = 0;
  for (const s of f.ships) if (s.type === 'submarine') p += SHIPS.submarine.torpedo * (s.hp / 100);
  return p;
}

/** Overall fighting value (used for withdrawal, AI and the interface). */
export function fleetValue(f: Fleet): number {
  let v = 0;
  for (const s of f.ships) {
    const r = SHIPS[s.type];
    v += (r.gun + r.torpedo + 0.5 * r.antiSub + r.aa * 0.5 + 0.1) * Math.sqrt(r.hull) * (s.hp / 100);
  }
  return v;
}

export function shipCount(f: Fleet): Record<ShipType, number> {
  const c = Object.fromEntries(SHIP_TYPES.map((t) => [t, 0])) as Record<ShipType, number>;
  for (const s of f.ships) c[s.type]++;
  return c;
}

export function fleetSummary(f: Fleet): string {
  const c = shipCount(f);
  return SHIP_TYPES.filter((t) => c[t])
    .map((t) => `${c[t]} ${SHIPS[t].abbr}`)
    .join(' · ');
}

export function newShip(sim: Sim, type: ShipType): Ship {
  sim.state.counters.ship++;
  return { id: `s${sim.state.counters.ship}`, type, hp: 100 };
}

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

export function createFleet(sim: Sim, nid: NationId, zone: ZoneId, ships: Ship[], home: ProvinceId | null, name?: string): Fleet {
  const st = sim.state;
  st.counters.fleet++;
  const id = `f${st.counters.fleet}`;
  const n = fleetsOf(sim, nid).length;
  const adj = sim.world.nationDefs[nid]?.adjective ?? nid;
  const f: Fleet = { id, nation: nid, name: name ?? `${adj} ${ORDINALS[n] ?? `${n + 1}th`} Squadron`, zone, path: [], progress: 0, ships, home, cargo: [], landing: null, task: null };
  st.fleets[id] = f;
  touchFleets(sim);
  return f;
}

/** Removes a fleet; any armies aboard are lost with it, and its air group flies ashore if it can. */
export function removeFleet(sim: Sim, f: Fleet, drownCargo = true): void {
  const st = sim.state;
  if (wingsAboard(sim, f.id).length) {
    const zone = f.zone;
    f.ships = [];
    relocateAir(sim, f.id, zone);
  }
  if (drownCargo) {
    for (const id of f.cargo) {
      const a = st.armies[id];
      if (!a) continue;
      let men = 0;
      for (const r of a.regiments) men += r.men;
      st.nations[a.nation].stats.menLost += men;
      delete st.armies[id];
    }
    if (f.cargo.length) touchArmies(sim);
  }
  delete st.fleets[f.id];
  touchFleets(sim);
}

/** The best home port for a realm's fleet in `zone` (a port on that coast, else its biggest port). */
export function homePortFor(sim: Sim, nid: NationId, zone: ZoneId | null): ProvinceId | null {
  const ports = portsOf(sim, nid);
  if (!ports.length) return null;
  const st = sim.state;
  const onCoast = zone ? ports.filter((p) => sim.world.provZones[p]?.includes(zone)) : [];
  const pool = onCoast.length ? onCoast : ports;
  return [...pool].sort((a, b) => st.provinces[b].port - st.provinces[a].port || (a < b ? -1 : 1))[0];
}

/** Starting fleets: every realm with a port gets a squadron at its best port. */
export function startingFleets(sim: Sim): void {
  const st = sim.state;
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    if (!n.alive) continue;
    const ports = portsOf(sim, nid);
    if (!ports.length) continue;
    const capital = n.capital && ports.includes(n.capital) ? n.capital : null;
    const home = capital ?? [...ports].sort((a, b) => st.provinces[b].port - st.provinces[a].port || st.provinces[b].dev - st.provinces[a].dev || (a < b ? -1 : 1))[0];
    const zone = portZone(sim, home)!;
    const types: ShipType[] = ['cruiser', 'transport'];
    if (n.research.done.includes('torpedo_boats')) types.push('screen', 'screen');
    if (ports.length >= C.naval.startFleetPorts) types.push('capital');
    createFleet(sim, nid, zone, types.map((t) => newShip(sim, t)), home, `${sim.world.nationDefs[nid].adjective} Home Fleet`);
  }
}

// ───────────────────────────── Shipyards ────────────────────────────────────

export interface ShipCost {
  crowns: number;
  materiel: number;
  resources: Partial<Record<StrategicResource, number>>;
  weeks: number;
}

export function shipCost(sim: Sim, nid: NationId, type: ShipType): ShipCost {
  const r = SHIPS[type];
  const m = nationMods(sim, nid);
  return {
    crowns: Math.round(r.cost * Math.max(0.3, 1 + m.shipCost)),
    materiel: Math.round(r.materiel * Math.max(0.3, 1 + m.materielCost)),
    resources: { ...r.resources },
    weeks: r.weeks,
  };
}

export function shipUnlocked(sim: Sim, nid: NationId, type: ShipType): boolean {
  const req = SHIPS[type].requires;
  return !req || sim.state.nations[nid].research.done.includes(req);
}

export function buildShipProblem(sim: Sim, nid: NationId, pid: ProvinceId, type: ShipType): string | null {
  const st = sim.state;
  const n = st.nations[nid];
  const p = st.provinces[pid];
  if (!n?.alive) return 'Your realm has fallen.';
  if (!p) return 'Unknown province.';
  if (!SHIPS[type]) return 'Unknown ship type.';
  if (p.owner !== nid || p.controller !== nid) return 'Ships are built only in ports we own and hold.';
  if (p.port < 1) return 'This province has no port. Build one first.';
  if (!shipUnlocked(sim, nid, type)) return `${SHIPS[type].plural} need the technology ${SHIPS[type].requires!.replace(/_/g, ' ')}.`;
  if (p.dock.length >= p.port) return `The shipyard is busy (${p.dock.length} of ${p.port} slipways in use).`;
  if ((type === 'capital' || type === 'carrier') && armyCap(sim, nid) !== null) return 'Disarmed by treaty: no battleships or carriers until the limit expires.';
  const c = shipCost(sim, nid, type);
  if (n.treasury < c.crowns) return `Needs ${c.crowns} crowns (treasury ${Math.floor(n.treasury)}).`;
  if (n.materiel < c.materiel) return `Needs ${c.materiel} materiel (stockpile ${Math.floor(n.materiel)}).`;
  for (const [r, v] of Object.entries(c.resources)) if ((n.stock[r as StrategicResource] ?? 0) < (v ?? 0)) return `Needs ${v} ${r} (stockpile ${Math.floor(n.stock[r as StrategicResource])}).`;
  return null;
}

export function startShip(sim: Sim, nid: NationId, pid: ProvinceId, type: ShipType): void {
  const n = sim.state.nations[nid];
  const c = shipCost(sim, nid, type);
  n.treasury -= c.crowns;
  n.materiel -= c.materiel;
  for (const [r, v] of Object.entries(c.resources)) n.stock[r as StrategicResource] -= v ?? 0;
  sim.state.provinces[pid].dock.push({ nation: nid, ship: type, weeksLeft: c.weeks });
}

/** Cancels the newest ship on the slipway: materiel and resources come back, crowns do not. */
export function cancelShip(sim: Sim, nid: NationId, pid: ProvinceId): boolean {
  const p = sim.state.provinces[pid];
  const i = p.dock.map((o) => o.nation).lastIndexOf(nid);
  if (i < 0) return false;
  const o = p.dock[i];
  const c = shipCost(sim, nid, o.ship);
  const n = sim.state.nations[nid];
  n.materiel += c.materiel;
  for (const [r, v] of Object.entries(c.resources)) n.stock[r as StrategicResource] += v ?? 0;
  p.dock.splice(i, 1);
  return true;
}

export function weeklyShipyards(sim: Sim): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.dock.length) continue;
    for (let i = p.dock.length - 1; i >= 0; i--) {
      const o = p.dock[i];
      if (p.owner !== o.nation || !st.nations[o.nation]?.alive) {
        p.dock.splice(i, 1); // the yard is lost with the port
        continue;
      }
      if (p.controller !== o.nation) continue; // work stops under occupation
      if (portBombed(sim, pid) || provinceBlockaded(sim, pid)) continue; // and under the bombs, or a blockade
      o.weeksLeft--;
      if (o.weeksLeft > 0) continue;
      p.dock.splice(i, 1);
      const zone = portZone(sim, pid);
      if (!zone) continue;
      const ship = newShip(sim, o.ship);
      const join = fleetsIn(sim, zone).find((f) => f.nation === o.nation && f.home === pid && !f.path.length && !f.cargo.length);
      if (join) join.ships.push(ship);
      else createFleet(sim, o.nation, zone, [ship], pid);
      st.nations[o.nation].stats.shipsBuilt++;
      notify(sim, o.nation, 'low', 'navy', `A new ${SHIPS[o.ship].label.toLowerCase()} has left the yards of ${provName(sim, pid)}.`, { province: pid });
    }
  }
}

// ───────────────────────────── Routes ───────────────────────────────────────

/** Shortest route between sea zones (breadth-first, neighbours in id order); null if unconnected. */
export function zonePath(sim: Sim, from: ZoneId, to: ZoneId): ZoneId[] | null {
  if (from === to) return [];
  const prev = new Map<ZoneId, ZoneId>([[from, from]]);
  const q = [from];
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const nb of [...(sim.world.zones[c]?.neighbors ?? [])].sort()) {
      if (prev.has(nb)) continue;
      prev.set(nb, c);
      if (nb === to) {
        const path = [to];
        for (let x = c; x !== from; x = prev.get(x)!) path.unshift(x);
        return path;
      }
      q.push(nb);
    }
  }
  return null;
}

/** Route to the nearest zone on a province's coast. */
export function pathToCoast(sim: Sim, from: ZoneId, pid: ProvinceId): ZoneId[] | null {
  const targets = sim.world.provZones[pid] ?? [];
  if (targets.includes(from)) return [];
  let best: ZoneId[] | null = null;
  for (const z of targets) {
    const p = zonePath(sim, from, z);
    if (p && (!best || p.length < best.length)) best = p;
  }
  return best;
}

/** Weeks for a fleet to sail a route. */
export function fleetEta(sim: Sim, f: Fleet, path: ZoneId[]): number {
  return Math.ceil(Math.max(0, path.length - f.progress) / Math.max(0.1, fleetSpeed(sim, f)));
}

// ───────────────────────────── Sea control ──────────────────────────────────

interface Balance {
  friendSurface: number;
  hostileSurface: number;
  hostileSubs: number;
}

/** Naval balance in a zone from `nid`'s side (friends: us, allies, co-belligerents). */
export function zoneBalance(sim: Sim, zone: ZoneId, nid: NationId): Balance {
  return memoGeo(sim, 'zoneBalance', `${zone}|${nid}|${fleetEpoch(sim)}`, () => {
    const b: Balance = { friendSurface: 0, hostileSurface: 0, hostileSubs: 0 };
    for (const f of fleetsIn(sim, zone)) {
      if (atWar(sim, nid, f.nation)) {
        b.hostileSurface += surfacePower(f);
        b.hostileSubs += subPower(f);
      } else if (isFriendly(sim, nid, f.nation)) b.friendSurface += surfacePower(f);
    }
    return b;
  });
}

/** Is a strait crossing closed to `nid` (enemy warships outgun ours in the zone that commands it)? */
export function straitBlocked(sim: Sim, nid: NationId, a: ProvinceId, b: ProvinceId): boolean {
  const zone = sim.world.straitZone.get(edgeKey(a, b));
  if (!zone) return false;
  const z = zoneBalance(sim, zone, nid);
  return z.hostileSurface > 0 && z.friendSurface < z.hostileSurface;
}

/** Is this zone blockaded against `nid`? */
export function zoneBlockaded(sim: Sim, zone: ZoneId, nid: NationId): boolean {
  const z = zoneBalance(sim, zone, nid);
  const hostile = z.hostileSurface + 0.5 * z.hostileSubs;
  return hostile > 0 && z.friendSurface * C.naval.blockadeRatio < hostile;
}

/** Is a coastal province blockaded (every zone on its coast)? */
export function provinceBlockaded(sim: Sim, pid: ProvinceId): boolean {
  const owner = sim.state.provinces[pid].owner;
  const zones = sim.world.provZones[pid];
  if (!owner || !zones?.length) return false;
  return zones.every((z) => zoneBlockaded(sim, z, owner));
}

/** Share of a realm's coastal development that is blockaded (0–1). */
export function blockadeShare(sim: Sim, nid: NationId): number {
  return memoGeo(sim, 'blockadeShare', `${nid}|${fleetEpoch(sim)}`, () => {
    let all = 0;
    let cut = 0;
    for (const pid of sim.world.provIds) {
      const p = sim.state.provinces[pid];
      if (p.owner !== nid || !sim.world.provZones[pid]) continue;
      all += p.dev;
      if (provinceBlockaded(sim, pid)) cut += p.dev;
    }
    return all > 0 ? cut / all : 0;
  });
}

/** How much of a trade agreement's flow still gets through (land neighbours trade overland): blockades of either coast, then raiders on the route. */
export function tradeOpen(sim: Sim, a: NationId, b: NationId): number {
  if (borders(sim, a, b)) return 1;
  const ra = Math.max(0, 1 + nationMods(sim, a).blockadeResist);
  const rb = Math.max(0, 1 + nationMods(sim, b).blockadeResist);
  const blockade = Math.max(0, 1 - blockadeShare(sim, a) * Math.min(1, ra * 0.7)) * Math.max(0, 1 - blockadeShare(sim, b) * Math.min(1, rb * 0.7));
  return blockade * (1 - raidLoss(sim, a, b).share);
}

// ───────────────────────────── Raiding ──────────────────────────────────────

/** The port a realm's sea trade leaves from: its capital if it is a port, else its biggest port (null: none). */
export function tradePort(sim: Sim, nid: NationId): ProvinceId | null {
  const st = sim.state;
  const cap = st.nations[nid]?.capital;
  if (cap && st.provinces[cap].port > 0 && st.provinces[cap].owner === nid && st.provinces[cap].controller === nid) return cap;
  const ports = portsOf(sim, nid);
  return ports.length ? [...ports].sort((x, y) => st.provinces[y].port - st.provinces[x].port || st.provinces[y].dev - st.provinces[x].dev || (x < y ? -1 : 1))[0] : null;
}

const routeCache = new WeakMap<object, Map<string, ZoneId[] | null>>();

/** The sea route trade takes between two realms (zones from one trade port's water to the other's, both ends included). */
export function tradeRoute(sim: Sim, a: NationId, b: NationId): ZoneId[] | null {
  const pa = tradePort(sim, a);
  const pb = tradePort(sim, b);
  const za = pa ? portZone(sim, pa) : null;
  const zb = pb ? portZone(sim, pb) : null;
  if (!za || !zb) return null;
  let per = routeCache.get(sim.world);
  if (!per) routeCache.set(sim.world, (per = new Map()));
  const k = za < zb ? `${za}|${zb}` : `${zb}|${za}`;
  if (!per.has(k)) {
    const path = zonePath(sim, za, zb);
    per.set(k, path ? [za, ...path] : null);
  }
  return per.get(k)!;
}

/** Raiding and escort power in a zone against trade of realm `nid` (raiders: at war with it; escorts: its friends'). */
export function raidBalance(sim: Sim, zone: ZoneId, nid: NationId): { raid: number; escort: number; raiders: NationId[] } {
  return memoGeo(sim, 'raidBalance', `${zone}|${nid}|${fleetEpoch(sim)}`, () => {
    let raid = 0;
    let escort = 0;
    const raiders: NationId[] = [];
    for (const f of fleetsIn(sim, zone)) {
      if (atWar(sim, nid, f.nation)) {
        let r = 0;
        for (const s of f.ships) r += SHIPS[s.type].raid * (s.hp / 100);
        if (r > 0) {
          raid += r;
          if (!raiders.includes(f.nation)) raiders.push(f.nation);
        }
      } else if (isFriendly(sim, nid, f.nation)) {
        const m = nationMods(sim, f.nation);
        for (const s of f.ships) escort += SHIPS[s.type].escort * (s.hp / 100) * Math.max(0.2, 1 + m.antiSub * 0.5);
      }
    }
    return { raid, escort, raiders };
  });
}

/** Share of a zone's passing trade that raiders take from realm `nid`'s side (escorts there turn them away). */
export function zoneRaid(sim: Sim, zone: ZoneId, nid: NationId): number {
  const b = raidBalance(sim, zone, nid);
  if (b.raid <= 0) return 0;
  const through = b.raid * (b.raid / (b.raid + 2.5 * b.escort));
  return Math.min(C.naval.raidZoneMax, C.naval.raidRate * through);
}

/** What raiders on the route take of the trade between two realms (0–0.75), and where. */
export function raidLoss(sim: Sim, a: NationId, b: NationId): { share: number; zones: ZoneId[] } {
  return memoGeo(sim, 'raidLoss', `${a < b ? a : b}|${a < b ? b : a}|${fleetEpoch(sim)}`, () => {
    const route = tradeRoute(sim, a, b);
    if (!route) return { share: 0, zones: [] };
    let keep = 1;
    const zones: ZoneId[] = [];
    for (const z of route) {
      // raiders at war with either partner prey on the convoy; the convoy's escorts are both partners' friends
      const r = Math.max(zoneRaid(sim, z, a), zoneRaid(sim, z, b));
      if (r <= 0) continue;
      keep *= 1 - r;
      zones.push(z);
    }
    const resist = Math.min(0.9, Math.max(nationMods(sim, a).blockadeResist, nationMods(sim, b).blockadeResist, 0));
    return { share: Math.min(C.naval.raidRouteMax, (1 - keep) * (1 - resist)), zones };
  });
}

// ───────────────────────────── Carrying armies ──────────────────────────────

/** Why these armies cannot be shipped by `fleet` to `dest` (null = they can). */
export function shipArmiesProblem(sim: Sim, nid: NationId, armyIds: string[], fleetId: FleetId, dest: ProvinceId): string | null {
  const st = sim.state;
  const f = st.fleets[fleetId];
  if (!f || f.nation !== nid) return 'Not our fleet.';
  if (!armyIds.length) return 'Choose the armies to ship.';
  if (!st.provinces[dest]) return 'Unknown destination.';
  if (!isCoastal(sim, dest)) return `${provName(sim, dest)} is not on the coast.`;
  const p = st.provinces[dest];
  const own = p.controller === nid || isFriendly(sim, nid, p.controller);
  if (!own && !(p.controller && atWar(sim, nid, p.controller)) && !(!p.owner && !p.controller)) return `We may land only on our own or friendly coasts, unclaimed land, or the coast of an enemy at war with us.`;
  let regs = cargoRegiments(sim, f);
  let from: ProvinceId | null = null;
  for (const id of armyIds) {
    const a = st.armies[id];
    if (!a || a.nation !== nid) return 'Not our army.';
    if (a.embarked) {
      if (a.embarked !== f.id) return `${a.name} is aboard another fleet.`;
      continue;
    }
    if (a.battle) return `${a.name} is fighting a battle.`;
    if (a.retreating) return `${a.name} is retreating.`;
    if (from && a.location !== from) return 'The armies must stand in the same province.';
    from = a.location;
    if (!(sim.world.provZones[a.location] ?? []).includes(f.zone)) return `${f.name} must lie in a sea zone on the coast of ${provName(sim, a.location)} to take ${a.name} aboard.`;
    regs += a.regiments.length;
  }
  const cap = fleetCapacity(f);
  if (regs > cap) return `Needs room for ${regs} regiments; ${f.name} carries ${cap} (2 per transport).`;
  if (from === dest) return 'The armies are already there.';
  if (!pathToCoast(sim, f.zone, dest)) return `No sea route from ${zoneName(sim, f.zone)} to the coast of ${provName(sim, dest)}.`;
  return null;
}

export function shipArmies(sim: Sim, nid: NationId, armyIds: string[], fleetId: FleetId, dest: ProvinceId): void {
  const st = sim.state;
  const f = st.fleets[fleetId];
  if (!f || f.nation !== nid) return;
  for (const id of armyIds) {
    const a = st.armies[id];
    if (a.embarked === f.id) continue;
    a.embarked = f.id;
    a.path = [];
    a.progress = 0;
    a.order = null;
    a.task = 'sea';
    f.cargo.push(id);
  }
  f.landing = dest;
  f.path = pathToCoast(sim, f.zone, dest) ?? [];
  f.progress = 0;
  touchArmies(sim);
  touchFleets(sim);
}

/** A fleet with room for these regiments lying off the coast of `pid` (most room first). */
export function transportFor(sim: Sim, nid: NationId, pid: ProvinceId, regiments: number): Fleet | null {
  const zones = sim.world.provZones[pid] ?? [];
  let best: Fleet | null = null;
  let room = -1;
  for (const z of zones) {
    for (const f of fleetsIn(sim, z)) {
      if (f.nation !== nid || f.cargo.length) continue;
      const r = fleetCapacity(f);
      if (r >= regiments && r > room) (room = r), (best = f);
    }
  }
  return best;
}

function land(sim: Sim, f: Fleet): void {
  const st = sim.state;
  const dest = f.landing!;
  for (const id of f.cargo) {
    const a = st.armies[id];
    if (!a) continue;
    a.embarked = null;
    a.location = dest;
    a.path = [];
    a.progress = 0;
    a.stationary = 0;
    a.landed = st.tick;
    a.lastMove = { from: dest, tick: st.tick };
    a.task = null;
  }
  const n = st.nations[f.nation];
  n.stats.landings++;
  const enemy = st.provinces[dest].controller && atWar(sim, f.nation, st.provinces[dest].controller!);
  notify(sim, f.nation, enemy ? 'normal' : 'low', 'navy', `${f.name} has landed ${f.cargo.length === 1 ? st.armies[f.cargo[0]]?.name ?? 'an army' : `${f.cargo.length} armies`} at ${provName(sim, dest)}${enemy ? ' on an enemy coast' : ''}.`, { province: dest });
  if (enemy) notify(sim, st.provinces[dest].controller, 'urgent', 'navy', `Enemy troops of ${sim.world.nationDefs[f.nation].short} have come ashore at ${provName(sim, dest)}!`, { province: dest });
  f.cargo = [];
  f.landing = null;
  touchArmies(sim);
}

// ───────────────────────────── Weekly naval phase ───────────────────────────

function moveFleets(sim: Sim): void {
  const st = sim.state;
  for (const id of Object.keys(st.fleets).sort()) {
    const f = st.fleets[id];
    if (!f || !f.path.length) continue;
    f.progress += fleetSpeed(sim, f);
    while (f.progress >= 1 && f.path.length) {
      f.progress -= 1;
      f.zone = f.path.shift()!;
      touchFleets(sim);
      // enemy warships here stop us: battle this week
      if (fleetsIn(sim, f.zone).some((o) => atWar(sim, f.nation, o.nation) && (surfacePower(o) > 0 || subPower(o) > 0))) {
        f.progress = 0;
        break;
      }
    }
    if (!f.path.length) f.progress = 0;
  }
}

interface ShipFire {
  gun: number;
  torpedo: number;
  antiSub: number;
}

function sideFire(sim: Sim, fleets: Fleet[]): ShipFire {
  const out: ShipFire = { gun: 0, torpedo: 0, antiSub: 0 };
  for (const f of fleets) {
    const m = nationMods(sim, f.nation);
    for (const s of f.ships) {
      if (s.hp <= 0) continue;
      const r = SHIPS[s.type];
      const q = (s.hp / 100) * (fuelled(sim, f.nation, s.type) ? 1 : C.naval.unfuelled);
      out.gun += r.gun * q * Math.max(0.2, 1 + m.navalAttack + (s.type === 'capital' ? m.capitalAttack : 0));
      out.torpedo += r.torpedo * q * Math.max(0.2, 1 + m.navalAttack);
      out.antiSub += r.antiSub * q * Math.max(0.2, 1 + m.antiSub);
    }
  }
  return out;
}

/** Spreads `power` over targets by weight; damage per ship is power × K × roll ÷ hull. */
function spread(targets: Array<{ s: Ship; w: number }>, power: number, roll: number, hits: Map<Ship, number>): void {
  if (power <= 0 || !targets.length) return;
  let sum = 0;
  for (const t of targets) sum += t.w;
  if (sum <= 0) return;
  for (const t of targets) {
    const dmg = (power * C.naval.damage * roll * (t.w / sum)) / SHIPS[t.s.type].hull;
    hits.set(t.s, (hits.get(t.s) ?? 0) + dmg);
  }
}

function fireAt(sim: Sim, zone: ZoneId, att: Fleet[], def: Fleet[], round: number, roll: number, hits: Map<Ship, number>): void {
  const fire = sideFire(sim, att);
  // a side bombed this week with no air cover of its own is out-ranged: its guns find the range only late
  if (att.length && att.every((f) => outrangedThisWeek(sim, f.id))) fire.gun *= C.naval.outranged[Math.min(round, C.naval.outranged.length) - 1];
  // a reconnaissance patrol overhead shows the hunters where the submarines are
  if (att.length && subsExposed(sim, zone, att[0].nation)) fire.antiSub *= 1.5;
  const live = def.flatMap((f) => f.ships.filter((s) => s.hp > 0));
  const escorts = live.filter((s) => s.type === 'screen' || s.type === 'cruiser').length;
  const valuables = live.filter((s) => s.type === 'transport' || s.type === 'carrier').length;
  const screened = escorts > 0 && escorts >= valuables;
  const surface = live.filter((s) => s.type !== 'submarine').map((s) => ({ s, w: Math.sqrt(SHIPS[s.type].hull) * (screened && (s.type === 'transport' || s.type === 'carrier') ? C.naval.screened : 1) }));
  const subs = live.filter((s) => s.type === 'submarine').map((s) => ({ s, w: 1 }));
  // guns on the surface (aircraft strike in the air phase before the battle, not here)
  spread(surface, fire.gun, roll, hits);
  // torpedoes go for the big ships; submarines are hit only by anti-submarine fire
  spread(
    surface.map((t) => ({ s: t.s, w: t.w * (t.s.type === 'capital' || t.s.type === 'carrier' || t.s.type === 'transport' ? 3 : 1) })),
    fire.torpedo,
    roll,
    hits,
  );
  spread(subs, fire.antiSub, roll, hits);
}

function sideValue(fleets: Fleet[]): number {
  let v = 0;
  for (const f of fleets) v += fleetValue(f);
  return v;
}

/** Regiments aboard that no longer fit in the transports afloat are lost, last aboard first. */
export function drownExcess(sim: Sim, f: Fleet): void {
  const st = sim.state;
  if (!f.cargo.length) return;
  let excess = cargoRegiments(sim, f) - fleetCapacity(f);
  for (let i = f.cargo.length - 1; i >= 0 && excess > 0; i--) {
    const a = st.armies[f.cargo[i]];
    if (!a) continue;
    while (excess > 0 && a.regiments.length) {
      const reg = a.regiments.pop()!;
      st.nations[a.nation].stats.menLost += reg.men;
      excess--;
    }
    if (!a.regiments.length) {
      delete st.armies[a.id];
      f.cargo.splice(i, 1);
      touchArmies(sim);
    }
  }
}

/** Fleets struck from the air: ships sunk are removed (troops aboard drown, air groups relocate), empty fleets go. */
function sinkStruck(sim: Sim, fleets: Fleet[]): void {
  for (const f of fleets) {
    if (!sim.state.fleets[f.id]) continue;
    const before = f.ships.length;
    f.ships = f.ships.filter((s) => s.hp > 0.5);
    const lost = before - f.ships.length;
    if (!lost) continue;
    sim.state.nations[f.nation].stats.shipsLost += lost;
    drownExcess(sim, f);
    if (!f.ships.length) removeFleet(sim, f);
    else relocateAir(sim, f.id);
  }
  if (fleets.length) touchFleets(sim);
}

/** Fights one naval battle in a zone; returns the side that withdrew (or null). */
function navalBattle(sim: Sim, zone: ZoneId, A: Fleet[], B: Fleet[]): void {
  const st = sim.state;
  const startA = sideValue(A);
  const startB = sideValue(B);
  const shipsBefore = new Map<NationId, number>();
  for (const f of [...A, ...B]) shipsBefore.set(f.nation, (shipsBefore.get(f.nation) ?? 0) + f.ships.length);
  let rounds = 0;
  let withdrew: 'A' | 'B' | null = null;
  for (let r = 1; r <= C.naval.rounds; r++) {
    rounds = r;
    const rollA = range(st.rng, C.combat.rollMin, C.combat.rollMax);
    const rollB = range(st.rng, C.combat.rollMin, C.combat.rollMax);
    const hits = new Map<Ship, number>();
    fireAt(sim, zone, A, B, r, rollA, hits);
    fireAt(sim, zone, B, A, r, rollB, hits);
    for (const [s, d] of hits) s.hp = Math.max(0, s.hp - d);
    for (const f of [...A, ...B]) f.ships = f.ships.filter((s) => s.hp > 0.5);
    const va = sideValue(A);
    const vb = sideValue(B);
    if (va < startA * C.naval.withdrawAt || vb < startB * C.naval.withdrawAt) {
      withdrew = va / Math.max(1e-9, startA) <= vb / Math.max(1e-9, startB) ? 'A' : 'B';
      break;
    }
  }
  // regiments aboard sunk transports go down with them; carriers sunk take their air groups' decks
  for (const f of [...A, ...B]) {
    drownExcess(sim, f);
    if (f.ships.length) relocateAir(sim, f.id);
  }
  const after = new Map<NationId, number>();
  for (const f of [...A, ...B]) after.set(f.nation, (after.get(f.nation) ?? 0) + f.ships.length);
  const lostBy = (side: Fleet[]) => [...new Set(side.map((f) => f.nation))].reduce((s, n) => s + (shipsBefore.get(n) ?? 0) - (after.get(n) ?? 0), 0);
  const lossA = lostBy(A);
  const lossB = lostBy(B);
  const nationsA = [...new Set(A.map((f) => f.nation))];
  const nationsB = [...new Set(B.map((f) => f.nation))];
  const winner: 'A' | 'B' = withdrew ? (withdrew === 'A' ? 'B' : 'A') : sideValue(A) / Math.max(1e-9, startA) >= sideValue(B) / Math.max(1e-9, startB) ? 'A' : 'B';
  for (const n of nationsA) {
    const s = st.nations[n].stats;
    s.navalBattles++;
    s.shipsLost += (shipsBefore.get(n) ?? 0) - (after.get(n) ?? 0);
    s.shipsSunk += lossB / nationsA.length;
  }
  for (const n of nationsB) {
    const s = st.nations[n].stats;
    s.navalBattles++;
    s.shipsLost += (shipsBefore.get(n) ?? 0) - (after.get(n) ?? 0);
    s.shipsSunk += lossA / nationsB.length;
  }
  // the beaten side falls back towards home; empty fleets are gone
  const losers = withdrew === 'A' ? A : withdrew === 'B' ? B : [];
  for (const f of losers) {
    if (!f.ships.length) continue;
    const home = f.home ? portZone(sim, f.home) : null;
    const nbs = [...(sim.world.zones[zone]?.neighbors ?? [])].sort();
    let to: ZoneId | null = null;
    let best = Infinity;
    for (const nb of nbs) {
      const d = home ? sim.world.zoneHop(nb, home) ?? 99 : 0;
      if (d < best) (best = d), (to = nb);
    }
    if (to) {
      f.zone = to;
      f.path = [];
      f.progress = 0;
    }
  }
  for (const f of [...A, ...B]) if (!f.ships.length) removeFleet(sim, f);
  touchFleets(sim);
  // contribution to the wars between the two sides: holding the sea, and ships sunk
  for (const wid of Object.keys(st.wars).sort()) {
    const w = st.wars[wid];
    const aAtt = nationsA.some((n) => w.attackers.includes(n)) && nationsB.some((n) => w.defenders.includes(n));
    const aDef = nationsA.some((n) => w.defenders.includes(n)) && nationsB.some((n) => w.attackers.includes(n));
    if (!aAtt && !aDef) continue;
    for (const n of nationsA) addContribution(w, n, (winner === 'A' ? 1 : 0) + lossB / Math.max(1, nationsA.length));
    for (const n of nationsB) addContribution(w, n, (winner === 'B' ? 1 : 0) + lossA / Math.max(1, nationsB.length));
  }
  st.counters.battle++;
  const report: BattleReport = {
    id: `nb${st.counters.battle}`,
    tick: st.tick,
    province: zone,
    attackerNations: nationsA,
    defenderNations: nationsB,
    attStartMen: [...shipsBefore].filter(([n]) => nationsA.includes(n)).reduce((s, [, v]) => s + v, 0),
    defStartMen: [...shipsBefore].filter(([n]) => nationsB.includes(n)).reduce((s, [, v]) => s + v, 0),
    attLosses: lossA,
    defLosses: lossB,
    winner: winner === 'A' ? 'attacker' : 'defender',
    rounds,
    factors: [],
    outcome: `${withdrew ? `${withdrew === 'A' ? sim.world.nationDefs[nationsA[0]].short : sim.world.nationDefs[nationsB[0]].short} withdrew` : 'Indecisive'}; ships lost ${lossA}–${lossB}`,
    sea: true,
  };
  st.reports.push(report);
  if (st.reports.length > 60) st.reports.splice(0, st.reports.length - 60);
  const text = (other: NationId[], lossMine: number, lossOther: number, won: boolean) =>
    `Naval battle in ${zoneName(sim, zone)} against ${sim.world.nationDefs[other[0]].short}: ${won ? 'we hold the sea' : 'we were driven off'} (ships lost: ours ${lossMine}, theirs ${lossOther}).`;
  for (const n of nationsA) notify(sim, n, 'normal', 'navy', text(nationsB, lossA, lossB, winner === 'A'));
  for (const n of nationsB) notify(sim, n, 'normal', 'navy', text(nationsA, lossB, lossA, winner === 'B'));
}

function fightBattles(sim: Sim): void {
  for (const zone of sim.world.zoneIds) {
    const here = fleetsIn(sim, zone).filter((f) => f.ships.length);
    if (here.length < 2) continue;
    const lead = here.find((f) => here.some((o) => atWar(sim, f.nation, o.nation)));
    if (!lead) continue;
    const A = here.filter((f) => f.nation === lead.nation || (isFriendly(sim, lead.nation, f.nation) && !atWar(sim, lead.nation, f.nation)));
    const B = here.filter((f) => atWar(sim, lead.nation, f.nation));
    if (!B.length) continue;
    navalBattle(sim, zone, A, B);
  }
}

function landArmies(sim: Sim): void {
  const st = sim.state;
  for (const id of Object.keys(st.fleets).sort()) {
    const f = st.fleets[id];
    if (!f || !f.cargo.length || !f.landing) continue;
    if (f.path.length || !(sim.world.provZones[f.landing] ?? []).includes(f.zone)) continue;
    // contested water: no landing while enemy warships hold the zone
    const z = zoneBalance(sim, f.zone, f.nation);
    if (z.hostileSurface > z.friendSurface) {
      reportFleet(sim, f, `Waiting off ${provName(sim, f.landing)}: enemy warships outgun ours in ${zoneName(sim, f.zone)}, so the troops cannot land. Bring warships to win these waters.`);
      continue;
    }
    const p = st.provinces[f.landing];
    const open = p.controller === f.nation || isFriendly(sim, f.nation, p.controller) || (p.controller && atWar(sim, f.nation, p.controller)) || (!p.owner && !p.controller);
    if (!open) {
      // the war ended under way: sail home and land there
      const home = f.home && st.provinces[f.home].controller === f.nation ? f.home : homePortFor(sim, f.nation, f.zone);
      if (home && home !== f.landing) {
        f.landing = home;
        f.path = pathToCoast(sim, f.zone, home) ?? [];
        notify(sim, f.nation, 'normal', 'navy', `${f.name} cannot land at ${provName(sim, p.id)} any more and is bringing its troops home.`);
      }
      continue;
    }
    land(sim, f);
  }
}

function repairAndWear(sim: Sim): void {
  const st = sim.state;
  for (const id of Object.keys(st.fleets).sort()) {
    const f = st.fleets[id];
    const coast = sim.world.zones[f.zone]?.coasts ?? [];
    let port = 0;
    for (const pid of coast) {
      const p = st.provinces[pid];
      if (p.port > port && p.controller && p.owner === p.controller && isFriendly(sim, f.nation, p.controller)) port = p.port;
    }
    const contested = zoneBalance(sim, f.zone, f.nation).hostileSurface > 0;
    if (port > 0 && !contested) {
      // a port under the bombs repairs at half rate
      const bombed = coast.some((pid) => sim.state.provinces[pid].port > 0 && portBombed(sim, pid));
      const gain = C.naval.repair * port * Math.max(0.2, 1 + nationMods(sim, f.nation).repair) * (bombed ? 0.5 : 1);
      for (const s of f.ships) s.hp = Math.min(100, s.hp + gain);
      continue;
    }
    // far from every friendly port: wear
    let near = Infinity;
    for (const pid of portsOf(sim, f.nation)) for (const z of sim.world.provZones[pid] ?? []) near = Math.min(near, sim.world.zoneHop(f.zone, z) ?? Infinity);
    if (near > C.naval.rangeZones) for (const s of f.ships) s.hp = Math.max(20, s.hp - C.naval.attrition);
  }
}

function blockadeStats(sim: Sim): void {
  for (const nid of sim.world.nationIds) {
    const n = sim.state.nations[nid];
    if (!n.alive) continue;
    if (fleetsOf(sim, nid).some((f) => f.ships.some((s) => s.type !== 'transport') && f.home && portZone(sim, f.home) !== f.zone)) n.stats.seaWeeks++;
    if (fleetsOf(sim, nid).some((f) => f.ships.some((s) => SHIPS[s.type].raid > 0) && raidingHere(sim, f).length)) n.stats.raidWeeks++;
    // count weeks this realm blockades someone else's coast
    for (const f of fleetsOf(sim, nid)) {
      const coast = sim.world.zones[f.zone]?.coasts ?? [];
      if (coast.some((pid) => sim.state.provinces[pid].owner && atWar(sim, nid, sim.state.provinces[pid].owner!) && provinceBlockaded(sim, pid))) {
        n.stats.blockadeWeeks++;
        break;
      }
    }
  }
}

/** The weekly naval phase (before army movement). */
export function weeklyNaval(sim: Sim): void {
  if (!sim.world.zoneIds.length) return;
  moveFleets(sim);
  // aircraft strike and cover at sea before the guns close
  sinkStruck(sim, seaAir(sim));
  fightBattles(sim);
  landArmies(sim);
  repairAndWear(sim);
  blockadeStats(sim);
}

/** Enemy trade routes a fleet's raiders lie across this week: the realms whose trade passes its zone. */
export function raidingHere(sim: Sim, f: Fleet): NationId[] {
  return memoize(sim, 'raidingHere', `${f.id}|${f.zone}|${fleetEpoch(sim)}`, () => {
    const st = sim.state;
    const out = new Set<NationId>();
    for (const c of st.contracts) {
      if (!atWar(sim, f.nation, c.seller) && !atWar(sim, f.nation, c.buyer)) continue;
      if (c.lag <= 0) continue;
      if (tradeRoute(sim, c.seller, c.buyer)?.includes(f.zone)) {
        if (atWar(sim, f.nation, c.seller)) out.add(c.seller);
        if (atWar(sim, f.nation, c.buyer)) out.add(c.buyer);
      }
    }
    return [...out].sort();
  });
}

// ───────────────────────────── Shore bombardment ────────────────────────────

/** Gun power a fleet can bring to bear on a coast (battleships and cruisers, by condition). */
export function bombardPower(sim: Sim, f: Fleet): number {
  let p = 0;
  const m = nationMods(sim, f.nation);
  for (const s of f.ships) p += SHIPS[s.type].bombard * (s.hp / 100) * (fuelled(sim, f.nation, s.type) ? 1 : C.naval.unfuelled);
  return p * Math.max(0.2, 1 + m.navalAttack);
}

/**
 * This week's shore bombardment, by battle and side: every fleet with gun ships
 * lying still in a zone on the coast of a land battle its realm (or a friend)
 * fights shells that battle: one battle a fleet a week (the largest it can reach).
 * Inland provinces are out of reach: the battle province must be on the fleet's zone.
 */
export function bombardPlan(sim: Sim): Map<string, { att: Array<{ fleet: Fleet; power: number }>; def: Array<{ fleet: Fleet; power: number }> }> {
  return memoize(sim, 'bombardPlan', `${fleetEpoch(sim)}`, () => {
    const st = sim.state;
    const out = new Map<string, { att: Array<{ fleet: Fleet; power: number }>; def: Array<{ fleet: Fleet; power: number }> }>();
    const battles = Object.keys(st.battles).sort().map((id) => st.battles[id]);
    if (!battles.length) return out;
    for (const id of Object.keys(st.fleets).sort()) {
      const f = st.fleets[id];
      if (f.path.length || f.cargo.length) continue;
      const power = bombardPower(sim, f);
      if (power <= 0) continue;
      const coast = sim.world.zones[f.zone]?.coasts ?? [];
      let best: { b: typeof battles[number]; side: 'att' | 'def'; men: number } | null = null;
      for (const b of battles) {
        if (!coast.includes(b.province)) continue;
        const ours = (list: NationId[]) => list.some((n) => n === f.nation || (isFriendly(sim, f.nation, n) && !atWar(sim, f.nation, n)));
        const theirs = (list: NationId[]) => list.some((n) => atWar(sim, f.nation, n));
        const side = ours(b.attackerNations) && theirs(b.defenderNations) ? 'att' : ours(b.defenderNations) && theirs(b.attackerNations) ? 'def' : null;
        if (!side) continue;
        let men = 0;
        for (const aid of [...b.attackers, ...b.defenders]) for (const r of st.armies[aid]?.regiments ?? []) men += r.men;
        if (!best || men > best.men) best = { b, side, men };
      }
      if (!best) continue;
      const slot = out.get(best.b.id) ?? out.set(best.b.id, { att: [], def: [] }).get(best.b.id)!;
      slot[best.side].push({ fleet: f, power });
    }
    return out;
  });
}

/** Coastal forts fire back at the ships that shelled their province this week. */
export function bombardFireBack(sim: Sim): void {
  const st = sim.state;
  for (const [bid, sides] of bombardPlan(sim)) {
    const b = st.battles[bid];
    const pid = b?.province ?? null;
    for (const side of ['att', 'def'] as const) {
      for (const { fleet: f } of sides[side]) {
        if (!st.fleets[f.id]) continue;
        st.nations[f.nation].stats.bombardWeeks++;
        const where = pid ? provName(sim, pid) : 'the coast';
        const p = pid ? st.provinces[pid] : null;
        const fort = p && p.controller && atWar(sim, f.nation, p.controller) ? p.fort : 0;
        if (fort > 0) {
          const guns = f.ships.filter((s) => SHIPS[s.type].bombard > 0);
          const dmg = (C.naval.coastalGuns * fort) / Math.max(1, guns.length);
          for (const s of guns) s.hp = Math.max(1, s.hp - dmg);
          reportFleet(sim, f, `Shelled the enemy at ${where}; the coastal forts (level ${fort}) hit back for ${Math.round(C.naval.coastalGuns * fort)} hull damage.`);
        } else reportFleet(sim, f, `Shelled the enemy at ${where} in support of our troops.`);
      }
    }
  }
}

// ───────────────────────────── Upkeep and fuel ──────────────────────────────

/** Crowns a realm's fleets cost each month. */
export function fleetUpkeep(sim: Sim, nid: NationId): number {
  let u = 0;
  for (const f of fleetsOf(sim, nid)) for (const s of f.ships) u += SHIPS[s.type].upkeep;
  return u;
}

/** Coal and oil a realm's fleets burn each month. */
export function fleetFuel(sim: Sim, nid: NationId): { coal: number; oil: number } {
  const out = { coal: 0, oil: 0 };
  for (const f of fleetsOf(sim, nid)) {
    for (const s of f.ships) {
      const r = SHIPS[s.type];
      if (burnsOil(sim, nid, s.type)) out.oil += r.fuel * (r.oil ? 1 : 0.8);
      else out.coal += r.fuel;
    }
  }
  return out;
}

/** Removes every fleet of a fallen realm (with any armies aboard). */
export function removeNavy(sim: Sim, nid: NationId): void {
  for (const f of [...fleetsOf(sim, nid)]) removeFleet(sim, f);
  for (const pid of sim.world.provIds) {
    const p = sim.state.provinces[pid];
    p.dock = p.dock.filter((o) => o.nation !== nid);
  }
}

/** Embarked armies are at sea: not in any province for land rules. */
export function atSea(a: Army): boolean {
  return !!a.embarked;
}

// ───────────────────────────── Fleet orders ─────────────────────────────────

export function fleetOrderProblem(sim: Sim, nid: NationId, fleetId: FleetId): string | null {
  const f = sim.state.fleets[fleetId];
  if (!f || f.nation !== nid) return 'Not our fleet.';
  return null;
}

export function moveFleetProblem(sim: Sim, nid: NationId, fleetId: FleetId, zone: ZoneId): string | null {
  const p = fleetOrderProblem(sim, nid, fleetId);
  if (p) return p;
  if (!sim.world.zones[zone]) return 'Unknown sea zone.';
  const f = sim.state.fleets[fleetId];
  if (zone !== f.zone && !zonePath(sim, f.zone, zone)) return `No sea route from ${zoneName(sim, f.zone)} to ${zoneName(sim, zone)}.`;
  return null;
}

export function moveFleet(sim: Sim, fleetId: FleetId, zone: ZoneId): void {
  const f = sim.state.fleets[fleetId];
  const path = zonePath(sim, f.zone, zone) ?? [];
  if (f.path[0] !== path[0]) f.progress = 0;
  f.path = path;
  // a fleet sent elsewhere keeps its troops aboard; its landing target stays until it reaches that coast
}

export function mergeFleetsProblem(sim: Sim, nid: NationId, ids: FleetId[]): string | null {
  if (ids.length < 2) return 'Choose at least two fleets.';
  const fs = ids.map((id) => sim.state.fleets[id]);
  if (fs.some((f) => !f || f.nation !== nid)) return 'Not our fleets.';
  if (new Set(fs.map((f) => f.zone)).size > 1) return 'Fleets must be in the same sea zone to join.';
  return null;
}

/** Merges fleets into the first one named (the one the order is given from: it keeps its name). */
export function mergeFleets(sim: Sim, ids: FleetId[]): Fleet {
  const into = sim.state.fleets[ids[0]];
  const fs = ids.slice(1).map((id) => sim.state.fleets[id]).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const f of fs) {
    into.ships.push(...f.ships);
    for (const id of f.cargo) {
      into.cargo.push(id);
      const a = sim.state.armies[id];
      if (a) a.embarked = into.id;
    }
    if (!into.landing && f.landing) into.landing = f.landing;
    mergeAir(sim, into, f.id);
    delete sim.state.fleets[f.id];
  }
  touchFleets(sim);
  return into;
}

export function splitFleetProblem(sim: Sim, nid: NationId, fleetId: FleetId, shipIds: string[]): string | null {
  const p = fleetOrderProblem(sim, nid, fleetId);
  if (p) return p;
  const f = sim.state.fleets[fleetId];
  if (!shipIds.length) return 'Choose the ships for the new squadron.';
  if (shipIds.length >= f.ships.length) return 'Leave at least one ship in the old squadron.';
  if (shipIds.some((id) => !f.ships.some((s) => s.id === id))) return 'Those ships are not in this fleet.';
  if (f.cargo.length) {
    const left = f.ships.filter((s) => !shipIds.includes(s.id));
    let cap = 0;
    for (const s of left) cap += SHIPS[s.type].capacity;
    if (cap < cargoRegiments(sim, f)) return 'The transports carrying troops must stay with them.';
  }
  return null;
}

export function splitFleet(sim: Sim, fleetId: FleetId, shipIds: string[]): Fleet {
  const f = sim.state.fleets[fleetId];
  const moving = f.ships.filter((s) => shipIds.includes(s.id));
  f.ships = f.ships.filter((s) => !shipIds.includes(s.id));
  const g = createFleet(sim, f.nation, f.zone, moving, f.home);
  // the air group goes where the carriers go
  splitAir(sim, f, g);
  return g;
}

export function disbandFleetProblem(sim: Sim, nid: NationId, fleetId: FleetId): string | null {
  const p = fleetOrderProblem(sim, nid, fleetId);
  if (p) return p;
  if (sim.state.fleets[fleetId].cargo.length) return 'Land the troops aboard first.';
  if (wingsAboard(sim, fleetId).length) return 'Fly the air wings aboard to an airfield first.';
  return null;
}
