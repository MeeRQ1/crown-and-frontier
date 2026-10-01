// The research tree of the industrial age: five eras, each technology with a
// horizon year. Researching ahead of the horizon costs 15% more per year early
// and cannot finish more than 10 years early (progression.ts). Realms start a
// campaign with every technology whose horizon lies five or more years before
// the start year. Naval and air technologies are listed with Stage C content.

import type { ModEffects } from '../modifiers';
import type { UnitType } from '../types';

export type Branch = 'land' | 'naval' | 'air' | 'industry' | 'society';
export type Era = 1 | 2 | 3 | 4 | 5;

export interface TechDef {
  id: string;
  name: string;
  branch: Branch;
  era: Era;
  /** horizon year: researching earlier costs more, and at most 10 years early */
  year: number;
  cost: number; // research points before the map's multiplier
  requires: string[];
  effects: ModEffects;
  /** a regiment, ship or wing this technology allows the realm to build */
  unlocks?: UnitType;
  description: string;
}

export const ERAS: Record<Era, { name: string; year: number }> = {
  1: { name: 'Rifle & Rail', year: 1870 },
  2: { name: 'Steel & Breech', year: 1885 },
  3: { name: 'Dreadnought & Engine', year: 1900 },
  4: { name: 'Total War', year: 1915 },
  5: { name: 'Mechanised', year: 1925 },
};

const ERA_COST: Record<Era, number> = { 1: 150, 2: 220, 3: 320, 4: 440, 5: 560 };

function tech(id: string, name: string, branch: Branch, era: Era, year: number, requires: string[], effects: ModEffects, description: string, unlocks?: UnitType): TechDef {
  return { id, name, branch, era, year, cost: ERA_COST[era], requires, effects, description, ...(unlocks ? { unlocks } : {}) };
}

export const BRANCHES: Record<Branch, { name: string; blurb: string }> = {
  land: { name: 'Land warfare', blurb: 'Rifles, guns, logistics and doctrine.' },
  naval: { name: 'Naval', blurb: 'Steam, steel and the fleets that rule the sea lanes.' },
  air: { name: 'Air', blurb: 'From reconnaissance machines to bombers.' },
  industry: { name: 'Industry', blurb: 'Mines, factories, chemistry and production.' },
  society: { name: 'Society', blurb: 'Administration, mobilisation and diplomacy.' },
};

export const TECH_LIST: TechDef[] = [
  // ── Era I · Rifle & Rail ────────────────────────────────────────────────
  tech('breech_rifles', 'Breech-Loading Rifles', 'land', 1, 1870, [], { infantryAttack: 0.15 }, 'Riflemen load lying down and fire three times as fast.'),
  tech('rail_logistics', 'Railway Logistics', 'land', 1, 1872, [], { supplyRange: 1, attrition: -0.3 }, 'Railheads carry supplies one province further.'),
  tech('field_telegraph', 'Field Telegraph', 'land', 1, 1876, [], { moraleRecovery: 0.15, moveSpeed: 0.05 }, 'Orders reach the front in hours, not days.'),
  tech('rifled_guns', 'Rifled Field Guns', 'land', 1, 1878, ['breech_rifles'], { artilleryAttack: 0.15 }, 'Steel breech-loaders outrange the old smoothbores.'),
  tech('bessemer', 'Bessemer Steel', 'industry', 1, 1870, [], { ironOutput: 0.25, factoryCost: -0.1 }, 'Cheap steel by the converter-load.'),
  tech('railway_age', 'Railway Age', 'industry', 1, 1872, [], { infraCost: -0.25, moveSpeed: 0.1, supplyCap: 0.15 }, 'Standard gauges and cheap rails knit the realm together.'),
  tech('deep_mining', 'Deep Mining', 'industry', 1, 1874, [], { coalOutput: 0.25, resourceOutput: 0.05 }, 'Steam pumps keep deep seams dry.'),
  tech('joint_stock', 'Joint-Stock Companies', 'industry', 1, 1880, ['bessemer'], { income: 0.08, trade: 0.15 }, 'Investors pool capital for mines, mills and shipping lines.'),
  tech('telegraph_network', 'Telegraph Network', 'society', 1, 1870, [], { adminCapacity: 1, integration: 0.1 }, 'The capital hears from the frontier the same day.'),
  tech('public_schooling', 'Public Schooling', 'society', 1, 1875, [], { research: 0.15 }, 'Literate recruits, clerks and engineers.'),
  tech('civil_service', 'Civil Service', 'society', 1, 1878, ['telegraph_network'], { unrest: -4, adminCapacity: 1 }, 'Examined officials govern by rule, not favour.'),
  tech('consular_service', 'Consular Service', 'society', 1, 1880, [], { envoys: 1, relationGain: 0.25 }, 'Consuls in every port and capital.'),

  // ── Era II · Steel & Breech ─────────────────────────────────────────────
  tech('engineering_corps', 'Engineering Corps', 'land', 2, 1885, ['rail_logistics'], { siege: 0.2 }, 'Sappers, bridging trains and field railways.', 'engineers'),
  tech('magazine_rifles', 'Magazine Rifles', 'land', 2, 1886, ['breech_rifles'], { infantryAttack: 0.15 }, 'Smokeless powder and box magazines.'),
  tech('fortress_belts', 'Fortress Belts', 'land', 2, 1888, ['engineering_corps'], { fortCost: -0.25, defense: 0.08 }, 'Rings of concrete forts around key cities.'),
  tech('general_staff', 'General Staff', 'land', 2, 1890, ['field_telegraph'], { moraleMax: 0.5, reinforce: 0.25 }, 'Professional planners for mobilisation and war.'),
  tech('qf_artillery', 'Quick-Firing Artillery', 'land', 2, 1891, ['rifled_guns'], { artilleryAttack: 0.25 }, 'Recoil buffers keep the gun on target between shots.'),
  tech('chemical_industry', 'Chemical Industry', 'industry', 2, 1886, ['deep_mining'], { nitratesOutput: 0.3, syntheticNitrates: 0.1 }, 'Dyes, explosives and fertiliser from coal tar.'),
  tech('refrigeration', 'Refrigeration', 'industry', 2, 1888, ['railway_age'], { supplyProd: 0.15, popGrowth: 0.25 }, 'Cold stores and refrigerated wagons feed the cities.'),
  tech('electrification', 'Electrification', 'industry', 2, 1892, ['bessemer'], { industry: 0.15 }, 'Dynamos and electric motors drive the mills.'),
  tech('steel_mills', 'Open-Hearth Steel', 'industry', 2, 1895, ['bessemer'], { ironOutput: 0.25, materielCost: -0.1 }, 'Better steel from cheaper ore.'),
  tech('conscription', 'Universal Conscription', 'society', 2, 1885, ['civil_service'], { manpower: 0.2, manpowerRegen: 0.2 }, 'Every young man serves; reservists return when called.'),
  tech('mass_press', 'Mass Press', 'society', 2, 1890, ['public_schooling'], { research: 0.1, relationGain: 0.15, integration: 0.1 }, 'Cheap newspapers in every town.'),
  tech('social_insurance', 'Social Insurance', 'society', 2, 1895, ['civil_service'], { unrest: -4, popGrowth: 0.15 }, 'Pensions and accident insurance calm the factory towns.'),
  tech('arbitration', 'International Arbitration', 'society', 2, 1897, ['consular_service'], { alarmGen: -0.25, trustGain: 0.5, opinion: 5 }, 'Disputes go to tribunals before they go to war.'),

  // ── Era III · Dreadnought & Engine ──────────────────────────────────────
  tech('machine_guns', 'Machine Guns', 'land', 3, 1900, ['magazine_rifles'], { antiCavalry: 0.35, defense: 0.08 }, 'A few guns stop a cavalry charge cold.'),
  tech('heavy_artillery', 'Heavy Artillery', 'land', 3, 1905, ['qf_artillery'], { artilleryAttack: 0.2, siege: 0.4 }, 'Howitzers that crack concrete forts.'),
  tech('motor_transport', 'Motor Transport', 'land', 3, 1908, ['general_staff'], { moveSpeed: 0.1, supplyRange: 1 }, 'Lorries carry supplies beyond the railhead.'),
  tech('trench_warfare', 'Trench Warfare', 'land', 3, 1910, ['machine_guns', 'fortress_belts'], { entrench: 0.5, defense: 0.07 }, 'Deep trenches, wire and dugouts.'),
  tech('oil_refining', 'Oil Refining', 'industry', 3, 1900, ['chemical_industry'], { oilOutput: 0.4 }, 'Cracking stills turn crude into fuel.'),
  tech('rubber_plantations', 'Plantation Science', 'industry', 3, 1903, ['refrigeration'], { rubberOutput: 0.4, supplyProd: 0.1 }, 'Scientific estates for rubber and food.'),
  tech('turbines', 'Steam Turbines', 'industry', 3, 1904, ['electrification'], { factoryCoal: -0.2 }, 'More power from every ton of coal.'),
  tech('assembly_line', 'Assembly Line', 'industry', 3, 1910, ['electrification'], { industry: 0.2, factoryCost: -0.15 }, 'Moving lines and interchangeable parts.'),
  tech('mass_politics', 'Mass Politics', 'society', 3, 1902, ['mass_press'], { integration: 0.15, unrest: -3 }, 'Parties and unions bind the new provinces to the state.'),
  tech('reserve_system', 'Reserve System', 'society', 3, 1906, ['conscription'], { manpower: 0.15, reinforce: 0.25 }, 'Trained reservists fill the ranks within days.'),
  tech('entente_diplomacy', 'Entente Diplomacy', 'society', 3, 1907, ['arbitration'], { envoys: 1, opinion: 5 }, 'Understandings between friendly crowns.'),

  // ── Era IV · Total War ──────────────────────────────────────────────────
  tech('war_economy', 'War Economy', 'industry', 4, 1915, ['assembly_line'], { industry: 0.15, materielCost: -0.1 }, 'Factories retooled for shells, guns and lorries.'),
  tech('tanks', 'Tanks', 'land', 4, 1916, ['motor_transport', 'trench_warfare'], {}, 'Armoured fighting vehicles that cross the wire.', 'armour'),
  tech('total_mobilisation', 'Total Mobilisation', 'society', 4, 1916, ['reserve_system'], { manpower: 0.25, manpowerRegen: 0.2, warExhaustion: 0.1 }, 'The whole nation under arms.'),
  tech('storm_tactics', 'Stormtroop Tactics', 'land', 4, 1917, ['machine_guns'], { infantryAttack: 0.15, attack: 0.05 }, 'Small assault groups infiltrate between strongpoints.'),
  tech('haber_process', 'Haber–Bosch Process', 'industry', 4, 1918, ['chemical_industry'], { syntheticNitrates: 0.3 }, 'Nitrates from the air: shells without saltpetre.'),
  tech('propaganda', 'Propaganda Ministry', 'society', 4, 1918, ['mass_politics'], { warExhaustion: -0.25, unrest: -2 }, 'Posters, newsreels and censors keep the home front steady.'),
  tech('league_of_crowns', 'League of Crowns', 'society', 4, 1920, ['entente_diplomacy'], { alarmDecay: 0.5, opinion: 10 }, 'A standing congress of realms.'),
  tech('standardisation', 'Standardisation', 'industry', 4, 1921, ['war_economy'], { upkeep: -0.1, factoryCost: -0.1 }, 'One calibre, one gauge, one spare part.'),
  tech('combined_arms', 'Combined Arms', 'land', 4, 1922, ['tanks', 'storm_tactics'], { attack: 0.1, armourAttack: 0.15 }, 'Infantry, guns and tanks attack as one.'),

  // ── Era V · Mechanised ──────────────────────────────────────────────────
  tech('synthetic_fuel', 'Synthetic Fuel', 'industry', 5, 1927, ['haber_process'], { syntheticOil: 0.25 }, 'Coal hydrogenated into petrol.'),
  tech('mechanised', 'Mechanised Infantry', 'land', 5, 1928, ['combined_arms'], { moveSpeed: 0.15, infantryAttack: 0.1, armourAttack: 0.15 }, 'Infantry rides into battle beside the tanks.'),
  tech('welfare_state', 'Welfare State', 'society', 5, 1928, ['social_insurance'], { unrest: -5, popGrowth: 0.2 }, 'Health, housing and schooling for all.'),
  tech('synthetic_rubber', 'Synthetic Rubber', 'industry', 5, 1930, ['synthetic_fuel'], { syntheticRubber: 0.2 }, 'Tyres from coal and lime.'),
  tech('radio_command', 'Radio Command', 'land', 5, 1930, ['combined_arms'], { attack: 0.08, moraleRecovery: 0.25 }, 'Every tank and battalion on the net.'),
  tech('mass_production', 'Mass Production', 'industry', 5, 1932, ['standardisation'], { industry: 0.25, materielCost: -0.1 }, 'Whole factories built around one product.'),
  tech('planning_bureau', 'Planning Bureau', 'society', 5, 1932, ['propaganda'], { buildSlots: 1, adminCapacity: 2 }, 'Five-year plans for railways, mines and mills.'),
  tech('elastic_defence', 'Elastic Defence', 'land', 5, 1933, ['mechanised'], { defense: 0.1, entrench: 0.25 }, 'Defence in depth with mobile reserves.'),
  tech('collective_security', 'Collective Security', 'society', 5, 1935, ['league_of_crowns'], { trustGain: 0.5, opinion: 5, alarmGen: -0.25 }, 'An attack on one is an attack on all.'),
];

export const TECHS: Record<string, TechDef> = Object.fromEntries(TECH_LIST.map((t) => [t.id, t]));

/** The technologies every realm knows at the start of a campaign beginning in `startYear`. */
export function startingTechs(startYear: number): string[] {
  const out: string[] = [];
  for (const t of [...TECH_LIST].sort((a, b) => a.year - b.year || (a.id < b.id ? -1 : 1))) {
    if (t.year <= startYear - 5 && t.requires.every((r) => out.includes(r))) out.push(t.id);
  }
  return out;
}

/**
 * Technologies of the 17th-century tree (save formats 1 and 2) and their
 * nearest industrial-age equivalents, for converting old saves.
 */
export const LEGACY_TECHS: Record<string, string> = {
  drill: 'breech_rifles',
  trains: 'rail_logistics',
  cuirassiers: 'field_telegraph',
  siegecraft: 'rifled_guns',
  earthworks: 'engineering_corps',
  standing: 'general_staff',
  rotation: 'refrigeration',
  surveys: 'deep_mining',
  roads: 'railway_age',
  charters: 'joint_stock',
  bureaucracy: 'civil_service',
  colonial: 'telegraph_network',
  corps: 'consular_service',
  law: 'civil_service',
  press: 'public_schooling',
  embassies: 'arbitration',
  militia: 'conscription',
  concert: 'arbitration',
};
