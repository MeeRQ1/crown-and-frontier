// Battles.
//
// Trigger: after movement, any province holding non-retreating armies of two
// hostile nations starts (or reinforces) a battle. The defending side is the
// side friendly to the province's controller; otherwise the army that has
// stood there longest (then lowest id). Each other army joins the side it is
// friendly with, provided it is hostile to the opposing lead; third parties wait.
//
// One round per week:
//   engaged = up to `frontage` foot/horse regiments (strongest first) plus up to
//             frontage/2 guns (guns fire at 50% if fewer front regiments than guns)
//   fire    = sum(men/1000 * unit attack * type mods * supply mul) * flank * morale mul
//             horse gets the terrain cavalry modifier; >=20% horse on open ground: +15% flank
//             morale mul = 0.6 + 0.4 * morale ratio
//   casualties inflicted = fire * 55 * roll(0.85..1.15), attacker's fire reduced by
//             defence = terrain + fort (0.15/level, if the defenders hold it) +
//             entrenchment (0.1 after 2 weeks, 0.2 after 4) + tech + river
//             (0.2 when every attacker crossed a river border to open the battle),
//             capped at 0.7
//   morale loss = 0.15 + (casualties/men) * 8 * enemy shock (horse 1.6, guns 1.2, foot 1.0)
// End: a side breaks at 25% morale or 10% of its starting men; if both break the
// side with the lower morale ratio loses (attacker on ties); after 8 rounds the
// attacker withdraws. Winner horse pursue (10% of their men, max 15% of loser).
// Losers retreat to an adjacent enterable province without enemies (friendly
// ground and short supply lines preferred); with no legal retreat they surrender.

import { C, TERRAIN, UNITS } from './config';
import { removePopulation, reserveCap } from './economy';
import { maxMorale, removeArmy } from './military';
import { nationMods } from './modifiers';
import { canEnter, isRiver } from './movement';
import { range } from './rng';
import { atWar, bump, isFriendly, nationName, notify, provName, type Sim } from './state';
import { supplyCombatMul, supplyDistances, supplyStatus } from './supply';
import type { Army, Battle, BattleReport, NationId, ProvinceId, UnitType } from './types';

// ───────────────────────────── Snapshots (shared by live and forecast) ──────

interface RegSnap {
  type: UnitType;
  men: number;
  key: string;
}
interface ArmySnap {
  id: string;
  nation: NationId;
  morale: number;
  maxMorale: number;
  supply: number;
  stationary: number;
  regs: RegSnap[];
}
export interface SideSnap {
  armies: ArmySnap[];
}

export function snapArmy(sim: Sim, a: Army): ArmySnap {
  return {
    id: a.id,
    nation: a.nation,
    morale: a.morale,
    maxMorale: maxMorale(sim, a.nation),
    supply: a.supply,
    stationary: a.stationary,
    regs: a.regiments.map((r) => ({ type: r.type, men: r.men, key: r.id })),
  };
}

function sideMen(s: SideSnap): number {
  let m = 0;
  for (const a of s.armies) for (const r of a.regs) m += r.men;
  return m;
}

function moraleRatio(s: SideSnap): number {
  let num = 0;
  let den = 0;
  for (const a of s.armies) {
    let m = 0;
    for (const r of a.regs) m += r.men;
    num += a.morale * m;
    den += a.maxMorale * m;
  }
  return den > 0 ? num / den : 0;
}

interface Engaged {
  army: ArmySnap;
  reg: RegSnap;
  weight: number;
  fire: number;
}

interface SideCalc {
  engaged: Engaged[];
  fire: number;
  shock: number;
  horseShare: number;
  reserveRegs: number;
  notes: string[];
}

function sideCalc(sim: Sim, pid: ProvinceId, s: SideSnap): SideCalc {
  const terr = TERRAIN[sim.world.prov[pid].terrain];
  const front: Array<{ army: ArmySnap; reg: RegSnap }> = [];
  const guns: Array<{ army: ArmySnap; reg: RegSnap }> = [];
  for (const a of s.armies) {
    for (const r of a.regs) {
      if (r.men <= 0) continue;
      (r.type === 'guns' ? guns : front).push({ army: a, reg: r });
    }
  }
  const order = (x: { reg: RegSnap }, y: { reg: RegSnap }) => y.reg.men - x.reg.men || (x.reg.key < y.reg.key ? -1 : 1);
  front.sort(order);
  guns.sort(order);
  const f = front.slice(0, terr.frontage);
  const g = guns.slice(0, Math.ceil(terr.frontage / 2));
  const reserveRegs = front.length - f.length + (guns.length - g.length);
  const screened = f.length >= g.length * C.combat.gunsScreen;
  const notes: string[] = [];
  const engaged: Engaged[] = [];
  let horseMen = 0;
  let totalMen = 0;
  let shockNum = 0;
  let fire = 0;
  for (const e of [...f, ...g]) {
    const m = nationMods(sim, e.army.nation);
    const u = UNITS[e.reg.type];
    let v = (e.reg.men / C.regimentSize) * u.attack * (1 + m.attack) * supplyCombatMul(e.army.supply);
    if (e.reg.type === 'foot') v *= 1 + m.footAttack;
    if (e.reg.type === 'horse') v *= (1 + m.horseAttack) * (1 + terr.cav);
    if (e.reg.type === 'guns') v *= (1 + m.gunsAttack) * (screened ? 1 : C.combat.unscreenedGuns);
    v = Math.max(0, v);
    engaged.push({ army: e.army, reg: e.reg, weight: e.reg.men * (e.reg.type === 'guns' ? 0.5 : 1), fire: v });
    fire += v;
    shockNum += v * u.morale;
    totalMen += e.reg.men;
    if (e.reg.type === 'horse') horseMen += e.reg.men;
  }
  const horseShare = totalMen > 0 ? horseMen / totalMen : 0;
  if (horseShare >= C.combat.flankHorseShare && terr.cav > 0) {
    fire *= 1 + C.combat.flankBonus;
    notes.push(`Horse flanking on open ground +${Math.round(C.combat.flankBonus * 100)}%`);
  }
  if (!screened && g.length) notes.push('Guns without an infantry screen fire at half effect');
  if (terr.cav < 0 && horseMen > 0) notes.push(`Horse hampered by ${terr.label.toLowerCase()} ${Math.round(terr.cav * 100)}%`);
  if (terr.cav > 0 && horseMen > 0) notes.push(`Horse favoured by ${terr.label.toLowerCase()} +${Math.round(terr.cav * 100)}%`);
  if (reserveRegs > 0) notes.push(`Frontage ${terr.frontage}: ${reserveRegs} regiment(s) held in reserve`);
  const supplyWorst = Math.min(...s.armies.map((a) => a.supply));
  if (s.armies.length && supplyStatus(supplyWorst) !== 'supplied') notes.push(`${supplyStatus(supplyWorst) === 'strained' ? 'Strained' : 'Unsupplied'} troops ${supplyStatus(supplyWorst) === 'strained' ? '−10%' : '−25%'}`);
  const mr = moraleRatio(s);
  fire *= 0.6 + 0.4 * Math.min(1, mr);
  return { engaged, fire, shock: fire > 0 ? shockNum / Math.max(1e-9, engaged.reduce((q, e) => q + e.fire, 0)) : 1, horseShare, reserveRegs, notes };
}

export function entrenchBonus(sim: Sim, nid: NationId, stationary: number): number {
  const [w1, w2] = C.army.entrenchWeeks;
  const [b1, b2] = C.army.entrenchBonus;
  const base = stationary >= w2 ? b2 : stationary >= w1 ? b1 : 0;
  return base * Math.max(0, 1 + nationMods(sim, nid).entrench);
}

export function defenceBonus(sim: Sim, pid: ProvinceId, def: SideSnap, river = false): { value: number; notes: string[] } {
  const terr = TERRAIN[sim.world.prov[pid].terrain];
  const p = sim.state.provinces[pid];
  const notes: string[] = [];
  let v = terr.defense;
  if (terr.defense > 0) notes.push(`${terr.label}: defender +${Math.round(terr.defense * 100)}%`);
  if (river) {
    v += C.combat.riverBonus;
    notes.push(`Attack across a river: defender +${Math.round(C.combat.riverBonus * 100)}%`);
  }
  const lead = def.armies[0]?.nation;
  if (lead && p.fort > 0 && isFriendly(sim, lead, p.controller)) {
    v += C.combat.fortBonus * p.fort;
    notes.push(`Fort level ${p.fort}: defender +${Math.round(C.combat.fortBonus * p.fort * 100)}%`);
  }
  let men = 0;
  let ent = 0;
  let tech = 0;
  for (const a of def.armies) {
    let m = 0;
    for (const r of a.regs) m += r.men;
    men += m;
    ent += entrenchBonus(sim, a.nation, a.stationary) * m;
    tech += nationMods(sim, a.nation).defense * m;
  }
  if (men > 0) {
    ent /= men;
    tech /= men;
  }
  if (ent > 0) notes.push(`Entrenched: defender +${Math.round(ent * 100)}%`);
  if (tech > 0) notes.push(`Defensive doctrine +${Math.round(tech * 100)}%`);
  v += ent + tech;
  return { value: Math.min(C.combat.maxDefense, v), notes };
}

export interface RoundResult {
  attCas: number;
  defCas: number;
  attMoraleDmg: number;
  defMoraleDmg: number;
  factors: string[];
  lossesByArmy: Record<string, number>;
}

/** Resolves one round on the snapshots in place. */
export function resolveRound(sim: Sim, pid: ProvinceId, att: SideSnap, def: SideSnap, rollA: number, rollD: number, river = false): RoundResult {
  const A = sideCalc(sim, pid, att);
  const D = sideCalc(sim, pid, def);
  const dfb = defenceBonus(sim, pid, def, river);
  const defCas = A.fire * C.combat.casualtyPerFire * rollA * (1 - dfb.value);
  const attCas = D.fire * C.combat.casualtyPerFire * rollD;
  const attMen = sideMen(att);
  const defMen = sideMen(def);
  const attMoraleDmg = C.combat.moraleBase + (attMen > 0 ? attCas / attMen : 1) * C.combat.moraleFromLosses * D.shock;
  const defMoraleDmg = C.combat.moraleBase + (defMen > 0 ? defCas / defMen : 1) * C.combat.moraleFromLosses * A.shock;
  const lossesByArmy: Record<string, number> = {};
  const apply = (calc: SideCalc, cas: number) => {
    const wsum = calc.engaged.reduce((s, e) => s + e.weight, 0);
    if (wsum <= 0) return 0;
    let total = 0;
    for (const e of calc.engaged) {
      const l = Math.min(e.reg.men, Math.round((cas * e.weight) / wsum));
      e.reg.men -= l;
      total += l;
      lossesByArmy[e.army.id] = (lossesByArmy[e.army.id] ?? 0) + l;
    }
    return total;
  };
  let realAtt = apply(A, attCas);
  let realDef = apply(D, defCas);
  for (const a of att.armies) a.morale = Math.max(0, a.morale - attMoraleDmg);
  for (const a of def.armies) a.morale = Math.max(0, a.morale - defMoraleDmg);
  // dissolve shattered regiments: their remaining men count as losses
  const dissolve = (side: SideSnap): number => {
    let extra = 0;
    for (const a of side.armies) {
      a.regs = a.regs.filter((r) => {
        if (r.men < C.army.minRegimentMen) {
          lossesByArmy[a.id] = (lossesByArmy[a.id] ?? 0) + r.men;
          extra += r.men;
          r.men = 0;
          return false;
        }
        return true;
      });
    }
    side.armies = side.armies.filter((a) => a.regs.length > 0);
    return extra;
  };
  realAtt += dissolve(att);
  realDef += dissolve(def);
  const factors = [...dfb.notes, ...A.notes.map((n) => `Attacker: ${n}`), ...D.notes.map((n) => `Defender: ${n}`)];
  return { attCas: realAtt, defCas: realDef, attMoraleDmg, defMoraleDmg, factors, lossesByArmy };
}

export type Outcome = 'attacker' | 'defender' | null;

export function checkEnd(att: SideSnap, def: SideSnap, attStart: number, defStart: number, round: number): Outcome {
  const am = sideMen(att);
  const dm = sideMen(def);
  const ar = moraleRatio(att);
  const dr = moraleRatio(def);
  const attBroken = att.armies.length === 0 || ar <= C.combat.breakAt || am <= attStart * 0.1;
  const defBroken = def.armies.length === 0 || dr <= C.combat.breakAt || dm <= defStart * 0.1;
  if (attBroken && defBroken) return dr > ar ? 'defender' : dr < ar ? 'attacker' : 'defender';
  if (attBroken) return 'defender';
  if (defBroken) return 'attacker';
  if (round >= C.combat.maxRounds) return 'defender';
  return null;
}

// ───────────────────────────── Forecast (no gameplay RNG) ───────────────────

export interface Forecast {
  verdict: 'Likely victory' | 'Uncertain' | 'Likely defeat';
  attLoss: number;
  defLoss: number;
  rounds: number;
  attMen: number;
  defMen: number;
  factors: string[];
  outcomes: Outcome[];
}

function cloneSide(s: SideSnap): SideSnap {
  return { armies: s.armies.map((a) => ({ ...a, regs: a.regs.map((r) => ({ ...r })) })) };
}

export function simulateSnap(sim: Sim, pid: ProvinceId, att: SideSnap, def: SideSnap, rollA: number, rollD: number, river = false) {
  const a = cloneSide(att);
  const d = cloneSide(def);
  const as = sideMen(a);
  const ds = sideMen(d);
  let out: Outcome = null;
  let round = 0;
  let factors: string[] = [];
  let attLoss = 0;
  let defLoss = 0;
  while (!out && round < C.combat.maxRounds + 1) {
    round++;
    const r = resolveRound(sim, pid, a, d, rollA, rollD, river);
    if (round === 1) factors = r.factors;
    attLoss += r.attCas;
    defLoss += r.defCas;
    out = checkEnd(a, d, as, ds, round);
  }
  return { outcome: out ?? 'defender', rounds: round, attLoss, defLoss, factors };
}

/**
 * Battle forecast from the attacker's perspective with bounded rolls.
 * `from`: the province the attackers step out of (defaults to each attacker's
 * location); a river border there gives the defender the river bonus.
 */
export function forecastBattle(sim: Sim, pid: ProvinceId, attackers: Army[], defenders: Army[], from?: ProvinceId): Forecast {
  const att: SideSnap = { armies: attackers.map((x) => snapArmy(sim, x)) };
  const def: SideSnap = { armies: defenders.map((x) => snapArmy(sim, x)) };
  // an attacker arriving has not dug in
  for (const a of att.armies) a.stationary = 0;
  const river = attackers.length > 0 && attackers.every((a) => isRiver(sim, from ?? a.location, pid));
  const lo = simulateSnap(sim, pid, att, def, C.combat.rollMin, C.combat.rollMax, river);
  const mid = simulateSnap(sim, pid, att, def, 1, 1, river);
  const hi = simulateSnap(sim, pid, att, def, C.combat.rollMax, C.combat.rollMin, river);
  const outcomes = [lo.outcome, mid.outcome, hi.outcome];
  const wins = outcomes.filter((o) => o === 'attacker').length;
  return {
    verdict: wins === 3 ? 'Likely victory' : wins === 0 ? 'Likely defeat' : 'Uncertain',
    attLoss: Math.round(mid.attLoss),
    defLoss: Math.round(mid.defLoss),
    rounds: mid.rounds,
    attMen: sideMen(att),
    defMen: sideMen(def),
    factors: mid.factors,
    outcomes,
  };
}

// ───────────────────────────── Live battles ─────────────────────────────────

function battleArmies(sim: Sim, b: Battle, side: 'att' | 'def'): Army[] {
  const ids = side === 'att' ? b.attackers : b.defenders;
  return ids.map((i) => sim.state.armies[i]).filter((a): a is Army => !!a);
}

function leadNation(sim: Sim, ids: string[]): NationId | null {
  for (const i of ids) {
    const a = sim.state.armies[i];
    if (a) return a.nation;
  }
  return null;
}

/** Finds hostile contacts and creates or reinforces battles (province id order). */
export function detectBattles(sim: Sim): void {
  const st = sim.state;
  const byProv = new Map<ProvinceId, Army[]>();
  for (const id of Object.keys(st.armies).sort()) {
    const a = st.armies[id];
    if (a.retreating) continue;
    let arr = byProv.get(a.location);
    if (!arr) byProv.set(a.location, (arr = []));
    arr.push(a);
  }
  for (const pid of [...byProv.keys()].sort()) {
    const here = byProv.get(pid)!;
    const existing = Object.values(st.battles).find((b) => b.province === pid);
    if (existing) {
      const attLead = leadNation(sim, existing.attackers);
      const defLead = leadNation(sim, existing.defenders);
      for (const a of here) {
        if (a.battle) continue;
        if (attLead && defLead && isFriendly(sim, a.nation, defLead) && atWar(sim, a.nation, attLead)) join(existing, a, 'def');
        else if (attLead && defLead && isFriendly(sim, a.nation, attLead) && atWar(sim, a.nation, defLead)) join(existing, a, 'att');
      }
      continue;
    }
    // any hostile pair?
    let hostile = false;
    for (let i = 0; i < here.length && !hostile; i++)
      for (let j = i + 1; j < here.length; j++)
        if (atWar(sim, here[i].nation, here[j].nation)) {
          hostile = true;
          break;
        }
    if (!hostile) continue;
    const ctrl = st.provinces[pid].controller;
    let anchor = here.find((a) => ctrl && isFriendly(sim, a.nation, ctrl) && here.some((o) => atWar(sim, a.nation, o.nation)));
    if (!anchor) {
      anchor = [...here]
        .filter((a) => here.some((o) => atWar(sim, a.nation, o.nation)))
        .sort((x, y) => y.stationary - x.stationary || (x.id < y.id ? -1 : 1))[0];
    }
    const foe = here.find((a) => atWar(sim, a.nation, anchor!.nation))!;
    st.counters.battle++;
    const b: Battle = {
      id: `b${st.counters.battle}`,
      province: pid,
      startTick: st.tick,
      attackers: [],
      defenders: [],
      attackerNations: [],
      defenderNations: [],
      rounds: [],
      attStartMen: 0,
      defStartMen: 0,
      attLosses: 0,
      defLosses: 0,
      factors: [],
    };
    st.battles[b.id] = b;
    for (const a of here) {
      if (isFriendly(sim, a.nation, anchor.nation) && atWar(sim, a.nation, foe.nation)) join(b, a, 'def');
      else if (isFriendly(sim, a.nation, foe.nation) && atWar(sim, a.nation, anchor.nation)) join(b, a, 'att');
    }
    // attackers who all stepped across a river this week fight at a disadvantage
    const crossed = (id: string) => {
      const lm = st.armies[id].lastMove;
      return !!lm && lm.tick === st.tick && isRiver(sim, lm.from, pid);
    };
    if (b.attackers.length && b.attackers.every(crossed)) b.river = true;
    const atk = sim.world.nationDefs[foe.nation]?.short;
    const dfn = sim.world.nationDefs[anchor.nation]?.short;
    for (const n of new Set([...b.attackerNations, ...b.defenderNations])) {
      notify(sim, n, 'normal', 'battle', `Battle of ${provName(sim, pid)}: ${atk} attacks ${dfn}.`, { province: pid });
    }
  }
}

function join(b: Battle, a: Army, side: 'att' | 'def'): void {
  const men = a.regiments.reduce((s, r) => s + r.men, 0);
  a.battle = b.id;
  if (side === 'att') {
    b.attackers.push(a.id);
    if (!b.attackerNations.includes(a.nation)) b.attackerNations.push(a.nation);
    b.attStartMen += men;
  } else {
    b.defenders.push(a.id);
    if (!b.defenderNations.includes(a.nation)) b.defenderNations.push(a.nation);
    b.defStartMen += men;
  }
}

/**
 * Removes armies that no longer belong in a battle (destroyed, moved by a peace
 * settlement, or no longer hostile to the other side). A battle whose sides are
 * no longer at war dissolves without a result.
 */
export function pruneBattles(sim: Sim): void {
  const st = sim.state;
  for (const id of Object.keys(st.battles).sort()) {
    const b = st.battles[id];
    const valid = (aid: string) => {
      const a = st.armies[aid];
      return !!a && a.location === b.province && a.battle === b.id && !a.retreating;
    };
    b.attackers = b.attackers.filter(valid);
    b.defenders = b.defenders.filter(valid);
    const hostile = (x: string, others: string[]) => others.some((o) => atWar(sim, st.armies[x].nation, st.armies[o].nation));
    const att = b.attackers.filter((x) => hostile(x, b.defenders));
    const def = b.defenders.filter((x) => hostile(x, b.attackers));
    for (const x of [...b.attackers, ...b.defenders]) if (!att.includes(x) && !def.includes(x)) st.armies[x].battle = null;
    b.attackers = att;
    b.defenders = def;
    if (!att.length || !def.length) {
      for (const x of [...att, ...def]) st.armies[x].battle = null;
      delete st.battles[id];
    }
  }
  for (const aid in st.armies) {
    const a = st.armies[aid];
    if (a.battle && !st.battles[a.battle]) a.battle = null;
  }
}

/** Weekly: one round for every battle, in battle id order. */
export function weeklyCombat(sim: Sim): void {
  const st = sim.state;
  pruneBattles(sim);
  const ids = Object.keys(st.battles).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  for (const id of ids) {
    const b = st.battles[id];
    if (!b) continue;
    const attArmies = battleArmies(sim, b, 'att');
    const defArmies = battleArmies(sim, b, 'def');
    if (!attArmies.length || !defArmies.length) {
      endBattle(sim, b, attArmies.length ? 'attacker' : 'defender');
      continue;
    }
    const att: SideSnap = { armies: attArmies.map((a) => snapArmy(sim, a)) };
    const def: SideSnap = { armies: defArmies.map((a) => snapArmy(sim, a)) };
    for (const a of att.armies) a.stationary = 0; // attackers never count as entrenched
    const rollA = range(st.rng, C.combat.rollMin, C.combat.rollMax);
    const rollD = range(st.rng, C.combat.rollMin, C.combat.rollMax);
    const r = resolveRound(sim, b.province, att, def, rollA, rollD, !!b.river);
    if (b.rounds.length === 0) b.factors = r.factors;
    // write back to armies
    for (const snap of [...att.armies, ...def.armies]) writeBack(sim, snap);
    for (const a of [...attArmies, ...defArmies]) {
      if (!att.armies.find((s) => s.id === a.id) && !def.armies.find((s) => s.id === a.id)) {
        // destroyed in this round
        writeBack(sim, { ...snapArmy(sim, a), regs: [] });
      }
    }
    b.attLosses += r.attCas;
    b.defLosses += r.defCas;
    for (const aid in r.lossesByArmy) {
      const arm = attArmies.find((x) => x.id === aid) ?? defArmies.find((x) => x.id === aid);
      if (!arm) continue;
      const l = r.lossesByArmy[aid];
      const n = st.nations[arm.nation];
      n.stats.menLost += l;
      removePopulation(sim, arm.nation, l);
      const rc = Math.max(5000, reserveCap(sim, arm.nation));
      n.warExhaustion = Math.min(100, n.warExhaustion + (l / rc) * C.war.exhaustionPerLossShare * Math.max(0.1, 1 + nationMods(sim, arm.nation).warExhaustion));
    }
    b.rounds.push({
      round: b.rounds.length + 1,
      attLoss: r.attCas,
      defLoss: r.defCas,
      attMorale: moraleRatio(att),
      defMorale: moraleRatio(def),
    });
    const out = checkEnd(att, def, b.attStartMen, b.defStartMen, b.rounds.length);
    if (out) endBattle(sim, b, out);
  }
}

function writeBack(sim: Sim, snap: ArmySnap): void {
  const a = sim.state.armies[snap.id];
  if (!a) return;
  a.morale = snap.morale;
  const alive = new Map(snap.regs.map((r) => [r.key, r.men]));
  a.regiments = a.regiments.filter((r) => alive.has(r.id)).map((r) => ({ ...r, men: alive.get(r.id)! }));
  if (a.regiments.length === 0) {
    removeArmy(sim, a.id);
    bump(sim);
  }
}

export function retreatTarget(sim: Sim, a: Army, from: ProvinceId): ProvinceId | null {
  const dist = supplyDistances(sim, a.nation);
  let best: ProvinceId | null = null;
  let bestScore = -Infinity;
  for (const nb of [...sim.world.prov[from].neighbors].sort()) {
    if (!canEnter(sim, a.nation, nb)) continue;
    let enemy = false;
    for (const id in sim.state.armies) {
      const o = sim.state.armies[id];
      if (o.location === nb && !o.retreating && atWar(sim, a.nation, o.nation)) {
        enemy = true;
        break;
      }
    }
    if (enemy) continue;
    const p = sim.state.provinces[nb];
    let score = 0;
    if (isFriendly(sim, a.nation, p.controller)) score += 100;
    if (p.owner === a.nation) score += 20;
    const d = dist[nb];
    score -= (Number.isFinite(d) ? d : 20) * 10;
    if (score > bestScore) {
      bestScore = score;
      best = nb;
    }
  }
  return best;
}

function endBattle(sim: Sim, b: Battle, winner: 'attacker' | 'defender'): void {
  const st = sim.state;
  const winIds = winner === 'attacker' ? b.attackers : b.defenders;
  const loseIds = winner === 'attacker' ? b.defenders : b.attackers;
  const winArmies = winIds.map((i) => st.armies[i]).filter((a): a is Army => !!a);
  const loseArmies = loseIds.map((i) => st.armies[i]).filter((a): a is Army => !!a);
  const terr = TERRAIN[sim.world.prov[b.province].terrain];

  // pursuit by the winners' horse
  let horseMen = 0;
  for (const a of winArmies) for (const r of a.regiments) if (r.type === 'horse') horseMen += r.men;
  let loserMen = 0;
  for (const a of loseArmies) for (const r of a.regiments) loserMen += r.men;
  let pursuit = Math.min(loserMen * C.combat.pursuitCap, horseMen * C.combat.pursuit * Math.max(0, 1 + terr.cav));
  pursuit = Math.round(pursuit);
  if (pursuit > 0 && loserMen > 0) {
    for (const a of loseArmies) {
      let lost = 0;
      for (const r of a.regiments) {
        const l = Math.round((pursuit * r.men) / loserMen);
        const take = Math.min(r.men, l);
        r.men -= take;
        lost += take;
      }
      a.regiments = a.regiments.filter((r) => {
        if (r.men < C.army.minRegimentMen) {
          lost += r.men;
          return false;
        }
        return true;
      });
      st.nations[a.nation].stats.menLost += lost;
      removePopulation(sim, a.nation, lost);
      if (winner === 'attacker') b.defLosses += lost;
      else b.attLosses += lost;
    }
  }

  const winLoss = winner === 'attacker' ? b.attLosses : b.defLosses;
  const loseLoss = winner === 'attacker' ? b.defLosses : b.attLosses;
  const winNations = winner === 'attacker' ? b.attackerNations : b.defenderNations;
  const loseNations = winner === 'attacker' ? b.defenderNations : b.attackerNations;

  for (const n of winNations) {
    st.nations[n].stats.battlesWon++;
    st.nations[n].stats.enemyKilled += Math.round(loseLoss / Math.max(1, winNations.length));
  }
  for (const n of loseNations) {
    st.nations[n].stats.battlesLost++;
    st.nations[n].stats.enemyKilled += Math.round(winLoss / Math.max(1, loseNations.length));
  }

  // war score for every war that pits the two sides against each other
  const delta = Math.max(1, Math.min(10, 2 + (loseLoss - winLoss) / 1000));
  for (const wid of Object.keys(st.wars).sort()) {
    const w = st.wars[wid];
    const winnerAtt = winNations.some((n) => w.attackers.includes(n)) && loseNations.some((n) => w.defenders.includes(n));
    const winnerDef = winNations.some((n) => w.defenders.includes(n)) && loseNations.some((n) => w.attackers.includes(n));
    if (winnerAtt) w.battleScore = Math.min(C.war.battleScoreCap, w.battleScore + delta);
    else if (winnerDef) w.battleScore = Math.max(-C.war.battleScoreCap, w.battleScore - delta);
  }

  for (const a of winArmies) a.battle = null;
  const surrendered: string[] = [];
  for (const a of loseArmies) {
    a.battle = null;
    if (a.regiments.length === 0) {
      removeArmy(sim, a.id);
      continue;
    }
    const to = retreatTarget(sim, a, b.province);
    if (!to) {
      let men = 0;
      for (const r of a.regiments) men += r.men;
      st.nations[a.nation].stats.menLost += men;
      removePopulation(sim, a.nation, men);
      if (winner === 'attacker') b.defLosses += men;
      else b.attLosses += men;
      surrendered.push(`${a.name} (${nationName(sim, a.nation)})`);
      notify(sim, a.nation, 'urgent', 'surrender', `${a.name} was surrounded at ${provName(sim, b.province)} with no line of retreat and surrendered.`, { province: b.province });
      removeArmy(sim, a.id);
      continue;
    }
    a.path = [to];
    a.progress = 0;
    a.retreating = true;
    a.stationary = 0;
  }
  bump(sim);

  const outcome =
    `${winner === 'attacker' ? 'Attackers' : 'Defenders'} (${winNations.map((n) => nationName(sim, n)).join(', ')}) won after ${b.rounds.length} round(s).` +
    (surrendered.length ? ` Surrendered: ${surrendered.join(', ')}.` : '');
  const report: BattleReport = {
    id: b.id,
    tick: st.tick,
    province: b.province,
    attackerNations: b.attackerNations,
    defenderNations: b.defenderNations,
    attStartMen: b.attStartMen,
    defStartMen: b.defStartMen,
    attLosses: Math.round(b.attLosses),
    defLosses: Math.round(b.defLosses),
    winner,
    rounds: b.rounds.length,
    factors: b.factors,
    outcome,
  };
  st.reports.push(report);
  if (st.reports.length > 120) st.reports.splice(0, st.reports.length - 120);
  delete st.battles[b.id];

  for (const n of winNations)
    notify(sim, n, 'normal', 'battle', `Victory at ${provName(sim, b.province)}: enemy lost ${report[winner === 'attacker' ? 'defLosses' : 'attLosses'].toLocaleString()} men, we lost ${Math.round(winLoss).toLocaleString()}.`, { province: b.province });
  for (const n of loseNations)
    notify(sim, n, 'urgent', 'battle', `Defeat at ${provName(sim, b.province)}: we lost ${Math.round(loseLoss).toLocaleString()} men and are retreating.`, { province: b.province });
}
