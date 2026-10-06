// The built-in maps expressed as map packages. Their gameplay data ships with
// the game (the simulation needs it at once); their drawn geometry is a
// separate chunk loaded when the map is shown. Both halves are assembled into
// ordinary packages, so built-in maps use the same format, validator and
// conversion as generated and custom maps.

import aldmereProvinces from '../data/aldmere.provinces.json';
import { ALDMERE_LABELS, ALDMERE_NATIONS, ALDMERE_REGIONS } from '../data/aldmere';
import reachAdjacency from '../data/reach.adjacency.json';
import aldmereSeas from '../data/aldmere.seas.json';
import { REACH_LABELS, REACH_NATIONS, REACH_PROVINCES, REACH_REGIONS, STRAITS } from '../data/reach';
import reachSeas from '../data/reach.seas.json';
import islesScenario from '../data/maps/isles.scenario.json';
import steppeScenario from '../data/maps/steppe.scenario.json';
import midseaScenario from '../data/maps/midsea.scenario.json';
import balticScenario from '../data/maps/baltic.scenario.json';
import europeScenario from '../data/maps/europe.scenario.json';
import type { ProvinceDef, SeaZoneDef } from '../sim/types';
import { MAP_FORMAT, MAP_FORMAT_VERSION, type MapGeometryData, type MapPackage, type MapScenarioPart, type SeaGeometry } from './format';

/** Sea zones and starting ports, generated from each map's coastline by `npm run genseas`. */
type SeaData = { zones: SeaZoneDef[]; ports: Record<string, number> };
const withPorts = (provinces: ProvinceDef[], seas: SeaData): ProvinceDef[] => provinces.map((p) => (seas.ports[p.id] ? { ...p, port: seas.ports[p.id] } : p));

export const BUILTIN_MAPS = ['aldmere', 'reach', 'isles', 'steppe', 'midsea', 'baltic', 'europe'] as const;
export type BuiltinMapId = (typeof BUILTIN_MAPS)[number];

/**
 * Built-in maps shipped as generated: the procedural maps (tools/genmaps.ts),
 * the real-world Baltic (tools/genbaltic.ts) and the real-world maps built by
 * tools/genreal.ts, all from Natural Earth.
 */
const GENERATED: Record<string, unknown> = { isles: islesScenario, steppe: steppeScenario, midsea: midseaScenario, baltic: balticScenario, europe: europeScenario };

function generatedScenario(id: string): MapScenarioPart {
  // the checked-in file carries a "generated" note that is not part of the package
  const { generated: _note, ...part } = GENERATED[id] as MapScenarioPart & { generated?: string };
  void _note;
  return part as MapScenarioPart;
}

function aldmereScenario(): MapScenarioPart {
  const data = aldmereProvinces as unknown as { provinces: ProvinceDef[]; straits: Array<[string, string]>; rivers: Array<[string, string]> };
  return {
    format: MAP_FORMAT,
    version: MAP_FORMAT_VERSION,
    id: 'aldmere',
    // 2: the industrial age (deposits, factories, start year 1880); 3: sea zones and ports
    revision: 3,
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
      startYear: 1880,
      campaignYears: { options: [40, 60, 70], default: 60 },
      // fourteen realms share the land: dominance is a smaller share than on the Reach
      // (thresholds scaled from the Reach's multiple of an average realm; see DESIGN.md)
      victory: { territorialRegions: 6, territorialShare: 0.18, economicShare: 0.18, diplomaticInfluencePerRealm: 0.85 },
      // larger realms research faster; the tree should last a 60-year campaign
      researchCostMul: 1.35,
    },
    regions: ALDMERE_REGIONS,
    nations: ALDMERE_NATIONS,
    provinces: withPorts(data.provinces, aldmereSeas as SeaData),
    straits: data.straits,
    rivers: data.rivers,
    seaZones: (aldmereSeas as SeaData).zones,
  };
}

function reachScenario(): MapScenarioPart {
  const neighbors = (reachAdjacency as { neighbors: Record<string, string[]> }).neighbors;
  return {
    format: MAP_FORMAT,
    version: MAP_FORMAT_VERSION,
    id: 'reach',
    // 2: the industrial age (deposits, factories, start year 1895); 3: sea zones and ports
    revision: 3,
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
    rules: { startYear: 1895, campaignYears: { options: [25, 40, 60], default: 40 } },
    regions: REACH_REGIONS,
    nations: REACH_NATIONS,
    provinces: withPorts(
      REACH_PROVINCES.map((p) => ({ ...p, neighbors: [...(neighbors[p.id] ?? [])] })),
      reachSeas as SeaData,
    ),
    straits: STRAITS,
    rivers: [],
    seaZones: (reachSeas as SeaData).zones,
  };
}

const scenarioCache = new Map<string, MapScenarioPart>();

/** The gameplay half of a built-in map (synchronous; ships with the game). */
export function builtinScenario(id: BuiltinMapId): MapScenarioPart {
  let s = scenarioCache.get(id);
  if (!s) {
    s = id === 'aldmere' ? aldmereScenario() : id === 'reach' ? reachScenario() : generatedScenario(id);
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
  if (id === 'isles') return (await import('../data/maps/isles.map.json')).default as unknown as MapGeometryData;
  if (id === 'steppe') return (await import('../data/maps/steppe.map.json')).default as unknown as MapGeometryData;
  if (id === 'midsea') return (await import('../data/maps/midsea.map.json')).default as unknown as MapGeometryData;
  if (id === 'baltic') return (await import('../data/maps/baltic.map.json')).default as unknown as MapGeometryData;
  if (id === 'europe') return (await import('../data/maps/europe.map.json')).default as unknown as MapGeometryData;
  if (id === 'aldmere') {
    const [{ default: g }, { default: seas }] = await Promise.all([import('../data/aldmere.map.json'), import('../data/aldmere.seamap.json')]);
    return toGeometry(g as unknown as RawGeometry, ALDMERE_LABELS, seas as unknown as SeaGeometry | null);
  }
  const [{ default: g }, { default: seas }] = await Promise.all([import('../data/reach.map.json'), import('../data/reach.seamap.json')]);
  return toGeometry(g as unknown as RawGeometry, REACH_LABELS, seas as unknown as SeaGeometry | null);
}

function toGeometry(raw: RawGeometry, labels: MapGeometryData['labels'], seas: SeaGeometry | null): MapGeometryData {
  const centers: MapGeometryData['centers'] = {};
  for (const [id, p] of Object.entries(raw.provinces)) centers[id] = { cx: p.cx, cy: p.cy, area: p.area };
  return { bounds: raw.bounds, centers, edges: raw.edges, waste: raw.waste, labels, ...(seas ? { seas } : {}) };
}

/** A whole built-in map as a package (for validation, export and tools). */
export async function builtinPackage(id: BuiltinMapId): Promise<MapPackage> {
  return { ...builtinScenario(id), geometry: await builtinGeometry(id) };
}
