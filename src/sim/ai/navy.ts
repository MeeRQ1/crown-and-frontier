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

import { airfieldRoom, skiesAtSea, buildWingProblem, deckSlots, inRangeOf, MISSION_LABELS, missionProblem, rebaseProblem, wingsAboard, wingsAt, wingsOf, wingStatus, wingUnlocked } from '../air';
import type { Place } from '../reach';
import { C, SHIPS, WINGS } from '../config';
import { armiesIn, armiesOfNation, memoWeek } from '../index';
import { grossIncome } from '../economy';
import {
  bombardPower,
  buildShipProblem,
  fleetCapacity,
  fleetsIn,
  provinceBlockaded,
  raidBalance,
  tradeRoute,
  fleetsOf,
  pathToCoast,
  portsOf,
  portZone,
  shipCount,
  shipUnlocked,
  subPower,
  surfacePower,
  touchFleets,
  zoneBalance,
} from '../naval';
import { aaAgainst } from '../airborne';
import { armiesOf, atWar, diag, enemiesOf, isFriendly, months, ownedProvinces, type Sim } from '../state';
import type { AirMission, AirWing, Army, Fleet, NationId, Personality, ProvinceId, ShipType, UnitType, WingType, ZoneId } from '../types';
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
  // a carrier is worth building only with aircraft to fly from it
  const deckWings = wingUnlocked(sim, nid, 'attack') || wingUnlocked(sim, nid, 'fighter');
  for (const [t, share] of target) {
    if (!shipUnlocked(sim, nid, t)) continue;
    if (t === 'carrier' && !deckWings) continue;
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
  const have: Record<WingType, number> = { recon: 0, fighter: 0, attack: 0, bomber: 0, transport: 0 };
  for (const w of wingsOf(sim, nid)) have[w.type]++;
  for (const pid of sim.world.provIds) for (const o of st.provinces[pid].hangar) if (o.nation === nid) have[o.wing]++;
  const total = Object.values(have).reduce((a, b) => a + b, 0);
  // empty carrier decks call for fighters and strike aircraft
  let decks = 0;
  for (const f of fleetsOf(sim, nid)) decks += Math.max(0, deckSlots(sim, f).hold - wingsAboard(sim, f.id).length);
  const mix: Array<[WingType, number]> = [
    ['fighter', 0.45],
    ['attack', 0.3 + (decks > 0 ? 0.2 : 0)],
    ['bomber', decks > 0 ? 0.08 : 0.15],
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
/**
 * What holding a zone is worth to us at war: enemy coasts to blockade, straits,
 * enemy fleets we can beat, our own blockaded coasts and raided trade to set free,
 * our troopships to escort and our coastal battles to shell; waters where enemy
 * aircraft hold the sky are worth half to a fleet without its own fighters.
 */
function zoneValue(sim: Sim, nid: NationId, zone: ZoneId, power: number, f?: Fleet, battles?: Set<ProvinceId>): number {
  const st = sim.state;
  const z = sim.world.zones[zone];
  let v = 0;
  for (const pid of z.coasts) {
    const p = st.provinces[pid];
    if (p.owner && atWar(sim, nid, p.owner)) v += 1 + p.dev * 0.5 + p.port * 2;
    if (p.owner === nid) v += provinceBlockaded(sim, pid) ? 4 : 0.5;
    // our armies fighting on this coast: the guns can shell the battle
    if (battles?.has(pid) && f && bombardPower(sim, f) > 0) v += 5;
  }
  v += (z.straits?.length ?? 0) * 3;
  // escort our troopships to their beach
  for (const g of fleetsOf(sim, nid)) if (g.cargo.length && g.landing && (sim.world.provZones[g.landing] ?? []).includes(zone)) v += 10;
  // enemy raiders preying on our trade here
  const raid = raidBalance(sim, zone, nid).raid;
  if (raid > 0) v += 2 + raid;
  const b = zoneBalance(sim, zone, nid);
  if (b.hostileSurface + b.hostileSubs > 0) {
    if (power >= (b.hostileSurface + b.hostileSubs) * 1.2) v += 6 + b.hostileSurface;
    else v = -1; // not a fight we want
  }
  // enemy aircraft over these waters: only with fighters of our own is it worth going in
  if (v > 0 && f && enemySkies(sim, nid).has(zone) && !wingsAboard(sim, f.id).some((w) => w.type === 'fighter')) v *= 0.5;
  return v;
}

/** Sea zones where enemy aircraft fly this week (and hold the sky), as the AI sees them at the start of its turn. */
function enemySkies(sim: Sim, nid: NationId): Set<ZoneId> {
  return memoWeek(sim, 'enemySkies', nid, () => {
    const out = new Set<ZoneId>();
    for (const [z, m] of skiesAtSea(sim)) {
      for (const [n, a] of m) {
        if (a.air > 0 && atWar(sim, nid, n)) {
          out.add(z);
          break;
        }
      }
    }
    return out;
  });
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
  // gather squadrons that share a zone and have nothing aboard (raiding submarines keep apart)
  const byZone = new Map<ZoneId, Fleet[]>();
  for (const f of fleets) if (!f.path.length && f.task !== 'transport' && f.task !== 'raid') (byZone.get(f.zone) ?? byZone.set(f.zone, []).get(f.zone)!).push(f);
  for (const group of byZone.values()) {
    const warFleets = group.filter(warships);
    if (warFleets.length >= 2) issue(sim, { type: 'mergeFleets', nation: nid, fleets: warFleets.map((f) => f.id) });
  }
  // the provinces where our armies fight this week (gun ships offshore shell them)
  const battles = new Set<ProvinceId>();
  for (const id of Object.keys(sim.state.battles)) {
    const b = sim.state.battles[id];
    if (b.attackerNations.includes(nid) || b.defenderNations.includes(nid)) battles.add(b.province);
  }
  for (const f of [...fleetsOf(sim, nid)].filter((x) => !x.cargo.length)) {
    if (f.task === 'raid') continue;
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
      const v = zoneValue(sim, nid, z, power, f, battles) / (1 + 0.35 * hops);
      if (v > bv + 0.01 || (Math.abs(v - bv) <= 0.01 && best !== null && z < best)) (bv = v), (best = z);
    }
    if (best && best !== f.zone && bv > 1) {
      f.task = 'sortie';
      issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: best }, `${f.name} sails for ${sim.world.zones[best].name}`);
    } else if (!best && home && f.zone !== home) issue(sim, { type: 'moveFleet', nation: nid, fleet: f.id, zone: home });
  }
}

/**
 * Weekly at war: submarines go raiding. A mixed fleet with two or more submarines
 * detaches them; raider squadrons lie on the sea routes of enemy trade (weighted by
 * what passes) where enemy escorts are weaker than they are, and come home to
 * repair when badly hurt.
 */
function raiderOps(sim: Sim, nid: NationId): void {
  const st = sim.state;
  if (!enemiesOf(sim, nid).length) {
    // at peace raiders rejoin the fleet at home
    for (const f of fleetsOf(sim, nid))
      if (f.task === 'raid') {
        f.task = null;
        if (f.duty?.kind === 'raid') {
          f.duty = null;
          touchFleets(sim);
        }
      }
    return;
  }
  for (const f of [...fleetsOf(sim, nid)]) {
    if (f.cargo.length || f.task === 'raid' || f.path.length) continue;
    const subs = f.ships.filter((x) => x.type === 'submarine');
    if (subs.length < 2 || subs.length === f.ships.length) {
      if (subs.length >= 2 && subs.length === f.ships.length) f.task = 'raid';
      continue;
    }
    const r = issue(sim, { type: 'splitFleet', nation: nid, fleet: f.id, ships: subs.map((x) => x.id) }, `${f.name} detaches its submarines to raid enemy trade`);
    if (r.ok) {
      const made = [...fleetsOf(sim, nid)].find((g) => g.zone === f.zone && g.id !== f.id && g.ships.every((x) => x.type === 'submarine') && g.task !== 'raid');
      if (made) made.task = 'raid';
    }
  }
  const raiders = fleetsOf(sim, nid).filter((f) => f.task === 'raid');
  if (!raiders.length) return;
  // enemy sea trade by zone: what passes along the routes of contracts an enemy signed
  const passing = new Map<ZoneId, number>();
  for (const c of st.contracts) {
    if (c.lag <= 0 || (!atWar(sim, nid, c.seller) && !atWar(sim, nid, c.buyer))) continue;
    for (const z of tradeRoute(sim, c.seller, c.buyer) ?? []) passing.set(z, (passing.get(z) ?? 0) + c.qty);
  }
  for (const f of raiders) {
    const home = f.home ? portZone(sim, f.home) : null;
    const hp = f.ships.reduce((s, x) => s + x.hp, 0) / f.ships.length;
    if (hp < 50 && home) {
      if (f.duty?.kind !== 'port') issue(sim, { type: 'fleetDuty', nation: nid, fleet: f.id, duty: { kind: 'port' } }, `${f.name} returns from raiding to repair`);
      continue;
    }
    // repaired in harbour: back to sea
    if (f.duty?.kind === 'port' && hp >= 90) {
      f.duty = null;
      touchFleets(sim);
    }
    if (f.path.length || f.duty?.kind === 'port') continue;
    const power = subPower(f);
    let best: ZoneId | null = null;
    let bv = 0;
    for (const [z, qty] of passing) {
      const hops = sim.world.zoneHop(f.zone, z);
      if (hops === undefined || hops > 8) continue;
      // enemy escorts here: their screens and cruisers hunt us
      let escorts = 0;
      for (const g of fleetsIn(sim, z)) if (atWar(sim, nid, g.nation)) for (const x of g.ships) escorts += SHIPS[x.type].antiSub * (x.hp / 100);
      if (escorts > power) continue;
      const v = qty / (1 + escorts) / (1 + 0.3 * hops);
      if (v > bv + 1e-9 || (Math.abs(v - bv) <= 1e-9 && best !== null && z < best)) (bv = v), (best = z);
    }
    // under a raid order: half as effective again where it lies, and it protects nothing
    if (best && (f.duty?.kind !== 'raid' || f.duty.zone !== best)) issue(sim, { type: 'fleetDuty', nation: nid, fleet: f.id, duty: { kind: 'raid', zone: best } }, `${f.name} goes raiding in ${sim.world.zones[best].name}`);
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
  // escorts first: troopships sail with warships, or wait for them while enemy ships or aircraft watch the route
  const escort = [...fleetsOf(sim, nid)].find((f) => f.zone === zone && !f.path.length && !f.cargo.length && warships(f) && f.task !== 'raid');
  if (escort) {
    const m = issue(sim, { type: 'mergeFleets', nation: nid, fleets: [escort.id, fleet.id] }, `${escort.name} takes the troopships under escort`);
    if (m.ok) {
      const merged = sim.state.fleets[escort.id];
      const r = issue(sim, { type: 'shipArmies', nation: nid, armies: [force.id], fleet: merged.id, dest: plan.target }, `${force.name} sails under escort to invade ${sim.world.prov[plan.target].name}`);
      if (r.ok) n.ai.invasion = null;
    }
    return;
  }
  const route = [zone, ...(pathToCoast(sim, zone, plan.target) ?? [])];
  const skies = enemySkies(sim, nid);
  const danger = route.some((z) => {
    const b = zoneBalance(sim, z, nid);
    return b.hostileSurface + b.hostileSubs > 0 || skies.has(z);
  });
  if (danger && st.tick - plan.since < months(4)) {
    // call the nearest healthy war fleet to the port to escort the convoy
    const main = [...fleetsOf(sim, nid)]
      .filter((f) => warships(f) && !f.cargo.length && f.task !== 'raid')
      .sort((a, b) => (sim.world.zoneHop(a.zone, zone) ?? 99) - (sim.world.zoneHop(b.zone, zone) ?? 99) || (a.id < b.id ? -1 : 1))[0];
    if (main && main.zone !== zone && main.path[main.path.length - 1] !== zone) issue(sim, { type: 'moveFleet', nation: nid, fleet: main.id, zone }, `${main.name} comes to escort the invasion convoy`);
    return;
  }
  const r = issue(sim, { type: 'shipArmies', nation: nid, armies: [force.id], fleet: fleet.id, dest: plan.target }, `${force.name} sails to invade ${sim.world.prov[plan.target].name}`);
  if (r.ok) n.ai.invasion = null;
}

// ───────────────────────────── Weekly: air ──────────────────────────────────

interface AirOrder {
  mission: AirMission;
  target: ProvinceId | null;
  zone: ZoneId | null;
  score: number;
  why: string;
}

/** What the air arm can see this week: battles, enemy fleets, armies, industry, airfields and aircraft (public, like the player's map). */
interface AirContext {
  war: boolean;
  battles: Array<{ pid: ProvinceId; men: number }>;
  /** where our armies will fight next: marching onto enemy troops, standing beside them, or landing (regiments of both sides) */
  imminent: Map<ProvinceId, number>;
  objectives: ProvinceId[];
  enemyFleets: Array<{ zone: ZoneId; value: number; cargo: number }>;
  enemyArmies: Array<{ pid: ProvinceId; regs: number }>;
  targets: Array<{ pid: ProvinceId; score: number; what: string }>;
  /** places enemy aircraft fly over our land, battles or fleets this week */
  enemyAir: Map<string, number>;
  /** zones our strike aircraft are working (recon goes with them) */
  strikeZones: ZoneId[];
  capital: ProvinceId | null;
  frontier: () => ProvinceId[];
}

/** What every realm offers enemy aircraft this week, by realm (shared by every AI realm's planning). */
interface AirTargets {
  /** provinces it holds worth bombing: airfields with wings, working shipyards, factories */
  targets: Map<NationId, AirContext['targets']>;
  /** where its aircraft fly (place key → air, ground and bomb values) */
  air: Map<NationId, Map<string, number>>;
}

function airTargets(sim: Sim): AirTargets {
  return memoWeek(sim, 'airTargets', '', () => {
    const st = sim.state;
    const targets = new Map<NationId, AirContext['targets']>();
    for (const pid of sim.world.provIds) {
      const p = st.provinces[pid];
      if (!p.controller) continue;
      const fieldWings = p.airfield > 0 ? wingsAt(sim, pid).length : 0;
      let score = 0;
      const what: string[] = [];
      if (fieldWings >= 2) (score += 2 + fieldWings * 0.5), what.push(`${fieldWings} wings on the airfield`);
      if (p.port > 0 && p.dock.length) (score += 1.5 + p.dock.length * 0.5), what.push('a shipyard at work');
      if (p.factories > 0) (score += 1 + p.factories * 0.4), what.push(`${p.factories} factories`);
      if (score > 0) (targets.get(p.controller) ?? targets.set(p.controller, []).get(p.controller)!).push({ pid, score, what: what.join(', ') });
    }
    const air = new Map<NationId, Map<string, number>>();
    for (const id of Object.keys(st.wings).sort()) {
      const w = st.wings[id];
      if (w.mission === 'idle') continue;
      const ws = wingStatus(sim, w);
      if (ws.state !== 'flying' || !ws.place) continue;
      const k = ws.place.prov !== undefined ? `p:${ws.place.prov}` : `z:${ws.place.zone}`;
      const m = air.get(w.nation) ?? air.set(w.nation, new Map()).get(w.nation)!;
      m.set(k, (m.get(k) ?? 0) + WINGS[w.type].air + WINGS[w.type].ground + WINGS[w.type].bomb);
    }
    return { targets, air };
  });
}

function airContext(sim: Sim, nid: NationId): AirContext {
  const st = sim.state;
  const foes = enemiesOf(sim, nid);
  const war = foes.length > 0;
  const battles = Object.keys(st.battles)
    .sort()
    .map((id) => st.battles[id])
    .filter((b) => b.attackerNations.includes(nid) || b.defenderNations.includes(nid))
    .map((b) => ({ pid: b.province, men: [...b.attackers, ...b.defenders].reduce((s, a) => s + (st.armies[a]?.regiments.length ?? 0), 0) }));
  // the provinces our armies attack or defend (not where a reserve waits)
  const objectives = [...new Set(Object.values(st.nations[nid].ai.objectives).filter((o) => ['attack', 'defend', 'liberate', 'battle'].includes(o.kind)).map((o) => o.target))].sort();
  const enemyFleets: AirContext['enemyFleets'] = [];
  const enemyArmies: AirContext['enemyArmies'] = [];
  const targets: AirContext['targets'] = [];
  const enemyAir = new Map<string, number>();
  if (war) {
    const shared = airTargets(sim);
    for (const e of [...foes].sort()) {
      for (const f of fleetsOf(sim, e)) if (f.ships.length) enemyFleets.push({ zone: f.zone, value: surfacePower(f) + f.ships.length, cargo: f.cargo.length });
      for (const a of armiesOfNation(sim, e)) {
        // armies on or next to our land
        if (st.provinces[a.location].controller === nid || sim.world.prov[a.location].neighbors.some((q) => st.provinces[q].controller === nid)) enemyArmies.push({ pid: a.location, regs: a.regiments.length });
      }
      targets.push(...(shared.targets.get(e) ?? []));
      for (const [k, v] of shared.air.get(e) ?? []) enemyAir.set(k, (enemyAir.get(k) ?? 0) + v);
    }
  }
  // most land battles are fought out in a week: support has to be on call before they begin
  const imminent = new Map<ProvinceId, number>();
  if (war) {
    const foesAt = (pid: ProvinceId) => armiesIn(sim, pid).reduce((s, e) => s + (atWar(sim, nid, e.nation) ? e.regiments.length : 0), 0);
    for (const a of armiesOfNation(sim, nid)) {
      if (a.battle || a.retreating) continue;
      if (a.embarked) {
        // troops at sea fight on the beach: support waits over it before they come ashore
        const beach = st.fleets[a.embarked]?.landing;
        if (beach) imminent.set(beach, (imminent.get(beach) ?? 0) + a.regiments.length + foesAt(beach));
        continue;
      }
      const next = a.path[0];
      let at = a.location;
      let foes = 0;
      if (next) {
        at = next;
        foes = foesAt(next);
      } else for (const q of sim.world.prov[a.location].neighbors) foes += foesAt(q);
      if (foes > 0) imminent.set(at, (imminent.get(at) ?? 0) + a.regiments.length + foes);
    }
  }
  const strikeZones = [...new Set(wingsOf(sim, nid).filter((w) => w.mission === 'naval' && w.zone).map((w) => w.zone!))].sort();
  const cap = st.nations[nid].capital;
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
  return { war, battles, imminent, objectives, enemyFleets, enemyArmies, targets, enemyAir, strikeZones, capital: cap && st.provinces[cap].controller === nid ? cap : null, frontier };
}

/** Every mission worth flying for a wing this week, by its type, from where it is based, with a score. */
function orderOptions(sim: Sim, w: AirWing, ctx: AirContext): AirOrder[] {
  const r = WINGS[w.type];
  const can = (m: AirMission) => (r.missions as AirMission[]).includes(m);
  const opts: AirOrder[] = [];
  const reach = (p: Place) => inRangeOf(sim, w, p);
  const prov = (pid: ProvinceId) => reach({ prov: pid });
  const zone = (z: ZoneId) => reach({ zone: z });
  if (ctx.war) {
    if (can('support')) {
      for (const b of ctx.battles) if (prov(b.pid)) opts.push({ mission: 'support', target: b.pid, zone: null, score: (w.type === 'attack' ? 4 : 1.5) + b.men / 10, why: 'support our battle' });
      // on call costs nothing until the battle begins; fighters add little, but more than an empty sky
      const attack = w.type === 'attack';
      for (const [pid, regs] of ctx.imminent) if (prov(pid)) opts.push({ mission: 'support', target: pid, zone: null, score: attack ? 3 + regs / 5 : 1.2 + regs / 10, why: 'on call where our army is about to fight' });
      if (attack) for (const o of ctx.objectives.slice(0, 6)) if (prov(o)) opts.push({ mission: 'support', target: o, zone: null, score: 1.5, why: 'on call over our objective' });
    }
    if (can('naval')) {
      for (const f of ctx.enemyFleets) if (zone(f.zone)) opts.push({ mission: 'naval', target: null, zone: f.zone, score: 2.5 + f.cargo * 4 + f.value / 10, why: f.cargo ? 'strike enemy troopships' : 'strike an enemy fleet' });
      // aboard a carrier with nothing in reach: guard the fleet's own waters
      if (w.carrier) opts.push({ mission: 'naval', target: null, zone: null, score: 1, why: 'guard the fleet' });
    }
    if (can('superiority')) {
      for (const [k, v] of ctx.enemyAir) {
        const p: Place = k[0] === 'p' ? { prov: k.slice(2) } : { zone: k.slice(2) };
        if (reach(p)) opts.push({ mission: 'superiority', target: p.prov ?? null, zone: p.zone ?? null, score: 3 + v / 2, why: 'meet enemy aircraft' });
      }
      for (const b of ctx.battles) if (prov(b.pid)) opts.push({ mission: 'superiority', target: b.pid, zone: null, score: 2 + b.men / 20, why: 'cover our battle' });
      if (w.carrier) opts.push({ mission: 'superiority', target: null, zone: null, score: 2.2, why: 'air cover over the fleet' });
      if (ctx.capital && prov(ctx.capital)) opts.push({ mission: 'superiority', target: ctx.capital, zone: null, score: 1, why: 'guard the capital' });
    }
    if (can('interdiction')) for (const a of ctx.enemyArmies) if (prov(a.pid)) opts.push({ mission: 'interdiction', target: a.pid, zone: null, score: 1.5 + a.regs / 5, why: 'interdict an enemy army' });
    if (can('bombing')) for (const t of ctx.targets) if (prov(t.pid)) opts.push({ mission: 'bombing', target: t.pid, zone: null, score: t.score, why: `bomb ${t.what}` });
    if (can('recon')) {
      for (const z of ctx.strikeZones) if (zone(z)) opts.push({ mission: 'recon', target: null, zone: z, score: 3, why: 'find ships for our strikes' });
      for (const b of ctx.battles) if (prov(b.pid)) opts.push({ mission: 'recon', target: b.pid, zone: null, score: 2 + b.men / 20, why: 'spot for our battle' });
      const f = ctx.frontier().find(prov);
      if (f) opts.push({ mission: 'recon', target: f, zone: null, score: 1, why: 'watch the frontier' });
    }
  }
  // anti-aircraft fire where it would fly: it achieves less and loses more there
  for (const o of opts) {
    if (!o.target || (o.mission !== 'bombing' && o.mission !== 'interdiction' && o.mission !== 'support')) continue;
    const aa = aaAgainst(sim, o.target, w.nation).total;
    if (aa <= 0) continue;
    o.score *= Math.max(0.2, 1 - C.air.aaEffect * aa) * Math.max(0.3, 1 - 0.06 * aa * WINGS[w.type].vulnerability);
    o.why += ` (through anti-aircraft fire, level ${aa.toFixed(1)})`;
  }
  // at peace no mission meets anything: every wing rests, keeping its readiness for the
  // first weeks of a war and burning a third of the oil
  return opts;
}

function sameOrder(w: AirWing, o: AirOrder): boolean {
  return w.mission === o.mission && w.target === o.target && w.zone === o.zone;
}

/**
 * Weekly: each wing flies the most useful mission it can reach; a working order is
 * kept unless another is clearly better (no flip-flopping week to week); with
 * nothing worth flying a wing rests (and recovers its readiness).
 */
export function airOps(sim: Sim, nid: NationId): void {
  const wings = wingsOf(sim, nid);
  if (!wings.length) return;
  const ctx = airContext(sim, nid);
  for (const w of wings) {
    const opts = orderOptions(sim, w, ctx);
    let best: AirOrder | null = null;
    for (const o of opts) if (!best || o.score > best.score + 1e-9) best = o;
    const status = wingStatus(sim, w);
    if (!best) {
      if (w.mission !== 'idle' && (status.state === 'grounded' || !ctx.war)) issue(sim, { type: 'airMission', nation: nid, wing: w.id, mission: 'idle', target: null });
      continue;
    }
    if (sameOrder(w, best)) continue;
    if (w.mission !== 'idle' && status.state !== 'grounded') {
      const cur = opts.find((o) => sameOrder(w, o))?.score ?? 0;
      if (cur >= best.score * 0.75) continue;
    }
    if (missionProblem(sim, nid, w.id, best.mission, best.target, best.zone)) continue;
    issue(sim, { type: 'airMission', nation: nid, wing: w.id, mission: best.mission, target: best.target, zone: best.zone }, `${w.name}: ${MISSION_LABELS[best.mission].toLowerCase()} (${best.why})`);
  }
}

// ───────────────────────────── Weekly: carriers ─────────────────────────────

/** Fills empty decks with wings from airfields within ferry range: a fighter for each carrier first, then strike aircraft. */
function carrierOps(sim: Sim, nid: NationId): void {
  for (const f of [...fleetsOf(sim, nid)]) {
    const deck = deckSlots(sim, f);
    if (!deck.hold || !deck.operate) continue;
    const aboard = wingsAboard(sim, f.id);
    let room = deck.hold - aboard.length;
    if (room <= 0) continue;
    const carriers = f.ships.filter((s) => SHIPS[s.type].deck > 0).length;
    let fighters = aboard.filter((w) => w.type === 'fighter').length;
    const pool = wingsOf(sim, nid)
      .filter((w) => !w.carrier && WINGS[w.type].carrier && w.type !== 'recon' && !rebaseProblem(sim, nid, w.id, null, f.id))
      .sort((a, b) => Number(a.mission !== 'idle') - Number(b.mission !== 'idle') || (a.id < b.id ? -1 : 1));
    while (room > 0 && pool.length) {
      const wantFighter = fighters < carriers;
      const i = Math.max(0, pool.findIndex((w) => (wantFighter ? w.type === 'fighter' : w.type === 'attack')));
      const w = pool.splice(i, 1)[0];
      const r = issue(sim, { type: 'rebaseWing', nation: nid, wing: w.id, carrier: f.id }, `${w.name} flies aboard ${f.name}`);
      if (!r.ok) continue;
      if (w.type === 'fighter') fighters++;
      room--;
    }
  }
}

/** Weekly: fleets, raiders, invasions and carriers' air groups (air missions follow the armies' orders: `airOps`). */
export function navalOps(sim: Sim, nid: NationId): void {
  if (!sim.world.zoneIds.length) return;
  fleetOps(sim, nid);
  raiderOps(sim, nid);
  invasions(sim, nid);
  carrierOps(sim, nid);
}
