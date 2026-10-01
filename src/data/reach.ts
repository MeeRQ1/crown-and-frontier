// "The Reach" — the main handcrafted scenario.
// Province attributes live here; province geometry and adjacency are generated
// from the seed positions by `npm run genmap` into reach.map.json.

import type { NationDef, ProvinceDef, RegionDef, Resource, Terrain } from '../sim/types';

interface Extra {
  infra?: number;
  fort?: number;
  integ?: number;
  claims?: string[];
}

type Row = [
  id: string,
  name: string,
  x: number,
  y: number,
  terrain: Terrain,
  resource: Resource,
  owner: string | null,
  dev: number,
  pop: number,
  region: string,
  extra?: Extra,
];

// prettier-ignore
const ROWS: Row[] = [
  // ── Aurel: rich western plains, open borders ─────────────────────────────
  ['aurelon', 'Aurelon', 520, 640, 'plains', 'coal', 'aur', 6, 85, 'heartland', { infra: 2, fort: 1 }],
  ['westmere', 'Westmere', 340, 620, 'plains', 'food', 'aur', 3, 50, 'heartland'],
  ['hollin', 'Hollin', 410, 770, 'plains', 'food', 'aur', 3, 45, 'heartland'],
  ['brask', 'Brask', 570, 790, 'plains', null, 'aur', 3, 40, 'heartland', { infra: 1 }],
  ['terrow', 'Terrow', 690, 690, 'plains', null, 'aur', 3, 40, 'heartland'],
  ['vantry', 'Vantry', 660, 550, 'forest', null, 'aur', 3, 30, 'heartland'],
  ['leyfield', 'Leyfield', 500, 490, 'plains', null, 'aur', 3, 40, 'heartland', { infra: 1 }],
  ['corbel', 'Corbel', 350, 480, 'hills', null, 'aur', 3, 30, 'heartland', { fort: 1 }],
  ['ashford', 'Ashford', 240, 770, 'plains', null, 'aur', 3, 35, 'heartland'],
  ['duncairn', 'Duncairn', 460, 900, 'hills', 'iron', 'aur', 3, 30, 'southmarch', { claims: ['ser'] }],
  ['marrowby', 'Marrowby', 620, 920, 'plains', null, 'aur', 2, 30, 'southmarch'],
  ['elmsgate', 'Elmsgate', 740, 830, 'forest', null, 'aur', 2, 25, 'lakelands', { claims: ['cal'] }],

  // ── Vostmark: martial northern uplands, poor soil ────────────────────────
  ['vostburg', 'Vostburg', 440, 300, 'hills', 'iron', 'vos', 5, 50, 'uplands', { infra: 1, fort: 2 }],
  ['harnfeld', 'Harnfeld', 290, 340, 'plains', 'food', 'vos', 4, 35, 'uplands'],
  ['kaltwater', 'Kaltwater', 200, 220, 'hills', null, 'vos', 2, 20, 'uplands'],
  ['wendel', 'Wendel', 350, 170, 'plains', null, 'vos', 2, 25, 'uplands'],
  ['ostrin', 'Ostrin', 560, 180, 'forest', null, 'vos', 2, 25, 'uplands'],
  ['grimhold', 'Grimhold', 600, 360, 'hills', 'iron', 'vos', 3, 25, 'uplands', { fort: 1, claims: ['aur'] }],
  ['rethel', 'Rethel', 730, 250, 'forest', null, 'vos', 2, 20, 'uplands'],
  ['faltrip', 'Faltrip', 750, 410, 'hills', 'coal', 'vos', 2, 20, 'lakelands', { claims: ['cal'] }],
  ['skarn', 'Skarn', 890, 240, 'hills', 'coal', 'vos', 2, 18, 'uplands'],
  ['ironcrag', 'Ironcrag', 1040, 290, 'mountains', 'iron', 'vos', 1, 12, 'greyspine', { integ: 70 }],
  ['brennmoor', 'Brennmoor', 170, 450, 'marsh', null, 'vos', 1, 15, 'uplands', { claims: ['aur'] }],

  // ── Serennes: merchant coast and isles, few soldiers ─────────────────────
  ['serenna', 'Serenna', 420, 1130, 'plains', 'nitrates', 'ser', 7, 80, 'coast', { infra: 2, fort: 1 }],
  ['calvi', 'Calvi', 270, 1010, 'plains', 'food', 'ser', 4, 40, 'coast'],
  ['portovell', 'Porto Vell', 570, 1170, 'plains', 'nitrates', 'ser', 5, 45, 'coast', { infra: 1 }],
  ['merand', 'Merand', 290, 1170, 'hills', null, 'ser', 3, 30, 'coast'],
  ['ostra', 'Ostra', 440, 1000, 'plains', null, 'ser', 4, 40, 'southmarch', { claims: ['aur'] }],
  ['varrow', 'Varrow', 40, 880, 'forest', 'coal', 'ser', 2, 20, 'coast', { integ: 80 }],
  ['kell', 'Kell', 70, 1110, 'plains', 'coal', 'ser', 3, 25, 'coast'],
  ['lissan', 'Lissan', 630, 1040, 'hills', 'coal', 'ser', 3, 30, 'southmarch', { claims: ['ist'] }],
  ['tamber', 'Tamber', 410, 1290, 'plains', null, 'ser', 3, 35, 'coast'],

  // ── Calder: scholarly lake republic holding the Kestrel Pass ─────────────
  ['caldris', 'Caldris', 960, 550, 'plains', 'nitrates', 'cal', 6, 60, 'lakelands', { infra: 1, fort: 2 }],
  ['mirewick', 'Mirewick', 830, 490, 'plains', null, 'cal', 3, 35, 'lakelands'],
  ['lakeholm', 'Lakeholm', 1020, 700, 'plains', 'food', 'cal', 4, 35, 'lakelands'],
  ['harrowgate', 'Harrowgate', 1060, 440, 'hills', null, 'cal', 3, 25, 'lakelands', { fort: 1, claims: ['vos'] }],
  ['sedge', 'Sedge', 930, 860, 'marsh', null, 'cal', 2, 20, 'lakelands'],
  ['tolland', 'Tolland', 1070, 860, 'forest', null, 'cal', 2, 20, 'lakelands', { claims: ['ist'] }],
  ['pellin', 'Pellin', 890, 380, 'forest', null, 'cal', 2, 20, 'lakelands'],
  ['kestrel', 'Kestrel Pass', 1190, 700, 'mountains', 'coal', 'cal', 1, 8, 'greyspine', { fort: 2, integ: 80, claims: ['mor'] }],

  // ── Istrel: iron-rich southern highlands, holds the Southern Gap ──────────
  ['istrenne', 'Istrenne', 960, 1060, 'hills', 'iron', 'ist', 5, 45, 'highlands', { infra: 1, fort: 2 }],
  ['ardel', 'Ardel', 800, 990, 'hills', null, 'ist', 4, 35, 'highlands', { fort: 1, claims: ['aur'] }],
  ['corvo', 'Corvo', 1100, 980, 'mountains', null, 'ist', 1, 12, 'highlands', { fort: 1 }],
  ['valdis', 'Valdis', 880, 1190, 'plains', 'food', 'ist', 5, 35, 'highlands'],
  ['sarn', 'Sarn', 1040, 1210, 'hills', null, 'ist', 2, 22, 'highlands'],
  ['belcrest', 'Belcrest', 1150, 1110, 'hills', null, 'ist', 2, 18, 'highlands'],
  ['pellmark', 'Pellmark', 760, 1140, 'mountains', null, 'ist', 1, 12, 'highlands'],
  ['southgap', 'Southern Gap', 1280, 1110, 'hills', null, 'ist', 1, 10, 'greyspine', { fort: 1, integ: 75, claims: ['tar'] }],

  // ── Drevenholt: populous northern forests beyond the Northgate ───────────
  ['drevholm', 'Drevholm', 1500, 260, 'forest', 'coal', 'dre', 5, 55, 'woods', { infra: 1, fort: 1 }],
  ['northgate', 'Northgate', 1200, 420, 'mountains', null, 'dre', 1, 10, 'greyspine', { fort: 1, integ: 80, claims: ['vos'] }],
  ['birchwold', 'Birchwold', 1350, 180, 'forest', null, 'dre', 2, 30, 'woods'],
  ['tarnwood', 'Tarnwood', 1340, 340, 'forest', 'food', 'dre', 3, 35, 'woods'],
  ['ulmen', 'Ulmen', 1490, 420, 'plains', 'food', 'dre', 3, 40, 'woods'],
  ['greyhollow', 'Greyhollow', 1640, 390, 'forest', null, 'dre', 2, 30, 'woods'],
  ['frostmere', 'Frostmere', 1650, 210, 'plains', 'nitrates', 'dre', 2, 25, 'woods'],
  ['kolva', 'Kolva', 1790, 320, 'forest', 'coal', 'dre', 2, 20, 'northwilds', { integ: 70 }],
  ['hask', 'Hask', 1370, 520, 'hills', 'coal', 'dre', 2, 25, 'woods', { claims: ['mor'] }],
  ['varsk', 'Varsk', 1570, 540, 'plains', null, 'dre', 3, 35, 'woods', { claims: ['mor'] }],

  // ── Morvaine: central eastern kingdom, iron and many borders ─────────────
  ['morvay', 'Morvay', 1560, 740, 'hills', 'coal', 'mor', 6, 55, 'morvaine', { infra: 1, fort: 1 }],
  ['garrow', 'Garrow', 1330, 690, 'hills', null, 'mor', 2, 25, 'morvaine', { fort: 1 }],
  ['emberlin', 'Emberlin', 1440, 610, 'plains', null, 'mor', 3, 35, 'morvaine'],
  ['thornby', 'Thornby', 1700, 640, 'forest', 'coal', 'mor', 2, 25, 'morvaine', { claims: ['fen'] }],
  ['rookhill', 'Rookhill', 1440, 830, 'hills', null, 'mor', 3, 30, 'morvaine'],
  ['selvane', 'Selvane', 1620, 880, 'plains', 'food', 'mor', 4, 40, 'morvaine'],
  ['dunmore', 'Dunmore', 1320, 900, 'mountains', null, 'mor', 1, 12, 'greyspine'],
  ['carrack', 'Carrack', 1760, 780, 'plains', 'coal', 'mor', 4, 35, 'morvaine'],
  ['ilse', 'Ilse', 1840, 910, 'plains', null, 'mor', 3, 30, 'eastmarch', { claims: ['tar'] }],
  ['wexley', 'Wexley', 1490, 980, 'plains', null, 'mor', 3, 30, 'steppe', { claims: ['tar'] }],

  // ── Fenward: small marsh compact, hard to invade ─────────────────────────
  ['fenhold', 'Fenhold', 1960, 560, 'marsh', 'food', 'fen', 4, 40, 'fens', { infra: 1, fort: 2 }],
  ['wendmire', 'Wendmire', 1830, 470, 'marsh', 'oil', 'fen', 2, 20, 'fens', { claims: ['dre'] }],
  ['reedby', 'Reedby', 1850, 650, 'marsh', 'food', 'fen', 2, 25, 'fens'],
  ['saltmere', 'Saltmere', 2090, 470, 'marsh', null, 'fen', 2, 20, 'fens'],
  ['holt', 'Holt', 2090, 630, 'plains', null, 'fen', 3, 30, 'fens'],
  ['cressing', 'Cressing', 1970, 730, 'plains', null, 'fen', 3, 30, 'fens', { claims: ['mor'] }],
  ['blackwater', 'Blackwater', 2150, 780, 'marsh', 'rubber', 'fen', 1, 15, 'eastmarch', { integ: 75 }],

  // ── Tarsk: steppe khaganate of horsemen, loosely held periphery ───────────
  ['kharsa', 'Kharsa', 1800, 1150, 'steppe', 'food', 'tar', 4, 45, 'steppe', { infra: 1, fort: 1 }],
  ['orenkul', 'Orenkul', 1610, 1080, 'steppe', 'food', 'tar', 2, 25, 'steppe'],
  ['beyla', 'Beyla', 1440, 1170, 'steppe', null, 'tar', 2, 22, 'steppe'],
  ['sulit', 'Sulit', 1420, 1320, 'steppe', null, 'tar', 2, 20, 'steppe', { integ: 60 }],
  ['dashkin', 'Dashkin', 1620, 1250, 'steppe', null, 'tar', 2, 22, 'steppe'],
  ['amarak', 'Amarak', 1960, 1040, 'steppe', 'oil', 'tar', 2, 22, 'southsteppe'],
  ['qorvai', 'Qorvai', 2090, 1170, 'steppe', 'nitrates', 'tar', 2, 18, 'southsteppe', { integ: 60 }],
  ['yeshil', 'Yeshil', 1960, 1310, 'plains', 'food', 'tar', 3, 30, 'southsteppe'],
  ['ulgari', 'Ulgari', 1780, 1350, 'steppe', null, 'tar', 2, 20, 'southsteppe'],
  ['khesh', 'Khesh', 2200, 1040, 'hills', null, 'tar', 1, 12, 'southsteppe', { integ: 55 }],
  ['irtal', 'Irtal', 1700, 980, 'steppe', 'nitrates', 'tar', 2, 22, 'steppe', { claims: ['mor'] }],
  ['zhorun', 'Zhorun', 2185, 1270, 'steppe', 'oil', 'tar', 1, 14, 'southsteppe', { integ: 55 }],

  // ── Unclaimed frontier: can be settled ───────────────────────────────────
  ['sunderby', 'Sunderby', 1800, 160, 'plains', null, null, 1, 7, 'northwilds'],
  ['ashwood', 'Ashwood', 1920, 260, 'forest', null, null, 1, 7, 'northwilds'],
  ['coldreach', 'Coldreach', 2040, 360, 'forest', null, null, 1, 6, 'northwilds'],
  ['whitefell', 'Whitefell', 2180, 230, 'hills', 'iron', null, 1, 5, 'northwilds'],
  ['hollowmere', 'Hollowmere', 2230, 410, 'marsh', null, null, 1, 5, 'northwilds'],
  ['duskfell', 'Duskfell', 2260, 640, 'hills', 'iron', null, 1, 6, 'eastmarch'],
  ['ravenmoor', 'Ravenmoor', 2290, 820, 'forest', null, null, 1, 6, 'eastmarch'],
  ['stonewatch', 'Stonewatch', 2130, 930, 'hills', 'iron', null, 1, 8, 'eastmarch'],
  ['greymarch', 'Greymarch', 1990, 890, 'plains', 'food', null, 1, 8, 'eastmarch'],
  ['skerrin', 'Skerrin', 40, 300, 'hills', null, null, 1, 6, 'uplands'],
  ['grayholm', 'Grayholm', 30, 570, 'forest', 'food', null, 1, 6, 'heartland'],
  ['corran', 'Corran', 1130, 1420, 'plains', 'coal', null, 1, 8, 'highlands'],
];

/** Impassable terrain seeds: mountain peaks form the Greyspine; lake seeds form Lake Calder. */
export const WASTE_SEEDS: Array<[number, number, 'peak' | 'lake']> = [
  [1195, 175, 'peak'], [1205, 300, 'peak'], [1215, 555, 'peak'], [1200, 625, 'peak'],
  [1200, 800, 'peak'], [1215, 900, 'peak'], [1225, 1000, 'peak'],
  [860, 650, 'lake'], [865, 750, 'lake'],
];

/** Explicit sea points that guarantee islands are separated from the mainland. */
export const FORCED_SEA: Array<[number, number]> = [
  [120, 870], [130, 960], [140, 1100], [110, 560], [120, 480], [120, 300], [110, 380],
  [1110, 1320], [1200, 1340], [1040, 1340],
  [668, 1200], [680, 1275], [690, 1350], [640, 1330],
  // bays
  [965, 130], [1030, 170], [1730, 95], [2175, 530], [2330, 560], [1700, 1420], [1600, 1400], [190, 690], [150, 660],
  [2330, 1000], [800, 1300], [520, 1320], [2000, 1420], [300, 1300], [1300, 1250], [1350, 1380],
];

/** Sea crossings that act as province links (no naval combat; crossing is slow). */
export const STRAITS: Array<[string, string]> = [
  ['varrow', 'ashford'], ['varrow', 'calvi'], ['kell', 'merand'], ['kell', 'varrow'],
  ['grayholm', 'westmere'], ['grayholm', 'brennmoor'], ['skerrin', 'kaltwater'], ['skerrin', 'brennmoor'],
  ['corran', 'sarn'], ['corran', 'sulit'],
];

/** Rough continent outline; automatic sea seeds are only placed outside it. */
export const OUTLINE: Array<[number, number]> = [
  [150, 110], [480, 90], [760, 120], [1000, 150], [1150, 110], [1400, 100], [1700, 110], [2000, 100],
  [2320, 150], [2340, 500], [2360, 880], [2300, 1140], [2300, 1380], [1900, 1420], [1500, 1410],
  [1330, 1240], [1180, 1250], [980, 1290], [820, 1260], [740, 1180], [640, 1230], [560, 1300],
  [440, 1380], [300, 1300], [210, 1220], [200, 1000], [170, 820], [180, 700], [110, 470], [120, 230],
];

export const MAP_BOUNDS = { minX: -160, minY: -40, maxX: 2460, maxY: 1560 };

export const REACH_REGIONS: RegionDef[] = [
  { id: 'heartland', name: 'Aurelian Heartland' },
  { id: 'southmarch', name: 'Southern March' },
  { id: 'uplands', name: 'Vostic Uplands' },
  { id: 'coast', name: 'Serene Coast' },
  { id: 'lakelands', name: 'Lakelands' },
  { id: 'highlands', name: 'Istrel Highlands' },
  { id: 'greyspine', name: 'The Greyspine' },
  { id: 'woods', name: 'Drevish Woods' },
  { id: 'northwilds', name: 'Northern Wilds' },
  { id: 'morvaine', name: 'Morvish Hills' },
  { id: 'fens', name: 'The Fens' },
  { id: 'eastmarch', name: 'Eastern March' },
  { id: 'steppe', name: 'Tarsk Steppe' },
  { id: 'southsteppe', name: 'Southern Steppe' },
];

export const REACH_NATIONS: NationDef[] = [
  {
    id: 'aur', name: 'Kingdom of Aurel', short: 'Aurel', adjective: 'Aurelian', color: '#3f6fc4',
    startType: 'Wealthy heartland', rating: 'recommended',
    capital: 'aurelon', personality: 'commercial', emblem: 'sun',
    summary: 'Rich, populous plains with open borders on every side.',
    strength: 'Fertile heartland: +20% food production.',
    constraint: 'Burgher realm: -25% military reserve.',
    traits: { supplyProdMul: 0.2, manpowerMul: -0.25 },
  },
  {
    id: 'vos', name: 'Margraviate of Vostmark', short: 'Vostmark', adjective: 'Vostic', color: '#a8323e',
    startType: 'Martial uplands', rating: 'standard',
    capital: 'vostburg', personality: 'expansionist', emblem: 'tower',
    summary: 'Hardy upland march with a martial tradition and poor soil.',
    strength: 'Martial tradition: +0.5 maximum morale.',
    constraint: 'Thin soil: -15% food production.',
    traits: { moraleAdd: 0.5, supplyProdMul: -0.15 },
  },
  {
    id: 'ser', name: 'Serene League', short: 'Serennes', adjective: 'Serennese', color: '#1f9a8f',
    startType: 'Maritime trader', rating: 'standard',
    capital: 'serenna', personality: 'diplomat', emblem: 'ship',
    summary: 'Merchant ports and isles that prefer contracts to battles.',
    strength: 'Merchant houses: exports fetch 50% more and each trade agreement brings 50% more commerce.',
    constraint: 'Few soldiers: -30% manpower.',
    traits: { tradeMul: 0.5, manpowerMul: -0.3 },
  },
  {
    id: 'cal', name: 'Republic of Calder', short: 'Calder', adjective: 'Calderan', color: '#d0a22a',
    startType: 'Compact defensive', rating: 'challenging',
    capital: 'caldris', personality: 'defensive', emblem: 'book',
    summary: 'Scholarly lake republic guarding the Kestrel Pass.',
    strength: 'Academies: +25% research.',
    constraint: 'Merchant council: -10% crown income.',
    traits: { researchMul: 0.25, incomeMul: -0.1 },
  },
  {
    id: 'ist', name: 'Duchy of Istrel', short: 'Istrel', adjective: 'Istrelan', color: '#7d4fb0',
    startType: 'Mountain fortress', rating: 'standard',
    capital: 'istrenne', personality: 'defensive', emblem: 'mountain',
    summary: 'Rugged highlands full of mines and old fortresses.',
    strength: 'Mountain engineers: forts cost 25% less and sieges progress 25% faster.',
    constraint: 'Sparse valleys: -20% population growth.',
    traits: { fortCostMul: -0.25, siegeMul: 0.25, popGrowthMul: -0.2 },
  },
  {
    id: 'dre', name: 'Principality of Drevenholt', short: 'Drevenholt', adjective: 'Drevish', color: '#3e8a3a',
    startType: 'Frontier to settle', rating: 'standard',
    capital: 'drevholm', personality: 'opportunist', emblem: 'tree',
    summary: 'Populous forest principality with a frontier to the east.',
    strength: 'Forest folk: +15% manpower.',
    constraint: 'Backwoods: development costs 20% more.',
    traits: { manpowerMul: 0.15, devCostMul: 0.2 },
  },
  {
    id: 'mor', name: 'Kingdom of Morvaine', short: 'Morvaine', adjective: 'Morvish', color: '#d8742a',
    startType: 'Crossroads, many borders', rating: 'standard',
    capital: 'morvay', personality: 'expansionist', emblem: 'hammer',
    summary: 'Iron-working hill kingdom at the crossroads of the east.',
    strength: 'Foundries: artillery costs 25% less.',
    constraint: 'Crossroads: -10% integration speed.',
    traits: { artilleryCostMul: -0.25, integrationMul: -0.1 },
  },
  {
    id: 'fen', name: 'Fenward Compact', short: 'Fenward', adjective: 'Fenward', color: '#5d7f8f',
    startType: 'Small and sheltered', rating: 'challenging',
    capital: 'fenhold', personality: 'diplomat', emblem: 'reed',
    summary: 'A small compact of marsh towns, hard to invade and quick to befriend.',
    strength: 'Old compacts: +1 envoy and +10 opinion with everyone.',
    constraint: 'Tiny realm: -10% crown income.',
    traits: { envoyAdd: 1, opinionAdd: 10, incomeMul: -0.1 },
  },
  {
    id: 'tar', name: 'Khaganate of Tarsk', short: 'Tarsk', adjective: 'Tarskan', color: '#9a6b3c',
    startType: 'Vast and loosely held', rating: 'standard',
    capital: 'kharsa', personality: 'opportunist', emblem: 'horse',
    summary: 'Vast steppe khaganate of horsemen with a loosely held periphery.',
    strength: 'Horse clans: cavalry regiments cost 30% less and gain +10% attack.',
    constraint: 'Open steppe: -15% crown income.',
    traits: { cavalryCostMul: -0.3, cavalryAttackAdd: 0.1, incomeMul: -0.15 },
  },
];

export const REACH_PROVINCE_SEEDS = ROWS.map((r) => ({ id: r[0], x: r[2], y: r[3] }));

export const REACH_PROVINCES: Omit<ProvinceDef, 'neighbors'>[] = ROWS.map((r) => ({
  id: r[0],
  name: r[1],
  terrain: r[4],
  resource: r[5],
  owner: r[6],
  dev: r[7],
  pop: r[8],
  region: r[9],
  infra: r[10]?.infra ?? 0,
  fort: r[10]?.fort ?? 0,
  integration: r[6] ? (r[10]?.integ ?? 100) : 0,
  claims: r[10]?.claims ?? [],
}));

/** Named geography drawn on the map (presentation only). */
export const REACH_LABELS: Array<{ kind: 'sea' | 'lake' | 'range' | 'region' | 'river'; name: string; x: number; y: number; size?: number; angle?: number }> = [
  { kind: 'sea', name: 'The Western Main', x: -30, y: 820, size: 44, angle: -Math.PI / 2 },
  { kind: 'sea', name: 'The Grey Sea', x: 1040, y: 28, size: 40 },
  { kind: 'sea', name: 'The Serene Sea', x: 1000, y: 1480, size: 46 },
  { kind: 'lake', name: 'Mirrormere', x: 862, y: 700, size: 22, angle: -Math.PI / 2 },
  { kind: 'range', name: 'The Greyspine', x: 1245, y: 470, size: 26, angle: -Math.PI / 2 + 0.05 },
];
