// Generates the built-in fictional maps made with the procedural generator
// (src/maps/gen/procedural.ts) and writes them as checked-in data, so every
// browser loads exactly the same map:
//   npm run genmaps [-- --map isles]
//     src/data/maps/<id>.scenario.json   gameplay half (realms, provinces, sea zones…)
//     src/data/maps/<id>.map.json        drawn half (loaded when the map is shown)
//     reports/maps/<id>-map.md, reports/maps/<id>-preview.svg
// The parameters below are the whole recipe; the output is deterministic.

import { mkdirSync, writeFileSync } from 'node:fs';
import type { MapScenarioPart } from '../src/maps/format';
import { previewSvg } from '../src/maps/gen/core';
import { buildProceduralMap, DEFAULT_PARAMS, type ProceduralParams } from '../src/maps/gen/procedural';
import { worldReport } from '../src/maps/gen/world';

export const GENERATED_MAPS: ProceduralParams[] = [
  {
    ...DEFAULT_PARAMS,
    id: 'isles',
    name: 'The Sundered Isles',
    seed: 3,
    provinces: 110,
    realms: 8,
    shape: 'archipelago',
    climate: 'temperate',
    mountains: 0.4,
    rivers: 0.3,
    lakes: 0.2,
    frontier: 0.1,
    startYear: 1885,
    cultures: ['norse', 'highland', 'lowland', 'southern', 'classical', 'heartland'],
    meta: {
      description: 'Eight crowns scattered across an archipelago, with an unclaimed heart island between them. For most of them the sea is the only road.',
      blurb: 'A small naval campaign: about 115 provinces and eight realms, most on islands of their own.',
      difficulty: 'standard',
      style: 'Naval war among islands',
      origin: 'builtin',
    },
  },
  {
    ...DEFAULT_PARAMS,
    id: 'steppe',
    name: 'The Kharan Steppe',
    seed: 3,
    provinces: 260,
    realms: 11,
    shape: 'continent',
    climate: 'arid',
    mountains: 0.35,
    rivers: 0.9,
    lakes: 0.3,
    frontier: 0.2,
    startYear: 1880,
    cultures: ['steppe', 'eastern', 'classical', 'southern', 'woodland'],
    meta: {
      description: 'Eleven realms on a dry continent of open grassland and long rivers, where armies march far and fast and fronts rarely hold.',
      blurb: 'An open campaign: about 260 provinces, wide steppe, many river lines and few coasts.',
      difficulty: 'standard',
      style: 'War of movement across open grassland',
      origin: 'builtin',
    },
  },
  {
    ...DEFAULT_PARAMS,
    id: 'midsea',
    name: 'The Middle Sea',
    seed: 1,
    provinces: 520,
    realms: 16,
    shape: 'inland-sea',
    climate: 'temperate',
    mountains: 0.7,
    rivers: 0.6,
    lakes: 0.4,
    frontier: 0.08,
    startYear: 1875,
    meta: {
      description: 'Sixteen realms around an inland sea that opens to the ocean through one channel. Every realm has neighbours by land and rivals across the water.',
      blurb: 'The grand campaign: about 550 provinces and sixteen realms around one sea.',
      difficulty: 'hard',
      style: 'Grand alliances around an inland sea',
      origin: 'builtin',
    },
  },
];

const isMain = process.argv[1]?.endsWith('genmaps.ts');
if (isMain) {
  const i = process.argv.indexOf('--map');
  const only = i >= 0 ? process.argv[i + 1] : null;
  mkdirSync(new URL('../src/data/maps/', import.meta.url), { recursive: true });
  mkdirSync(new URL('../reports/maps/', import.meta.url), { recursive: true });
  for (const params of GENERATED_MAPS) {
    if (only && params.id !== only) continue;
    const t0 = performance.now();
    const r = buildProceduralMap(params);
    const { geometry, ...scenario } = r.pkg;
    const part: MapScenarioPart & { generated: string } = { generated: `tools/genmaps.ts (${params.id}) — do not edit by hand`, ...scenario };
    writeFileSync(new URL(`../src/data/maps/${params.id}.scenario.json`, import.meta.url), JSON.stringify(part));
    writeFileSync(new URL(`../src/data/maps/${params.id}.map.json`, import.meta.url), JSON.stringify(geometry));
    const own = new Map(r.pkg.provinces.map((p) => [p.id, p.owner]));
    const col = new Map(r.pkg.nations.map((n) => [n.id, n.color]));
    const nm = new Map(r.pkg.provinces.map((p) => [p.id, p.name]));
    writeFileSync(
      new URL(`../reports/maps/${params.id}-preview.svg`, import.meta.url),
      previewSvg(r.world.geometry.bounds, { ...r.world.geometry, provinces: r.world.polys } as unknown as Parameters<typeof previewSvg>[1], r.pkg.straits, (id) => own.get(id) ?? null, (n) => col.get(n)!, (id) => nm.get(id)!, 1),
    );
    const report = worldReport(r.pkg.meta.name, `npm run genmaps -- --map ${params.id}`, r.spec, r.world);
    writeFileSync(new URL(`../reports/maps/${params.id}-map.md`, import.meta.url), report + `\n- Sea zones: ${r.pkg.seaZones.length}; ports: ${r.pkg.provinces.filter((p) => p.port).length}\n- Generator attempts: ${r.attempts}\n`);
    console.log(`${params.id}: ${r.pkg.provinces.length} provinces, ${r.pkg.nations.length} realms, ${r.pkg.seaZones.length} sea zones, ${Math.round(performance.now() - t0)} ms${r.world.warnings.length ? `; warnings: ${r.world.warnings.join('; ')}` : ''}`);
  }
}
