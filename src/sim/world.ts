// Static world construction and scenario registry.

import { BUILTIN_MAPS, builtinScenario } from '../maps/builtin';
import { scenarioFromPackage } from '../maps/convert';
import { mapChecksum, type MapPackage, type MapScenarioPart } from '../maps/format';
import type { MapFingerprint, ProvinceId, ScenarioDef, World } from './types';

const registry = new Map<string, () => ScenarioDef>();
const worldCache = new Map<string, World>();
/** gameplay halves of registered map packages, by scenario id */
const packages = new Map<string, MapScenarioPart>();
/**
 * Whole packages (with geometry) of maps that do not ship with the game, by
 * checksum: a campaign always saves the exact map it runs on, even if another
 * map with the same id is imported later in the session.
 */
const customPackages = new Map<string, MapPackage>();
const fingerprints = new Map<string, MapFingerprint>();

export function registerScenario(id: string, build: () => ScenarioDef): void {
  registry.set(id, build);
  worldCache.delete(id);
  fingerprints.delete(id);
  packages.delete(id);
}

/** Forgets a scenario (an imported map that is no longer needed; tests). */
export function unregisterScenario(id: string): void {
  registerScenario(id, () => {
    throw new Error(`Unknown scenario "${id}"`);
  });
  registry.delete(id);
}

/**
 * Registers a (validated) map package as a playable scenario. A whole package
 * of a map that does not ship with the game is kept, so saves can embed it.
 */
export function registerMapScenario(pkg: MapScenarioPart | MapPackage): void {
  registerScenario(pkg.id, () => scenarioFromPackage(pkg));
  packages.set(pkg.id, pkg);
  if ('geometry' in pkg && !isBuiltinMap(pkg.id)) customPackages.set(mapFingerprint(pkg.id).checksum, pkg);
}

/** The map package behind a scenario, if it was registered from one. */
export function mapScenarioPart(id: string): MapScenarioPart | undefined {
  return packages.get(id);
}

/** Whether a map id belongs to a map that ships with the game. */
export function isBuiltinMap(id: string): boolean {
  return (BUILTIN_MAPS as readonly string[]).includes(id);
}

/** The whole package of a map that does not ship with the game, if it was registered. */
export function customMapPackage(fp: MapFingerprint): MapPackage | undefined {
  return isBuiltinMap(fp.id) ? undefined : customPackages.get(fp.checksum);
}

/**
 * The fingerprint saves record for a scenario. Scenarios registered without a
 * package (test fixtures) have no revision and a fixed checksum.
 */
export function mapFingerprint(id: string): MapFingerprint {
  let fp = fingerprints.get(id);
  if (!fp) {
    const part = packages.get(id);
    fp = part ? { id, revision: part.revision, checksum: mapChecksum(part) } : { id, revision: 0, checksum: 'unversioned' };
    fingerprints.set(id, fp);
  }
  return fp;
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

for (const id of BUILTIN_MAPS) registerMapScenario(builtinScenario(id));

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
  const straitEnds = new Set(s.straits.flat());
  const riverSet = new Set((s.rivers ?? []).map(([a, b]) => edgeKey(a, b)));
  // all-pairs hop distances: one breadth-first search per province into a flat matrix
  const n = provIds.length;
  const index = new Map(provIds.map((id, i) => [id, i]));
  const adj = provIds.map((id) => prov[id].neighbors.map((nb) => index.get(nb)).filter((x): x is number => x !== undefined));
  const UNREACHED = 0xffff;
  const matrix = new Uint16Array(n * n).fill(UNREACHED);
  const queue = new Int32Array(n);
  for (let src = 0; src < n; src++) {
    const row = src * n;
    matrix[row + src] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = src;
    while (head < tail) {
      const c = queue[head++];
      const dc = matrix[row + c];
      for (const nb of adj[c]) {
        if (matrix[row + nb] === UNREACHED) {
          matrix[row + nb] = dc + 1;
          queue[tail++] = nb;
        }
      }
    }
  }
  const hop = (a: ProvinceId, b: ProvinceId): number | undefined => {
    const i = index.get(a);
    const j = index.get(b);
    if (i === undefined || j === undefined) return undefined;
    const v = matrix[i * n + j];
    return v === UNREACHED ? undefined : v;
  };
  const hopRow = (a: ProvinceId): Uint16Array | undefined => {
    const i = index.get(a);
    return i === undefined ? undefined : matrix.subarray(i * n, (i + 1) * n);
  };
  // sea zones: coasts by province, strait control, and zone-to-zone hops
  const zones: World['zones'] = {};
  const zoneIds = (s.seaZones ?? []).map((z) => z.id);
  for (const z of s.seaZones ?? []) zones[z.id] = z;
  const provZones: World['provZones'] = {};
  for (const z of s.seaZones ?? []) for (const p of z.coasts) (provZones[p] ??= []).push(z.id);
  for (const list of Object.values(provZones)) list.sort();
  const straitZone = new Map<string, string>();
  for (const z of s.seaZones ?? []) for (const [a, b] of z.straits ?? []) straitZone.set(edgeKey(a, b), z.id);
  const zIndex = new Map(zoneIds.map((id, i) => [id, i]));
  const zn = zoneIds.length;
  const zMatrix = new Uint16Array(zn * zn).fill(UNREACHED);
  for (let src = 0; src < zn; src++) {
    const row = src * zn;
    zMatrix[row + src] = 0;
    const q = [src];
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      for (const nb of zones[zoneIds[c]].neighbors) {
        const j = zIndex.get(nb);
        if (j === undefined || zMatrix[row + j] !== UNREACHED) continue;
        zMatrix[row + j] = zMatrix[row + c] + 1;
        q.push(j);
      }
    }
  }
  const zoneHop = (a: string, b: string): number | undefined => {
    const i = zIndex.get(a);
    const j = zIndex.get(b);
    if (i === undefined || j === undefined) return undefined;
    const v = zMatrix[i * zn + j];
    return v === UNREACHED ? undefined : v;
  };
  return { scenario: s, prov, provIds, nationDefs, nationIds: s.nations.map((n) => n.id), regionProvinces, straitSet, straitEnds, riverSet, hop, hopRow, provIndex: index, zones, zoneIds, provZones, straitZone, zoneHop };
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
