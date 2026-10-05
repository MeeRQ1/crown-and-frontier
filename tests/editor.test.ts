// The map editor's operations (src/maps/edit.ts), the procedural generator
// behind "New map", and the built-in maps it made: every edit leaves a map the
// validator accepts (or says why not), and edited maps play.

import { describe, expect, it } from 'vitest';
import { BUILTIN_MAPS, builtinPackage } from '../src/maps/builtin';
import * as E from '../src/maps/edit';
import { mapChecksum, type MapPackage } from '../src/maps/format';
import { buildProceduralMap, DEFAULT_PARAMS } from '../src/maps/gen/procedural';
import { parseMapPackage, validateMapPackage } from '../src/maps/validate';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { step } from '../src/sim/tick';
import { registerMapScenario, unregisterScenario } from '../src/sim/world';
import { GENERATED_MAPS } from '../tools/genmaps';

async function reachCopy(): Promise<MapPackage> {
  const pkg = structuredClone(await builtinPackage('reach'));
  return { ...pkg, id: 'reach-edit', meta: { ...pkg.meta, origin: 'custom' } };
}

const ok = (pkg: MapPackage) => {
  const check = validateMapPackage(pkg);
  expect(check.errors).toEqual([]);
  return check;
};

/** Registers a package, plays a year with the AI and checks the invariants every month. */
function playYear(pkg: MapPackage): void {
  registerMapScenario(pkg);
  try {
    const sim = createGame({ scenario: pkg.id, seed: 5, playerNation: null });
    for (let t = 0; t < 52; t++) {
      step(sim);
      if (t % 4 === 3) expect(checkInvariants(sim)).toEqual([]);
    }
  } finally {
    unregisterScenario(pkg.id);
  }
}

describe('built-in maps', () => {
  it('every built-in map is a valid package', async () => {
    for (const id of BUILTIN_MAPS) {
      const check = validateMapPackage(await builtinPackage(id));
      expect(check.errors, id).toEqual([]);
    }
  });

  it('the generated built-in maps are exactly what their recipe produces', async () => {
    // the smallest of the three is regenerated here; `npm run genmaps` rebuilds all three
    const recipe = GENERATED_MAPS.find((p) => p.id === 'isles')!;
    const { pkg } = buildProceduralMap(recipe);
    const shipped = await builtinPackage('isles');
    expect(mapChecksum(pkg)).toBe(mapChecksum(shipped));
    expect(pkg.geometry.edges.length).toBe(shipped.geometry.edges.length);
  });

  it('every realm on a generated map starts with coal, and deposits follow the usual mix', async () => {
    for (const id of ['isles', 'steppe', 'midsea'] as const) {
      const pkg = await builtinPackage(id);
      for (const n of pkg.nations) expect(pkg.provinces.some((p) => p.owner === n.id && p.resource === 'coal'), `${id} ${n.id}`).toBe(true);
      const share = (r: string) => pkg.provinces.filter((p) => p.resource === r).length / pkg.provinces.length;
      expect(share('coal')).toBeGreaterThan(0.1);
      expect(share('iron')).toBeGreaterThan(0.03);
      expect(share('oil') + share('rubber')).toBeGreaterThan(0.03);
    }
  });
});

describe('map editor operations', () => {
  it('painting a realm’s capital away moves its capital to its best remaining province', async () => {
    const pkg = await reachCopy();
    const [a, b] = pkg.nations;
    const old = a.capital;
    expect(E.paintOwner(pkg, [old], b.id)).toBe(1);
    expect(a.capital).not.toBe(old);
    expect(pkg.provinces.find((p) => p.id === a.capital)!.owner).toBe(a.id);
    ok(pkg);
  });

  it('terrain changes keep development within what the terrain allows', async () => {
    const pkg = await reachCopy();
    const p = pkg.provinces.find((x) => x.terrain === 'plains' && x.dev > E.devCap('mountains'));
    if (p) {
      E.paintTerrain(pkg, [p.id], 'mountains');
      expect(p.dev).toBe(E.devCap('mountains'));
    }
    expect(E.setProvince(pkg, pkg.provinces[0].id, { dev: 99, fort: 9, infra: -2 }).ok).toBe(true);
    expect(pkg.provinces[0].dev).toBe(E.devCap(pkg.provinces[0].terrain));
    expect(pkg.provinces[0].fort).toBe(3);
    expect(pkg.provinces[0].infra).toBe(0);
    ok(pkg);
  });

  it('a strait joins two coasts both ways and is commanded by a sea zone; removing it restores the map', async () => {
    const pkg = await reachCopy();
    const before = mapChecksum(pkg);
    const coast = E.seaCoastal(pkg);
    let pair: [string, string] | null = null;
    for (const z of pkg.seaZones) {
      const cs = z.coasts.filter((c) => coast.has(c));
      for (const a of cs) for (const b of cs) if (!pair && a < b && !pkg.provinces.find((p) => p.id === a)!.neighbors.includes(b)) pair = [a, b];
    }
    expect(pair).not.toBeNull();
    const [a, b] = pair!;
    expect(E.toggleStrait(pkg, a, b).ok).toBe(true);
    expect(pkg.provinces.find((p) => p.id === a)!.neighbors).toContain(b);
    expect(pkg.provinces.find((p) => p.id === b)!.neighbors).toContain(a);
    expect(pkg.seaZones.some((z) => z.straits?.some(([x, y]) => (x === a && y === b) || (x === b && y === a)))).toBe(true);
    ok(pkg);
    expect(E.toggleStrait(pkg, a, b).ok).toBe(true);
    expect(mapChecksum(pkg)).toBe(before);
    // an inland province cannot hold one end
    const inland = pkg.provinces.find((p) => !coast.has(p.id))!;
    expect(E.toggleStrait(pkg, inland.id, a).ok).toBe(false);
  });

  it('rivers are marked on land borders only, and the drawing follows', async () => {
    const pkg = await reachCopy();
    const p = pkg.provinces.find((x) => x.neighbors.some((n) => E.shareBorder(pkg, x.id, n)))!;
    const q = p.neighbors.find((n) => E.shareBorder(pkg, p.id, n))!;
    const had = pkg.rivers.length;
    const geometry = pkg.geometry;
    expect(E.toggleRiver(pkg, p.id, q).ok).toBe(true);
    expect(pkg.rivers.length).toBe(had + 1);
    expect(pkg.geometry).not.toBe(geometry); // replaced, never changed in place (undo shares it)
    expect(pkg.geometry.edges.some((e) => ((e.a === p.id && e.b === q) || (e.a === q && e.b === p.id)) && (e.river ?? 0) > 0)).toBe(true);
    ok(pkg);
    expect(E.toggleRiver(pkg, p.id, q).ok).toBe(true);
    expect(pkg.rivers.length).toBe(had);
    const far = pkg.provinces.find((x) => x.id !== p.id && !p.neighbors.includes(x.id))!;
    expect(E.toggleRiver(pkg, p.id, far.id).ok).toBe(false);
  });

  it('merging two neighbours gives one valid province that the campaign plays on', async () => {
    const pkg = await reachCopy();
    const n = pkg.provinces.length;
    // two provinces of the same realm, neither a capital
    const caps = new Set(pkg.nations.map((x) => x.capital));
    let pair: [string, string] | null = null;
    for (const p of pkg.provinces) {
      if (pair || !p.owner || caps.has(p.id)) continue;
      const q = p.neighbors.find((id) => {
        const o = pkg.provinces.find((x) => x.id === id)!;
        return o.owner === p.owner && !caps.has(id) && E.shareBorder(pkg, p.id, id);
      });
      if (q) pair = [p.id, q];
    }
    expect(pair).not.toBeNull();
    const [keep, gone] = pair!;
    const pop = pkg.provinces.find((p) => p.id === keep)!.pop + pkg.provinces.find((p) => p.id === gone)!.pop;
    const r = E.mergeProvinces(pkg, keep, gone);
    expect(r.message ?? '').toBe('');
    expect(r.ok).toBe(true);
    expect(pkg.provinces.length).toBe(n - 1);
    expect(pkg.provinces.find((p) => p.id === keep)!.pop).toBe(Math.min(10000, pop));
    expect(pkg.provinces.some((p) => p.neighbors.includes(gone))).toBe(false);
    expect(pkg.geometry.centers[gone]).toBeUndefined();
    ok(pkg);
    playYear(pkg);
  });

  it('realms and regions can be added and removed, and the map stays playable', async () => {
    const pkg = await reachCopy();
    const free = pkg.provinces.find((p) => !p.owner)!;
    const added = E.addRealm(pkg, 'Kingdom of Testmark', free.id);
    expect(added.ok).toBe(true);
    const nid = added.id!;
    expect(pkg.nations.find((n) => n.id === nid)!.capital).toBe(free.id);
    // give it some land around its capital
    E.paintOwner(pkg, free.neighbors.filter((id) => !pkg.provinces.find((p) => p.id === id)!.owner).slice(0, 2), nid);
    const reg = E.addRegion(pkg, 'Testmark Marches');
    expect(reg.ok).toBe(true);
    E.paintRegion(pkg, [free.id], reg.id!);
    const check = ok(pkg);
    expect(check.ok).toBe(true);
    playYear(pkg);
    expect(E.removeRegion(pkg, reg.id!, pkg.regions[0].id).ok).toBe(true);
    expect(E.removeRealm(pkg, nid).ok).toBe(true);
    expect(pkg.provinces.find((p) => p.id === free.id)!.owner).toBeNull();
    ok(pkg);
    // a realm with no land is reported, not silently accepted
    const empty = E.addRealm(pkg, 'Nowhere', free.id);
    E.paintOwner(pkg, [free.id], null);
    expect(validateMapPackage(pkg).errors.some((e) => e.ref === empty.id)).toBe(true);
  });

  it('regenerating sea zones and recomputing the rules keep the map valid', async () => {
    const pkg = await reachCopy();
    E.regenerateSeas(pkg);
    E.refreshRules(pkg);
    expect(pkg.meta.size).toBe('small');
    expect(pkg.rules.victory?.territorialShare).toBeGreaterThan(0.1);
    ok(pkg);
  });

  it('an edited map survives export and import unchanged', async () => {
    const pkg = await reachCopy();
    E.paintTerrain(pkg, [pkg.provinces[3].id], 'marsh');
    E.setProvince(pkg, pkg.provinces[3].id, { name: 'Edited Fen', port: 0 });
    const { pkg: back, check } = parseMapPackage(JSON.stringify(pkg));
    expect(check.errors).toEqual([]);
    expect(mapChecksum(back!)).toBe(mapChecksum(pkg));
  });
});

describe('new maps from the generator', () => {
  it('a small generated map of every shape validates and plays', () => {
    for (const shape of ['continent', 'archipelago', 'inland-sea', 'peninsulas', 'twin'] as const) {
      const { pkg, check } = buildProceduralMap({ ...DEFAULT_PARAMS, id: `gen-${shape}`, provinces: 60, realms: 4, shape, seed: 11 });
      expect(check.errors, shape).toEqual([]);
      expect(pkg.nations.length).toBe(4);
      expect(pkg.meta.origin).toBe('generated');
      if (shape === 'continent') playYear(pkg);
    }
  });

  it('the same parameters give the same map', () => {
    const P = { ...DEFAULT_PARAMS, id: 'gen-same', provinces: 60, realms: 4, seed: 4 };
    expect(mapChecksum(buildProceduralMap(P).pkg)).toBe(mapChecksum(buildProceduralMap(P).pkg));
  });
});
