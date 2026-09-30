// Occupation and sieges.
//
// Winning a battle does not take a province. An army standing (not fighting,
// not retreating) in a province whose controller it is at war with besieges it:
//   no fort: 100 progress in 2 weeks
//   fort L : 100 progress in 10*L weeks, requires >= 2*L regiments present
//   x (1 + 0.25 per guns regiment, max 6) x (1 + siege tech) x 0.5 if unsupplied
//   x 2 when the legal owner (or its friend) is retaking its own province
// At 100 the controller changes. Progress resets if the besiegers leave.

import { C } from './config';
import { cancelRecruits } from './military';
import { nationMods } from './modifiers';
import { atWar, bump, isFriendly, nationName, notify, provName, type Sim } from './state';
import { supplyStatus } from './supply';
import type { Army, NationId, ProvinceId } from './types';

export interface SiegeInfo {
  nation: NationId;
  regiments: number;
  required: number;
  weeklyRate: number;
  liberation: boolean;
  notes: string[];
}

export function siegeInfo(sim: Sim, pid: ProvinceId): SiegeInfo | null {
  const st = sim.state;
  const p = st.provinces[pid];
  if (!p.controller) return null;
  if (Object.values(st.battles).some((b) => b.province === pid)) return null;
  const present: Army[] = [];
  for (const id of Object.keys(st.armies).sort()) {
    const a = st.armies[id];
    if (a.location === pid && !a.retreating && !a.battle && a.path.length === 0 && atWar(sim, a.nation, p.controller)) present.push(a);
  }
  if (!present.length) return null;
  // lead besieger: the nation with the most regiments present
  const byNation = new Map<NationId, number>();
  for (const a of present) byNation.set(a.nation, (byNation.get(a.nation) ?? 0) + a.regiments.length);
  const lead = [...byNation.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0][0];
  const team = present.filter((a) => isFriendly(sim, lead, a.nation));
  const regiments = team.reduce((s, a) => s + a.regiments.length, 0);
  const guns = team.reduce((s, a) => s + a.regiments.filter((r) => r.type === 'guns').length, 0);
  const required = Math.max(1, C.siege.minRegimentsPerLevel * p.fort);
  const notes: string[] = [];
  let rate = p.fort > 0 ? 100 / (C.siege.fortWeeksPerLevel * p.fort) : 100 / C.siege.noFortWeeks;
  if (p.fort > 0) notes.push(`Fort level ${p.fort}: ${C.siege.fortWeeksPerLevel * p.fort} weeks base`);
  const g = Math.min(C.siege.gunsMax, guns);
  if (g && p.fort > 0) {
    rate *= 1 + C.siege.gunsBonus * g;
    notes.push(`${g} guns regiment(s) +${Math.round(C.siege.gunsBonus * g * 100)}%`);
  }
  const sm = nationMods(sim, lead).siege;
  if (sm) {
    rate *= 1 + sm;
    notes.push(`Siege skill +${Math.round(sm * 100)}%`);
  }
  const worst = Math.min(...team.map((a) => a.supply));
  if (supplyStatus(worst) === 'unsupplied') {
    rate *= 0.5;
    notes.push('Unsupplied besiegers −50%');
  }
  const liberation = !!p.owner && isFriendly(sim, lead, p.owner);
  if (liberation) {
    rate *= C.siege.liberateMul;
    notes.push('Liberating friendly land ×2');
  }
  if (regiments < required) notes.push(`Needs ${required} regiments to invest the fort (have ${regiments})`);
  return { nation: lead, regiments, required, weeklyRate: regiments >= required ? rate : 0, liberation, notes };
}

export function setController(sim: Sim, pid: ProvinceId, ctrl: NationId | null): void {
  const p = sim.state.provinces[pid];
  if (p.controller === ctrl) return;
  p.controller = ctrl;
  p.siege = null;
  if (p.recruits.length) cancelRecruits(sim, pid);
  bump(sim);
}

/** Weekly siege progress for all provinces (province id order). */
export function weeklySieges(sim: Sim): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    const info = siegeInfo(sim, pid);
    if (!info) {
      if (p.siege && !Object.values(st.battles).some((b) => b.province === pid)) p.siege = null;
      continue;
    }
    if (!p.siege || p.siege.nation !== info.nation) p.siege = { nation: info.nation, progress: 0 };
    p.siege.progress = Math.min(100, p.siege.progress + info.weeklyRate);
    if (p.siege.progress >= 100) {
      const prev = p.controller;
      const newCtrl = info.liberation && p.owner ? p.owner : info.nation;
      setController(sim, pid, newCtrl);
      if (info.liberation) {
        notify(sim, p.owner!, 'normal', 'occupation', `${provName(sim, pid)} has been liberated.`, { province: pid });
        if (prev) notify(sim, prev, 'normal', 'occupation', `We lost control of ${provName(sim, pid)}.`, { province: pid });
      } else {
        notify(sim, info.nation, 'normal', 'occupation', `Our troops now occupy ${provName(sim, pid)}.`, { province: pid });
        if (p.owner) notify(sim, p.owner, 'urgent', 'occupation', `${provName(sim, pid)} has been occupied by ${nationName(sim, info.nation)}.`, { province: pid });
      }
    }
  }
}
