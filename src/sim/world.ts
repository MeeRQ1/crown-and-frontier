// Static world construction and scenario registry.

import { builtinScenario } from '../maps/builtin';
import { scenarioFromPackage } from '../maps/convert';
import type { MapScenarioPart } from '../maps/format';
import type { ProvinceId, ScenarioDef, World } from './types';

const registry = new Map<string, () => ScenarioDef>();
const worldCache = new Map<string, World>();
/** gameplay halves of registered map packages, by scenario id */
const packages = new Map<string, MapScenarioPart>();

export function registerScenario(id: string, build: () => ScenarioDef): void {
  registry.set(id, build);
  worldCache.delete(id);
}

/** Registers a (validated) map package as a playable scenario. */
export function registerMapScenario(pkg: MapScenarioPart): void {
  packages.set(pkg.id, pkg);
  registerScenario(pkg.id, () => scenarioFromPackage(pkg));
}

/** The map package behind a scenario, if it was registered from one. */
export function mapScenarioPart(id: string): MapScenarioPart | undefined {
  return packages.get(id);
}

export function scenarioIds(): string[] {
  return [...registry.keys()];
}

/** The standard campaign. */
export const DEFAULT_SCENARIO = 'aldmere';

export function buildAldmereScenario(): ScenarioDef {
  return scenarioFromPackage(builtinScenario('aldmere'));
}

export function buildReachScenario(): ScenarioDef {
  return scenarioFromPackage(builtinScenario('reach'));
}

registerMapScenario(builtinScenario('aldmere'));
registerMapScenario(builtinScenario('reach'));

export function edgeKey(a: ProvinceId, b: ProvinceId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildWorld(s: ScenarioDef): World {
  const prov: World['prov'] = {};
  for (const p of s.provinces) prov[p.id] = p;
  const provIds = s.provinces.map((p) => p.id);
  const nationDefs: World['nationDefs'] = {};
  for (const n of s.nations) nationDefs[n.id] = n;
  const regionProvinces: Record<string, ProvinceId[]> = {};
  for (const r of s.regions) regionProvinces[r.id] = [];
  for (const p of s.provinces) (regionProvinces[p.region] ??= []).push(p.id);
  const straitSet = new Set(s.straits.map(([a, b]) => edgeKey(a, b)));
  const riverSet = new Set((s.rivers ?? []).map(([a, b]) => edgeKey(a, b)));
  const hops: World['hops'] = {};
  for (const src of provIds) {
    const d: Record<ProvinceId, number> = { [src]: 0 };
    const q = [src];
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      for (const n of prov[c].neighbors) {
        if (d[n] === undefined) {
          d[n] = d[c] + 1;
          q.push(n);
        }
      }
    }
    hops[src] = d;
  }
  return { scenario: s, prov, provIds, nationDefs, nationIds: s.nations.map((n) => n.id), regionProvinces, straitSet, riverSet, hops };
}

export function getWorld(scenarioId: string): World {
  let w = worldCache.get(scenarioId);
  if (!w) {
    const build = registry.get(scenarioId);
    if (!build) throw new Error(`Unknown scenario "${scenarioId}"`);
    w = buildWorld(build());
    worldCache.set(scenarioId, w);
  }
  return w;
}

/** Validates scenario references; returns a list of problems (empty = valid). */
export function validateScenario(s: ScenarioDef): string[] {
  const errs: string[] = [];
  const ids = new Set(s.provinces.map((p) => p.id));
  const nations = new Set(s.nations.map((n) => n.id));
  const regions = new Set(s.regions.map((r) => r.id));
  if (ids.size !== s.provinces.length) errs.push('duplicate province ids');
  for (const p of s.provinces) {
    if (p.owner && !nations.has(p.owner)) errs.push(`${p.id}: unknown owner ${p.owner}`);
    if (!regions.has(p.region)) errs.push(`${p.id}: unknown region ${p.region}`);
    for (const n of p.neighbors) {
      if (!ids.has(n)) errs.push(`${p.id}: unknown neighbour ${n}`);
      else if (!s.provinces.find((q) => q.id === n)!.neighbors.includes(p.id)) errs.push(`${p.id}-${n}: adjacency not symmetric`);
    }
    for (const c of p.claims) if (!nations.has(c)) errs.push(`${p.id}: unknown claimant ${c}`);
    for (const [a, b] of s.rivers ?? []) if (a === p.id && !p.neighbors.includes(b)) errs.push(`river ${a}-${b} is not a border`);
    if (p.dev < 1) errs.push(`${p.id}: dev < 1`);
  }
  for (const n of s.nations) {
    const cap = s.provinces.find((p) => p.id === n.capital);
    if (!cap) errs.push(`${n.id}: missing capital ${n.capital}`);
    else if (cap.owner !== n.id) errs.push(`${n.id}: capital not owned`);
  }
  return errs;
}
