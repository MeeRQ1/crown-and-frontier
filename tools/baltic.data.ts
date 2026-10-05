// Authored data for "The Baltic, 1906" (tools/genbaltic.ts). Everything
// geographic comes from Natural Earth; this file holds what Natural Earth
// cannot provide:
//  - the realms of 1906;
//  - which present-day first-level division belonged to which realm and
//    province in 1906 (with the few divisions split by a line, noted below);
//  - the names in use in 1906 for places, rivers and seas renamed since;
//  - the high Scandes ridges and their passes;
//  - island and sea names, and realm traits.
// Borders follow present-day divisions where they match those of 1906, and
// approximate them where they do not (North Schleswig, the Posen and Congress
// Poland line, Memelland, the Karelian Isthmus): good enough for a campaign
// map, not a historical atlas.

import type { NationDef, Terrain } from '../src/sim/types';

export type Realm = 'swe' | 'nor' | 'dan' | 'ger' | 'rus';

export const NATIONS: NationDef[] = [
  {
    id: 'swe',
    name: 'Kingdom of Sweden',
    short: 'Sweden',
    adjective: 'Swedish',
    color: '#3f6fa8',
    capital: 'stockholm',
    personality: 'defensive',
    emblem: 'crown',
    summary: 'A long kingdom of forest, ore and timber, newly parted from Norway, with a navy guarding the Baltic coast.',
    strength: 'Iron ore and timber: industry starts cheaply.',
    constraint: 'Long, thinly settled north: distances weigh on every campaign.',
    traits: { devCostMul: -0.1, supplyProdMul: -0.1 },
    startType: 'Established crown',
    rating: 'standard',
    arms: { field: 'realm', ordinary: 'cross', ordinaryTincture: 'or', charge: 'crown', chargeTincture: 'or' },
  },
  {
    id: 'nor',
    name: 'Kingdom of Norway',
    short: 'Norway',
    adjective: 'Norwegian',
    color: '#a8453a',
    capital: 'kristiania',
    personality: 'commercial',
    emblem: 'ship',
    summary: 'Independent since 1905: a seafaring kingdom of fjords and mountains whose merchant fleet sails every sea.',
    strength: 'Shipping: trade pays more, and straits cost less to cross.',
    constraint: 'Mountains and few people: a small army.',
    traits: { tradeMul: 0.3, straitCostAdd: -1, manpowerMul: -0.15 },
    startType: 'Maritime trader',
    rating: 'challenging',
    arms: { field: 'realm', ordinary: 'cross', ordinaryTincture: 'argent', charge: 'ship', chargeTincture: 'or' },
  },
  {
    id: 'dan',
    name: 'Kingdom of Denmark',
    short: 'Denmark',
    adjective: 'Danish',
    color: '#c79a33',
    capital: 'copenhagen',
    personality: 'diplomat',
    emblem: 'crown',
    summary: 'A rich farming kingdom on its islands and Jutland, holding the straits between the Baltic and the North Sea.',
    strength: 'Dairy and trade: income and influence above its size.',
    constraint: 'Small and close to Germany: it must find friends.',
    traits: { incomeMul: 0.15, opinionAdd: 10 },
    startType: 'Maritime trader',
    rating: 'challenging',
    arms: { field: 'realm', ordinary: 'cross', ordinaryTincture: 'argent', charge: 'crown', chargeTincture: 'or' },
  },
  {
    id: 'ger',
    name: 'German Empire',
    short: 'Germany',
    adjective: 'German',
    color: '#6e5a8f',
    capital: 'berlin',
    personality: 'expansionist',
    emblem: 'crown',
    summary: 'The industrial empire of the north German plain, from the Ems to the Memel, building a fleet to rival any.',
    strength: 'Industry and research: factories and schools ahead of every neighbour.',
    constraint: 'Two seas and two fronts: every war is on more than one.',
    traits: { researchMul: 0.15, incomeMul: 0.1 },
    startType: 'Wealthy heartland',
    rating: 'recommended',
    arms: { field: 'or', ordinary: 'none', ordinaryTincture: 'or', charge: 'crown', chargeTincture: 'sable' },
  },
  {
    id: 'rus',
    name: 'Russian Empire',
    short: 'Russia',
    adjective: 'Russian',
    color: '#4e7a52',
    capital: 'stpetersburg',
    personality: 'opportunist',
    emblem: 'crown',
    summary: 'The empire’s north-western lands: the capital on the Neva, the Grand Duchy of Finland, the Baltic provinces, Lithuania and northern Poland.',
    strength: 'Vast manpower: armies are cheap to fill.',
    constraint: 'Restless borderlands: new provinces integrate slowly.',
    traits: { manpowerMul: 0.3, integrationMul: -0.25, researchMul: -0.1 },
    startType: 'Established crown',
    rating: 'standard',
    arms: { field: 'or', ordinary: 'none', ordinaryTincture: 'or', charge: 'crown', chargeTincture: 'sable' },
  },
];

export interface BalticRegion {
  id: string;
  name: string;
  realm: Realm;
  /** terrain weights for provinces without a fixed terrain */
  biome: Partial<Record<Terrain, number>>;
}

const LOWLAND = { plains: 4, forest: 1, marsh: 0.6 };
const PLAIN_FOREST = { plains: 3, forest: 2, marsh: 0.8 };
const SOUTH_SWEDEN = { forest: 3, plains: 2.2, hills: 1, marsh: 0.4 };
const NORRLAND = { forest: 3.2, hills: 1.4, marsh: 1.2 };
const NORWAY = { hills: 2.6, forest: 2, mountains: 1.1, plains: 0.4 };
const FINLAND = { forest: 3.2, marsh: 1.4, plains: 1 };
const BALTIC = { plains: 2.6, forest: 2, marsh: 1.1 };
const RUSSIA = { forest: 2.6, marsh: 1.8, plains: 1.4 };

export const REGIONS: BalticRegion[] = [
  // Sweden
  { id: 'scania', name: 'Scania', realm: 'swe', biome: LOWLAND },
  { id: 'smaland', name: 'Småland', realm: 'swe', biome: SOUTH_SWEDEN },
  { id: 'gotland', name: 'Gotland', realm: 'swe', biome: { plains: 3, forest: 1 } },
  { id: 'vastergotland', name: 'Västergötland', realm: 'swe', biome: SOUTH_SWEDEN },
  { id: 'ostergotland', name: 'Östergötland', realm: 'swe', biome: SOUTH_SWEDEN },
  { id: 'sodermanland', name: 'Södermanland', realm: 'swe', biome: SOUTH_SWEDEN },
  { id: 'uppland', name: 'Uppland', realm: 'swe', biome: SOUTH_SWEDEN },
  { id: 'vastmanland', name: 'Västmanland', realm: 'swe', biome: { forest: 3, hills: 1.5, plains: 1.5 } },
  { id: 'varmland', name: 'Värmland', realm: 'swe', biome: { forest: 3.2, hills: 1.6, plains: 0.6 } },
  { id: 'dalarna', name: 'Dalarna', realm: 'swe', biome: { forest: 3, hills: 2, marsh: 0.6 } },
  { id: 'halsingland', name: 'Hälsingland', realm: 'swe', biome: NORRLAND },
  { id: 'jamtland', name: 'Jämtland', realm: 'swe', biome: { forest: 2.6, hills: 2.2, marsh: 0.8 } },
  { id: 'angermanland', name: 'Ångermanland', realm: 'swe', biome: NORRLAND },
  { id: 'vasterbotten', name: 'Västerbotten', realm: 'swe', biome: NORRLAND },
  { id: 'norrbotten', name: 'Norrbotten', realm: 'swe', biome: { forest: 2.6, marsh: 2, hills: 1.2 } },
  // Norway
  { id: 'akershus', name: 'Akershus', realm: 'nor', biome: { forest: 2.4, plains: 1.6, hills: 1.4 } },
  { id: 'buskerud', name: 'Buskerud and Jarlsberg', realm: 'nor', biome: NORWAY },
  { id: 'hedemarken', name: 'Hedemarken', realm: 'nor', biome: { forest: 2.8, hills: 2, plains: 0.8 } },
  { id: 'bratsberg', name: 'Bratsberg', realm: 'nor', biome: NORWAY },
  { id: 'agder', name: 'Agder', realm: 'nor', biome: NORWAY },
  { id: 'stavanger', name: 'Stavanger', realm: 'nor', biome: { hills: 2.4, plains: 1, forest: 1 } },
  { id: 'bergenhus', name: 'Bergenhus', realm: 'nor', biome: NORWAY },
  { id: 'romsdal', name: 'Romsdal', realm: 'nor', biome: NORWAY },
  { id: 'trondhjem', name: 'Trondhjem', realm: 'nor', biome: { forest: 2.4, hills: 2.2, plains: 0.8 } },
  { id: 'nordland', name: 'Nordland', realm: 'nor', biome: NORWAY },
  // Denmark
  { id: 'zealand', name: 'Zealand', realm: 'dan', biome: LOWLAND },
  { id: 'funen', name: 'Funen', realm: 'dan', biome: LOWLAND },
  { id: 'bornholm', name: 'Bornholm', realm: 'dan', biome: { plains: 2, hills: 1.5 } },
  { id: 'northjutland', name: 'North Jutland', realm: 'dan', biome: { plains: 3, marsh: 1, forest: 0.6 } },
  { id: 'midjutland', name: 'Aarhus and Viborg', realm: 'dan', biome: LOWLAND },
  { id: 'southjutland', name: 'Vejle and Ribe', realm: 'dan', biome: { plains: 3, marsh: 1 } },
  // Germany
  { id: 'schleswig', name: 'Schleswig', realm: 'ger', biome: { plains: 3, marsh: 1.2 } },
  { id: 'holstein', name: 'Holstein', realm: 'ger', biome: LOWLAND },
  { id: 'frisia', name: 'Oldenburg and East Frisia', realm: 'ger', biome: { plains: 2.6, marsh: 1.8 } },
  { id: 'hanover', name: 'Hanover', realm: 'ger', biome: { plains: 3, forest: 1.4, marsh: 0.8 } },
  { id: 'altmark', name: 'Altmark', realm: 'ger', biome: LOWLAND },
  { id: 'mecklenburg', name: 'Mecklenburg', realm: 'ger', biome: LOWLAND },
  { id: 'pomerania', name: 'Pomerania', realm: 'ger', biome: PLAIN_FOREST },
  { id: 'farpomerania', name: 'Farther Pomerania', realm: 'ger', biome: PLAIN_FOREST },
  { id: 'westprussia', name: 'West Prussia', realm: 'ger', biome: PLAIN_FOREST },
  { id: 'eastprussia', name: 'East Prussia', realm: 'ger', biome: PLAIN_FOREST },
  { id: 'masuria', name: 'Masuria', realm: 'ger', biome: { forest: 2.6, plains: 1.6, marsh: 1.4 } },
  { id: 'posen', name: 'Posen', realm: 'ger', biome: LOWLAND },
  { id: 'brandenburg', name: 'Brandenburg', realm: 'ger', biome: PLAIN_FOREST },
  // Russia
  { id: 'stpetersburg', name: 'St Petersburg', realm: 'rus', biome: RUSSIA },
  { id: 'novgorod', name: 'Novgorod', realm: 'rus', biome: RUSSIA },
  { id: 'pskov', name: 'Pskov', realm: 'rus', biome: RUSSIA },
  { id: 'estland', name: 'Estland', realm: 'rus', biome: BALTIC },
  { id: 'livland', name: 'Livland', realm: 'rus', biome: BALTIC },
  { id: 'kurland', name: 'Kurland', realm: 'rus', biome: BALTIC },
  { id: 'kovno', name: 'Kovno', realm: 'rus', biome: BALTIC },
  { id: 'vilna', name: 'Vilna', realm: 'rus', biome: RUSSIA },
  { id: 'suwalki', name: 'Suwałki', realm: 'rus', biome: { forest: 2.4, plains: 2, marsh: 1 } },
  { id: 'grodno', name: 'Grodno', realm: 'rus', biome: RUSSIA },
  { id: 'minsk', name: 'Minsk', realm: 'rus', biome: RUSSIA },
  { id: 'vitebsk', name: 'Vitebsk', realm: 'rus', biome: RUSSIA },
  { id: 'mogilev', name: 'Mogilev', realm: 'rus', biome: RUSSIA },
  { id: 'plock', name: 'Płock and Łomża', realm: 'rus', biome: { plains: 3, forest: 1.4, marsh: 0.8 } },
  { id: 'nyland', name: 'Nyland', realm: 'rus', biome: FINLAND },
  { id: 'abo', name: 'Åbo and Björneborg', realm: 'rus', biome: { forest: 2.6, plains: 1.6, marsh: 0.8 } },
  { id: 'tavastehus', name: 'Tavastehus', realm: 'rus', biome: FINLAND },
  { id: 'viborg', name: 'Viborg', realm: 'rus', biome: FINLAND },
  { id: 'stmichel', name: 'St Michel', realm: 'rus', biome: FINLAND },
  { id: 'kuopio', name: 'Kuopio', realm: 'rus', biome: FINLAND },
  { id: 'vasa', name: 'Vasa', realm: 'rus', biome: { forest: 2.6, plains: 1.4, marsh: 1.4 } },
  { id: 'uleaborg', name: 'Uleåborg', realm: 'rus', biome: { forest: 2.6, marsh: 2.2 } },
  { id: 'aland', name: 'Åland', realm: 'rus', biome: { forest: 2, plains: 1 } },
  { id: 'olonets', name: 'Olonets', realm: 'rus', biome: RUSSIA },
];

const ADMIN: Record<string, Record<string, string>> = {
  SWE: {
    Skåne: 'scania',
    Blekinge: 'scania',
    Kronoberg: 'smaland',
    Jönköping: 'smaland',
    Kalmar: 'smaland',
    Gotland: 'gotland',
    'Västra Götaland': 'vastergotland',
    Halland: 'vastergotland',
    Östergötland: 'ostergotland',
    Södermanland: 'sodermanland',
    Stockholm: 'uppland',
    Uppsala: 'uppland',
    Västmanland: 'vastmanland',
    Orebro: 'vastmanland',
    Värmland: 'varmland',
    Dalarna: 'dalarna',
    Gävleborg: 'halsingland',
    Jämtland: 'jamtland',
    Västernorrland: 'angermanland',
    Västerbotten: 'vasterbotten',
    Norrbotten: 'norrbotten',
  },
  NOR: {
    Oslo: 'akershus',
    Akershus: 'akershus',
    Østfold: 'akershus',
    Buskerud: 'buskerud',
    Vestfold: 'buskerud',
    Hedmark: 'hedemarken',
    Oppland: 'hedemarken',
    Telemark: 'bratsberg',
    'Aust-Agder': 'agder',
    'Vest-Agder': 'agder',
    Rogaland: 'stavanger',
    Hordaland: 'bergenhus',
    'Sogn og Fjordane': 'bergenhus',
    'Møre og Romsdal': 'romsdal',
    'Sør-Trøndelag': 'trondhjem',
    'Nord-Trøndelag': 'trondhjem',
    Nordland: 'nordland',
  },
  DNK: { Hovedstaden: 'zealand', Sjaælland: 'zealand', Nordjylland: 'northjutland', Midtjylland: 'midjutland', Syddanmark: 'southjutland' },
  DEU: {
    'Schleswig-Holstein': 'holstein',
    Hamburg: 'holstein',
    Bremen: 'hanover',
    Niedersachsen: 'hanover',
    'Sachsen-Anhalt': 'altmark',
    'Mecklenburg-Vorpommern': 'mecklenburg',
    Brandenburg: 'brandenburg',
    Berlin: 'brandenburg',
    'Nordrhein-Westfalen': 'hanover',
  },
  POL: {
    'West Pomeranian': 'pomerania',
    Pomeranian: 'westprussia',
    'Warmian-Masurian': 'eastprussia',
    'Kuyavian-Pomeranian': 'westprussia',
    'Greater Poland': 'posen',
    Lubusz: 'brandenburg',
    Podlachian: 'grodno',
    Masovian: 'plock',
    Łódź: 'plock',
    Lublin: 'plock',
  },
  RUS: {
    Kaliningrad: 'eastprussia',
    'City of St. Petersburg': 'stpetersburg',
    Leningrad: 'stpetersburg',
    Novgorod: 'novgorod',
    Pskov: 'pskov',
    Karelia: 'olonets',
    Murmansk: 'olonets',
    "Tver'": 'novgorod',
    Smolensk: 'vitebsk',
    Bryansk: 'mogilev',
  },
  EST: {
    Harju: 'estland',
    Hiiu: 'estland',
    'Ida-Viru': 'estland',
    Järva: 'estland',
    Lääne: 'estland',
    'Lääne-Viru': 'estland',
    Rapla: 'estland',
    Saare: 'livland',
    Tartu: 'livland',
    Jõgeva: 'livland',
    Põlva: 'livland',
    Valga: 'livland',
    Viljandi: 'livland',
    Võru: 'livland',
    Pärnu: 'livland',
  },
  LTU: { Klaipedos: 'eastprussia', Taurages: 'kovno', Telšiai: 'kovno', Šiauliai: 'kovno', Kauno: 'kovno', Panevezio: 'kovno', Utenos: 'kovno', Vilniaus: 'vilna', Alytaus: 'vilna', Marijampoles: 'suwalki' },
  BLR: { Grodno: 'grodno', Brest: 'grodno', Minsk: 'minsk', 'City of Minsk': 'minsk', Vitebsk: 'vitebsk', Mogilev: 'mogilev', Gomel: 'mogilev' },
  FIN: {
    Uusimaa: 'nyland',
    'Finland Proper': 'abo',
    Satakunta: 'abo',
    'Tavastia Proper': 'tavastehus',
    'Päijät-Häme': 'tavastehus',
    Pirkanmaa: 'tavastehus',
    Kymenlaakso: 'viborg',
    'South Karelia': 'viborg',
    'Southern Savonia': 'stmichel',
    'Northern Savonia': 'kuopio',
    'North Karelia': 'kuopio',
    'Central Finland': 'vasa',
    Ostrobothnia: 'vasa',
    'Southern Ostrobothnia': 'vasa',
    'Central Ostrobothnia': 'vasa',
    'Northern Ostrobothnia': 'uleaborg',
    Kainuu: 'uleaborg',
    Lapland: 'uleaborg',
  },
};

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

/** The Daugava's latitude at a longitude (Riga to Dünaburg), the Kurland–Livland line. */
const daugava = (lon: number) => 57.03 - (lon - 24.1) * 0.42;

/**
 * The 1906 region of a land cell, from its present-day division and position;
 * null for land outside the campaign (the Low Countries).
 */
export function regionOf(adm0: string, adm1: string, lon: number, lat: number, mainland: boolean): string | null {
  if (adm0 === 'NLD' || adm0 === 'BEL') return null;
  if (adm0 === 'ALD') return 'aland';
  if (adm0 === 'LVA') {
    if (lon > 26.3 && lat < 57.0) return 'vitebsk'; // Latgale
    if (lon < 24.1 || lat < daugava(lon)) return 'kurland';
    return 'livland';
  }
  if (adm0 === 'DNK' && adm1 === 'Syddanmark') {
    if (inPoly(lon, lat, NORTH_SCHLESWIG)) return 'schleswig';
    return mainland ? 'southjutland' : 'funen';
  }
  if (adm0 === 'DNK' && adm1 === 'Hovedstaden' && lon > 14.4) return 'bornholm';
  const base = ADMIN[adm0]?.[adm1];
  if (!base) return undefined as unknown as null;
  // divisions split by a line
  if (base === 'holstein' && adm1 === 'Schleswig-Holstein' && lat > 54.28) return 'schleswig';
  if (base === 'hanover' && adm1 === 'Niedersachsen' && lon < 8.55) return 'frisia';
  if (base === 'mecklenburg' && lon >= 12.9) return 'pomerania';
  if (base === 'pomerania' && lon >= 15.6) return 'farpomerania';
  if (adm1 === 'Pomeranian' && lon < 17.45) return 'farpomerania';
  if (adm1 === 'Kuyavian-Pomeranian') return lon > 18.95 ? 'plock' : lat < 53.05 ? 'posen' : 'westprussia';
  if (adm1 === 'Greater Poland' && lon > 17.85 && lat < 52.6) return 'plock';
  if (adm1 === 'Warmian-Masurian') return lon < 19.7 ? 'westprussia' : lat < 53.95 ? 'masuria' : 'eastprussia';
  if (adm1 === 'Podlachian' && lat > 53.75) return 'suwalki';
  if (adm1 === 'Leningrad') return lat > 60.25 && lon < 30.7 ? 'viborg' : lon >= 31.0 && lat < 60.0 ? 'novgorod' : 'stpetersburg';
  if (adm1 === 'Karelia' && lat < 62.3 && lon < 31.0) return 'viborg';
  if (adm1 === 'Grodno' && lat > 54.0) return 'vilna';
  return base;
}

/** Realm capitals (Natural Earth place names). */
export const CAPITALS: Record<Realm, string> = { swe: 'Stockholm', nor: 'Oslo', dan: 'København', ger: 'Berlin', rus: 'St.  Petersburg' };

/**
 * Names in use in 1906 (in English sources of the time) for places that have
 * been renamed since; Natural Earth carries present-day names.
 */
export const NAMES_1906: Record<string, string> = {
  // capitals and great cities
  'St.  Petersburg': 'St Petersburg',
  'St. Petersburg': 'St Petersburg',
  Oslo: 'Kristiania',
  København: 'Copenhagen',
  Helsinki: 'Helsingfors',
  Tallinn: 'Reval',
  Tartu: 'Dorpat',
  Pärnu: 'Pernau',
  Kuressaare: 'Arensburg',
  Haapsalu: 'Hapsal',
  Paide: 'Weissenstein',
  Rakvere: 'Wesenberg',
  Viljandi: 'Fellin',
  Võru: 'Werro',
  Valga: 'Walk',
  'Kohtla-Järve': 'Jõhvi',
  Liepaga: 'Libau',
  Liepāja: 'Libau',
  Ventspils: 'Windau',
  Jelgava: 'Mitau',
  Daugavpils: 'Dünaburg',
  Rēzekne: 'Rositten',
  Rezekne: 'Rositten',
  Cēsis: 'Wenden',
  Cesis: 'Wenden',
  Valmiera: 'Wolmar',
  Kuldīga: 'Goldingen',
  Kuldiga: 'Goldingen',
  Tukums: 'Tuckum',
  Jēkabpils: 'Jakobstadt',
  Jekabpils: 'Jakobstadt',
  Talsi: 'Talsen',
  Bauska: 'Bauske',
  Ludza: 'Ludsen',
  Gulbene: 'Schwanenburg',
  Alūksne: 'Marienburg',
  Aluksne: 'Marienburg',
  Madona: 'Lasdohn',
  Kaunas: 'Kovno',
  Vilnius: 'Vilna',
  Klaipėda: 'Memel',
  Šiauliai: 'Shavli',
  Panevežys: 'Ponevezh',
  Panevėžys: 'Ponevezh',
  Telšiai: 'Telshi',
  Tauragė: 'Tauroggen',
  Marijampolė: 'Mariampol',
  Alytus: 'Olita',
  Utena: 'Utsiany',
  Ukmergė: 'Vilkomir',
  Mažeikiai: 'Mozheiki',
  Kaliningrad: 'Königsberg',
  Sovetsk: 'Tilsit',
  Chernyakhovsk: 'Insterburg',
  Gusev: 'Gumbinnen',
  Baltiysk: 'Pillau',
  Gdańsk: 'Danzig',
  Gdynia: 'Gdingen',
  Szczecin: 'Stettin',
  Koszalin: 'Köslin',
  Słupsk: 'Stolp',
  Kołobrzeg: 'Kolberg',
  Świnoujście: 'Swinemünde',
  Elbląg: 'Elbing',
  Olsztyn: 'Allenstein',
  Ełk: 'Lyck',
  Giżycko: 'Lötzen',
  Kętrzyn: 'Rastenburg',
  Bartoszyce: 'Bartenstein',
  Braniewo: 'Braunsberg',
  Ostróda: 'Osterode',
  Iława: 'Deutsch Eylau',
  Malbork: 'Marienburg in Westpreussen',
  Kwidzyn: 'Marienwerder',
  Chojnice: 'Konitz',
  Lębork: 'Lauenburg',
  Grudziądz: 'Graudenz',
  Toruń: 'Thorn',
  Bydgoszcz: 'Bromberg',
  Inowrocław: 'Hohensalza',
  Gniezno: 'Gnesen',
  Poznań: 'Posen',
  Piła: 'Schneidemühl',
  'Gorzów Wielkopolski': 'Landsberg an der Warthe',
  Stargard: 'Stargard in Pommern',
  'Stargard Szczeciński': 'Stargard in Pommern',
  Szczecinek: 'Neustettin',
  Wałcz: 'Deutsch Krone',
  Włocławek: 'Vlotslavsk',
  Płock: 'Płock',
  Łomża: 'Łomża',
  Białystok: 'Belostok',
  Suwałki: 'Suwalki',
  Augustów: 'Augustovo',
  Hrodna: 'Grodno',
  Vitsyebsk: 'Vitebsk',
  Mahilyow: 'Mogilev',
  Homyel: 'Gomel',
  Babruysk: 'Bobruisk',
  Barysaw: 'Borisov',
  Maladzyechna: 'Molodechno',
  Baranavichy: 'Baranovichi',
  Navahrudak: 'Novogrudok',
  Polatsk: 'Polotsk',
  Navapolatsk: 'Polotsk',
  Orsha: 'Orsha',
  Lida: 'Lida',
  Pinsk: 'Pinsk',
  Slonim: 'Slonim',
  Vawkavysk: 'Volkovysk',
  Salihorsk: 'Slutsk',
  Zhlobin: 'Zhlobin',
  Svyetlahorsk: 'Shatsilki',
  Velikiy: 'Novgorod',
  'Velikiy Novgorod': 'Novgorod',
  Vyborg: 'Viborg',
  Kolpino: 'Kolpino',
  Gatchina: 'Gatchina',
  Kingisepp: 'Yamburg',
  Sosnovyy: 'Kronstadt',
  'Sosnovyy Bor': 'Oranienbaum',
  Sortavala: 'Sordavala',
  Priozersk: 'Kexholm',
  Tosno: 'Tosno',
  Kirishi: 'Kirishi',
  Tikhvin: 'Tikhvin',
  Volkhov: 'Novaya Ladoga',
  Luga: 'Luga',
  'Staraya Russa': 'Staraya Russa',
  'Velikiye Luki': 'Velikiye Luki',
  Pskov: 'Pskov',
  // Finland (Swedish names in common use in 1906)
  Turku: 'Åbo',
  Tampere: 'Tammerfors',
  Pori: 'Björneborg',
  Vaasa: 'Vasa',
  Oulu: 'Uleåborg',
  Hämeenlinna: 'Tavastehus',
  Mikkeli: 'St Michel',
  Lahti: 'Lahtis',
  Porvoo: 'Borgå',
  Loviisa: 'Lovisa',
  Hamina: 'Fredrikshamn',
  Lappeenranta: 'Villmanstrand',
  Savonlinna: 'Nyslott',
  Rauma: 'Raumo',
  Kokkola: 'Gamlakarleby',
  Pietarsaari: 'Jakobstad',
  Raahe: 'Brahestad',
  Kajaani: 'Kajana',
  Tornio: 'Torneå',
  Kemi: 'Kemi',
  Salo: 'Salo',
  Lohja: 'Lojo',
  Tammisaari: 'Ekenäs',
  Hyvinkää: 'Hyvinge',
  Espoo: 'Esbo',
  Vantaa: 'Helsinge',
  Kotka: 'Kotka',
  Kouvola: 'Kouvola',
  Iisalmi: 'Idensalmi',
  Kristiinankaupunki: 'Kristinestad',
  Uusikaupunki: 'Nystad',
  Seinäjoki: 'Seinäjoki',
  Jyväskylä: 'Jyväskylä',
  Joensuu: 'Joensuu',
  Kuopio: 'Kuopio',
  Varkaus: 'Varkaus',
  Imatra: 'Imatra',
  // Scandinavia and Germany
  Trondheim: 'Trondhjem',
  Halden: 'Fredrikshald',
  Larvik: 'Laurvik',
  Bærum: 'Bærum',
  'Mo i Rana': 'Mo',
  Mosjøen: 'Mosjøen',
  Göteborg: 'Gothenburg',
  Århus: 'Aarhus',
  Aalborg: 'Aalborg',
  Wolfsburg: 'Fallersleben',
  Salzgitter: 'Salder',
  Eisenhüttenstadt: 'Fürstenberg',
  Schwedt: 'Schwedt',
};

/** Islands named where Natural Earth draws them (lon, lat of a point on the island). */
export const ISLANDS: Array<[string, number, number]> = [
  ['Zealand', 11.8, 55.5],
  ['Funen', 10.4, 55.3],
  ['Lolland', 11.4, 54.75],
  ['Falster', 11.95, 54.8],
  ['Møn', 12.3, 54.98],
  ['Langeland', 10.75, 54.9],
  ['Als', 9.85, 54.98],
  ['Bornholm', 14.9, 55.12],
  ['Gotland', 18.5, 57.5],
  ['Öland', 16.6, 56.7],
  ['Ösel', 22.6, 58.4],
  ['Dagö', 22.6, 58.9],
  ['Åland', 19.95, 60.2],
  ['Rügen', 13.4, 54.45],
  ['Usedom', 14.0, 53.95],
  ['Wollin', 14.6, 53.9],
  ['Fehmarn', 11.15, 54.47],
  ['Orust', 11.7, 58.2],
  ['Hisingen', 11.85, 57.75],
  ['Hitra', 8.8, 63.55],
  ['Smøla', 8.0, 63.4],
  ['Karmøy', 5.25, 59.25],
  ['Stord', 5.45, 59.8],
  ['Sotra', 5.1, 60.35],
  ['Hailuoto', 24.7, 65.0],
  ['Vendsyssel', 10.2, 57.35],
  ['Mors', 8.8, 56.8],
  ['Samsø', 10.6, 55.85],
];

/** Sea names, placed where the sea lies; sea zones take the name printed in them. */
export const SEAS: Array<[string, number, number]> = [
  ['Bothnian Bay', 23.6, 64.8],
  ['Bothnian Sea', 19.6, 61.8],
  ['Sea of Åland', 19.3, 60.0],
  ['Archipelago Sea', 21.6, 60.0],
  ['Gulf of Finland', 25.5, 59.85],
  ['Neva Bay', 28.6, 60.0],
  ['Gulf of Riga', 23.4, 57.6],
  ['Eastern Baltic', 20.2, 57.6],
  ['Gotland Deep', 18.8, 56.4],
  ['Southern Baltic', 16.4, 55.4],
  ['Bay of Danzig', 19.0, 54.65],
  ['Pomeranian Bay', 14.2, 54.15],
  ['Bay of Mecklenburg', 11.6, 54.3],
  ['Kiel Bay', 10.45, 54.6],
  ['The Sound', 12.75, 55.9],
  ['Kattegat', 11.4, 56.8],
  ['Skagerrak', 9.4, 57.9],
  ['Kristiania Fjord', 10.6, 59.3],
  ['German Bight', 7.8, 54.3],
  ['North Sea', 5.5, 56.8],
  ['Norwegian Sea', 6.0, 63.5],
  ['Hanö Bay', 14.6, 55.75],
];

/** Natural Earth river names (some lost their letters) → 1906 English names. */
export const RIVERS: Record<string, string> = {
  Vistula: 'Vistula',
  Oder: 'Oder',
  Elbe: 'Elbe',
  Weser: 'Weser',
  Ems: 'Ems',
  Warta: 'Warthe',
  Neman: 'Niemen',
  Neris: 'Viliya',
  Daugava: 'Dvina',
  Narva: 'Narva',
  Neva: 'Neva',
  Velikaya: 'Velikaya',
  Volkhov: 'Volkhov',
  Msta: 'Msta',
  Dnipro: 'Dnieper',
  Glomma: 'Glommen',
  Dalälven: 'Dal',
  'Gta lv': 'Göta',
  Klarlven: 'Klar',
  ngermanlven: 'Ångerman',
  Indalsälven: 'Indals',
  'Lule lv': 'Lule',
  Tornelven: 'Torne',
  Skelleftelven: 'Skellefte',
  Kemijoki: 'Kemi',
  Oulu: 'Ule',
  Kokemenjoki: 'Kumo',
  Vuoksi: 'Vuoksen',
};

/** Natural Earth lake names → names on the map. */
export const LAKES: Record<string, string> = {
  'Lake Ladoga': 'Lake Ladoga',
  Vänern: 'Vänern',
  Vättern: 'Vättern',
  Mälaren: 'Mälaren',
  Hjälmaren: 'Hjälmaren',
  'Lake Peipus': 'Lake Peipus',
  'Lake Pskov': 'Lake Pskov',
  "Lake Il'Men'": 'Lake Ilmen',
  'Lake Saimaa': 'Saimaa',
  Päijänne: 'Päijänne',
  Oulujärvi: 'Uleträsk',
  Pielinen: 'Pielisjärvi',
  Storsjön: 'Storsjön',
  Võrtsjärv: 'Wirzjerw',
  Femunden: 'Femund',
  Pyhäjärvi: 'Pyhäjärvi',
  Koitere: 'Koitere',
  Rikkavesi: 'Kallavesi',
  'Kaliningradskiy Zaliv': 'Frisches Haff',
  'Zalev Wislany': 'Frisches Haff',
};

/** The high Scandes: impassable ridges (lon, lat), with half their width in design units. */
export const RIDGES: Array<{ name: string; half: number; pts: Array<[number, number]> }> = [
  { name: 'Kjølen', half: 46, pts: [[15.2, 66.5], [14.3, 65.6], [13.6, 64.9], [13.0, 64.2], [12.5, 63.7], [12.2, 63.1], [12.3, 62.5]] },
  { name: 'Dovrefjell', half: 44, pts: [[11.0, 62.6], [10.0, 62.35], [9.2, 62.2], [8.4, 61.9]] },
  { name: 'Jotunheimen', half: 46, pts: [[8.9, 61.75], [8.3, 61.5], [7.6, 61.3]] },
  { name: 'Hardangervidda', half: 48, pts: [[8.0, 60.55], [7.55, 60.15], [7.35, 59.75], [7.25, 59.3]] },
];

/** Passes through the ridges, where the old roads and railways cross. */
export const PASSES: Array<{ name: string; lon: number; lat: number; ridge: string }> = [
  { name: 'Storlien', lon: 12.25, lat: 63.3, ridge: 'Kjølen' },
  { name: 'Dovre', lon: 9.6, lat: 62.22, ridge: 'Dovrefjell' },
  { name: 'Filefjell', lon: 8.1, lat: 61.6, ridge: 'Jotunheimen' },
  { name: 'Haukeli', lon: 7.4, lat: 59.85, ridge: 'Hardangervidda' },
];

/** Mining districts and farmland that make a deposit likelier (a game abstraction, not geology). */
export const DEPOSIT_HINTS: Array<{ kind: 'coal' | 'iron' | 'oil' | 'food' | 'nitrates' | 'rubber'; lon: number; lat: number; km: number; weight: number }> = [
  { kind: 'iron', lon: 15.0, lat: 60.1, km: 160, weight: 6 }, // Bergslagen
  { kind: 'iron', lon: 20.7, lat: 66.4, km: 120, weight: 5 }, // Gällivare's ore field, at the map's northern edge
  { kind: 'iron', lon: 14.0, lat: 57.3, km: 120, weight: 2 }, // Småland's bog iron
  { kind: 'iron', lon: 11.2, lat: 62.6, km: 120, weight: 2.5 }, // Røros
  { kind: 'coal', lon: 12.9, lat: 56.1, km: 90, weight: 6 }, // Höganäs and Bjuv
  { kind: 'coal', lon: 14.9, lat: 55.15, km: 40, weight: 3 }, // Bornholm's brown coal
  { kind: 'coal', lon: 14.2, lat: 52.4, km: 120, weight: 3 }, // Lusatian and Brandenburg lignite
  { kind: 'coal', lon: 10.9, lat: 52.3, km: 80, weight: 3 }, // Helmstedt lignite
  { kind: 'oil', lon: 27.2, lat: 59.35, km: 80, weight: 6 }, // Estland's oil shale
  { kind: 'nitrates', lon: 9.5, lat: 53.0, km: 160, weight: 2 }, // the Lüneburg salt and potash
  { kind: 'food', lon: 11.0, lat: 55.5, km: 220, weight: 2 }, // Danish dairy and grain
  { kind: 'food', lon: 13.4, lat: 55.8, km: 100, weight: 2 }, // Scania
  { kind: 'food', lon: 17.0, lat: 52.6, km: 160, weight: 2 }, // Posen
  // no rubber grows here: it stands for the rubber works and colonial trade houses of 1906
  { kind: 'rubber', lon: 30.3, lat: 59.93, km: 60, weight: 20 }, // Treugolnik works, St Petersburg
  { kind: 'rubber', lon: 24.1, lat: 56.95, km: 50, weight: 20 }, // Provodnik works, Riga
  { kind: 'rubber', lon: 10.0, lat: 53.55, km: 50, weight: 20 }, // Hamburg's colonial trade
  { kind: 'rubber', lon: 12.57, lat: 55.68, km: 40, weight: 20 }, // Copenhagen's East Asiatic Company
];

/**
 * Towns of 1906 (name as then written, lon, lat) that Natural Earth's
 * populated places lack: district towns that give the smaller provinces their
 * names. Positions to about a kilometre.
 */
export const TOWNS_1906: Array<[string, number, number]> = [
  // Sweden
  ['Lund', 13.19, 55.7], ['Kristianstad', 14.16, 56.03], ['Ystad', 13.82, 55.43], ['Landskrona', 12.83, 55.87], ['Ängelholm', 12.86, 56.24],
  ['Västervik', 16.64, 57.76], ['Vimmerby', 15.86, 57.67], ['Ljungby', 13.94, 56.83], ['Värnamo', 14.04, 57.18], ['Eksjö', 14.97, 57.67], ['Oskarshamn', 16.45, 57.27],
  ['Skövde', 13.85, 58.39], ['Uddevalla', 11.94, 58.35], ['Lidköping', 13.16, 58.5], ['Alingsås', 12.53, 57.93], ['Falköping', 13.55, 58.17], ['Strömstad', 11.17, 58.94], ['Varberg', 12.25, 57.11],
  ['Motala', 15.04, 58.54], ['Eskilstuna', 16.51, 59.37], ['Katrineholm', 16.21, 59.0], ['Södertälje', 17.63, 59.2], ['Norrtälje', 18.7, 59.76], ['Enköping', 17.08, 59.64], ['Östhammar', 18.37, 60.26],
  ['Köping', 15.99, 59.51], ['Sala', 16.6, 59.92], ['Arboga', 15.84, 59.39], ['Lindesberg', 15.23, 59.59], ['Karlskoga', 14.52, 59.33],
  ['Mora', 14.54, 61.0], ['Särna', 13.13, 61.69], ['Avesta', 16.17, 60.14], ['Ludvika', 15.19, 60.15], ['Hedemora', 15.99, 60.28], ['Malung', 13.72, 60.69],
  ['Arvika', 12.59, 59.65], ['Kristinehamn', 14.11, 59.31], ['Filipstad', 14.17, 59.71], ['Torsby', 13.0, 60.13],
  ['Hudiksvall', 17.1, 61.73], ['Söderhamn', 17.06, 61.3], ['Ljusdal', 16.09, 61.83], ['Sandviken', 16.78, 60.62],
  ['Strömsund', 15.56, 63.85], ['Sveg', 14.36, 62.03], ['Åre', 13.08, 63.4], ['Härnösand', 17.94, 62.63], ['Sollefteå', 17.27, 63.17],
  ['Lycksele', 18.67, 64.6], ['Vilhelmina', 16.66, 64.62], ['Haparanda', 24.14, 65.84], ['Kalix', 23.15, 65.85], ['Piteå', 21.48, 65.32], ['Arvidsjaur', 19.17, 65.59], ['Jokkmokk', 19.83, 66.61],
  // Norway
  ['Elverum', 11.56, 60.88], ['Kongsvinger', 12.0, 60.19], ['Tynset', 10.78, 62.28], ['Røros', 11.38, 62.57], ['Gjøvik', 10.69, 60.8], ['Otta', 9.54, 61.77], ['Fagernes', 9.23, 60.99],
  ['Kongsberg', 9.65, 59.67], ['Hønefoss', 10.26, 60.17], ['Gol', 8.95, 60.7], ['Tønsberg', 10.41, 59.27], ['Laurvik', 10.03, 59.05], ['Horten', 10.48, 59.42],
  ['Notodden', 9.26, 59.56], ['Kragerø', 9.41, 58.87], ['Rjukan', 8.59, 59.88], ['Mandal', 7.46, 58.03], ['Flekkefjord', 6.66, 58.3], ['Grimstad', 8.59, 58.34],
  ['Egersund', 6.0, 58.45], ['Voss', 6.42, 60.63], ['Florø', 5.04, 61.6], ['Førde', 5.85, 61.45], ['Odda', 6.55, 60.07], ['Ålesund', 6.15, 62.47], ['Kristiansund', 7.73, 63.11],
  ['Levanger', 11.3, 63.75], ['Steinkjer', 11.5, 64.01], ['Orkanger', 9.85, 63.3], ['Mosjøen', 13.19, 65.84], ['Brønnøysund', 12.21, 65.47], ['Sandnessjøen', 12.63, 66.02], ['Fredrikstad', 10.94, 59.22], ['Sarpsborg', 11.11, 59.28],
  // Denmark
  ['Hjørring', 9.98, 57.46], ['Frederikshavn', 10.54, 57.44], ['Thisted', 8.69, 56.96], ['Randers', 10.04, 56.46], ['Holstebro', 8.62, 56.36], ['Herning', 8.97, 56.14], ['Skive', 9.03, 56.57],
  ['Silkeborg', 9.55, 56.17], ['Horsens', 9.85, 55.86], ['Esbjerg', 8.45, 55.47], ['Ribe', 8.76, 55.33], ['Kolding', 9.47, 55.49], ['Fredericia', 9.75, 55.57], ['Svendborg', 10.61, 55.06],
  ['Nyborg', 10.79, 55.31], ['Næstved', 11.76, 55.23], ['Holbæk', 11.71, 55.72], ['Helsingør', 12.59, 56.03], ['Nykøbing', 11.87, 54.77], ['Rønne', 14.7, 55.1],
  // Germany
  ['Schleswig', 9.57, 54.52], ['Husum', 9.05, 54.48], ['Hadersleben', 9.49, 55.25], ['Apenrade', 9.42, 55.04], ['Sonderburg', 9.79, 54.91], ['Tondern', 8.86, 54.93], ['Rendsburg', 9.66, 54.3],
  ['Neumünster', 9.98, 54.07], ['Itzehoe', 9.52, 53.93], ['Heide', 9.1, 54.2], ['Ratzeburg', 10.76, 53.7], ['Oldenburg in Holstein', 10.88, 54.29],
  ['Lüneburg', 10.41, 53.25], ['Stade', 9.48, 53.6], ['Celle', 10.08, 52.62], ['Uelzen', 10.56, 52.97], ['Verden', 9.23, 52.92], ['Nienburg', 9.21, 52.64], ['Cuxhaven', 8.69, 53.87],
  ['Emden', 7.21, 53.37], ['Aurich', 7.48, 53.47], ['Leer', 7.45, 53.23], ['Wilhelmshaven', 8.13, 53.52], ['Jever', 7.9, 53.57], ['Lingen', 7.32, 52.52], ['Cloppenburg', 8.04, 52.85],
  ['Stendal', 11.86, 52.6], ['Salzwedel', 11.15, 52.85], ['Gardelegen', 11.4, 52.53],
  ['Wismar', 11.47, 53.89], ['Güstrow', 12.17, 53.79], ['Neubrandenburg', 13.26, 53.56], ['Neustrelitz', 13.06, 53.36], ['Parchim', 11.85, 53.43], ['Waren', 12.68, 53.52],
  ['Greifswald', 13.38, 54.1], ['Anklam', 13.69, 53.86], ['Swinemünde', 14.25, 53.91], ['Demmin', 13.03, 53.9], ['Pasewalk', 13.99, 53.51], ['Stargard in Pommern', 15.05, 53.34],
  ['Kolberg', 15.58, 54.18], ['Stolp', 17.03, 54.46], ['Neustettin', 16.69, 53.71], ['Belgard', 15.98, 54.0], ['Lauenburg in Pommern', 17.75, 54.54], ['Rummelsburg', 16.95, 54.11],
  ['Konitz', 17.56, 53.7], ['Marienwerder', 18.92, 53.73], ['Marienburg in Westpreussen', 19.03, 54.04], ['Kulm', 18.42, 53.35], ['Dirschau', 18.78, 54.09], ['Deutsch Krone', 16.48, 53.27], ['Schneidemühl', 16.74, 53.15],
  ['Pillau', 19.9, 54.64], ['Braunsberg', 19.82, 54.38], ['Bartenstein', 20.81, 54.25], ['Rastenburg', 21.38, 54.08], ['Heiligenbeil', 20.12, 54.53], ['Labiau', 21.1, 54.86], ['Stallupönen', 22.57, 54.63], ['Goldap', 22.3, 54.31], ['Angerburg', 21.76, 54.21], ['Gumbinnen', 22.19, 54.57],
  ['Lyck', 22.36, 53.82], ['Lötzen', 21.76, 54.03], ['Ortelsburg', 20.99, 53.57], ['Neidenburg', 20.43, 53.36], ['Osterode', 19.97, 53.7], ['Johannisburg', 21.8, 53.62], ['Sensburg', 21.3, 53.86], ['Deutsch Eylau', 19.57, 53.6],
  ['Gnesen', 17.6, 52.54], ['Wongrowitz', 17.2, 52.8], ['Kolmar in Posen', 16.92, 52.99], ['Obornik', 16.82, 52.65], ['Samter', 16.39, 52.6], ['Birnbaum', 15.93, 52.62], ['Meseritz', 15.58, 52.42], ['Filehne', 16.12, 52.89],
  ['Frankfurt an der Oder', 14.55, 52.35], ['Prenzlau', 13.86, 53.32], ['Neuruppin', 12.8, 52.92], ['Eberswalde', 13.82, 52.83], ['Küstrin', 14.65, 52.58], ['Perleberg', 11.86, 53.07], ['Brandenburg an der Havel', 12.55, 52.41], ['Wittenberge', 11.75, 53.0], ['Landsberg an der Warthe', 15.24, 52.73],
  // Finland
  ['Kuusamo', 29.19, 65.97], ['Pudasjärvi', 26.99, 65.36], ['Suomussalmi', 28.9, 64.89], ['Nurmes', 29.14, 63.54], ['Haapajärvi', 25.32, 63.75], ['Torneå', 24.14, 65.85], ['Kemi', 24.56, 65.74], ['Brahestad', 24.48, 64.68], ['Kajana', 27.73, 64.23],
  ['Idensalmi', 27.19, 63.56], ['Lieksa', 30.02, 63.32], ['Varkaus', 27.86, 62.32], ['Nykarleby', 22.53, 63.52], ['Jakobstad', 22.7, 63.67], ['Lappo', 23.0, 62.95], ['Kristinestad', 21.38, 62.27], ['Saarijärvi', 25.26, 62.71],
  ['Sordavala', 30.69, 61.7], ['Kexholm', 30.12, 61.03], ['Fredrikshamn', 27.19, 60.57], ['Villmanstrand', 28.19, 61.06], ['Kotka', 26.94, 60.47], ['Heinola', 26.03, 61.2], ['Forssa', 23.62, 60.81],
  ['Borgå', 25.66, 60.39], ['Lovisa', 26.23, 60.46], ['Ekenäs', 23.43, 59.98], ['Hyvinge', 24.86, 60.63], ['Lojo', 24.07, 60.25], ['Raumo', 21.51, 61.13], ['Nystad', 21.41, 60.8], ['Salo', 23.13, 60.38], ['Juva', 27.86, 61.9], ['Mariehamn', 19.94, 60.1],
  // the Baltic provinces and Lithuania
  ['Narva', 28.19, 59.38], ['Baltischport', 24.05, 59.35], ['Weissenstein', 25.56, 58.89], ['Wesenberg', 26.36, 59.35], ['Lemsal', 24.71, 57.51], ['Wenden', 25.27, 57.31], ['Wolmar', 25.43, 57.54], ['Walk', 26.05, 57.78], ['Werro', 27.0, 57.83], ['Arensburg', 22.48, 58.25],
  ['Hasenpoth', 21.6, 56.72], ['Talsen', 22.59, 57.24], ['Tuckum', 23.15, 56.97], ['Bauske', 24.19, 56.41], ['Friedrichstadt', 25.34, 56.53], ['Illuxt', 26.3, 55.98], ['Goldingen', 21.97, 56.97],
  ['Rossieny', 23.12, 55.38], ['Telshi', 22.25, 55.98], ['Vilkomir', 24.78, 55.25], ['Novoalexandrovsk', 26.25, 55.73], ['Mariampol', 23.35, 54.56], ['Olita', 24.05, 54.4], ['Tauroggen', 22.29, 55.25],
  ['Sventsiany', 26.16, 55.14], ['Oshmiany', 25.94, 54.42], ['Troki', 24.93, 54.64], ['Disna', 28.2, 55.56], ['Vileika', 26.93, 54.5], ['Seiny', 23.35, 54.1], ['Augustovo', 22.98, 53.84], ['Kalvaria', 23.18, 54.41],
  // Russia
  ['Yamburg', 28.6, 59.37], ['Gdov', 27.82, 58.74], ['Tsarskoye Selo', 30.4, 59.72], ['Schlüsselburg', 31.04, 59.94], ['Peterhof', 29.9, 59.88], ['Oranienbaum', 29.77, 59.92], ['Kronstadt', 29.77, 60.0],
  ['Ostrov', 28.35, 57.34], ['Porkhov', 29.56, 57.77], ['Opochka', 28.67, 56.71], ['Novorzhev', 29.33, 57.03], ['Pechory', 27.61, 57.81], ['Sebezh', 28.49, 56.29], ['Nevel', 29.92, 56.02], ['Kholm', 31.13, 57.15],
  ['Drissa', 27.97, 55.79], ['Lepel', 28.69, 54.88], ['Gorodok', 29.99, 55.46], ['Lutsin', 27.71, 56.53], ['Rezhitsa', 27.33, 56.51], ['Dvinsk', 26.53, 55.87], ['Senno', 29.71, 54.81], ['Borisov', 28.5, 54.23],
  ['Shimsk', 30.21, 58.21], ['Soltsy', 30.32, 58.12], ['Dno', 29.97, 57.83], ['Krasnogorodsk', 28.27, 56.84],
];
