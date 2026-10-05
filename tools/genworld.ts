// Generates Aldmere, the standard campaign map, from the authored geography in
// tools/aldmere.spec.ts, through the shared world generator (src/maps/gen/world.ts).
//   npm run genworld  -> src/data/aldmere.provinces.json (simulation data)
//                        src/data/aldmere.map.json       (drawn geometry)
//                        reports/aldmere-preview.svg, reports/aldmere-map.md
// Everything is deterministic; the output is checked in.

import { mkdirSync, writeFileSync } from 'node:fs';
import { ALDMERE_LABELS, ALDMERE_NATIONS, ALDMERE_REGIONS } from '../src/data/aldmere';
import { generateWorld, worldReport, type WorldSpec } from '../src/maps/gen/world';
import * as S from './aldmere.spec';
import { previewSvg } from './mapgen/core';

export function aldmereSpec(): WorldSpec {
  return {
    id: 'aldmere',
    scale: S.SCALE,
    bounds: S.BOUNDS,
    mainland: S.MAINLAND,
    islands: S.ISLANDS,
    lakes: S.LAKES,
    ranges: S.RANGES,
    rivers: S.RIVERS,
    fixed: S.FIXED,
    regions: S.REGIONS,
    regionDefs: ALDMERE_REGIONS,
    nations: ALDMERE_NATIONS,
    labels: ALDMERE_LABELS,
    names: S.NAMES,
  };
}

const isMain = process.argv[1]?.endsWith('genworld.ts');
if (isMain) {
  const spec = aldmereSpec();
  const r = generateWorld(spec, (l) => console.log(l));
  const generated = 'tools/genworld.ts from tools/aldmere.spec.ts — do not edit by hand';
  writeFileSync(new URL('../src/data/aldmere.provinces.json', import.meta.url), JSON.stringify({ generated, provinces: r.provinces, straits: r.straits, rivers: r.rivers }));
  writeFileSync(new URL('../src/data/aldmere.map.json', import.meta.url), JSON.stringify({ generated, ...r.geometry }));
  mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
  const colors = new Map(ALDMERE_NATIONS.map((n) => [n.id, n.color]));
  const own = new Map(r.provinces.map((p) => [p.id, p.owner]));
  const nm = new Map(r.provinces.map((p) => [p.id, p.name]));
  writeFileSync(
    new URL('../reports/aldmere-preview.svg', import.meta.url),
    previewSvg(r.geometry.bounds, { ...r.geometry, provinces: r.polys } as unknown as Parameters<typeof previewSvg>[1], r.straits, (id) => own.get(id) ?? null, (n) => colors.get(n)!, (id) => nm.get(id)!, 2),
  );
  const report = worldReport('Aldmere', 'npm run genworld', spec, r, 'the Reach: 99');
  writeFileSync(new URL('../reports/aldmere-map.md', import.meta.url), report);
  console.log(report.split('\n').slice(4, 10).join('\n'));
  console.log(r.warnings.length ? 'WARNINGS:\n  ' + r.warnings.join('\n  ') : 'no warnings');
}
