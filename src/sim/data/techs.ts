import type { ModEffects } from '../modifiers';

export type Branch = 'arms' | 'statecraft' | 'civics';

export interface TechDef {
  id: string;
  name: string;
  branch: Branch;
  tier: 1 | 2 | 3;
  cost: number; // research points
  requires: string[];
  effects: ModEffects;
  description: string;
}

const TIER_COST = { 1: 100, 2: 190, 3: 300 } as const;

function tech(id: string, name: string, branch: Branch, tier: 1 | 2 | 3, requires: string[], effects: ModEffects, description: string): TechDef {
  return { id, name, branch, tier, cost: TIER_COST[tier], requires, effects, description };
}

export const BRANCHES: Record<Branch, { name: string; blurb: string }> = {
  arms: { name: 'Arms', blurb: 'Win battles, sieges and long campaigns.' },
  statecraft: { name: 'Statecraft', blurb: 'Grow, build and integrate the realm.' },
  civics: { name: 'Civics', blurb: 'Stability, diplomacy and learning.' },
};

export const TECH_LIST: TechDef[] = [
  tech('drill', 'Drilled Musketry', 'arms', 1, [], { footAttack: 0.15 }, 'Volley drill makes line infantry deadlier.'),
  tech('trains', 'Supply Trains', 'arms', 1, [], { supplyRange: 1, attrition: -0.3 }, 'Wagon trains carry supplies one province further.'),
  tech('cuirassiers', 'Cuirassier Doctrine', 'arms', 2, ['drill'], { horseAttack: 0.2, moveSpeed: 0.05 }, 'Armoured horse that can break a wavering line.'),
  tech('siegecraft', 'Siegecraft', 'arms', 2, ['trains'], { siege: 0.4, gunsAttack: 0.1 }, 'Trenches and saps bring down forts faster.'),
  tech('earthworks', 'Earthworks', 'arms', 3, ['siegecraft'], { entrench: 0.5, defense: 0.1 }, 'Armies dig in quickly and hold ground longer.'),
  tech('standing', 'Standing Army', 'arms', 3, ['cuirassiers'], { moraleMax: 0.5, reinforce: 0.5, upkeep: -0.1 }, 'Professional soldiers with steady morale.'),

  tech('rotation', 'Crop Rotation', 'statecraft', 1, [], { supplyProd: 0.2, popGrowth: 0.25 }, 'More food for towns and armies.'),
  tech('surveys', 'Land Surveys', 'statecraft', 1, [], { devCost: -0.2 }, 'Surveyed land is cheaper to improve.'),
  tech('roads', 'Royal Roads', 'statecraft', 2, ['surveys'], { infraCost: -0.25, moveSpeed: 0.1, supplyCap: 0.15 }, 'Cheaper roads that move armies and wagons faster.'),
  tech('charters', 'Chartered Companies', 'statecraft', 2, ['rotation'], { income: 0.1, trade: 0.3 }, 'Merchant companies raise taxes and trade.'),
  tech('bureaucracy', 'Royal Bureaucracy', 'statecraft', 3, ['roads'], { adminCapacity: 2, buildSlots: 1 }, 'Clerks let the crown govern more frontier at once.'),
  tech('colonial', 'Frontier Charters', 'statecraft', 3, ['charters'], { settleCost: -0.3, integration: 0.25 }, 'Settlers and charters bind new lands to the crown.'),

  tech('corps', 'Diplomatic Corps', 'civics', 1, [], { envoys: 1, relationGain: 0.25 }, 'A trained corps of envoys.'),
  tech('law', 'Common Law', 'civics', 1, [], { unrest: -5, integration: 0.15 }, 'One law for old and new subjects alike.'),
  tech('press', 'Printing Press', 'civics', 2, ['law'], { research: 0.2 }, 'Cheap books spread new ideas.'),
  tech('embassies', 'Resident Embassies', 'civics', 2, ['corps'], { alarmGen: -0.25, trustGain: 0.5, opinion: 5 }, 'Permanent embassies calm foreign courts.'),
  tech('militia', 'Civic Militia', 'civics', 3, ['law'], { manpower: 0.2, manpowerRegen: 0.2 }, 'Towns train their own reserves.'),
  tech('concert', 'Concert of Crowns', 'civics', 3, ['embassies'], { alarmDecay: 0.5, opinion: 10, warExhaustion: -0.25 }, 'Regular congresses where crowns settle disputes.'),
];

export const TECHS: Record<string, TechDef> = Object.fromEntries(TECH_LIST.map((t) => [t.id, t]));
