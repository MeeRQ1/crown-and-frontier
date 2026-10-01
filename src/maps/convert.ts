// Conversion from a map package to what the game runs on: the simulation's
// ScenarioDef and the renderer's drawable map. Built-in, generated and custom
// maps all go through these two functions.

import type { ScenarioDef } from '../sim/types';
import type { DrawnMap, MapPackage, MapScenarioPart } from './format';
import { ringFromEdges } from './rings';

export function scenarioFromPackage(pkg: MapScenarioPart): ScenarioDef {
  return {
    id: pkg.id,
    name: `${pkg.meta.name}, ${pkg.rules.startYear}`,
    description: pkg.meta.description,
    blurb: pkg.meta.blurb,
    startYear: pkg.rules.startYear,
    victory: pkg.rules.victory,
    researchCostMul: pkg.rules.researchCostMul,
    nations: pkg.nations.map((n) => ({ ...n, traits: { ...n.traits }, arms: n.arms ? { ...n.arms } : undefined })),
    regions: pkg.regions.map((r) => ({ ...r })),
    straits: pkg.straits.map(([a, b]) => [a, b] as [string, string]),
    rivers: pkg.rivers.map(([a, b]) => [a, b] as [string, string]),
    provinces: pkg.provinces.map((p) => ({ ...p, claims: [...p.claims], neighbors: [...p.neighbors] })),
  };
}

export function drawnFromPackage(pkg: Pick<MapPackage, 'id' | 'straits' | 'geometry'>): DrawnMap {
  const g = pkg.geometry;
  const byProv = new Map<string, MapPackage['geometry']['edges']>();
  for (const e of g.edges) {
    for (const s of [e.a, e.b]) if (!s.startsWith('~')) (byProv.get(s) ?? byProv.set(s, []).get(s)!).push(e);
  }
  const provinces: DrawnMap['provinces'] = {};
  for (const [id, c] of Object.entries(g.centers)) provinces[id] = { poly: ringFromEdges(id, byProv.get(id) ?? []), cx: c.cx, cy: c.cy, area: c.area };
  return { id: pkg.id, bounds: { ...g.bounds }, provinces, edges: g.edges, waste: g.waste, straits: pkg.straits, labels: g.labels };
}
