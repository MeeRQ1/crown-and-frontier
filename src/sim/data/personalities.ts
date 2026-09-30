import type { Personality, UnitType, VictoryPath } from '../types';
import type { Branch } from './techs';

export interface PersonalityDef {
  id: Personality;
  label: string;
  description: string;
  /** strength ratio (ours incl. allies / theirs incl. allies) required to start a war */
  warRatio: number;
  /** multiplier on the desire to go to war at all */
  aggression: number;
  /** share of crown income the AI is willing to spend on army upkeep in peacetime / war */
  armyBudget: [number, number];
  research: Record<Branch, number>;
  victory: VictoryPath;
  treaty: { nap: number; trade: number; alliance: number };
  policies: string[];
  composition: Record<UnitType, number>;
  fortLove: number;
  /** extra war score the AI demands before accepting peace (stubbornness) */
  stubborn: number;
  /** willingness to settle wilds */
  settle: number;
}

export const PERSONALITIES: Record<Personality, PersonalityDef> = {
  expansionist: {
    id: 'expansionist', label: 'Expansionist',
    description: 'Seeks land. Fights when it has a clear edge and integrates conquests.',
    warRatio: 1.15, aggression: 1.4, armyBudget: [0.4, 0.7],
    research: { arms: 1.4, statecraft: 1.1, civics: 0.6 }, victory: 'territorial',
    treaty: { nap: 0.6, trade: 0.6, alliance: 0.8 },
    policies: ['levy', 'frontier', 'commerce'],
    composition: { foot: 0.6, horse: 0.25, guns: 0.15 }, fortLove: 0.6, stubborn: 10, settle: 1.0,
  },
  defensive: {
    id: 'defensive', label: 'Defensive',
    description: 'Builds forts and alliances; fights mostly when attacked.',
    warRatio: 1.8, aggression: 0.5, armyBudget: [0.35, 0.65],
    research: { arms: 1.0, statecraft: 1.1, civics: 1.1 }, victory: 'economic',
    treaty: { nap: 1.3, trade: 1.0, alliance: 1.3 },
    policies: ['fortress', 'academy', 'commerce'],
    composition: { foot: 0.65, horse: 0.15, guns: 0.2 }, fortLove: 1.6, stubborn: 5, settle: 0.7,
  },
  commercial: {
    id: 'commercial', label: 'Commercial',
    description: 'Invests in development and trade; wars must pay for themselves.',
    warRatio: 1.45, aggression: 0.7, armyBudget: [0.3, 0.6],
    research: { arms: 0.8, statecraft: 1.5, civics: 1.0 }, victory: 'economic',
    treaty: { nap: 1.0, trade: 1.6, alliance: 0.9 },
    policies: ['commerce', 'academy', 'frontier'],
    composition: { foot: 0.6, horse: 0.2, guns: 0.2 }, fortLove: 0.9, stubborn: 0, settle: 1.1,
  },
  opportunist: {
    id: 'opportunist', label: 'Opportunist',
    description: 'Strikes rivals that are already at war or exhausted.',
    warRatio: 1.2, aggression: 1.1, armyBudget: [0.35, 0.7],
    research: { arms: 1.2, statecraft: 1.1, civics: 0.8 }, victory: 'territorial',
    treaty: { nap: 0.9, trade: 0.9, alliance: 0.9 },
    policies: ['levy', 'commerce', 'frontier'],
    composition: { foot: 0.55, horse: 0.3, guns: 0.15 }, fortLove: 0.8, stubborn: 5, settle: 1.2,
  },
  diplomat: {
    id: 'diplomat', label: 'Diplomat',
    description: 'Builds a web of partners and avoids wars of conquest.',
    warRatio: 2.0, aggression: 0.4, armyBudget: [0.3, 0.6],
    research: { arms: 0.7, statecraft: 1.0, civics: 1.6 }, victory: 'diplomatic',
    treaty: { nap: 1.4, trade: 1.5, alliance: 1.4 },
    policies: ['concord', 'commerce', 'academy'],
    composition: { foot: 0.6, horse: 0.2, guns: 0.2 }, fortLove: 1.0, stubborn: 0, settle: 0.9,
  },
};
