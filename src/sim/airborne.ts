// Airborne operations and anti-aircraft defence (format 7).
//
// Anti-aircraft fire over a province, against a realm's aircraft: the batteries of
// the province's controller (a project, 0–3 levels) when it is at war with that
// realm, plus mobile guns of the armies there at war with it (with Air Defence,
// half a level for each artillery regiment, at most 1.5), at most 4 levels in all.
// Enemy wings flying a mission over the province (bombing and interdiction at
// their target, ground support over the battle they join) lose 1.5 strength a week
// per level and achieve 8% less per level; batteries cost 0.4 crowns a month a
// level. Ships keep their own anti-aircraft fire (naval.ts, air.ts).
//
// An airborne operation: an army of airborne regiments only, standing at one of
// our airfields with enough ready transport wings based there (one regiment
// each), is ordered to a province within the transports' range. It is flown in
// the week's air phase, after movement and before battles: who holds the sky over
// the target (the enemy's: 30% of the men lost; contested: 12%) and the
// anti-aircraft fire there (5% a level) take their share (at most half), the
// transports lose strength in proportion and 30 readiness, and the army lands as
// an ordinary army that fights at 70% that week. It besieges and takes ground
// like any other army; it is supplied only if a supply line reaches it. Until it
// is flown the operation can be cancelled; it is aborted (with the reason) if the
// army or the transports are no longer at the airfield, the airfield is lost, or
// the target can no longer be reached.

import { airControl, stepsTo, wingRange, wingStatus } from './air';
import { C, UNITS, WINGS } from './config';
import { warDead } from './economy';
import { armiesIn, touchArmies } from './index';
import { atWar, isFriendly, notify, provName, type Sim } from './state';
import type { Army, ArmyId, NationId, ProvinceId, WingId } from './types';

/** Anti-aircraft levels over a province against `attacker`'s aircraft: batteries, mobile guns, total. */
export function aaAgainst(sim: Sim, pid: ProvinceId, attacker: NationId): { batteries: number; mobile: number; total: number } {
  const st = sim.state;
  const p = st.provinces[pid];
  const batteries = p.controller && atWar(sim, attacker, p.controller) ? p.aa ?? 0 : 0;
  let guns = 0;
  for (const a of armiesIn(sim, pid)) {
    if (!atWar(sim, attacker, a.nation) || a.embarked || !st.nations[a.nation].research.done.includes('air_defence')) continue;
    for (const r of a.regiments) if (r.type === 'artillery') guns++;
  }
  const mobile = Math.min(C.air.mobileAAMax, guns * C.air.mobileAA);
  return { batteries, mobile, total: Math.min(C.air.aaMax, batteries + mobile) };
}

/** Anti-aircraft levels our own side has over a province (batteries of ours, guns of our armies there). */
export function aaOwn(sim: Sim, pid: ProvinceId, nid: NationId): { batteries: number; mobile: number; total: number } {
  const st = sim.state;
  const p = st.provinces[pid];
  const batteries = p.controller === nid || (p.controller && isFriendly(sim, nid, p.controller)) ? p.aa ?? 0 : 0;
  let guns = 0;
  for (const a of armiesIn(sim, pid)) {
    if ((a.nation !== nid && !isFriendly(sim, nid, a.nation)) || a.embarked || !st.nations[a.nation].research.done.includes('air_defence')) continue;
    for (const r of a.regiments) if (r.type === 'artillery') guns++;
  }
  const mobile = Math.min(C.air.mobileAAMax, guns * C.air.mobileAA);
  return { batteries, mobile, total: Math.min(C.air.aaMax, batteries + mobile) };
}

/** Transport wings of ours based at a province, ready to fly an airborne operation. */
export function transportsAt(sim: Sim, nid: NationId, pid: ProvinceId): WingId[] {
  const st = sim.state;
  return Object.keys(st.wings)
    .sort()
    .filter((id) => {
      const w = st.wings[id];
      return w.nation === nid && w.type === 'transport' && !w.carrier && w.base === pid && w.strength >= 50 && w.readiness >= C.air.minReady && !wingBusy(sim, id);
    });
}

/** A transport wing already committed to another operation this week. */
function wingBusy(sim: Sim, id: WingId): boolean {
  for (const a of Object.values(sim.state.armies)) if (a.drop?.wings.includes(id)) return true;
  return false;
}

/** Why this army cannot be dropped there (null: it can). */
export function airDropProblem(sim: Sim, nid: NationId, armyId: ArmyId, target: ProvinceId): string | null {
  const st = sim.state;
  const a = st.armies[armyId];
  if (!a || a.nation !== nid) return 'Not our army.';
  if (!st.nations[nid].research.done.includes('airborne_forces')) return 'Airborne operations need the Airborne Forces technology.';
  if (a.embarked) return 'The army is at sea.';
  if (a.battle) return 'The army is fighting a battle.';
  if (a.retreating) return 'The army is retreating.';
  if (a.drop) return `The army is already ordered to drop on ${provName(sim, a.drop.target)}.`;
  const other = a.regiments.filter((r) => r.type !== 'airborne');
  if (other.length) return `Only airborne regiments can be dropped: detach the other ${other.length} regiment${other.length === 1 ? '' : 's'} first.`;
  const base = st.provinces[a.location];
  if (!(base.airfield > 0) || base.controller !== nid) return `${a.name} must stand at one of our airfields to be flown (it is at ${provName(sim, a.location)}).`;
  const ready = transportsAt(sim, nid, a.location);
  const lift = ready.reduce((n, id) => n + (WINGS[st.wings[id].type].lift ?? 0), 0);
  const allT = Object.values(st.wings).filter((w) => w.nation === nid && w.type === 'transport' && w.base === a.location && !w.carrier).length;
  if (lift < a.regiments.length) return `Needs ${a.regiments.length} ready transport wing${a.regiments.length === 1 ? '' : 's'} at ${provName(sim, a.location)} (one regiment each); ${ready.length} of ${allT} there ${ready.length === 1 ? 'is' : 'are'} ready (strength 50% and readiness ${C.air.minReady}% at least).`;
  const t = st.provinces[target];
  if (!t) return 'Unknown province.';
  if (target === a.location) return 'The army is already there.';
  const steps = stepsTo(sim, { base: a.location, carrier: null }, { prov: target });
  const reach = wingRange(sim, { nation: nid, type: 'transport' });
  if (steps > reach) return `${provName(sim, target)} is ${steps === Infinity ? 'out of' : `${steps} steps away, beyond`} the transports' reach (${reach} steps).`;
  const ctl = t.controller;
  const ok = !ctl || ctl === nid || isFriendly(sim, nid, ctl) || atWar(sim, nid, ctl);
  if (!ok) return 'We may drop only on our own or friendly land, unclaimed land, or land held by an enemy at war with us.';
  return null;
}

export interface DropRisk {
  /** share of the men expected to be lost on the way in */
  loss: number;
  sky: 'ours' | 'theirs' | 'contested' | 'none';
  aa: number;
  /** enemy regiments waiting in the target province */
  defenders: number;
  notes: string[];
}

/** What an airborne operation would face: the sky and the guns over the target, the troops waiting there. */
export function airDropRisk(sim: Sim, nid: NationId, target: ProvinceId): DropRisk {
  const st = sim.state;
  const sky = airControl(sim, { prov: target }, nid);
  const aa = aaAgainst(sim, target, nid).total;
  let loss = sky === 'theirs' ? C.air.dropIntercept : sky === 'contested' ? C.air.dropDisputed : 0;
  loss = Math.min(C.air.dropLossMax, loss + aa * C.air.dropAA);
  let defenders = 0;
  for (const x of armiesIn(sim, target)) if (atWar(sim, nid, x.nation)) defenders += x.regiments.length;
  const notes: string[] = [];
  if (sky === 'theirs') notes.push(`The enemy holds the sky over ${provName(sim, target)}: fighters will cut ${Math.round(C.air.dropIntercept * 100)}% of the men down on the way in. Win the sky first (fighters on air superiority).`);
  else if (sky === 'contested') notes.push(`The sky over ${provName(sim, target)} is contested: about ${Math.round(C.air.dropDisputed * 100)}% of the men will be lost to fighters.`);
  else notes.push(sky === 'ours' ? 'We hold the sky over the target.' : 'No enemy aircraft over the target.');
  if (aa > 0) notes.push(`Anti-aircraft fire (level ${aa.toFixed(1)}) will take another ${Math.round(aa * C.air.dropAA * 100)}%.`);
  if (defenders) notes.push(`${defenders} enemy regiment${defenders === 1 ? '' : 's'} wait${defenders === 1 ? 's' : ''} there: the landing troops fight at ${Math.round(C.air.dropLanding * 100)}% the week they land.`);
  const p = st.provinces[target];
  if (p.fort > 0 && p.controller && atWar(sim, nid, p.controller)) notes.push(`A fort (level ${p.fort}) must be besieged with ${C.siege.minRegimentsPerLevel * p.fort} regiments before the province falls.`);
  notes.push('Once down, the army is supplied only if a supply line of ours reaches it (or it takes a port or a fort to hold).');
  return { loss, sky, aa, defenders, notes };
}

/** Orders the drop: the army waits at the airfield and is flown in this week's air phase. */
export function launchAirDrop(sim: Sim, nid: NationId, armyId: ArmyId, target: ProvinceId): void {
  const st = sim.state;
  const a = st.armies[armyId];
  const need = a.regiments.length;
  const wings: WingId[] = [];
  let lift = 0;
  for (const id of transportsAt(sim, nid, a.location)) {
    if (lift >= need) break;
    wings.push(id);
    lift += WINGS[st.wings[id].type].lift ?? 0;
  }
  a.drop = { target, wings, since: st.tick };
  a.path = [];
  a.progress = 0;
  a.order = null;
}

export function cancelAirDrop(sim: Sim, armyId: ArmyId): void {
  const a = sim.state.armies[armyId];
  if (a) a.drop = null;
}

/** Why an ordered drop can no longer be flown (null: it can). */
function dropAbort(sim: Sim, a: Army): string | null {
  const st = sim.state;
  const d = a.drop!;
  if (a.battle) return 'the army was caught in a battle at the airfield';
  const base = st.provinces[a.location];
  if (!(base.airfield > 0) || base.controller !== a.nation) return `the airfield at ${provName(sim, a.location)} is no longer ours`;
  const wings = d.wings.map((id) => st.wings[id]).filter((w) => !!w && w.base === a.location && !w.carrier && w.strength >= 50 && wingStatus(sim, w).state !== 'grounded');
  const lift = wings.reduce((n, w) => n + (WINGS[w.type].lift ?? 0), 0);
  if (lift < a.regiments.length) return 'too few transports are fit to fly';
  const t = st.provinces[d.target];
  const ctl = t.controller;
  if (ctl && ctl !== a.nation && !isFriendly(sim, a.nation, ctl) && !atWar(sim, a.nation, ctl)) return `${provName(sim, d.target)} is no longer held by an enemy or a friend`;
  return null;
}

/**
 * The air phase's airborne operations (after movement, before battles are found):
 * each ordered drop is flown, takes its losses on the way in, and lands.
 */
export function resolveAirDrops(sim: Sim): void {
  const st = sim.state;
  let moved = false;
  for (const id of Object.keys(st.armies).sort()) {
    const a = st.armies[id];
    if (!a?.drop) continue;
    const d = a.drop;
    const why = dropAbort(sim, a);
    if (why) {
      a.drop = null;
      notify(sim, a.nation, 'urgent', 'air', `The airborne drop of ${a.name} on ${provName(sim, d.target)} was called off: ${why}.`, { province: a.location });
      continue;
    }
    const risk = airDropRisk(sim, a.nation, d.target);
    // the men lost on the way in, regiment by regiment
    let lost = 0;
    let before = 0;
    for (const r of a.regiments) {
      before += r.men;
      const l = Math.round(r.men * risk.loss);
      r.men -= l;
      lost += l;
    }
    a.regiments = a.regiments.filter((r) => r.men >= 50);
    if (lost > 0) warDead(sim, a.nation, lost);
    // the transports: shot at in proportion, worn by the sortie
    for (const wid of d.wings) {
      const w = st.wings[wid];
      if (!w) continue;
      w.strength = Math.max(5, w.strength - risk.loss * 40 * WINGS.transport.vulnerability);
      w.readiness = Math.max(0, w.readiness - C.air.dropWear);
      w.report = { tick: st.tick, flew: true, note: `Dropped ${a.name} on ${provName(sim, d.target)}${lost ? `; ${lost} men were lost on the way in` : ''}.`, kills: 0, hits: 0, lost: risk.loss * 40 * WINGS.transport.vulnerability };
    }
    a.drop = null;
    if (!a.regiments.length) {
      notify(sim, a.nation, 'urgent', 'air', `${a.name} was destroyed on its way to ${provName(sim, d.target)}.`, { province: d.target });
      delete st.armies[a.id];
      moved = true;
      continue;
    }
    a.location = d.target;
    a.path = [];
    a.progress = 0;
    a.stationary = 0;
    a.dropped = st.tick;
    a.lastMove = undefined;
    st.nations[a.nation].stats.airborneDrops = (st.nations[a.nation].stats.airborneDrops ?? 0) + 1;
    moved = true;
    notify(
      sim,
      a.nation,
      'normal',
      'air',
      `${a.name} landed at ${provName(sim, d.target)}${lost ? `: ${lost} of ${before} men were lost on the way in (${risk.sky === 'theirs' ? 'enemy fighters' : risk.sky === 'contested' ? 'contested skies' : ''}${risk.aa > 0 ? `${risk.sky === 'theirs' || risk.sky === 'contested' ? ', ' : ''}anti-aircraft fire` : ''})` : ''}.`,
      { province: d.target },
    );
    const owner = st.provinces[d.target].controller;
    if (owner && atWar(sim, a.nation, owner)) notify(sim, owner, 'urgent', 'air', `Enemy airborne troops have landed at ${provName(sim, d.target)}!`, { province: d.target });
  }
  if (moved) touchArmies(sim);
  void UNITS;
}
