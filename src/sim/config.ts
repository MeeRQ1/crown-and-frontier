// All tunable rule numbers. Formulas live in the modules; the numbers live here.
// Units: time in ticks (1 tick = 1 week, 4 weeks = 1 month, 12 months = 1 year),
// money in crowns (a treasury is a stock of crowns; income, upkeep and costs paid
// over time are crowns a month), supplies in wagons, manpower in men, population in
// units of 10,000 people (`population.peoplePerPop`).

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
  airborne: {
    label: 'Airborne', plural: 'Airborne', abbr: 'P', role: 'line', requires: 'airborne_forces',
    cost: 35, materiel: 18, resources: { rubber: 1 }, weeks: 10, upkeep: 1.6, supplyUse: 0.5, burn: {},
    attack: 1.1, morale: 1.3, speed: 1.0, siege: 0.8, pursuit: 0.05,
    description: 'Parachute infantry: picked, lightly armed troops. On the ground they fight like good infantry; from an airfield, transport wings can drop them on a province within reach, behind the front.',
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
  /** firepower against surface ships, torpedoes, anti-submarine and anti-aircraft */
  gun: number;
  torpedo: number;
  antiSub: number;
  aa: number;
  /** support for a land battle on the coast it lies off (shore bombardment) */
  bombard: number;
  /** attack on enemy sea trade passing through its zone (raiding), and protection of our own (escort) */
  raid: number;
  escort: number;
  /** how much damage it takes to sink (and how big a target it is) */
  hull: number;
  /** zones per week */
  speed: number;
  /** regiments carried */
  capacity: number;
  /** air wings it can carry and operate (carriers) */
  deck: number;
  /** what it is for, one line (interface) */
  role: string;
  description: string;
}

export const SHIPS: Record<ShipType, ShipRules> = {
  transport: {
    label: 'Transport', plural: 'Transports', abbr: 'Tr', requires: null,
    cost: 20, materiel: 15, resources: { iron: 2 }, weeks: 10, upkeep: 0.6, fuel: 0.1, oil: false,
    gun: 0, torpedo: 0, antiSub: 0, aa: 0, bombard: 0, raid: 0, escort: 0, hull: 2, speed: 1, capacity: 2, deck: 0,
    role: 'Carries armies by sea',
    description: 'Carries two regiments across the sea. Defenceless: escort it, and keep it out of reach of enemy submarines and aircraft.',
  },
  screen: {
    label: 'Torpedo boat', plural: 'Torpedo boats', abbr: 'Sc', requires: 'torpedo_boats',
    cost: 25, materiel: 20, resources: { iron: 3 }, weeks: 12, upkeep: 0.8, fuel: 0.15, oil: false,
    gun: 1, torpedo: 1, antiSub: 3, aa: 1, bombard: 0, raid: 0, escort: 2, hull: 2, speed: 2, capacity: 0, deck: 0,
    role: 'Escort: hunts submarines, shields convoys and carriers',
    description: 'Screens (torpedo boats, later destroyers): hunt submarines, shield transports and carriers in battle, guard sea trade from raiders and add anti-aircraft fire.',
  },
  cruiser: {
    label: 'Cruiser', plural: 'Cruisers', abbr: 'Cr', requires: null,
    cost: 45, materiel: 40, resources: { iron: 6 }, weeks: 20, upkeep: 1.5, fuel: 0.3, oil: false,
    gun: 3.5, torpedo: 0.5, antiSub: 1, aa: 1.5, bombard: 3.5, raid: 1.5, escort: 1.5, hull: 4, speed: 2, capacity: 0, deck: 0,
    role: 'Patrol, raiding, escort and light bombardment',
    description: 'Fast and versatile: patrols and blockades, raids enemy trade, escorts convoys and shells coasts.',
  },
  capital: {
    label: 'Battleship', plural: 'Battleships', abbr: 'Bb', requires: null,
    cost: 90, materiel: 90, resources: { iron: 14 }, weeks: 36, upkeep: 3, fuel: 0.6, oil: false,
    gun: 8, torpedo: 0, antiSub: 0, aa: 2, bombard: 8, raid: 0, escort: 0.5, hull: 12, speed: 1.5, capacity: 0, deck: 0,
    role: 'The decisive surface fight and heavy shore bombardment',
    description: 'Capital ships (ironclads, then dreadnoughts): the heaviest guns afloat, for the decisive surface fight and for shelling a coast our armies are fighting on. A prize target for torpedoes and aircraft.',
  },
  submarine: {
    label: 'Submarine', plural: 'Submarines', abbr: 'Ss', requires: 'submarines',
    cost: 35, materiel: 30, resources: { iron: 4 }, weeks: 16, upkeep: 1, fuel: 0.15, oil: true,
    gun: 0.3, torpedo: 4, antiSub: 0, aa: 0, bombard: 0, raid: 4, escort: 0, hull: 2, speed: 1.5, capacity: 0, deck: 0,
    role: 'Raids enemy sea trade; ambushes big ships',
    description: 'Raids enemy sea trade on the routes through its zone and torpedoes capital ships and transports. Only anti-submarine fire hurts it, and only patrols overhead let aircraft find it. Blockades at half weight.',
  },
  carrier: {
    label: 'Carrier', plural: 'Carriers', abbr: 'Cv', requires: 'naval_aviation',
    cost: 100, materiel: 100, resources: { iron: 12, rubber: 2 }, weeks: 40, upkeep: 3.5, fuel: 0.5, oil: true,
    gun: 0.5, torpedo: 0, antiSub: 1, aa: 3, bombard: 0, raid: 0, escort: 0, hull: 9, speed: 1.5, capacity: 0, deck: 2,
    role: 'Mobile air base: its aircraft fly from the fleet',
    description: 'A mobile airfield for two air wings (three with Fleet Carriers): fighters, ground-attack or reconnaissance aircraft fly their missions from wherever the carrier lies. Without aircraft aboard it strikes nothing. Needs screens around it.',
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
  /** air combat, ground attack, bombing and anti-ship value at full strength */
  air: number;
  ground: number;
  bomb: number;
  naval: number;
  /** range in steps over land and sea from its airfield or carrier (reach.ts) */
  range: number;
  missions: Array<'superiority' | 'support' | 'interdiction' | 'bombing' | 'naval' | 'recon'>;
  /** can fly from a carrier's deck */
  carrier: boolean;
  /** losses it suffers when intercepted or shot at, relative to the others */
  vulnerability: number;
  /** regiments it carries in an airborne operation (transports) */
  lift?: number;
  role: string;
  description: string;
}

export const WINGS: Record<WingType, WingRules> = {
  recon: {
    label: 'Reconnaissance wing', plural: 'Reconnaissance wings', abbr: 'Re', requires: 'aviation',
    cost: 20, materiel: 15, resources: { rubber: 1 }, weeks: 6, upkeep: 0.6, fuel: 0.05,
    air: 0.5, ground: 0, bomb: 0, naval: 0, range: 3, missions: ['recon'], carrier: true, vulnerability: 1,
    role: 'Spotting and maritime patrol',
    description: 'Spotters. Over land: our battles in the area fire 5% harder and our support and interdiction there strike 20% harder. Over the sea: our naval strikes always find their targets, and enemy submarines there lose their cover.',
  },
  fighter: {
    label: 'Fighter wing', plural: 'Fighter wings', abbr: 'Fi', requires: 'fighters',
    cost: 30, materiel: 25, resources: { rubber: 1, iron: 1 }, weeks: 8, upkeep: 1, fuel: 0.15,
    air: 3, ground: 0.5, bomb: 0, naval: 0, range: 3, missions: ['superiority', 'support'], carrier: true, vulnerability: 0.7,
    role: 'Air superiority, interception and escort',
    description: 'Wins the sky: intercepts enemy aircraft flying over its area, covers our own missions and fleets, and with superiority cuts what enemy aircraft achieve there. Weak in ground support.',
  },
  attack: {
    label: 'Ground-attack wing', plural: 'Ground-attack wings', abbr: 'At', requires: 'ground_attack',
    cost: 35, materiel: 30, resources: { rubber: 1, iron: 2 }, weeks: 10, upkeep: 1.2, fuel: 0.2,
    air: 1, ground: 3, bomb: 0.5, naval: 3, range: 3, missions: ['support', 'interdiction', 'naval'], carrier: true, vulnerability: 1.1,
    role: 'Close support, interdiction and naval strike',
    description: 'Dive and torpedo bombers: support one battle a week in its area, interdict enemy supply and movement, or strike ships at sea. Easy prey for fighters.',
  },
  bomber: {
    label: 'Bomber wing', plural: 'Bomber wings', abbr: 'Bo', requires: 'strategic_bombing',
    cost: 50, materiel: 45, resources: { rubber: 2, iron: 3 }, weeks: 14, upkeep: 1.8, fuel: 0.3,
    air: 0.8, ground: 1, bomb: 3, naval: 2, range: 5, missions: ['bombing', 'interdiction', 'naval'], carrier: false, vulnerability: 1.2,
    role: 'Strategic and logistics bombing; long-range naval strike',
    description: 'Long-range bombers: wreck factories, shipyards, ports and airfields far behind the front, interdict supply, or strike fleets at range. Too heavy for carriers; needs fighters to survive defended skies.',
  },
  transport: {
    label: 'Transport wing', plural: 'Transport wings', abbr: 'Tr', requires: 'airborne_forces',
    cost: 30, materiel: 20, resources: { rubber: 1, iron: 1 }, weeks: 8, upkeep: 0.8, fuel: 0.2,
    air: 0.2, ground: 0, bomb: 0, naval: 0, range: 4, missions: [], carrier: false, vulnerability: 1.5, lift: 1,
    role: 'Airborne operations',
    description: 'Transport aircraft: each carries one airborne regiment from its airfield to a province within range, through whatever fighters and anti-aircraft guns wait there. It flies no other mission.',
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
    goldPerPop: 0.03, // crowns / month per population unit (10,000 people)
    capitalBonus: 5, // the seat of government: courts, customs, the national bank

    occupierShare: 0.3, // share of a province's crowns levied by an occupier
    supplyPerDev: 0.5,
    foodBonus: 3, // food deposit
    stockpileBase: 60,
    stockpilePerDev: 5,
    /** commerce from a trade agreement: this share of the smaller partner's provincial taxes, a month */
    commerceShare: 0.04,
    /** all of a realm's commerce together is at most this share of its own provincial taxes */
    commerceCap: 0.25,
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

  /** forces at the start of a campaign, sized to each realm's means */
  start: {
    armyShare: 0.33, // of provincial taxes spent on the standing army
    upkeepPerRegiment: 1.2, // the average regiment's upkeep relative to infantry's
    reserveShare: 0.25, // at most this share of the reserve under arms
    minRegiments: 3, // where the reserve allows
    fleetShare: 0.12, // of provincial taxes spent on the home fleet
  },

  population: {
    growth: 0.0018, // monthly logistic growth rate
    occupationLoss: 0.002,
    /** people per population unit: a province of 40 holds 400,000 people */
    peoplePerPop: 10_000,
    /** men fit for service per population unit when fully integrated (5% of the people) */
    reservePerPop: 500,
    /** the pool of men ready to call up refills at this share of the reserve a month */
    regenMonths: 60,
    startPoolShare: 0.5,
    /** war dead leave the reserve; new cohorts make up this share of the losses a month */
    lossRecovery: 0.01,
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
    devBase: 14, // * dev * (1 + dev/5) * terrain multiplier
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
    /** anti-aircraft batteries (format 7): crowns × (level + 1), iron, weeks, levels; upkeep a month per level */
    flakBase: 20,
    flakIron: 2,
    flakWeeks: 6,
    flakMax: 3,
    flakUpkeep: 0.4,
    fortWeeks: 16,
    fortMax: 3,
    fortUpkeep: 0.6, // crowns / month per level
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
    /** anti-aircraft fire halves an air strike at this many points */
    aaScale: 20,
    /** by round: the guns of a fleet struck from the air this week with no air cover of its own (the enemy holds the sky over it) */
    outranged: [0.3, 0.6, 1] as number[],
    /** shore bombardment: + share of firepower per point (cap); coastal forts hit bombarding ships for this much hull a week per level */
    bombardPer: 0.02,
    bombardMax: 0.25,
    coastalGuns: 3,
    /** coastal forts fire at ships blockading their coast at this share of their fire at bombarding ships */
    blockadeFire: 0.5,
    /** air and naval fire support of a side together never exceeds this */
    supportCap: 0.5,
    /** raiding: share of sea trade lost per raid point in a zone on the route, after escorts (zone and route caps) */
    raidRate: 0.06,
    raidZoneMax: 0.4,
    raidRouteMax: 0.75,
    /** a fleet ordered to shell a coast province our armies besiege speeds the siege by this share per bombard point (cap) */
    siegePer: 0.04,
    siegeMax: 0.5,
    /** a fleet lying in harbour under orders repairs this much faster */
    harbourRepair: 1.5,
  },

  air: {
    /** strength lost per week when intercepted: × enemy fighter power ÷ (theirs + our cover + 0.5) × vulnerability */
    combatLoss: 10,
    /** superiority: our air power at least this multiple of theirs */
    superiority: 1.5,
    /** what missions achieve in skies the enemy holds, and in contested skies */
    contested: 0.4,
    disputed: 0.75,
    /** ground support: + share of firepower per point of ground value (cap); one battle per wing a week */
    supportPer: 0.12,
    supportMax: 0.4,
    /** reconnaissance over a battle, and its boost to support and interdiction in its area */
    recon: 0.05,
    reconBoost: 0.2,
    interdictSupply: 0.15,
    interdictSupplyMax: 0.4,
    interdictMove: 0.1,
    interdictMoveMax: 0.3,
    /** industry lost in a bombed province per point of bombing (cap) */
    bombIndustry: 0.25,
    bombIndustryMax: 0.6,
    /** a port under this much bombing builds no ships and repairs at half rate; wings at a bombed airfield lose readiness per point */
    bombPort: 1,
    bombAirfield: 12,
    /** anti-aircraft fire of forts: strength lost per week per fort level (bombing and interdiction) */
    flak: 2,
    /** ground fire over a supported battle: strength lost per week */
    groundFire: 1.5,
    /** naval strike: hull damage per point (× 32 ÷ hull, like gunfire); chance to find ships without a patrol overhead */
    navalStrike: 4,
    detect: 0.6,
    /** strike wings lose this much strength per point of the target's anti-aircraft fire (cap) */
    aaLoss: 0.5,
    aaLossMax: 20,
    /** readiness: worn by each week flown, restored by rest (×(1 − readiness)); missions need this much */
    wear: 10,
    recover: 25,
    minReady: 25,
    /** readiness lost by rebasing */
    rebase: 30,
    replenish: 8,
    replenishMateriel: 0.3,
    wingsPerAirfield: 2,
    /** a carrier below this hull condition cannot operate aircraft */
    deckHull: 40,
    /**
     * anti-aircraft defence of a province (format 7): its batteries (0–3) plus mobile guns of
     * the defenders' artillery there (Air Defence: half a level a regiment, at most 1.5), at
     * most `aaMax` in all. Enemy aircraft flying over it lose `aaPer` strength a week per level
     * and achieve `aaEffect` less per level; an airborne drop loses `dropAA` of its men per level.
     */
    aaPer: 1.5,
    aaEffect: 0.08,
    aaMax: 4,
    mobileAA: 0.5,
    mobileAAMax: 1.5,
    /** airborne drops: men lost by who holds the sky over the target (theirs, contested) and per AA level; cap */
    dropIntercept: 0.3,
    dropDisputed: 0.12,
    dropAA: 0.05,
    dropLossMax: 0.5,
    /** landed troops fight at this share the week they land; transports lose this much readiness */
    dropLanding: 0.7,
    dropWear: 30,
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
    envoyCost: 1.5, // crowns / month for a realm of middling means; scaled by its taxes (economy.envoyCost)
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
    rivalBidCap: 20, // most opinion a diplomatic front-runner loses to rivals' wariness
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

  /** influence and spheres (src/sim/influence.ts) */
  influence: {
    envoy: 1.5, // a month for an envoy at their court, times the size factor (0.5–2)
    trade: 0.5, // a month for the larger economy of a trade agreement
    loan: 1, // a month while a loan is outstanding
    loanGrant: 5, // on lending: 5 per month of the borrower's income lent
    loanGrantCap: 20,
    guarantee: 0.75,
    alliance: 0.3, // for the stronger partner
    blocLeader: 0.5,
    decay: 0.5, // a month, always
    warDecay: 3, // a month while at war with them
    sphere: 40, // influence that draws a smaller realm into one's sphere
    sphereRatio: 1.25, // ...and this many times any rival's influence there
    sphereOpinion: 15,
    settlement: 40, // from a settlement's sphere demand
    victory: 2, // diplomatic influence (victory) per sphere member
  },

  guarantee: {
    base: 1, // guarantees a realm may give (plus modifiers)
    opinion: 15,
    trustLoss: 10, // for refusing to defend a realm we guarantee
    revokeOpinion: -15,
  },

  loan: {
    min: 50,
    months: 24,
    interest: 0.2,
    opinion: 10,
  },

  /** trade contracts (format 5): every good that changes hands moves under one */
  trade: {
    /** units a month a single contract may carry */
    minQty: 1,
    maxQty: 40,
    /** contract prices, as multiples of the list price */
    priceMin: 0.7,
    priceMax: 1.6,
    /** lengths of term on offer, in months */
    terms: [6, 12, 24] as readonly number[],
    /** contracts one realm may hold at once (as buyer and seller together) */
    maxContracts: 10,
    /** months from shipment to delivery by sea (overland: 0) */
    seaLag: 1,
    /** ending a contract early: the canceller pays this many months of its value */
    cancelFeeMonths: 1,
    cancelTrust: 3,
    cancelOpinion: -10,
    /** consecutive settlements short (seller) or unable to pay (buyer) that end a contract */
    missLimit: 2,
    defaultTrust: 5,
    defaultOpinion: -15,
    /** a completed contract leaves goodwill on both sides */
    keptOpinion: 4,
    /** dependence: a partner supplying this share of a resource is a reason for closer ties */
    dependence: 0.25,
    /** AI: months of forecast looked ahead when deciding to buy */
    lookahead: 6,
  },

  bloc: {
    cost: 50,
    maxMembers: 6,
    buyDiscount: 0.2, // the contract price members offer each other, below list
    commerceBonus: 0.5, // commerce from a trade agreement inside the bloc
    opinion: 5,
  },

  settlement: {
    reparationsMonths: 60,
    disarmMonths: 60,
    renounceMonths: 120,
    disarmShare: 0.5,
    disarmMin: 3,
    disarmCost: 12,
    renounceCost: 5,
    sphereCost: 15,
    reparationsCost: 80, // war-score points per share of income (10% → 8)
    claimDiscount: 0.8, // a province we hold a claim on costs this much
    allyWeight: 0.6, // a leader weighs demands on its allies at this share
    resent: 0.5, // a winner given less than half its fair share resents its leader
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
    /** every map's economic share is multiplied by this: focus trees develop every realm, so a leader's share runs lower (Stage E) */
    economicScale: 0.8,
    economicUnrest: 25,
    economicMonths: 60,
    streakDecay: 6,
    /** falling short of the main measure by at most this share (influence, development), with every other condition met, pauses a timer instead of winding it back (Stage E) */
    nearMiss: 0.9,
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
    /** an overseas war needs transports afloat for this many regiments, and a sea route of at most this many zones */
    overseasLift: 6,
    overseasZones: 4,
    openingMonths: 18, // AI realms start no offensive wars during the opening
    exposureWeight: 0.15, // share of each open neighbour's strength counted against a war plan (beyond two open borders)
    secondFrontExhaustion: 25, // an AI at war and this exhausted refuses a call to a second front
    advanceRange: 40, // an army with no objective marches toward an attack objective at most this far (movement cost) to join the war
  },

  /** player commands kept for bug-report replays before the log rolls over to a checkpoint */
  playerLogMax: 2000,
} as const;

/**
 * Save format. 1: first release. 2: records the map fingerprint (id, revision,
 * checksum) and embeds custom maps. 3: the industrial age (units, resources,
 * industry, research eras). 4: national focus replaces policies; peace settlements,
 * guarantees, influence, loans and trade blocs. Older saves are migrated
 * (src/sim/migrate.ts).
 */
export const SCHEMA_VERSION = 8;
