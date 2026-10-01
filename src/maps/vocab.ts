// Closed vocabularies a map package may use. Anything outside these lists is
// rejected by the validator, so imported maps can only name things the game
// knows how to draw and simulate.

export const TERRAINS = ['plains', 'forest', 'hills', 'mountains', 'marsh', 'steppe'] as const;
export const RESOURCES = ['food', 'coal', 'iron', 'oil', 'rubber', 'nitrates'] as const;
/** Trait names before the industrial age (map format 1), with their current names. */
export const LEGACY_TRAITS: Record<string, string> = { gunsCostMul: 'artilleryCostMul', horseCostMul: 'cavalryCostMul', horseAttackAdd: 'cavalryAttackAdd' };
export const PERSONALITY_IDS = ['expansionist', 'defensive', 'commercial', 'opportunist', 'diplomat'] as const;

export const TINCTURE_NAMES = ['realm', 'or', 'argent', 'sable', 'gules', 'azure', 'vert', 'purpure'] as const;
export const ORDINARY_NAMES = ['none', 'pale', 'fess', 'bend', 'bendSinister', 'chevron', 'cross', 'saltire', 'chief', 'bordure', 'perPale', 'perFess', 'quarterly', 'pile'] as const;
export const CHARGE_NAMES = ['none', 'sun', 'star', 'crescent', 'tower', 'ship', 'book', 'mountain', 'tree', 'hammer', 'reed', 'horse', 'crown', 'key', 'wheat', 'roundel', 'lozenge'] as const;

export type Tincture = (typeof TINCTURE_NAMES)[number];
export type Ordinary = (typeof ORDINARY_NAMES)[number];
export type Charge = (typeof CHARGE_NAMES)[number];

/** Trait keys a realm may carry, with the bounds a map may set. */
export const TRAIT_BOUNDS: Record<string, [number, number]> = {
  incomeMul: [-0.5, 0.5],
  supplyProdMul: [-0.5, 0.5],
  manpowerMul: [-0.5, 0.5],
  researchMul: [-0.5, 0.5],
  tradeMul: [-0.5, 1],
  moraleAdd: [-1, 1],
  fortCostMul: [-0.5, 0.5],
  siegeMul: [-0.5, 0.5],
  devCostMul: [-0.5, 0.5],
  popGrowthMul: [-0.5, 0.5],
  artilleryCostMul: [-0.5, 0.5],
  cavalryCostMul: [-0.5, 0.5],
  cavalryAttackAdd: [-0.5, 0.5],
  integrationMul: [-0.5, 0.5],
  envoyAdd: [0, 2],
  opinionAdd: [-20, 20],
  straitCostAdd: [-2, 2],
};
