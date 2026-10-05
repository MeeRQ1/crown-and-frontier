// Editing operations on a map package, used by the in-browser map editor.
// Each operation changes the package in place and keeps it consistent where
// the change implies it (a realm that loses its capital gets another one,
// development stays within what the terrain allows, a strait is listed on both
// sides and commanded by a sea zone). Whatever an edit cannot make consistent
// on its own is left to the validator, which says what to fix.
//
// Pure data: no DOM, so the operations are tested directly (tests/editor.test.ts).
// Drawn geometry is never changed in place: an operation that changes it gives
// the package a new geometry object, so an undo history can share the old one.

import { TERRAIN } from '../sim/config';
import type { NationDef, Personality, ProvinceDef, Resource, Terrain } from '../sim/types';
import { SEA, sizeFor, type MapEdge, type MapPackage } from './format';
import { loopsFromEdges } from './rings';
import { campaignYearsFor, researchCostFor, scaledVictory } from './rules';
import { addSeaZones } from './validate';

export interface EditResult {
  ok: boolean;
  message?: string;
}

const done: EditResult = { ok: true };
const refuse = (message: string): EditResult => ({ ok: false, message });
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function provMap(pkg: MapPackage): Map<string, ProvinceDef> {
  return new Map(pkg.provinces.map((p) => [p.id, p]));
}

function name(pkg: MapPackage, id: string): string {
  return pkg.provinces.find((p) => p.id === id)?.name ?? id;
}

/** Highest development a province may start with on its terrain. */
export function devCap(terrain: Terrain): number {
  return (TERRAIN[terrain]?.devCap ?? 4) + 3;
}

/** Provinces touching the open sea (they can hold ports and border sea zones). */
export function seaCoastal(pkg: MapPackage): Set<string> {
  const out = new Set<string>();
  for (const e of pkg.geometry.edges) {
    if (e.a === SEA) out.add(e.b);
    if (e.b === SEA) out.add(e.a);
  }
  return out;
}

/** Whether two provinces share a drawn land border. */
export function shareBorder(pkg: MapPackage, a: string, b: string): boolean {
  return pkg.geometry.edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

/** Gives a realm that lost its capital its most developed remaining province. */
function fixCapital(pkg: MapPackage, nid: string): void {
  const n = pkg.nations.find((x) => x.id === nid);
  if (!n) return;
  const cap = pkg.provinces.find((p) => p.id === n.capital);
  if (cap?.owner === nid) return;
  let best: ProvinceDef | null = null;
  for (const p of pkg.provinces) if (p.owner === nid && (!best || p.dev > best.dev || (p.dev === best.dev && p.id < best.id))) best = p;
  if (best) n.capital = best.id;
}

// ───────────────────────────── provinces ─────────────────────────────────────

/** Sets the owner of provinces (null: unclaimed frontier). Returns how many changed. */
export function paintOwner(pkg: MapPackage, ids: string[], owner: string | null): number {
  if (owner && !pkg.nations.some((n) => n.id === owner)) return 0;
  const byId = provMap(pkg);
  const lost = new Set<string>();
  let n = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || p.owner === owner) continue;
    if (p.owner) lost.add(p.owner);
    p.owner = owner;
    // a realm's land starts integrated; frontier has nothing to integrate
    p.integration = owner ? 100 : 0;
    p.claims = p.claims.filter((c) => c !== owner);
    n++;
  }
  for (const nid of lost) fixCapital(pkg, nid);
  return n;
}

export function paintTerrain(pkg: MapPackage, ids: string[], terrain: Terrain): number {
  const byId = provMap(pkg);
  let n = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || p.terrain === terrain) continue;
    p.terrain = terrain;
    p.dev = Math.min(p.dev, devCap(terrain));
    n++;
  }
  return n;
}

export function paintRegion(pkg: MapPackage, ids: string[], region: string): number {
  if (!pkg.regions.some((r) => r.id === region)) return 0;
  const byId = provMap(pkg);
  let n = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || p.region === region) continue;
    p.region = region;
    n++;
  }
  return n;
}

export function paintDeposit(pkg: MapPackage, ids: string[], resource: Resource): number {
  const byId = provMap(pkg);
  let n = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || p.resource === resource) continue;
    p.resource = resource;
    n++;
  }
  return n;
}

export type ProvincePatch = Partial<Pick<ProvinceDef, 'name' | 'dev' | 'pop' | 'fort' | 'infra' | 'port' | 'factories'>>;

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));

/** Changes a province's name and starting values, kept within the format's bounds. */
export function setProvince(pkg: MapPackage, id: string, patch: ProvincePatch): EditResult {
  const p = pkg.provinces.find((x) => x.id === id);
  if (!p) return refuse('No such province.');
  if (patch.name !== undefined) {
    const nm = patch.name.trim().slice(0, 60);
    if (!nm) return refuse('A province needs a name.');
    p.name = nm;
  }
  if (patch.dev !== undefined) p.dev = clampInt(patch.dev, 1, devCap(p.terrain));
  if (patch.pop !== undefined) p.pop = clampInt(patch.pop, 1, 10000);
  if (patch.fort !== undefined) p.fort = clampInt(patch.fort, 0, 3);
  if (patch.infra !== undefined) p.infra = clampInt(patch.infra, 0, 3);
  if (patch.factories !== undefined) p.factories = clampInt(patch.factories, 0, 5);
  if (patch.port !== undefined) {
    const level = clampInt(patch.port, 0, 3);
    if (level > 0 && !pkg.seaZones.some((z) => z.coasts.includes(id))) return refuse(`${p.name} is not on the coast of a sea zone, so it cannot have a port.`);
    if (level) p.port = level;
    else delete p.port;
  }
  return done;
}

export function setCapital(pkg: MapPackage, nid: string, pid: string): EditResult {
  const n = pkg.nations.find((x) => x.id === nid);
  const p = pkg.provinces.find((x) => x.id === pid);
  if (!n || !p) return refuse('No such realm or province.');
  if (p.owner !== nid) paintOwner(pkg, [pid], nid);
  n.capital = pid;
  return done;
}

export function toggleClaim(pkg: MapPackage, pid: string, nid: string): EditResult {
  const p = pkg.provinces.find((x) => x.id === pid);
  if (!p || !pkg.nations.some((n) => n.id === nid)) return refuse('No such realm or province.');
  if (p.owner === nid) return refuse('A realm cannot claim its own province.');
  p.claims = p.claims.includes(nid) ? p.claims.filter((c) => c !== nid) : [...p.claims, nid];
  return done;
}

// ───────────────────────────── routes ────────────────────────────────────────

/**
 * Adds or removes a strait (a sea crossing between two coastal provinces that
 * do not share a land border). A new strait is commanded by the sea zone both
 * ends share, or else by a zone on either coast.
 */
export function toggleStrait(pkg: MapPackage, a: string, b: string): EditResult {
  if (a === b) return refuse('Choose two different provinces.');
  const byId = provMap(pkg);
  const pa = byId.get(a);
  const pb = byId.get(b);
  if (!pa || !pb) return refuse('No such province.');
  const k = key(a, b);
  const has = pkg.straits.some(([x, y]) => key(x, y) === k);
  if (has) {
    pkg.straits = pkg.straits.filter(([x, y]) => key(x, y) !== k);
    pa.neighbors = pa.neighbors.filter((x) => x !== b);
    pb.neighbors = pb.neighbors.filter((x) => x !== a);
    for (const z of pkg.seaZones) if (z.straits) z.straits = z.straits.filter(([x, y]) => key(x, y) !== k);
    return done;
  }
  if (shareBorder(pkg, a, b)) return refuse(`${pa.name} and ${pb.name} already share a land border; mark a river there instead.`);
  const coast = seaCoastal(pkg);
  if (!coast.has(a) || !coast.has(b)) return refuse(`A strait must join two coasts: ${!coast.has(a) ? pa.name : pb.name} does not touch the sea.`);
  pkg.straits.push(a < b ? [a, b] : [b, a]);
  if (!pa.neighbors.includes(b)) pa.neighbors.push(b);
  if (!pb.neighbors.includes(a)) pb.neighbors.push(a);
  const both = pkg.seaZones.find((z) => z.coasts.includes(a) && z.coasts.includes(b));
  const either = both ?? pkg.seaZones.find((z) => z.coasts.includes(a) || z.coasts.includes(b));
  if (either) either.straits = [...(either.straits ?? []), a < b ? [a, b] : [b, a]];
  return done;
}

/** Marks or clears a river along the land border of two provinces. */
export function toggleRiver(pkg: MapPackage, a: string, b: string): EditResult {
  if (a === b) return refuse('Choose two different provinces.');
  if (!shareBorder(pkg, a, b)) return refuse(`${name(pkg, a)} and ${name(pkg, b)} do not share a land border.`);
  if (pkg.straits.some(([x, y]) => key(x, y) === key(a, b))) return refuse('That crossing is a strait.');
  const k = key(a, b);
  const has = pkg.rivers.some(([x, y]) => key(x, y) === k);
  if (has) pkg.rivers = pkg.rivers.filter(([x, y]) => key(x, y) !== k);
  else pkg.rivers.push(a < b ? [a, b] : [b, a]);
  // geometry is replaced, never changed in place (the editor's undo history shares it)
  const edges = pkg.geometry.edges.map((e) => {
    if (key(e.a, e.b) !== k) return e;
    const copy: MapEdge = { a: e.a, b: e.b, pts: e.pts };
    if (!has) copy.river = Math.max(1, e.river ?? 0);
    return copy;
  });
  pkg.geometry = { ...pkg.geometry, edges };
  return done;
}

// ───────────────────────────── realms and regions ────────────────────────────

const REALM_COLORS = ['#7d3b3b', '#3b5b7d', '#4f6b3a', '#8a6a2e', '#5d4777', '#2f6f6a', '#8a4f2a', '#4a5560', '#6e3355', '#56702c', '#365f8f', '#7a5c3c', '#3f7a52', '#8c3f3f', '#4b4b84', '#6b6b2e'];

/** A short unique id from a name (letters only, as realm ids are written in saves). */
function freeId(base: string, taken: Set<string>, len = 3): string {
  const letters = base.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') || 'realm';
  for (let n = len; n <= letters.length; n++) if (!taken.has(letters.slice(0, n))) return letters.slice(0, n);
  for (let k = 2; ; k++) if (!taken.has(`${letters.slice(0, len)}${k}`)) return `${letters.slice(0, len)}${k}`;
}

export function addRealm(pkg: MapPackage, realmName: string, capital: string): EditResult & { id?: string } {
  const nm = realmName.trim().slice(0, 60);
  if (!nm) return refuse('A realm needs a name.');
  const p = pkg.provinces.find((x) => x.id === capital);
  if (!p) return refuse('Choose a province for the capital.');
  if (pkg.nations.length >= 32) return refuse('A map may have at most 32 realms.');
  const taken = new Set<string>([...pkg.nations.map((n) => n.id), ...pkg.provinces.map((x) => x.id), ...pkg.regions.map((r) => r.id)]);
  const id = freeId(nm, taken);
  const used = new Set(pkg.nations.map((n) => n.color.toLowerCase()));
  const color = REALM_COLORS.find((c) => !used.has(c)) ?? REALM_COLORS[pkg.nations.length % REALM_COLORS.length];
  const short = nm.replace(/^(The |Kingdom of |Republic of |Duchy of |Grand Duchy of |Principality of |League of )/i, '');
  const def: NationDef = {
    id,
    name: nm,
    short,
    adjective: /[aeiou]$/i.test(short) ? `${short}n` : `${short}ian`,
    color,
    capital,
    personality: 'defensive',
    emblem: 'crown',
    summary: '',
    strength: '',
    constraint: '',
    traits: {},
    arms: { field: 'realm', ordinary: 'none', ordinaryTincture: 'or', charge: 'crown', chargeTincture: 'or' },
  };
  pkg.nations.push(def);
  paintOwner(pkg, [capital], id);
  return { ok: true, id };
}

export type RealmPatch = Partial<Pick<NationDef, 'name' | 'short' | 'adjective' | 'color' | 'personality' | 'summary'>>;

export function updateRealm(pkg: MapPackage, nid: string, patch: RealmPatch): EditResult {
  const n = pkg.nations.find((x) => x.id === nid);
  if (!n) return refuse('No such realm.');
  for (const k of ['name', 'short', 'adjective'] as const) {
    if (patch[k] === undefined) continue;
    const v = patch[k]!.trim().slice(0, 60);
    if (!v) return refuse('Names cannot be empty.');
    n[k] = v;
  }
  if (patch.summary !== undefined) n.summary = patch.summary.slice(0, 600);
  if (patch.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(patch.color)) return refuse('Colours are written #rrggbb.');
    n.color = patch.color;
  }
  if (patch.personality !== undefined) n.personality = patch.personality as Personality;
  return done;
}

/** Removes a realm: its land becomes unclaimed frontier and its claims lapse. */
export function removeRealm(pkg: MapPackage, nid: string): EditResult {
  if (!pkg.nations.some((n) => n.id === nid)) return refuse('No such realm.');
  pkg.nations = pkg.nations.filter((n) => n.id !== nid);
  for (const p of pkg.provinces) {
    if (p.owner === nid) (p.owner = null), (p.integration = 0);
    if (p.claims.includes(nid)) p.claims = p.claims.filter((c) => c !== nid);
  }
  return done;
}

export function addRegion(pkg: MapPackage, regionName: string): EditResult & { id?: string } {
  const nm = regionName.trim().slice(0, 60);
  if (!nm) return refuse('A region needs a name.');
  if (pkg.regions.length >= 300) return refuse('A map may have at most 300 regions.');
  const taken = new Set<string>([...pkg.regions.map((r) => r.id), ...pkg.provinces.map((x) => x.id), ...pkg.nations.map((n) => n.id)]);
  let id = '';
  for (let k = pkg.regions.length; !id || taken.has(id); k++) id = `r${k}`;
  pkg.regions.push({ id, name: nm });
  return { ok: true, id };
}

export function renameRegion(pkg: MapPackage, id: string, regionName: string): EditResult {
  const r = pkg.regions.find((x) => x.id === id);
  const nm = regionName.trim().slice(0, 60);
  if (!r) return refuse('No such region.');
  if (!nm) return refuse('A region needs a name.');
  r.name = nm;
  return done;
}

/** Removes a region, moving its provinces into another. */
export function removeRegion(pkg: MapPackage, id: string, into: string): EditResult {
  if (id === into) return refuse('Choose another region to take its provinces.');
  if (!pkg.regions.some((r) => r.id === id) || !pkg.regions.some((r) => r.id === into)) return refuse('No such region.');
  for (const p of pkg.provinces) if (p.region === id) p.region = into;
  pkg.regions = pkg.regions.filter((r) => r.id !== id);
  return done;
}

// ───────────────────────────── merging provinces ─────────────────────────────

/**
 * Merges `gone` into `keep` (two provinces sharing a land border): one
 * province with both outlines, their neighbours, routes, coasts and starting
 * values (the larger development, roads and fort; population and factories
 * added). Refused if the result would not be one piece of land.
 */
export function mergeProvinces(pkg: MapPackage, keep: string, gone: string): EditResult {
  if (keep === gone) return refuse('Choose two different provinces.');
  const byId = provMap(pkg);
  const K = byId.get(keep);
  const G = byId.get(gone);
  if (!K || !G) return refuse('No such province.');
  if (!shareBorder(pkg, keep, gone)) return refuse(`${K.name} and ${G.name} do not share a land border.`);
  // outline first: the merged borders must close into one piece
  const edges: MapEdge[] = [];
  for (const e of pkg.geometry.edges) {
    if ((e.a === keep && e.b === gone) || (e.a === gone && e.b === keep)) continue;
    edges.push(e.a === gone || e.b === gone ? { ...e, a: e.a === gone ? keep : e.a, b: e.b === gone ? keep : e.b } : e);
  }
  const { loops, closed } = loopsFromEdges(keep, edges);
  if (!closed || !loops.length) return refuse(`The borders of ${K.name} and ${G.name} do not join into one outline.`);
  const outer = loops.reduce((a, b) => (b.area > a.area ? b : a));
  if (loops.some((l) => l !== outer && l.sides.some((s) => !s.startsWith('~')))) return refuse(`Merging ${K.name} and ${G.name} would enclose other provinces; merge those first.`);
  const centers = { ...pkg.geometry.centers };
  pkg.geometry = { ...pkg.geometry, edges, centers };
  const ck = centers[keep];
  const cg = centers[gone];
  if (ck && cg) {
    const area = ck.area + cg.area;
    centers[keep] = { cx: Math.round(((ck.cx * ck.area + cg.cx * cg.area) / area) * 10) / 10, cy: Math.round(((ck.cy * ck.area + cg.cy * cg.area) / area) * 10) / 10, area };
  }
  delete centers[gone];
  // the province itself
  K.dev = Math.min(devCap(K.terrain), Math.max(K.dev, G.dev));
  K.pop = Math.min(10000, K.pop + G.pop);
  K.fort = Math.max(K.fort, G.fort);
  K.infra = Math.max(K.infra, G.infra);
  if (G.port || K.port) K.port = Math.max(K.port ?? 0, G.port ?? 0);
  if (G.factories !== undefined || K.factories !== undefined) K.factories = Math.min(5, (K.factories ?? 0) + (G.factories ?? 0));
  K.resource = K.resource ?? G.resource;
  K.claims = [...new Set([...K.claims, ...G.claims])].filter((c) => c !== K.owner);
  K.neighbors = [...new Set([...K.neighbors, ...G.neighbors])].filter((x) => x !== keep && x !== gone);
  pkg.provinces = pkg.provinces.filter((p) => p !== G);
  for (const p of pkg.provinces) {
    if (p === K || !p.neighbors.includes(gone)) continue;
    p.neighbors = [...new Set(p.neighbors.map((x) => (x === gone ? keep : x)))].filter((x) => x !== p.id);
  }
  // routes and coasts
  const relabel = (pairs: Array<[string, string]>) => {
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const [a0, b0] of pairs) {
      const a = a0 === gone ? keep : a0;
      const b = b0 === gone ? keep : b0;
      if (a === b || seen.has(key(a, b))) continue;
      seen.add(key(a, b));
      out.push(a < b ? [a, b] : [b, a]);
    }
    return out;
  };
  pkg.straits = relabel(pkg.straits);
  pkg.rivers = relabel(pkg.rivers);
  for (const z of pkg.seaZones) {
    z.coasts = [...new Set(z.coasts.map((c) => (c === gone ? keep : c)))];
    if (z.straits) z.straits = relabel(z.straits);
  }
  for (const n of pkg.nations) if (n.capital === gone) n.capital = keep;
  for (const n of pkg.nations) fixCapital(pkg, n.id);
  return done;
}

// ───────────────────────────── whole map ─────────────────────────────────────

/** Rebuilds the sea zones from the coastline; ports off every coast are removed. */
export function regenerateSeas(pkg: MapPackage): void {
  pkg.geometry = { ...pkg.geometry };
  addSeaZones(pkg);
  const coastal = new Set(pkg.seaZones.flatMap((z) => z.coasts));
  for (const p of pkg.provinces) if (p.port && !coastal.has(p.id)) delete p.port;
}

/** Size class, mechanics and campaign rules recomputed from the map as it now is. */
export function refreshRules(pkg: MapPackage): void {
  const size = sizeFor(pkg.provinces.length);
  pkg.meta.size = size;
  const mechanics: string[] = [];
  const mountains = pkg.provinces.filter((p) => p.terrain === 'mountains').length;
  if (mountains) mechanics.push('Mountain passes');
  if (pkg.rivers.length) mechanics.push('River crossings');
  if (pkg.straits.length) mechanics.push('Straits and islands');
  if (pkg.provinces.filter((p) => !p.owner).length >= pkg.provinces.length * 0.05) mechanics.push('Unclaimed frontier');
  pkg.meta.mechanics = mechanics;
  pkg.rules.campaignYears = campaignYearsFor(size);
  pkg.rules.victory = scaledVictory(pkg.regions.length, pkg.nations.length);
  pkg.rules.researchCostMul = researchCostFor(pkg.provinces.length, pkg.nations.length);
}
