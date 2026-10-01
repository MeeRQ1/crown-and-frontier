// AI for the navy and the air arm, through the same commands as the player.
//
// Monthly (strategic): ports where a coastal realm has none; ships to a target
// mix within a navy budget (a share of income by temperament and coastline);
// airfields and wings once Aviation is known.
// Weekly (operational): at peace fleets gather at their home port; at war the
// main fleet seeks the zone where it does the most good that it can hold
// (blockading enemy coasts, holding straits, hunting weaker enemy fleets) and
// falls back when outgunned; idle armies on a coast with transports invade
// enemy coasts that are weakly held or out of reach by land. Air wings fly
// superiority and support over our battles and objectives, interdict enemy
// armies, bomb enemy industry in range, and scout the front.

import { airfieldRoom, buildWingProblem, inRange, missionProblem, wingsOf, wingUnlocked } from '../air';
import { SHIPS, WINGS } from '../config';
import { armiesIn } from '../index';
import { grossIncome } from '../economy';
import {
  buildShipProblem,
  fleetCapacity,
  fleetsOf,
  pathToCoast,
  portsOf,
  portZone,
  shipCount,
  shipUnlocked,
  subPower,
  surfacePower,
  zoneBalance,
} from '../naval';
import { armiesOf, atWar, diag, enemiesOf, isFriendly, months, ownedProvinces, type Sim } from '../state';
import type { AirMission, Army, Fleet, NationId, Personality, ProvinceId, ShipType, UnitType, WingType, ZoneId } from '../types';
import { aiRand, issue, reachFrom } from './common';

/** Share of income a temperament spends on ships (peace, war). */
const NAVY_SHARE: Record<Personality, [number, number]> = {
  expansionist: [0.05, 0.08],
  opportunist: [0.06, 0.09],
  commercial: [0.09, 0.12],
  defensive: [0.05, 0.08],
  diplomat: [0.08, 0.1],
};
const AIR_SHARE = [0.04, 0.09];

export function coastalShare(sim: Sim, nid: NationId): number {
  const own = ownedProvinces(sim, nid);
  if (!own.length) return 0;
  return own.filter((p) => sim.world.provZones[p]).length / own.length;
}

function fleetUpkeepOf(sim: Sim, nid: NationId): number {
  let u = 0;
  for (const f of fleetsOf(sim, nid)) for (const s of f.ships) u += SHIPS[s.type].upkeep;
  for (const pid of sim.world.provIds) for (const o of sim.state.provinces[pid].dock) if (o.nation === nid) u += SHIPS[o.ship].upkeep;
  return u;
}

function airUpkeepOf(sim: Sim, nid: NationId): number {
  let u = 0;
  for (const w of wingsOf(sim, nid)) u += WINGS[w.type].upkeep;
  for (const pid of sim.world.provIds) for (const o of sim.state.provinces[pid].hangar) if (o.nation === nid) u += WINGS[o.wing].upkeep;
  return u;
}

/** Ships on the slipways, by realm (one pass over the map). */
function slipways(sim: Sim): Map<NationId, Record<ShipType, number>> {
  const m = new Map<NationId, Record<ShipType, number>>();
  for (const pid of sim.world.provIds) {
    for (const o of sim.state.provinces[pid].dock) {
      let c = m.get(o.nation);
      if (!c) m.set(o.nation, (c = { transport: 0, screen: 0, cruiser: 0, capital: 0, submarine: 0, carrier: 0 }));
      c[o.ship]++;
    }
  }
  return m;
}

/** Ship counts afloat and on the slipways. */
function navyCounts(sim: Sim, nid: NationId, docks = slipways(sim)): Record<ShipType, number> {
  const c: Record<ShipType, number> = { transport: 0, screen: 0, cruiser: 0, capital: 0, submarine: 0, carrier: 0 };
  for (const f of fleetsOf(sim, nid)) {
    const k = shipCount(f);
    for (const t of Object.keys(c) as ShipType[]) c[t] += k[t];
  }
  const d = docks.get(nid);
  if (d) for (const t of Object.keys(c) as ShipType[]) c[t] += d[t];
  return c;
}

/** Enemy (or rival) naval habits: many battleships invite submarines; many submarines invite screens. */
function rivalsMix(sim: Sim, nid: NationId): { capital: number; submarine: number } {
  let capital = 0;
  let submarine = 0;
  const foes = enemiesOf(sim, nid);
  const pool = foes.length ? foes : sim.world.nationIds.filter((o) => o !== nid && sim.state.nations[o].alive);
  const docks = slipways(sim);
  for (const o of pool) {
    const c = navyCounts(sim, o, docks);
    capital += c.capital;
    submarine += c.submarine;
  }
  return { capital: capital / Math.max(1, pool.length), submarine: submarine / Math.max(1, pool.length) };
}

function nextShip(sim: Sim, nid: NationId): ShipType | null {
  const c = navyCounts(sim, nid);
  const war = c.screen + c.cruiser + c.capital + c.submarine + c.carrier;
  const rivals = rivalsMix(sim, nid);
  const wantTransports = 2 + (coastalShare(sim, nid) > 0.5 ? 1 : 0) + (enemiesOf(sim, nid).length ? 1 : 0);
  if (c.transport < wantTransports && aiRand(sim) < 0.6) return 'transport';
  const target: Array<[ShipType, number]> = [
    ['screen', 0.35 + (rivals.submarine > 1 ? 0.1 : 0)],
    ['cruiser', 0.3],
    ['capital', 0.22],
    ['submarine', rivals.capital > 1 ? 0.18 : 0.08],
    ['carrier', 0.12],
  ];
  let best: ShipType | null = null;
  let gap = -Infinity;
  for (const [t, share] of target) {
    if (!shipUnlocked(sim, nid, t)) continue;
    const g = share - c[t] / Math.max(1, war);
    if (g > gap) (gap = g), (best = t);
  }
  return best;
}

/** Monthly: ports, ships, airfields and wings. */
export function navalStrategy(sim: Sim, nid: NationId, reserve: number): void {
  const st = sim.state;
  const n = st.nations[nid];
  const gross = Math.max(5, grossIncome(n.lastMonth));
  const war = enemiesOf(sim, nid).length > 0;
  const coast = coastalShare(sim, nid);
  // ── the fleet
  if (coast > 0) {
    const ports = portsOf(sim, nid);
    // a first port is chosen with the other construction projects (planConstruction)
    if (ports.length) {
      const share = NAVY_SHARE[n.ai.personality][war ? 1 : 0] * (0.5 + coast);
      const budget = gross * share;
      for (let k = 0; k < 2; k++) {
        if (fleetUpkeepOf(sim, nid) >= budget) break;
        const type = nextShip(sim, nid);
        if (!type) break;
        // never launch new ships into waters the enemy holds
        const yard = ports
          .filter((p) => !buildShipProblem(sim, nid, p, type))
          .filter((p) => {
            const z = portZone(sim, p);
            if (!z) return false;
            const b = zoneBalance(sim, z, nid);
            return b.hostileSurface + b.hostileSubs <= b.friendSurface;
          })
          .sort((a, b) => st.provinces[b].port - st.provinces[a].port || (a < b ? -1 : 1))[0];
        if (!yard) break;
        if (n.treasury - reserve < SHIPS[type].cost * 1.2) break;
        issue(sim, { type: 'buildShip', nation: nid, province: yard, ship: type }, `Navy: lay down a ${SHIPS[type].label.toLowerCase()}`);
      }
    }
  }
  // ── the air arm
  if (!n.research.done.includes('aviation')) return;
  // airfields are chosen with the other construction projects (planConstruction)
  const fields = ownedProvinces(sim, nid).filter((p) => st.provinces[p].airfield > 0);
  const budget = gross * AIR_SHARE[war ? 1 : 0];
  if (airUpkeepOf(sim, nid) >= budget) return;
  const have: Record<WingType, number> = { recon: 0, fighter: 0, attack: 0, bomber: 0 };
  for (const w of wingsOf(sim, nid)) have[w.type]++;
  for (const pid of sim.world.provIds) for (const o of st.provinces[pid].hangar) if (o.nation === nid) have[o.wing]++;
  const total = Object.values(have).reduce((a, b) => a + b, 0);
  const mix: Array<[WingType, number]> = [
    ['fighter', 0.45],
    ['attack', 0.3],
    ['bomber', 0.15],
    // spotters lead only until fighters are known
    ['recon', total < 2 && !wingUnlocked(sim, nid, 'fighter') ? 0.5 : 0.1],
  ];
  let type: WingType | null = null;
  let gap = -Infinity;
  for (const [t, share] of mix) {
    if (!wingUnlocked(sim, nid, t)) continue;
    if (t === 'recon' && have.recon >= (wingUnlocked(sim, nid, 'fighter') ? 1 : 2)) continue; // spotters: one or two are enough
    const g = share - have[t] / Math.max(1, total);
    if (g > gap) (gap = g), (type = t);
  }
  if (!type || n.treasury - reserve < WINGS[type].cost * 1.2) return;
  const field = fields.filter((p) => airfieldRoom(sim, p) > 0 && !buildWingProblem(sim, nid, p, type!)).sort((a, b) => airfieldRoom(sim, b) - airfieldRoom(sim, a) || (a < b ? -1 : 1))[0];
  if (field) issue(sim, { type: 'buildWing', nation: nid, province: field, wing: type }, `Air: raise a ${WINGS[type].label.toLowerCase()}`);
}

// ───────────────────────────── Weekly: fleets ───────────────────────────────

function warships(f: Fleet): boolean {
  return f.ships.some((s) => s.type !== 'transport');
}

/** What holding a zone is worth to us at war: enemy coasts to blockade, straits, enemy fleets we can beat. */
function zoneValue(sim: Sim, nid: NationId, zone: ZoneId, power: number): number {
  const st = sim.state;
  const z = sim.world.zones[zone];
  let v = 0;
  for (const pid of z.coasts) {
    const p = st.provinces[pid];
    if (p.owner && atWar(sim, nid, p.owner)) v += 1 + p.dev * 0.5 + p.port * 2;
    if (p.owner === nid) v += 0.5;
  }
  v += (z.straits?.length ?? 0) * 3;
  // escort our troopships to their beach
  for (const f of fleetsOf(sim, nid)) if (f.cargo.length && f.landing && (sim.world.provZones[f.landing] ?? []).includes(zone)) v += 10;
  const b = zoneBalance(sim, zone, nid);
  if (b.hostileSurface + b.hostileSubs > 0) {
    if (power >= (b.hostileSurface + b.hostileSubs) * 1.2) v += 6 + b.hostileSurface;
    else v = -1; // not a fight we want
  }
  return v;
}

/**
 * Where a fleet keeps station at peace: off the coasts of the realm we plan to
 * fight, off coasts we claim, on a strait beside our shores, or watching the
 * waters off a rival navy's home. Null means home.
 */
function peaceStation(sim: Sim, nid: NationId, from: ZoneId): ZoneId | null {
  const st = sim.state;
  const target = st.nations[nid].ai.warPlan?.target ?? null;
  // realms not allied to us that keep warships
  const navies = new Set<NationId>();
  for (const id of Object.keys(st.fleets)) {
    const f = st.fleets[id];
    if (f.nation !== nid && !isFriendly(sim, nid, f.nation) && warships(f)) navies.add(f.nation);
  }
  let best: ZoneId | null = null;
  let bv = 1.5;
  for (const z of sim.world.zoneIds) {
    const hops = sim.world.zoneHop(from, z);
    if (hops === undefined || hops > 4) continue;
    const zone = sim.world.zones[z];
    let v = 0;
    let ours = false;
    for (const pid of zone.coasts) {
      const p = st.provinces[pid];
      if (p.owner === nid) (v += 0.5), (ours = true);
      else if (target && p.owner === target) v += 1.5 + p.port;
      else if (p.claims.includes(nid)) v += 1;
      else if (p.owner && navies.has(p.owner)) v += 0.4 + 0.3 * p.port;
    }
    if (ours) v += (zone.straits?.length ?? 0) * 2;
    v /= 1 + 0.5 * hops;
    if (v > bv + 0.01 || (Math.abs(v - bv) <= 0.01 && best !== null && z < best)) (bv = v), (best = z);
  }
  return best;
}

function fleetOps(sim: Sim, nid: NationId): void {
  const fleets = [...fleetsOf(sim, nid)].filter((f) => !f.cargo.length);
  if (!fleets.length) return;
  const war = enemiesOf(sim, nid).length > 0;
  // gather squadrons that share a zone and have nothing aboard
  const byZone = new Map<ZoneId, Fleet[]>();
  for (const f of fleets) if (!f.path.length && f.task !== 'transport') (byZone.get(f.zone) ?? byZone.set(f.zone, []).get(f.zone)!).push(f);
  for (const group of byZone.values()) {
    const warFleets = group.filter(warships);
    if (warFleets.length >= 2) issue(sim, { type: 'mergeFleets', nation: nid, fleets: warFleets.map((f) => f.id) });
  }
  for (const f of [...fleetsOf(sim, nid)].filter((x) => !x.cargo.length)) {
    const home = f.home ? portZone(sim, f.home) : null;
    if (!warships(f)) {
      // transports wait at home, or gather where an invasion is planned (invasions())
      f.task = 'transport';
      if (!sim.state.nations[nid].ai.invasion && home && f.zone !== home && !f.path.length) issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: home });
      continue;
    }
    if (!war) {
      if (f.path.length) continue;
      // at peace: station where a coming war would be fought, else at home
      const station = peaceStation(sim, nid, home ?? f.zone) ?? home;
      if (station && f.zone !== station) {
        f.task = 'patrol';
        issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: station }, `${f.name} takes station in ${sim.world.zones[station].name}`);
      }
      continue;
    }
    const power = surfacePower(f) + subPower(f);
    const here = zoneBalance(sim, f.zone, nid);
    // outgunned where we are: fall back home
    if (here.hostileSurface + here.hostileSubs > power * 1.2 && home && f.zone !== home) {
      issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: home }, `${f.name} falls back`);
      continue;
    }
    // badly damaged: repair first
    const avgHp = f.ships.reduce((s, x) => s + x.hp, 0) / f.ships.length;
    if (avgHp < 55 && home) {
      if (f.zone !== home && f.path[f.path.length - 1] !== home) issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: home }, `${f.name} returns for repairs`);
      continue;
    }
    if (f.path.length && f.task === 'sortie') continue;
    // the most valuable zone within reach that we can hold
    let best: ZoneId | null = null;
    let bv = 0;
    for (const z of sim.world.zoneIds) {
      const hops = sim.world.zoneHop(f.zone, z);
      if (hops === undefined || hops > 6) continue;
      const v = zoneValue(sim, nid, z, power) / (1 + 0.35 * hops);
      if (v > bv + 0.01 || (Math.abs(v - bv) <= 0.01 && best !== null && z < best)) (bv = v), (best = z);
    }
    if (best && best !== f.zone && bv > 1) {
      f.task = 'sortie';
      issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: best }, `${f.name} sails for ${sim.world.zones[best].name}`);
    } else if (!best && home && f.zone !== home) issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: home });
  }
}

/** Monthly: keep, drop or choose an invasion plan (a target coast and the port to gather at). */
export function planInvasion(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const foes = enemiesOf(sim, nid);
  const plan = n.ai.invasion;
  if (plan) {
    const t = st.provinces[plan.target];
    const valid = foes.length > 0 && !!t.controller && atWar(sim, nid, t.controller) && st.provinces[plan.port].controller === nid && st.tick - plan.since < months(8);
    if (valid) return;
    n.ai.invasion = null;
    for (const a of armiesOf(sim, nid)) if (a.task === 'invasion' && !a.embarked) a.task = null;
  }
  if (!foes.length || !sim.world.zoneIds.length) return;
  const ports = portsOf(sim, nid);
  if (!ports.length) return;
  let cap = 0;
  for (const f of fleetsOf(sim, nid)) cap += fleetCapacity(f);
  if (cap < 2) return;
  const from = n.capital && st.provinces[n.capital].controller === nid ? n.capital : ports[0];
  const reach = reachFrom(sim, nid, from);
  const goals = new Set<ProvinceId>();
  for (const w of Object.values(st.wars)) if (w.attackers.includes(nid)) for (const p of w.goal.provinces) goals.add(p);
  let best: { target: ProvinceId; port: ProvinceId; score: number } | null = null;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.controller || !atWar(sim, nid, p.controller) || !sim.world.provZones[pid]) continue;
    // enemies around the beach
    let enemy = 0;
    for (const q of [pid, ...sim.world.prov[pid].neighbors]) for (const e of armiesIn(sim, q)) if (atWar(sim, nid, e.nation)) enemy += e.regiments.length;
    if (enemy > cap * 0.8) continue;
    let port: ProvinceId | null = null;
    let route = Infinity;
    for (const pp of ports) {
      const z = portZone(sim, pp);
      const r = z ? pathToCoast(sim, z, pid) : null;
      if (r && r.length < route) (route = r.length), (port = pp);
    }
    if (!port || route > 8) continue;
    const value = p.dev + 2 + (goals.has(pid) ? 8 : 0) + (st.nations[p.owner ?? '']?.capital === pid ? 6 : 0) - p.fort * 2;
    const land = reach.dist[pid] === undefined ? 3 : reach.dist[pid] > 15 ? 1.5 : 0.5;
    const score = (value * land) / (1 + route * 0.25);
    if (!best || score > best.score || (score === best.score && pid < best.target)) best = { target: pid, port, score };
  }
  if (best && best.score >= 5 && aiRand(sim) < 0.6) {
    n.ai.invasion = { target: best.target, port: best.port, since: st.tick };
    diag(sim, nid, 'strategic', `Invasion planned: ${sim.world.prov[best.target].name} from ${sim.world.prov[best.port].name} (score ${best.score.toFixed(1)})`);
  }
}

/** Regiment counts for a detachment of `size`: infantry first, then the rest. */
function detachment(a: Army, size: number): Partial<Record<UnitType, number>> {
  const out: Partial<Record<UnitType, number>> = {};
  const order: UnitType[] = ['infantry', 'artillery', 'cavalry', 'engineers', 'armour'];
  let left = size;
  for (const t of order) {
    const have = a.regiments.filter((r) => r.type === t).length;
    const take = Math.min(have, left);
    if (take > 0) out[t] = take;
    left -= take;
  }
  return out;
}

/** Weekly: gather the invasion force and its transports at the port, then sail. */
function invasions(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const plan = n.ai.invasion;
  if (!plan) return;
  const zone = portZone(sim, plan.port);
  if (!zone) return;
  // transports gather at the port's zone
  const transports = [...fleetsOf(sim, nid)].filter((f) => !f.cargo.length && fleetCapacity(f) >= 2 && !warships(f));
  for (const f of transports) if (f.zone !== zone && f.path[f.path.length - 1] !== zone) issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone });
  const ready = transports.filter((f) => f.zone === zone && !f.path.length);
  if (ready.length >= 2) issue(sim, { type: 'mergeFleets', nation: nid, fleets: ready.map((f) => f.id) });
  const fleet = [...fleetsOf(sim, nid)].find((f) => f.zone === zone && !f.path.length && !f.cargo.length && fleetCapacity(f) >= 2 && !warships(f));
  let cap = 0;
  for (const f of transports) cap += fleetCapacity(f);
  // the force
  let force = armiesIn(sim, plan.port).find((a) => a.nation === nid && a.task === 'invasion' && !a.battle);
  if (!force) {
    if (armiesOf(sim, nid).some((a) => a.task === 'invasion' && !a.embarked)) return; // on its way
    const pool = armiesOf(sim, nid)
      .filter((a) => !a.embarked && !a.battle && !a.retreating && a.regiments.length >= 2 && !a.task?.startsWith('defend') && !a.task?.startsWith('liberate'))
      .map((a) => ({ a, d: sim.world.hop(a.location, plan.port) ?? 99 }))
      .filter((x) => x.d <= 8)
      .sort((x, y) => x.d - y.d || (x.a.id < y.a.id ? -1 : 1));
    const pick = pool[0]?.a;
    if (!pick || cap < 2) return;
    let a = pick;
    if (a.regiments.length > cap + 1) {
      const before = new Set(armiesOf(sim, nid).map((x) => x.id));
      const r = issue(sim, { type: 'split', nation: nid, army: a.id, counts: detachment(a, cap) });
      if (!r.ok) return;
      const made = armiesOf(sim, nid).find((x) => !before.has(x.id));
      if (!made) return;
      a = made;
    }
    a.task = 'invasion';
    if (a.location !== plan.port) issue(sim, { type: 'move', nation: nid, army: a.id, dest: plan.port }, `${a.name} marches to ${sim.world.prov[plan.port].name} to embark`);
    return;
  }
  if (!fleet) return;
  const room = fleetCapacity(fleet);
  if (force.regiments.length > room) {
    const before = new Set(armiesOf(sim, nid).map((x) => x.id));
    const r = issue(sim, { type: 'split', nation: nid, army: force.id, counts: detachment(force, room) });
    if (!r.ok) return;
    const made = armiesOf(sim, nid).find((x) => !before.has(x.id));
    if (!made) return;
    force.task = null;
    force = made;
    force.task = 'invasion';
  }
  const r = issue(sim, { type: 'shipArmies', nation: nid, armies: [force.id], fleet: fleet.id, dest: plan.target }, `${force.name} sails to invade ${sim.world.prov[plan.target].name}`);
  if (r.ok) n.ai.invasion = null;
}

// ───────────────────────────── Weekly: air ──────────────────────────────────

function airOps(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const wings = wingsOf(sim, nid);
  if (!wings.length) return;
  const war = enemiesOf(sim, nid).length > 0;
  // places that matter: our battles, then our armies' objectives, then the capital
  const battles = Object.values(st.battles)
    .filter((b) => b.attackerNations.includes(nid) || b.defenderNations.includes(nid))
    .map((b) => b.province)
    .sort();
  const objectives = [...new Set(Object.values(st.nations[nid].ai.objectives).map((o) => o.target))].sort();
  const front = [...battles, ...objectives];
  const enemyArmies = war
    ? Object.values(st.armies)
        .filter((a: Army) => !a.embarked && atWar(sim, nid, a.nation))
        .sort((a, b) => b.regiments.length - a.regiments.length || (a.id < b.id ? -1 : 1))
        .map((a) => a.location)
    : [];
  const factories = war
    ? sim.world.provIds
        .filter((pid) => st.provinces[pid].controller && atWar(sim, nid, st.provinces[pid].controller!) && st.provinces[pid].factories > 0)
        .sort((a, b) => st.provinces[b].factories - st.provinces[a].factories || (a < b ? -1 : 1))
    : [];
  const cap = st.nations[nid].capital;
  // our border provinces, most foreign troops next door first (the frontier watch)
  let watch: ProvinceId[] | null = null;
  const frontier = () => {
    if (watch) return watch;
    const rows: Array<[ProvinceId, number]> = [];
    for (const pid of ownedProvinces(sim, nid)) {
      if (st.provinces[pid].controller !== nid) continue;
      let foreign = 0;
      let border = false;
      for (const q of sim.world.prov[pid].neighbors) {
        const c = st.provinces[q].controller;
        if (!c || c === nid) continue;
        border = true;
        for (const a of armiesIn(sim, q)) if (a.nation !== nid) foreign += a.regiments.length;
      }
      if (border) rows.push([pid, foreign]);
    }
    rows.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return (watch = rows.map((r) => r[0]));
  };
  for (const w of wings) {
    let mission: AirMission = 'idle';
    let target: ProvinceId | null = null;
    const pick = (list: ProvinceId[]) => list.find((p) => inRange(sim, w, p)) ?? null;
    if (war) {
      if (w.type === 'fighter') (target = pick(front) ?? (cap && inRange(sim, w, cap) ? cap : null)), (mission = 'superiority');
      else if (w.type === 'attack') {
        target = pick(battles) ?? pick(objectives);
        mission = 'support';
        if (!target) (target = pick(enemyArmies)), (mission = 'interdiction');
      } else if (w.type === 'bomber') {
        target = pick(factories);
        mission = 'bombing';
        if (!target) (target = pick(enemyArmies)), (mission = 'interdiction');
      } else (target = pick(front) ?? pick(frontier())), (mission = 'recon');
    } else if (w.type === 'fighter') {
      mission = 'superiority';
      target = cap && inRange(sim, w, cap) ? cap : pick(frontier());
    } else if (w.type === 'recon') (target = pick(frontier())), (mission = 'recon');
    if (!target) mission = 'idle';
    if (mission === w.mission && target === w.target) continue;
    if (mission !== 'idle' && missionProblem(sim, nid, w.id, mission, target)) continue;
    issue(sim, { type: 'airMission', nation: nid, wing: w.id, mission, target: mission === 'idle' ? null : target });
  }
}

/** Weekly: fleets, invasions and air missions. */
export function navalOps(sim: Sim, nid: NationId): void {
  if (sim.world.zoneIds.length) {
    fleetOps(sim, nid);
    invasions(sim, nid);
  }
  airOps(sim, nid);
}
