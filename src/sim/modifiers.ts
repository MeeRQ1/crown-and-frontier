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
  infantryAttack: number;
  cavalryAttack: number;
  artilleryAttack: number;
  defense: number;
  siege: number;
  supplyRange: number;
  supplyCap: number;
  attrition: number;
  entrench: number;
  moveSpeed: number;
  straitCost: number;
  devCost: number;
  infraCost: number;
  fortCost: number;
  settleCost: number;
  recruitCost: number;
  infantryCost: number;
  cavalryCost: number;
  artilleryCost: number;
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
  // industrial age
  armourAttack: number;
  armourCost: number;
  /** enemy cavalry fire against us is reduced by this share (machine guns) */
  antiCavalry: number;
  materielCost: number;
  resourceOutput: number;
  coalOutput: number;
  ironOutput: number;
  oilOutput: number;
  rubberOutput: number;
  nitratesOutput: number;
  industry: number;
  factoryCost: number;
  factoryCoal: number;
  syntheticNitrates: number;
  syntheticOil: number;
  syntheticRubber: number;
  // navy and air
  navalAttack: number;
  capitalAttack: number;
  antiSub: number;
  fleetSpeed: number;
  shipCost: number;
  portCost: number;
  repair: number;
  /** 1 once oil-fired boilers replace coal (cruisers, battleships, screens, transports) */
  oilFiring: number;
  /** cuts the amphibious landing penalty by this share */
  landing: number;
  /** enemy blockades cost us this much less */
  blockadeResist: number;
  carrierAir: number;
  airAttack: number;
  airRange: number;
  /** enemy bombing over our land is this much weaker; flak this much stronger */
  airDefence: number;
}

export type ModEffects = Partial<Mods>;

export const MOD_LABELS: Record<keyof Mods, [string, 'pct' | 'flat' | 'neg']> = {
  income: ['Crown income', 'pct'],
  supplyProd: ['Food production', 'pct'],
  manpower: ['Military reserve', 'pct'],
  manpowerRegen: ['Reserve recovery', 'pct'],
  research: ['Research speed', 'pct'],
  trade: ['Trade agreement value', 'pct'],
  integration: ['Integration speed', 'pct'],
  unrest: ['Unrest', 'flat'],
  moraleMax: ['Maximum morale', 'flat'],
  moraleRecovery: ['Morale recovery', 'pct'],
  attack: ['Army damage', 'pct'],
  infantryAttack: ['Infantry damage', 'pct'],
  cavalryAttack: ['Cavalry damage', 'pct'],
  artilleryAttack: ['Artillery damage', 'pct'],
  defense: ['Defensive bonus', 'pct'],
  siege: ['Siege speed', 'pct'],
  supplyRange: ['Supply range', 'flat'],
  supplyCap: ['Supply capacity', 'pct'],
  attrition: ['Attrition', 'pct'],
  entrench: ['Entrenchment', 'pct'],
  moveSpeed: ['Movement speed', 'pct'],
  straitCost: ['Sea crossing cost (movement points)', 'flat'],
  devCost: ['Development cost', 'pct'],
  infraCost: ['Railway cost', 'pct'],
  fortCost: ['Fort cost', 'pct'],
  settleCost: ['Settlement cost', 'pct'],
  recruitCost: ['Recruitment cost', 'pct'],
  infantryCost: ['Infantry cost', 'pct'],
  cavalryCost: ['Cavalry cost', 'pct'],
  artilleryCost: ['Artillery cost', 'pct'],
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
  armourAttack: ['Armour damage', 'pct'],
  armourCost: ['Armour cost', 'pct'],
  antiCavalry: ['Enemy cavalry damage against us', 'neg'],
  materielCost: ['Materiel needed for regiments', 'pct'],
  resourceOutput: ['Mine and well output', 'pct'],
  coalOutput: ['Coal output', 'pct'],
  ironOutput: ['Iron output', 'pct'],
  oilOutput: ['Oil output', 'pct'],
  rubberOutput: ['Rubber output', 'pct'],
  nitratesOutput: ['Nitrate output', 'pct'],
  industry: ['Industrial capacity', 'pct'],
  factoryCost: ['Factory cost', 'pct'],
  factoryCoal: ['Coal burned by factories', 'pct'],
  syntheticNitrates: ['Synthetic nitrates per factory (from coal)', 'flat'],
  syntheticOil: ['Synthetic fuel per factory (from coal)', 'flat'],
  syntheticRubber: ['Synthetic rubber per factory (from coal)', 'flat'],
  navalAttack: ['Naval gunnery', 'pct'],
  capitalAttack: ['Battleship gunnery', 'pct'],
  antiSub: ['Anti-submarine warfare', 'pct'],
  fleetSpeed: ['Fleet speed', 'pct'],
  shipCost: ['Shipbuilding cost', 'pct'],
  portCost: ['Port cost', 'pct'],
  repair: ['Ship repair', 'pct'],
  oilFiring: ['Oil-fired boilers (ships burn oil, not coal)', 'flat'],
  landing: ['Amphibious landing penalty', 'neg'],
  blockadeResist: ['Losses to enemy blockades', 'neg'],
  carrierAir: ['Carrier air strikes', 'pct'],
  airAttack: ['Air combat', 'pct'],
  airRange: ['Air range (provinces)', 'flat'],
  airDefence: ['Enemy bombing over our land', 'neg'],
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
    artilleryCost: t.artilleryCostMul ?? 0,
    cavalryCost: t.cavalryCostMul ?? 0,
    cavalryAttack: t.cavalryAttackAdd ?? 0,
    integration: t.integrationMul ?? 0,
    envoys: t.envoyAdd ?? 0,
    opinion: t.opinionAdd ?? 0,
    straitCost: t.straitCostAdd ?? 0,
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
      industry: e.industryMul ?? 0,
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
    // 'neg': a positive value reduces what the label names (shown as a reduction)
    if (kind === 'neg') out.push(`${label} ${v > 0 ? '−' : '+'}${Math.round(abs * 100)}%`);
    else out.push(kind === 'pct' ? `${label} ${sign}${Math.round(abs * 100)}%` : `${label} ${sign}${Math.round(abs * 100) / 100}`);
  }
  return out;
}
