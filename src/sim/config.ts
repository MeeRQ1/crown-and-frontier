// All tunable rule numbers. Formulas live in the modules; the numbers live here.
// Units: time in ticks (1 tick = 1 week, 4 weeks = 1 month, 12 months = 1 year),
// money in crowns, supplies in wagons, manpower in men, population in thousands.

import type { ShipType, StrategicResource, Terrain, UnitType, WingType } from './types';

export interface TerrainRules {
  move: number; // movement points needed to enter
  defense: number; // defender bonus (reduces attacker damage)
  frontage: number; // regiments per side that can engage
  supply: number; // base supply capacity in regiments
  devCap: number; // soft development cap (can be exceeded by devOvercap at a higher cost)
  cav: number; // cavalry effectiveness modifier
  armour: number; // armour effectiveness modifier
  supplyProd: number; // food production multiplier
  devCost: number; // development cost multiplier
  popCap: number; // population capacity (thousands) at dev 1
  label: string;
}

export const TERRAIN: Record<Terrain, TerrainRules> = {
  plains: { move: 2, defense: 0, frontage: 16, supply: 10, devCap: 10, cav: 0.2, armour: 0.2, supplyProd: 1.2, devCost: 1.0, popCap: 70, label: 'Plains' },
  steppe: { move: 2, defense: 0, frontage: 20, supply: 7, devCap: 6, cav: 0.3, armour: 0.25, supplyProd: 0.8, devCost: 1.0, popCap: 40, label: 'Steppe' },
  forest: { move: 3, defense: 0.15, frontage: 10, supply: 7, devCap: 7, cav: -0.3, armour: -0.35, supplyProd: 0.9, devCost: 1.1, popCap: 45, label: 'Forest' },
  hills: { move: 3, defense: 0.25, frontage: 12, supply: 6, devCap: 8, cav: -0.15, armour: -0.2, supplyProd: 0.8, devCost: 1.2, popCap: 45, label: 'Hills' },
  marsh: { move: 4, defense: 0.2, frontage: 8, supply: 4, devCap: 5, cav: -0.4, armour: -0.5, supplyProd: 0.7, devCost: 1.3, popCap: 35, label: 'Marsh' },
  mountains: { move: 5, defense: 0.5, frontage: 6, supply: 3, devCap: 4, cav: -0.5, armour: -0.6, supplyProd: 0.5, devCost: 1.5, popCap: 20, label: 'Mountains' },
};

/** How a regiment fights: in the line, in support behind it (needs a screen), or as a breakthrough arm. */
export type UnitRole = 'line' | 'support' | 'breakthrough';

export interface UnitRules {
  label: string;
  plural: string;
  /** one-letter code for compact army summaries */
  abbr: string;
  role: UnitRole;
  /** technology that unlocks the unit (null = always available) */
  requires: string | null;
  cost: number; // crowns
  materiel: number; // equipment from industry
  /** strategic resources consumed when the regiment is raised */
  resources: Partial<Record<StrategicResource, number>>;
  weeks: number; // training time
  upkeep: number; // crowns / month at full strength
  supplyUse: number; // food / month at full strength
  /** strategic resources consumed per month at full strength (oil for armour; nitrates only at war) */
  burn: Partial<Record<StrategicResource, number>>;
  attack: number; // firepower per 1000 men
  morale: number; // morale damage multiplier dealt (shock)
  speed: number; // movement points per week
  siege: number; // siege contribution
  /** share of its men that pursue a beaten enemy */
  pursuit: number;
  description: string;
}

export const UNITS: Record<UnitType, UnitRules> = {
  infantry: {
    label: 'Infantry', plural: 'Infantry', abbr: 'I', role: 'line', requires: null,
    cost: 15, materiel: 10, resources: {}, weeks: 4, upkeep: 1.0, supplyUse: 0.5, burn: {},
    attack: 1.0, morale: 1.0, speed: 1.0, siege: 1, pursuit: 0,
    description: 'Riflemen. Hold ground, fill the frontage and screen the guns.',
  },
  cavalry: {
    label: 'Cavalry', plural: 'Cavalry', abbr: 'C', role: 'line', requires: null,
    cost: 30, materiel: 12, resources: {}, weeks: 6, upkeep: 1.6, supplyUse: 1.0, burn: {},
    attack: 1.1, morale: 1.5, speed: 1.5, siege: 0.5, pursuit: 0.1,
    description: 'Fast horsemen. Strong on open ground and in pursuit; machine guns make them costly.',
  },
  artillery: {
    label: 'Artillery', plural: 'Artillery', abbr: 'A', role: 'support', requires: null,
    cost: 30, materiel: 30, resources: { iron: 4, nitrates: 2 }, weeks: 8, upkeep: 2.0, supplyUse: 0.8, burn: { nitrates: 0.25 },
    attack: 1.7, morale: 1.2, speed: 0.8, siege: 4, pursuit: 0,
    description: 'Field and siege guns. Heavy firepower behind an infantry screen; shells need nitrates in war.',
  },
  engineers: {
    label: 'Engineers', plural: 'Engineers', abbr: 'E', role: 'support', requires: 'engineering_corps',
    cost: 25, materiel: 20, resources: { iron: 2 }, weeks: 6, upkeep: 1.4, supplyUse: 0.6, burn: {},
    attack: 0.6, morale: 0.8, speed: 1.0, siege: 3, pursuit: 0,
    description: 'Sappers and bridging trains. Their army digs in twice as fast, besieges faster and crosses rivers without penalty.',
  },
  armour: {
    label: 'Armour', plural: 'Armour', abbr: 'T', role: 'breakthrough', requires: 'tanks',
    cost: 50, materiel: 80, resources: { iron: 8, rubber: 3, oil: 2 }, weeks: 12, upkeep: 3.0, supplyUse: 0.4, burn: { oil: 0.6 },
    attack: 2.6, morale: 2.0, speed: 1.2, siege: 1.5, pursuit: 0.15,
    description: 'Tanks. Break entrenched lines and forts; poor in forest, marsh and mountains; run on oil.',
  },
};

export const UNIT_TYPES = Object.keys(UNITS) as UnitType[];

export interface ShipRules {
  label: string;
  plural: string;
  abbr: string;
  requires: string | null;
  cost: number;
  materiel: number;
  resources: Partial<Record<StrategicResource, number>>;
  weeks: number;
  upkeep: number;
  /** fuel per month at sea: coal-fired until Oil-Fired Boilers, oil after (submarines and carriers always oil) */
  fuel: number;
  oil: boolean;
  /** firepower against surface ships, torpedoes, anti-submarine, anti-aircraft and air strike */
  gun: number;
  torpedo: number;
  antiSub: number;
  aa: number;
  air: number;
  /** how much damage it takes to sink (and how big a target it is) */
  hull: number;
  /** zones per week */
  speed: number;
  /** regiments carried */
  capacity: number;
  description: string;
}

export const SHIPS: Record<ShipType, ShipRules> = {
  transport: {
    label: 'Transport', plural: 'Transports', abbr: 'Tr', requires: null,
    cost: 20, materiel: 15, resources: { iron: 2 }, weeks: 10, upkeep: 0.6, fuel: 0.1, oil: false,
    gun: 0, torpedo: 0, antiSub: 0, aa: 0, air: 0, hull: 2, speed: 1, capacity: 2,
    description: 'Carries two regiments across the sea. Defenceless: escort it.',
  },
  screen: {
    label: 'Torpedo boat', plural: 'Torpedo boats', abbr: 'Sc', requires: 'torpedo_boats',
    cost: 25, materiel: 20, resources: { iron: 3 }, weeks: 12, upkeep: 0.8, fuel: 0.15, oil: false,
    gun: 1, torpedo: 1, antiSub: 3, aa: 0.5, air: 0, hull: 2, speed: 2, capacity: 0,
    description: 'Screens (torpedo boats, later destroyers): hunt submarines and shield transports and carriers.',
  },
  cruiser: {
    label: 'Cruiser', plural: 'Cruisers', abbr: 'Cr', requires: null,
    cost: 45, materiel: 40, resources: { iron: 6 }, weeks: 20, upkeep: 1.5, fuel: 0.3, oil: false,
    gun: 3, torpedo: 0.5, antiSub: 1, aa: 1, air: 0, hull: 4, speed: 2, capacity: 0,
    description: 'Fast and versatile: patrols, blockades and escorts.',
  },
  capital: {
    label: 'Battleship', plural: 'Battleships', abbr: 'Bb', requires: null,
    cost: 90, materiel: 90, resources: { iron: 14 }, weeks: 36, upkeep: 3, fuel: 0.6, oil: false,
    gun: 8, torpedo: 0, antiSub: 0, aa: 2, air: 0, hull: 12, speed: 1.5, capacity: 0,
    description: 'Capital ships (ironclads, then dreadnoughts): the heaviest guns afloat, the decisive surface fight.',
  },
  submarine: {
    label: 'Submarine', plural: 'Submarines', abbr: 'Ss', requires: 'submarines',
    cost: 35, materiel: 30, resources: { iron: 4 }, weeks: 16, upkeep: 1, fuel: 0.15, oil: true,
    gun: 0.3, torpedo: 4, antiSub: 0, aa: 0, air: 0, hull: 2, speed: 1.5, capacity: 0,
    description: 'Unseen torpedoes against capital ships and transports; only screens and cruisers can hunt them. Blockades without holding the sea.',
  },
  carrier: {
    label: 'Carrier', plural: 'Carriers', abbr: 'Cv', requires: 'naval_aviation',
    cost: 100, materiel: 100, resources: { iron: 12, rubber: 2 }, weeks: 40, upkeep: 3.5, fuel: 0.5, oil: true,
    gun: 0.5, torpedo: 0, antiSub: 1, aa: 3, air: 6, hull: 9, speed: 1.5, capacity: 0,
    description: 'Strikes first from the air before the guns can reach; needs screens around it.',
  },
};
export const SHIP_TYPES = Object.keys(SHIPS) as ShipType[];

export interface WingRules {
  label: string;
  plural: string;
  abbr: string;
  requires: string;
  cost: number;
  materiel: number;
  resources: Partial<Record<StrategicResource, number>>;
  weeks: number;
  upkeep: number;
  /** oil per month */
  fuel: number;
  /** air combat, ground attack and bombing value at full strength */
  air: number;
  ground: number;
  bomb: number;
  /** range in province hops from its base */
  range: number;
  missions: Array<'superiority' | 'support' | 'interdiction' | 'bombing' | 'recon'>;
  description: string;
}

export const WINGS: Record<WingType, WingRules> = {
  recon: {
    label: 'Reconnaissance wing', plural: 'Reconnaissance wings', abbr: 'Re', requires: 'aviation',
    cost: 20, materiel: 15, resources: { rubber: 1 }, weeks: 6, upkeep: 0.6, fuel: 0.05,
    air: 0.5, ground: 0, bomb: 0, range: 3, missions: ['recon'],
    description: 'Spotters over the front: better fire for our armies, and screens find submarines in nearby waters.',
  },
  fighter: {
    label: 'Fighter wing', plural: 'Fighter wings', abbr: 'Fi', requires: 'fighters',
    cost: 30, materiel: 25, resources: { rubber: 1, iron: 1 }, weeks: 8, upkeep: 1, fuel: 0.15,
    air: 3, ground: 0.5, bomb: 0, range: 3, missions: ['superiority', 'support'],
    description: 'Wins the sky: holds air superiority, shoots down bombers and halves enemy ground support.',
  },
  attack: {
    label: 'Ground-attack wing', plural: 'Ground-attack wings', abbr: 'At', requires: 'ground_attack',
    cost: 35, materiel: 30, resources: { rubber: 1, iron: 2 }, weeks: 10, upkeep: 1.2, fuel: 0.2,
    air: 1, ground: 3, bomb: 0.5, range: 3, missions: ['support', 'interdiction'],
    description: 'Close support for battles, or interdiction of enemy supply and movement.',
  },
  bomber: {
    label: 'Bomber wing', plural: 'Bomber wings', abbr: 'Bo', requires: 'strategic_bombing',
    cost: 50, materiel: 45, resources: { rubber: 2, iron: 3 }, weeks: 14, upkeep: 1.8, fuel: 0.3,
    air: 0.8, ground: 1, bomb: 3, range: 5, missions: ['bombing', 'interdiction'],
    description: 'Strikes factories far behind the front; needs fighters to survive against defended skies.',
  },
};
export const WING_TYPES = Object.keys(WINGS) as WingType[];

/** Plural name of a regiment, ship or air wing type. */
export function forceLabel(kind: string): string {
  return (UNITS as Record<string, { plural: string }>)[kind]?.plural ?? (SHIPS as Record<string, { plural: string }>)[kind]?.plural ?? (WINGS as Record<string, { plural: string }>)[kind]?.plural ?? kind;
}
export const STRATEGIC: StrategicResource[] = ['coal', 'iron', 'oil', 'rubber', 'nitrates'];

export const RESOURCE_INFO: Record<StrategicResource | 'food', { label: string; price: number; use: string }> = {
  food: { label: 'Food', price: 1, use: 'Feeds armies on supply lines; deposits add 3 a month.' },
  coal: { label: 'Coal', price: 1.5, use: 'Fuels factories (0.6 a month per factory) and synthetic chemistry; without it factories run at 30%.' },
  iron: { label: 'Iron', price: 2, use: 'Steel for artillery, armour, factories, forts and railways.' },
  oil: { label: 'Oil', price: 3, use: 'Fuel for armour (and later fleets and aircraft).' },
  rubber: { label: 'Rubber', price: 3, use: 'Tyres and seals for armour and motor transport.' },
  nitrates: { label: 'Nitrates', price: 2.5, use: 'Shells for artillery in war; fertiliser.' },
};

export const C = {
  time: { weeksPerMonth: 4, monthsPerYear: 12 },
  regimentSize: 1000,

  economy: {
    goldPerDev: 0.8,
    goldPerPop: 0.012, // crowns / month per thousand people
    capitalBonus: 3,
    occupierShare: 0.3, // share of a province's crowns levied by an occupier
    supplyPerDev: 0.5,
    foodBonus: 3, // food deposit
    stockpileBase: 60,
    stockpilePerDev: 5,
    /** crowns each partner earns from a trade agreement's commerce, besides resource sales */
    tradeCommerce: 1,
    fundingCost: [0, 0.08, 0.18, 0.32] as const, // share of gross income
    fundingMul: [1, 1.4, 1.8, 2.2] as const,
    interestRate: 0.02, // monthly interest on debt
    creditMonths: 3, // debt beyond this many months of income triggers bankruptcy
    severeDebtMonths: 3,
    bankruptcyMonths: 24,
  },

  resources: {
    /** units / month from a deposit at full efficiency, plus depositPerDev per development */
    depositYield: { coal: 4, iron: 3, oil: 3, rubber: 3, nitrates: 3 } as Record<StrategicResource, number>,
    depositPerDev: 0.25,
    stockBase: 40, // stockpile cap per strategic resource
    stockPerDev: 3,
    startShare: 0.5, // starting stock as a share of the cap
    /** a realm keeps this share of its cap before selling, and buys up to this share */
    keepShare: 0.4,
  },

  industry: {
    coalPerFactory: 0.6, // coal / month per factory level
    unpowered: 0.3, // share of capacity a factory keeps without coal (water power, short shifts)
    materielPerIC: 4, // materiel / month per point of industrial capacity
    workshopPerDev: 0.15, // materiel / month per integrated dev (workshops without factories)
    materielBase: 80, // stockpile cap
    materielPerFactory: 40,
    goodsPerMateriel: 0.35, // crowns per unit of output sold when the materiel stockpile is full
    startMaterielShare: 0.6,
    reinforceMateriel: 0.5, // share of a regiment's materiel cost to replace 1,000 men
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
    fortIron: 5,
    infraIron: 4, // per level
    factoryBase: 80, // * (level + 1)
    factoryIron: 10,
    factoryWeeks: 20,
    factoryMax: 5,
    factoryMinIntegration: 50,
    portBase: 50, // * (level + 1)
    portIron: 4,
    portWeeks: 16,
    portMax: 3,
    airfieldBase: 40, // * (level + 1)
    airfieldIron: 3,
    airfieldWeeks: 12,
    airfieldMax: 2,
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
    /** an army with engineers digs in this many times faster */
    engineerEntrench: 2,
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
    riverBonus: 0.2, // defender, when every attacker crossed a river into the province
    maxDefense: 0.7,
    flankCavalryShare: 0.2,
    flankBonus: 0.15,
    artilleryScreen: 1, // support regiments need at least this many line regiments each
    unscreenedArtillery: 0.5,
    pursuitCap: 0.15,
    /** armour share of the line at which entrenchment and forts lose half their value */
    breakthroughShare: 0.3,
    breakthroughMax: 0.5,
    /** armour without fuel and artillery without shells fight at this share */
    unfuelled: 0.5,
    noShells: 0.6,
  },

  naval: {
    /** hit points removed per point of fire, before the target's hull */
    damage: 32,
    rounds: 3,
    /** a side withdraws once its fighting value falls below this share of its start */
    withdrawAt: 0.5,
    /** transports and carriers behind enough screens and cruisers are this much harder to hit */
    screened: 0.3,
    /** repair per week per port level, in a zone on the coast of our port */
    repair: 6,
    /** damage per week beyond this many zones from a friendly port */
    rangeZones: 4,
    attrition: 2,
    /** blockade: hostile power needed against our surface power (×) */
    blockadeRatio: 2,
    /** a blockaded province loses this share of its crowns */
    blockadeIncome: 0.25,
    /** attackers coming ashore fire at this share on the week they land */
    landing: 0.75,
    unfuelled: 0.6,
    startFleetPorts: 3,
  },

  air: {
    /** strength lost per week against enemy air power (scaled by the air balance) */
    combatLoss: 10,
    /** superiority: our air power at least this multiple of theirs */
    superiority: 1.5,
    /** ground support: + share of firepower per point of support (cap) */
    supportPer: 0.12,
    supportMax: 0.4,
    /** enemy superiority cuts our support and interdiction to this share */
    contested: 0.4,
    recon: 0.05,
    interdictSupply: 0.15,
    interdictSupplyMax: 0.4,
    interdictMove: 0.1,
    interdictMoveMax: 0.3,
    /** industry lost in a bombed province per point of bombing (cap) */
    bombIndustry: 0.25,
    bombIndustryMax: 0.6,
    /** anti-aircraft fire of forts: strength lost per week per fort level */
    flak: 2,
    replenish: 8,
    replenishMateriel: 0.3,
    wingsPerAirfield: 2,
  },

  siege: {
    noFortWeeks: 2, // progress 100 in this many weeks with no fort
    fortWeeksPerLevel: 10,
    artilleryBonus: 0.25, // per artillery regiment, max 6
    artilleryMax: 6,
    engineerBonus: 0.5, // per engineer regiment, max 2
    engineerMax: 2,
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
    exposureWeight: 0.15, // share of each open neighbour's strength counted against a war plan (beyond two open borders)
    secondFrontExhaustion: 25, // an AI at war and this exhausted refuses a call to a second front
  },

  /** player commands kept for bug-report replays before the log rolls over to a checkpoint */
  playerLogMax: 2000,
} as const;

/**
 * Save format. 1: first release. 2: records the map fingerprint (id, revision,
 * checksum) and embeds custom maps. 3: the industrial age (units, resources,
 * industry, research eras). Older saves are migrated (src/sim/migrate.ts).
 */
export const SCHEMA_VERSION = 3;
