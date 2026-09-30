// Replays a bug report exported from the Chronicle ledger and checks that the
// simulation reaches the same state.
//   npx tsx tools/replay.ts path/to/crown-and-frontier-bug-<seed>-<tick>.json
// Exit code 0 = reproduced exactly (checksum match), 1 = diverged.

import { readFileSync } from 'node:fs';
import { replayCommands } from '../src/sim/replay';

const path = process.argv[2];
if (!path) {
  console.error('usage: npx tsx tools/replay.ts <bug-report.json>');
  process.exit(2);
}
const report = JSON.parse(readFileSync(path, 'utf8'));
const r = replayCommands(report.settings, report.scenario, report.playerCommands, report.tick);
console.log(`Replayed ${report.playerCommands.length} player commands to tick ${report.tick} (${r.rejected} rejected on replay).`);
console.log(`checksum original ${report.stateChecksum} · replay ${r.checksum}`);
if (r.checksum === report.stateChecksum) console.log('Reproduced exactly.');
else {
  console.log('Diverged: the report may come from a game loaded from an imported save, or from a different build.');
  process.exitCode = 1;
}
