// The versioned map package: one self-contained, plain-JSON description of a
// campaign map (rules, realms, provinces, routes and drawn geometry). Built-in
// maps, generated maps and (later) maps made in the editor all use this format
// and pass through the same validator and the same conversion to the
// simulation's scenario and the renderer's geometry.
//
// Versioning: `version` is the format version (this file). `revision` is the
// map's own content revision; saves record the map id, revision and checksum so
// a map that changes later can never silently reinterpret an old campaign.

import type { NationDef, ProvinceDef, RegionDef } from '../sim/types';

export const MAP_FORMAT = 'crown-frontier-map';
/**
 * 1: first format (17th-century resources: grain, iron, horses, goods).
 * 2: industrial deposits (food, coal, iron, oil, rubber, nitrates) and factories.
 * Older packages are upgraded on import (validate.ts).
 */
export const MAP_FORMAT_VERSION = 2;

/** Reserved border ids for edges that touch no province. */
export const SEA = '~sea';
export const LAKE = '~lake';
export const PEAK = '~peak';
export const NON_PROVINCE_SIDES = [SEA, LAKE, PEAK] as const;

export type MapSize = 'small' | 'standard' | 'large' | 'huge';
export type MapDifficulty = 'gentle' | 'standard' | 'hard';

export interface MapMeta {
  name: string;
  description: string;
  /** one line for the map library */
  blurb?: string;
  size: MapSize;
  difficulty: MapDifficulty;
  /** expected campaign style, e.g. "Continental war on several fronts" */
  style: string;
  /** special mechanics a player should know about, e.g. "Mountain passes" */
  mechanics: string[];
  author?: string;
  /** where the map came from */
  origin: 'builtin' | 'generated' | 'custom';
  /** attribution lines for geographic data or other sources */
  attribution?: string[];
}

export interface MapRules {
  startYear: number;
  campaignYears: { options: number[]; default: number };
  victory?: Partial<{ territorialRegions: number; territorialShare: number; economicShare: number; diplomaticInfluencePerRealm: number; diplomaticMinInfluence: number }>;
  researchCostMul?: number;
  /** land borders shorter than this (map units) are drawn but are not routes (default 14) */
  minBorder?: number;
}

export interface MapEdge {
  /** province id, or a reserved side ('~sea', '~lake', '~peak') */
  a: string;
  b: string;
  /** polyline x0,y0,x1,y1,… shared exactly by both sides */
  pts: number[];
  /** river along this border (index into the map's rivers, for drawing) */
  river?: number;
}

export interface MapLabelDef {
  kind: 'sea' | 'lake' | 'range' | 'region' | 'river';
  name: string;
  x: number;
  y: number;
  size?: number;
  angle?: number;
}

export interface MapGeometryData {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** label anchor and area of each province */
  centers: Record<string, { cx: number; cy: number; area: number }>;
  /** every border once; province outlines are rebuilt from these */
  edges: MapEdge[];
  /** impassable areas drawn on the map: mountain ranges and lakes */
  waste: Array<{ kind: string; poly: number[] }>;
  labels?: MapLabelDef[];
}

export interface MapPackage {
  format: typeof MAP_FORMAT;
  version: number;
  /** stable identifier: lower-case letters, digits and dashes */
  id: string;
  /** content revision of this map, bumped whenever its data changes */
  revision: number;
  meta: MapMeta;
  rules: MapRules;
  regions: RegionDef[];
  nations: NationDef[];
  /** provinces with explicit neighbours (land borders and straits) */
  provinces: ProvinceDef[];
  straits: Array<[string, string]>;
  rivers: Array<[string, string]>;
  geometry: MapGeometryData;
}

/** Size class from the number of provinces (shown in the map library). */
export function sizeFor(provinces: number): MapSize {
  if (provinces < 150) return 'small';
  if (provinces < 450) return 'standard';
  if (provinces < 900) return 'large';
  return 'huge';
}

/** JSON with object keys sorted at every level, so equal content has one spelling. */
function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonicalJson(x))).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/**
 * FNV-1a checksum of a package's gameplay content: rules, realms, provinces
 * and routes. Drawn geometry is excluded, so redrawing a coastline does not
 * invalidate saves, while any change a campaign depends on does. Key order does
 * not matter (a sanitised copy of a package has the same checksum).
 */
export function mapChecksum(pkg: Pick<MapPackage, 'id' | 'revision' | 'rules' | 'regions' | 'nations' | 'provinces' | 'straits' | 'rivers'>): string {
  const canon = canonicalJson({
    id: pkg.id,
    revision: pkg.revision,
    rules: pkg.rules,
    regions: pkg.regions,
    nations: pkg.nations,
    provinces: pkg.provinces,
    straits: pkg.straits,
    rivers: pkg.rivers,
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** A package without its drawn geometry: everything the simulation needs. */
export type MapScenarioPart = Omit<MapPackage, 'geometry'>;

/**
 * Drawable map: province outlines rebuilt from the shared borders, ready for
 * the renderer (the browser's MapGeometry).
 */
export interface DrawnMap {
  id: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  provinces: Record<string, { poly: number[]; cx: number; cy: number; area: number }>;
  edges: MapEdge[];
  waste: Array<{ kind: string; poly: number[] }>;
  straits: Array<[string, string]>;
  labels?: MapLabelDef[];
}

