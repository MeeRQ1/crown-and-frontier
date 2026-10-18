// National modifiers: every bonus from traits, technology, national focus, the form
// of government, a formed nation, the head of government and timed effects is summed
// here (see modSources). Percentage modifiers are applied as (1 + sum), flat
// modifiers are added. Player and AI use exactly the same aggregation.

import { focusEffects } from './focus';
import { governmentSources } from './government';
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
  /** naval strike of the wings flying from our carriers */
  carrierAir: number;
  /** air wings each carrier can hold, beyond its own deck */
  carrierDeck: number;
  airAttack: number;
  airRange: number;
  /** upkeep of our air wings */
  airUpkeep: number;
  /** enemy bombing over our land is this much weaker; flak this much stronger */
  airDefence: number;
  // diplomacy
  /** influence gained over other realms */
  influenceGain: number;
  /** guarantees of independence the realm may give */
  guarantees: number;
  /** cost and time of fabricating claims */
  claimCost: number;
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
  carrierAir: ['Strikes by carrier-borne aircraft', 'pct'],
  carrierDeck: ['Air wings per carrier', 'flat'],
  airAttack: ['Air combat', 'pct'],
  airRange: ['Air range (steps over land and sea)', 'flat'],
  airUpkeep: ['Air wing upkeep', 'pct'],
  airDefence: ['Enemy bombing over our land', 'neg'],
  influenceGain: ['Influence gained', 'pct'],
  guarantees: ['Guarantees we may give', 'flat'],
  claimCost: ['Cost of fabricating claims', 'pct'],
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
  return `${sim.state.tick}|${n.focus.done.length}|${n.research.done.length}|${n.modifiers.length}|${n.bankruptUntil > sim.state.tick ? 1 : 0}|${severeDebt(n) ? 1 : 0}|${n.ideology?.id ?? ''}|${n.leader?.trait ?? ''}|${n.formed?.id ?? ''}`;
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

/**
 * Where a realm's modifiers come from (format 9), in stacking order: national traits,
 * research, national focus, the form of government, a formed nation's identity, the
 * head of government, timed effects (events, a change of government), then the
 * state of the treasury. Every source is additive: a percentage is applied once as
 * (1 + sum of every source), a flat value is the sum. Caps are applied where a value
 * is used (the defensive bonus, morale, supply). This list is the only path: the
 * totals the rules use and the sources the interface shows are the same sum.
 * Commanders add to the forces they lead only (see `forceSources`).
 */
export interface ModSource {
  kind: 'trait' | 'research' | 'focus' | 'ideology' | 'formed' | 'leader' | 'timed' | 'treasury' | 'commander';
  label: string;
  effects: ModEffects;
}

export function modSources(sim: Sim, nid: string): ModSource[] {
  const n = sim.state.nations[nid];
  const def = sim.world.nationDefs[nid];
  const out: ModSource[] = [];
  out.push({ kind: 'trait', label: `National character (${def.short})`, effects: traitMods(def.traits) });
  const research: ModEffects = {};
  for (const t of n.research.done) addEffects(research, TECHS[t]?.effects ?? {});
  out.push({ kind: 'research', label: `Research (${n.research.done.length} technologies)`, effects: research });
  const focus: ModEffects = {};
  for (const e of focusEffects(sim, nid)) addEffects(focus, e);
  out.push({ kind: 'focus', label: 'National focus', effects: focus });
  for (const g of governmentSources(sim, nid)) out.push(g);
  for (const md of n.modifiers) {
    if (md.until <= sim.state.tick) continue;
    const e = md.effects;
    out.push({
      kind: 'timed',
      label: md.label,
      effects: {
        income: e.incomeMul ?? 0,
        supplyProd: e.supplyProdMul ?? 0,
        manpower: e.manpowerMul ?? 0,
        research: e.researchMul ?? 0,
        unrest: e.unrestAdd ?? 0,
        integration: e.integrationMul ?? 0,
        moraleRecovery: e.moraleRecoveryMul ?? 0,
        upkeep: e.upkeepMul ?? 0,
        industry: e.industryMul ?? 0,
      },
    });
  }
  if (n.bankruptUntil > sim.state.tick) out.push({ kind: 'treasury', label: 'Bankruptcy', effects: { income: -0.25, moraleRecovery: -0.5, unrest: 5 } });
  if (severeDebt(n)) out.push({ kind: 'treasury', label: 'Severe debt', effects: { moraleRecovery: -0.5, unrest: 3 } });
  return out;
}

function addEffects(target: ModEffects, add: ModEffects): void {
  for (const k in add) {
    const key = k as keyof Mods;
    target[key] = (target[key] ?? 0) + (add[key] ?? 0);
  }
}

export function computeMods(sim: Sim, nid: string): Mods {
  const m = emptyMods();
  for (const src of modSources(sim, nid)) addMods(m, src.effects);
  return m;
}

/** Per modifier: its total and every source of it (for the interface: "where does this come from"). */
export function modBreakdown(sources: ModSource[]): Array<{ key: keyof Mods; total: number; parts: Array<{ label: string; value: number }> }> {
  const by = new Map<keyof Mods, Array<{ label: string; value: number }>>();
  for (const s of sources)
    for (const k in s.effects) {
      const key = k as keyof Mods;
      const v = s.effects[key] ?? 0;
      if (Math.abs(v) < 1e-9) continue;
      (by.get(key) ?? by.set(key, []).get(key)!).push({ label: s.label, value: v });
    }
  return [...by.entries()]
    .map(([key, parts]) => ({ key, total: parts.reduce((a, p) => a + p.value, 0), parts }))
    .filter((x) => Math.abs(x.total) > 1e-9 || x.parts.length > 1)
    .sort((a, b) => MOD_LABELS[a.key][0].localeCompare(MOD_LABELS[b.key][0]));
}

/** One value of a modifier, formatted as its kind is shown. */
export function formatMod(key: keyof Mods, v: number): string {
  const [, kind] = MOD_LABELS[key];
  const abs = Math.abs(v);
  if (kind === 'neg') return `${v > 0 ? '−' : '+'}${Math.round(abs * 100)}%`;
  return kind === 'pct' ? `${v >= 0 ? '+' : '−'}${Math.round(abs * 100)}%` : `${v >= 0 ? '+' : '−'}${Math.round(abs * 100) / 100}`;
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
