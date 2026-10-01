// The built-in maps expressed as map packages. Their gameplay data ships with
// the game (the simulation needs it at once); their drawn geometry is a
// separate chunk loaded when the map is shown. Both halves are assembled into
// ordinary packages, so built-in maps use the same format, validator and
// conversion as generated and custom maps.

import aldmereProvinces from '../data/aldmere.provinces.json';
import { ALDMERE_LABELS, ALDMERE_NATIONS, ALDMERE_REGIONS } from '../data/aldmere';
import reachAdjacency from '../data/reach.adjacency.json';
import { REACH_LABELS, REACH_NATIONS, REACH_PROVINCES, REACH_REGIONS, STRAITS } from '../data/reach';
import type { ProvinceDef } from '../sim/types';
import { MAP_FORMAT, MAP_FORMAT_VERSION, type MapGeometryData, type MapPackage, type MapScenarioPart } from './format';

export const BUILTIN_MAPS = ['aldmere', 'reach'] as const;
export type BuiltinMapId = (typeof BUILTIN_MAPS)[number];

function aldmereScenario(): MapScenarioPart {
  const data = aldmereProvinces as unknown as { provinces: ProvinceDef[]; straits: Array<[string, string]>; rivers: Array<[string, string]> };
  return {
    format: MAP_FORMAT,
    version: MAP_FORMAT_VERSION,
    id: 'aldmere',
    revision: 1,
    meta: {
      name: 'Aldmere',
      description: 'Fourteen realms across a continent of passes, rivers and open frontier.',
      blurb: 'The standard campaign: about 300 provinces, several fronts for every realm, and long marches.',
      size: 'standard',
      difficulty: 'standard',
      style: 'Continental war on several fronts',
      mechanics: ['Mountain passes', 'River crossings', 'Straits and islands', 'Unclaimed frontier'],
      origin: 'builtin',
    },
    rules: {
      startYear: 1640,
      campaignYears: { options: [40, 60, 80], default: 60 },
      // fourteen realms share the land: dominance is a smaller share than on the Reach
      // (thresholds scaled from the Reach's multiple of an average realm; see DESIGN.md)
      victory: { territorialRegions: 6, territorialShare: 0.18, economicShare: 0.18, diplomaticInfluencePerRealm: 0.85 },
      // larger realms research faster; the tree should last a 60-year campaign
      researchCostMul: 1.35,
    },
    regions: ALDMERE_REGIONS,
    nations: ALDMERE_NATIONS,
    provinces: data.provinces,
    straits: data.straits,
    rivers: data.rivers,
  };
}

function reachScenario(): MapScenarioPart {
  const neighbors = (reachAdjacency as { neighbors: Record<string, string[]> }).neighbors;
  return {
    format: MAP_FORMAT,
    version: MAP_FORMAT_VERSION,
    id: 'reach',
    revision: 1,
    meta: {
      name: 'The Reach',
      description: 'Nine crowns and an unsettled frontier divided by the Greyspine mountains.',
      blurb: 'The quick campaign: 99 provinces and nine realms, wars decided in a few seasons.',
      size: 'small',
      difficulty: 'gentle',
      style: 'Quick campaign around one mountain spine',
      mechanics: ['Mountain passes', 'Straits and islands', 'Unclaimed frontier'],
      origin: 'builtin',
    },
    rules: { startYear: 1640, campaignYears: { options: [25, 40, 60], default: 40 } },
    regions: REACH_REGIONS,
    nations: REACH_NATIONS,
    provinces: REACH_PROVINCES.map((p) => ({ ...p, neighbors: [...(neighbors[p.id] ?? [])] })),
    straits: STRAITS,
    rivers: [],
  };
}

const scenarioCache = new Map<string, MapScenarioPart>();

/** The gameplay half of a built-in map (synchronous; ships with the game). */
export function builtinScenario(id: BuiltinMapId): MapScenarioPart {
  let s = scenarioCache.get(id);
  if (!s) {
    s = id === 'aldmere' ? aldmereScenario() : reachScenario();
    scenarioCache.set(id, s);
  }
  return s;
}

type RawGeometry = {
  bounds: MapGeometryData['bounds'];
  provinces: Record<string, { cx: number; cy: number; area: number }>;
  edges: MapGeometryData['edges'];
  waste: MapGeometryData['waste'];
};

/** The drawn half of a built-in map (a separate download). */
export async function builtinGeometry(id: BuiltinMapId): Promise<MapGeometryData> {
  if (id === 'aldmere') {
    const { default: g } = await import('../data/aldmere.map.json');
    return toGeometry(g as unknown as RawGeometry, ALDMERE_LABELS);
  }
  const { default: g } = await import('../data/reach.map.json');
  return toGeometry(g as unknown as RawGeometry, REACH_LABELS);
}

function toGeometry(raw: RawGeometry, labels: MapGeometryData['labels']): MapGeometryData {
  const centers: MapGeometryData['centers'] = {};
  for (const [id, p] of Object.entries(raw.provinces)) centers[id] = { cx: p.cx, cy: p.cy, area: p.area };
  return { bounds: raw.bounds, centers, edges: raw.edges, waste: raw.waste, labels };
}

/** A whole built-in map as a package (for validation, export and tools). */
export async function builtinPackage(id: BuiltinMapId): Promise<MapPackage> {
  return { ...builtinScenario(id), geometry: await builtinGeometry(id) };
}
