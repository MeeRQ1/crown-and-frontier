// The navy, the air arm and airborne troops under an operation (format 8), and
// the landing operation. Everything is ordered through the command path with
// the checks the player's orders get (range, airfield room, transport space,
// sea routes, duty rules); only the operation's own members are used.
//
// Fleets: worn fleets go to port to repair (half hull) until they are fit
// again; warships shell the coast where the operation's armies fight or lay
// siege, else blockade the enemy coast in the area or patrol off it;
// submarines raid off the enemy coast; carriers keep station where their wings
// reach the main effort; in a sea operation the strongest group intercepts
// enemy fleets in the zones and the rest patrol them, escorting our loaded
// transports through them.
// Aircraft: worn wings rest; fighters keep the sky over the main effort,
// ground-attack wings support its battle (or strike enemy armies before it),
// bombers strike its supply, wings over a sea operation strike enemy fleets.
// Out of range: rebased to an airfield of ours with room and no enemy next to
// it, only with the rebasing permission; otherwise the operation says so.
// Airborne: only with the mandate, only inside the area, only within the loss
// limit, only with the operation's own transports; "once" ends the mandate.
// Landing: troops gather at an embarkation port, the transports come to it,
// escorts join them and cover is flown over the beach; then they sail.

import { inRangeOf, missionProblem, rebaseProblem, wingRange, airfieldRoom } from '../air';
import { airDropProblem, airDropRisk, transportsAt } from '../airborne';
import { C, SHIPS, WINGS } from '../config';
import { armyStrength, maxMorale } from '../military';
import { forecastBattle } from '../combat';
import { fleetCapacity, fleetDutyProblem, moveFleetProblem, pathToCoast, portsOf, returnPort, routeThreats, shipArmiesProblem, surfacePower, zoneBalance, zonePath } from '../naval';
import { atWar, isFriendly, menOf, provName, type Sim } from '../state';
import type { AirMission, AirWing, Army, ArmyId, CommandResult, Fleet, FleetDuty, Operation, OpTask, OpTaskKind, ProvinceId, RealmCommand, WingId, ZoneId } from '../types';
import { hostileArmiesAt, reachFrom, sumStrength, threatAround } from '../ai/common';
import type { GroundOutcome } from './ground';
import { siegeRegiments } from './ground';
import { clearIssue, opLog, raiseIssue, type OpForces } from './operations';

export interface ForcesPlan {
  /** armies handled here this week (airborne troops waiting to be flown, the landing force before it is ashore) */
  reserved: Set<ArmyId>;
  tasks: Record<string, OpTask>;
  /** air and naval support for the week's ground plan */
  support: (g: GroundOutcome) => void;
}

const isPara = (a: Army) => a.regiments.length > 0 && a.regiments.every((r) => r.type === 'airborne');

function task(sim: Sim, prev: OpTask | undefined, kind: OpTaskKind, target: string | null, note: string): OpTask {
  return { kind, target, note, since: prev && prev.kind === kind && prev.target === target ? prev.since : sim.state.tick };
}

function sameDuty(f: Fleet, d: Omit<FleetDuty, 'since'>): boolean {
  const c = f.duty;
  if (!c) return false;
  return c.kind === d.kind && (c.zone ?? null) === (d.zone ?? null) && (c.province ?? null) === (d.province ?? null) && (c.fleet ?? null) === (d.fleet ?? null);
}

const hullShare = (f: Fleet) => f.ships.reduce((s, x) => s + x.hp, 0) / Math.max(1, f.ships.length) / 100;
const warships = (f: Fleet) => f.ships.some((s) => SHIPS[s.type].gun > 0 && s.type !== 'submarine');
const guns = (f: Fleet) => f.ships.some((s) => SHIPS[s.type].bombard > 0);
const subsOnly = (f: Fleet) => f.ships.length > 0 && f.ships.every((s) => s.type === 'submarine');
const carriers = (f: Fleet) => f.ships.some((s) => SHIPS[s.type].deck > 0);
const transportsOnly = (f: Fleet) => f.ships.length > 0 && f.ships.every((s) => SHIPS[s.type].capacity > 0);

export function planForces(sim: Sim, op: Operation, f: OpForces, issue: (cmd: RealmCommand, why?: string) => CommandResult): ForcesPlan {
  const st = sim.state;
  const nid = op.nation;
  const prev = op.tasks;
  const plan: ForcesPlan = { reserved: new Set(), tasks: {}, support: () => undefined };
  const give = (id: string, t: OpTask) => (plan.tasks[id] = t);
  const ok = (cmd: RealmCommand) => issue(cmd).ok;
  const handledFleets = new Set<string>();
  const handledWings = new Set<string>();

  const setDuty = (fl: Fleet, d: Omit<FleetDuty, 'since'>, kind: OpTaskKind, note: string): boolean => {
    handledFleets.add(fl.id);
    if (sameDuty(fl, d)) {
      give(fl.id, task(sim, prev[fl.id], kind, d.zone ?? d.province ?? d.fleet ?? null, note));
      return true;
    }
    const why = fleetDutyProblem(sim, nid, fl.id, d);
    if (why) {
      give(fl.id, task(sim, prev[fl.id], 'wait', null, `cannot ${kind}: ${why}`));
      return false;
    }
    ok({ type: 'fleetDuty', nation: nid, fleet: fl.id, duty: d });
    give(fl.id, task(sim, prev[fl.id], kind, d.zone ?? d.province ?? d.fleet ?? null, note));
    return true;
  };

  const setMission = (w: AirWing, mission: AirMission, target: ProvinceId | null, zone: ZoneId | null, kind: OpTaskKind, note: string): boolean => {
    handledWings.add(w.id);
    if (w.mission === mission && w.target === target && (w.zone ?? null) === zone) {
      give(w.id, task(sim, prev[w.id], kind, target ?? zone, note));
      return true;
    }
    let why = missionProblem(sim, nid, w.id, mission, target, zone);
    if (why && /out of range/.test(why) && op.rebase && !w.carrier && target) {
      const base = rebaseFor(sim, w, target);
      if (base && ok({ type: 'rebaseWing', nation: nid, wing: w.id, base })) {
        opLog(sim, op, `${w.name} moved to the airfield at ${provName(sim, base)} to reach ${provName(sim, target)}.`);
        why = missionProblem(sim, nid, w.id, mission, target, zone);
      }
    }
    if (why) {
      give(w.id, task(sim, prev[w.id], 'wait', target ?? zone, `${why}${/out of range/.test(why) && !op.rebase ? ' Rebasing is not allowed for this operation.' : ''}`));
      return false;
    }
    ok({ type: 'airMission', nation: nid, wing: w.id, mission, target, zone });
    give(w.id, task(sim, prev[w.id], kind, target ?? zone, note));
    return true;
  };

  // ── repairs: worn fleets to port until they are fit (half the hull; fit again at 90%) ──
  for (const fl of f.fleets) {
    if (fl.cargo.length) {
      handledFleets.add(fl.id);
      give(fl.id, task(sim, prev[fl.id], 'transport', fl.landing, `carrying ${fl.cargo.length} arm${fl.cargo.length === 1 ? 'y' : 'ies'} to ${fl.landing ? provName(sim, fl.landing) : 'the coast'}`));
      continue;
    }
    const hull = hullShare(fl);
    const repairing = prev[fl.id]?.kind === 'repair';
    if (hull < 0.5 || (repairing && hull < 0.9)) {
      const port = returnPort(sim, fl);
      if (port) setDuty(fl, { kind: 'port', province: port }, 'repair', `repairing at ${provName(sim, port)}: hull ${Math.round(hull * 100)}% (back to duty at 90%)`);
      else {
        handledFleets.add(fl.id);
        give(fl.id, task(sim, prev[fl.id], 'wait', null, `needs repairs (hull ${Math.round(hull * 100)}%) but no port of ours is reachable`));
      }
    }
  }
  // ── rest: worn wings stand down (below 35% readiness; back at 70%) ──
  for (const w of f.wings) {
    if (w.type === 'transport') continue;
    const resting = prev[w.id]?.kind === 'rest';
    if (w.readiness < 35 || (resting && w.readiness < 70) || w.strength < 30) {
      handledWings.add(w.id);
      if (w.mission !== 'idle') ok({ type: 'airMission', nation: nid, wing: w.id, mission: 'idle', target: null });
      give(w.id, task(sim, prev[w.id], 'rest', null, `resting at its base: readiness ${Math.round(w.readiness)}%, strength ${Math.round(w.strength)}% (flies again at 70% readiness)`));
    }
  }

  // ── the landing ──
  if (op.kind === 'landing' && op.landing && op.landing.stage !== 'ashore') landing(sim, op, f, plan, give, prev, ok, setDuty, setMission, handledFleets);

  // ── airborne ──
  airborne(sim, op, f, plan, give, prev, issue);

  // ── support for the ground plan (after it is made) ──
  plan.support = (g: GroundOutcome) => {
    // the main efforts: where most of the operation's strength attacks, defends or besieges
    const weight = new Map<ProvinceId, number>();
    for (const [id, t] of Object.entries(g.tasks)) {
      if (!t.target || !['attack', 'occupy', 'defend', 'stage'].includes(t.kind)) continue;
      const a = st.armies[id];
      if (!a) continue;
      const tgt = t.kind === 'stage' ? (op.assigned[id]?.target ?? t.target) : t.target;
      weight.set(tgt, (weight.get(tgt) ?? 0) + armyStrength(sim, a) * (t.kind === 'stage' ? 0.6 : 1));
    }
    // battles our members fight count first
    for (const b of Object.values(st.battles)) {
      const ours = [...b.attackers, ...b.defenders].some((id) => st.armies[id]?.op === op.id);
      if (ours) weight.set(b.province, (weight.get(b.province) ?? 0) + 50);
    }
    const efforts = [...weight.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([p]) => p);
    const outOfRange: string[] = [];
    // aircraft
    let fi = 0;
    let ai = 0;
    for (const w of f.wings) {
      if (handledWings.has(w.id) || w.type === 'transport') continue;
      const can = (m: AirMission) => (WINGS[w.type].missions as readonly string[]).includes(m);
      if (op.kind === 'sea' || (op.kind === 'landing' && op.landing?.stage !== 'ashore' && !efforts.length)) {
        const z = seaTarget(sim, op, w);
        if (z && can('naval') && z.enemy) setMission(w, 'naval', null, z.zone, 'strike', `striking the enemy ships in ${sim.world.zones[z.zone].name}`);
        else if (z && can('superiority')) setMission(w, 'superiority', null, z.zone, 'cover', `keeping the sky over ${sim.world.zones[z.zone].name}`);
        else if (can('recon') && z) setMission(w, 'recon', null, z.zone, 'cover', `watching ${sim.world.zones[z.zone].name}`);
        if (!handledWings.has(w.id)) give(w.id, task(sim, prev[w.id], 'wait', null, 'nothing in reach to do'));
        continue;
      }
      if (!efforts.length) {
        if (w.mission !== 'idle') ok({ type: 'airMission', nation: nid, wing: w.id, mission: 'idle', target: null });
        give(w.id, task(sim, prev[w.id], 'rest', null, 'standing by: no battle or target of the operation yet'));
        continue;
      }
      let done = false;
      if (can('superiority') && w.type === 'fighter') {
        const t = efforts[Math.min(fi++, efforts.length - 1)];
        done = setMission(w, 'superiority', t, null, 'cover', `keeping the sky over ${provName(sim, t)}`);
      } else if (can('support') && w.type === 'attack') {
        const t = efforts[Math.min(ai++, efforts.length - 1)];
        const battle = Object.values(st.battles).some((b) => b.province === t);
        const enemyNear = !battle && hostileArmiesAt(sim, nid, t).length === 0 ? enemyArmyNear(sim, nid, t) : null;
        if (enemyNear && can('interdiction')) done = setMission(w, 'interdiction', enemyNear, null, 'interdict', `striking the enemy troops at ${provName(sim, enemyNear)} before ${provName(sim, t)}`);
        else done = setMission(w, 'support', t, null, 'support', `supporting our troops at ${provName(sim, t)}`);
      } else if (can('interdiction')) {
        const t = efforts[0];
        const near = enemyArmyNear(sim, nid, t) ?? t;
        done = setMission(w, 'interdiction', near, null, 'interdict', `striking supply and reinforcements at ${provName(sim, near)}`);
      } else if (can('recon')) {
        done = setMission(w, 'recon', efforts[0], null, 'cover', `scouting ${provName(sim, efforts[0])}`);
      }
      if (!done && /out of range/.test(plan.tasks[w.id]?.note ?? '')) outOfRange.push(w.name);
    }
    if (outOfRange.length && !op.rebase) raiseIssue(sim, op, 'air-range', `${outOfRange.join(', ')} cannot reach the operation's fighting from ${outOfRange.length === 1 ? 'its' : 'their'} airfield${outOfRange.length === 1 ? '' : 's'}: allow rebasing, or move ${outOfRange.length === 1 ? 'it' : 'them'} yourself.`);
    else if (op.issue?.code === 'air-range') clearIssue(op, 'air-range');

    // fleets
    const coastal = efforts.filter((p) => (sim.world.provZones[p] ?? []).length);
    const enemyCoast = op.area.filter((p) => (sim.world.provZones[p] ?? []).length && st.provinces[p].controller && atWar(sim, nid, st.provinces[p].controller!));
    for (const fl of f.fleets) {
      if (handledFleets.has(fl.id)) continue;
      if (op.kind === 'sea') {
        seaDuty(sim, op, fl, f, setDuty, give, prev);
        continue;
      }
      if (transportsOnly(fl)) {
        const port = returnPort(sim, fl);
        if (port) setDuty(fl, { kind: 'port', province: port }, 'transport', `waiting in port at ${provName(sim, port)}`);
        continue;
      }
      if (subsOnly(fl)) {
        const z = enemyCoast.length ? (sim.world.provZones[enemyCoast[0]] ?? [])[0] : null;
        if (z) setDuty(fl, { kind: 'raid', zone: z }, 'strike', `raiding enemy shipping in ${sim.world.zones[z].name}`);
        else give(fl.id, task(sim, prev[fl.id], 'wait', null, 'no enemy coast in the area to raid off'));
        continue;
      }
      if (guns(fl) && coastal.length) {
        // shell where our armies fight or besiege (eligible battles and sieges)
        const p = coastal.find((x) => pathToCoast(sim, fl.zone, x)) ?? null;
        if (p) {
          setDuty(fl, { kind: 'bombard', province: p }, 'bombard', `shelling ${provName(sim, p)} for our troops there`);
          continue;
        }
      }
      if (carriers(fl) && efforts.length) {
        const z = nearestZone(sim, fl, efforts[0]);
        if (z) {
          setDuty(fl, { kind: 'patrol', zone: z }, 'cover', `on station in ${sim.world.zones[z].name} so its wings reach ${provName(sim, efforts[0])}`);
          continue;
        }
      }
      // Auto-conquer: the strongest squadrons go for enemy ships they can beat, off our coasts or theirs
      if (op.kind === 'war' && warships(fl)) {
        const hot = interceptZone(sim, op, fl);
        if (hot) {
          setDuty(fl, { kind: 'patrol', zone: hot.zone }, 'patrol', `intercepting ${hot.ships} enemy ship${hot.ships === 1 ? '' : 's'} in ${sim.world.zones[hot.zone].name}`);
          continue;
        }
      }
      if (warships(fl) && enemyCoast.length) {
        const z = enemyCoast.map((p) => nearestZone(sim, fl, p)).find((x) => x) ?? null;
        if (z) {
          setDuty(fl, { kind: 'blockade', zone: z }, 'blockade', `blockading the enemy coast in ${sim.world.zones[z].name}`);
          continue;
        }
      }
      give(fl.id, task(sim, prev[fl.id], 'wait', fl.zone, 'no coast of the operation within reach: on station'));
    }
  };
  return plan;
}

/**
 * A zone off our coast or the enemies' where enemy warships lie that this fleet
 * outguns (with the friends already there), within six zones: the nearest first.
 */
function interceptZone(sim: Sim, op: Operation, fl: Fleet): { zone: ZoneId; ships: number } | null {
  const st = sim.state;
  const nid = op.nation;
  const mine = surfacePower(fl);
  let best: { zone: ZoneId; ships: number; d: number } | null = null;
  for (const e of Object.values(st.fleets)) {
    if (!atWar(sim, nid, e.nation) || !e.ships.length) continue;
    const z = e.zone;
    const coasts = sim.world.zones[z]?.coasts ?? [];
    if (!coasts.some((p) => st.provinces[p].owner === nid || op.area.includes(p))) continue;
    const b = zoneBalance(sim, z, nid);
    if (b.hostileSurface <= 0 || mine + b.friendSurface < b.hostileSurface * 1.2) continue;
    const path = z === fl.zone ? [] : zonePath(sim, fl.zone, z);
    if (!path || path.length > 6) continue;
    const ships = Object.values(st.fleets).filter((x) => x.zone === z && atWar(sim, nid, x.nation)).reduce((n, x) => n + x.ships.length, 0);
    if (!best || path.length < best.d) best = { zone: z, ships, d: path.length };
  }
  return best ? { zone: best.zone, ships: best.ships } : null;
}

/** An airfield of ours with room, in range of the target, with no enemy army next to it (nearest the target first). */
function rebaseFor(sim: Sim, w: AirWing, target: ProvinceId): ProvinceId | null {
  const st = sim.state;
  const nid = w.nation;
  let best: ProvinceId | null = null;
  let bs = Infinity;
  for (const p of sim.world.provIds) {
    const ps = st.provinces[p];
    if (ps.airfield < 1 || ps.controller !== nid || ps.owner !== nid || p === w.base || airfieldRoom(sim, p) <= 0) continue;
    if (!inRangeOf(sim, { nation: nid, type: w.type, base: p, carrier: null }, { prov: target })) continue;
    if (hostileArmiesAt(sim, nid, p).length || sim.world.prov[p].neighbors.some((n) => hostileArmiesAt(sim, nid, n).length)) continue;
    if (rebaseProblem(sim, nid, w.id, p)) continue;
    const d = (sim.world.hop(p, target) ?? 50) * 2 + (sim.world.hop(p, w.base) ?? 50) * 0.1;
    if (d < bs) {
      bs = d;
      best = p;
    }
  }
  return best;
}

/** The nearest province next to `pid` holding enemy troops (or `pid` itself), for a strike before the attack. */
function enemyArmyNear(sim: Sim, nid: string, pid: ProvinceId): ProvinceId | null {
  if (hostileArmiesAt(sim, nid, pid).length) return pid;
  let best: ProvinceId | null = null;
  let bs = 0;
  for (const n of sim.world.prov[pid].neighbors) {
    const s = sumStrength(sim, hostileArmiesAt(sim, nid, n));
    if (s > bs) {
      bs = s;
      best = n;
    }
  }
  return best;
}

function nearestZone(sim: Sim, fl: Fleet, pid: ProvinceId): ZoneId | null {
  let best: ZoneId | null = null;
  let bl = Infinity;
  for (const z of sim.world.provZones[pid] ?? []) {
    const path = z === fl.zone ? [] : zonePath(sim, fl.zone, z);
    if (path && path.length < bl) {
      bl = path.length;
      best = z;
    }
  }
  return best;
}

/** The sea zone of a sea operation a wing should fly over: enemy ships first, then the zone the operation's fleets need covered. */
function seaTarget(sim: Sim, op: Operation, w: AirWing): { zone: ZoneId; enemy: boolean } | null {
  const st = sim.state;
  const zones = op.kind === 'sea' ? op.zones : (sim.world.provZones[op.area[0]] ?? []);
  let best: { zone: ZoneId; enemy: boolean; s: number } | null = null;
  for (const z of zones) {
    if (!inRangeOf(sim, w, { zone: z })) continue;
    let enemy = 0;
    for (const fl of Object.values(st.fleets)) if (fl.zone === z && atWar(sim, w.nation, fl.nation)) enemy += fl.ships.length;
    const s = enemy * 10 - (st.fleets && Object.values(st.fleets).some((x) => x.op === op.id && x.zone === z) ? 0 : 1);
    if (!best || s > best.s) best = { zone: z, enemy: enemy > 0, s };
  }
  return best ? { zone: best.zone, enemy: best.enemy } : null;
}

/** A fleet in a sea operation: intercept enemy fleets in the zones, escort our loaded ships, patrol the rest. */
function seaDuty(sim: Sim, op: Operation, fl: Fleet, f: OpForces, setDuty: (fl: Fleet, d: Omit<FleetDuty, 'since'>, kind: OpTaskKind, note: string) => boolean, give: (id: string, t: OpTask) => void, prev: Record<string, OpTask>): void {
  const st = sim.state;
  const nid = op.nation;
  if (subsOnly(fl)) {
    const z = op.zones.find((x) => Object.values(st.fleets).some((e) => e.zone === x && atWar(sim, nid, e.nation))) ?? op.zones[0];
    setDuty(fl, { kind: 'raid', zone: z }, 'strike', `raiding in ${sim.world.zones[z].name}`);
    return;
  }
  if (transportsOnly(fl)) {
    const port = returnPort(sim, fl);
    if (port) setDuty(fl, { kind: 'port', province: port }, 'transport', `in port at ${provName(sim, port)}`);
    return;
  }
  // our loaded ships passing through the zones need an escort
  const convoy = Object.values(st.fleets).find((x) => x.nation === nid && x.id !== fl.id && x.cargo.length && (op.zones.includes(x.zone) || x.path.some((z) => op.zones.includes(z))) && !Object.values(st.fleets).some((e) => e.op === op.id && e.duty?.kind === 'escort' && e.duty.fleet === x.id && e.id !== fl.id));
  if (convoy && warships(fl)) {
    setDuty(fl, { kind: 'escort', fleet: convoy.id }, 'escort', `escorting ${convoy.name} through the operation's waters`);
    return;
  }
  // intercept: the strongest of our fleets to the zone with the most enemy warships
  let hot: { z: ZoneId; n: number } | null = null;
  for (const z of op.zones) {
    let n = 0;
    for (const e of Object.values(st.fleets)) if (e.zone === z && atWar(sim, nid, e.nation)) n += e.ships.length;
    if (n > 0 && (!hot || n > hot.n)) hot = { z, n };
  }
  const ours = f.fleets.filter((x) => warships(x) && !x.cargo.length).sort((a, b) => b.ships.length - a.ships.length || (a.id < b.id ? -1 : 1));
  if (hot && ours[0]?.id === fl.id) {
    setDuty(fl, { kind: 'patrol', zone: hot.z }, 'patrol', `intercepting ${hot.n} enemy ship${hot.n === 1 ? '' : 's'} in ${sim.world.zones[hot.z].name}`);
    return;
  }
  // spread over the zones, one fleet a zone in turn
  const i = ours.findIndex((x) => x.id === fl.id);
  const z = op.zones[(Math.max(0, i) + (hot ? 1 : 0)) % op.zones.length];
  if (moveFleetProblem(sim, nid, fl.id, z) && fl.zone !== z) {
    give(fl.id, task(sim, prev[fl.id], 'wait', z, `cannot reach ${sim.world.zones[z].name}`));
    return;
  }
  setDuty(fl, { kind: 'patrol', zone: z }, 'patrol', `patrolling ${sim.world.zones[z].name}`);
}

type Give = (id: string, t: OpTask) => void;
type SetDuty = (fl: Fleet, d: Omit<FleetDuty, 'since'>, kind: OpTaskKind, note: string) => boolean;
type SetMission = (w: AirWing, mission: AirMission, target: ProvinceId | null, zone: ZoneId | null, kind: OpTaskKind, note: string) => boolean;

/** The landing: gather at a port, bring the transports and escorts, cover the beach, sail; ashore, the area is taken like a conquest. */
function landing(sim: Sim, op: Operation, f: OpForces, plan: ForcesPlan, give: Give, prev: Record<string, OpTask>, ok: (cmd: RealmCommand) => boolean, setDuty: SetDuty, setMission: SetMission, handled: Set<string>): void {
  const st = sim.state;
  const nid = op.nation;
  const L = op.landing!;
  const beach = op.area[0];
  const armies = f.armies.filter((a) => st.armies[a.id] && !isPara(a));
  for (const a of armies) plan.reserved.add(a.id);
  // at sea: the transports sail on, the escorts stay with them, until the troops are ashore
  if (L.stage === 'sail') {
    const aboard = armies.filter((a) => a.embarked);
    if (aboard.length) {
      for (const a of aboard) give(a.id, task(sim, prev[a.id], 'transport', beach, `at sea, bound for ${provName(sim, beach)}`));
      const carriers = new Set(aboard.map((a) => a.embarked!));
      for (const id of carriers) handled.add(id);
      const lead = [...carriers].sort()[0];
      for (const e of f.fleets) if (!carriers.has(e.id) && warships(e) && !transportsOnly(e) && (prev[e.id]?.kind === 'escort' || e.duty?.kind === 'escort')) setDuty(e, { kind: 'escort', fleet: lead }, 'escort', `escorting the landing to ${provName(sim, beach)}`);
      return;
    }
    L.stage = 'ashore';
    op.stats.landings++;
    opLog(sim, op, `Landed at ${provName(sim, beach)}: the area is now taken like a conquest.`, 'good');
    for (const a of armies) plan.reserved.delete(a.id);
    return;
  }
  if (!armies.length) {
    raiseIssue(sim, op, 'landing', 'No armies are assigned to land: assign the landing force.');
    return;
  }
  const lift = f.fleets.filter((x) => fleetCapacity(x) > 0 && !x.cargo.length);
  const regs = armies.reduce((n, a) => n + a.regiments.length, 0);
  const carrier = lift.sort((a, b) => fleetCapacity(b) - fleetCapacity(a) || (a.id < b.id ? -1 : 1))[0];
  if (!carrier) {
    raiseIssue(sim, op, 'landing', 'No transports are assigned: assign a fleet with transports (2 regiments a transport).');
    return;
  }
  if (fleetCapacity(carrier) < regs) {
    raiseIssue(sim, op, 'landing', `The landing force is ${regs} regiments but ${carrier.name} carries ${fleetCapacity(carrier)}: add transports to that fleet, or take armies out of the operation.`);
    return;
  }
  // the embarkation port: a coast of ours with a sea route to the beach, nearest the armies
  if (!L.port || !st.provinces[L.port] || !isFriendly(sim, nid, st.provinces[L.port].controller) || !(sim.world.provZones[L.port] ?? []).some((z) => pathToCoast(sim, z, beach))) {
    L.port = null;
    let bs = Infinity;
    for (const p of portsOf(sim, nid).concat(sim.world.provIds.filter((p) => st.provinces[p].controller === nid && (sim.world.provZones[p] ?? []).length))) {
      const zones = sim.world.provZones[p] ?? [];
      const route = zones.map((z) => pathToCoast(sim, z, beach)).filter((x): x is ZoneId[] => !!x).sort((a, b) => a.length - b.length)[0];
      if (!route) continue;
      let s = route.length * 2;
      for (const a of armies) {
        const d = reachFrom(sim, nid, a.location).dist[p];
        s += d === undefined ? 100 : d;
      }
      if (s < bs || (s === bs && L.port && p < L.port)) {
        bs = s;
        L.port = p;
      }
    }
    if (!L.port) {
      raiseIssue(sim, op, 'landing', `No coast of ours has a sea route to ${provName(sim, beach)}.`);
      return;
    }
    opLog(sim, op, `The landing force gathers at ${provName(sim, L.port)}.`);
  }
  const port = L.port;
  const portZones = sim.world.provZones[port] ?? [];
  const embarkZone = portZones.find((z) => pathToCoast(sim, z, beach)) ?? portZones[0];
  // armies to the port
  let ready = true;
  for (const a of armies) {
    if (a.location !== port) {
      ready = false;
      if (!a.battle && !a.retreating && a.path[a.path.length - 1] !== port) ok({ type: 'move', nation: nid, army: a.id, dest: port });
      give(a.id, task(sim, prev[a.id], 'embark', port, `marching to the embarkation port at ${provName(sim, port)}`));
    } else if (a.path.length || a.battle) ready = false;
    else give(a.id, task(sim, prev[a.id], 'embark', port, `waiting at ${provName(sim, port)} to embark`));
  }
  // the transports to the port's waters
  if (carrier.zone !== embarkZone) {
    ready = false;
    if (carrier.path[carrier.path.length - 1] !== embarkZone && !moveFleetProblem(sim, nid, carrier.id, embarkZone)) ok({ type: 'moveFleet', nation: nid, fleet: carrier.id, zone: embarkZone });
    give(carrier.id, task(sim, prev[carrier.id], 'transport', embarkZone, `sailing to ${sim.world.zones[embarkZone].name} to take the troops aboard`));
  } else give(carrier.id, task(sim, prev[carrier.id], 'transport', embarkZone, `waiting off ${provName(sim, port)} for the troops`));
  // escorts sail with the transports; other gunships prepare the beach
  const escorts = f.fleets.filter((x) => x.id !== carrier.id && warships(x) && !transportsOnly(x));
  let escorted = !escorts.length;
  for (const [i, e] of escorts.entries()) {
    if (i === 0 || !guns(e)) {
      setDuty(e, { kind: 'escort', fleet: carrier.id }, 'escort', `escorting ${carrier.name}`);
      if (e.zone === carrier.zone) escorted = true;
    } else setDuty(e, { kind: 'bombard', province: beach }, 'bombard', `shelling the beach at ${provName(sim, beach)} before the landing`);
  }
  // air cover over the beach
  for (const w of f.wings) {
    if (w.type === 'transport' || plan.tasks[w.id]) continue;
    if ((WINGS[w.type].missions as readonly string[]).includes('superiority')) setMission(w, 'superiority', beach, null, 'cover', `covering the beach at ${provName(sim, beach)}`);
    else if ((WINGS[w.type].missions as readonly string[]).includes('support')) setMission(w, 'support', beach, null, 'support', `ready to support the landing at ${provName(sim, beach)}`);
  }
  if (!ready || !escorted) {
    clearIssue(op, 'landing');
    return;
  }
  // a threatened crossing without escorts waits (and says so)
  const route = pathToCoast(sim, carrier.zone, beach) ?? [];
  const threats = routeThreats(sim, carrier, route).filter((t) => t.surface > 0 || t.subs > 0);
  // a transport fleet with warships of its own escorts itself
  const selfEscort = warships(carrier);
  if (threats.length && !escorts.length && !selfEscort) {
    raiseIssue(sim, op, 'landing', `Enemy ships in ${threats.map((t) => sim.world.zones[t.zone].name).join(', ')} lie on the route to ${provName(sim, beach)}: assign escorts, or wait.`);
    return;
  }
  // enemy armies next to the beach would fall on a beachhead before it can be reinforced
  const ours = armies.reduce((s2, a) => s2 + armyStrength(sim, a), 0);
  const nearby = threatAround(sim, nid, beach, 1) - sumStrength(sim, hostileArmiesAt(sim, nid, beach));
  const limit = op.posture === 'aggressive' ? 1.5 : op.posture === 'balanced' ? 1 : 0.6;
  if (nearby > ours * limit) {
    raiseIssue(sim, op, 'landing', `Enemy armies next to ${provName(sim, beach)} (strength ${nearby.toFixed(1)} against our ${ours.toFixed(1)}) would overrun the beachhead: add forces, choose another beach, or wait.`);
    return;
  }
  // the beach's defenders: sail only into a fight the posture would take (the landing week favours them)
  const defenders = hostileArmiesAt(sim, nid, beach);
  if (defenders.length) {
    const f = forecastBattle(sim, beach, armies, defenders);
    const ok = op.posture === 'aggressive' ? f.verdict !== 'Likely defeat' : f.verdict === 'Likely victory';
    if (!ok) {
      raiseIssue(sim, op, 'landing', `${provName(sim, beach)} is held by ${f.defMen.toLocaleString()} men: the landing forecast is ${f.verdict.toLowerCase()} for our ${f.attMen.toLocaleString()}. Add forces, choose another beach, or wait for the defenders to leave.`);
      return;
    }
  }
  const why = shipArmiesProblem(sim, nid, armies.map((a) => a.id), carrier.id, beach);
  if (why) {
    raiseIssue(sim, op, 'landing', `The landing cannot sail: ${why}`);
    return;
  }
  if (ok({ type: 'shipArmies', nation: nid, armies: armies.map((a) => a.id), fleet: carrier.id, dest: beach })) {
    handled.add(carrier.id);
    give(carrier.id, task(sim, prev[carrier.id], 'transport', beach, `carrying the landing force to ${provName(sim, beach)}`));
    L.stage = 'sail';
    clearIssue(op, 'landing');
    opLog(sim, op, `${armies.length} arm${armies.length === 1 ? 'y' : 'ies'} (${regs} regiments) embarked at ${provName(sim, port)} for ${provName(sim, beach)}${escorts.length ? `, escorted by ${escorts[0].name}` : selfEscort ? `, escorted by ${carrier.name}'s own warships` : ''}.`, 'good');
    for (const a of armies) give(a.id, task(sim, prev[a.id], 'transport', beach, `at sea, bound for ${provName(sim, beach)}`));
  }
}

/**
 * Airborne troops under the mandate: to an airfield with the operation's own
 * transports, then a drop on an enemy-held province of the area within the loss
 * limit, near enough to our armies to be relieved; "once" ends the mandate.
 */
function airborne(sim: Sim, op: Operation, f: OpForces, plan: ForcesPlan, give: Give, prev: Record<string, OpTask>, issue: (cmd: RealmCommand, why?: string) => CommandResult): void {
  const st = sim.state;
  const nid = op.nation;
  const paras = f.armies.filter((a) => isPara(a) && !a.embarked && !a.battle && !a.retreating);
  const transports = f.wings.filter((w) => w.type === 'transport' && !w.carrier);
  for (const w of transports) give(w.id, task(sim, prev[w.id], op.airborne === 'off' ? 'rest' : 'drop', w.base, op.airborne === 'off' ? 'no airborne mandate: standing by' : `ready to fly the operation's airborne troops from ${provName(sim, w.base)}`));
  if (op.airborne === 'off' || !paras.length) return;
  const own: WingId[] = transports.map((w) => w.id);
  const mm = maxMorale(sim, nid);
  let launched = false;
  for (const a of paras) {
    // down already, in enemy land: the ground plan takes it on
    const c = st.provinces[a.location].controller;
    if (c && atWar(sim, nid, c)) continue;
    if (a.drop) {
      plan.reserved.add(a.id);
      give(a.id, task(sim, prev[a.id], 'drop', a.drop.target, `boarding the transports at ${provName(sim, a.location)} for ${provName(sim, a.drop.target)}`));
      continue;
    }
    const full = a.regiments.length * C.regimentSize;
    if (a.morale < mm * 0.7 || menOf(a) < full * 0.7) {
      plan.reserved.add(a.id);
      give(a.id, task(sim, prev[a.id], 'recover', a.location, `recovering before another drop (morale ${Math.round((a.morale / mm) * 100)}%, men ${Math.round((menOf(a) / full) * 100)}%)`));
      continue;
    }
    plan.reserved.add(a.id);
    // to an airfield where the operation's transports are
    const fields = [...new Set(transports.map((w) => w.base))].filter((p) => st.provinces[p].controller === nid);
    if (!fields.length) {
      give(a.id, task(sim, prev[a.id], 'wait', null, 'waiting: the operation has no transport wings at an airfield of ours'));
      continue;
    }
    if (!fields.includes(a.location)) {
      const r = reachFrom(sim, nid, a.location);
      const field = fields.filter((p) => r.dist[p] !== undefined).sort((x, y) => r.dist[x] - r.dist[y] || (x < y ? -1 : 1))[0];
      if (!field) {
        give(a.id, task(sim, prev[a.id], 'wait', null, 'waiting: no route to the transports’ airfield'));
        continue;
      }
      if (a.path[a.path.length - 1] !== field) issue({ type: 'move', nation: nid, army: a.id, dest: field });
      give(a.id, task(sim, prev[a.id], 'stage', field, `marching to the airfield at ${provName(sim, field)} for an airborne operation`));
      continue;
    }
    if (launched) {
      give(a.id, task(sim, prev[a.id], 'wait', a.location, 'waiting: one drop a week'));
      continue;
    }
    // the drop zone: enemy-held land in the area, within the loss limit, weakly held, near our armies
    const ready = transportsAt(sim, nid, a.location, own).length;
    if (ready < a.regiments.length) {
      give(a.id, task(sim, prev[a.id], 'wait', a.location, `waiting for transports: ${ready} of the ${a.regiments.length} needed are ready at ${provName(sim, a.location)}`));
      continue;
    }
    const ours = f.armies.filter((x) => !isPara(x) && !x.embarked);
    let best: { pid: ProvinceId; s: number } | null = null;
    let reason = 'no enemy-held province of the area in reach';
    for (const pid of op.area) {
      const p = st.provinces[pid];
      if (!p.controller || !atWar(sim, nid, p.controller)) continue;
      if (airDropProblem(sim, nid, a.id, pid, own)) continue;
      const risk = airDropRisk(sim, nid, pid);
      if (risk.loss > op.airborneRisk) {
        reason = `${provName(sim, pid)} would cost about ${Math.round(risk.loss * 100)}% of the men (limit ${Math.round(op.airborneRisk * 100)}%)`;
        continue;
      }
      const def = sumStrength(sim, hostileArmiesAt(sim, nid, pid));
      if (def > armyStrength(sim, a) * 0.7) {
        reason = `${provName(sim, pid)} is held too strongly to drop on`;
        continue;
      }
      if (siegeRegiments(p.fort) > a.regiments.length && p.fort > 0) {
        reason = `${provName(sim, pid)}'s fort needs more regiments than the drop carries`;
        continue;
      }
      // relief: our armies within two marches, or our land next to it
      let near = 99;
      for (const x of ours) near = Math.min(near, sim.world.hop(x.location, pid) ?? 99);
      const nextToOurs = sim.world.prov[pid].neighbors.some((n) => isFriendly(sim, nid, st.provinces[n].controller));
      if (near > 2 && !nextToOurs) {
        reason = `${provName(sim, pid)} is beyond the reach of our armies to relieve the drop`;
        continue;
      }
      const s = p.dev + (near <= 1 ? 4 : 0) - risk.loss * 20 - def;
      if (!best || s > best.s || (s === best.s && pid < best.pid)) best = { pid, s };
    }
    if (!best) {
      give(a.id, task(sim, prev[a.id], 'wait', a.location, `no drop: ${reason}`));
      continue;
    }
    const r = issue({ type: 'airDrop', nation: nid, army: a.id, target: best.pid, wings: own });
    if (!r.ok) {
      give(a.id, task(sim, prev[a.id], 'wait', a.location, `no drop: ${r.reason}`));
      continue;
    }
    launched = true;
    op.stats.drops++;
    const risk = airDropRisk(sim, nid, best.pid);
    opLog(sim, op, `${a.name} ordered to drop on ${provName(sim, best.pid)} (expected losses about ${Math.round(risk.loss * 100)}%).`, 'good');
    give(a.id, task(sim, prev[a.id], 'drop', best.pid, `boarding for a drop on ${provName(sim, best.pid)}`));
    if (op.airborne === 'once') {
      op.airborne = 'off';
      opLog(sim, op, 'The airborne mandate is used (one drop): further drops need your permission.');
    }
  }
  void wingRange;
}
