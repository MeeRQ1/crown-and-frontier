import type { ModEffects } from '../modifiers';

export interface PolicyDef {
  id: string;
  name: string;
  effects: ModEffects;
  benefit: string;
  drawback: string;
  /** forbids declaring wars without a claim */
  claimsOnly?: boolean;
}

export const POLICY_COOLDOWN_MONTHS = 24;

export const POLICY_LIST: PolicyDef[] = [
  {
    id: 'commerce', name: 'Mercantile Charter',
    effects: { income: 0.15, trade: 0.25, manpowerRegen: -0.2 },
    benefit: 'Crown income +15%, trade agreements +25%.',
    drawback: 'Reserve recovery −20%.',
  },
  {
    id: 'levy', name: 'Martial Levy',
    effects: { manpower: 0.25, manpowerRegen: 0.25, recruitCost: -0.15, income: -0.1, unrest: 3 },
    benefit: 'Military reserve +25%, reserve recovery +25%, recruitment −15% cost.',
    drawback: 'Crown income −10%, unrest +3.',
  },
  {
    id: 'frontier', name: 'Frontier Settlement',
    effects: { integration: 0.5, settleCost: -0.25, adminCapacity: 2, research: -0.2 },
    benefit: 'Integration +50%, administrative capacity +2, settlement −25% cost.',
    drawback: 'Research −20%.',
  },
  {
    id: 'academy', name: 'Royal Academy',
    effects: { research: 0.35, supplyProd: -0.1, upkeep: 0.05 },
    benefit: 'Research +35%.',
    drawback: 'Supply production −10%, army upkeep +5%.',
  },
  {
    id: 'fortress', name: 'Fortress Doctrine',
    effects: { fortCost: -0.25, fortUpkeep: -0.5, entrench: 0.5, moveSpeed: -0.1, income: -0.05 },
    benefit: 'Forts −25% cost and −50% upkeep, entrenchment +50%.',
    drawback: 'Movement −10%, crown income −5%.',
  },
  {
    id: 'concord', name: 'Concord Diplomacy',
    effects: { envoys: 1, relationGain: 0.5, alarmDecay: 0.5, alarmGen: -0.25, warExhaustion: 0.5 },
    benefit: '+1 envoy, relations improve +50% faster, alarm fades +50% faster.',
    drawback: 'War exhaustion +50%; may only declare wars over claims.',
    claimsOnly: true,
  },
];

export const POLICIES: Record<string, PolicyDef> = Object.fromEntries(POLICY_LIST.map((p) => [p.id, p]));
