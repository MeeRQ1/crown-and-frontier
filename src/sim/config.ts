// All tunable rule numbers. Formulas live in the modules; the numbers live here.
// Units: time in ticks (1 tick = 1 week, 4 weeks = 1 month, 12 months = 1 year),
// money in crowns, supplies in wagons, manpower in men, population in thousands.

import type { Terrain, UnitType } from './types';

export interface TerrainRules {
  move: number; // movement points needed to enter
  defense: number; // defender bonus (reduces attacker damage)
  frontage: number; // regiments per side that can engage
  supply: number; // base supply capacity in regiments
  devCap: number; // soft development cap (can be exceeded by devOvercap at a higher cost)
  cav: number; // horse effectiveness modifier
  supplyProd: number; // supplies production multiplier
  devCost: number; // development cost multiplier
  popCap: number; // population capacity (thousands) at dev 1
  label: string;
}

export const TERRAIN: Record<Terrain, TerrainRules> = {
  plains: { move: 2, defense: 0, frontage: 16, supply: 10, devCap: 10, cav: 0.2, supplyProd: 1.2, devCost: 1.0, popCap: 70, label: 'Plains' },
  steppe: { move: 2, defense: 0, frontage: 20, supply: 7, devCap: 6, cav: 0.3, supplyProd: 0.8, devCost: 1.0, popCap: 40, label: 'Steppe' },
  forest: { move: 3, defense: 0.15, frontage: 10, supply: 7, devCap: 7, cav: -0.3, supplyProd: 0.9, devCost: 1.1, popCap: 45, label: 'Forest' },
  hills: { move: 3, defense: 0.25, frontage: 12, supply: 6, devCap: 8, cav: -0.15, supplyProd: 0.8, devCost: 1.2, popCap: 45, label: 'Hills' },
  marsh: { move: 4, defense: 0.2, frontage: 8, supply: 4, devCap: 5, cav: -0.4, supplyProd: 0.7, devCost: 1.3, popCap: 35, label: 'Marsh' },
  mountains: { move: 5, defense: 0.5, frontage: 6, supply: 3, devCap: 4, cav: -0.5, supplyProd: 0.5, devCost: 1.5, popCap: 20, label: 'Mountains' },
};

export interface UnitRules {
  label: string;
  plural: string;
  cost: number; // crowns
  supplies: number; // supplies to equip
  weeks: number; // training time
  upkeep: number; // crowns / month at full strength
  supplyUse: number; // supplies / month at full strength
  attack: number; // firepower per 1000 men
  morale: number; // morale damage multiplier dealt
  speed: number; // movement points per week
  siege: number; // siege contribution
  role: string;
}

export const UNITS: Record<UnitType, UnitRules> = {
  foot: {
    label: 'Foot', plural: 'Foot', cost: 20, supplies: 5, weeks: 4, upkeep: 1.0, supplyUse: 0.5,
    attack: 1.0, morale: 1.0, speed: 1.0, siege: 1, role: 'Cheap line infantry. Holds ground and fills the frontage.',
  },
  horse: {
    label: 'Horse', plural: 'Horse', cost: 45, supplies: 10, weeks: 6, upkeep: 2.0, supplyUse: 1.0,
    attack: 1.2, morale: 1.6, speed: 1.5, siege: 0.5, role: 'Fast shock cavalry. Strong on open ground, pursues beaten enemies.',
  },
  guns: {
    label: 'Guns', plural: 'Guns', cost: 60, supplies: 20, weeks: 8, upkeep: 2.4, supplyUse: 1.0,
    attack: 1.7, morale: 1.2, speed: 0.8, siege: 4, role: 'Artillery. Heavy firepower and siege work; fragile without infantry.',
  },
};

export const C = {
  time: { weeksPerMonth: 4, monthsPerYear: 12 },
  regimentSize: 1000,

  economy: {
    goldPerDev: 0.8,
    goldPerPop: 0.012, // crowns / month per thousand people
    capitalBonus: 3,
    goodsBonus: 2,
    occupierShare: 0.3, // share of a province's crowns levied by an occupier
    supplyPerDev: 0.5,
    grainBonus: 3,
    stockpileBase: 60,
    stockpilePerDev: 5,
    tradeBase: 2,
    tradeShare: 0.06, // of partner's province income
    fundingCost: [0, 0.08, 0.18, 0.32] as const, // share of gross income
    fundingMul: [1, 1.4, 1.8, 2.2] as const,
    interestRate: 0.02, // monthly interest on debt
    creditMonths: 3, // debt beyond this many months of income triggers bankruptcy
    severeDebtMonths: 3,
    bankruptcyMonths: 24,
  },

  population: {
    growth: 0.0018, // monthly logistic growth rate
    occupationLoss: 0.002,
    reservePerPop: 40, // men of military reserve per thousand people (fully integrated)
    regenMonths: 40, // months to regenerate an empty reserve
    startPoolShare: 0.6,
  },

  integration: {
    base: 3.0, // points / month
    infraBonus: 0.25, // per road level
    claimBonus: 0.5,
    garrisonBonus: 0.3,
    distancePenalty: 0.05, // per hop from capital
    distanceFloor: 0.5,
    conquered: 10,
    conqueredClaim: 25,
    settled: 20,
    capacityBase: 3,
    capacityPerProvince: 0.1,
    supplySourceMin: 50,
    developMin: 40,
    recruitMin: 30,
    economicMin: 75, // counts toward economic victory
  },

  unrest: {
    fromIntegration: 1 / 3, // target += (100 - integration) * this
    overextension: 20,
    warExhaustion: 0.2,
    garrison: 10,
    occupied: 15,
    approach: 0.25, // fraction of the gap closed per month
    revoltThreshold: 70,
    revoltChance: 0.12,
    revoltMonths: 6,
    revoltIntegrationLoss: 15,
  },

  construction: {
    devBase: 20, // * dev * (1 + dev/4) * terrain multiplier
    devWeeks: 16,
    devOvercap: 3, // levels allowed beyond the terrain cap
    devOvercapMul: 2.5, // cost multiplier beyond the terrain cap
    infraBase: 40, // * (level + 1) * (1 + level/2)
    infraWeeks: 12,
    infraMax: 3,
    fortBase: 60, // * (level + 1) * (1 + level/2)
    fortSupplies: 10,
    fortWeeks: 16,
    fortMax: 3,
    fortUpkeep: 1, // crowns / month per level
    charterBase: 20, // + 6 per dev
    charterPerDev: 6,
    charterWeeks: 8,
    charterGain: 25,
    settleCost: 50,
    settleManpower: 500,
    settleSupplies: 20,
    settleWeeks: 16,
    slotsBase: 2,
    slotsPerProvinces: 10,
    refund: 0.5,
  },

  army: {
    baseMorale: 3.0,
    moraleRecovery: 0.25, // per week in friendly territory
    moraleRecoveryHostile: 0.1,
    reinforceRate: 0.1, // share of missing men per week
    newRecruitMorale: 0.5, // fraction of max morale for newly raised regiments
    disbandReturn: 1.0,
    minRegimentMen: 100,
    maxRegiments: 40,
    entrenchWeeks: [2, 4] as const,
    entrenchBonus: [0.1, 0.2] as const,
  },

  supply: {
    range: 3,
    strainedBelow: 0.8,
    unsuppliedBelow: 0.4,
    infraCapBonus: 0.3,
    devCapBonus: 0.5, // regiments per dev
    foreignMul: 0.75,
    disconnectedMul: 0.5,
    attrition: 0.02, // share of men lost per week when unsupplied
    strainedPenalty: 0.1,
    unsuppliedPenalty: 0.25,
  },

  combat: {
    casualtyPerFire: 55, // men per firepower point per round
    rollMin: 0.85,
    rollMax: 1.15,
    moraleBase: 0.15, // morale loss per round
    moraleFromLosses: 8, // morale loss per fraction of men lost
    breakAt: 0.25, // side breaks at this fraction of max morale
    maxRounds: 8,
    fortBonus: 0.15, // per level, defender only
    maxDefense: 0.7,
    flankHorseShare: 0.2,
    flankBonus: 0.15,
    gunsScreen: 1, // guns need at least this many front regiments per gun regiment
    unscreenedGuns: 0.5,
    pursuit: 0.1,
    pursuitCap: 0.15,
  },

  siege: {
    noFortWeeks: 2, // progress 100 in this many weeks with no fort
    fortWeeksPerLevel: 10,
    gunsBonus: 0.25, // per gun regiment, max 6
    gunsMax: 6,
    minRegimentsPerLevel: 2,
    liberateMul: 2,
  },

  diplomacy: {
    envoysBase: 2,
    envoyCost: 1.5, // crowns / month
    envoyMonths: 12,
    envoyGain: 2.5, // opinion / month
    envoyCap: 35,
    napMonths: 60,
    truceMonths: 60,
    borderFriction: -5,
    allianceOpinion: 25,
    napOpinion: 10,
    tradeOpinion: 10,
    commonEnemy: 15,
    alarmOpinion: 0.5,
    rivalBidCap: 25, // most opinion a diplomatic front-runner loses to rivals' wariness
    alarmDecay: 0.6,
    alarmCoalition: 45,
    alarmLeave: 25,
    alarmConquestMul: 2.5,
    trustStart: 50,
    trustRecovery: 0.15, // per month, toward 75
    trustViolation: 25,
    fabricateMonths: 12,
    fabricateCost: 40,
    proposalWeeks: 4,
  },

  war: {
    exhaustionPerMonth: 0.6,
    exhaustionPerLossShare: 40, // per share of reserve lost
    exhaustionOccupation: 3, // per month * occupied share
    exhaustionDecay: 2,
    battleScoreCap: 30,
    goalScoreCap: 25,
    goalTickMonths: 12,
    forcedPeaceMonths: 96,
    stalemateMonths: 36,
    stalemateBand: 10,
    provinceBaseCost: 5,
    unoccupiedMul: 1.5,
    capitalMul: 1.5,
    goldPerPoint: 20, // crowns per war-score point
    conquestTrustLoss: 8,
    minWarMonthsBeforeDemand: 0,
  },

  victory: {
    /** rivals react once a realm has held a victory path for this share of its timer */
    rivalReaction: 0.35,
    territorialRegions: 3,
    territorialShare: 0.23,
    regionHold: 0.75,
    territorialMonths: 24,
    economicShare: 0.25,
    economicUnrest: 25,
    economicMonths: 60,
    streakDecay: 6,
    diplomaticInfluencePerRealm: 1.25, // influence needed per other surviving realm
    diplomaticMinInfluence: 6,
    diplomaticTreatyAge: 36, // months a treaty must exist to count
    diplomaticOpinion: 35,
    diplomaticTrust: 65,
    diplomaticMonths: 60,
  },

  events: {
    firstMonths: 4,
    minGapMonths: 5,
    maxGapMonths: 11,
    expireWeeks: 8,
  },

  ai: {
    diagnosticsKept: 400,
    openingMonths: 18, // AI realms start no offensive wars during the opening
  },
} as const;

export const SCHEMA_VERSION = 1;
