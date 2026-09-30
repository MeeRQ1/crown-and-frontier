// Authored geography for Aldmere, the standard campaign. Read only by
// tools/genworld.ts, which turns it into provinces, borders, rivers and
// straits. Coordinates are in "design units" and are scaled by SCALE when the
// map is generated (so the drawn province size matches the Reach).

import type { Resource, Terrain } from '../src/sim/types';
import type { Pt } from './mapgen/core';

export const SCALE = 0.84;
export const BOUNDS = { minX: -220, minY: -170, maxX: 5060, maxY: 3160 };

export interface Anchor {
  x: number;
  y: number;
  owner: string | null;
}
export interface RegionSpec {
  id: string;
  culture: string;
  anchors: Anchor[];
  /** provinces in the region, including fixed ones (capitals, passes) */
  count: number;
  biome: Partial<Record<Terrain, number>>;
  /** typical development */
  wealth: number;
  /** integration range for owned provinces (loosely held peripheries) */
  integ?: [number, number];
  /** [claimant, how many border provinces it claims] */
  claims?: Array<[string, number]>;
  /** growth weight: below 1 the region spreads further */
  weight?: number;
}
export interface FixedProv {
  id: string;
  name: string;
  x: number;
  y: number;
  region: string;
  owner: string | null;
  terrain: Terrain;
  resource: Resource;
  dev: number;
  pop: number;
  infra?: number;
  fort?: number;
  integ?: number;
  claims?: string[];
  pass?: boolean;
}
export interface IslandSpec {
  name: string;
  poly: Pt[];
  region: string;
  owner: string | null;
  count: number;
}
export interface RangeSpec {
  name: string;
  pts: Pt[];
  /** land within this distance of the ridge is mountain wall */
  half: number;
}
export interface RiverSpec {
  name: string;
  pts: Pt[];
}

// prettier-ignore
export const MAINLAND: Pt[] = [
  // Carrow firths and the Grey Bay
  [250, 480], [300, 420], [380, 395], [430, 440], [470, 525], [515, 450], [570, 410], [640, 370], [730, 350],
  [800, 400], [850, 480], [880, 560], [935, 595], [995, 540], [1035, 450], [1100, 360], [1200, 340], [1330, 300],
  [1450, 330], [1540, 300], [1640, 350], [1700, 395], [1760, 330],
  // Hrafn peninsula
  [1795, 240], [1820, 130], [1920, 50], [2040, 40], [2130, 90], [2170, 190], [2200, 270],
  [2290, 320], [2380, 385], [2450, 360], [2560, 320], [2700, 262], [2850, 232], [3000, 262], [3150, 212],
  [3300, 242], [3450, 192], [3600, 232], [3750, 202], [3900, 252], [4050, 222], [4200, 282], [4350, 252],
  [4500, 322], [4620, 400], [4650, 520], [4590, 640], [4660, 760], [4700, 880],
  // the Ember Gulf
  [4640, 940], [4500, 960], [4380, 985], [4280, 1035], [4300, 1100], [4420, 1140], [4560, 1165], [4700, 1220], [4730, 1320],
  [4680, 1430], [4720, 1560], [4700, 1700], [4640, 1820], [4680, 1950], [4640, 2100], [4580, 2250],
  [4600, 2400], [4520, 2530], [4420, 2620], [4280, 2640], [4120, 2600], [3960, 2640], 
  // the Sunward Gulf
  [3860, 2560], [3780, 2440], [3700, 2330], [3600, 2230], [3480, 2170], [3360, 2190], [3250, 2260], [3160, 2380],
  [3100, 2520], [3060, 2640], [3020, 2700],
  // Aldwater delta
  [2920, 2770], [2830, 2790], [2740, 2735], [2640, 2680], [2520, 2640],
  // Solmarre peninsula
  [2440, 2700], [2420, 2820], [2360, 2930], [2250, 2985], [2130, 2965], [2040, 2890], [1990, 2780],
  [1960, 2660], [1900, 2560],
  // the Serene Gulf
  [1820, 2520], [1700, 2500], [1600, 2460], [1520, 2380], [1480, 2260], [1440, 2150], [1380, 2080], [1280, 2060],
  [1180, 2110], [1100, 2200], [1060, 2320], [1000, 2440], [900, 2510], [780, 2535], [660, 2470], [560, 2400],
  [470, 2300], [400, 2180], [330, 2060], [300, 1940], [250, 1820], [230, 1700], [260, 1580], [200, 1460],
  // the Aurelian Gulf
  [260, 1450], [360, 1430], [460, 1400], [540, 1350], [560, 1290], [500, 1230], [400, 1200], [300, 1180], [210, 1160],
  [170, 1080], [200, 960], [160, 840], [210, 720], [190, 600],
];

// prettier-ignore
export const ISLANDS: IslandSpec[] = [
  { name: 'Skerry Major', region: 'skerries', owner: null, count: 2, poly: [[470, 150], [560, 110], [650, 140], [690, 210], [610, 262], [510, 252]] },
  { name: 'Skerry Minor', region: 'skerries', owner: null, count: 1, poly: [[240, 232], [310, 200], [372, 242], [352, 302], [270, 302]] },
  { name: 'Ulfsey', region: 'hrafnisles', owner: 'hra', count: 1, poly: [[1540, 132], [1620, 108], [1690, 158], [1650, 218], [1560, 206]] },
  { name: 'Brimsey', region: 'hrafnisles', owner: 'hra', count: 1, poly: [[2378, 102], [2480, 70], [2566, 112], [2546, 186], [2440, 194]] },
  { name: 'Isola Grande', region: 'sereisles', owner: 'ser', count: 3, poly: [[350, 2660], [470, 2600], [610, 2622], [700, 2700], [666, 2810], [540, 2862], [420, 2820], [340, 2740]] },
  { name: 'Isola Brava', region: 'sereisles', owner: 'ser', count: 1, poly: [[786, 2742], [872, 2716], [938, 2772], [906, 2846], [818, 2846]] },
  { name: 'Isla Clara', region: 'solmarre', owner: 'sol', count: 1, poly: [[2588, 2898], [2662, 2866], [2728, 2918], [2698, 2986], [2608, 2986]] },
  { name: 'Ember Isle', region: 'embercoast', owner: null, count: 2, poly: [[4806, 1656], [4902, 1636], [4966, 1718], [4958, 1834], [4872, 1884], [4798, 1812]] },
];

/** Lakes: impassable water inside the land. */
export const LAKES: Array<{ name: string; cx: number; cy: number; rx: number; ry: number; rot: number }> = [
  { name: 'Mirrormere', cx: 1905, cy: 1300, rx: 130, ry: 72, rot: -0.2 },
  { name: 'Tarnmere', cx: 2250, cy: 660, rx: 78, ry: 48, rot: 0.3 },
  { name: 'Lake Oren', cx: 3900, cy: 2200, rx: 100, ry: 62, rot: 0.1 },
];

// prettier-ignore
export const RANGES: RangeSpec[] = [
  { name: 'The Greyspine', half: 72, pts: [[1490, 300], [1530, 480], [1480, 640], [1500, 790], [1540, 960], [1500, 1120], [1530, 1262], [1560, 1450], [1520, 1640], [1550, 1820], [1600, 2000], [1570, 2150]] },
  { name: 'The Hoarfells', half: 66, pts: [[380, 950], [480, 1010], [580, 985], [652, 986], [760, 950], [860, 1000], [930, 990]] },
  { name: 'The Frostfangs', half: 70, pts: [[2560, 540], [2700, 600], [2850, 560], [2950, 520], [3050, 540], [3180, 610], [3320, 580], [3450, 530], [3560, 560]] },
  { name: 'The Iron Teeth', half: 70, pts: [[2980, 1560], [3100, 1500], [3220, 1520], [3330, 1542], [3460, 1590], [3600, 1560], [3740, 1520], [3880, 1600]] },
];

// prettier-ignore
export const RIVERS: RiverSpec[] = [
  { name: 'Aldwater', pts: [[2600, 950], [2620, 1250], [2700, 1600], [2690, 1950], [2780, 2300], [2830, 2780]] },
  { name: 'Vess', pts: [[1400, 1480], [1150, 1450], [900, 1520], [700, 1430], [600, 1370]] },
  { name: 'Serre', pts: [[1350, 1900], [1100, 2050], [950, 2250], [880, 2525]] },
  { name: 'Drevna', pts: [[2150, 770], [1950, 700], [1820, 560], [1770, 300]] },
  { name: 'Kolva', pts: [[3400, 700], [3650, 770], [4000, 810], [4300, 750], [4600, 690]] },
  { name: 'Tarn', pts: [[3520, 1690], [3450, 1950], [3480, 2170]] },
];

// prettier-ignore
export const FIXED: FixedProv[] = [
  // capitals
  { id: 'duncarrow', name: 'Dun Carrow', x: 540, y: 700, region: 'glens', owner: 'car', terrain: 'hills', resource: 'iron', dev: 5, pop: 40, infra: 1, fort: 2 },
  { id: 'vostburg', name: 'Vostburg', x: 1130, y: 640, region: 'vuplands', owner: 'vos', terrain: 'hills', resource: 'iron', dev: 5, pop: 50, infra: 1, fort: 2 },
  { id: 'aurelon', name: 'Aurelon', x: 880, y: 1320, region: 'heartland', owner: 'aur', terrain: 'plains', resource: 'goods', dev: 6, pop: 85, infra: 2, fort: 1 },
  { id: 'serenna', name: 'Serenna', x: 820, y: 2320, region: 'serecoast', owner: 'ser', terrain: 'plains', resource: 'goods', dev: 7, pop: 80, infra: 2, fort: 1 },
  { id: 'hrafnvik', name: 'Hrafnvik', x: 2000, y: 170, region: 'hrafn', owner: 'hra', terrain: 'hills', resource: 'goods', dev: 5, pop: 45, infra: 1, fort: 2 },
  { id: 'drevholm', name: 'Drevholm', x: 2140, y: 500, region: 'drevwoods', owner: 'dre', terrain: 'forest', resource: null, dev: 5, pop: 55, infra: 1, fort: 1 },
  { id: 'caldris', name: 'Caldris', x: 1810, y: 1150, region: 'lakelands', owner: 'cal', terrain: 'plains', resource: 'goods', dev: 6, pop: 60, infra: 1, fort: 2 },
  { id: 'istrenne', name: 'Istrenne', x: 1960, y: 1860, region: 'isthigh', owner: 'ist', terrain: 'hills', resource: 'iron', dev: 5, pop: 45, infra: 1, fort: 2 },
  { id: 'solmarre', name: 'Solmarre', x: 2210, y: 2720, region: 'solmarre', owner: 'sol', terrain: 'plains', resource: 'goods', dev: 6, pop: 60, infra: 2, fort: 2 },
  { id: 'lessara', name: 'Lessara', x: 2650, y: 1700, region: 'lessvale', owner: 'les', terrain: 'plains', resource: 'goods', dev: 6, pop: 75, infra: 2, fort: 1 },
  { id: 'morvay', name: 'Morvay', x: 3350, y: 1060, region: 'morhills', owner: 'mor', terrain: 'hills', resource: 'iron', dev: 6, pop: 55, infra: 1, fort: 1 },
  { id: 'fenhold', name: 'Fenhold', x: 4120, y: 700, region: 'fens', owner: 'fen', terrain: 'marsh', resource: 'grain', dev: 4, pop: 40, infra: 1, fort: 2 },
  { id: 'emberwatch', name: 'Emberwatch', x: 4340, y: 1260, region: 'ashmark', owner: 'ash', terrain: 'hills', resource: null, dev: 4, pop: 40, infra: 1, fort: 2 },
  { id: 'kharsa', name: 'Kharsa', x: 3650, y: 2010, region: 'steppe', owner: 'tar', terrain: 'steppe', resource: 'horses', dev: 4, pop: 45, infra: 1, fort: 1 },
  // passes through the ranges
  { id: 'northgate', name: 'Northgate', x: 1500, y: 790, region: 'tarnlands', owner: 'dre', terrain: 'mountains', resource: null, dev: 1, pop: 10, fort: 2, integ: 80, claims: ['vos'], pass: true },
  { id: 'kestrel', name: 'Kestrel Pass', x: 1530, y: 1262, region: 'caluplands', owner: 'cal', terrain: 'mountains', resource: null, dev: 1, pop: 8, fort: 2, integ: 85, claims: ['aur'], pass: true },
  { id: 'southgap', name: 'Southern Gap', x: 1550, y: 1820, region: 'isthigh', owner: 'ist', terrain: 'mountains', resource: null, dev: 1, pop: 10, fort: 2, integ: 80, claims: ['ser'], pass: true },
  { id: 'glenardach', name: 'Glen Ardach', x: 652, y: 986, region: 'firths', owner: 'car', terrain: 'mountains', resource: null, dev: 1, pop: 8, fort: 2, claims: ['aur'], pass: true },
  { id: 'frostgate', name: 'Frostgate', x: 3050, y: 540, region: 'morcross', owner: 'mor', terrain: 'mountains', resource: null, dev: 1, pop: 8, fort: 1, integ: 75, pass: true },
  { id: 'irongate', name: 'The Iron Gate', x: 3330, y: 1542, region: 'weststeppe', owner: 'tar', terrain: 'mountains', resource: 'iron', dev: 1, pop: 10, fort: 2, integ: 80, claims: ['mor'], pass: true },
  // Carrow's fortress facing Vostmark across the glens
  { id: 'carrickfell', name: 'Carrick Fell', x: 780, y: 700, region: 'glens', owner: 'car', terrain: 'hills', resource: null, dev: 2, pop: 18, fort: 2 },
  // Hrafnmark's fortress on the neck of its peninsula
  { id: 'skjoldheim', name: 'Skjoldheim', x: 1990, y: 330, region: 'hrafn', owner: 'hra', terrain: 'hills', resource: 'iron', dev: 3, pop: 30, fort: 2 },
  // landmarks of the frontier
  { id: 'amberfield', name: 'Amberfield', x: 2790, y: 820, region: 'hollowvale', owner: null, terrain: 'plains', resource: 'goods', dev: 2, pop: 14 },
];

// prettier-ignore
export const REGIONS: RegionSpec[] = [
  // ── west of the Greyspine ────────────────────────────────────────────────
  { id: 'glens', culture: 'car', count: 8, wealth: 1.9, anchors: [{ x: 430, y: 580, owner: 'car' }, { x: 720, y: 560, owner: 'car' }], biome: { hills: 4, forest: 2, mountains: 1.2, plains: 1.5 } },
  { id: 'firths', culture: 'car', count: 5, wealth: 2.0, anchors: [{ x: 300, y: 830, owner: 'car' }, { x: 640, y: 860, owner: 'car' }], biome: { hills: 2, plains: 2, forest: 2, marsh: 1 }, claims: [['vos', 1]] },
  { id: 'westfold', culture: 'wildw', count: 3, wealth: 0.8, anchors: [{ x: 250, y: 1060, owner: null }], biome: { marsh: 3, forest: 1, plains: 1 } },
  { id: 'skerries', culture: 'wildw', count: 3, wealth: 0.7, anchors: [], biome: { hills: 2, plains: 1 } },
  { id: 'greycoast', culture: 'vos', count: 6, wealth: 1.8, anchors: [{ x: 1130, y: 440, owner: 'vos' }, { x: 1330, y: 440, owner: 'vos' }], biome: { forest: 3, plains: 2, hills: 2 } },
  { id: 'vuplands', culture: 'vos', count: 8, wealth: 2.0, anchors: [{ x: 1150, y: 660, owner: 'vos' }, { x: 900, y: 640, owner: 'vos' }], biome: { hills: 3, plains: 3, forest: 2 } },
  { id: 'vmarch', culture: 'vos', count: 6, wealth: 2.2, anchors: [{ x: 1080, y: 900, owner: 'vos' }, { x: 1340, y: 880, owner: 'vos' }], biome: { plains: 3, hills: 2, forest: 1 }, claims: [['aur', 2], ['car', 1]] },
  { id: 'corbel', culture: 'aur', count: 5, wealth: 2.5, anchors: [{ x: 640, y: 1150, owner: 'aur' }, { x: 1180, y: 1130, owner: 'aur' }], biome: { plains: 3, hills: 2, forest: 2 }, claims: [['vos', 1]] },
  { id: 'heartland', culture: 'aur', count: 8, wealth: 3.4, anchors: [{ x: 900, y: 1320, owner: 'aur' }], biome: { plains: 7, forest: 1 } },
  { id: 'vesslands', culture: 'aur', count: 7, wealth: 3.0, anchors: [{ x: 560, y: 1520, owner: 'aur' }, { x: 1250, y: 1500, owner: 'aur' }], biome: { plains: 5, forest: 2, marsh: 0.6 } },
  { id: 'gulfshore', culture: 'aur', count: 3, wealth: 2.4, anchors: [{ x: 520, y: 1130, owner: 'aur' }, { x: 400, y: 1500, owner: 'aur' }], biome: { plains: 3, forest: 1, marsh: 1 } },
  { id: 'southmarch', culture: 'aur', count: 5, wealth: 2.6, anchors: [{ x: 520, y: 1780, owner: 'aur' }, { x: 850, y: 1850, owner: 'ser' }, { x: 1120, y: 1790, owner: 'ser' }], biome: { plains: 4, hills: 2, forest: 1 }, claims: [['aur', 2], ['ser', 1]] },
  { id: 'serrevale', culture: 'ser', count: 4, wealth: 2.3, anchors: [{ x: 1250, y: 1960, owner: 'ser' }], biome: { hills: 3, plains: 2, forest: 1 } },
  { id: 'serecoast', culture: 'ser', count: 9, wealth: 3.4, anchors: [{ x: 500, y: 2150, owner: 'ser' }, { x: 860, y: 2320, owner: 'ser' }], biome: { plains: 5, hills: 1, forest: 1 } },
  { id: 'sereisles', culture: 'ser', count: 4, wealth: 2.4, anchors: [], biome: { plains: 2, hills: 1, forest: 1 } },
  // ── centre ───────────────────────────────────────────────────────────────
  { id: 'hrafn', culture: 'hra', count: 8, wealth: 2.0, anchors: [{ x: 2000, y: 160, owner: 'hra' }, { x: 1930, y: 300, owner: 'hra' }], biome: { hills: 3, forest: 2, plains: 2, marsh: 0.5 } },
  { id: 'hrafnisles', culture: 'hra', count: 2, wealth: 1.4, anchors: [], biome: { hills: 2, plains: 1 } },
  { id: 'drevmouth', culture: 'hra', count: 4, wealth: 2.2, anchors: [{ x: 1700, y: 430, owner: 'hra' }], biome: { plains: 2, marsh: 1, forest: 1 }, claims: [['dre', 2]] },
  { id: 'drevwoods', culture: 'dre', count: 10, wealth: 2.2, anchors: [{ x: 2140, y: 470, owner: 'dre' }, { x: 2400, y: 640, owner: 'dre' }], biome: { forest: 7, plains: 2, hills: 1 } },
  { id: 'tarnlands', culture: 'dre', count: 7, wealth: 2.4, anchors: [{ x: 1760, y: 800, owner: 'dre' }, { x: 2080, y: 900, owner: 'dre' }], biome: { forest: 3, plains: 3, hills: 1 }, claims: [['cal', 1], ['hra', 1]] },
  { id: 'drevwolds', culture: 'dre', count: 4, wealth: 1.2, anchors: [{ x: 2600, y: 410, owner: 'dre' }], integ: [65, 80], biome: { forest: 3, hills: 2, plains: 1 } },
  { id: 'lakelands', culture: 'cal', count: 9, wealth: 3.0, anchors: [{ x: 1760, y: 1260, owner: 'cal' }, { x: 2080, y: 1400, owner: 'cal' }], biome: { plains: 4, forest: 1, marsh: 1, hills: 1 } },
  { id: 'caluplands', culture: 'cal', count: 7, wealth: 2.0, anchors: [{ x: 1700, y: 1060, owner: 'cal' }, { x: 2160, y: 1150, owner: 'cal' }, { x: 1720, y: 1500, owner: 'cal' }], biome: { hills: 3, forest: 2, plains: 1 }, claims: [['ist', 1], ['dre', 1]] },
  { id: 'isthigh', culture: 'ist', count: 10, wealth: 2.4, anchors: [{ x: 1850, y: 1790, owner: 'ist' }, { x: 2150, y: 1760, owner: 'ist' }], biome: { hills: 3, mountains: 1.5, forest: 1.5, plains: 1.5 }, claims: [['cal', 1]] },
  { id: 'littoral', culture: 'ist', count: 7, wealth: 2.5, anchors: [{ x: 1640, y: 2300, owner: 'ist' }, { x: 1960, y: 2240, owner: 'ist' }], biome: { plains: 3, hills: 2, forest: 1 }, claims: [['ser', 1], ['sol', 1]] },
  { id: 'solmarre', culture: 'sol', count: 12, wealth: 3.2, anchors: [{ x: 2200, y: 2760, owner: 'sol' }, { x: 2270, y: 2500, owner: 'sol' }], biome: { plains: 3, hills: 3, forest: 1 }, claims: [['ist', 1], ['les', 1]] },
  { id: 'upperald', culture: 'les', count: 7, wealth: 2.4, anchors: [{ x: 2560, y: 1120, owner: 'les' }, { x: 2800, y: 1200, owner: 'les' }], biome: { plains: 3, forest: 2, hills: 2 }, claims: [['dre', 1], ['mor', 1]] },
  { id: 'lessvale', culture: 'les', count: 9, wealth: 2.7, anchors: [{ x: 2620, y: 1680, owner: 'les' }], biome: { plains: 6, forest: 1 } },
  { id: 'delta', culture: 'les', count: 8, wealth: 2.4, anchors: [{ x: 2720, y: 2360, owner: 'les' }, { x: 2480, y: 2250, owner: 'les' }], biome: { plains: 4, marsh: 3 }, claims: [['sol', 1], ['tar', 1]] },
  { id: 'hollowvale', culture: 'vale', count: 7, wealth: 2.2, anchors: [{ x: 2800, y: 830, owner: null }], biome: { plains: 3, forest: 1, hills: 1 } },
  // ── east ─────────────────────────────────────────────────────────────────
  { id: 'northwilds', culture: 'wild', count: 14, wealth: 0.8, weight: 0.9, anchors: [{ x: 2880, y: 380, owner: null }, { x: 3280, y: 390, owner: null }, { x: 3700, y: 360, owner: null }, { x: 4150, y: 360, owner: null }], biome: { forest: 4, hills: 2, plains: 1, marsh: 1 } },
  { id: 'morcross', culture: 'mor', count: 8, wealth: 2.5, anchors: [{ x: 3060, y: 860, owner: 'mor' }, { x: 3100, y: 1300, owner: 'mor' }], biome: { plains: 3, hills: 2, forest: 2 }, claims: [['les', 2]] },
  { id: 'morhills', culture: 'mor', count: 9, wealth: 2.8, anchors: [{ x: 3360, y: 1060, owner: 'mor' }], biome: { hills: 4, plains: 3, forest: 1.5 } },
  { id: 'emberlin', culture: 'mor', count: 8, wealth: 2.2, anchors: [{ x: 3650, y: 880, owner: 'mor' }, { x: 3640, y: 1300, owner: 'mor' }], biome: { plains: 3, forest: 2, hills: 1 }, claims: [['ash', 1], ['fen', 1]] },
  { id: 'fens', culture: 'fen', count: 12, wealth: 2.2, anchors: [{ x: 4120, y: 680, owner: 'fen' }, { x: 3900, y: 820, owner: 'fen' }, { x: 4450, y: 640, owner: 'fen' }], biome: { marsh: 5, plains: 2, forest: 0.5 }, claims: [['mor', 1]] },
  { id: 'ashmark', culture: 'ash', count: 9, wealth: 1.8, anchors: [{ x: 4340, y: 1220, owner: 'ash' }, { x: 4470, y: 1480, owner: 'ash' }], biome: { plains: 3, forest: 2, hills: 2 }, claims: [['mor', 1]] },
  { id: 'ashwolds', culture: 'ash', count: 6, wealth: 1.2, anchors: [{ x: 3960, y: 1150, owner: 'ash' }, { x: 4020, y: 1460, owner: 'ash' }], integ: [70, 85], biome: { forest: 3, hills: 2, plains: 1 } },
  { id: 'steppe', culture: 'tar', count: 9, wealth: 1.6, weight: 0.9, anchors: [{ x: 3650, y: 2050, owner: 'tar' }], biome: { steppe: 7, plains: 1 } },
  { id: 'weststeppe', culture: 'tar', count: 8, wealth: 1.6, anchors: [{ x: 3150, y: 1900, owner: 'tar' }, { x: 3040, y: 2300, owner: 'tar' }], biome: { steppe: 5, plains: 2, hills: 1 }, claims: [['les', 1]] },
  { id: 'southsteppe', culture: 'tar', count: 7, wealth: 1.5, anchors: [{ x: 3900, y: 2480, owner: 'tar' }, { x: 4180, y: 2480, owner: 'tar' }], integ: [60, 80], biome: { steppe: 4, plains: 2 } },
  { id: 'khesh', culture: 'tar', count: 6, wealth: 1.1, anchors: [{ x: 4150, y: 1900, owner: 'tar' }], integ: [55, 75], biome: { steppe: 3, hills: 2 }, claims: [['ash', 1]] },
  { id: 'embercoast', culture: 'ember', count: 7, wealth: 1.0, anchors: [{ x: 4500, y: 2150, owner: null }, { x: 4420, y: 1800, owner: null }], biome: { hills: 2, forest: 2, plains: 1, marsh: 1 } },
];

/** Place names by culture, used in order after the fixed names. */
// prettier-ignore
export const NAMES: Record<string, string[]> = {
  car: ['Kilbrenn', 'Ardcraig', 'Balmorra', 'Innisfarr', 'Craigmoor', 'Tullach', 'Drumlee', 'Achnavar', 'Benmore', 'Kinvarra', 'Strathallan', 'Glenfinn', 'Dunlarig', 'Aberlin', 'Kilmarra', 'Carrick Fell'],
  vos: ['Harnfeld', 'Kaltwasser', 'Wendel', 'Ostrin', 'Grimhold', 'Rethel', 'Faltrip', 'Skarn', 'Ironcrag', 'Eisenau', 'Hohenmark', 'Steinach', 'Wolfsgrund', 'Falkenrode', 'Dornfeld', 'Hagenau', 'Kessel', 'Rabenstein', 'Thurnau', 'Adlersee', 'Lindenhof', 'Brandt'],
  aur: ['Westmere', 'Hollin', 'Brask', 'Terrow', 'Vantry', 'Leyfield', 'Corbel', 'Ashford', 'Marrowby', 'Elmsgate', 'Belcourt', 'Montvale', 'Sorrel', 'Verrin', 'Lorrance', 'Chalmont', 'Vessford', 'Bellweather', 'Rosendale', 'Aubrey', 'Merrow', 'Fairholm', 'Greyford', 'Duncairn', 'Castellane'],
  ser: ['Calvi', 'Porto Vell', 'Merand', 'Ostra', 'Varrow', 'Kell', 'Lissan', 'Tamber', 'Castelvero', 'Montisola', 'San Arrigo', 'Vellano', 'Corsaro', 'Belmare', 'Marisca', 'Torrevene', 'Aquila', 'Sirena', 'Cassaro', 'Pontera', 'Ravella'],
  hra: ['Skjoldheim', 'Eyrholm', 'Ulfsgard', 'Tjornes', 'Kaldvik', 'Stormhavn', 'Vargoy', 'Hvitfell', 'Soltun', 'Brimnes', 'Ormsund', 'Skaddi', 'Ravnes'],
  dre: ['Birchwold', 'Tarnwood', 'Ulmen', 'Greyhollow', 'Frostmere', 'Kolva', 'Hask', 'Varsk', 'Dubrava', 'Lesnoy', 'Brezno', 'Ravensk', 'Kamenka', 'Selvik', 'Olshany', 'Jarov', 'Drevna Ford', 'Mirosk', 'Pervane', 'Zarech', 'Tishov'],
  cal: ['Mirewick', 'Lakeholm', 'Harrowgate', 'Sedge', 'Tolland', 'Pellin', 'Wyndham', 'Loxley', 'Coldwater', 'Rushmere', 'Whitlow', 'Ambergate', 'Fernhollow', 'Stillwater', 'Reedham'],
  ist: ['Ardel', 'Corvo', 'Valdis', 'Sarn', 'Belcrest', 'Pellmark', 'Aigueval', 'Montrevel', 'Castelnau', 'Rocheval', 'Serrat', 'Vallorbe', 'Brianne', 'Lauzet', 'Mirabel', 'Queyras', 'Estagel'],
  sol: ['Alcara', 'Villaroja', 'Puerto Sal', 'Santaval', 'Oliveira', 'Cabo Lume', 'Mirasol', 'Almena', 'Sierra Dorada', 'Valdoro', 'Isla Clara', 'Torrecilla'],
  les: ['Oriel', 'Kallion', 'Melanthe', 'Dorion', 'Ithene', 'Kyrena', 'Pelagon', 'Argyra', 'Nysa', 'Therma', 'Astrion', 'Myrrhine', 'Velaxis', 'Eudora', 'Callisthe', 'Palaia', 'Aldford', 'Syrinx', 'Thaleia', 'Korinna', 'Lykos', 'Phaedon', 'Selene', 'Amphis'],
  vale: ['Goldmere', 'Oakenhall', 'Brightwater', 'Haverstock', 'Linden Vale', 'Harvestfold', 'Sheaf Hollow'],
  mor: ['Garrow', 'Emberlin', 'Thornby', 'Rookhill', 'Selvane', 'Dunmore', 'Carrack', 'Ilse', 'Wexley', 'Blackmoor', 'Pendrake', 'Caerwyn', 'Hollowell', 'Tregarth', 'Briarford', 'Ashcombe', 'Redmarch', 'Coldharbour', 'Kilnsey', 'Ironbridge', 'Penhallow', 'Morwen', 'Glaston', 'Trewen'],
  fen: ['Wendmire', 'Reedby', 'Saltmere', 'Holt', 'Cressing', 'Blackwater', 'Veendam', 'Moorwyk', 'Dijkhaven', 'Sluis', 'Eelbrook', 'Marram', 'Fleetholm'],
  ash: ['Cinderfell', 'Ashfort', 'Wardenhall', 'Greystone', 'Burnhollow', 'Charwood', 'Smokeholm', 'Kilnmoor', 'Brandwick', 'Harthold', 'Fellwatch', 'Beaconridge', 'Soothill', 'Cinderby', 'Scorchmoor'],
  tar: ['Orenkul', 'Beyla', 'Sulit', 'Dashkin', 'Amarak', 'Qorvai', 'Yeshil', 'Ulgari', 'Khesh', 'Irtal', 'Zhorun', 'Karatau', 'Tashkul', 'Sarybel', 'Ulantai', 'Bozkir', 'Ertugai', 'Kyzylar', 'Baraq', 'Tengiz', 'Altyn', 'Kokshe', 'Uzenbai', 'Temirsu', 'Aqsai', 'Burgan', 'Chagan', 'Saryarka', 'Jetisu', 'Ordabai', 'Kumsai'],
  wild: ['Sunderby', 'Coldreach', 'Whitefell', 'Hollowmere', 'Duskfell', 'Ravenmoor', 'Stonewatch', 'Varjola', 'Kaamos', 'Lumivaara', 'Harmaja', 'Otso', 'Tuulikki', 'Revontul', 'Kalmari', 'Rimeholt'],
  wildw: ['Skerrin', 'Grayholm', 'Brennmoor', 'Westfold', 'Muckle Ness', 'Selkie Holm', 'Gannet Rock'],
  ember: ['Corran', 'Greymarch', 'Ember Point', 'Cindersand', 'Scaldwater', 'Driftmoor', 'Saltcliff', 'Ashen Strand', 'Kiln Rock'],
};
