// Generates the built-in maps' sea zones and starting ports from their drawn
// coastlines (src/maps/seazones.ts) and writes them next to the map data:
//   src/data/<map>.seas.json    zones and ports (gameplay; ships with the game)
//   src/data/<map>.seamap.json  grid, anchors and borders (drawn; loaded with the map)
//   npm run genseas
// The output is deterministic and checked in.

import { writeFileSync } from 'node:fs';
import { BUILTIN_MAPS, builtinPackage } from '../src/maps/builtin';
import { generateSeaZones } from '../src/maps/seazones';

for (const id of BUILTIN_MAPS) {
  const pkg = await builtinPackage(id);
  const t0 = performance.now();
  const seas = generateSeaZones(pkg);
  const ms = performance.now() - t0;
  writeFileSync(`src/data/${id}.seas.json`, JSON.stringify({ zones: seas.zones, ports: seas.ports }, null, 1) + '\n');
  writeFileSync(`src/data/${id}.seamap.json`, JSON.stringify(seas.drawn) + '\n');
  const coasts = new Set(seas.zones.flatMap((z) => z.coasts));
  const straits = seas.zones.reduce((s, z) => s + (z.straits?.length ?? 0), 0);
  console.log(`${id}: ${seas.zones.length} sea zones, ${coasts.size} coastal provinces, ${Object.keys(seas.ports).length} ports, ${straits}/${pkg.straits.length} straits commanded, grid ${seas.drawn.grid.w}×${seas.drawn.grid.h}, ${ms.toFixed(0)} ms`);
  for (const z of seas.zones) console.log(`  ${z.id} ${z.name}: ${z.coasts.length} coasts, ${z.neighbors.length} neighbours${z.straits ? `, straits ${z.straits.map((s) => s.join('-')).join(' ')}` : ''}`);
}
