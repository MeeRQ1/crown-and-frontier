// Headless AI-only campaigns through the real simulation.
//   npm run sim -- --seeds 1-10 --difficulty normal --years 40 [--scenario aldmere|reach] [--out reports/ai-campaigns.md] [--json path]
//   npm run sim -- --merge a.json,b.json --out report.md   (combine runs made in parallel)
// Every run records its seed and settings so any failure can be reproduced.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { ownedProvinces } from '../src/sim/state';
import { isOver, step } from '../src/sim/tick';
import type { Difficulty } from '../src/sim/types';
import { campaignScore, victoryProgress } from '../src/sim/victory';

interface Args {
  seeds: number[];
  difficulties: Difficulty[];
  years: number;
  out?: string;
  json?: string;
  quiet: boolean;
  scenario: string;
  merge?: string[];
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const seedsArg = get('seeds') ?? '1-3';
  const seeds: number[] = [];
  for (const part of seedsArg.split(',')) {
    const [lo, hi] = part.split('-').map(Number);
    for (let s = lo; s <= (hi ?? lo); s++) seeds.push(s);
  }
  const d = get('difficulty') ?? 'normal';
  const difficulties = (d === 'all' ? ['easy', 'normal', 'hard'] : d.split(',')) as Difficulty[];
  return { seeds, difficulties, years: Number(get('years') ?? 40), out: get('out'), json: get('json'), quiet: a.includes('--quiet'), scenario: get('scenario') ?? 'reach', merge: get('merge')?.split(',') };
}

interface RunResult {
  scenario?: string;
  seed: number;
  difficulty: Difficulty;
  years: number;
  ticks: number;
  winner: string | null;
  path: string | null;
  endYear: number;
  invariantFailures: string[];
  msPerTickAvg: number;
  msPerTickMax: number;
  wars: number;
  warMonthsAvg: number;
  peaces: number;
  forcedPeaces: number;
  coalitions: number;
  coalitionWars: number;
  battles: number;
  eliminations: string[];
  nations: Record<string, { startProv: number; endProv: number; peakProv: number; alive: boolean; score: number; wars: number; battlesWon: number; battlesLost: number; bankruptcies: number; idleShare: number; techs: number; maxStreak: string }>;
  heapMB: number;
  snapshots: Array<{ year: number; techsAvg: number; treasuryMax: number; best: Record<string, string> }>;
}

function runOne(seed: number, difficulty: Difficulty, years: number, scenario: string): RunResult {
  const sim = createGame({ seed, difficulty, playerNation: null, campaignYears: years, scenario });
  const st = sim.state;
  const start: Record<string, number> = {};
  for (const n of sim.world.nationIds) start[n] = ownedProvinces(sim, n).length;
  const warStart = new Map<string, number>();
  const warLengths: number[] = [];
  let forced = 0;
  let coalitions = 0;
  let coalitionWars = 0;
  const invariantFailures: string[] = [];
  let tMax = 0;
  const t0 = performance.now();
  let ticks = 0;
  let seenNotes = 0;
  const snapshots: RunResult['snapshots'] = [];
  while (!isOver(sim) && ticks < years * 48 + 4) {
    const a = performance.now();
    step(sim);
    const dt = performance.now() - a;
    tMax = Math.max(tMax, dt);
    ticks++;
    for (const id in st.wars) if (!warStart.has(id)) warStart.set(id, st.tick);
    for (const [id, t] of warStart) {
      if (!st.wars[id] && t >= 0) {
        warLengths.push((st.tick - t) / 4);
        warStart.set(id, -1);
      }
    }
    for (const note of st.notifications) {
      if (note.id <= seenNotes) continue;
      if (note.kind === 'peace' && /forces a white peace/.test(note.text) && note.nation) forced++;
      if (note.kind === 'coalition' && note.priority === 'urgent') coalitions++;
      if (note.kind === 'war' && note.nation === null && /Coalition War/.test(note.text)) coalitionWars++;
    }
    seenNotes = st.notifications.length ? st.notifications[st.notifications.length - 1].id : seenNotes;
    if (st.tick % 480 === 0) {
      const best: Record<string, string> = {};
      for (const path of ['territorial', 'economic', 'diplomatic'] as const) {
        let bn = '';
        let bp = -1;
        for (const nid of sim.world.nationIds) {
          if (!st.nations[nid].alive) continue;
          const p = victoryProgress(sim, nid)[path];
          const v = p.progress + p.streak / p.required;
          if (v > bp) {
            bp = v;
            bn = `${nid} ${Math.round(p.progress * 100)}% t${p.streak}`;
          }
        }
        best[path] = bn;
      }
      snapshots.push({
        year: st.tick / 48,
        techsAvg: sim.world.nationIds.reduce((s, n) => s + st.nations[n].research.done.length, 0) / sim.world.nationIds.length,
        treasuryMax: Math.max(...sim.world.nationIds.map((n) => st.nations[n].treasury)),
        best,
      });
    }
    if (ticks % 12 === 0 && invariantFailures.length < 5) {
      const bad = checkInvariants(sim);
      if (bad.length) invariantFailures.push(`tick ${st.tick}: ${bad.slice(0, 3).join('; ')}`);
    }
  }
  const total = performance.now() - t0;
  const nations: RunResult['nations'] = {};
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    const vp = victoryProgress(sim, nid);
    nations[nid] = {
      startProv: start[nid],
      endProv: ownedProvinces(sim, nid).length,
      peakProv: n.stats.peakProvinces,
      alive: n.alive,
      score: campaignScore(sim, nid),
      wars: n.stats.warsDeclared,
      battlesWon: n.stats.battlesWon,
      battlesLost: n.stats.battlesLost,
      bankruptcies: n.stats.bankruptcies,
      idleShare: n.stats.armyWeeks ? n.stats.idleArmyWeeks / n.stats.armyWeeks : 0,
      techs: n.research.done.length,
      maxStreak: `T${vp.territorial.streak} E${vp.economic.streak} D${vp.diplomatic.streak}`,
    };
  }
  let battles = 0;
  for (const nid in st.nations) battles += st.nations[nid].stats.battlesWon;
  return {
    scenario,
    seed,
    difficulty,
    years,
    ticks,
    winner: st.result?.winner ?? null,
    path: st.result?.path ?? null,
    endYear: sim.world.scenario.startYear + st.tick / 48,
    invariantFailures,
    msPerTickAvg: total / Math.max(1, ticks),
    msPerTickMax: tMax,
    wars: warStart.size,
    warMonthsAvg: warLengths.length ? warLengths.reduce((a, b) => a + b, 0) / warLengths.length : 0,
    peaces: Object.values(st.nations).reduce((s, n) => s + n.stats.peacesMade, 0) / 2,
    forcedPeaces: forced,
    coalitions,
    coalitionWars,
    battles,
    eliminations: sim.world.nationIds.filter((n) => !st.nations[n].alive),
    nations,
    heapMB: process.memoryUsage().heapUsed / 1e6,
    snapshots,
  };
}

const args = parseArgs();
const results: RunResult[] = [];
if (args.merge) for (const f of args.merge) results.push(...(JSON.parse(readFileSync(f, 'utf8')) as RunResult[]));
for (const difficulty of args.merge ? [] : args.difficulties) {
  for (const seed of args.seeds) {
    const r = runOne(seed, difficulty, args.years, args.scenario);
    results.push(r);
    if (!args.quiet) {
      const prov = Object.entries(r.nations)
        .map(([k, v]) => `${k}:${v.startProv}→${v.endProv}${v.alive ? '' : '✝'}`)
        .join(' ');
      console.log(
        r.snapshots.map((x) => `   y${x.year}: techs ${x.techsAvg.toFixed(1)} maxTreasury ${Math.round(x.treasuryMax)} T[${x.best.territorial}] E[${x.best.economic}] D[${x.best.diplomatic}]`).join('\n') + '\n' +
        `seed ${seed} ${difficulty}: ${r.winner ? `${r.winner} wins (${r.path})` : 'no winner'} in ${r.endYear.toFixed(1)} | wars ${r.wars} (avg ${r.warMonthsAvg.toFixed(0)} mo, forced ${r.forcedPeaces}) battles ${r.battles} | ${r.msPerTickAvg.toFixed(2)} ms/tick (max ${r.msPerTickMax.toFixed(0)}) | ${prov}${r.invariantFailures.length ? ` | INVARIANT: ${r.invariantFailures[0]}` : ''}`,
      );
    }
  }
}

// Aggregate summary.
const wins: Record<string, number> = {};
const paths: Record<string, number> = {};
for (const r of results) {
  wins[r.winner ?? 'none'] = (wins[r.winner ?? 'none'] ?? 0) + 1;
  paths[r.path ?? 'none'] = (paths[r.path ?? 'none'] ?? 0) + 1;
}
const lines: string[] = [];
lines.push(`# AI-only campaign report`);
lines.push('');
const seeds = [...new Set(results.map((r) => r.seed))].sort((a, b) => a - b);
const diffs = [...new Set(results.map((r) => r.difficulty))];
lines.push(`Map: ${results[0]?.scenario ?? args.scenario}. Runs: ${results.length} (seeds ${seeds[0]}–${seeds[seeds.length - 1]}, difficulties ${diffs.join(', ')}, ${results[0]?.years ?? args.years}-year limit). Node ${process.version}.`);
lines.push('');
lines.push(`Winners: ${Object.entries(wins).map(([k, v]) => `${k} ${v}`).join(', ')}`);
lines.push(`Victory paths: ${Object.entries(paths).map(([k, v]) => `${k} ${v}`).join(', ')}`);
const avg = (f: (r: RunResult) => number) => results.reduce((s, r) => s + f(r), 0) / Math.max(1, results.length);
lines.push(`Average campaign length: ${avg((r) => r.endYear - 1640).toFixed(1)} years; wars per campaign ${avg((r) => r.wars).toFixed(1)}; average war ${avg((r) => r.warMonthsAvg).toFixed(1)} months; peace treaties ${avg((r) => r.peaces).toFixed(1)}; forced peaces ${avg((r) => r.forcedPeaces).toFixed(1)}; battles ${avg((r) => r.battles).toFixed(0)}.`);
lines.push(`Coalitions formed per campaign: ${avg((r) => r.coalitions).toFixed(1)}; coalition wars: ${avg((r) => r.coalitionWars).toFixed(1)}.`);
lines.push(`Eliminations per campaign: ${avg((r) => r.eliminations.length).toFixed(2)}; bankruptcies per campaign: ${avg((r) => Object.values(r.nations).reduce((s, n) => s + n.bankruptcies, 0)).toFixed(2)}.`);
lines.push(`Performance: ${avg((r) => r.msPerTickAvg).toFixed(2)} ms/tick average, ${Math.max(...results.map((r) => r.msPerTickMax)).toFixed(0)} ms worst tick, heap ≈ ${Math.max(...results.map((r) => r.heapMB)).toFixed(0)} MB.`);
const inv = results.filter((r) => r.invariantFailures.length);
lines.push(`Invariant failures: ${inv.length ? inv.map((r) => `seed ${r.seed}/${r.difficulty}: ${r.invariantFailures[0]}`).join(' | ') : 'none'}`);
lines.push('');
lines.push('| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |');
lines.push('|---|---|---|---|---|---|---|---|');
const nids = Object.keys(results[0]?.nations ?? {});
for (const nid of nids) {
  const rs = results.map((r) => r.nations[nid]);
  const a = (f: (x: (typeof rs)[number]) => number) => rs.reduce((s, x) => s + f(x), 0) / rs.length;
  lines.push(
    `| ${nid} | ${wins[nid] ?? 0} | ${a((x) => x.startProv).toFixed(0)}→${a((x) => x.endProv).toFixed(1)} | ${Math.round(a((x) => (x.alive ? 100 : 0)))}% | ${a((x) => x.wars).toFixed(1)} | ${a((x) => x.battlesWon).toFixed(1)}/${a((x) => x.battlesLost).toFixed(1)} | ${Math.round(a((x) => x.idleShare) * 100)}% | ${a((x) => x.techs).toFixed(1)} |`,
  );
}
lines.push('');
lines.push('| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |');
lines.push('|---|---|---|---|---|---|---|');
for (const r of results) lines.push(`| ${r.seed} | ${r.difficulty} | ${r.winner ? `${r.winner} (${r.path})` : '—'} | ${r.endYear.toFixed(1)} | ${r.wars} | ${r.battles} | ${r.eliminations.join(', ') || '—'} |`);
const report = lines.join('\n');
console.log('\n' + report);
if (args.out) {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, report + '\n');
}
if (args.json) {
  mkdirSync(dirname(args.json), { recursive: true });
  writeFileSync(args.json, JSON.stringify(results, null, 1));
}
if (inv.length) process.exitCode = 1;
