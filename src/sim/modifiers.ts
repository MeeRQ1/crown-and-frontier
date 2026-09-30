// National modifiers: every bonus from traits, technology, policy and timed
// effects is summed here. Percentage modifiers are applied as (1 + sum), flat
// modifiers are added. Player and AI use exactly the same aggregation.

import { POLICIES } from './data/policies';
import { TECHS } from './data/techs';
import type { NationState, NationTraits } from './types';
import type { Sim } from './state';

export interface Mods {
  income: number;
  supplyProd: number;
  manpower: number;
  manpowerRegen: number;
  research: number;
  trade: number;
  integration: number;
  unrest: number;
  moraleMax: number;
  moraleRecovery: number;
  attack: number;
  footAttack: number;
  horseAttack: number;
  gunsAttack: number;
  defense: number;
  siege: number;
  supplyRange: number;
  supplyCap: number;
  attrition: number;
  entrench: number;
  moveSpeed: number;
  devCost: number;
  infraCost: number;
  fortCost: number;
  settleCost: number;
  recruitCost: number;
  footCost: number;
  horseCost: number;
  gunsCost: number;
  upkeep: number;
  fortUpkeep: number;
  envoys: number;
  relationGain: number;
  alarmDecay: number;
  alarmGen: number;
  warExhaustion: number;
  adminCapacity: number;
  buildSlots: number;
  popGrowth: number;
  opinion: number;
  reinforce: number;
  trustGain: number;
}

export type ModEffects = Partial<Mods>;

export const MOD_LABELS: Record<keyof Mods, [string, 'pct' | 'flat']> = {
  income: ['Crown income', 'pct'],
  supplyProd: ['Supply production', 'pct'],
  manpower: ['Military reserve', 'pct'],
  manpowerRegen: ['Reserve recovery', 'pct'],
  research: ['Research speed', 'pct'],
  trade: ['Trade agreement value', 'pct'],
  integration: ['Integration speed', 'pct'],
  unrest: ['Unrest', 'flat'],
  moraleMax: ['Maximum morale', 'flat'],
  moraleRecovery: ['Morale recovery', 'pct'],
  attack: ['Army damage', 'pct'],
  footAttack: ['Foot damage', 'pct'],
  horseAttack: ['Horse damage', 'pct'],
  gunsAttack: ['Guns damage', 'pct'],
  defense: ['Defensive bonus', 'pct'],
  siege: ['Siege speed', 'pct'],
  supplyRange: ['Supply range', 'flat'],
  supplyCap: ['Supply capacity', 'pct'],
  attrition: ['Attrition', 'pct'],
  entrench: ['Entrenchment', 'pct'],
  moveSpeed: ['Movement speed', 'pct'],
  devCost: ['Development cost', 'pct'],
  infraCost: ['Road cost', 'pct'],
  fortCost: ['Fort cost', 'pct'],
  settleCost: ['Settlement cost', 'pct'],
  recruitCost: ['Recruitment cost', 'pct'],
  footCost: ['Foot cost', 'pct'],
  horseCost: ['Horse cost', 'pct'],
  gunsCost: ['Guns cost', 'pct'],
  upkeep: ['Army upkeep', 'pct'],
  fortUpkeep: ['Fort upkeep', 'pct'],
  envoys: ['Envoys', 'flat'],
  relationGain: ['Relation improvement', 'pct'],
  alarmDecay: ['Alarm decay', 'pct'],
  alarmGen: ['Alarm caused by conquest', 'pct'],
  warExhaustion: ['War exhaustion gain', 'pct'],
  adminCapacity: ['Administrative capacity', 'flat'],
  buildSlots: ['Construction slots', 'flat'],
  popGrowth: ['Population growth', 'pct'],
  opinion: ['Opinion of us', 'flat'],
  reinforce: ['Reinforcement speed', 'pct'],
  trustGain: ['Trust recovery', 'pct'],
};

export function emptyMods(): Mods {
  const m = {} as Mods;
  for (const k of Object.keys(MOD_LABELS) as (keyof Mods)[]) m[k] = 0;
  return m;
}

export function addMods(target: Mods, add: ModEffects): void {
  for (const k in add) {
    const key = k as keyof Mods;
    target[key] += add[key] ?? 0;
  }
}

export function traitMods(t: NationTraits): ModEffects {
  return {
    income: t.incomeMul ?? 0,
    supplyProd: t.supplyProdMul ?? 0,
    manpower: t.manpowerMul ?? 0,
    research: t.researchMul ?? 0,
    trade: t.tradeMul ?? 0,
    moraleMax: t.moraleAdd ?? 0,
    fortCost: t.fortCostMul ?? 0,
    siege: t.siegeMul ?? 0,
    devCost: t.devCostMul ?? 0,
    popGrowth: t.popGrowthMul ?? 0,
    gunsCost: t.gunsCostMul ?? 0,
    horseCost: t.horseCostMul ?? 0,
    horseAttack: t.horseAttackAdd ?? 0,
    integration: t.integrationMul ?? 0,
    envoys: t.envoyAdd ?? 0,
    opinion: t.opinionAdd ?? 0,
  };
}

export function severeDebt(n: NationState): boolean {
  return n.treasury < 0 && n.debtMonths >= 3;
}

const cache = new WeakMap<object, Map<string, { key: string; mods: Mods }>>();

function cacheKey(sim: Sim, nid: string): string {
  const n = sim.state.nations[nid];
  return `${sim.state.tick}|${n.policy}|${n.research.done.length}|${n.modifiers.length}|${n.bankruptUntil > sim.state.tick ? 1 : 0}|${severeDebt(n) ? 1 : 0}`;
}

/** Aggregated modifiers for a nation (cached per tick and relevant state). */
export function nationMods(sim: Sim, nid: string): Mods {
  let perState = cache.get(sim.state);
  if (!perState) {
    perState = new Map();
    cache.set(sim.state, perState);
  }
  const key = cacheKey(sim, nid);
  const hit = perState.get(nid);
  if (hit && hit.key === key) return hit.mods;
  const mods = computeMods(sim, nid);
  perState.set(nid, { key, mods });
  return mods;
}

export function computeMods(sim: Sim, nid: string): Mods {
  const n = sim.state.nations[nid];
  const def = sim.world.nationDefs[nid];
  const m = emptyMods();
  addMods(m, traitMods(def.traits));
  for (const t of n.research.done) addMods(m, TECHS[t]?.effects ?? {});
  addMods(m, POLICIES[n.policy]?.effects ?? {});
  for (const md of n.modifiers) {
    if (md.until <= sim.state.tick) continue;
    const e = md.effects;
    addMods(m, {
      income: e.incomeMul ?? 0,
      supplyProd: e.supplyProdMul ?? 0,
      manpower: e.manpowerMul ?? 0,
      research: e.researchMul ?? 0,
      unrest: e.unrestAdd ?? 0,
      integration: e.integrationMul ?? 0,
      moraleRecovery: e.moraleRecoveryMul ?? 0,
      upkeep: e.upkeepMul ?? 0,
    });
  }
  if (n.bankruptUntil > sim.state.tick) addMods(m, { income: -0.25, moraleRecovery: -0.5, unrest: 5 });
  if (severeDebt(n)) addMods(m, { moraleRecovery: -0.5, unrest: 3 });
  return m;
}

export function describeEffects(e: ModEffects): string[] {
  const out: string[] = [];
  for (const k in e) {
    const key = k as keyof Mods;
    const v = e[key] ?? 0;
    if (!v) continue;
    const [label, kind] = MOD_LABELS[key];
    const sign = v > 0 ? '+' : '−';
    const abs = Math.abs(v);
    out.push(kind === 'pct' ? `${label} ${sign}${Math.round(abs * 100)}%` : `${label} ${sign}${Math.round(abs * 100) / 100}`);
  }
  return out;
}
