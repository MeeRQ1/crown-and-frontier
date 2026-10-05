// National focus trees (replacing the six national policies of earlier
// versions). Every realm has the same generic tree in five branches, plus a
// national branch made for it from its own map (src/sim/focus.ts): claims on
// the regions next to it, its home region, its deposits, its coast, and an
// ambition that follows its victory path. A realm works on one focus at a
// time; a finished focus is permanent.

import type { ModEffects } from '../modifiers';
import type { ProvinceId, ResourceKind, StrategicResource } from '../types';

export type FocusBranch = 'industry' | 'army' | 'sea' | 'diplomacy' | 'state' | 'national';

/** Situations a focus serves (the AI weighs them; the interface shows them). */
export type FocusTag = 'economy' | 'industry' | 'war' | 'defence' | 'navy' | 'air' | 'diplomacy' | 'admin' | 'research' | 'expansion' | 'trade';

/** One-off rewards granted when a focus is completed. */
export interface FocusReward {
  crowns?: number;
  materiel?: number;
  /** research points added to the current or banked research */
  research?: number;
  stock?: Partial<Record<StrategicResource, number>>;
  /** +1 factory in this many of the realm's best provinces (where there is room) */
  factories?: number;
  /** +1 railway level in this many of the realm's most developed provinces */
  infra?: number;
  /** +1 development in up to this many provinces of `devRegion` (default: the capital's region) */
  dev?: number;
  devRegion?: string;
  /** claims on every province of this region owned by another realm */
  claimRegion?: string;
  /** claims on this many of the most developed foreign provinces bordering ours */
  claimBorder?: number;
  /** +1 port level at the best coastal province */
  port?: boolean;
  /** +1 airfield level at the capital (or the best province) */
  airfield?: boolean;
  trust?: number;
}

export interface FocusDef {
  id: string;
  name: string;
  branch: FocusBranch;
  /** months of work */
  months: number;
  /** every one of these must be done */
  requires: string[];
  /** at least one of these must be done */
  requiresAny?: string[];
  /** cannot be taken once any of these is done or under way */
  excludes?: string[];
  /** not before this year */
  year?: number;
  /** only for realms with a coast */
  coastal?: boolean;
  effects: ModEffects;
  reward?: FocusReward;
  /** wars may be declared only over claims while this focus is held */
  claimsOnly?: boolean;
  description: string;
  /** layout in its branch: column and row */
  col: number;
  row: number;
  tags: FocusTag[];
  /** national focuses: the template it was made from */
  template?: string;
  /** national claim focuses: the provinces of the region at the start (for display) */
  provinces?: ProvinceId[];
}

export const FOCUS_BRANCHES: Record<FocusBranch, { name: string; blurb: string }> = {
  national: { name: 'National', blurb: 'This realm’s own ambitions: claims, its home region, its resources and its destiny.' },
  industry: { name: 'Industry', blurb: 'Railways, mines, heavy industry and the shape of the economy.' },
  army: { name: 'Army', blurb: 'Manpower, doctrine and the conduct of land war.' },
  sea: { name: 'Sea and air', blurb: 'Fleets, marines and the new air arm.' },
  diplomacy: { name: 'Diplomacy', blurb: 'Envoys, trade, banking, guarantees and spheres of influence.' },
  state: { name: 'State', blurb: 'Administration, research and the life of the nation.' },
};

const f = (d: Omit<FocusDef, 'requires'> & { requires?: string[] }): FocusDef => ({ requires: [], ...d });

export const GENERIC_FOCUSES: FocusDef[] = [
  // ── Industry ──────────────────────────────────────────────────────────────
  f({ id: 'ind_rail', name: 'National Railways', branch: 'industry', months: 9, col: 1, row: 0, tags: ['industry', 'admin'],
    effects: { infraCost: -0.2, supplyCap: 0.1 }, reward: { infra: 3 },
    description: 'A state railway board lays trunk lines between the great towns.' }),
  f({ id: 'ind_mines', name: 'Mining Concessions', branch: 'industry', months: 10, col: 0, row: 1, requires: ['ind_rail'], tags: ['industry'],
    effects: { resourceOutput: 0.15 }, reward: { stock: { coal: 25, iron: 25 } },
    description: 'Concessions to mining companies open new pits and wells.' }),
  f({ id: 'ind_heavy', name: 'Heavy Industry', branch: 'industry', months: 12, col: 2, row: 1, requires: ['ind_rail'], tags: ['industry'],
    effects: { industry: 0.1, factoryCost: -0.1 }, reward: { factories: 2 },
    description: 'Ironworks and engineering shops on the coalfields.' }),
  f({ id: 'ind_chem', name: 'Chemical Works', branch: 'industry', months: 12, col: 0, row: 2, requires: ['ind_mines'], year: 1895, tags: ['industry'],
    effects: { nitratesOutput: 0.25, oilOutput: 0.15, rubberOutput: 0.15 },
    description: 'Dyes, explosives and refined oil from new works on the rivers.' }),
  f({ id: 'ind_steel', name: 'Steel Programme', branch: 'industry', months: 12, col: 2, row: 2, requires: ['ind_heavy'], year: 1890, tags: ['industry', 'war'],
    effects: { industry: 0.1, materielCost: -0.05 }, reward: { factories: 2 },
    description: 'Open-hearth furnaces and rolling mills for rails, plate and guns.' }),
  f({ id: 'ind_motor', name: 'Motor Industry', branch: 'industry', months: 12, col: 0, row: 3, requires: ['ind_chem'], year: 1912, tags: ['industry', 'war'],
    effects: { oilOutput: 0.2, armourCost: -0.1, moveSpeed: 0.05 },
    description: 'Lorries, tractors and engines from the new motor works.' }),
  f({ id: 'ind_consumer', name: 'Consumer Goods', branch: 'industry', months: 12, col: 1, row: 3, requires: ['ind_steel'], excludes: ['ind_war'], tags: ['economy'],
    effects: { income: 0.1, popGrowth: 0.1, unrest: -2 },
    description: 'Factories turn to cloth, bicycles and sewing machines for the home market.' }),
  f({ id: 'ind_war', name: 'War Economy', branch: 'industry', months: 12, col: 2, row: 3, requires: ['ind_steel'], excludes: ['ind_consumer'], tags: ['war', 'industry'],
    effects: { industry: 0.15, materielCost: -0.1, income: -0.05, unrest: 2 },
    description: 'The state directs the works to arms, shells and rolling stock.' }),

  // ── Army ──────────────────────────────────────────────────────────────────
  f({ id: 'army_staff', name: 'General Staff', branch: 'army', months: 9, col: 1, row: 0, tags: ['war', 'defence'],
    effects: { attack: 0.05, reinforce: 0.1 },
    description: 'A permanent staff plans mobilisation and campaigns in peacetime.' }),
  f({ id: 'army_levy', name: 'Martial Levy', branch: 'army', months: 10, col: 0, row: 1, requires: ['army_staff'], excludes: ['army_prof'], tags: ['war'],
    effects: { manpower: 0.25, manpowerRegen: 0.25, recruitCost: -0.15, income: -0.05, unrest: 2 },
    description: 'Universal service fills the reserve; the treasury and the towns pay for it.' }),
  f({ id: 'army_prof', name: 'Professional Army', branch: 'army', months: 10, col: 2, row: 1, requires: ['army_staff'], excludes: ['army_levy'], tags: ['war', 'economy'],
    effects: { attack: 0.05, moraleRecovery: 0.15, upkeep: -0.1 },
    description: 'Long-service regulars: fewer men, better trained and cheaper to keep.' }),
  f({ id: 'army_fortress', name: 'Fortress Doctrine', branch: 'army', months: 10, col: 0, row: 2, requires: ['army_staff'], excludes: ['army_offensive'], tags: ['defence'],
    effects: { fortCost: -0.25, fortUpkeep: -0.5, entrench: 0.5, defense: 0.1, moveSpeed: -0.05 },
    description: 'Ring fortresses and prepared lines hold the frontier.' }),
  f({ id: 'army_offensive', name: 'Spirit of the Offensive', branch: 'army', months: 10, col: 2, row: 2, requires: ['army_staff'], excludes: ['army_fortress'], tags: ['war', 'expansion'],
    effects: { attack: 0.1, moraleRecovery: 0.1, defense: -0.05 },
    description: 'The attack is everything: élan, bayonets and speed.' }),
  f({ id: 'army_guns', name: 'Artillery Parks', branch: 'army', months: 10, col: 0, row: 3, requiresAny: ['army_fortress', 'army_offensive'], year: 1895, tags: ['war', 'defence'],
    effects: { artilleryAttack: 0.15, artilleryCost: -0.1 },
    description: 'Heavy batteries and shell depots behind every corps.' }),
  f({ id: 'army_mobile', name: 'Mobile Warfare', branch: 'army', months: 12, col: 2, row: 3, requiresAny: ['army_fortress', 'army_offensive'], year: 1914, tags: ['war', 'expansion'],
    effects: { armourAttack: 0.15, cavalryAttack: 0.1, moveSpeed: 0.05 },
    description: 'Armoured cars, motorised infantry and cavalry used for the breakthrough.' }),
  f({ id: 'army_mobilisation', name: 'General Mobilisation', branch: 'army', months: 12, col: 1, row: 4, requiresAny: ['army_guns', 'army_mobile'], year: 1905, tags: ['war', 'defence'],
    effects: { manpower: 0.15, reinforce: 0.15, warExhaustion: -0.15 },
    description: 'Railway timetables and reserve depots put the nation under arms in days.' }),

  // ── Sea and air ───────────────────────────────────────────────────────────
  f({ id: 'sea_navy', name: 'Naval Programme', branch: 'sea', months: 9, col: 0, row: 0, coastal: true, tags: ['navy'],
    effects: { shipCost: -0.1, portCost: -0.2 }, reward: { port: true },
    description: 'A navy law funds slipways, docks and a building programme.' }),
  f({ id: 'sea_battle', name: 'Battle Fleet', branch: 'sea', months: 12, col: 0, row: 1, requires: ['sea_navy'], excludes: ['sea_raid'], coastal: true, tags: ['navy', 'war'],
    effects: { capitalAttack: 0.15, navalAttack: 0.05 },
    description: 'Big guns in line of battle: command of the sea by decisive action.' }),
  f({ id: 'sea_raid', name: 'Cruiser Warfare', branch: 'sea', months: 10, col: 1, row: 1, requires: ['sea_navy'], excludes: ['sea_battle'], coastal: true, tags: ['navy', 'trade'],
    effects: { fleetSpeed: 0.15, blockadeResist: 0.15, antiSub: 0.15 },
    description: 'Fast cruisers to guard our trade and to prey on theirs.' }),
  f({ id: 'sea_marines', name: 'Marine Corps', branch: 'sea', months: 10, col: 0, row: 2, requiresAny: ['sea_battle', 'sea_raid'], year: 1895, coastal: true, tags: ['navy', 'expansion'],
    effects: { landing: 0.25, repair: 0.2 },
    description: 'Troops trained to land on a hostile shore, and dockyards to repair the fleet.' }),
  f({ id: 'air_corps', name: 'Air Corps', branch: 'sea', months: 9, col: 2, row: 0, year: 1908, tags: ['air'],
    effects: { airAttack: 0.1, airRange: 1 }, reward: { airfield: true },
    description: 'An air battalion with its own airfield, pilots and workshops.' }),
  f({ id: 'air_doctrine', name: 'Strategic Air Doctrine', branch: 'sea', months: 12, col: 2, row: 1, requires: ['air_corps'], year: 1915, tags: ['air', 'war'],
    effects: { airAttack: 0.1, airDefence: 0.15 },
    description: 'Air power as a weapon of its own: fighters for the sky, bombers for the factories.' }),
  f({ id: 'air_naval', name: 'Naval Aviation', branch: 'sea', months: 10, col: 1, row: 2, requires: ['air_corps', 'sea_navy'], year: 1916, coastal: true, tags: ['air', 'navy'],
    effects: { carrierAir: 0.2, navalAttack: 0.05 },
    description: 'Seaplanes and carriers scout and strike for the fleet.' }),

  // ── Diplomacy ─────────────────────────────────────────────────────────────
  f({ id: 'dip_service', name: 'Diplomatic Service', branch: 'diplomacy', months: 9, col: 1, row: 0, tags: ['diplomacy'],
    effects: { envoys: 1, relationGain: 0.25 },
    description: 'A foreign ministry with embassies in every capital.' }),
  f({ id: 'dip_charter', name: 'Mercantile Charter', branch: 'diplomacy', months: 10, col: 0, row: 1, requires: ['dip_service'], tags: ['trade', 'economy'],
    effects: { income: 0.1, trade: 0.25, manpowerRegen: -0.1 },
    description: 'Chartered trading houses and low duties: commerce first.' }),
  f({ id: 'dip_concord', name: 'Concord of Nations', branch: 'diplomacy', months: 10, col: 1, row: 1, requires: ['dip_service'], excludes: ['dip_real'], claimsOnly: true, tags: ['diplomacy'],
    effects: { relationGain: 0.5, alarmDecay: 0.5, alarmGen: -0.25, influenceGain: 0.25, warExhaustion: 0.25 },
    description: 'Arbitration and congresses instead of war. Wars only over claims while it is held.' }),
  f({ id: 'dip_real', name: 'Realpolitik', branch: 'diplomacy', months: 10, col: 2, row: 1, requires: ['dip_service'], excludes: ['dip_concord'], tags: ['expansion'],
    effects: { claimCost: -0.5, alarmDecay: 0.25, opinion: -5 },
    description: 'Interest, not sentiment: claims are prepared quietly and pressed when the moment comes.' }),
  f({ id: 'dip_bank', name: 'Overseas Banking', branch: 'diplomacy', months: 10, col: 0, row: 2, requires: ['dip_charter'], tags: ['trade', 'diplomacy'],
    effects: { influenceGain: 0.25, trade: 0.1 }, reward: { crowns: 150 },
    description: 'Banks that lend abroad buy friends and influence with every loan.' }),
  f({ id: 'dip_guarantor', name: 'Guarantor of the Balance', branch: 'diplomacy', months: 10, col: 1, row: 2, requires: ['dip_service'], tags: ['diplomacy', 'defence'],
    effects: { guarantees: 1, trustGain: 0.5 }, reward: { trust: 5 },
    description: 'We stand behind the independence of smaller realms.' }),
  f({ id: 'dip_sphere', name: 'Sphere of Influence', branch: 'diplomacy', months: 12, col: 1, row: 3, requiresAny: ['dip_bank', 'dip_guarantor'], year: 1890, tags: ['diplomacy'],
    effects: { influenceGain: 0.5, envoys: 1 },
    description: 'Advisers, loans and railway concessions bind our neighbours to us.' }),

  // ── State ─────────────────────────────────────────────────────────────────
  f({ id: 'state_academy', name: 'Royal Academy', branch: 'state', months: 10, col: 0, row: 0, tags: ['research'],
    effects: { research: 0.2, upkeep: 0.05 },
    description: 'Endowed chairs, laboratories and prizes for invention.' }),
  f({ id: 'state_frontier', name: 'Frontier Settlement', branch: 'state', months: 10, col: 2, row: 0, tags: ['admin', 'expansion'],
    effects: { integration: 0.3, settleCost: -0.25, adminCapacity: 2 },
    description: 'Land grants, schools and magistrates for the new provinces.' }),
  f({ id: 'state_univ', name: 'Technical Universities', branch: 'state', months: 12, col: 0, row: 1, requires: ['state_academy'], year: 1885, tags: ['research', 'industry'],
    effects: { research: 0.15, factoryCost: -0.05 },
    description: 'Polytechnics train the engineers and chemists industry needs.' }),
  f({ id: 'state_civil', name: 'Civil Service', branch: 'state', months: 10, col: 1, row: 1, requiresAny: ['state_academy', 'state_frontier'], tags: ['admin'],
    effects: { adminCapacity: 2, integration: 0.2, unrest: -2 },
    description: 'Examinations, pensions and a career open to talent.' }),
  f({ id: 'state_welfare', name: 'Social Insurance', branch: 'state', months: 12, col: 1, row: 2, requires: ['state_civil'], year: 1890, tags: ['economy', 'admin'],
    effects: { unrest: -3, popGrowth: 0.1, manpowerRegen: 0.1 },
    description: 'Sickness, accident and old-age insurance for the working classes.' }),
  f({ id: 'state_press', name: 'National Press', branch: 'state', months: 10, col: 2, row: 2, requires: ['state_civil'], year: 1895, tags: ['war', 'admin'],
    effects: { warExhaustion: -0.2, moraleRecovery: 0.05 },
    description: 'Cheap newspapers carry the government’s case into every home.' }),
  f({ id: 'state_planning', name: 'Planning Bureau', branch: 'state', months: 12, col: 1, row: 3, requiresAny: ['state_univ', 'state_welfare'], year: 1912, tags: ['industry', 'research', 'admin'],
    effects: { industry: 0.05, research: 0.1, adminCapacity: 1 },
    description: 'Statisticians and engineers plan investment across the realm.' }),
];

/**
 * The national policy a save of format 3 or earlier held, and the focuses it
 * becomes when the save is converted (with the focuses they require).
 */
export const POLICY_TO_FOCUS: Record<string, string[]> = {
  commerce: ['dip_service', 'dip_charter'],
  levy: ['army_staff', 'army_levy'],
  frontier: ['state_frontier'],
  academy: ['state_academy'],
  fortress: ['army_staff', 'army_fortress'],
  concord: ['dip_service', 'dip_concord'],
};

/**
 * Names and descriptions for the national focuses of the realms on the
 * hand-made maps (by template key). Realms elsewhere, including those on maps
 * from the editor, get names made from their realm and region names.
 */
export type NationalNames = Partial<Record<'heritage' | 'develop' | 'resource' | 'sea' | 'ambition', [string, string]>> & {
  /** the deposit the resource focus develops (default: the realm's most common strategic deposit) */
  res?: ResourceKind;
};

const FICTIONAL: Record<string, NationalNames> = {
  aur: {
    res: 'nitrates',
    heritage: ['The Aurelian Crown', 'The oldest crown of the Heartland: bankers, guilds and a court that trades with all.'],
    develop: ['Heartland Improvement Acts', 'Canals, drained fields and paved roads across the Aurelian Heartland.'],
    resource: ['Gulf Saltpetre Works', 'Saltpetre beds on the Gulf Shore supply half the powder mills of the world.'],
    sea: ['The Aurelian Squadron', 'A modern squadron to keep the Gulf open to Aurelian shipping.'],
    ambition: ['Aurelian Prosperity', 'The richest realm in the world, and the most stable.'],
  },
  vos: {
    res: 'iron',
    heritage: ['March of the Vosts', 'A margraviate raised to guard the frontier; its army is its state.'],
    develop: ['Vostic Ironworks', 'Blast furnaces in the March, fed by Uplands ore.'],
    resource: ['Uplands Ore Fields', 'Deep iron mines in the Vostic Uplands.'],
    sea: ['Grey Coast Flotilla', 'Torpedo boats and cruisers based on the Grey Coast.'],
    ambition: ['Greater Vostmark', 'Every Vostic-speaking valley under the margrave’s banner.'],
  },
  ser: {
    res: 'nitrates',
    heritage: ['The Serene Republic', 'Merchant patricians and a fleet that has kept the League free for centuries.'],
    develop: ['Serrevale Canal', 'A ship canal from the coast to the vale.'],
    resource: ['League Saltpetre', 'Nitrate concessions along the Serene Coast.'],
    sea: ['The League Fleet', 'The galleys are gone; the League builds ironclads.'],
    ambition: ['Concert of the Serene League', 'The League as the arbiter of the southern seas.'],
  },
  cal: {
    res: 'coal',
    heritage: ['The Calder Constitution', 'Cantons, citizen militias and the right to bear arms.'],
    develop: ['Lakelands Reclamation', 'Draining the marshes of the Lakelands for farms and towns.'],
    resource: ['Upland Collieries', 'Coal seams under the Calder Uplands.'],
    sea: ['Calder Alpine Railways', 'Tunnels and viaducts through the Uplands.'],
    ambition: ['Calder Prosperity', 'A republic of farmers, watchmakers and bankers.'],
  },
  ist: {
    res: 'iron',
    heritage: ['Ducal Istrel', 'Mountain fortresses and a duke who never forgets a slight.'],
    develop: ['Littoral Harbours', 'Breakwaters and quays along the Istrel Littoral.'],
    resource: ['Highland Mines', 'Coal and iron in the Istrel Highlands.'],
    sea: ['Littoral Squadron', 'Coast defence ships to guard the harbours.'],
    ambition: ['Istrian Prosperity', 'Wealth and peace behind the mountain wall.'],
  },
  dre: {
    heritage: ['Drevish Freeholds', 'Foresters and ferrymen who take their chances where they find them.'],
    develop: ['Drevish Timber Trade', 'Sawmills and rafting along the Drevna.'],
    resource: ['Tarnlands Coal', 'Coal pits in the Tarnlands.'],
    sea: ['Drevna River Flotilla', 'Monitors and gunboats on the Drevna mouth.'],
    ambition: ['Greater Drevenholt', 'Every forest from the Wolds to the sea.'],
  },
  mor: {
    heritage: ['Morvish Kingship', 'Warrior kings from the hills, crowned on the field.'],
    develop: ['Emberlin Foundries', 'Foundries and arsenals in the Emberlin Marches.'],
    resource: ['Morvish Coalfield', 'The richest coal seams in the world.'],
    sea: ['Morvish Military Railways', 'Strategic lines to move the army to any frontier.'],
    ambition: ['Greater Morvaine', 'The crossings and the hills: a kingdom from sea to steppe.'],
  },
  fen: {
    res: 'rubber',
    heritage: ['The Fenward Compact', 'Free towns bound by a compact older than any crown.'],
    develop: ['Fen Drainage Board', 'Windmills and dykes reclaim the Fens.'],
    resource: ['Fen Rubber and Oil', 'Plantations and the first oil wells in the Fens.'],
    sea: ['Compact Merchant Marine', 'Steamships and convoys for the Compact’s trade.'],
    ambition: ['Concert of the Compact', 'The Fenward towns as the bankers and brokers of every court.'],
  },
  tar: {
    heritage: ['The Khaganate', 'Horse lords of the steppe, swift to strike and swift to leave.'],
    develop: ['Steppe Caravan Routes', 'Wells and caravanserais across the Tarsk Steppe.'],
    resource: ['Khesh Oil Wells', 'Oil seeping from the Khesh Hills.'],
    sea: ['Ember Coast Flotilla', 'A flotilla to guard the Ember Coast.'],
    ambition: ['Khagan of the Steppes', 'Every grassland under the white banner.'],
  },
  car: {
    heritage: ['The Clanholds', 'Clans of the Glens who answer to no king.'],
    develop: ['Highland Roads', 'Military roads and bridges through the Glens.'],
    resource: ['Firth Collieries', 'Coal under the Carrow Firths.'],
    sea: ['Firth Fishing Fleet', 'Steam trawlers and the sailors who man them.'],
    ambition: ['Carrow Prosperity', 'Wool, whisky and coal for the world.'],
  },
  hra: {
    heritage: ['Jarls of the Hrafn', 'Sea-kings of the peninsula: the strait is their road.'],
    develop: ['Hrafn Harbours', 'Deep harbours on the Hrafn Peninsula.'],
    resource: ['Drevna Mouth Coal', 'Coal from the pits at the mouth of the Drevna.'],
    sea: ['The Jarl’s Fleet', 'Fast warships to rule the straits.'],
    ambition: ['Hrafn Sea Empire', 'Every coast within a day’s sail.'],
  },
  sol: {
    heritage: ['Princes of Solmarre', 'A small principality that has survived by its wits.'],
    develop: ['Solmarre Ironworks', 'Ironworks on the Solmarre coal.'],
    resource: ['Solmarre Coal and Iron', 'Coal and iron side by side in the hills.'],
    sea: ['Solmarre Coastal Guard', 'A squadron to keep Solmarre’s waters neutral.'],
    ambition: ['Concert of Solmarre', 'The meeting place of every congress.'],
  },
  les: {
    heritage: ['The Lessian Exchange', 'Grain merchants of the Aldwater; Lessia’s exchange sets the price of bread.'],
    develop: ['Aldwater Navigation', 'Locks and canals on the Upper Aldwater.'],
    resource: ['Lessian Collieries', 'Coal for the mills of the vale.'],
    sea: ['Delta Squadron', 'A squadron to guard the Aldwater Delta.'],
    ambition: ['Lessian Prosperity', 'The granary and counting-house of the world.'],
  },
  ash: {
    res: 'iron',
    heritage: ['Wardens of the Ashmark', 'A frontier wardenry that has held the Ash Wolds against all comers.'],
    develop: ['Ashmark Farms', 'Settlers and granaries in the Ashmark.'],
    resource: ['Ash Wolds Iron', 'Iron and coal in the Wolds.'],
    sea: ['Ashmark Coast Watch', 'Gunboats along the Ashmark coast.'],
    ambition: ['Ashmark Prosperity', 'The wardenry becomes a garden.'],
  },
};

const BALTIC: Record<string, NationalNames> = {
  swe: {
    res: 'iron',
    heritage: ['Swedish Neutrality', 'A century without war: Sweden arms to stay out of other people’s quarrels.'],
    develop: ['Norrland Inland Line', 'A railway through the forests of Norrland to the ore fields.'],
    resource: ['Bergslagen Mines', 'The old mining country of central Sweden, opened to modern pits.'],
    sea: ['Pansarbåt Programme', 'Armoured coastal battleships for the skerries.'],
    ambition: ['Swedish Prosperity', 'Ore, timber and engineering: the model of a modern state.'],
  },
  nor: {
    res: 'nitrates',
    heritage: ['Norwegian Independence', 'Free since 1905, Norway builds its own institutions.'],
    develop: ['Bergen Line', 'A railway over the mountains from Kristiania to Bergen.'],
    resource: ['Hydroelectric Power', 'Waterfalls drive the new electro-chemical works, which make nitrates from the air.'],
    sea: ['Norwegian Merchant Fleet', 'The third merchant fleet in the world, and a navy to guard it.'],
    ambition: ['Norwegian Prosperity', 'Shipping, fisheries and power for the world.'],
  },
  dan: {
    res: 'food',
    heritage: ['Danish Cooperative Movement', 'Cooperative dairies and folk high schools remake the countryside.'],
    develop: ['Jutland Heath Society', 'Planting and draining the heaths of Jutland.'],
    resource: ['Danish Bacon and Butter', 'Exports of bacon and butter to the industrial towns.'],
    sea: ['Defence of Copenhagen', 'Sea forts and a coast-defence fleet for the capital.'],
    ambition: ['Concert of the North', 'Denmark as the honest broker of the Baltic.'],
  },
  ger: {
    res: 'coal',
    heritage: ['Weltpolitik', 'The Empire seeks its place in the sun.'],
    develop: ['Prussian State Railways', 'Double tracks to the eastern frontier.'],
    resource: ['Ruhr and Silesia', 'Coal and steel on an unmatched scale.'],
    sea: ['Hochseeflotte', 'A battle fleet to rival any in the world.'],
    ambition: ['Mitteleuropa', 'A German-led order from the North Sea to the Baltic provinces.'],
  },
  rus: {
    heritage: ['October Manifesto', 'After the revolution of 1905, a Duma and the promise of reform.'],
    develop: ['Stolypin Land Reform', 'Peasants leave the commune for their own farms.'],
    resource: ['Donets Coal', 'Coal for the factories of St Petersburg and Moscow.'],
    sea: ['Rebuild the Baltic Fleet', 'A new fleet after the disaster of Tsushima.'],
    ambition: ['Great Russian Program', 'The army rebuilt for the great war to come.'],
  },
};

/** Hand-written national names for the realms of the built-in hand-made maps. */
export const NATIONAL_NAMES: Record<string, Record<string, NationalNames>> = {
  aldmere: FICTIONAL,
  reach: FICTIONAL,
  baltic: BALTIC,
};
