// What a campaign save turns into over some weeks: wars, armies, regiments,
// battles, fleets and wings, averaged over the weeks (to tell a heavier week
// that costs more from code that got slower).  npx tsx tools/workload-size.ts save.json [weeks]
import { readFileSync } from 'node:fs';
import '../src/maps/builtin';
import { readSave } from '../src/sim/save';
import { step } from '../src/sim/tick';
const [file, w = '48'] = process.argv.slice(2);
const { sim } = readSave(readFileSync(file, 'utf8'));
const st = sim.state;
const sum = { wars: 0, armies: 0, regiments: 0, battles: 0, fleets: 0, wings: 0, atWar: 0 };
const weeks = Number(w);
for (let i = 0; i < weeks; i++) {
  step(sim);
  sum.wars += Object.keys(st.wars).length;
  sum.armies += Object.keys(st.armies).length;
  for (const a of Object.values(st.armies)) sum.regiments += a.regiments.length;
  sum.battles += Object.keys(st.battles).length;
  sum.fleets += Object.keys(st.fleets).length;
  sum.wings += Object.keys(st.wings).length;
  const set = new Set<string>();
  for (const x of Object.values(st.wars)) for (const n of [...x.attackers, ...x.defenders]) set.add(n);
  sum.atWar += set.size;
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +(v / weeks).toFixed(1)]))));
