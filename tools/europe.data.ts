// Authored data for "Europe, 1914" (tools/genreal.ts). Geography comes from
// Natural Earth; this file holds what Natural Earth cannot provide:
//  - the realms of early 1914 and their simplified arms in national colours (the
//    game's heraldry has no eagles or lions);
//  - which present-day first-level division belonged to which realm and region
//    in 1914. Borders follow present-day divisions where they match those of
//    1914 and approximate them where they do not (partitioned Poland, North
//    Schleswig, Alsace-Lorraine, the Balkan borders of 1913): good enough for a
//    campaign map, not a historical atlas;
//  - the names in use in 1914 for places renamed since;
//  - the main mountain walls and their passes, and the straits.
// Simplifications, stated in the map's description and docs/atlas/MAPS.md:
// Egypt (under British occupation since 1882, nominally Ottoman until
// December 1914) and Cyprus are held by the United Kingdom; Morocco is split
// between the French and Spanish protectorates and Tangier counted with the
// Spanish zone; the microstates (Andorra, Monaco, San Marino, Liechtenstein,
// Vatican) are too small for a province and are drawn as part of the land
// around them; the deserts at the frame's southern edge are thinly divided.

import type { NationDef, Terrain } from '../src/sim/types';
import { lambert, type Division, type RealMapDef, type RealRegion } from './realmap';

type Arms = NonNullable<NationDef['arms']>;
const arms = (field: string, ordinary: string, ordinaryTincture: string, charge: string, chargeTincture: string): Arms => ({ field, ordinary, ordinaryTincture, charge, chargeTincture });

const nation = (id: string, name: string, short: string, adjective: string, color: string, capital: string, personality: NationDef['personality'], a: Arms, summary: string, strength: string, constraint: string, traits: NationDef['traits'], startType: string, rating: NationDef['rating']): NationDef => ({
  id,
  name,
  short,
  adjective,
  color,
  capital,
  personality,
  emblem: a.charge === 'none' ? 'crown' : a.charge,
  summary,
  strength,
  constraint,
  traits,
  startType,
  rating,
  arms: a,
});

export const NATIONS: NationDef[] = [
  nation('gbr', 'United Kingdom', 'Britain', 'British', '#b04a3f', 'london', 'commercial', arms('azure', 'saltire', 'argent', 'crown', 'gules'), 'The island empire at the height of its trade, with the largest navy in the world, holding Ireland, Egypt and the Mediterranean bases.', 'Sea power and commerce: trade pays more and fleets are cheap to keep.', 'A small army for a great power, spread from Ireland to Suez.', { tradeMul: 0.3, incomeMul: 0.1, manpowerMul: -0.2 }, 'Maritime empire', 'recommended'),
  nation('fra', 'French Republic', 'France', 'French', '#3e64a5', 'paris', 'defensive', arms('azure', 'pale', 'argent', 'none', 'gules'), 'The Third Republic, with a conscript army along its eastern fortress line and an empire across North Africa.', 'Fortress belt and a large reserve: forts cost less.', 'A low birth rate: men are precious.', { fortCostMul: -0.25, popGrowthMul: -0.2 }, 'Established crown', 'recommended'),
  nation('ger', 'German Empire', 'Germany', 'German', '#5d5d6b', 'berlin', 'expansionist', arms('or', 'none', 'or', 'crown', 'sable'), 'The industrial empire at the centre of Europe, with the strongest army on the continent and a fleet built to rival Britain’s.', 'Industry and staff work: research and income above every neighbour.', 'Two fronts: France in the west, Russia in the east.', { researchMul: 0.15, incomeMul: 0.1 }, 'Wealthy heartland', 'recommended'),
  nation('aus', 'Austria-Hungary', 'Austria', 'Austro-Hungarian', '#c9a23f', 'vienna', 'defensive', arms('gules', 'fess', 'argent', 'none', 'or'), 'The Dual Monarchy of the Habsburgs: a dozen peoples from Bohemia to Bosnia under one crown, newly anxious about Serbia.', 'Mountain fortresses and a large army on paper.', 'Many peoples: newly held land integrates slowly and unrest runs high.', { integrationMul: -0.25, fortCostMul: -0.15 }, 'Established crown', 'standard'),
  nation('rus', 'Russian Empire', 'Russia', 'Russian', '#4f7a55', 'stpetersburg', 'opportunist', arms('argent', 'saltire', 'azure', 'none', 'or'), 'The empire of the tsars from Finland and Poland to the Caucasus, slow to mobilise and vast in manpower.', 'Vast manpower: armies are cheap to fill.', 'Railways and industry lag: research and supply are slow.', { manpowerMul: 0.35, researchMul: -0.15, supplyProdMul: -0.1 }, 'Established crown', 'standard'),
  nation('ita', 'Kingdom of Italy', 'Italy', 'Italian', '#5f9a5a', 'rome', 'opportunist', arms('gules', 'cross', 'argent', 'crown', 'or'), 'A young kingdom, newly master of Libya and the Dodecanese, bound to the Central Powers by treaty and to the sea by geography.', 'A long coast and a growing fleet.', 'Poor in coal and iron, and torn between alliances.', { tradeMul: 0.1, supplyProdMul: -0.05 }, 'Established crown', 'standard'),
  nation('ott', 'Ottoman Empire', 'Ottomans', 'Ottoman', '#9b5b3a', 'constantinople', 'opportunist', arms('gules', 'none', 'gules', 'crescent', 'argent'), 'The old empire of the straits, shrunk by the Balkan wars, still ruling Anatolia, the Levant and Mesopotamia from Constantinople.', 'The straits and a large hinterland: defenders fight well at home.', 'Debts and distances: income and supply are weak, and the provinces restless.', { incomeMul: -0.15, integrationMul: -0.2, moraleAdd: 0.3 }, 'Old empire', 'challenging'),
  nation('spa', 'Kingdom of Spain', 'Spain', 'Spanish', '#d0a13a', 'madrid', 'defensive', arms('gules', 'fess', 'or', 'none', 'gules'), 'A kingdom behind the Pyrenees, neutral and recovering from the loss of its last colonies, with a new zone in northern Morocco.', 'Mountains and a long border to defend: forts are cheap.', 'Little industry.', { fortCostMul: -0.2, researchMul: -0.1 }, 'Established crown', 'standard'),
  nation('por', 'Portuguese Republic', 'Portugal', 'Portuguese', '#4e8a6a', 'lisbon', 'commercial', arms('vert', 'perPale', 'gules', 'roundel', 'or'), 'An Atlantic republic since 1910, Britain’s oldest ally.', 'Atlantic trade.', 'Small, poor and far from the rest of Europe.', { tradeMul: 0.2, manpowerMul: -0.1 }, 'Maritime trader', 'challenging'),
  nation('ned', 'Kingdom of the Netherlands', 'Netherlands', 'Dutch', '#d87c33', 'amsterdam', 'commercial', arms('azure', 'none', 'azure', 'crown', 'or'), 'A rich trading kingdom of ports and polders, neutral between Britain and Germany.', 'Commerce: trade and income above its size.', 'Small and flat, between two great powers.', { tradeMul: 0.3, incomeMul: 0.1 }, 'Maritime trader', 'challenging'),
  nation('bel', 'Kingdom of Belgium', 'Belgium', 'Belgian', '#7a6a3e', 'brussels', 'defensive', arms('sable', 'pale', 'or', 'none', 'gules'), 'An industrial kingdom whose neutrality the great powers guarantee, with the forts of Liège and Namur on the Meuse.', 'Coal and factories, and a guaranteed neutrality.', 'On the road between France and Germany.', { incomeMul: 0.1, fortCostMul: -0.2 }, 'Wealthy heartland', 'challenging'),
  nation('lux', 'Grand Duchy of Luxembourg', 'Luxembourg', 'Luxembourgish', '#7d8fb0', 'luxembourg', 'diplomat', arms('argent', 'fess', 'azure', 'none', 'gules'), 'A neutral grand duchy of iron and steel between France, Belgium and Germany.', 'Iron and trust: a neutral others count on.', 'One province between three armies.', { opinionAdd: 15, incomeMul: 0.1 }, 'Small neutral', 'challenging'),
  nation('swi', 'Swiss Confederation', 'Switzerland', 'Swiss', '#b8463d', 'bern', 'defensive', arms('gules', 'cross', 'argent', 'roundel', 'gules'), 'The armed neutral confederation of the Alpine cantons.', 'Mountain defence: militia and forts hold the passes.', 'No coast and few resources.', { fortCostMul: -0.3, opinionAdd: 10 }, 'Small neutral', 'challenging'),
  nation('den', 'Kingdom of Denmark', 'Denmark', 'Danish', '#c25b55', 'copenhagen', 'diplomat', arms('gules', 'cross', 'argent', 'none', 'or'), 'A farming kingdom at the Baltic straits, with Iceland and the Faroes across the North Atlantic.', 'Dairy and trade: income above its size.', 'Small and next to Germany.', { incomeMul: 0.15, opinionAdd: 10 }, 'Maritime trader', 'challenging'),
  nation('swe', 'Kingdom of Sweden', 'Sweden', 'Swedish', '#3f6fa8', 'stockholm', 'defensive', arms('azure', 'cross', 'or', 'none', 'or'), 'A long kingdom of forest, ore and timber, neutral and well armed.', 'Iron ore: industry starts cheaply.', 'A long, thinly settled north.', { devCostMul: -0.1, supplyProdMul: -0.1 }, 'Established crown', 'standard'),
  nation('nor', 'Kingdom of Norway', 'Norway', 'Norwegian', '#a8453a', 'kristiania', 'commercial', arms('gules', 'cross', 'azure', 'none', 'or'), 'Independent since 1905: a seafaring kingdom of fjords whose merchant fleet sails every sea.', 'Shipping: trade pays more and straits cost less to cross.', 'Mountains and few people.', { tradeMul: 0.3, straitCostAdd: -1, manpowerMul: -0.15 }, 'Maritime trader', 'challenging'),
  nation('rom', 'Kingdom of Romania', 'Romania', 'Romanian', '#c7b23e', 'bucharest', 'opportunist', arms('azure', 'pale', 'or', 'none', 'gules'), 'A kingdom on the lower Danube with the Ploiești oil fields, newly enlarged by Southern Dobruja and courted by both camps.', 'Oil and grain.', 'Between Austria-Hungary, Russia and Bulgaria.', { supplyProdMul: 0.1 }, 'Established crown', 'standard'),
  nation('bul', 'Kingdom of Bulgaria', 'Bulgaria', 'Bulgarian', '#6b8f4f', 'sofia', 'expansionist', arms('vert', 'chief', 'argent', 'crown', 'or'), 'Beaten in the Second Balkan War of 1913, but holding Western Thrace and an outlet to the Aegean.', 'A hard army: soldiers fight well.', 'Isolated, and its neighbours hold what it claims.', { moraleAdd: 0.4, cavalryAttackAdd: 0.05 }, 'Established crown', 'standard'),
  nation('ser', 'Kingdom of Serbia', 'Serbia', 'Serbian', '#8e3f45', 'belgrade', 'defensive', arms('gules', 'cross', 'argent', 'crown', 'gules'), 'A kingdom doubled by the Balkan wars, battle-hardened and facing Austria-Hungary across the Danube.', 'Veterans: soldiers fight well, and hills help them.', 'Landlocked and exhausted by two wars.', { moraleAdd: 0.4, manpowerMul: -0.1 }, 'Established crown', 'standard'),
  nation('gre', 'Kingdom of Greece', 'Greece', 'Greek', '#4d82bd', 'athens', 'commercial', arms('azure', 'cross', 'argent', 'none', 'argent'), 'A maritime kingdom enlarged by the Balkan wars with Macedonia, Epirus, Crete and the Aegean islands.', 'Islands and ships.', 'New provinces to settle.', { tradeMul: 0.2, straitCostAdd: -1 }, 'Maritime trader', 'standard'),
  nation('mon', 'Kingdom of Montenegro', 'Montenegro', 'Montenegrin', '#6d4a7a', 'cetinje', 'expansionist', arms('gules', 'bordure', 'or', 'crown', 'or'), 'A small mountain kingdom of fighters on the Adriatic.', 'Mountain warriors.', 'Very small and very poor.', { moraleAdd: 0.5, incomeMul: -0.1 }, 'Mountain realm', 'challenging'),
  nation('alb', 'Principality of Albania', 'Albania', 'Albanian', '#9a3e3a', 'durazzo', 'defensive', arms('gules', 'none', 'gules', 'star', 'sable'), 'Independent since 1912 and given a foreign prince in 1914: a mountain state its neighbours covet.', 'Mountains.', 'A new state with little administration: land integrates slowly.', { integrationMul: -0.25 }, 'New state', 'challenging'),
  nation('per', 'Sublime State of Persia', 'Persia', 'Persian', '#3f8a85', 'tehran', 'defensive', arms('vert', 'none', 'vert', 'sun', 'or'), 'The Qajar shah’s realm, divided into Russian and British zones of influence; its north-west lies within this map.', 'Distance and mountains.', 'Weak and penetrated by foreign powers: income and research are low.', { incomeMul: -0.2, researchMul: -0.2 }, 'Old empire', 'challenging'),
];

export const CAPITALS: Record<string, [string, string]> = {
  gbr: ['London', 'GBR'],
  fra: ['Paris', 'FRA'],
  ger: ['Berlin', 'DEU'],
  aus: ['Vienna', 'AUT'],
  rus: ['St. Petersburg', 'RUS'],
  ita: ['Rome', 'ITA'],
  ott: ['Istanbul', 'TUR'],
  spa: ['Madrid', 'ESP'],
  por: ['Lisbon', 'PRT'],
  ned: ['Amsterdam', 'NLD'],
  bel: ['Brussels', 'BEL'],
  lux: ['Luxembourg', 'LUX'],
  swi: ['Bern', 'CHE'],
  den: ['København', 'DNK'],
  swe: ['Stockholm', 'SWE'],
  nor: ['Oslo', 'NOR'],
  rom: ['Bucharest', 'ROU'],
  bul: ['Sofia', 'BGR'],
  ser: ['Belgrade', 'SRB'],
  gre: ['Athens', 'GRC'],
  mon: ['Podgorica', 'MNE'],
  alb: ['Durrës', 'ALB'],
  per: ['Tehran', 'IRN'],
};

// ───────────────────────────── regions ─────────────────────────────────────

const B = {
  low: { plains: 4, forest: 1, marsh: 0.5 },
  mixed: { plains: 3, forest: 2, hills: 1, marsh: 0.4 },
  hill: { hills: 3, forest: 1.6, plains: 1.4, mountains: 0.4 },
  alp: { mountains: 2.2, hills: 2.2, forest: 1.4, plains: 0.4 },
  med: { hills: 2.6, plains: 2, forest: 0.6, mountains: 0.6 },
  north: { forest: 3.2, marsh: 1.4, hills: 0.8, plains: 0.6 },
  taiga: { forest: 3.4, marsh: 2, plains: 0.5 },
  steppe: { steppe: 3.4, plains: 1.6, hills: 0.3 },
  dry: { steppe: 3, hills: 1.6, mountains: 0.5, plains: 0.4 },
  desert: { steppe: 3.6, hills: 1.2, mountains: 0.4 },
  marsh: { plains: 2.4, marsh: 2, forest: 1 },
} as const satisfies Record<string, Partial<Record<Terrain, number>>>;

const reg = (realm: string, id: string, name: string, biome: Partial<Record<Terrain, number>>, extra: Partial<RealRegion> = {}): RealRegion => ({ id, name, realm, biome, ...extra });
const COLONY: [number, number] = [25, 55];
const FRONTIER: [number, number] = [35, 70];

export const REGIONS: RealRegion[] = [
  // United Kingdom
  reg('gbr', 'london', 'London', B.low),
  reg('gbr', 'southeast', 'South East England', B.low),
  reg('gbr', 'eastanglia', 'East Anglia', B.low),
  reg('gbr', 'southwest', 'West Country', B.mixed),
  reg('gbr', 'midlands', 'Midlands', B.low),
  reg('gbr', 'northwest', 'Lancashire and Cheshire', B.mixed),
  reg('gbr', 'yorkshire', 'Yorkshire', B.mixed),
  reg('gbr', 'northeast', 'Northumbria', B.hill),
  reg('gbr', 'wales', 'Wales', B.hill),
  reg('gbr', 'lowlands', 'Scottish Lowlands', B.hill),
  reg('gbr', 'highlands', 'Highlands', B.alp, { sparse: 1.8 }),
  reg('gbr', 'ulster', 'Ulster', B.mixed),
  reg('gbr', 'leinster', 'Leinster', B.low),
  reg('gbr', 'munster', 'Munster', B.mixed),
  reg('gbr', 'connacht', 'Connacht', B.marsh),
  reg('gbr', 'egypt', 'Lower Egypt', { plains: 4, marsh: 1 }, { integ: COLONY }),
  reg('gbr', 'sinai', 'Sinai and the Canal', B.desert, { integ: COLONY, sparse: 2.5 }),
  reg('gbr', 'westerndesert', 'Western Desert', B.desert, { integ: COLONY, sparse: 4 }),
  reg('gbr', 'cyprus', 'Cyprus', B.med, { integ: COLONY }),
  reg('gbr', 'malta', 'Malta', { plains: 2, hills: 1 }),
  // France
  reg('fra', 'iledefrance', 'Île-de-France', B.low),
  reg('fra', 'picardy', 'Picardy and Flanders', B.low),
  reg('fra', 'champagne', 'Champagne and Lorraine', B.mixed),
  reg('fra', 'normandy', 'Normandy', B.low),
  reg('fra', 'brittany', 'Brittany', B.mixed),
  reg('fra', 'loire', 'Anjou and Maine', B.low),
  reg('fra', 'orleanais', 'Orléanais and Berry', B.low),
  reg('fra', 'burgundy', 'Burgundy and Franche-Comté', B.hill),
  reg('fra', 'aquitaine', 'Aquitaine', B.mixed),
  reg('fra', 'languedoc', 'Languedoc', B.med),
  reg('fra', 'lyonnais', 'Lyonnais and Auvergne', B.hill),
  reg('fra', 'savoy', 'Savoy and Dauphiné', B.alp),
  reg('fra', 'provence', 'Provence', B.med),
  reg('fra', 'corsica', 'Corsica', B.med),
  reg('fra', 'algiers', 'Algiers', B.med, { sparse: 1.3, integ: COLONY }),
  reg('fra', 'oran', 'Oran', B.dry, { sparse: 1.4, integ: COLONY }),
  reg('fra', 'constantine', 'Constantine', B.med, { sparse: 1.3, integ: COLONY }),
  reg('fra', 'algsahara', 'Algerian Sahara', B.desert, { integ: COLONY, sparse: 5 }),
  reg('fra', 'tunis', 'Tunis', B.med, { sparse: 1.2, integ: COLONY }),
  reg('fra', 'southtunisia', 'Southern Tunisia', B.desert, { integ: COLONY, sparse: 3 }),
  reg('fra', 'fez', 'Fez and Meknes', B.hill, { sparse: 1.4, integ: COLONY }),
  reg('fra', 'rabat', 'Rabat and Casablanca', B.med, { sparse: 1.4, integ: COLONY }),
  reg('fra', 'marrakesh', 'Marrakesh', B.dry, { integ: COLONY, sparse: 2 }),
  reg('fra', 'oriental', 'Eastern Morocco', B.desert, { integ: COLONY, sparse: 2.5 }),
  // German Empire
  reg('ger', 'brandenburg', 'Brandenburg', B.mixed),
  reg('ger', 'pomerania', 'Pomerania', B.mixed),
  reg('ger', 'mecklenburg', 'Mecklenburg', B.low),
  reg('ger', 'schleswig', 'Schleswig-Holstein', B.low),
  reg('ger', 'hanover', 'Hanover and Oldenburg', B.low),
  reg('ger', 'westphalia', 'Rhineland and Westphalia', B.mixed),
  reg('ger', 'hesse', 'Hesse-Nassau', B.hill),
  reg('ger', 'palatinate', 'Palatinate and Saar', B.hill),
  reg('ger', 'baden', 'Baden and Württemberg', B.hill),
  reg('ger', 'bavaria', 'Bavaria', B.hill),
  reg('ger', 'saxony', 'Saxony', B.hill),
  reg('ger', 'thuringia', 'Thuringia', B.hill),
  reg('ger', 'provsaxony', 'Prussian Saxony', B.low),
  reg('ger', 'silesia', 'Silesia', B.mixed),
  reg('ger', 'posen', 'Posen', B.low),
  reg('ger', 'westprussia', 'West Prussia', B.mixed),
  reg('ger', 'eastprussia', 'East Prussia', { plains: 2.4, forest: 2, marsh: 1.2 }),
  reg('ger', 'alsace', 'Alsace-Lorraine', B.hill),
  // Austria-Hungary
  reg('aus', 'loweraustria', 'Lower Austria', B.hill),
  reg('aus', 'upperaustria', 'Upper Austria and Salzburg', B.alp),
  reg('aus', 'tyrol', 'Tyrol', B.alp),
  reg('aus', 'styria', 'Styria and Carinthia', B.alp),
  reg('aus', 'littoral', 'Austrian Littoral', B.hill),
  reg('aus', 'carniola', 'Carniola', B.alp),
  reg('aus', 'bohemia', 'Bohemia', B.hill),
  reg('aus', 'moravia', 'Moravia and Silesia', B.hill),
  reg('aus', 'galiciaw', 'Western Galicia', B.hill),
  reg('aus', 'galiciae', 'Eastern Galicia', B.mixed),
  reg('aus', 'bukovina', 'Bukovina', B.hill),
  reg('aus', 'budapest', 'Budapest', B.low),
  reg('aus', 'transdanubia', 'Transdanubia', B.low),
  reg('aus', 'upperhungary', 'Upper Hungary', B.alp),
  reg('aus', 'northhungary', 'Northern Hungary', B.hill),
  reg('aus', 'alfold', 'Great Hungarian Plain', { plains: 4, steppe: 1.2, marsh: 0.6 }),
  reg('aus', 'transylvania', 'Transylvania', B.alp),
  reg('aus', 'banat', 'Banat and Bačka', B.low),
  reg('aus', 'croatia', 'Croatia-Slavonia', B.hill),
  reg('aus', 'dalmatia', 'Dalmatia', B.med),
  reg('aus', 'bosnia', 'Bosnia-Herzegovina', B.alp, { integ: FRONTIER }),
  // Russian Empire
  reg('rus', 'stpetersburg', 'St Petersburg', B.taiga, { sparse: 1.4 }),
  reg('rus', 'novgorod', 'Novgorod and Tver', B.taiga, { sparse: 1.8 }),
  reg('rus', 'pskov', 'Pskov', B.north, { sparse: 1.6 }),
  reg('rus', 'olonets', 'Olonets', B.taiga, { sparse: 2.6 }),
  reg('rus', 'kola', 'Kola', B.taiga, { sparse: 5 }),
  reg('rus', 'archangel', 'Archangel', B.taiga, { sparse: 5 }),
  reg('rus', 'vologda', 'Vologda', B.taiga, { sparse: 3.2 }),
  reg('rus', 'moscow', 'Moscow', B.mixed, { sparse: 1.6 }),
  reg('rus', 'yaroslavl', 'Yaroslavl and Kostroma', B.north, { sparse: 1.7 }),
  reg('rus', 'nizhny', 'Nizhny Novgorod', B.north, { sparse: 1.7 }),
  reg('rus', 'kazan', 'Kazan and Vyatka', B.north, { sparse: 2.2 }),
  reg('rus', 'smolensk', 'Smolensk', B.mixed, { sparse: 1.6 }),
  reg('rus', 'kaluga', 'Kaluga, Tula and Orel', B.mixed, { sparse: 1.5 }),
  reg('rus', 'ryazan', 'Ryazan and Penza', B.mixed, { sparse: 1.6 }),
  reg('rus', 'kursk', 'Kursk', B.steppe, { sparse: 1.4 }),
  reg('rus', 'voronezh', 'Voronezh and Tambov', B.steppe, { sparse: 1.6 }),
  reg('rus', 'saratov', 'Saratov and Simbirsk', B.steppe, { sparse: 2 }),
  reg('rus', 'don', 'Don Cossack Host', B.steppe, { sparse: 1.8 }),
  reg('rus', 'astrakhan', 'Astrakhan and Tsaritsyn', B.desert, { sparse: 3 }),
  reg('rus', 'kuban', 'Kuban', B.steppe, { sparse: 1.4 }),
  reg('rus', 'terek', 'Terek and Dagestan', B.alp, { sparse: 1.4, integ: FRONTIER }),
  reg('rus', 'stavropol', 'Stavropol', B.steppe, { sparse: 1.6 }),
  reg('rus', 'georgia', 'Tiflis and Kutais', B.alp, { sparse: 1.2 }),
  reg('rus', 'erivan', 'Erivan', B.alp, { sparse: 1.2 }),
  reg('rus', 'baku', 'Baku and Elisavetpol', B.dry, { sparse: 1.6 }),
  reg('rus', 'kars', 'Kars', B.alp, { integ: FRONTIER }),
  reg('rus', 'estland', 'Estland', B.north),
  reg('rus', 'livland', 'Livland', B.north),
  reg('rus', 'courland', 'Courland', B.mixed),
  reg('rus', 'kovno', 'Kovno', B.mixed),
  reg('rus', 'vilna', 'Vilna and Grodno', B.north, { sparse: 1.3 }),
  reg('rus', 'minsk', 'Minsk', B.marsh, { sparse: 1.5 }),
  reg('rus', 'vitebsk', 'Vitebsk', B.north, { sparse: 1.5 }),
  reg('rus', 'mogilev', 'Mogilev and Gomel', B.marsh, { sparse: 1.5 }),
  reg('rus', 'congress', 'Congress Poland', B.low),
  reg('rus', 'lublin', 'Lublin', B.low),
  reg('rus', 'volhynia', 'Volhynia', B.marsh, { sparse: 1.4 }),
  reg('rus', 'podolia', 'Podolia', B.low, { sparse: 1.2 }),
  reg('rus', 'kiev', 'Kiev', B.low, { sparse: 1.3 }),
  reg('rus', 'chernigov', 'Chernigov and Kharkov', B.steppe, { sparse: 1.3 }),
  reg('rus', 'poltava', 'Poltava', B.steppe, { sparse: 1.3 }),
  reg('rus', 'donets', 'Donets Basin', B.steppe, { sparse: 1.3 }),
  reg('rus', 'ekaterinoslav', 'Ekaterinoslav', B.steppe, { sparse: 1.4 }),
  reg('rus', 'kherson', 'Kherson and Odessa', B.steppe, { sparse: 1.4 }),
  reg('rus', 'bessarabia', 'Bessarabia', B.low, { sparse: 1.2 }),
  reg('rus', 'taurida', 'Taurida', B.steppe, { sparse: 1.4 }),
  reg('rus', 'finlands', 'Southern Finland', B.north, { sparse: 1.2 }),
  reg('rus', 'finlandc', 'Central Finland', B.taiga, { sparse: 2 }),
  reg('rus', 'finlandn', 'Oulu and Lapland', B.taiga, { sparse: 4 }),
  // Italy
  reg('ita', 'piedmont', 'Piedmont', B.alp),
  reg('ita', 'lombardy', 'Lombardy', B.low),
  reg('ita', 'venetia', 'Venetia', B.low),
  reg('ita', 'liguria', 'Liguria', B.med),
  reg('ita', 'emilia', 'Emilia-Romagna', B.low),
  reg('ita', 'tuscany', 'Tuscany', B.med),
  reg('ita', 'marche', 'Marche and Umbria', B.med),
  reg('ita', 'lazio', 'Lazio', B.med),
  reg('ita', 'abruzzo', 'Abruzzo and Molise', B.alp),
  reg('ita', 'campania', 'Campania', B.med),
  reg('ita', 'apulia', 'Apulia', B.med),
  reg('ita', 'calabria', 'Calabria and Basilicata', B.med),
  reg('ita', 'sicily', 'Sicily', B.med),
  reg('ita', 'sardinia', 'Sardinia', B.med),
  reg('ita', 'tripolitania', 'Tripolitania', B.desert, { integ: COLONY, sparse: 3 }),
  reg('ita', 'cyrenaica', 'Cyrenaica', B.desert, { integ: COLONY, sparse: 3.5 }),
  reg('ita', 'dodecanese', 'Dodecanese', B.med, { integ: COLONY }),
  // Ottoman Empire
  reg('ott', 'thrace', 'Thrace and Constantinople', B.low),
  reg('ott', 'hudavendigar', 'Hüdavendigâr', B.hill),
  reg('ott', 'aydin', 'Aydın', B.med),
  reg('ott', 'konya', 'Konya', B.dry, { sparse: 1.8 }),
  reg('ott', 'ankara', 'Angora', B.dry, { sparse: 1.8 }),
  reg('ott', 'kastamonu', 'Kastamonu', B.hill, { sparse: 1.4 }),
  reg('ott', 'sivas', 'Sivas', B.hill, { sparse: 1.5 }),
  reg('ott', 'trebizond', 'Trebizond', B.alp, { sparse: 1.3 }),
  reg('ott', 'erzurum', 'Erzurum', B.alp, { sparse: 1.7 }),
  reg('ott', 'van', 'Van and Bitlis', B.alp, { sparse: 1.7, integ: FRONTIER }),
  reg('ott', 'diyarbekir', 'Diyarbekir', B.dry, { sparse: 1.7, integ: FRONTIER }),
  reg('ott', 'mamuret', 'Mamuretülaziz', B.alp, { sparse: 1.5 }),
  reg('ott', 'adana', 'Adana', B.med),
  reg('ott', 'aleppo', 'Aleppo', B.dry, { sparse: 1.4 }),
  reg('ott', 'syria', 'Damascus', B.dry, { sparse: 1.7 }),
  reg('ott', 'beirut', 'Beirut', B.med),
  reg('ott', 'jerusalem', 'Jerusalem', B.dry),
  reg('ott', 'transjordan', 'Transjordan', B.desert, { sparse: 3, integ: FRONTIER }),
  reg('ott', 'zor', 'Zor', B.desert, { sparse: 3.5, integ: FRONTIER }),
  reg('ott', 'mosul', 'Mosul', B.dry, { sparse: 1.6, integ: FRONTIER }),
  reg('ott', 'baghdad', 'Baghdad', { plains: 2.4, steppe: 2, marsh: 0.8 }, { sparse: 1.8, integ: FRONTIER }),
  reg('ott', 'basra', 'Basra', { marsh: 2, steppe: 2, plains: 1 }, { sparse: 2.4, integ: FRONTIER }),
  reg('ott', 'arabia', 'Northern Arabia', B.desert, { sparse: 5, integ: [10, 30] }),
  // Spain
  reg('spa', 'newcastile', 'New Castile', B.dry, { sparse: 1.3 }),
  reg('spa', 'oldcastile', 'Old Castile and León', B.dry, { sparse: 1.3 }),
  reg('spa', 'esgalicia', 'Galicia', B.hill),
  reg('spa', 'asturias', 'Asturias and Cantabria', B.alp),
  reg('spa', 'basque', 'Basque Country and Navarre', B.hill),
  reg('spa', 'aragon', 'Aragon', B.dry, { sparse: 1.3 }),
  reg('spa', 'catalonia', 'Catalonia', B.hill),
  reg('spa', 'valencia', 'Valencia and Murcia', B.med),
  reg('spa', 'andalusia', 'Andalusia', B.med),
  reg('spa', 'extremadura', 'Extremadura', B.dry, { sparse: 1.3 }),
  reg('spa', 'balearics', 'Balearic Islands', B.med),
  reg('spa', 'spmorocco', 'Spanish Morocco', B.alp, { integ: COLONY }),
  // Portugal
  reg('por', 'ptnorth', 'Minho and Douro', B.hill),
  reg('por', 'beira', 'Beira', B.hill),
  reg('por', 'ptlisbon', 'Estremadura', B.med),
  reg('por', 'alentejo', 'Alentejo and Algarve', B.dry),
  // the Low Countries, Switzerland
  reg('ned', 'holland', 'Holland', { plains: 3, marsh: 1.6 }),
  reg('ned', 'nleast', 'Gelderland and the East', B.low),
  reg('bel', 'flanders', 'Flanders and Brabant', B.low),
  reg('bel', 'wallonia', 'Wallonia', B.hill),
  reg('lux', 'luxembourg', 'Luxembourg', B.hill),
  reg('swi', 'switzerland', 'Switzerland', B.alp),
  // Scandinavia
  reg('den', 'jutland', 'Jutland', B.low),
  reg('den', 'zealand', 'Zealand and Funen', B.low),
  reg('swe', 'gotaland', 'Götaland', B.mixed),
  reg('swe', 'smaland', 'Scania and Småland', B.mixed),
  reg('swe', 'svealand', 'Svealand', B.north, { sparse: 1.3 }),
  reg('swe', 'norrlands', 'Southern Norrland', B.taiga, { sparse: 2.2 }),
  reg('swe', 'norrlandn', 'Northern Norrland', B.taiga, { sparse: 3.5 }),
  reg('nor', 'eastnorway', 'Eastern Norway', B.north, { sparse: 1.3 }),
  reg('nor', 'westnorway', 'Western Norway', B.alp, { sparse: 1.6 }),
  reg('nor', 'trondelag', 'Trøndelag', B.alp, { sparse: 2 }),
  reg('nor', 'northnorway', 'Northern Norway', B.alp, { sparse: 3.5 }),
  // the Balkans
  reg('rom', 'wallachia', 'Wallachia', B.low),
  reg('rom', 'oltenia', 'Oltenia', B.low),
  reg('rom', 'moldavia', 'Moldavia', B.hill),
  reg('rom', 'dobruja', 'Dobruja', B.steppe),
  reg('bul', 'sofia', 'Sofia', B.hill),
  reg('bul', 'danubebul', 'Danubian Bulgaria', B.low),
  reg('bul', 'rumelia', 'Eastern Rumelia', B.hill),
  reg('bul', 'pirin', 'Pirin and the Rhodopes', B.alp),
  reg('bul', 'wthrace', 'Western Thrace', B.med),
  reg('ser', 'belgrade', 'Belgrade and Šumadija', B.hill),
  reg('ser', 'nis', 'Niš', B.hill),
  reg('ser', 'kosovo', 'Kosovo and Sanjak', B.alp, { integ: FRONTIER }),
  reg('ser', 'macedonia', 'Vardar Macedonia', B.hill, { integ: FRONTIER }),
  reg('gre', 'attica', 'Attica and Boeotia', B.med),
  reg('gre', 'peloponnese', 'Peloponnese', B.med),
  reg('gre', 'thessaly', 'Thessaly', B.low),
  reg('gre', 'epirus', 'Epirus', B.alp, { integ: FRONTIER }),
  reg('gre', 'grmacedonia', 'Greek Macedonia', B.hill, { integ: FRONTIER }),
  reg('gre', 'crete', 'Crete', B.med),
  reg('gre', 'aegean', 'Aegean Islands', B.med),
  reg('gre', 'ionian', 'Ionian Islands', B.med),
  reg('mon', 'montenegro', 'Montenegro', B.alp),
  reg('alb', 'albania', 'Albania', B.alp, { integ: [30, 60] }),
  // Persia
  reg('per', 'tabriz', 'Azerbaijan (Tabriz)', B.dry, { sparse: 1.6 }),
  reg('per', 'gilan', 'Gilan and Mazandaran', { forest: 2.4, hills: 1.4, plains: 1 }, { sparse: 1.3 }),
  reg('per', 'tehran', 'Tehran and Qazvin', B.dry, { sparse: 1.6 }),
  reg('per', 'hamadan', 'Hamadan and Kermanshah', B.alp, { sparse: 1.6 }),
  reg('per', 'khuzestan', 'Arabistan and Luristan', B.dry, { sparse: 2.4 }),
];

// ───────────────────────────── classification ──────────────────────────────

const inList = (name: string, list: string) => list.split('|').includes(name);

/** North Schleswig (German 1864–1920): Jutland south of the Kongeå, and Als. */
const NORTH_SCHLESWIG: Array<[number, number]> = [[7.9, 55.47], [9.62, 55.47], [9.76, 55.22], [10.12, 55.0], [10.12, 54.84], [8.95, 54.78], [7.9, 54.85]];
function inPoly(lon: number, lat: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function classify(d: Division, lon: number, lat: number): string | null | undefined {
  const n = d.name;
  const g = d.group;
  switch (d.adm0) {
    case 'GBR':
    case 'IMN':
    case 'GGY':
    case 'JEY':
      if (d.adm0 !== 'GBR') return d.adm0 === 'IMN' ? 'northwest' : 'southwest';
      if (n === 'Greater London' || g === 'Greater London') return 'london';
      return (
        {
          'South East': 'southeast',
          East: 'eastanglia',
          'South West': 'southwest',
          'West Midlands': 'midlands',
          'East Midlands': 'midlands',
          'North West': 'northwest',
          'Yorkshire and the Humber': 'yorkshire',
          'North East': 'northeast',
          'West Wales and the Valleys': 'wales',
          'East Wales': 'wales',
          Eastern: 'lowlands',
          'South Western': 'lowlands',
          'North Eastern': 'highlands',
          'Highlands and Islands': 'highlands',
          'Northern Ireland': 'ulster',
          'Greater London': 'london',
        } as Record<string, string>
      )[g] ?? (lat > 56 ? 'highlands' : lat > 54.6 ? 'northeast' : 'southeast');
    case 'IRL':
      if (inList(n, 'Donegal|Cavan|Monaghan')) return 'ulster';
      if (inList(n, 'Galway|Mayo|Sligo|Leitrim|Roscommon')) return 'connacht';
      if (inList(n, 'Cork|Kerry|Limerick|Clare|North Tipperary|South Tipperary|Waterford')) return 'munster';
      return 'leinster';
    case 'EGY':
      if (inList(n, "Shamal Sina'|Janub Sina'|As Suways|Bur Sa`id|Al Isma`iliyah")) return 'sinai';
      if (n === 'Matruh' || n === 'Al Wadi al Jadid') return 'westerndesert';
      return 'egypt';
    case 'CYP':
    case 'CYN':
    case 'ESB':
    case 'WSB':
      return 'cyprus';
    case 'MLT':
      return 'malta';
    case 'GIB':
      return 'andalusia';
    case 'FRA':
    case 'MCO':
      if (d.adm0 === 'MCO') return 'provence';
      if (inList(n, 'Bas-Rhin|Haute-Rhin|Haut-Rhin|Moselle')) return 'alsace';
      if (inList(n, 'Savoie|Haute-Savoie|Isère|Hautes-Alpes|Drôme')) return 'savoy';
      return (
        {
          'Île-de-France': 'iledefrance',
          'Hauts-de-France': 'picardy',
          'Grand Est': 'champagne',
          Normandie: 'normandy',
          Bretagne: 'brittany',
          'Pays de la Loire': 'loire',
          'Centre-Val de Loire': 'orleanais',
          'Bourgogne-Franche-Comté': 'burgundy',
          'Nouvelle-Aquitaine': 'aquitaine',
          Occitanie: 'languedoc',
          'Auvergne-Rhône-Alpes': 'lyonnais',
          "Provence-Alpes-Côte-d'Azur": 'provence',
          Corse: 'corsica',
        } as Record<string, string>
      )[g] ?? null;
    case 'DZA':
      if (lat < 34.4) return 'algsahara';
      return lon < 0.9 ? 'oran' : lon < 4.6 ? 'algiers' : 'constantine';
    case 'TUN':
      return lat > 35.3 ? 'tunis' : 'southtunisia';
    case 'MAR':
      if (n === 'Tanger - Tétouan' || (inList(n, 'Taza - Al Hoceima - Taounate|Oriental') && lat > 34.8)) return 'spmorocco';
      if (n === 'Oriental') return 'oriental';
      if (inList(n, 'Fès - Boulemane|Meknès - Tafilalet|Taza - Al Hoceima - Taounate')) return lat < 32.5 ? 'oriental' : 'fez';
      if (inList(n, 'Marrakech - Tensift - Al Haouz|Souss - Massa - Draâ|Tadla - Azilal|Doukkala - Abda')) return 'marrakesh';
      return 'rabat';
    case 'ESP':
    case 'AND':
      if (d.adm0 === 'AND') return 'catalonia';
      if (inList(n, 'Ceuta|Melilla')) return 'spmorocco';
      return (
        {
          Madrid: 'newcastile',
          'Castilla-La Mancha': 'newcastile',
          'Castilla y León': 'oldcastile',
          Galicia: 'esgalicia',
          Asturias: 'asturias',
          Cantabria: 'asturias',
          'País Vasco': 'basque',
          'Foral de Navarra': 'basque',
          'La Rioja': 'basque',
          Aragón: 'aragon',
          Cataluña: 'catalonia',
          Valenciana: 'valencia',
          Murcia: 'valencia',
          Andalucía: 'andalusia',
          Extremadura: 'extremadura',
          'Islas Baleares': 'balearics',
        } as Record<string, string>
      )[g] ?? null;
    case 'PRT':
      if (n === 'Madeira') return null;
      return ({ Norte: 'ptnorth', 'Norte, Centro': 'beira', Centro: 'beira', Lisbon: 'ptlisbon', Alentejo: 'alentejo', Algarve: 'alentejo' } as Record<string, string>)[g] ?? 'beira';
    case 'DEU':
      return (
        {
          Berlin: 'brandenburg',
          Brandenburg: 'brandenburg',
          'Mecklenburg-Vorpommern': lon > 12.7 ? 'pomerania' : 'mecklenburg',
          'Schleswig-Holstein': 'schleswig',
          Hamburg: 'schleswig',
          Bremen: 'hanover',
          Niedersachsen: 'hanover',
          'Nordrhein-Westfalen': 'westphalia',
          Hessen: 'hesse',
          'Rheinland-Pfalz': 'palatinate',
          Saarland: 'palatinate',
          'Baden-Württemberg': 'baden',
          Bayern: 'bavaria',
          Sachsen: 'saxony',
          Thüringen: 'thuringia',
          'Sachsen-Anhalt': 'provsaxony',
        } as Record<string, string>
      )[n];
    case 'DNK':
      if (inPoly(lon, lat, NORTH_SCHLESWIG)) return 'schleswig';
      return inList(n, 'Hovedstaden|Sjaælland') || (n === 'Syddanmark' && lon > 9.9) ? 'zealand' : 'jutland';
    case 'FRO':
    case 'ISL':
      // beyond the frame, which ends at Ireland
      return null;
    case 'POL':
      if (inList(n, 'West Pomeranian')) return 'pomerania';
      if (inList(n, 'Pomeranian|Kuyavian-Pomeranian')) return 'westprussia';
      if (n === 'Warmian-Masurian') return 'eastprussia';
      if (n === 'Greater Poland') return 'posen';
      if (n === 'Lubusz') return 'brandenburg';
      if (inList(n, 'Lower Silesian|Opole|Silesian')) return 'silesia';
      if (inList(n, 'Lesser Poland|Subcarpathian')) return 'galiciaw';
      if (inList(n, 'Lublin')) return 'lublin';
      if (inList(n, 'Masovian|Łódź|Świętokrzyskie|Podlachian')) return n === 'Podlachian' && lat > 53.6 ? 'vilna' : 'congress';
      return undefined;
    case 'RUS':
      if (n === 'Kaliningrad') return 'eastprussia';
      return (
        {
          'City of St. Petersburg': 'stpetersburg',
          Leningrad: 'stpetersburg',
          Novgorod: 'novgorod',
          "Tver'": 'novgorod',
          Pskov: 'pskov',
          Karelia: 'olonets',
          Murmansk: 'kola',
          "Arkhangel'sk": 'archangel',
          'Nenets': 'archangel',
          Vologda: 'vologda',
          Komi: 'vologda',
          Moskva: 'moscow',
          Moskovskaya: 'moscow',
          Vladimir: 'moscow',
          "Yaroslavl'": 'yaroslavl',
          Kostroma: 'yaroslavl',
          Ivanovo: 'yaroslavl',
          Nizhegorod: 'nizhny',
          Chuvash: 'nizhny',
          'Mariy-El': 'kazan',
          Tatarstan: 'kazan',
          Kirov: 'kazan',
          Udmurt: 'kazan',
          Smolensk: 'smolensk',
          Bryansk: 'smolensk',
          Kaluga: 'kaluga',
          Tula: 'kaluga',
          Orel: 'kaluga',
          "Ryazan'": 'ryazan',
          Penza: 'ryazan',
          Mordovia: 'ryazan',
          Kursk: 'kursk',
          Belgorod: 'kursk',
          Voronezh: 'voronezh',
          Lipetsk: 'voronezh',
          Tambov: 'voronezh',
          Saratov: 'saratov',
          "Ul'yanovsk": 'saratov',
          Samara: 'saratov',
          Orenburg: 'saratov',
          Rostov: 'don',
          Volgograd: 'astrakhan',
          "Astrakhan'": 'astrakhan',
          Kalmyk: 'astrakhan',
          Krasnodar: 'kuban',
          Adygey: 'kuban',
          "Stavropol'": 'stavropol',
          'Karachay-Cherkess': 'terek',
          'Kabardin-Balkar': 'terek',
          'North Ossetia': 'terek',
          Ingush: 'terek',
          Chechnya: 'terek',
          Dagestan: 'terek',
          Crimea: 'taurida',
          Sevastopol: 'taurida',
          Bashkortostan: 'kazan',
          "Perm'": 'kazan',
        } as Record<string, string>
      )[n];
    case 'KAZ':
      return 'astrakhan';
    case 'UKR':
      if (inList(n, "L'viv|Ternopil'|Ivano-Frankivs'k")) return 'galiciae';
      if (n === 'Chernivtsi') return 'bukovina';
      if (n === 'Transcarpathia') return 'northhungary';
      return (
        {
          Volyn: 'volhynia',
          Rivne: 'volhynia',
          Zhytomyr: 'volhynia',
          "Khmel'nyts'kyy": 'podolia',
          Vinnytsya: 'podolia',
          Kiev: 'kiev',
          'Kiev City': 'kiev',
          Cherkasy: 'kiev',
          Chernihiv: 'chernigov',
          Sumy: 'chernigov',
          Kharkiv: 'chernigov',
          Poltava: 'poltava',
          Kirovohrad: 'poltava',
          "Luhans'k": 'donets',
          "Donets'k": 'donets',
          "Dnipropetrovs'k": 'ekaterinoslav',
          Zaporizhzhya: 'ekaterinoslav',
          Kherson: 'kherson',
          Mykolayiv: 'kherson',
          Odessa: 'kherson',
          Crimea: 'taurida',
          'Sevastopol': 'taurida',
        } as Record<string, string>
      )[n];
    case 'MDA':
      return 'bessarabia';
    case 'BLR':
      return ({ Grodno: 'vilna', Brest: 'vilna', Minsk: 'minsk', 'City of Minsk': 'minsk', Vitebsk: 'vitebsk', Mogilev: 'mogilev', Gomel: 'mogilev' } as Record<string, string>)[n];
    case 'LTU':
      if (n === 'Klaipedos') return 'eastprussia';
      return inList(n, 'Vilniaus|Alytaus') ? 'vilna' : 'kovno';
    case 'LVA':
      if (g === 'Latgale') return 'vitebsk';
      if (g === 'Kurzeme' || g === 'Zemgale') return 'courland';
      return 'livland';
    case 'EST':
      return inList(n, 'Tartu|Võru|Põlva|Valga|Viljandi|Pärnu|Saare|Jõgeva') ? 'livland' : 'estland';
    case 'FIN':
    case 'ALD':
      if (d.adm0 === 'ALD') return 'finlands';
      if (inList(n, 'Northern Ostrobothnia|Kainuu|Lapland')) return 'finlandn';
      if (inList(n, 'Uusimaa|Finland Proper|Satakunta|Tavastia Proper|Päijät-Häme|Pirkanmaa|Kymenlaakso|South Karelia')) return 'finlands';
      return 'finlandc';
    case 'GEO':
      return 'georgia';
    case 'ARM':
      return 'erivan';
    case 'AZE':
      return 'baku';
    case 'ITA':
    case 'VAT':
    case 'SMR':
      if (d.adm0 === 'VAT') return 'lazio';
      if (d.adm0 === 'SMR') return 'emilia';
      if (inList(n, 'Trieste|Gorizia')) return 'littoral';
      if (g === 'Trentino-Alto Adige') return 'tyrol';
      return (
        {
          Piemonte: 'piedmont',
          "Valle d'Aosta": 'piedmont',
          Lombardia: 'lombardy',
          Veneto: 'venetia',
          'Friuli-Venezia Giulia': 'venetia',
          Liguria: 'liguria',
          'Emilia-Romagna': 'emilia',
          Toscana: 'tuscany',
          Marche: 'marche',
          Umbria: 'marche',
          Lazio: 'lazio',
          Abruzzo: 'abruzzo',
          Molise: 'abruzzo',
          Campania: 'campania',
          Apulia: 'apulia',
          Basilicata: 'calabria',
          Calabria: 'calabria',
          Sicily: 'sicily',
          Sardegna: 'sardinia',
        } as Record<string, string>
      )[g];
    case 'LBY':
      return lon < 18.5 ? 'tripolitania' : 'cyrenaica';
    case 'AUT':
      return ({ Wien: 'loweraustria', Niederösterreich: 'loweraustria', Oberösterreich: 'upperaustria', Salzburg: 'upperaustria', Tirol: 'tyrol', Vorarlberg: 'tyrol', Steiermark: 'styria', Kärnten: 'styria', Burgenland: 'transdanubia' } as Record<string, string>)[n];
    case 'LIE':
      return 'switzerland';
    case 'CZE':
      return inList(n, 'Olomoucký|Moravskoslezský|Jihomoravský|Zlínský') || (n === 'Vysočina' && lon > 15.6) ? 'moravia' : 'bohemia';
    case 'SVK':
      return inList(n, 'Bratislavský|Trnavský|Nitriansky') ? 'transdanubia' : inList(n, 'Košický|Prešov') ? 'northhungary' : 'upperhungary';
    case 'HUN':
      if (g === 'Central Hungary') return 'budapest';
      if (g.includes('Transdanubia')) return 'transdanubia';
      if (g === 'Northern Hungary') return 'northhungary';
      return 'alfold';
    case 'SVN':
      return g === 'Obalno-kraška' || g === 'Goriška' ? 'littoral' : g === 'Koroška' || g === 'Podravska' || g === 'Pomurska' ? 'styria' : 'carniola';
    case 'HRV':
      if (n === 'Istarska') return 'littoral';
      if (inList(n, 'Dubrovacko-Neretvanska|Splitsko-Dalmatinska|Šibensko-Kninska|Zadarska')) return 'dalmatia';
      return 'croatia';
    case 'BIH':
      return 'bosnia';
    case 'ROU':
      if (inList(n, 'Timis|Caras-Severin|Arad')) return 'banat';
      if (inList(n, 'Alba|Bihor|Bistrita-Nasaud|Brasov|Cluj|Covasna|Harghita|Hunedoara|Maramures|Mures|Salaj|Satu Mare|Sibiu')) return 'transylvania';
      if (inList(n, 'Constanta|Tulcea')) return 'dobruja';
      if (inList(n, 'Mehedinti|Dolj|Gorj|Olt|Vâlcea')) return 'oltenia';
      if (inList(n, 'Suceava|Botosani|Iasi|Neamt|Bacau|Vaslui|Galati|Vrancea')) return 'moldavia';
      return 'wallachia';
    case 'BGR':
      if (inList(n, 'Dobrich|Silistra')) return 'dobruja';
      if (inList(n, 'Sofia|Grad Sofiya|Pernik|Kyustendil')) return 'sofia';
      if (inList(n, 'Blagoevgrad|Smolyan|Kardzhali')) return 'pirin';
      if (inList(n, 'Vidin|Montana|Vratsa|Pleven|Lovech|Veliko Tarnovo|Gabrovo|Ruse|Razgrad|Targovishte|Shumen|Varna')) return 'danubebul';
      return 'rumelia';
    case 'SRB':
      if (g === '' && inList(n, 'Severno-Banatski|Srednje-Banatski|Južno-Banatski|Sremski')) return 'banat';
      if (inList(g, 'Severno-Bački|Zapadno-Bački|Južno-Bački')) return 'banat';
      if (inList(n, 'Raški|Zlatiborski|Moravicki') && lat < 43.4) return 'kosovo';
      if (inList(n, 'Nišavski|Pirotski|Jablanicki|Pcinjski|Toplicki|Zajecarski|Borski')) return 'nis';
      return 'belgrade';
    case 'KOS':
      // the west (Peć, Đakovica) went to Montenegro in 1913, the rest to Serbia
      return g === 'Peć' || g === 'Đakovica' ? 'montenegro' : 'kosovo';
    case 'MKD':
      return 'macedonia';
    case 'MNE':
      return 'montenegro';
    case 'ALB':
      return 'albania';
    case 'GRC':
      if (n === 'Anatoliki Makedonia kai Thraki') return lon > 24.8 ? 'wthrace' : 'grmacedonia';
      if (n === 'Notio Aigaio') return lon > 26.6 && lat < 37.5 ? 'dodecanese' : 'aegean';
      if (inList(n, 'Kentriki Makedonia|Dytiki Makedonia|Ayion Oros')) return 'grmacedonia';
      if (n === 'Ipeiros') return 'epirus';
      if (n === 'Thessalia') return 'thessaly';
      if (inList(n, 'Peloponnisos|Dytiki Ellada')) return 'peloponnese';
      if (n === 'Kriti') return 'crete';
      if (n === 'Voreio Aigaio') return 'aegean';
      if (n === 'Ionioi Nisoi') return 'ionian';
      return 'attica';
    case 'TUR':
      if (inList(n, 'Kars|Ardahan|Artvin|Iğdir')) return 'kars';
      if (inList(n, 'Edirne|Kirklareli|Tekirdag|Istanbul')) return 'thrace';
      if (inList(n, 'Bursa|Balikesir|Çanakkale|Bilecik|Kütahya|Eskisehir|Yalova|Kocaeli|Sakarya')) return 'hudavendigar';
      if (inList(n, 'Izmir|Manisa|Aydin|Mugla|Denizli|Usak')) return 'aydin';
      if (inList(n, 'Konya|Karaman|Afyonkarahisar|Isparta|Burdur|Antalya|Aksaray|Nigde')) return 'konya';
      if (inList(n, 'Ankara|Kirsehir|Yozgat|Kayseri|Kinkkale|Nevsehir|Çankiri')) return 'ankara';
      if (inList(n, 'Kastamonu|Sinop|Bolu|Zinguldak|Karabük|Bartın|Düzce')) return 'kastamonu';
      if (inList(n, 'Sivas|Tokat|Amasya|Çorum')) return 'sivas';
      if (inList(n, 'Trabzon|Rize|Giresun|Ordu|Samsun|Gümüshane|Bayburt')) return 'trebizond';
      if (inList(n, 'Erzurum|Erzincan|Agri|Bingöl')) return 'erzurum';
      if (inList(n, 'Van|Hakkari|Bitlis|Mus')) return 'van';
      if (inList(n, 'Diyarbakir|Mardin|Siirt|Batman|Sirnak|Sanliurfa')) return 'diyarbekir';
      if (inList(n, 'Elazig|Malatya|Tunceli|Adiyaman')) return 'mamuret';
      if (inList(n, 'Adana|Mersin|Osmaniye|K. Maras')) return 'adana';
      if (inList(n, 'Gaziantep|Kilis|Hatay')) return 'aleppo';
      return undefined;
    case 'SYR':
      if (inList(n, 'Aleppo|Idlib')) return 'aleppo';
      if (inList(n, 'Hasaka (Al Haksa)|Ar Raqqah|Dayr Az Zawr')) return 'zor';
      if (inList(n, 'Lattakia|Tartus')) return 'beirut';
      return 'syria';
    case 'LBN':
      return 'beirut';
    case 'ISR':
    case 'PSX':
      return d.adm0 === 'ISR' && inList(n, 'HaZafon|Haifa') ? 'beirut' : 'jerusalem';
    case 'JOR':
      return 'transjordan';
    case 'SAU':
      return 'arabia';
    case 'IRQ':
      if (inList(n, 'Dihok|Arbil|As-Sulaymaniyah|Ninawa|At-Ta\'mim')) return 'mosul';
      if (inList(n, 'Al-Basrah|Maysan|Dhi-Qar|Al-Muthannia')) return 'basra';
      return 'baghdad';
    case 'KWT':
      // a British protectorate since 1899, not Ottoman: left off the campaign
      return null;
    case 'IRN':
      if (inList(n, 'West Azarbaijan|East Azarbaijan|Ardebil|Zanjan')) return 'tabriz';
      if (inList(n, 'Gilan|Mazandaran')) return 'gilan';
      if (inList(n, 'Tehran|Qazvin|Alborz|Markazi|Qom|Esfahan')) return 'tehran';
      if (inList(n, 'Kordestan|Kermanshah|Hamadan|Ilam')) return 'hamadan';
      return 'khuzestan';
    case 'NLD':
      return inList(n, 'Noord-Holland|Zuid-Holland|Utrecht|Zeeland|Flevoland') ? 'holland' : 'nleast';
    case 'BEL':
      return g === 'Walloon' ? 'wallonia' : 'flanders';
    case 'LUX':
      return 'luxembourg';
    case 'CHE':
      return 'switzerland';
    case 'NOR':
      if (inList(n, 'Nordland|Troms|Finnmark')) return 'northnorway';
      if (inList(n, 'Møre og Romsdal|Sør-Trøndelag|Nord-Trøndelag')) return 'trondelag';
      if (inList(n, 'Aust-Agder|Vest-Agder|Rogaland|Hordaland|Sogn og Fjordane')) return 'westnorway';
      return 'eastnorway';
    case 'SWE':
      if (inList(n, 'Norrbotten|Västerbotten')) return 'norrlandn';
      if (inList(n, 'Gävleborg|Jämtland|Västernorrland')) return 'norrlands';
      if (inList(n, 'Skåne|Blekinge|Kronoberg|Kalmar|Jönköping')) return 'smaland';
      if (inList(n, 'Västra Götaland|Halland|Östergötland|Gotland')) return 'gotaland';
      return 'svealand';
    case 'TKM':
    case 'UZB':
    case 'GRL':
      return null;
  }
  return undefined;
}

// ───────────────────────────── names, ridges, straits ──────────────────────

export const NAMES: Record<string, string> = {
  'St. Petersburg': 'St Petersburg',
  'St.  Petersburg': 'St Petersburg',
  Istanbul: 'Constantinople',
  Izmir: 'Smyrna',
  'İzmir': 'Smyrna',
  Oslo: 'Kristiania',
  Helsinki: 'Helsingfors',
  Tallinn: 'Reval',
  Vilnius: 'Vilna',
  Kaunas: 'Kovno',
  'Chişinău': 'Kishinev',
  Chisinau: 'Kishinev',
  'Lviv': 'Lemberg',
  "L'viv": 'Lemberg',
  Bratislava: 'Pressburg',
  Ljubljana: 'Laibach',
  Zagreb: 'Agram',
  Gdańsk: 'Danzig',
  Gdansk: 'Danzig',
  Wrocław: 'Breslau',
  Wroclaw: 'Breslau',
  Szczecin: 'Stettin',
  Poznań: 'Posen',
  Poznan: 'Posen',
  Kaliningrad: 'Königsberg',
  Bydgoszcz: 'Bromberg',
  Toruń: 'Thorn',
  Olsztyn: 'Allenstein',
  Katowice: 'Kattowitz',
  Opole: 'Oppeln',
  Volgograd: 'Tsaritsyn',
  'Nizhny Novgorod': 'Nizhny Novgorod',
  Samara: 'Samara',
  Dnipropetrovsk: 'Ekaterinoslav',
  Dnipro: 'Ekaterinoslav',
  Donetsk: 'Yuzovka',
  Luhansk: 'Lugansk',
  Kyiv: 'Kiev',
  Kharkiv: 'Kharkov',
  Odesa: 'Odessa',
  Zaporizhzhya: 'Alexandrovsk',
  Zaporizhia: 'Alexandrovsk',
  'Kirovohrad': 'Elisavetgrad',
  Kropyvnytskyi: 'Elisavetgrad',
  Chernivtsi: 'Czernowitz',
  'Ivano-Frankivsk': 'Stanislau',
  Tbilisi: 'Tiflis',
  Yerevan: 'Erivan',
  Ganja: 'Elisavetpol',
  Thessaloniki: 'Salonica',
  Plovdiv: 'Philippopolis',
  Edirne: 'Adrianople',
  Bursa: 'Brusa',
  Ankara: 'Angora',
  Trabzon: 'Trebizond',
  Iskenderun: 'Alexandretta',
  Antakya: 'Antioch',
  'Cluj-Napoca': 'Kolozsvár',
  Timişoara: 'Temesvár',
  Timisoara: 'Temesvár',
  Oradea: 'Nagyvárad',
  Brasov: 'Brassó',
  'Braşov': 'Brassó',
  'Novi Sad': 'Újvidék',
  Subotica: 'Szabadka',
  Rijeka: 'Fiume',
  Pula: 'Pola',
  Split: 'Spalato',
  Zadar: 'Zara',
  Koper: 'Capodistria',
  Bolzano: 'Bozen',
  Trento: 'Trient',
  Durrës: 'Durazzo',
  Shkodër: 'Scutari',
  Podgorica: 'Cetinje',
  'Bitola': 'Monastir',
  Skopje: 'Üsküb',
  Tartu: 'Dorpat',
  Jelgava: 'Mitau',
  Liepāja: 'Libau',
  Daugavpils: 'Dvinsk',
  Klaipėda: 'Memel',
  Klaipeda: 'Memel',
  Turku: 'Åbo',
  Tampere: 'Tammerfors',
  Oulu: 'Uleåborg',
  Vyborg: 'Viborg',
  København: 'Copenhagen',
  'Den Haag': 'The Hague',
  Antwerpen: 'Antwerp',
  Gent: 'Ghent',
  Liège: 'Liège',
  Tehran: 'Tehran',
  'Al Iskandariyah': 'Alexandria',
  'Bur Sa`id': 'Port Said',
  Tripoli: 'Tripoli',
  Benghazi: 'Benghazi',
  Kenitra: 'Port Lyautey',
  Tétouan: 'Tetuán',
  'Beer Sheva': 'Beersheba',
  'Tel Aviv-Yafo': 'Jaffa',
  'Tel Aviv': 'Jaffa',
  Mykolayiv: 'Nikolaev',
  Mykolaiv: 'Nikolaev',
  Mariupol: 'Mariupol',
  Sevastopol: 'Sevastopol',
  Ufa: 'Ufa',
  Sovetsk: 'Tilsit',
  Chernyakhovsk: 'Insterburg',
  Gusev: 'Gumbinnen',
  Baltiysk: 'Pillau',
  Koszalin: 'Köslin',
  Grudziądz: 'Graudenz',
  Grudziadz: 'Graudenz',
  Inowrocław: 'Hohensalza',
  Inowroclaw: 'Hohensalza',
  'Zielona Góra': 'Grünberg',
  'Zielona Gora': 'Grünberg',
  'Gorzów Wielkopolski': 'Landsberg',
  'Gorzow Wielkopolski': 'Landsberg',
  Słupsk: 'Stolp',
  Slupsk: 'Stolp',
  Elbląg: 'Elbing',
  Elblag: 'Elbing',
  Legnica: 'Liegnitz',
  Wałbrzych: 'Waldenburg',
  Walbrzych: 'Waldenburg',
  Gliwice: 'Gleiwitz',
  Bytom: 'Beuthen',
  Racibórz: 'Ratibor',
  'Jelenia Góra': 'Hirschberg',
  Piła: 'Schneidemühl',
  Pila: 'Schneidemühl',
  Gniezno: 'Gnesen',
  Leszno: 'Lissa',
  Kołobrzeg: 'Kolberg',
  Kolobrzeg: 'Kolberg',
  Świnoujście: 'Swinemünde',
  Malbork: 'Marienburg',
  Ełk: 'Lyck',
  Elk: 'Lyck',
  Kętrzyn: 'Rastenburg',
  'Bielsko-Biała': 'Bielitz',
  'Bielsko-Biala': 'Bielitz',
  'České Budějovice': 'Budweis',
  'Ceske Budejovice': 'Budweis',
  'Hradec Králové': 'Königgrätz',
  'Hradec Kralove': 'Königgrätz',
  Plzeň: 'Pilsen',
  Plzen: 'Pilsen',
  'Ústí nad Labem': 'Aussig',
  'Usti nad Labem': 'Aussig',
  Liberec: 'Reichenberg',
  Olomouc: 'Olmütz',
  Brno: 'Brünn',
  Ostrava: 'Mährisch-Ostrau',
  Jihlava: 'Iglau',
  'Karlovy Vary': 'Karlsbad',
  Kraków: 'Cracow',
  Krakow: 'Cracow',
  Košice: 'Kassa',
  Kosice: 'Kassa',
  Žilina: 'Zsolna',
  Zilina: 'Zsolna',
  Zvolen: 'Zólyom',
  Trnava: 'Nagyszombat',
  Nitra: 'Nyitra',
  'Banská Bystrica': 'Besztercebánya',
  'Banska Bystrica': 'Besztercebánya',
  Prešov: 'Eperjes',
  Presov: 'Eperjes',
  Sibiu: 'Nagyszeben',
  'Târgu Mureş': 'Marosvásárhely',
  'Tirgu Mures': 'Marosvásárhely',
  'Satu Mare': 'Szatmárnémeti',
  'Baia Mare': 'Nagybánya',
  Osijek: 'Eszék',
  Maribor: 'Marburg',
  Celje: 'Cilli',
  Uzhhorod: 'Ungvár',
  Mukacheve: 'Munkács',
  Pärnu: 'Pernau',
  Narva: 'Narva',
  Šiauliai: 'Shavli',
  Siauliai: 'Shavli',
  Panevėžys: 'Ponevezh',
  Panevezys: 'Ponevezh',
  Rēzekne: 'Rezhitsa',
  Rezekne: 'Rezhitsa',
  Hrodna: 'Grodno',
  Brest: 'Brest-Litovsk',
  Rivne: 'Rovno',
  Zhytomyr: 'Zhitomir',
  Vinnytsya: 'Vinnitsa',
  Vinnytsia: 'Vinnitsa',
  "Khmel'nyts'kyy": 'Proskurov',
  Khmelnytskyi: 'Proskurov',
  Ternopil: 'Tarnopol',
  Chernihiv: 'Chernigov',
  Kremenchuk: 'Kremenchug',
  Cherkasy: 'Cherkassy',
  Arkhangelsk: 'Archangel',
  "Arkhangel'sk": 'Archangel',
  Kirov: 'Vyatka',
  'Yoshkar-Ola': 'Tsarevokokshaysk',
  Ulyanovsk: 'Simbirsk',
  "Ul'yanovsk": 'Simbirsk',
  Oryol: 'Orel',
  Ivanovo: 'Ivanovo-Voznesensk',
  'Veliky Novgorod': 'Novgorod',
  Makhachkala: 'Petrovsk-Port',
  Krasnodar: 'Ekaterinodar',
  Petrozavodsk: 'Petrozavodsk',
  Mahilyow: 'Mogilev',
  Homyel: 'Gomel',
  Babruysk: 'Bobruisk',
  Vitsyebsk: 'Vitebsk',
  Kirovograd: 'Elisavetgrad',
  "Dnipropetrovs'k": 'Ekaterinoslav',
  Simferopol: 'Simferopol',
  Gaziantep: 'Aintab',
  Kahramanmaraş: 'Marash',
  Kahramanmaras: 'Marash',
  Şanlıurfa: 'Urfa',
  Sanliurfa: 'Urfa',
  Diyarbakır: 'Diyarbekir',
  Diyarbakir: 'Diyarbekir',
  Elazığ: 'Harput',
  Elazig: 'Harput',
  Afyon: 'Karahisar',
  Afyonkarahisar: 'Karahisar',
  Manisa: 'Magnesia',
  Balıkesir: 'Karesi',
  Balikesir: 'Karesi',
  İzmit: 'Ismid',
  Izmit: 'Ismid',
  Antalya: 'Adalia',
  Ioannina: 'Janina',
  Ruse: 'Rustchuk',
  Vlorë: 'Valona',
  Vlore: 'Valona',
  Korçë: 'Koritza',
  Korce: 'Koritza',
  Shkoder: 'Scutari',
  Alger: 'Algiers',
  Annaba: 'Bône',
  Skikda: 'Philippeville',
  Béjaïa: 'Bougie',
  Bejaia: 'Bougie',
  Chlef: 'Orléansville',
  Fès: 'Fez',
  Fes: 'Fez',
  Marrakech: 'Marrakesh',
  Tanger: 'Tangier',
  Rasht: 'Resht',
  Qazvin: 'Kazvin',
  Derry: 'Londonderry',
  'Dún Laoghaire': 'Kingstown',
  Wuppertal: 'Elberfeld',
  Mönchengladbach: 'München-Gladbach',
  Monchengladbach: 'München-Gladbach',
  Göteborg: 'Gothenburg',
  Goteborg: 'Gothenburg',
  Trondheim: 'Trondhjem',
  Vaasa: 'Vasa',
  Lappeenranta: 'Villmanstrand',
  Aarhus: 'Aarhus',
};

export const NOT_YET = ['Murmansk', 'Leverkusen', 'Wolfsburg', 'Salzgitter', 'Eisenhüttenstadt', 'Eisenhuttenstadt', 'Hoyerswerda', 'Schwedt', 'Dzerzhinsk', 'Severomorsk', 'Zelenodolsk', 'Novocheboksarsk', 'Volzhsk', 'Nova Kakhovka', 'Enerhodar', 'Sloviansk', 'Yuzhnoukrainsk', 'Netishyn', 'Kuznetsovsk', 'Varash', 'Chornomorsk', 'Pivdenne', 'Poti', 'Navoi', 'Jdeidet el Matn', 'Amman', 'Tel Aviv', 'Tel Aviv-Yafo', 'Gdynia', 'Zelenograd', 'Tolyatti', 'Dzerzhinsk', 'Novomoskovsk', 'Naberezhnyye Chelny', 'Nizhnekamsk', 'Almetyevsk', 'Volzhskiy', 'Volzhsky', 'Obninsk', 'Sumqayit', 'Rustavi', 'Nowa Huta', 'Stalowa Wola', 'Dunaújváros', 'Kryvyy Rih', 'Kryvyi Rih', 'Severodvinsk', 'Kirovsk', 'Apatity', 'Monchegorsk', 'Novopolotsk', 'Soligorsk', 'Salihorsk', 'Zhodzina', 'Lelystad', 'Almere', 'Ashdod', 'Netanya', 'Holon', 'Bat Yam', 'Petah Tiqwa', 'Rishon LeZiyyon', 'Ramat Gan', 'Bene Beraq', 'Cherkessk', 'Aktau', 'Nevinnomyssk', 'Shakhty', 'Novocherkassk', 'Elista', 'Chapaevsk', 'Novokuybyshevsk', 'Dimitrovgrad', 'Balakovo', 'Engels', 'Kaspiysk', 'Izberbash', 'Nazran', 'Magas', 'Sumgait'];

/** Mountain walls (lon, lat) crossed only at the passes. */
export const RIDGES: RealMapDef['ridges'] = [
  { name: 'Pyrenees', halfKm: 20, pts: [[-1.2, 42.95], [-0.4, 42.8], [0.6, 42.7], [1.4, 42.55], [2.2, 42.45]] },
  { name: 'Western Alps', halfKm: 22, pts: [[7.1, 44.2], [6.95, 44.75], [6.9, 45.25], [7.0, 45.75], [7.7, 45.95]] },
  { name: 'Central Alps', halfKm: 22, pts: [[7.9, 46.15], [8.6, 46.5], [9.3, 46.5], [10.1, 46.5], [10.9, 46.85], [11.8, 47.0], [12.6, 47.05]] },
  { name: 'Carpathians', halfKm: 20, pts: [[19.6, 49.25], [20.4, 49.3], [21.5, 49.35], [22.6, 49.0], [23.4, 48.6], [24.4, 48.05], [25.2, 47.6], [25.8, 46.95], [26.2, 46.2], [25.7, 45.6], [24.6, 45.55], [23.6, 45.4], [22.7, 45.25]] },
  { name: 'Balkan Mountains', halfKm: 16, pts: [[23.0, 43.35], [24.0, 42.85], [25.0, 42.75], [26.0, 42.8], [26.9, 42.85]] },
  { name: 'Greater Caucasus', halfKm: 24, pts: [[40.2, 43.4], [41.6, 43.25], [42.9, 42.95], [44.5, 42.75], [45.9, 42.25], [47.2, 41.6]] },
  { name: 'Kjølen', halfKm: 22, pts: [[18.5, 68.8], [17.4, 68.0], [16.0, 67.0], [15.2, 66.5], [14.3, 65.6], [13.6, 64.9], [13.0, 64.2], [12.5, 63.7], [12.2, 63.1], [12.3, 62.5]] },
  { name: 'Dovrefjell', halfKm: 22, pts: [[11.0, 62.6], [10.0, 62.35], [9.2, 62.2], [8.4, 61.9]] },
];
export const PASSES: RealMapDef['passes'] = [
  { name: 'Roncesvalles', lon: -1.32, lat: 43.0 },
  { name: 'Somport', lon: -0.52, lat: 42.8 },
  { name: 'Mont Cenis', lon: 6.9, lat: 45.25 },
  { name: 'Great St Bernard', lon: 7.17, lat: 45.87 },
  { name: 'Simplon', lon: 8.03, lat: 46.25 },
  { name: 'St Gotthard', lon: 8.57, lat: 46.56 },
  { name: 'Brenner', lon: 11.5, lat: 47.0 },
  { name: 'Dukla', lon: 21.68, lat: 49.4 },
  { name: 'Uzhok', lon: 22.86, lat: 49.0 },
  { name: 'Tatar Pass', lon: 24.55, lat: 48.1 },
  { name: 'Oituz', lon: 26.43, lat: 46.2 },
  { name: 'Predeal', lon: 25.58, lat: 45.5 },
  { name: 'Red Tower', lon: 24.27, lat: 45.6 },
  { name: 'Shipka', lon: 25.33, lat: 42.75 },
  { name: 'Darial', lon: 44.63, lat: 42.75 },
  { name: 'Storlien', lon: 12.25, lat: 63.3 },
  { name: 'Dovre', lon: 9.6, lat: 62.22 },
];

export const STRAITS: RealMapDef['straits'] = [
  { name: 'Strait of Dover', a: [1.5, 51.1], b: [1.85, 50.95] },
  { name: 'Strait of Gibraltar', a: [-5.6, 36.1], b: [-5.6, 35.8] },
  { name: 'Bosporus', a: [28.98, 41.05], b: [29.05, 41.0] },
  { name: 'Dardanelles', a: [26.4, 40.2], b: [26.5, 40.05] },
  { name: 'Strait of Messina', a: [15.6, 38.25], b: [15.65, 38.15] },
  { name: 'Øresund', a: [12.6, 55.95], b: [12.75, 56.05] },
  { name: 'North Channel', a: [-5.85, 54.95], b: [-5.2, 55.15] },
  { name: 'Strait of Bonifacio', a: [9.2, 41.4], b: [9.25, 41.2] },
  { name: 'Suur Strait', a: [23.0, 58.55], b: [23.45, 58.6] },
];

export const LAKES: Record<string, string> = {
  'Lake Ladoga': 'Lake Ladoga',
  'Lake Onega': 'Lake Onega',
  'Lake Peipus': 'Lake Peipus',
  'Vänern': 'Lake Vänern',
  'Vättern': 'Lake Vättern',
  'Lake Geneva': 'Lake Geneva',
  'Lake Constance': 'Lake Constance',
  'Lake Balaton': 'Lake Balaton',
  'Lake Garda': 'Lake Garda',
  'Lake Ohrid': 'Lake Ohrid',
  'Lake Van': 'Lake Van',
  'Lake Urmia': 'Lake Urmia',
  'Lake Sevan': 'Lake Sevan',
  'Lake Tuz': 'Lake Tuz',
  'Saimaa': 'Lake Saimaa',
  'Lough Neagh': 'Lough Neagh',
  'Lake Ilmen': 'Lake Ilmen',
  'Rybinsk Reservoir': 'Rybinsk',
};

export const RIVERS: Record<string, string> = {
  Rhine: 'Rhine',
  Rhein: 'Rhine',
  Danube: 'Danube',
  Donau: 'Danube',
  Elbe: 'Elbe',
  Oder: 'Oder',
  Odra: 'Oder',
  Vistula: 'Vistula',
  Wisła: 'Vistula',
  Loire: 'Loire',
  Seine: 'Seine',
  Rhône: 'Rhône',
  Garonne: 'Garonne',
  Po: 'Po',
  Tagus: 'Tagus',
  Tajo: 'Tagus',
  Ebro: 'Ebro',
  Douro: 'Douro',
  Duero: 'Douro',
  Guadalquivir: 'Guadalquivir',
  Dnieper: 'Dnieper',
  Dniester: 'Dniester',
  Don: 'Don',
  Volga: 'Volga',
  'Western Dvina': 'Dvina',
  Daugava: 'Dvina',
  Neman: 'Niemen',
  Nemunas: 'Niemen',
  Weser: 'Weser',
  Meuse: 'Meuse',
  Maas: 'Meuse',
  Thames: 'Thames',
  Severn: 'Severn',
  Tigris: 'Tigris',
  Euphrates: 'Euphrates',
  Nile: 'Nile',
  Kızılırmak: 'Kızılırmak',
  Sakarya: 'Sakarya',
  Maritsa: 'Maritsa',
  Vardar: 'Vardar',
  Prut: 'Prut',
  Sava: 'Sava',
  Tisza: 'Tisza',
  Drava: 'Drava',
  Bug: 'Bug',
  Kuban: 'Kuban',
  Terek: 'Terek',
  Kura: 'Kura',
  'Northern Dvina': 'Northern Dvina',
  Neva: 'Neva',
};

export const ISLAND_NAMES: Array<[string, number, number]> = [
  ['Great Britain', -2, 54],
  ['Ireland', -8, 53.3],
  ['Iceland', -19, 64.9],
  ['Sicily', 14.2, 37.5],
  ['Sardinia', 9.0, 40.0],
  ['Corsica', 9.1, 42.1],
  ['Crete', 24.9, 35.2],
  ['Cyprus', 33.2, 35.0],
  ['Zealand', 11.8, 55.5],
  ['Funen', 10.3, 55.3],
  ['Gotland', 18.5, 57.5],
  ['Öland', 16.6, 56.7],
  ['Bornholm', 14.9, 55.1],
  ['Saaremaa', 22.5, 58.4],
  ['Majorca', 3.0, 39.6],
  ['Minorca', 4.1, 39.95],
  ['Ibiza', 1.4, 38.95],
  ['Malta', 14.4, 35.9],
  ['Rhodes', 28.0, 36.2],
  ['Euboea', 23.8, 38.6],
  ['Lesbos', 26.3, 39.2],
  ['Chios', 26.0, 38.4],
  ['Corfu', 19.9, 39.6],
  ['Kefalonia', 20.5, 38.2],
  ['Isle of Man', -4.5, 54.2],
  ['Isle of Wight', -1.3, 50.7],
  ['Anglesey', -4.3, 53.3],
  ['Lewis', -6.5, 58.2],
  ['Skye', -6.2, 57.3],
  ['Mull', -5.9, 56.45],
  ['Orkney', -3.0, 59.0],
  ['Shetland', -1.2, 60.3],
  ['Faroe Islands', -6.9, 62.0],
  ['Lofoten', 13.8, 68.2],
  ['Senja', 17.5, 69.3],
  ['Hinnøya', 16.0, 68.6],
  ['Åland', 20.0, 60.2],
  ['Hiiumaa', 22.6, 58.9],
  ['Djerba', 10.9, 33.8],
  ['Rügen', 13.4, 54.4],
  ['Crimea', 34.0, 45.0],
];

export const SEAS: Array<[string, number, number, number?]> = [
  ['North Sea', 3.5, 56.0, 34],
  ['Baltic Sea', 19.0, 56.5, 32],
  ['Norwegian Sea', 3.0, 66.0, 34],
  ['Barents Sea', 40.0, 70.6, 28],
  ['Atlantic Ocean', -18.0, 47.0, 38],
  ['Bay of Biscay', -5.0, 45.3, 26],
  ['Mediterranean Sea', 18.0, 34.5, 36],
  ['Tyrrhenian Sea', 12.0, 40.0, 24],
  ['Adriatic Sea', 15.8, 42.8, 22],
  ['Aegean Sea', 25.0, 38.8, 24],
  ['Ionian Sea', 18.5, 37.6, 24],
  ['Black Sea', 34.5, 43.2, 32],
  ['Caspian Sea', 50.5, 42.0, 28],
  ['Sea of Azov', 36.6, 46.2, 18],
  ['Gulf of Bothnia', 20.5, 62.8, 22],
  ['Gulf of Finland', 26.0, 59.85, 18],
  ['English Channel', -2.3, 50.0, 20],
  ['Irish Sea', -5.0, 53.7, 20],
  ['White Sea', 37.5, 65.6, 20],
  ['Levantine Sea', 32.0, 33.5, 22],
];

export const DEPOSIT_HINTS: RealMapDef['depositHints'] = [
  { kind: 'coal', lon: 7.2, lat: 51.45, km: 90, weight: 6 }, // Ruhr
  { kind: 'coal', lon: 18.9, lat: 50.3, km: 90, weight: 5 }, // Upper Silesia
  { kind: 'coal', lon: 3.2, lat: 50.4, km: 90, weight: 5 }, // Nord-Pas-de-Calais and Hainaut
  { kind: 'coal', lon: -3.4, lat: 51.65, km: 70, weight: 5 }, // South Wales
  { kind: 'coal', lon: -1.6, lat: 53.6, km: 120, weight: 5 }, // Yorkshire and Lancashire
  { kind: 'coal', lon: 38.0, lat: 48.0, km: 140, weight: 6 }, // Donets
  { kind: 'coal', lon: 6.9, lat: 49.3, km: 60, weight: 4 }, // Saar
  { kind: 'iron', lon: 6.0, lat: 49.3, km: 70, weight: 6 }, // Lorraine minette
  { kind: 'iron', lon: 20.2, lat: 67.85, km: 90, weight: 6 }, // Kiruna
  { kind: 'iron', lon: 33.4, lat: 47.9, km: 90, weight: 5 }, // Krivoy Rog
  { kind: 'iron', lon: -3.0, lat: 43.2, km: 70, weight: 4 }, // Bilbao
  { kind: 'iron', lon: 15.0, lat: 47.5, km: 60, weight: 4 }, // Erzberg
  { kind: 'oil', lon: 49.8, lat: 40.4, km: 90, weight: 8 }, // Baku
  { kind: 'oil', lon: 26.0, lat: 44.95, km: 70, weight: 7 }, // Ploiești
  { kind: 'oil', lon: 23.5, lat: 49.3, km: 60, weight: 6 }, // Borysław (Galicia)
  { kind: 'oil', lon: 44.4, lat: 35.5, km: 120, weight: 5 }, // Kirkuk
  { kind: 'oil', lon: 45.7, lat: 43.3, km: 70, weight: 5 }, // Grozny
  { kind: 'oil', lon: 48.9, lat: 31.95, km: 90, weight: 6 }, // Masjed Soleyman
  { kind: 'nitrates', lon: 9.0, lat: 33.5, km: 200, weight: 4 }, // Tunisian phosphates
];

/** The frame: Ireland and Portugal to the Volga and Tehran; the North Cape to the Nile delta and the Sahara's edge. */
export const BOX = { west: -11, east: 53, south: 29.5, north: 71.6 };
export function inCrop(lon: number, lat: number): boolean {
  if (lat < BOX.south || lat > BOX.north || lon < BOX.west || lon > BOX.east) return false;
  // the east: to the Volga at 50° E; Persia's north-west, with Tehran, to 52.5° E
  if (lon > 50 && !(lat > 33 && lat < 38.2 && lon <= 52.5)) return false;
  // the south: the Mediterranean shore and the Nile delta; Arabia's northern rim
  if (lat < 30.6 && lon > 34 && lon < 46) return false;
  return true;
}

export function europeDef(): RealMapDef {
  return {
    id: 'europe',
    revision: 1,
    startYear: 1914,
    campaignYears: { options: [20, 30, 40], default: 30 },
    nations: NATIONS,
    regions: REGIONS,
    capitals: CAPITALS,
    classify,
    proj: lambert(15, 50, 38, 62),
    box: BOX,
    inCrop,
    km: 0.72,
    provKm2: 12500,
    minIslandKm2: 1300,
    minLakeKm2: 900,
    regionalKm2: 60000,
    land: 'land50',
    lakes: LAKES,
    rivers: RIVERS,
    riverMinKm: 220,
    ridges: RIDGES,
    passes: PASSES,
    islandNames: ISLAND_NAMES,
    seas: SEAS,
    names: NAMES,
    notYet: NOT_YET,
    straits: STRAITS,
    straitMaxKm: 140,
    cities: { max: 120, minPop: 150000, spacingKm: 90 },
    depositHints: DEPOSIT_HINTS,
    climate: 'temperate',
    meta: {
      name: 'Europe, 1914',
      description:
        'Europe in the spring of 1914, from Ireland to the Volga and from the North Cape to the Nile delta: the great powers, the Balkan kingdoms newly redrawn by the wars of 1912–13, and the Ottoman Empire on the straits. Historical borders, approximated from present-day divisions; Egypt and Cyprus are held by Britain.',
      blurb: 'A large historical campaign: about 600 provinces and 23 realms on the eve of the Great War.',
      size: 'large',
      difficulty: 'hard',
      style: 'Great-power alliances on crowded fronts',
      mechanics: ['Real geography', 'Historical borders of 1914', 'Mountain passes', 'Straits and islands', 'River crossings'],
      origin: 'builtin',
      attribution: [
        'Coastlines, lakes, rivers, first-level divisions and towns: Natural Earth (naturalearthdata.com), public domain.',
        'Borders of 1914 approximated from present-day divisions; historical names, ridges, passes and straits are authored (tools/europe.data.ts). Arms are simplified, in national colours.',
      ],
    },
  };
}
