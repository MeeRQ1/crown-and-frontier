// Recruitment, army organisation, reinforcement, morale and attrition.
//
// Manpower accounting: recruiting moves 1000 men from the pool into training
// (counted as serving), reinforcement moves men from the pool into regiments,
// disbanding returns survivors to the pool (capped by the reserve), and
// casualties leave the system permanently (and reduce population).

import { C, UNITS } from './config';
import { poolCap, removePopulation } from './economy';
import { nationMods } from './modifiers';
import { armiesAt, armiesOf, atWar, bump, enemiesOf, isFriendly, notify, provName, type Sim } from './state';
import { supplyAt, supplyStatus } from './supply';
import type { Army, ArmyId, NationId, ProvinceId, Regiment, UnitType } from './types';

export function maxMorale(sim: Sim, nid: NationId): number {
  return C.army.baseMorale + nationMods(sim, nid).moraleMax;
}

/** Number of integrated (>= 50), controlled provinces with a resource. */
export function resourceCount(sim: Sim, nid: NationId, res: 'grain' | 'iron' | 'horses' | 'goods'): number {
  let c = 0;
  for (const pid of sim.world.provIds) {
    const p = sim.state.provinces[pid];
    if (p.owner === nid && p.controller === nid && p.integration >= 50 && sim.world.prov[pid].resource === res) c++;
  }
  return c;
}

export interface UnitCost {
  crowns: number;
  supplies: number;
  manpower: number;
  weeks: number;
  notes: string[];
}

export function unitCost(sim: Sim, nid: NationId, unit: UnitType): UnitCost {
  const m = nationMods(sim, nid);
  let mul = 1 + m.recruitCost;
  const notes: string[] = [];
  if (unit === 'foot') mul += m.footCost;
  if (unit === 'horse') {
    mul += m.horseCost;
    const h = Math.min(3, resourceCount(sim, nid, 'horses'));
    if (h) {
      mul -= 0.1 * h;
      notes.push(`Horse provinces −${h * 10}%`);
    }
  }
  if (unit === 'guns') {
    mul += m.gunsCost;
    const i = Math.min(3, resourceCount(sim, nid, 'iron'));
    if (i) {
      mul -= 0.1 * i;
      notes.push(`Iron provinces −${i * 10}%`);
    }
  }
  mul = Math.max(0.3, mul);
  const u = UNITS[unit];
  return { crowns: Math.round(u.cost * mul), supplies: u.supplies, manpower: C.regimentSize, weeks: u.weeks, notes };
}

function hostileArmyIn(sim: Sim, nid: NationId, pid: ProvinceId): boolean {
  return armiesAt(sim, pid).some((a) => atWar(sim, nid, a.nation));
}

export function recruitProblem(sim: Sim, nid: NationId, pid: ProvinceId, unit: UnitType): string | null {
  const n = sim.state.nations[nid];
  const p = sim.state.provinces[pid];
  if (!n?.alive) return 'Your realm has fallen.';
  if (!p) return 'Unknown province.';
  if (!UNITS[unit]) return 'Unknown unit type.';
  if (p.owner !== nid) return 'You can only raise troops in your own provinces.';
  if (p.controller !== nid) return 'The province is occupied by an enemy.';
  if (p.revoltUntil > sim.state.tick) return 'The province is in revolt.';
  if (p.integration < C.integration.recruitMin) return `Frontier province: integration ${Math.floor(p.integration)}/${C.integration.recruitMin} needed to raise troops.`;
  if (hostileArmyIn(sim, nid, pid)) return 'Enemy troops are in the province.';
  const cost = unitCost(sim, nid, unit);
  if (n.treasury < cost.crowns) return `Needs ${cost.crowns} crowns (treasury ${Math.floor(n.treasury)}).`;
  if (n.supplies < cost.supplies) return `Needs ${cost.supplies} supplies (stockpile ${Math.floor(n.supplies)}).`;
  if (n.manpower < cost.manpower) return `Needs ${cost.manpower.toLocaleString()} men in the manpower pool (pool ${Math.floor(n.manpower).toLocaleString()}).`;
  return null;
}

export function orderRecruit(sim: Sim, nid: NationId, pid: ProvinceId, unit: UnitType): void {
  const n = sim.state.nations[nid];
  const cost = unitCost(sim, nid, unit);
  n.treasury -= cost.crowns;
  n.supplies -= cost.supplies;
  n.manpower -= cost.manpower;
  sim.state.provinces[pid].recruits.push({ nation: nid, unit, weeksLeft: cost.weeks });
}

/** Cancels queued recruits in a province: manpower and supplies are returned, crowns are lost. */
export function cancelRecruits(sim: Sim, pid: ProvinceId, nid?: NationId): number {
  const p = sim.state.provinces[pid];
  let n = 0;
  p.recruits = p.recruits.filter((r) => {
    if (nid && r.nation !== nid) return true;
    const ns = sim.state.nations[r.nation];
    if (ns?.alive) {
      ns.manpower += C.regimentSize;
      ns.supplies += UNITS[r.unit].supplies;
    }
    n++;
    return false;
  });
  return n;
}

export function newRegiment(sim: Sim, type: UnitType, men: number = C.regimentSize): Regiment {
  sim.state.counters.regiment++;
  return { id: `r${sim.state.counters.regiment}`, type, men };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function createArmy(sim: Sim, nid: NationId, loc: ProvinceId, regiments: Regiment[], morale?: number): Army {
  const st = sim.state;
  st.counters.army++;
  const n = st.nations[nid];
  n.armyCounter++;
  const id = `a${st.counters.army}`;
  const a: Army = {
    id,
    nation: nid,
    name: `${ordinal(n.armyCounter)} Army`,
    location: loc,
    regiments,
    morale: morale ?? maxMorale(sim, nid),
    path: [],
    progress: 0,
    stationary: 0,
    retreating: false,
    battle: null,
    supply: 1,
    task: null,
  };
  st.armies[id] = a;
  return a;
}

export function removeArmy(sim: Sim, id: ArmyId): void {
  const a = sim.state.armies[id];
  if (!a) return;
  if (a.battle) {
    const b = sim.state.battles[a.battle];
    if (b) {
      b.attackers = b.attackers.filter((x) => x !== id);
      b.defenders = b.defenders.filter((x) => x !== id);
    }
  }
  delete sim.state.armies[id];
  for (const nid in sim.state.nations) delete sim.state.nations[nid].ai.objectives[id];
}

/** Weekly: advance training; finished regiments join an idle army in the province or form a new one. */
export function weeklyRecruitment(sim: Sim): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.recruits.length) continue;
    const done: typeof p.recruits = [];
    for (const r of p.recruits) {
      if (p.controller !== r.nation || p.owner !== r.nation) continue;
      r.weeksLeft--;
      if (r.weeksLeft <= 0) done.push(r);
    }
    if (p.controller !== p.owner || (p.owner && !p.recruits.every((r) => r.nation === p.owner))) {
      const lost = cancelRecruits(sim, pid);
      if (lost && p.owner) notify(sim, p.owner, 'normal', 'recruit', `${lost} regiment(s) in training at ${provName(sim, pid)} were dispersed by the occupation.`, { province: pid });
      continue;
    }
    if (!done.length) continue;
    p.recruits = p.recruits.filter((r) => !done.includes(r));
    for (const r of done) {
      const nid = r.nation;
      const mm = maxMorale(sim, nid);
      const reg = newRegiment(sim, r.unit);
      const host = armiesAt(sim, pid).find(
        (a) => a.nation === nid && !a.battle && !a.retreating && a.path.length === 0 && a.regiments.length < C.army.maxRegiments,
      );
      if (host) {
        const oldMen = host.regiments.reduce((s, x) => s + x.men, 0);
        host.morale = (host.morale * oldMen + mm * C.army.newRecruitMorale * reg.men) / (oldMen + reg.men);
        host.regiments.push(reg);
      } else {
        createArmy(sim, nid, pid, [reg], mm * C.army.newRecruitMorale);
      }
      notify(sim, nid, 'low', 'recruit', `A regiment of ${UNITS[r.unit].label} has finished training at ${provName(sim, pid)}.`, { province: pid });
    }
  }
}

// ───────────────────────────── Split / merge / disband ──────────────────────

export function splitProblem(sim: Sim, nid: NationId, id: ArmyId, counts: Partial<Record<UnitType, number>>): string | null {
  const a = sim.state.armies[id];
  if (!a || a.nation !== nid) return 'Not your army.';
  if (a.battle) return 'Cannot reorganise during a battle.';
  if (a.retreating) return 'Cannot reorganise while retreating.';
  let take = 0;
  for (const t of ['foot', 'horse', 'guns'] as UnitType[]) {
    const c = counts[t] ?? 0;
    if (c < 0 || !Number.isInteger(c)) return 'Invalid regiment count.';
    const have = a.regiments.filter((r) => r.type === t).length;
    if (c > have) return `Only ${have} ${UNITS[t].label} regiment(s) in this army.`;
    take += c;
  }
  if (take === 0) return 'Choose at least one regiment to detach.';
  if (take >= a.regiments.length) return 'At least one regiment must remain in the original army.';
  return null;
}

export function doSplit(sim: Sim, id: ArmyId, counts: Partial<Record<UnitType, number>>): Army {
  const a = sim.state.armies[id];
  const moved: Regiment[] = [];
  for (const t of ['foot', 'horse', 'guns'] as UnitType[]) {
    let c = counts[t] ?? 0;
    // detach the strongest regiments of the requested type
    const pool = a.regiments.filter((r) => r.type === t).sort((x, y) => y.men - x.men || (x.id < y.id ? -1 : 1));
    for (const r of pool) {
      if (c <= 0) break;
      moved.push(r);
      c--;
    }
  }
  a.regiments = a.regiments.filter((r) => !moved.includes(r));
  const b = createArmy(sim, a.nation, a.location, moved, a.morale);
  b.stationary = a.stationary;
  b.supply = a.supply;
  return b;
}

export function mergeProblem(sim: Sim, nid: NationId, ids: ArmyId[]): string | null {
  if (ids.length < 2) return 'Select at least two armies.';
  const armies = ids.map((i) => sim.state.armies[i]);
  if (armies.some((a) => !a || a.nation !== nid)) return 'Not your army.';
  const loc = armies[0].location;
  if (armies.some((a) => a.location !== loc)) return 'Armies must be in the same province to merge.';
  if (armies.some((a) => a.battle)) return 'Cannot merge during a battle.';
  if (armies.some((a) => a.retreating)) return 'Cannot merge while retreating.';
  const total = armies.reduce((s, a) => s + a.regiments.length, 0);
  if (total > C.army.maxRegiments) return `An army can hold at most ${C.army.maxRegiments} regiments.`;
  return null;
}

export function doMerge(sim: Sim, ids: ArmyId[]): Army {
  const [first, ...rest] = ids.map((i) => sim.state.armies[i]);
  let men = first.regiments.reduce((s, r) => s + r.men, 0);
  let moraleSum = first.morale * men;
  for (const a of rest) {
    const m = a.regiments.reduce((s, r) => s + r.men, 0);
    moraleSum += a.morale * m;
    men += m;
    first.regiments.push(...a.regiments);
    first.stationary = Math.min(first.stationary, a.stationary);
    a.regiments = [];
    removeArmy(sim, a.id);
  }
  first.morale = men > 0 ? moraleSum / men : first.morale;
  first.path = [];
  first.progress = 0;
  return first;
}

export function disbandProblem(sim: Sim, nid: NationId, id: ArmyId): string | null {
  const a = sim.state.armies[id];
  if (!a || a.nation !== nid) return 'Not your army.';
  if (a.battle) return 'Cannot disband during a battle.';
  return null;
}

export function doDisband(sim: Sim, id: ArmyId): number {
  const a = sim.state.armies[id];
  const n = sim.state.nations[a.nation];
  const men = a.regiments.reduce((s, r) => s + r.men, 0);
  a.regiments = [];
  removeArmy(sim, id);
  const room = Math.max(0, poolCap(sim, n.id) - n.manpower);
  const back = Math.min(room, men * C.army.disbandReturn);
  n.manpower += back;
  return back;
}

// ───────────────────────────── Strength estimates ───────────────────────────

export function regimentPower(type: UnitType, men: number): number {
  return (men / C.regimentSize) * UNITS[type].attack;
}

/** Rough military strength used by AI and diplomacy (not by combat). */
export function armyStrength(sim: Sim, a: Army): number {
  let s = 0;
  for (const r of a.regiments) s += regimentPower(r.type, r.men);
  const mm = maxMorale(sim, a.nation);
  return s * (0.5 + 0.5 * Math.min(1, a.morale / mm));
}

export function nationStrength(sim: Sim, nid: NationId): number {
  let s = 0;
  for (const a of armiesOf(sim, nid)) s += armyStrength(sim, a);
  return s;
}

/** Potential strength including the manpower pool (for war planning). */
export function nationPotential(sim: Sim, nid: NationId): number {
  const n = sim.state.nations[nid];
  return nationStrength(sim, nid) + Math.min(n.manpower / C.regimentSize, Math.max(0, n.treasury) / 20) * 0.8;
}

// ───────────────────────────── Weekly upkeep of armies ──────────────────────

/** Weekly after control changes: supply level, attrition, morale recovery, reinforcement. */
export function weeklyArmyCare(sim: Sim): void {
  const st = sim.state;
  const ids = Object.keys(st.armies).sort();
  for (const id of ids) {
    const a = st.armies[id];
    if (!a) continue;
    const info = supplyAt(sim, a.nation, a.location, 0, false);
    a.supply = info.level;
    const n = st.nations[a.nation];
    const mods = nationMods(sim, a.nation);
    const mm = maxMorale(sim, a.nation);
    // idle metric: during wars, field armies (2+ regiments) standing still on friendly ground for 8+ weeks
    if (enemiesOf(sim, a.nation).length && a.regiments.length >= 2) {
      n.stats.armyWeeks++;
      if (a.path.length === 0 && !a.battle && a.stationary >= 8 && isFriendly(sim, a.nation, st.provinces[a.location].controller)) n.stats.idleArmyWeeks++;
    }
    if (a.battle) continue;
    const status = supplyStatus(info.level);
    if (status === 'unsupplied') {
      const rate = C.supply.attrition * Math.max(0.1, 1 + mods.attrition);
      let lost = 0;
      for (const r of a.regiments) {
        const l = Math.round(r.men * rate);
        r.men -= l;
        lost += l;
      }
      a.regiments = a.regiments.filter((r) => {
        if (r.men < C.army.minRegimentMen) {
          lost += r.men;
          return false;
        }
        return true;
      });
      n.stats.menLost += lost;
      removePopulation(sim, a.nation, lost);
      a.morale = Math.max(0, a.morale - 0.1);
      if (a.regiments.length === 0) {
        notify(sim, a.nation, 'urgent', 'attrition', `${a.name} has wasted away from attrition in ${provName(sim, a.location)}.`, { province: a.location });
        removeArmy(sim, id);
        bump(sim);
        continue;
      }
    } else if (!a.retreating) {
      const friendlyGround = isFriendly(sim, a.nation, st.provinces[a.location].controller);
      let rate = friendlyGround ? C.army.moraleRecovery : C.army.moraleRecoveryHostile;
      if (status === 'strained') rate *= 0.5;
      rate *= Math.max(0, 1 + mods.moraleRecovery);
      a.morale = Math.min(mm, a.morale + rate);
      if (status === 'supplied' && friendlyGround) reinforce(sim, a);
    }
    if (a.morale > mm) a.morale = mm;
  }
}

function reinforce(sim: Sim, a: Army): void {
  const n = sim.state.nations[a.nation];
  if (n.manpower <= 0) return;
  const mods = nationMods(sim, a.nation);
  const per = C.regimentSize * C.army.reinforceRate * Math.max(0.1, 1 + mods.reinforce);
  let want = 0;
  for (const r of a.regiments) want += Math.min(per, C.regimentSize - r.men);
  if (want <= 0) return;
  const scale = Math.min(1, n.manpower / want);
  let used = 0;
  for (const r of a.regiments) {
    const add = Math.floor(Math.min(per, C.regimentSize - r.men) * scale);
    r.men += add;
    used += add;
  }
  n.manpower -= used;
}
