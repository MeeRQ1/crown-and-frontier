// Builds the real-world campaign maps from Natural Earth (tools/realmap.ts):
//   npm run genreal -- --map europe   (or earth)
//     src/data/maps/<id>.scenario.json, <id>.map.json, reports/maps/<id>-map.md, <id>-preview.svg

import { earthDef } from './earth.data';
import { europeDef } from './europe.data';
import { buildRealMap, writeRealMap, type RealMapDef } from './realmap';

export const REAL_MAPS: Record<string, () => RealMapDef> = { europe: europeDef, earth: earthDef };

const isMain = process.argv[1]?.endsWith('genreal.ts');
if (isMain) {
  const i = process.argv.indexOf('--map');
  const only = i >= 0 ? process.argv[i + 1] : null;
  for (const [id, def] of Object.entries(REAL_MAPS)) {
    if (only && id !== only) continue;
    const t0 = performance.now();
    const r = buildRealMap(def(), (l) => console.log(l));
    writeRealMap(r);
    console.log(`${id}: ${r.pkg.provinces.length} provinces, ${r.pkg.nations.length} realms, ${r.pkg.regions.length} regions, ${r.pkg.seaZones.length} sea zones in ${Math.round(performance.now() - t0)} ms`);
    console.log(r.world.warnings.length ? `warnings: ${r.world.warnings.join('; ')}` : 'no warnings');
  }
}
