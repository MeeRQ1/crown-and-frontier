// Replays a bug report exported from the Chronicle ledger and checks that the
// simulation reaches the same state.
//   npx tsx tools/replay.ts path/to/crown-and-frontier-bug-<seed>-<tick>.json
// Exit code 0 = reproduced exactly (checksum match), 1 = diverged, 2 = unusable file.

import { readFileSync } from 'node:fs';
import { replayBundle } from '../src/sim/diagnostics';

const path = process.argv[2];
if (!path) {
  console.error('usage: npx tsx tools/replay.ts <bug-report.json>');
  process.exit(2);
}
let r;
try {
  r = replayBundle(JSON.parse(readFileSync(path, 'utf8')));
} catch (e) {
  console.error((e as Error).message);
  process.exit(2);
}
console.log(`Replayed ${r.commands} player commands from a ${r.from} to tick ${r.sim.state.tick} (${r.rejected} rejected on replay).`);
console.log(`checksum original ${r.expected} · replay ${r.checksum}`);
if (r.reproduced) console.log('Reproduced exactly.');
else {
  console.log('Diverged: the report may come from a different build of the game.');
  process.exitCode = 1;
}
