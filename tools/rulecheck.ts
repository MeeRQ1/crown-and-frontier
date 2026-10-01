// Records (or compares) state checksums of fixed-seed AI-only campaigns, to
// prove that a refactor or optimisation did not change any rule: identical
// checksums mean identical games.
//
//   npm run rulecheck -- --record .scratch/rulecheck.json
//   npm run rulecheck -- --compare .scratch/rulecheck.json
//
// Optional: --map file.json adds a map package (e.g. the stress map).

import { readFileSync, writeFileSync } from 'node:fs';
import { parseMapPackage } from '../src/maps/validate';
import { createGame } from '../src/sim/game';
import { fnv1a } from '../src/sim/save';
import { step } from '../src/sim/tick';
import { registerMapScenario } from '../src/sim/world';

const args = process.argv.slice(2);
const get = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const record = get('record');
const compare = get('compare');
const runs: Array<{ scenario: string; seed: number; difficulty: 'easy' | 'normal' | 'hard'; years: number }> = [
  { scenario: 'reach', seed: 1, difficulty: 'normal', years: 15 },
  { scenario: 'reach', seed: 2, difficulty: 'hard', years: 15 },
  { scenario: 'reach', seed: 3, difficulty: 'easy', years: 15 },
  { scenario: 'aldmere', seed: 1, difficulty: 'normal', years: 10 },
  { scenario: 'aldmere', seed: 2, difficulty: 'hard', years: 10 },
];
const mapFile = get('map');
if (mapFile) {
  const { pkg } = parseMapPackage(readFileSync(mapFile, 'utf8'));
  if (!pkg) throw new Error('invalid map');
  registerMapScenario(pkg);
  runs.push({ scenario: pkg.id, seed: 1, difficulty: 'normal', years: 3 });
}
const out: Record<string, string[]> = {};
for (const r of runs) {
  const sim = createGame({ scenario: r.scenario, seed: r.seed, difficulty: r.difficulty, playerNation: null, campaignYears: r.years + 2 });
  const hashes: string[] = [];
  const t = performance.now();
  for (let w = 1; w <= r.years * 48; w++) {
    step(sim);
    // the revision counter only keys derived caches; it is not part of the game
    if (w % 48 === 0) hashes.push(fnv1a(JSON.stringify({ ...sim.state, rev: 0 })));
  }
  const key = `${r.scenario}/${r.seed}/${r.difficulty}/${r.years}y`;
  out[key] = hashes;
  console.log(`${key}: ${((performance.now() - t) / (r.years * 48)).toFixed(2)} ms/week, final ${hashes.at(-1)}`);
}
if (record) writeFileSync(record, JSON.stringify(out, null, 1));
if (compare) {
  const before = JSON.parse(readFileSync(compare, 'utf8')) as Record<string, string[]>;
  let bad = 0;
  for (const [k, hs] of Object.entries(out)) {
    const b = before[k];
    if (!b) {
      console.log(`${k}: no recorded run`);
      continue;
    }
    const firstDiff = hs.findIndex((h, i) => h !== b[i]);
    if (firstDiff >= 0) {
      bad++;
      console.log(`${k}: DIFFERS from year ${firstDiff + 1}`);
    } else console.log(`${k}: identical`);
  }
  process.exitCode = bad ? 1 : 0;
}
