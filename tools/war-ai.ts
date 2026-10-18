// How the AI conducts a war: equivalent starting situations over several seeds,
// measured week by week with the real simulation (every realm AI-run).
//   npx tsx tools/war-ai.ts [--weeks 40] [--seeds 1,2,3,4] [--out reports/qol/war-ai-before.json]
//
// Scenarios: Europe 1936 with Germany and Italy at war with Poland, Romania and
// France; Aldmere with its two strongest neighbours at war. Per seed:
//  - attacks: land battles an AI side started; lost: the ones it lost; repeated:
//    a lost attack on a province it had already lost an attack on in the last 8 weeks
//  - idle: share of army-weeks a fit army of a realm at war stood still away from any
//    front (not marching, fighting or besieging, and no enemy within two provinces)
//  - churn: objective changes per army-month while the old objective was still unfinished
//  - provinces taken and lost, men lost on each side, planning time per week

import { writeFileSync } from 'node:fs';
import { removeTreaty } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/game';
import { maxMorale } from '../src/sim/military';
import { atWar, enemiesOf, type Sim } from '../src/sim/state';
import { step, type PhaseProfile } from '../src/sim/tick';
import type { NationId, ProvinceId } from '../src/sim/types';
import { breakTies, declareWar, joinWar } from '../src/sim/war';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const WEEKS = Number(get('weeks', '40'));
const SEEDS = get('seeds', '1,2,3,4').split(',').map(Number);
const OUT = get('out', 'reports/qol/war-ai.json');

interface Setup {
  name: string;
  build: (seed: number) => { sim: Sim; sides: [NationId[], NationId[]] };
}

function forceWar(sim: Sim, att: NationId[], def: NationId[]): void {
  for (const a of att) for (const b of def) {
    breakTies(sim, a, b);
    for (const t of ['nap', 'trade', 'alliance'] as const) removeTreaty(sim, t, a, b);
  }
  const target = sim.world.provIds.filter((p) => sim.state.provinces[p].owner === def[0] && sim.world.prov[p].neighbors.some((n) => sim.state.provinces[n].owner === att[0])).slice(0, 3);
  const w = declareWar(sim, att[0], def[0], { type: 'conquest', provinces: target });
  for (const a of att.slice(1)) if (!w.attackers.includes(a)) joinWar(sim, w, a, 'attacker');
  for (const d of def.slice(1)) if (!w.defenders.includes(d)) joinWar(sim, w, d, 'defender');
}

const SETUPS: Setup[] = [
  {
    name: 'Europe 1936: Germany and Italy against Poland, Romania and France',
    build: (seed) => {
      const sim = createGame({ scenario: 'europe-1936', seed, playerNation: null });
      forceWar(sim, ['ger', 'ita'], ['pol', 'rom', 'fra']);
      return { sim, sides: [['ger', 'ita'], ['pol', 'rom', 'fra']] };
    },
  },
  {
    name: 'Aldmere: the two strongest neighbours at war',
    build: (seed) => {
      const sim = createGame({ scenario: 'aldmere', seed, playerNation: null });
      const st = sim.state;
      const str = (n: NationId) => Object.values(st.armies).filter((a) => a.nation === n).reduce((s, a) => s + a.regiments.length, 0);
      const ids = Object.keys(st.nations).sort((a, b) => str(b) - str(a) || (a < b ? -1 : 1));
      const a = ids[0];
      const nb = new Set(sim.world.provIds.filter((p) => st.provinces[p].owner === a).flatMap((p) => sim.world.prov[p].neighbors.map((n) => st.provinces[n].owner)));
      const b = ids.find((x) => x !== a && nb.has(x))!;
      forceWar(sim, [a], [b]);
      return { sim, sides: [[a], [b]] };
    },
  },
];

interface SeedResult {
  seed: number;
  attacks: number;
  lost: number;
  repeated: number;
  idleShare: number;
  churnPerArmyMonth: number;
  taken: Record<string, number>;
  menLost: Record<string, number>;
  planMsPerWeek: number;
}

function runSeed(setup: Setup, seed: number): SeedResult {
  const { sim, sides } = setup.build(seed);
  const st = sim.state;
  const all = [...sides[0], ...sides[1]];
  const side = (n: NationId) => (sides[0].includes(n) ? 0 : sides[1].includes(n) ? 1 : -1);
  const seen = new Set(st.reports.map((r) => r.id));
  const lostAt = new Map<string, number[]>();
  let attacks = 0;
  let lost = 0;
  let repeated = 0;
  let idle = 0;
  let armyWeeks = 0;
  let churn = 0;
  const startCtrl = new Map(sim.world.provIds.map((p) => [p, st.provinces[p].controller]));
  const men0 = Object.fromEntries(all.map((n) => [n, st.nations[n].stats.menLost]));
  const prof: PhaseProfile = { now: () => performance.now(), last: {} };
  let planMs = 0;
  let prevObj: Record<string, Record<string, ProvinceId>> = {};
  for (let w = 0; w < WEEKS; w++) {
    step(sim, { profile: prof });
    planMs += prof.last.ai ?? 0;
    for (const r of st.reports) {
      if (seen.has(r.id) || r.sea) continue;
      seen.add(r.id);
      const s = side(r.attackerNations[0]);
      if (s < 0) continue;
      attacks++;
      if (r.winner === 'defender') {
        lost++;
        const k = `${s}|${r.province}`;
        const prev = (lostAt.get(k) ?? []).filter((t) => r.tick - t <= 8);
        if (prev.length) repeated++;
        prev.push(r.tick);
        lostAt.set(k, prev);
      }
    }
    // idle fit armies away from any front
    for (const n of all) {
      // only while the realm is at war: armies at rest after a peace are not idle
      if (!st.nations[n].alive || !enemiesOf(sim, n).length) continue;
      const mm = maxMorale(sim, n);
      for (const a of Object.values(st.armies)) {
        if (a.nation !== n || a.embarked) continue;
        const fit = a.morale >= mm * 0.6 && a.regiments.reduce((s, r) => s + r.men, 0) >= a.regiments.length * 600;
        if (!fit) continue;
        armyWeeks++;
        if (a.path.length || a.battle || a.retreating) continue;
        const ctrl = st.provinces[a.location].controller;
        if (ctrl && atWar(sim, n, ctrl)) continue;
        const near = (p: ProvinceId, d: number): boolean => {
          if (Object.values(st.armies).some((x) => x.location === p && atWar(sim, n, x.nation))) return true;
          const c = st.provinces[p].controller;
          if (c && atWar(sim, n, c)) return true;
          return d > 0 && sim.world.prov[p].neighbors.some((q) => near(q, d - 1));
        };
        if (!near(a.location, 2)) idle++;
      }
    }
    // objective churn: a new objective while the old one is still in enemy hands
    const cur: Record<string, Record<string, ProvinceId>> = {};
    for (const n of all) {
      cur[n] = {};
      for (const [aid, o] of Object.entries(st.nations[n].ai.objectives)) {
        cur[n][aid] = o.target;
        const before = prevObj[n]?.[aid];
        if (before && before !== o.target) {
          const c = st.provinces[before].controller;
          if (c && atWar(sim, n, c)) churn++;
        }
      }
    }
    prevObj = cur;
  }
  const taken: Record<string, number> = {};
  for (const p of sim.world.provIds) {
    const a = startCtrl.get(p);
    const b = st.provinces[p].controller;
    if (a === b || !b || !a) continue;
    if (side(b) >= 0 && side(a) >= 0 && side(a) !== side(b)) taken[`side${side(b)}`] = (taken[`side${side(b)}`] ?? 0) + 1;
  }
  const menLost: Record<string, number> = {};
  for (const n of all) menLost[`side${side(n)}`] = (menLost[`side${side(n)}`] ?? 0) + st.nations[n].stats.menLost - men0[n];
  const armies = Math.max(1, armyWeeks / WEEKS);
  return {
    seed,
    attacks,
    lost,
    repeated,
    idleShare: +(idle / Math.max(1, armyWeeks)).toFixed(3),
    churnPerArmyMonth: +(churn / armies / (WEEKS / 4)).toFixed(3),
    taken,
    menLost,
    planMsPerWeek: +(planMs / WEEKS).toFixed(1),
  };
}

const out: Array<{ setup: string; seeds: SeedResult[] }> = [];
for (const s of SETUPS) {
  const seeds = SEEDS.map((seed) => runSeed(s, seed));
  out.push({ setup: s.name, seeds });
  console.log(s.name);
  for (const r of seeds) console.log(JSON.stringify(r));
}
writeFileSync(OUT, `${JSON.stringify({ weeks: WEEKS, seeds: SEEDS, results: out }, null, 1)}\n`);
