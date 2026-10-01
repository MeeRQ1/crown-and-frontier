// Reading and validating map packages.
//
// normalizeMapPackage() rebuilds a package from untrusted JSON into fresh
// objects that hold only known fields of the right types, so nothing from an
// imported file is ever interpreted as code or merged into existing objects.
// validateMapPackage() then checks everything a campaign depends on and returns
// actionable problems: errors make the map unplayable, warnings are shown but
// allowed. parseMapPackage() does both, with size limits, for imported text.

import { TERRAIN } from '../sim/config';
import type { NationDef, NationTraits, ProvinceDef, RegionDef, Resource, Terrain } from '../sim/types';
import { MAP_FORMAT, MAP_FORMAT_VERSION, NON_PROVINCE_SIDES, type MapEdge, type MapLabelDef, type MapPackage } from './format';
import { degenerate, loopsFromEdges } from './rings';
import { CHARGE_NAMES, ORDINARY_NAMES, PERSONALITY_IDS, RESOURCES, TERRAINS, TINCTURE_NAMES, TRAIT_BOUNDS } from './vocab';

export interface MapIssue {
  code: string;
  message: string;
  /** the province, realm or region the problem is about */
  ref?: string;
}

export interface MapCheck {
  ok: boolean;
  errors: MapIssue[];
  warnings: MapIssue[];
}

/** Limits for imported maps (built-in maps are well inside them). */
export const MAP_LIMITS = {
  bytes: 8 * 1024 * 1024,
  provinces: 1500,
  nations: 32,
  regions: 300,
  edges: 30000,
  points: 600000,
  labels: 400,
  waste: 4000,
  nameLength: 60,
  textLength: 600,
  coordinate: 100000,
};

const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const MAP_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

class Reader {
  errors: MapIssue[] = [];
  err(code: string, message: string, ref?: string): void {
    if (this.errors.length < 200) this.errors.push({ code, message, ref });
  }
  str(v: unknown, what: string, max: number, ref?: string): string {
    if (typeof v !== 'string') {
      this.err('type', `${what} must be text.`, ref);
      return '';
    }
    if (v.length > max) this.err('length', `${what} is longer than ${max} characters.`, ref);
    return v.slice(0, max);
  }
  optStr(v: unknown, what: string, max: number, ref?: string): string | undefined {
    return v === undefined ? undefined : this.str(v, what, max, ref);
  }
  num(v: unknown, what: string, min: number, max: number, ref?: string): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.err('type', `${what} must be a number.`, ref);
      return min;
    }
    if (v < min || v > max) this.err('range', `${what} is ${v}; it must be between ${min} and ${max}.`, ref);
    return Math.min(max, Math.max(min, v));
  }
  int(v: unknown, what: string, min: number, max: number, ref?: string): number {
    const n = this.num(v, what, min, max, ref);
    if (!Number.isInteger(n)) this.err('type', `${what} must be a whole number.`, ref);
    return Math.round(n);
  }
  arr(v: unknown, what: string, max: number): unknown[] {
    if (!Array.isArray(v)) {
      this.err('type', `${what} must be a list.`);
      return [];
    }
    if (v.length > max) {
      this.err('limit', `${what} has ${v.length} entries; at most ${max} are allowed.`);
      return v.slice(0, max);
    }
    return v;
  }
  obj(v: unknown, what: string, ref?: string): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      this.err('type', `${what} must be an object.`, ref);
      return {};
    }
    return v as Record<string, unknown>;
  }
  oneOf<T extends string>(v: unknown, list: readonly T[], what: string, ref?: string): T {
    if (typeof v === 'string' && (list as readonly string[]).includes(v)) return v as T;
    this.err('value', `${what} "${String(v)}" is not one of: ${list.join(', ')}.`, ref);
    return list[0];
  }
  id(v: unknown, what: string, ref?: string): string {
    const s = this.str(v, what, 40, ref);
    if (s && !ID.test(s)) this.err('id', `${what} "${s}" must use lower-case letters, digits, "-" or "_" (up to 40).`, ref);
    return s;
  }
  points(v: unknown, what: string, ref?: string): number[] {
    const a = this.arr(v, what, MAP_LIMITS.points);
    const out: number[] = [];
    for (const x of a) {
      if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > MAP_LIMITS.coordinate) {
        this.err('geometry', `${what} contains an invalid coordinate.`, ref);
        return [];
      }
      out.push(x);
    }
    if (out.length % 2) this.err('geometry', `${what} has an odd number of coordinates.`, ref);
    return out;
  }
  pair(v: unknown, what: string): [string, string] | null {
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'string' || typeof v[1] !== 'string') {
      this.err('type', `${what} must be a pair of province ids.`);
      return null;
    }
    return [v[0], v[1]];
  }
}

function readTraits(r: Reader, v: unknown, ref: string): NationTraits {
  const o = r.obj(v ?? {}, 'Realm traits', ref);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) {
    const b = TRAIT_BOUNDS[k];
    if (!b) {
      r.err('value', `Unknown realm trait "${k}".`, ref);
      continue;
    }
    out[k] = r.num(val, `Trait ${k}`, b[0], b[1], ref);
  }
  return out as NationTraits;
}

/** Rebuilds a package from untrusted data with only known, well-typed fields. */
export function normalizeMapPackage(raw: unknown): { pkg: MapPackage; errors: MapIssue[] } {
  const r = new Reader();
  const o = r.obj(raw, 'The map file');
  if (o.format !== MAP_FORMAT) r.err('format', 'This is not a Crown & Frontier map package (missing "format": "crown-frontier-map").');
  const version = typeof o.version === 'number' ? o.version : -1;
  if (version > MAP_FORMAT_VERSION) r.err('version', `The map was made for a newer map format (${version}); this build reads format ${MAP_FORMAT_VERSION}. Update the game to load it.`);
  else if (version < 1) r.err('version', 'The map has no valid format version.');
  const id = r.str(o.id, 'Map id', 40);
  if (id && !MAP_ID.test(id)) r.err('id', `Map id "${id}" must be 2–40 lower-case letters, digits or dashes.`);
  const meta = r.obj(o.meta, 'Map description (meta)');
  const rules = r.obj(o.rules, 'Map rules');
  const cy = r.obj(rules.campaignYears, 'Campaign lengths');
  const pkg: MapPackage = {
    format: MAP_FORMAT,
    version: MAP_FORMAT_VERSION,
    id,
    revision: r.int(o.revision ?? 1, 'Map revision', 1, 1e6),
    meta: {
      name: r.str(meta.name, 'Map name', MAP_LIMITS.nameLength),
      description: r.str(meta.description ?? '', 'Map description', MAP_LIMITS.textLength),
      blurb: r.optStr(meta.blurb, 'Map blurb', 160),
      size: r.oneOf(meta.size ?? 'standard', ['small', 'standard', 'large', 'huge'] as const, 'Map size'),
      difficulty: r.oneOf(meta.difficulty ?? 'standard', ['gentle', 'standard', 'hard'] as const, 'Map difficulty'),
      style: r.str(meta.style ?? '', 'Campaign style', 120),
      mechanics: r.arr(meta.mechanics ?? [], 'Special mechanics', 12).map((m) => r.str(m, 'Mechanic', 60)),
      author: r.optStr(meta.author, 'Author', 60),
      origin: r.oneOf(meta.origin ?? 'custom', ['builtin', 'generated', 'custom'] as const, 'Map origin'),
      attribution: meta.attribution === undefined ? undefined : r.arr(meta.attribution, 'Attribution', 20).map((a) => r.str(a, 'Attribution line', 300)),
    },
    rules: {
      startYear: r.int(rules.startYear, 'Start year', 1, 9999),
      campaignYears: {
        options: r.arr(cy.options, 'Campaign lengths', 6).map((y) => r.int(y, 'Campaign length', 5, 200)),
        default: r.int(cy.default, 'Default campaign length', 5, 200),
      },
      researchCostMul: rules.researchCostMul === undefined ? undefined : r.num(rules.researchCostMul, 'Research cost multiplier', 0.25, 4),
      minBorder: rules.minBorder === undefined ? undefined : r.num(rules.minBorder, 'Minimum border length', 0, 200),
    },
    regions: [],
    nations: [],
    provinces: [],
    straits: [],
    rivers: [],
    geometry: { bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, centers: {}, edges: [], waste: [] },
  };
  if (rules.victory !== undefined) {
    const v = r.obj(rules.victory, 'Victory settings');
    const vic: NonNullable<MapPackage['rules']['victory']> = {};
    if (v.territorialRegions !== undefined) vic.territorialRegions = r.int(v.territorialRegions, 'Regions for territorial victory', 1, 100);
    if (v.territorialShare !== undefined) vic.territorialShare = r.num(v.territorialShare, 'Share of provinces for territorial victory', 0.05, 1);
    if (v.economicShare !== undefined) vic.economicShare = r.num(v.economicShare, 'Share of development for economic victory', 0.05, 1);
    if (v.diplomaticInfluencePerRealm !== undefined) vic.diplomaticInfluencePerRealm = r.num(v.diplomaticInfluencePerRealm, 'Diplomatic influence per realm', 0.1, 5);
    if (v.diplomaticMinInfluence !== undefined) vic.diplomaticMinInfluence = r.int(v.diplomaticMinInfluence, 'Minimum diplomatic influence', 1, 100);
    pkg.rules.victory = vic;
  }
  for (const x of r.arr(o.regions, 'Regions', MAP_LIMITS.regions)) {
    const ro = r.obj(x, 'Region');
    const rid = r.id(ro.id, 'Region id');
    pkg.regions.push({ id: rid, name: r.str(ro.name, 'Region name', MAP_LIMITS.nameLength, rid) } as RegionDef);
  }
  for (const x of r.arr(o.nations, 'Realms', MAP_LIMITS.nations)) {
    const no = r.obj(x, 'Realm');
    const nid = r.id(no.id, 'Realm id');
    const color = r.str(no.color, 'Realm colour', 7, nid);
    if (color && !COLOR.test(color)) r.err('value', `Realm colour "${color}" must be a #rrggbb colour.`, nid);
    const n: NationDef = {
      id: nid,
      name: r.str(no.name, 'Realm name', MAP_LIMITS.nameLength, nid),
      short: r.str(no.short, 'Realm short name', 24, nid),
      adjective: r.str(no.adjective ?? no.short, 'Realm adjective', 24, nid),
      color,
      capital: r.id(no.capital, 'Capital', nid),
      personality: r.oneOf(no.personality, PERSONALITY_IDS, 'Personality', nid),
      emblem: r.oneOf(no.emblem ?? 'none', CHARGE_NAMES, 'Emblem', nid),
      summary: r.str(no.summary ?? '', 'Realm summary', MAP_LIMITS.textLength, nid),
      strength: r.str(no.strength ?? '', 'Realm strength', 200, nid),
      constraint: r.str(no.constraint ?? '', 'Realm constraint', 200, nid),
      traits: readTraits(r, no.traits, nid),
    };
    if (no.startType !== undefined) n.startType = r.str(no.startType, 'Start type', 60, nid);
    if (no.rating !== undefined) n.rating = r.oneOf(no.rating, ['recommended', 'standard', 'challenging'] as const, 'Rating', nid);
    if (no.arms !== undefined) {
      const a = r.obj(no.arms, 'Arms', nid);
      n.arms = {
        field: r.oneOf(a.field, TINCTURE_NAMES, 'Arms field', nid),
        ordinary: r.oneOf(a.ordinary, ORDINARY_NAMES, 'Arms ordinary', nid),
        ordinaryTincture: r.oneOf(a.ordinaryTincture, TINCTURE_NAMES, 'Ordinary tincture', nid),
        charge: r.oneOf(a.charge, CHARGE_NAMES, 'Arms charge', nid),
        chargeTincture: r.oneOf(a.chargeTincture, TINCTURE_NAMES, 'Charge tincture', nid),
      };
    }
    pkg.nations.push(n);
  }
  for (const x of r.arr(o.provinces, 'Provinces', MAP_LIMITS.provinces)) {
    const po = r.obj(x, 'Province');
    const pid = r.id(po.id, 'Province id');
    const p: ProvinceDef = {
      id: pid,
      name: r.str(po.name, 'Province name', MAP_LIMITS.nameLength, pid),
      terrain: r.oneOf(po.terrain, TERRAINS, 'Terrain', pid) as Terrain,
      resource: po.resource === null || po.resource === undefined ? null : (r.oneOf(po.resource, RESOURCES, 'Resource', pid) as Resource),
      owner: po.owner === null || po.owner === undefined ? null : r.id(po.owner, 'Owner', pid),
      dev: r.int(po.dev, 'Development', 1, 20, pid),
      pop: r.num(po.pop, 'Population', 1, 10000, pid),
      region: r.id(po.region, 'Region', pid),
      infra: r.int(po.infra ?? 0, 'Roads', 0, 3, pid),
      fort: r.int(po.fort ?? 0, 'Fort', 0, 3, pid),
      integration: r.num(po.integration ?? 100, 'Integration', 0, 100, pid),
      claims: r.arr(po.claims ?? [], 'Claims', 32).map((c) => r.id(c, 'Claimant', pid)),
      neighbors: r.arr(po.neighbors ?? [], 'Neighbours', 64).map((nb) => r.id(nb, 'Neighbour', pid)),
    };
    pkg.provinces.push(p);
  }
  for (const x of r.arr(o.straits ?? [], 'Straits', 2000)) {
    const pr = r.pair(x, 'Strait');
    if (pr) pkg.straits.push(pr);
  }
  for (const x of r.arr(o.rivers ?? [], 'Rivers', 6000)) {
    const pr = r.pair(x, 'River border');
    if (pr) pkg.rivers.push(pr);
  }
  const g = r.obj(o.geometry, 'Map geometry');
  const b = r.obj(g.bounds, 'Map bounds');
  pkg.geometry.bounds = {
    minX: r.num(b.minX, 'Bounds minX', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate),
    minY: r.num(b.minY, 'Bounds minY', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate),
    maxX: r.num(b.maxX, 'Bounds maxX', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate),
    maxY: r.num(b.maxY, 'Bounds maxY', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate),
  };
  const centers = r.obj(g.centers, 'Province centres');
  for (const [k, v] of Object.entries(centers)) {
    if (!ID.test(k)) {
      r.err('id', `Province centre for invalid id "${k.slice(0, 40)}".`);
      continue;
    }
    const c = r.obj(v, 'Province centre', k);
    pkg.geometry.centers[k] = {
      cx: r.num(c.cx, 'Centre x', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate, k),
      cy: r.num(c.cy, 'Centre y', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate, k),
      area: r.num(c.area, 'Area', 0, 1e9, k),
    };
  }
  let points = 0;
  for (const x of r.arr(g.edges, 'Borders', MAP_LIMITS.edges)) {
    const eo = r.obj(x, 'Border');
    const a = r.str(eo.a, 'Border side', 40);
    const bb = r.str(eo.b, 'Border side', 40);
    const pts = r.points(eo.pts, `Border ${a}–${bb}`);
    points += pts.length;
    const e: MapEdge = { a, b: bb, pts };
    if (eo.river !== undefined) e.river = r.int(eo.river, 'River index', 0, 1000);
    pkg.geometry.edges.push(e);
  }
  for (const x of r.arr(g.waste ?? [], 'Wastelands', MAP_LIMITS.waste)) {
    const wo = r.obj(x, 'Wasteland');
    const poly = r.points(wo.poly, 'Wasteland outline');
    points += poly.length;
    pkg.geometry.waste.push({ kind: r.oneOf(wo.kind, ['peak', 'lake'] as const, 'Wasteland kind'), poly });
  }
  if (points > MAP_LIMITS.points) r.err('limit', `The map has ${points} coordinates; at most ${MAP_LIMITS.points} are allowed.`);
  if (g.labels !== undefined) {
    const labels: MapLabelDef[] = [];
    for (const x of r.arr(g.labels, 'Labels', MAP_LIMITS.labels)) {
      const lo = r.obj(x, 'Label');
      const l: MapLabelDef = {
        kind: r.oneOf(lo.kind, ['sea', 'lake', 'range', 'region', 'river'] as const, 'Label kind'),
        name: r.str(lo.name, 'Label', MAP_LIMITS.nameLength),
        x: r.num(lo.x, 'Label x', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate),
        y: r.num(lo.y, 'Label y', -MAP_LIMITS.coordinate, MAP_LIMITS.coordinate),
      };
      if (lo.size !== undefined) l.size = r.num(lo.size, 'Label size', 1, 2000);
      if (lo.angle !== undefined) l.angle = r.num(lo.angle, 'Label angle', -Math.PI, Math.PI);
      labels.push(l);
    }
    pkg.geometry.labels = labels;
  }
  return { pkg, errors: r.errors };
}

function key(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function polylineLength(pts: number[]): number {
  let l = 0;
  for (let i = 2; i < pts.length; i += 2) l += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return l;
}

/** Semantic checks of a (normalised) package. Fast enough to run on every import. */
export function validateMapPackage(pkg: MapPackage): MapCheck {
  const errors: MapIssue[] = [];
  const warnings: MapIssue[] = [];
  const err = (code: string, message: string, ref?: string) => {
    if (errors.length < 200) errors.push({ code, message, ref });
  };
  const warn = (code: string, message: string, ref?: string) => {
    if (warnings.length < 200) warnings.push({ code, message, ref });
  };

  const provById = new Map<string, ProvinceDef>();
  for (const p of pkg.provinces) {
    if (provById.has(p.id)) err('duplicate', `Province id "${p.id}" is used twice.`, p.id);
    provById.set(p.id, p);
  }
  const nationIds = new Set<string>();
  for (const n of pkg.nations) {
    if (nationIds.has(n.id)) err('duplicate', `Realm id "${n.id}" is used twice.`, n.id);
    nationIds.add(n.id);
  }
  const regionIds = new Set<string>();
  for (const rg of pkg.regions) {
    if (regionIds.has(rg.id)) err('duplicate', `Region id "${rg.id}" is used twice.`, rg.id);
    regionIds.add(rg.id);
  }
  if (pkg.provinces.length < 2) err('size', 'A map needs at least two provinces.');
  if (pkg.nations.length < 2) err('size', 'A map needs at least two realms.');
  if (pkg.rules.campaignYears.options.length === 0) err('rules', 'Offer at least one campaign length.');
  else if (!pkg.rules.campaignYears.options.includes(pkg.rules.campaignYears.default)) err('rules', `The default campaign length (${pkg.rules.campaignYears.default} years) is not one of the offered lengths.`);

  // provinces: references and adjacency
  const regionCount = new Map<string, number>();
  for (const p of pkg.provinces) {
    if (p.owner && !nationIds.has(p.owner)) err('reference', `${p.name || p.id} is owned by an unknown realm "${p.owner}".`, p.id);
    if (!regionIds.has(p.region)) err('reference', `${p.name || p.id} is in an unknown region "${p.region}".`, p.id);
    regionCount.set(p.region, (regionCount.get(p.region) ?? 0) + 1);
    for (const c of p.claims) if (!nationIds.has(c)) err('reference', `${p.name || p.id} is claimed by an unknown realm "${c}".`, p.id);
    if (new Set(p.claims).size !== p.claims.length) err('duplicate', `${p.name || p.id} lists a claimant twice.`, p.id);
    if (new Set(p.neighbors).size !== p.neighbors.length) err('duplicate', `${p.name || p.id} lists a neighbour twice.`, p.id);
    for (const nb of p.neighbors) {
      if (nb === p.id) err('adjacency', `${p.name || p.id} lists itself as a neighbour.`, p.id);
      const q = provById.get(nb);
      if (!q) err('reference', `${p.name || p.id} borders an unknown province "${nb}".`, p.id);
      else if (!q.neighbors.includes(p.id)) err('adjacency', `${p.name || p.id} borders ${q.name || q.id}, but not the other way round: borders must be two-way.`, p.id);
    }
    const cap = TERRAIN[p.terrain]?.devCap ?? 4;
    if (p.dev > cap + 3) err('range', `${p.name || p.id} has development ${p.dev}; ${p.terrain} allows at most ${cap + 3}.`, p.id);
    if (!p.owner && p.integration !== 100 && p.integration !== 0) warn('value', `${p.name || p.id} is unclaimed; its integration is ignored.`, p.id);
  }
  for (const rg of pkg.regions) if (!regionCount.get(rg.id)) warn('region', `Region "${rg.name || rg.id}" has no provinces.`, rg.id);

  // realms
  for (const n of pkg.nations) {
    const cap = provById.get(n.capital);
    if (!cap) err('reference', `${n.name || n.id}'s capital "${n.capital}" is not a province of this map.`, n.id);
    else if (cap.owner !== n.id) err('capital', `${n.name || n.id}'s capital ${cap.name || cap.id} must be owned by ${n.name || n.id}.`, n.id);
  }
  const owned = new Map<string, string[]>();
  for (const p of pkg.provinces) if (p.owner) (owned.get(p.owner) ?? owned.set(p.owner, []).get(p.owner)!).push(p.id);
  for (const n of pkg.nations) {
    const mine = owned.get(n.id) ?? [];
    if (!mine.length) err('start', `${n.name || n.id} starts with no provinces.`, n.id);
    else if (mine.length < 3) warn('start', `${n.name || n.id} starts with only ${mine.length} province(s) and may not survive long.`, n.id);
  }

  // routes
  const routes = new Set<string>();
  for (const p of pkg.provinces) for (const nb of p.neighbors) routes.add(key(p.id, nb));
  const straitSet = new Set<string>();
  for (const [a, b] of pkg.straits) {
    if (!provById.has(a) || !provById.has(b)) {
      err('reference', `A strait joins unknown provinces "${a}" and "${b}".`);
      continue;
    }
    if (!routes.has(key(a, b))) err('adjacency', `The strait ${a}–${b} must also be listed as a neighbour on both sides.`, a);
    straitSet.add(key(a, b));
  }
  for (const [a, b] of pkg.rivers) {
    if (!routes.has(key(a, b))) err('adjacency', `The river border ${a}–${b} is not a border between neighbours.`, a);
    else if (straitSet.has(key(a, b))) err('adjacency', `${a}–${b} cannot be both a river and a strait.`, a);
  }

  // geometry: every province drawn, outlines closable, borders consistent with routes
  const { bounds, centers, edges } = pkg.geometry;
  if (!(bounds.maxX > bounds.minX && bounds.maxY > bounds.minY)) err('geometry', 'The map bounds are empty or inverted.');
  const sides = new Set<string>(NON_PROVINCE_SIDES);
  const borderLen = new Map<string, number>();
  const edgesOf = new Map<string, MapEdge[]>();
  for (const e of edges) {
    for (const s of [e.a, e.b]) {
      if (!provById.has(s) && !sides.has(s)) err('reference', `A border touches an unknown province "${s}".`, s);
    }
    if (e.a === e.b) err('geometry', `A border has the same province "${e.a}" on both sides.`, e.a);
    if (e.pts.length < 4) err('geometry', `The border ${e.a}–${e.b} needs at least two points.`, e.a);
    else if (degenerate(e.pts)) warn('geometry', `The border ${e.a}–${e.b} has zero length and is ignored.`, e.a);
    for (const s of [e.a, e.b]) if (provById.has(s)) (edgesOf.get(s) ?? edgesOf.set(s, []).get(s)!).push(e);
    if (provById.has(e.a) && provById.has(e.b)) {
      const k = key(e.a, e.b);
      borderLen.set(k, (borderLen.get(k) ?? 0) + polylineLength(e.pts));
    }
  }
  const minBorder = pkg.rules.minBorder ?? 14;
  for (const [k, len] of borderLen) {
    if (routes.has(k)) continue;
    const [a, b] = k.split('|');
    if (len >= minBorder) err('route', `${provById.get(a)?.name ?? a} and ${provById.get(b)?.name ?? b} share a visible border (${Math.round(len)} units) but are not neighbours: a visible border must be a route.`, a);
    else warn('route', `${a} and ${b} touch along a sliver of border (${len.toFixed(1)} units) that is drawn but is not a route.`, a);
  }
  for (const k of routes) {
    if (borderLen.has(k) || straitSet.has(k)) continue;
    const [a, b] = k.split('|');
    err('route', `${provById.get(a)?.name ?? a} and ${provById.get(b)?.name ?? b} are neighbours but share no drawn border or strait: a route must be visible.`, a);
  }
  for (const p of pkg.provinces) {
    const c = centers[p.id];
    if (!c) {
      err('geometry', `${p.name || p.id} has no centre on the map.`, p.id);
      continue;
    }
    if (c.cx < bounds.minX || c.cx > bounds.maxX || c.cy < bounds.minY || c.cy > bounds.maxY) err('geometry', `${p.name || p.id}'s centre lies outside the map bounds.`, p.id);
    const mine = edgesOf.get(p.id) ?? [];
    if (!mine.length) {
      err('geometry', `${p.name || p.id} has no borders, so it cannot be drawn.`, p.id);
      continue;
    }
    const { loops, closed } = loopsFromEdges(p.id, mine);
    if (!closed || !loops.length) {
      err('geometry', `${p.name || p.id}'s borders do not join into a closed outline.`, p.id);
      continue;
    }
    const outer = loops.reduce((a, b) => (b.area > a.area ? b : a));
    if (outer.area <= 1) err('geometry', `${p.name || p.id}'s outline has no area.`, p.id);
    for (const l of loops) {
      if (l === outer) continue;
      // an enclosed lake, peak or lagoon is a hole; another piece of land would be an exclave
      if (l.sides.some((x) => !sides.has(x))) err('geometry', `${p.name || p.id} is in more than one piece; a province must be one piece of land.`, p.id);
      else warn('hole', `${p.name || p.id} encloses a ${l.sides[0].slice(1)}.`, p.id);
    }
  }
  for (const id of Object.keys(centers)) if (!provById.has(id)) warn('geometry', `A centre is defined for "${id}", which is not a province.`, id);

  // strategic accessibility: one connected world
  if (pkg.provinces.length >= 2) {
    const seen = new Set<string>([pkg.provinces[0].id]);
    const q = [pkg.provinces[0].id];
    for (let i = 0; i < q.length; i++) for (const nb of provById.get(q[i])?.neighbors ?? []) if (provById.has(nb) && !seen.has(nb)) (seen.add(nb), q.push(nb));
    if (seen.size < pkg.provinces.length) {
      const cut = pkg.provinces.filter((p) => !seen.has(p.id));
      err('connectivity', `${cut.length} province(s) cannot be reached from the rest of the map (${cut.slice(0, 5).map((p) => p.name || p.id).join(', ')}${cut.length > 5 ? ', …' : ''}). Add a land border or a strait.`, cut[0].id);
    }
  }
  // starting viability: every realm can reach someone to deal with
  for (const n of pkg.nations) {
    const mine = owned.get(n.id) ?? [];
    const touches = mine.some((pid) => (provById.get(pid)?.neighbors ?? []).some((nb) => provById.get(nb)?.owner !== n.id));
    if (mine.length && !touches) warn('start', `${n.name || n.id} is completely enclosed by its own land with no frontier.`, n.id);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Reads an imported map file: size limit, JSON, normalisation and validation. */
export function parseMapPackage(text: string): { pkg: MapPackage | null; check: MapCheck } {
  if (text.length > MAP_LIMITS.bytes) {
    return { pkg: null, check: { ok: false, errors: [{ code: 'limit', message: `The file is ${(text.length / 1048576).toFixed(1)} MB; maps may be at most ${MAP_LIMITS.bytes / 1048576} MB.` }], warnings: [] } };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { pkg: null, check: { ok: false, errors: [{ code: 'json', message: 'The file is not readable JSON: it may be truncated or not a map file.' }], warnings: [] } };
  }
  const { pkg, errors } = normalizeMapPackage(raw);
  if (errors.length) return { pkg: null, check: { ok: false, errors, warnings: [] } };
  const check = validateMapPackage(pkg);
  return { pkg: check.ok ? pkg : null, check };
}
