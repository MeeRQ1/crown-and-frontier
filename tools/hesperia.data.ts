// Authored data for "Hesperia, 1890" (tools/genreal.ts): an invented world built
// on the same pipeline as the real-world maps, from authored geography instead
// of Natural Earth. Everything here is original:
//  - two continents facing each other across the Narrows: Varr in the west (the
//    Fells, the plain of the Saune, the Ironspine, the dry peninsula of
//    Qasreen) and Ostmere in the east (the Lysse lowlands, the Greywall, the
//    Tessarine plateau, the Kharsk forests, the steppe and the Red Waste), with
//    Corwen in the western ocean, the Skerries in the north and the Sapphire
//    Isles in the south;
//  - coastlines, lakes and rivers drawn as control points and roughened
//    deterministically (midpoint displacement), so the shapes are authored and
//    the detail is repeatable;
//  - 22 realms and their regions, placed by anchor points; the land is divided
//    among the anchors of each landmass (a warped nearest-anchor rule, so
//    borders wander); three frontiers start unclaimed;
//  - capitals and great cities by hand; the other towns are drawn from each
//    realm's naming culture (src/maps/gen/names.ts) with a fixed seed.
// Coordinates are authored on a sketch grid (x, y) and placed on a small
// invented globe by P(); the projection only gives the map equal proportions.

import { NameBook, cultureById } from '../src/maps/gen/names';
import { mulberry, hashStr } from '../src/maps/gen/core';
import type { NationDef, Terrain } from '../src/sim/types';
import type { Feature, MapSource, Projection, RealMapDef, RealRegion } from './realmap';

type XY = [number, number];
/** Sketch grid → longitude and latitude on the invented globe. */
const P = ([x, y]: XY): XY => [0.62 * x - 2, 24 + 0.75 * (y - 12)];

/** Deterministic midpoint displacement: an authored outline with natural detail. */
function rough(pts: XY[], closed: boolean, depth: number, amp: number, seed: string): XY[] {
  const rnd = mulberry(hashStr(seed));
  let cur = pts.map((p) => [...p] as XY);
  for (let d = 0; d < depth; d++) {
    const out: XY[] = [];
    const n = closed ? cur.length : cur.length - 1;
    for (let i = 0; i < n; i++) {
      const a = cur[i];
      const b = cur[(i + 1) % cur.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const off = (rnd() * 2 - 1) * amp * len;
      out.push(a, [(a[0] + b[0]) / 2 - ((b[1] - a[1]) / (len || 1)) * off, (a[1] + b[1]) / 2 + ((b[0] - a[0]) / (len || 1)) * off]);
    }
    if (!closed) out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

// ───────────────────────────── land ────────────────────────────────────────

/** Landmasses: id, outline (sketch grid, clockwise), roughness. */
const LANDS: Array<{ id: string; name: string; pts: XY[]; amp?: number }> = [
  {
    id: 'varr',
    name: 'Varr',
    pts: [
      [-35.5, 63.2], [-36.8, 64.6], [-38.2, 65.4], [-36.6, 66.1], [-34.2, 65.6], [-32.4, 66.4], [-30.2, 66], [-28.4, 65.2], [-26.6, 65.6], [-25, 64.8], [-24.2, 63.4], [-23, 62], [-21.6, 61.6], [-20.2, 62.4], [-19.2, 63.8], [-18, 64.9],
      [-16.2, 65.2], [-14.6, 64.6], [-13, 63.8], [-11.2, 63.6], [-9.4, 62.6], [-7.6, 61.8], [-5.8, 61], [-5.2, 60], [-6.6, 59.2], [-8.4, 58.6], [-9, 57.4], [-8.2, 56.2], [-7, 55.4], [-5.6, 54.2], [-4.4, 53.2], [-3.4, 52.4],
      [-4.6, 51.8], [-6.2, 51.2], [-7.6, 50.8], [-9.2, 50.2], [-10.6, 49.4], [-9.6, 48.8], [-8, 48.4], [-7, 47.2], [-6.8, 45.8], [-7.6, 44.4], [-8.4, 42.8], [-8, 41.2], [-7.2, 39.8], [-6.8, 38.2], [-6.2, 36.8], [-5.6, 35.2],
      [-5.2, 33.8], [-6, 32.8], [-7, 32.2], [-7.8, 31], [-8.6, 30.2], [-10.2, 29.6], [-11, 28.4], [-10.4, 27], [-11.6, 26], [-12.8, 25.2], [-13.4, 23.6], [-13, 22], [-13.6, 20.4], [-14.8, 19.2], [-16, 17.8], [-17.2, 17],
      [-18.4, 17.6], [-19, 19], [-20.4, 19.8], [-21.4, 21.2], [-22.2, 22.8], [-23.4, 23.4], [-24.8, 23], [-26.2, 23.6], [-27.4, 24.8], [-28.8, 25.4], [-30.4, 25.2], [-32, 25.8], [-33.4, 26.8], [-35, 27.6], [-36.4, 28.8],
      [-37.6, 30.4], [-38.4, 32.2], [-38.2, 34], [-37, 35.4], [-35.4, 36], [-33.6, 36.8], [-32.4, 37.8], [-31.8, 39.2], [-32.2, 40.6], [-33.4, 41.6], [-35.2, 42.2], [-37, 42.6], [-38.6, 43.4], [-39.6, 44.8], [-39.8, 46.4],
      [-40.6, 47.8], [-41.8, 48.6], [-42.6, 50], [-41.6, 51.2], [-40.2, 51.6], [-39.6, 52.8], [-40.2, 54.2], [-39.4, 55.6], [-38.4, 56.8], [-38.8, 58.4], [-38, 59.8], [-37.2, 61], [-36.4, 62],
    ],
  },
  {
    id: 'ost',
    name: 'Ostmere',
    pts: [
      [-3, 62.6], [-2, 64.2], [-0.6, 65.4], [1.4, 66], [3.6, 65.6], [5.2, 66.6], [7.4, 66.8], [9.2, 66], [10.6, 64.6], [11.8, 62.8], [13.2, 61.8], [14.6, 62.6], [15.6, 64.2], [17, 65.6], [19.2, 66.4], [21.6, 66], [23.8, 66.6],
      [26.2, 66.2], [28.4, 65.2], [30.6, 64.8], [32.6, 63.6], [34.6, 62.8], [36.2, 61.4], [37, 59.6], [38.6, 58.4], [39.4, 56.6], [38.8, 54.8], [39.8, 53.2], [40.6, 51.4], [40.2, 49.6], [41, 47.8], [40.4, 46], [39.2, 44.6],
      [38, 43], [38.6, 41.4], [39.8, 40.2], [40.4, 38.4], [39.6, 36.6], [40, 34.8], [39.4, 33], [38.6, 31.2], [39, 29.4], [38.4, 27.6], [38.8, 25.6], [38, 23.8], [37.2, 22], [36, 20.6], [34.2, 19.6], [32.4, 18.4], [30.4, 17],
      [28.2, 16.6], [26.4, 17.4], [24.6, 18.8], [23, 19.4], [21.2, 18.6], [19.4, 17.6], [17.4, 17.8], [15.6, 18.8], [13.8, 19.6], [12, 20.4], [10.2, 20.6], [8.4, 21.4], [6.6, 22.2], [5, 23.4], [3.8, 24.8], [3.2, 26.4], [2, 27.6],
      [2.6, 29], [3.4, 30.2], [2.6, 31.6], [1.4, 32.6], [1, 34], [1.8, 35.2], [2.6, 36.4], [1.6, 37.6], [0.8, 38.8], [1.2, 40.2], [1.8, 41.6], [0.8, 42.8], [-0.2, 44], [-0.4, 45.6], [0.4, 46.8], [0, 48.2], [-0.8, 49.4],
      [-1.6, 50.6], [-2.2, 51.6], [-2.8, 52.6], [-3.4, 53.6], [-3, 54.8], [-3.6, 55.8], [-4.2, 56.8], [-3.6, 57.8], [-2.6, 58.6], [-3, 59.6], [-3.8, 60.6], [-3.6, 61.6],
    ],
  },
  { id: 'corwen', name: 'Corwen', pts: [[-50.8, 54], [-51.4, 55.6], [-50, 56.4], [-48.8, 57.8], [-47, 58.4], [-45.4, 58.9], [-44, 58], [-42.8, 57.2], [-42.2, 55.6], [-41.4, 54.4], [-41.6, 53], [-42.4, 51.8], [-43.4, 50.6], [-44.8, 49.8], [-46.4, 49.2], [-47.8, 49.8], [-49, 50.6], [-50.4, 51.4], [-49.8, 52.6]] },
  { id: 'skerry1', name: 'Greater Skerry', pts: [[-29.4, 67.6], [-28.6, 68.6], [-27.2, 68.9], [-25.8, 69.4], [-24.4, 68.6], [-24.8, 67.6], [-25.8, 67.4], [-27, 66.9], [-28.4, 67]] },
  { id: 'skerry2', name: 'Lesser Skerry', pts: [[-22.2, 68.4], [-21, 69.2], [-19.6, 69.4], [-18.2, 68.8], [-18.6, 67.8], [-19.8, 67.6], [-21.2, 67.7]] },
  { id: 'hask', name: 'Hask', pts: [[-4.5, 47.5], [-3.6, 48.1], [-2.8, 48.2], [-1.9, 47.7], [-1.6, 47], [-1.7, 46], [-2.2, 45], [-3, 44.5], [-4, 44.3], [-4.7, 44.9], [-5, 45.8], [-4.9, 46.7]] },
  { id: 'merrow', name: 'Merrow', pts: [[-5.5, 40.2], [-4.6, 40.6], [-3.9, 39.9], [-3.6, 38.9], [-4.2, 37.9], [-5.1, 37.8], [-5.7, 38.8]] },
  { id: 'sapphire', name: 'Great Sapphire', pts: [[-6.6, 18.2], [-5.4, 19.2], [-3.8, 19.6], [-2.2, 20.2], [-0.6, 19.8], [0.8, 19], [2, 18.8], [2.6, 17.6], [1.8, 16.6], [0.6, 15.6], [-1.2, 15.4], [-2.6, 14.8], [-4.4, 15], [-5.8, 15.8], [-7, 16.8]] },
  { id: 'calla', name: 'Calla', pts: [[4, 16.5], [5.8, 17.1], [7.5, 17.2], [8.6, 16.4], [9, 15.2], [7.6, 14.3], [6, 14], [4.6, 14.9]] },
  { id: 'orsa', name: 'Orsa', pts: [[-12, 15.5], [-10.4, 16.1], [-9, 16.2], [-8.4, 15.2], [-8.5, 14.2], [-9.8, 13.6], [-11, 13.4], [-12.2, 14.3]] },
  { id: 'pell', name: 'Pell', pts: [[11, 19], [12, 19.4], [13, 19.4], [13.4, 18.7], [13.2, 18], [12.2, 17.6], [11.2, 17.6], [10.8, 18.3]] },
];

const LAKES: Array<{ name: string; pts: XY[] }> = [
  { name: 'Lake Vell', pts: [[-22.2, 48.2], [-21, 49.4], [-19.8, 49], [-18.6, 49.8], [-17.2, 49.4], [-16.2, 48.4], [-16.6, 47.4], [-15.8, 46.4], [-16.8, 45.8], [-18.2, 46.4], [-19.4, 45.8], [-20.8, 46.2], [-21.4, 47.2]] },
  { name: 'Lake Tessar', pts: [[17.4, 40.6], [18.4, 41.6], [19.8, 41.4], [21, 42.2], [22.2, 41.4], [22.4, 40.2], [21.2, 39.6], [20.6, 38.8], [19.2, 39.2], [18, 39], [17.2, 39.6]] },
  { name: 'The Bitter Lake', pts: [[22.2, 25.8], [23.2, 26.8], [24.6, 26.6], [25.8, 27], [26, 25.8], [25, 25], [23.6, 24.4], [22.6, 24.8]] },
];

/** Rivers from source to mouth. */
const RIVERS: Array<{ name: string; pts: XY[] }> = [
  { name: 'Saune', pts: [[-19, 57], [-18.6, 53.5], [-18, 49.5], [-16, 45.8], [-14.5, 43.5], [-13, 41.5], [-11.5, 39.4], [-10.5, 37.6], [-9.3, 35.8], [-8.5, 34.4], [-7.2, 33]] },
  { name: 'Morwe', pts: [[-24.5, 45], [-26.5, 43.8], [-28.5, 42.2], [-30.4, 41], [-32.4, 40]] },
  { name: 'Halde', pts: [[-24.5, 56.8], [-24, 58.6], [-23.2, 60.4], [-22.2, 61.8]] },
  { name: 'Ember', pts: [[-21, 31], [-19.8, 28.6], [-18.6, 26.4], [-17, 24.6], [-15.4, 22.4], [-13.6, 20.9]] },
  { name: 'Amun', pts: [[29, 22.5], [26.5, 24], [22.5, 25.8], [19, 27], [16, 27.8], [12.5, 28.4], [9.5, 28.6], [6, 28.8], [2.6, 28.6]] },
  { name: 'Lysse', pts: [[4.2, 60], [3.4, 57.6], [2.2, 55.2], [1, 53], [0.2, 51.2], [-0.8, 49.6]] },
  { name: 'Dvara', pts: [[20, 48.5], [19.6, 51.5], [19, 54.5], [17.4, 57.5], [15.6, 59.8], [13.6, 61.8]] },
  { name: 'Tess', pts: [[27, 44], [25.4, 43.2], [24, 42.4], [22.4, 41.4]] },
  { name: 'Kharsk', pts: [[30.5, 45], [29.6, 41.5], [28.4, 37.5], [27, 33], [25.8, 29.4], [25, 27]] },
  { name: 'Oskel', pts: [[12, 36.5], [10, 35.8], [7.6, 35.2], [5, 35.4], [2.2, 35.6]] },
  { name: 'Volzha', pts: [[24, 52], [27, 53], [30, 52.4], [33.6, 51.6], [37, 51.8], [40.2, 51.6]] },
];

const RIDGES: Array<{ name: string; halfKm: number; pts: XY[] }> = [
  { name: 'The Ironspine', halfKm: 22, pts: [[-32, 27.5], [-33.8, 31], [-33.2, 34.5], [-30.5, 38.5], [-29.6, 41.5], [-31, 45], [-33.5, 48.5], [-33.2, 53]] },
  { name: 'The Fells', halfKm: 20, pts: [[-31, 58.2], [-27.5, 59], [-24, 59.6], [-20.5, 58.6], [-17, 58.2], [-13.5, 59.6]] },
  { name: 'The Greywall', halfKm: 20, pts: [[6.4, 63], [7, 59.5], [6.8, 56.5], [5.8, 53.5], [5.2, 50.5]] },
  { name: 'The Crown Mountains', halfKm: 22, pts: [[9.6, 45.5], [9.2, 42], [10, 38.6], [11.4, 35.8], [14, 33.6], [18, 32.8], [22.5, 33.6]] },
  { name: 'The Eagle Ridge', halfKm: 18, pts: [[12.5, 46.6], [16, 47.6], [20, 47.8], [24, 47], [27.5, 45.6]] },
];
const PASSES: Array<{ name: string; at: XY }> = [
  { name: 'Gate of Thorns', at: [-33.6, 32.6] },
  { name: 'Corrin Pass', at: [-30, 42.6] },
  { name: 'Skar Pass', at: [-22, 59.2] },
  { name: "Wolf's Throat", at: [6.9, 57.6] },
  { name: 'The Iron Gate', at: [9.4, 40.2] },
  { name: 'Eagle Pass', at: [18, 47.75] },
];
const STRAITS: Array<{ name: string; a: XY; b: XY }> = [
  { name: 'The Needle', a: [-5, 52.9], b: [-1.8, 52.6] },
  { name: 'Hask Sound', a: [-5, 45.8], b: [-7.4, 45.9] },
  { name: 'Lys Sound', a: [-1.65, 46.9], b: [0.2, 46.9] },
  { name: 'Merrow Strait', a: [-5.6, 39.2], b: [-7.8, 39.4] },
  { name: 'Corwen Sound', a: [-41.8, 53.4], b: [-39.2, 53.2] },
];
const SEAS: Array<[string, XY, number?]> = [
  ['The Narrows', [-3.2, 41.5], 26],
  ['The Boreal Sea', [-6, 66.8], 30],
  ['The Western Main', [-49, 40], 36],
  ['The Bay of Sorrows', [-35.2, 39.4], 20],
  ['The Sapphire Sea', [-1, 22.2], 28],
  ['The Southern Ocean', [-26, 15], 34],
  ['The Gulf of Amun', [-1.5, 29.5], 20],
  ['Corwen Sound', [-41, 46.5], 18],
  ['The Skerry Sound', [-23, 66.8], 18],
  ['The Hoar Gulf', [13.4, 65], 20],
  ['The Hoar Sea', [26, 68.6], 26],
  ['The Eastern Ocean', [42.6, 40], 32],
  ['The Gulf of Sahr', [27, 14.4], 22],
];

// ───────────────────────────── realms ──────────────────────────────────────

type Arms = NonNullable<NationDef['arms']>;
const arms = (field: string, ordinary: string, ordinaryTincture: string, charge: string, chargeTincture: string): Arms => ({ field, ordinary, ordinaryTincture, charge, chargeTincture });
const nation = (id: string, name: string, short: string, adjective: string, color: string, capital: string, personality: NationDef['personality'], a: Arms, summary: string, strength: string, constraint: string, traits: NationDef['traits'], startType: string, rating: NationDef['rating']): NationDef => ({ id, name, short, adjective, color, capital, personality, emblem: a.charge === 'none' ? 'crown' : a.charge, summary, strength, constraint, traits, startType, rating, arms: a });

/** Each realm's naming culture (src/maps/gen/names.ts). */
const CULTURE: Record<string, string> = {
  skh: 'norse', mor: 'highland', irn: 'highland', var: 'heartland', vel: 'lowland', lor: 'southern', ast: 'southern', ils: 'classical', qas: 'steppe', cor: 'heartland', hsk: 'norse',
  lys: 'lowland', hal: 'lowland', bre: 'woodland', kha: 'eastern', dor: 'eastern', tes: 'classical', osk: 'southern', tar: 'steppe', amu: 'classical', sah: 'steppe', sap: 'southern',
};

export const NATIONS: NationDef[] = [
  nation('var', 'Empire of Varr', 'Varr', 'Varrish', '#a8443c', 'aurum', 'expansionist', arms('gules', 'none', 'gules', 'crown', 'or'), 'The old empire of the Saune plain, master of the largest army in the west and of the lakes at its heart, hemmed in by the kingdoms it once ruled.', 'A rich heartland and a deep reserve of men.', 'Neighbours on every side remember its rule.', { incomeMul: 0.1, manpowerMul: 0.15 }, 'Wealthy heartland', 'recommended'),
  nation('skh', 'Kingdom of Skarholt', 'Skarholt', 'Skarholtic', '#4f7393', 'skarholt', 'opportunist', arms('azure', 'cross', 'argent', 'none', 'or'), 'A kingdom of fjords and fells on the cold north coast of Varr, with the Skerries offshore and the timber of the whole north.', 'Seafarers: straits cost less to cross and trade pays more.', 'Thin soil and long winters.', { straitCostAdd: -1, tradeMul: 0.15, popGrowthMul: -0.1 }, 'Maritime trader', 'standard'),
  nation('mor', 'Kingdom of Morvaine', 'Morvaine', 'Morvainish', '#5f8a5a', 'morvaine', 'defensive', arms('vert', 'chevron', 'argent', 'tower', 'or'), 'A highland crown on the Bay of Sorrows, whose glens have never been held by an outsider for long.', 'Highland forts: forts cost less and defenders hold.', 'Poor and remote.', { fortCostMul: -0.25, incomeMul: -0.1 }, 'Mountain realm', 'standard'),
  nation('irn', 'Confederacy of the Ironspine', 'Ironspine', 'Ironspine', '#8a6b4a', 'thornhold', 'defensive', arms('sable', 'pale', 'or', 'hammer', 'sable'), 'Mining cantons along the western mountains, armed and neutral, selling iron to every side.', 'Iron and militia: iron is cheap and the passes are held.', 'No plain to feed an army.', { fortCostMul: -0.2, devCostMul: -0.1, supplyProdMul: -0.1 }, 'Small neutral', 'challenging'),
  nation('vel', 'Grand Duchy of Velland', 'Velland', 'Vellish', '#c9a14a', 'velde', 'diplomat', arms('or', 'fess', 'azure', 'none', 'or'), 'A wealthy duchy of dykes and harbours on the Narrows, a buffer between Varr and the eastern kingdoms.', 'Commerce and good relations.', 'Flat, small and coveted.', { tradeMul: 0.2, opinionAdd: 10 }, 'Small neutral', 'challenging'),
  nation('lor', 'Most Serene Republic of Lorresse', 'Lorresse', 'Lorressan', '#3f8f8a', 'lorresse', 'commercial', arms('azure', 'perPale', 'argent', 'ship', 'or'), 'The merchant republic of the Saune delta, whose banks lend to half the crowns of Varr and whose fleet guards the southern mouth of the Narrows.', 'Banking and shipping: trade and income above its size.', 'Few men for a great fleet.', { tradeMul: 0.3, incomeMul: 0.1, manpowerMul: -0.2 }, 'Maritime trader', 'recommended'),
  nation('ast', 'Kingdom of Aster', 'Aster', 'Asterine', '#b77a4a', 'asterra', 'opportunist', arms('gules', 'bend', 'or', 'star', 'argent'), 'A sun-dried kingdom of vineyards and hill towns between the Saune and the Ironspine, rival of Lorresse and old vassal of Varr.', 'Hardy hill soldiers.', 'Little industry and rich neighbours.', { moraleAdd: 0.3, researchMul: -0.1 }, 'Established crown', 'standard'),
  nation('ils', 'Holy See of Saint Ilse', 'Ilse', 'Ilsean', '#8f84b5', 'ilsara', 'diplomat', arms('argent', 'cross', 'purpure', 'key', 'or'), 'The seat of the faith of the west, a small sacred realm whose word still moves kings.', 'Its word carries: others think well of it and envoys go further.', 'A tiny army in the middle of the great powers.', { opinionAdd: 20, envoyAdd: 1, manpowerMul: -0.3 }, 'Small neutral', 'challenging'),
  nation('qas', 'Sultanate of Qasreen', 'Qasreen', 'Qasreeni', '#c08f4a', 'qasreen', 'expansionist', arms('vert', 'none', 'vert', 'crescent', 'or'), 'A desert sultanate on the dry southern peninsula of Varr, horse-breeders and caravan lords who covet the vineyards to the north.', 'Desert horsemen: cavalry strikes hard and costs less.', 'Dry land: food and industry are scarce.', { cavalryAttackAdd: 0.1, cavalryCostMul: -0.2, supplyProdMul: -0.15 }, 'Desert emirate', 'standard'),
  nation('cor', 'Kingdom of Corwen', 'Corwen', 'Corwenish', '#6b5f9a', 'caercorwen', 'commercial', arms('azure', 'saltire', 'argent', 'crown', 'or'), 'An island kingdom in the western ocean, with the strongest fleet in Hesperia and a habit of keeping the continent divided.', 'The sea: trade pays more and fleets are cheap.', 'A small army that must cross the sea.', { tradeMul: 0.25, manpowerMul: -0.15 }, 'Maritime empire', 'recommended'),
  nation('hsk', 'Lordship of Hask', 'Hask', 'Haskish', '#4a7a6a', 'haskholm', 'opportunist', arms('sable', 'none', 'sable', 'ship', 'argent'), 'A rock in the middle of the Narrows whose lords take tolls from every ship between the two continents.', 'Tolls and pilots: trade pays and straits are cheap.', 'One island and many covetous neighbours.', { tradeMul: 0.3, straitCostAdd: -1 }, 'Maritime trader', 'challenging'),
  nation('lys', 'Kingdom of Lys', 'Lys', 'Lysian', '#3d63a3', 'lysanne', 'commercial', arms('azure', 'chief', 'or', 'reed', 'or'), 'The lowland kingdom on the eastern shore of the Narrows, crowded with mills and canals, the workshop of Ostmere.', 'Industry and canals: factories and research above its size.', 'Low, flat and open to invasion.', { researchMul: 0.1, incomeMul: 0.1, fortCostMul: 0.1 }, 'Wealthy heartland', 'recommended'),
  nation('hal', 'Free City of Halden', 'Halden', 'Haldener', '#d08a3a', 'halden', 'commercial', arms('or', 'bordure', 'gules', 'tower', 'gules'), 'The free city at the Needle, the narrowest crossing between the continents, whose guarantee every great power has signed.', 'The crossing: trade pays and others respect it.', 'One city between two worlds.', { tradeMul: 0.3, opinionAdd: 10 }, 'Small neutral', 'challenging'),
  nation('bre', 'Electorate of Brennholt', 'Brennholt', 'Brennish', '#5d5d6b', 'brennholt', 'defensive', arms('argent', 'fess', 'sable', 'tree', 'vert'), 'A forest electorate behind the Greywall, with coal in its hills and a staff college that trains the officers of half the east.', 'Staff work: research is quick and forts cheap.', 'Between Lys, Kharsk and Doros.', { researchMul: 0.15, fortCostMul: -0.1 }, 'Established crown', 'standard'),
  nation('kha', 'Tsardom of Kharsk', 'Kharsk', 'Kharskian', '#4f7a55', 'kharsk', 'expansionist', arms('or', 'saltire', 'gules', 'none', 'or'), 'The vast tsardom of the northern forests and the eastern plains, slow to stir and impossible to exhaust.', 'Endless manpower: armies are cheap to fill.', 'Few railways: supply and research are slow.', { manpowerMul: 0.35, researchMul: -0.15, supplyProdMul: -0.1 }, 'Old empire', 'standard'),
  nation('dor', 'Kingdom of Doros', 'Doros', 'Dorosian', '#8e3f5f', 'dorovets', 'opportunist', arms('gules', 'chevron', 'or', 'horse', 'argent'), 'A young kingdom between the Eagle Ridge and the Kharsk forests, freed from the Tessarine Empire within living memory and eager for more.', 'Veterans: soldiers fight well.', 'Surrounded by larger realms.', { moraleAdd: 0.4 }, 'New state', 'standard'),
  nation('tes', 'Tessarine Empire', 'Tessara', 'Tessarine', '#9b5b3a', 'tessarion', 'defensive', arms('purpure', 'none', 'purpure', 'sun', 'or'), 'The ancient empire of the high plateau, ringed by the Crown Mountains, whose provinces have been falling away for a century.', 'The plateau: defenders fight well at home and forts are cheap.', 'Debts and restless provinces.', { fortCostMul: -0.2, moraleAdd: 0.2, incomeMul: -0.15, integrationMul: -0.2 }, 'Old empire', 'challenging'),
  nation('osk', 'Principality of Oskel', 'Oskel', 'Oskelan', '#7a9a4a', 'oskel', 'commercial', arms('vert', 'pale', 'or', 'wheat', 'vert'), 'A coastal principality of olive groves and ports under the western wall of the Crown Mountains.', 'Ports and orchards.', 'Between the plateau and the sea.', { tradeMul: 0.2, popGrowthMul: 0.1 }, 'Maritime trader', 'standard'),
  nation('tar', 'Horde of Tarkhan', 'Tarkhan', 'Tarkhani', '#b0884a', 'kurgal', 'expansionist', arms('or', 'none', 'or', 'horse', 'sable'), 'The horse-lords of the eastern steppe, who have raided the plateau and the Kharsk frontier for six hundred years.', 'Horsemen: cavalry strikes hard and costs less.', 'No towns to speak of: little income or research.', { cavalryAttackAdd: 0.15, cavalryCostMul: -0.25, incomeMul: -0.2, researchMul: -0.2 }, 'Steppe horde', 'challenging'),
  nation('amu', 'Khedivate of Amun', 'Amun', 'Amunite', '#c76d5a', 'neferet', 'defensive', arms('azure', 'fess', 'or', 'reed', 'argent'), 'The river kingdom of the Amun valley, green between two deserts, nominally a province of the Tessarine Empire and in fact its own master.', 'The river: food and population grow.', 'Deserts on both sides.', { popGrowthMul: 0.2, supplyProdMul: 0.1 }, 'Established crown', 'standard'),
  nation('sah', 'Emirate of Sahrun', 'Sahrun', 'Sahruni', '#a8925a', 'sahrun', 'opportunist', arms('sable', 'chief', 'or', 'crescent', 'argent'), 'An emirate of oases and caravan roads on the southern edge of the Red Waste, rich in nitrates and poor in everything else.', 'Desert warfare: soldiers fight well in the waste.', 'Thin land and few people.', { moraleAdd: 0.3, manpowerMul: -0.15 }, 'Desert emirate', 'challenging'),
  nation('sap', 'Republic of Sapphira', 'Sapphira', 'Sapphiran', '#3a8fb5', 'sapphira', 'commercial', arms('azure', 'bordure', 'or', 'lozenge', 'argent'), 'A planters’ republic on the Great Sapphire, the richest of the southern isles, with unclaimed islands all around it.', 'Plantations and ships: trade pays well.', 'A small island far from everyone.', { tradeMul: 0.25, manpowerMul: -0.15 }, 'Island republic', 'standard'),
];

// ───────────────────────────── regions ─────────────────────────────────────

type Biome = 'temp' | 'hill' | 'mtn' | 'boreal' | 'tundra' | 'steppe' | 'dry' | 'desert' | 'med' | 'marsh' | 'river' | 'high';
const BIOMES: Record<Biome, Partial<Record<Terrain, number>>> = {
  temp: { plains: 3, forest: 2, hills: 1, marsh: 0.4 },
  hill: { hills: 3, forest: 1.6, plains: 1.4, mountains: 0.4 },
  mtn: { mountains: 2.2, hills: 2.2, forest: 1.4, plains: 0.4 },
  boreal: { forest: 3.4, marsh: 1.6, hills: 0.6, plains: 0.5 },
  tundra: { marsh: 2.2, hills: 1.6, forest: 0.8, plains: 0.3 },
  steppe: { steppe: 3.4, plains: 1.6, hills: 0.3 },
  dry: { steppe: 3, hills: 1.6, mountains: 0.5, plains: 0.4 },
  desert: { steppe: 3.6, hills: 1.2, mountains: 0.4 },
  med: { hills: 2.6, plains: 2, forest: 0.6, mountains: 0.6 },
  marsh: { plains: 2.4, marsh: 2, forest: 1 },
  river: { plains: 4, marsh: 1, steppe: 0.6 },
  high: { hills: 2.6, mountains: 1.4, steppe: 1, plains: 0.8 },
};
const SPARSE: Record<Biome, number> = { temp: 1, hill: 1.2, mtn: 1.5, boreal: 1.6, tundra: 3, steppe: 1.6, dry: 1.8, desert: 3, med: 1, marsh: 1.2, river: 0.8, high: 1.3 };

/** Regions: id, name, realm, anchor (sketch grid), landmass, biome; `free` starts unclaimed (realm gives its names). */
const REGION_LIST: Array<{ id: string; name: string; realm: string; at: XY; land: string; biome: Biome; free?: boolean }> = [
  // Varr: the Empire
  { id: 'aurum', name: 'Aurum', realm: 'var', at: [-23, 51.2], land: 'varr', biome: 'temp' },
  { id: 'vellmere', name: 'Vellmere', realm: 'var', at: [-17.2, 52.6], land: 'varr', biome: 'temp' },
  { id: 'saunefields', name: 'Saunefields', realm: 'var', at: [-19.5, 43.6], land: 'varr', biome: 'temp' },
  { id: 'westmarch', name: 'The Westmarch', realm: 'var', at: [-27.5, 51], land: 'varr', biome: 'temp' },
  { id: 'northreach', name: 'Northreach', realm: 'var', at: [-21, 55.8], land: 'varr', biome: 'boreal' },
  { id: 'eastmark', name: 'Eastmark', realm: 'var', at: [-12.8, 54.6], land: 'varr', biome: 'temp' },
  { id: 'midvale', name: 'Midvale', realm: 'var', at: [-25.5, 46.2], land: 'varr', biome: 'temp' },
  { id: 'southwold', name: 'Southwold', realm: 'var', at: [-22.8, 40.2], land: 'varr', biome: 'hill' },
  // Skarholt
  { id: 'skarholt', name: 'Skarholt', realm: 'skh', at: [-22.5, 61.2], land: 'varr', biome: 'hill' },
  { id: 'haldefjords', name: 'Halde Fjords', realm: 'skh', at: [-16, 62.6], land: 'varr', biome: 'boreal' },
  { id: 'westfell', name: 'Westfell', realm: 'skh', at: [-31, 61.4], land: 'varr', biome: 'hill' },
  { id: 'hvitmark', name: 'Hvitmark', realm: 'skh', at: [-8.2, 60.4], land: 'varr', biome: 'boreal' },
  { id: 'ravnsund', name: 'Ravnsund', realm: 'skh', at: [-27, 64], land: 'varr', biome: 'tundra' },
  { id: 'skerries', name: 'The Skerries', realm: 'skh', at: [-24, 67.8], land: 'skerry1', biome: 'tundra' },
  { id: 'lesserskerry', name: 'Lesser Skerry', realm: 'skh', at: [-20, 68], land: 'skerry2', biome: 'tundra' },
  // Morvaine
  { id: 'morvaine', name: 'Morvaine', realm: 'mor', at: [-36, 47], land: 'varr', biome: 'temp' },
  { id: 'ardoch', name: 'Ardoch', realm: 'mor', at: [-37, 52.4], land: 'varr', biome: 'hill' },
  { id: 'northmoor', name: 'Northmoor', realm: 'mor', at: [-35.6, 57.4], land: 'varr', biome: 'boreal' },
  { id: 'sorrowmouth', name: 'Sorrowmouth', realm: 'mor', at: [-35, 43.4], land: 'varr', biome: 'temp' },
  // Ironspine
  { id: 'thornhold', name: 'Thornhold', realm: 'irn', at: [-29.6, 34.6], land: 'varr', biome: 'mtn' },
  { id: 'corrin', name: 'Corrin', realm: 'irn', at: [-28.6, 41], land: 'varr', biome: 'mtn' },
  { id: 'gatewater', name: 'Gatewater', realm: 'irn', at: [-35.4, 31.6], land: 'varr', biome: 'hill' },
  { id: 'highcairn', name: 'Highcairn', realm: 'irn', at: [-31.2, 48.4], land: 'varr', biome: 'mtn' },
  // Velland
  { id: 'velde', name: 'Velde', realm: 'vel', at: [-9.6, 51.4], land: 'varr', biome: 'marsh' },
  { id: 'sandmark', name: 'Sandmark', realm: 'vel', at: [-9.4, 46.8], land: 'varr', biome: 'temp' },
  { id: 'needlecliffs', name: 'Needlecliffs', realm: 'vel', at: [-6.4, 54.6], land: 'varr', biome: 'hill' },
  // Holy See
  { id: 'ilsara', name: 'Saint Ilse', realm: 'ils', at: [-14.6, 45.8], land: 'varr', biome: 'temp' },
  // Lorresse
  { id: 'lorresse', name: 'Lorresse', realm: 'lor', at: [-8.8, 34.2], land: 'varr', biome: 'river' },
  { id: 'uppersaune', name: 'Upper Saune', realm: 'lor', at: [-11.8, 40], land: 'varr', biome: 'river' },
  { id: 'ambracoast', name: 'The Ambra Coast', realm: 'lor', at: [-11.6, 28.6], land: 'varr', biome: 'med' },
  { id: 'merrow', name: 'Merrow', realm: 'lor', at: [-4.7, 39.2], land: 'merrow', biome: 'med' },
  // Aster
  { id: 'asterra', name: 'Asterra', realm: 'ast', at: [-17.6, 36.2], land: 'varr', biome: 'med' },
  { id: 'dunmere', name: 'Dunmere', realm: 'ast', at: [-22, 32.8], land: 'varr', biome: 'med' },
  { id: 'asterwold', name: 'Asterwold', realm: 'ast', at: [-26, 37], land: 'varr', biome: 'hill' },
  // Qasreen
  { id: 'qasreen', name: 'Qasreen', realm: 'qas', at: [-19.6, 23.2], land: 'varr', biome: 'dry' },
  { id: 'capeember', name: 'Cape Ember', realm: 'qas', at: [-16.8, 19.8], land: 'varr', biome: 'dry' },
  { id: 'zaharhills', name: 'The Zahar Hills', realm: 'qas', at: [-25, 25.4], land: 'varr', biome: 'dry' },
  { id: 'amberlands', name: 'The Amberlands', realm: 'qas', at: [-14.8, 26.4], land: 'varr', biome: 'med' },
  { id: 'emberwaste', name: 'The Ember Waste', realm: 'qas', at: [-31, 28.2], land: 'varr', biome: 'desert' },
  // Corwen
  { id: 'caercorwen', name: 'Caer Corwen', realm: 'cor', at: [-45, 53], land: 'corwen', biome: 'temp' },
  { id: 'northcorwen', name: 'North Corwen', realm: 'cor', at: [-46.5, 57], land: 'corwen', biome: 'hill' },
  { id: 'westmere', name: 'Westmere', realm: 'cor', at: [-49.2, 51.6], land: 'corwen', biome: 'temp' },
  // Hask
  { id: 'hask', name: 'Hask', realm: 'hsk', at: [-3.2, 46.3], land: 'hask', biome: 'hill' },
  // Ostmere: Lys
  { id: 'lysanne', name: 'Lysanne', realm: 'lys', at: [1.8, 49.4], land: 'ost', biome: 'temp' },
  { id: 'northlys', name: 'North Lys', realm: 'lys', at: [1, 57], land: 'ost', biome: 'temp' },
  { id: 'lyssefens', name: 'The Lysse Fens', realm: 'lys', at: [2.8, 53.2], land: 'ost', biome: 'marsh' },
  { id: 'southlys', name: 'South Lys', realm: 'lys', at: [2.6, 45], land: 'ost', biome: 'temp' },
  // Halden
  { id: 'halden', name: 'Halden', realm: 'hal', at: [-1.8, 52.4], land: 'ost', biome: 'temp' },
  // Brennholt
  { id: 'brennholt', name: 'Brennholt', realm: 'bre', at: [10.4, 52.4], land: 'ost', biome: 'temp' },
  { id: 'kessmark', name: 'Kessmark', realm: 'bre', at: [12.6, 56.8], land: 'ost', biome: 'boreal' },
  { id: 'ostwald', name: 'Ostwald', realm: 'bre', at: [8.8, 48.4], land: 'ost', biome: 'hill' },
  // the Hoarlands: unclaimed north
  { id: 'hoarcoast', name: 'The Hoar Coast', realm: 'bre', at: [3, 63], land: 'ost', biome: 'tundra', free: true },
  { id: 'hoarlands', name: 'The Hoarlands', realm: 'bre', at: [18.5, 62.6], land: 'ost', biome: 'tundra', free: true },
  { id: 'frostreach', name: 'Frostreach', realm: 'kha', at: [27.5, 62.8], land: 'ost', biome: 'tundra', free: true },
  { id: 'hoarcape', name: 'Cape Hoar', realm: 'bre', at: [8, 63.4], land: 'ost', biome: 'tundra', free: true },
  // Kharsk
  { id: 'kharsk', name: 'Kharsk', realm: 'kha', at: [22.4, 55.2], land: 'ost', biome: 'boreal' },
  { id: 'dvaria', name: 'Dvaria', realm: 'kha', at: [17, 59], land: 'ost', biome: 'boreal' },
  { id: 'zarovy', name: 'Zarovy', realm: 'kha', at: [28, 59], land: 'ost', biome: 'boreal' },
  { id: 'volzha', name: 'Volzha', realm: 'kha', at: [29.5, 52.8], land: 'ost', biome: 'temp' },
  { id: 'lesnoy', name: 'Lesnoy', realm: 'kha', at: [23, 50.4], land: 'ost', biome: 'temp' },
  { id: 'kharskeast', name: 'The Eastern Marches', realm: 'kha', at: [33, 56], land: 'ost', biome: 'boreal' },
  { id: 'ostrog', name: 'Ostrog', realm: 'kha', at: [36.6, 50.6], land: 'ost', biome: 'temp' },
  { id: 'beloye', name: 'Beloye', realm: 'kha', at: [34, 61], land: 'ost', biome: 'boreal' },
  // Doros
  { id: 'dorovets', name: 'Dorovets', realm: 'dor', at: [15, 50.6], land: 'ost', biome: 'temp' },
  { id: 'kalvary', name: 'Kalvary', realm: 'dor', at: [18.8, 49.6], land: 'ost', biome: 'hill' },
  // Tessara
  { id: 'tessarion', name: 'Tessarion', realm: 'tes', at: [15.6, 40.6], land: 'ost', biome: 'high' },
  { id: 'crownmark', name: 'The Crownmark', realm: 'tes', at: [12.4, 43.6], land: 'ost', biome: 'mtn' },
  { id: 'aurelis', name: 'Aurelis', realm: 'tes', at: [24.4, 41.6], land: 'ost', biome: 'high' },
  { id: 'southtessara', name: 'Kyrene', realm: 'tes', at: [16.8, 35.6], land: 'ost', biome: 'high' },
  { id: 'ostia', name: 'Thalassene', realm: 'tes', at: [23.4, 36.6], land: 'ost', biome: 'high' },
  { id: 'eaglemark', name: 'Eaglemark', realm: 'tes', at: [20, 45.6], land: 'ost', biome: 'hill' },
  // Oskel
  { id: 'oskel', name: 'Oskel', realm: 'osk', at: [4.2, 38.6], land: 'ost', biome: 'med' },
  { id: 'oskelmarches', name: 'The Oskel Marches', realm: 'osk', at: [7.2, 42.8], land: 'ost', biome: 'hill' },
  { id: 'thalia', name: 'Thalia', realm: 'osk', at: [4, 33.6], land: 'ost', biome: 'med' },
  // Tarkhan
  { id: 'kurgal', name: 'Kurgal', realm: 'tar', at: [29.6, 41.2], land: 'ost', biome: 'steppe' },
  { id: 'northsteppe', name: 'The Upper Steppe', realm: 'tar', at: [32, 46.6], land: 'ost', biome: 'steppe' },
  { id: 'southsteppe', name: 'The Lower Steppe', realm: 'tar', at: [31, 35.4], land: 'ost', biome: 'dry' },
  { id: 'tarkhaneast', name: 'The Far Steppe', realm: 'tar', at: [35.4, 41.2], land: 'ost', biome: 'steppe' },
  // Amun
  { id: 'neferet', name: 'Neferet', realm: 'amu', at: [5.6, 28.8], land: 'ost', biome: 'river' },
  { id: 'upperamun', name: 'Upper Amun', realm: 'amu', at: [12.4, 28.2], land: 'ost', biome: 'river' },
  { id: 'sunwardcoast', name: 'The Sunward Coast', realm: 'amu', at: [7.6, 23.2], land: 'ost', biome: 'dry' },
  // Sahrun
  { id: 'sahrun', name: 'Sahrun', realm: 'sah', at: [20.6, 21.6], land: 'ost', biome: 'desert' },
  { id: 'bitterlake', name: 'The Bitter Shore', realm: 'sah', at: [27.4, 27.6], land: 'ost', biome: 'desert' },
  { id: 'sahrdunes', name: 'The Dunes of Sahr', realm: 'sah', at: [29, 20.4], land: 'ost', biome: 'desert' },
  { id: 'sahreast', name: 'The Salt Coast', realm: 'sah', at: [34.6, 22.4], land: 'ost', biome: 'desert' },
  { id: 'tarkhanshore', name: 'The Tarkhan Shore', realm: 'tar', at: [37, 30.4], land: 'ost', biome: 'dry' },
  // the Red Waste: unclaimed desert
  { id: 'redwaste', name: 'The Red Waste', realm: 'sah', at: [16.4, 31.2], land: 'ost', biome: 'desert', free: true },
  { id: 'redwasteeast', name: 'The Burnt Hills', realm: 'sah', at: [24.6, 31.4], land: 'ost', biome: 'desert', free: true },
  // the Sapphire Isles
  { id: 'sapphira', name: 'Sapphira', realm: 'sap', at: [-3.6, 17.6], land: 'sapphire', biome: 'med' },
  { id: 'eastsapphire', name: 'Coralline', realm: 'sap', at: [0.6, 16.8], land: 'sapphire', biome: 'med' },
  { id: 'calla', name: 'Calla', realm: 'sap', at: [6.5, 15.7], land: 'calla', biome: 'med', free: true },
  { id: 'orsa', name: 'Orsa', realm: 'sap', at: [-10.4, 14.8], land: 'orsa', biome: 'med', free: true },
  { id: 'pell', name: 'Pell', realm: 'sap', at: [12.1, 18.5], land: 'pell', biome: 'med', free: true },
];

export const REGIONS: RealRegion[] = REGION_LIST.map((r) => ({
  id: r.id,
  name: r.name,
  realm: r.realm,
  biome: BIOMES[r.biome],
  sparse: SPARSE[r.biome],
  ...(r.free ? { unclaimed: true } : {}),
  ...(r.realm === 'tes' && r.id !== 'tessarion' ? { integ: [40, 70] as [number, number] } : {}),
}));

/** Capitals and great cities (sketch grid; population in thousands). */
const CITIES: Array<[string, string, XY, number]> = [
  ['Aurum', 'var', [-22.6, 50.6], 1400], ['Skarholt', 'skh', [-22.2, 62.2], 180], ['Morvaine', 'mor', [-36.6, 46.4], 240], ['Thornhold', 'irn', [-29.8, 35.4], 90], ['Velde', 'vel', [-8.4, 51], 320], ['Ilsara', 'ils', [-14.4, 45.2], 160],
  ['Lorresse', 'lor', [-8.2, 33.4], 680], ['Asterra', 'ast', [-17, 35.6], 260], ['Qasreen', 'qas', [-18.8, 22.8], 210], ['Caer Corwen', 'cor', [-43.4, 52.6], 820], ['Haskholm', 'hsk', [-3.4, 46.8], 60],
  ['Lysanne', 'lys', [1.2, 49], 940], ['Halden', 'hal', [-2.2, 52.2], 210], ['Brennholt', 'bre', [10, 51.8], 380], ['Kharsk', 'kha', [22, 54.6], 760], ['Dorovets', 'dor', [15.4, 50.2], 190], ['Tessarion', 'tes', [16.4, 41], 870],
  ['Oskel', 'osk', [3.2, 38.2], 230], ['Kurgal', 'tar', [29.4, 41.6], 70], ['Neferet', 'amu', [4.4, 28.6], 520], ['Sahrun', 'sah', [20.4, 22], 90], ['Sapphira', 'sap', [-2.6, 18.4], 120],
  // great cities
  ['Vellport', 'var', [-15.8, 50.4], 420], ['Saunemouth', 'lor', [-7.4, 32.4], 300], ['Westhaven', 'var', [-30, 51.8], 260], ['Torsby', 'skh', [-15.6, 63.4], 90], ['Kaldheim', 'skh', [-29.6, 62.8], 70],
  ['Port Ardoch', 'mor', [-38.6, 52.8], 110], ['Calvaro', 'ast', [-23, 32], 130], ['Mirgrad', 'kha', [28.4, 52.2], 280], ['Zarovsk', 'kha', [27, 58.6], 150], ['Oosthaven', 'lys', [0.8, 56.4], 260],
  ['Kessholm', 'bre', [12.2, 56.6], 110], ['Pharos', 'tes', [23.6, 37.2], 260], ['Melene', 'tes', [24.4, 42.2], 180], ['Thessaly', 'osk', [3.4, 33.4], 140], ['Upper Neferet', 'amu', [12.2, 28.4], 160], ['Coralline', 'sap', [0.8, 16.4], 50],
  ['Saint Corrin', 'irn', [-28.8, 41.6], 60], ['Northport', 'cor', [-46.2, 57.2], 120],
];

// ───────────────────────────── the source ─────────────────────────────────

const ring = (pts: XY[], id: string, amp = 0.17) => {
  const r = rough(pts, true, 5, amp, `land:${id}`).map(P);
  r.push(r[0]);
  return r;
};
const LAND_RINGS = LANDS.map((l) => ({ id: l.id, ring: ring(l.pts, l.id, l.amp) }));
const feature = (properties: Record<string, unknown>, type: string, coordinates: unknown): Feature => ({ properties, geometry: { type, coordinates } });

/** Smooth value noise for wandering borders. */
function noise(seed: number) {
  const h = (i: number, j: number) => hashStr(`${seed}:${i}:${j}`) / 4294967296;
  return (x: number, y: number) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const s = (t: number) => t * t * (3 - 2 * t);
    const a = h(i, j) + (h(i + 1, j) - h(i, j)) * s(fx);
    const b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * s(fx);
    return a + (b - a) * s(fy);
  };
}

const RIDGE_SEGS: Array<[XY, XY]> = RIDGES.flatMap((r) => r.pts.slice(1).map((q, i) => [P(r.pts[i]), P(q)] as [XY, XY]));
/** Do segments ab and cd cross? */
function crosses(a: XY, b: XY, c: XY, d: XY): boolean {
  const o = (p: XY, q: XY, r: XY) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

function source(): MapSource {
  // which landmass a point is on: a coarse lookup grid, filled once
  const W = BOX.west - 1;
  const S = BOX.south - 1;
  const STEP = 0.1;
  const NX = Math.ceil((BOX.east + 1 - W) / STEP);
  const NY = Math.ceil((BOX.north + 1 - S) / STEP);
  const landAt = new Int8Array(NX * NY).fill(-1);
  LAND_RINGS.forEach((l, k) => {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [, y] of l.ring) (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
    for (let j = Math.max(0, Math.floor((y0 - S) / STEP)); j <= Math.min(NY - 1, Math.ceil((y1 - S) / STEP)); j++) {
      const y = S + (j + 0.5) * STEP;
      const xs: number[] = [];
      for (let a = 0, b = l.ring.length - 1; a < l.ring.length; b = a++) {
        const [xa, ya] = l.ring[a];
        const [xb, yb] = l.ring[b];
        if (ya > y !== yb > y) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
      }
      xs.sort((p, q) => p - q);
      for (let q = 0; q + 1 < xs.length; q += 2)
        for (let i = Math.max(0, Math.ceil((xs[q] - W) / STEP - 0.5)); i <= Math.min(NX - 1, Math.floor((xs[q + 1] - W) / STEP - 0.5)); i++) landAt[j * NX + i] = k;
    }
  });
  const anchors = REGION_LIST.map((r, k) => ({ k, land: LANDS.findIndex((l) => l.id === r.land), at: P(r.at) }));
  const nx = noise(11);
  const ny = noise(23);
  const divisionAt = (lon: number, lat: number): number => {
    const i = Math.floor((lon - W) / STEP);
    const j = Math.floor((lat - S) / STEP);
    const at = (ii: number, jj: number) => (ii >= 0 && jj >= 0 && ii < NX && jj < NY ? landAt[jj * NX + ii] : -1);
    let land = at(i, j);
    // a coastal cell just off the outline (the two rasters differ by a cell): the landmass next to it
    for (let r = 1; land < 0 && r <= 4; r++) for (let dj = -r; dj <= r && land < 0; dj++) for (let di = -r; di <= r && land < 0; di++) land = at(i + di, j + dj);
    const pool = land >= 0 ? anchors.filter((a) => a.land === land) : anchors;
    // warped coordinates: borders wander instead of running straight
    const wx = lon + (nx(lon / 2.2, lat / 2.2) - 0.5) * 1.6;
    const wy = lat + (ny(lon / 2.2, lat / 2.2) - 0.5) * 1.2;
    // the nearest anchors, then a ridge between the point and an anchor counts as distance:
    // regions end at the mountain walls instead of reaching over them
    const cos = Math.cos((lat * Math.PI) / 180);
    const near = pool
      .map((a) => ({ k: a.k, at: a.at, d: Math.hypot((wx - a.at[0]) * cos, wy - a.at[1]) }))
      .sort((p, q) => p.d - q.d || p.k - q.k)
      .slice(0, 4);
    let best = near[0]?.k ?? -1;
    let bd = Infinity;
    for (const a of near) {
      const d = a.d + (RIDGE_SEGS.some(([p, q]) => crosses([lon, lat], a.at, p, q)) ? 2.5 : 0);
      if (d < bd) (bd = d), (best = a.k);
    }
    return best;
  };

  // towns: the cities above, then towns drawn from each region's naming culture
  const book = new NameBook(1890);
  for (const [n] of CITIES) book.reserve(n);
  for (const r of REGION_LIST) book.reserve(r.name);
  const places: Feature[] = CITIES.map(([name, realm, at, k]) => {
    const [lon, lat] = P(at);
    return feature({ name, latitude: lat, longitude: lon, pop_max: k * 1000, adm0_a3: realm }, 'Point', [lon, lat]);
  });
  const rnd = mulberry(hashStr('hesperia:towns'));
  // sample land points by rejection and give each to its region's culture
  const perRegion = new Map<number, number>();
  for (let tries = 0; tries < 200000 && places.length < 2600; tries++) {
    const lon = BOX.west + rnd() * (BOX.east - BOX.west);
    const lat = BOX.south + rnd() * (BOX.north - BOX.south);
    const i = Math.floor((lon - W) / STEP);
    const j = Math.floor((lat - S) / STEP);
    if (i < 0 || j < 0 || i >= NX || j >= NY || landAt[j * NX + i] < 0) continue;
    const k = divisionAt(lon, lat);
    const reg = REGION_LIST[k];
    const have = perRegion.get(k) ?? 0;
    if (have >= 40) continue;
    perRegion.set(k, have + 1);
    const sparse = SPARSE[reg.biome];
    // towns are larger in the settled heartlands, smaller in the waste
    const pop = Math.round((8000 + 140000 * rnd() ** 3) / sparse);
    places.push(feature({ name: book.place(cultureById(CULTURE[reg.realm])), latitude: lat, longitude: lon, pop_max: pop, adm0_a3: reg.realm }, 'Point', [lon, lat]));
  }

  return {
    land: LAND_RINGS.map((l) => feature({ name: l.id }, 'Polygon', [l.ring])),
    lakes: LAKES.map((l) => {
      const r = rough(l.pts, true, 4, 0.12, `lake:${l.name}`).map(P);
      r.push(r[0]);
      return feature({ name: l.name }, 'Polygon', [r]);
    }),
    rivers: RIVERS.map((r) => feature({ name: r.name }, 'LineString', rough(r.pts, false, 4, 0.18, `river:${r.name}`).map(P))),
    places,
    divisions: REGION_LIST.map((r) => ({ adm0_a3: r.realm, name: r.id, region: '' })),
    divisionAt,
    credit: 'authored for this map (tools/hesperia.data.ts): outlines, lakes and rivers as control points, roughened by deterministic midpoint displacement; towns named from the realms’ cultures.',
  };
}

// ───────────────────────────── the definition ──────────────────────────────

/** The frame on the invented globe. */
export const BOX = { west: -36.6, east: 25.6, south: 23.4, north: 68.2 };

/** A plain cylindrical projection true at 46°: the frame is a rectangle. */
const PROJ: Projection = (() => {
  const R = 6371;
  const k = Math.cos((46 * Math.PI) / 180);
  const lon0 = -5.5;
  return {
    fwd: (lon, lat) => [((lon - lon0) * Math.PI * R * k) / 180, (lat * Math.PI * R) / 180],
    inv: (x, y) => [lon0 + (x * 180) / (Math.PI * R * k), (y * 180) / (Math.PI * R)],
  };
})();

export function hesperiaDef(): RealMapDef {
  const capitals: Record<string, [string, string]> = {};
  for (const n of NATIONS) capitals[n.id] = [CITIES.find(([, realm]) => realm === n.id)![0], n.id];
  return {
    id: 'hesperia',
    revision: 1,
    startYear: 1890,
    campaignYears: { options: [20, 30, 40], default: 30 },
    nations: NATIONS.map((n) => ({ ...n, capital: n.capital })),
    regions: REGIONS,
    capitals,
    classify: (d) => d.name,
    source: source(),
    proj: PROJ,
    box: BOX,
    inCrop: (lon, lat) => lat >= BOX.south && lat <= BOX.north && lon >= BOX.west && lon <= BOX.east,
    km: 0.8,
    provKm2: 12500,
    minIslandKm2: 1500,
    minLakeKm2: 900,
    regionalKm2: 60000,
    land: 'land50',
    lakes: Object.fromEntries(LAKES.map((l) => [l.name, l.name])),
    rivers: Object.fromEntries(RIVERS.map((r) => [r.name, r.name])),
    riverMinKm: 300,
    ridges: RIDGES.map((r) => ({ name: r.name, halfKm: r.halfKm, pts: r.pts.map(P) })),
    passes: PASSES.map((p) => {
      const [lon, lat] = P(p.at);
      return { name: p.name, lon, lat };
    }),
    islandNames: LANDS.filter((l) => l.id !== 'ost').map((l) => {
      const pts = l.pts.map(P);
      return [l.name, pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] as [string, number, number];
    }),
    seas: SEAS.map(([name, at, size]) => {
      const [lon, lat] = P(at);
      return [name, lon, lat, size] as [string, number, number, number?];
    }),
    names: {},
    notYet: [],
    straits: STRAITS.map((s) => ({ name: s.name, a: P(s.a), b: P(s.b) })),
    straitMaxKm: 150,
    cities: { max: 60, minPop: 100000, spacingKm: 180 },
    depositHints: [
      { kind: 'coal', ...lonlat([10.5, 50.5]), km: 220, weight: 6 },
      { kind: 'coal', ...lonlat([-21, 53]), km: 220, weight: 5 },
      { kind: 'coal', ...lonlat([-46, 55]), km: 160, weight: 4 },
      { kind: 'iron', ...lonlat([-31, 40]), km: 300, weight: 7 },
      { kind: 'iron', ...lonlat([12, 44]), km: 200, weight: 5 },
      { kind: 'oil', ...lonlat([26, 28]), km: 260, weight: 7 },
      { kind: 'oil', ...lonlat([31, 50]), km: 200, weight: 5 },
      { kind: 'nitrates', ...lonlat([21, 21]), km: 260, weight: 8 },
      { kind: 'rubber', ...lonlat([-2, 17]), km: 260, weight: 7 },
      { kind: 'rubber', ...lonlat([6.5, 15.5]), km: 160, weight: 5 },
    ],
    climate: 'temperate',
    meta: {
      name: 'Hesperia, 1890',
      description:
        'An invented world of two continents facing each other across the Narrows: the old Empire of Varr and its rival kingdoms in the west, the lowland workshops of Lys, the forests of Kharsk and the ancient Tessarine plateau in the east, an island kingdom in the ocean and planters’ isles in the south. Three frontiers start unclaimed: the frozen Hoarlands, the Red Waste and the outer Sapphire Isles.',
      blurb: 'A large original campaign: about 700 provinces and 22 realms on two continents, with crossings, frontiers and an island sea power.',
      size: 'large',
      difficulty: 'standard',
      style: 'Two continents across a narrow sea',
      mechanics: ['Authored geography', 'Straits between continents', 'Unclaimed frontier', 'Mountain passes', 'River crossings'],
      origin: 'builtin',
      attribution: ['Geography, realms and names authored for Crown & Frontier (tools/hesperia.data.ts); the towns’ names are drawn from the game’s naming cultures.'],
    },
  };
}

function lonlat(at: XY): { lon: number; lat: number } {
  const [lon, lat] = P(at);
  return { lon, lat };
}
