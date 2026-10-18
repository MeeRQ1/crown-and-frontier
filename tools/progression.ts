// How the AI's strength develops over a campaign, against a player who plays
// the same way (proxy: the player's realm is run by the AI, the same skill and
// rules) or does nothing (passive: a human who only watches). Every half year:
// each great power's land, income, industry, regiments and men, reserve, research
// and its wars, the share of the strongest realms, and who is at war with the
// player and why. Used to see when and why an AI realm runs away.
//   npx tsx tools/progression.ts [--scenario europe-1936] [--player ger] [--mode proxy|passive] [--years 8] [--seeds 1,2] [--difficulty normal] [--out file.json]

import { writeFileSync } from 'node:fs';
import { ensureLegacyMap, parseLegacyId } from '../src/maps/legacy';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { menOf, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Difficulty, NationId } from '../src/sim/types';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const SCEN = get('scenario', 'europe-1936');
const PLAYER = get('player', 'ger');
const MODE = get('mode', 'proxy');
const YEARS = Number(get('years', '8'));
const SEEDS = get('seeds', '1,2').split(',').map(Number);
const DIFF = get('difficulty', 'normal') as Difficulty;
const OUT = get('out', '');
// an earlier revision of a built-in map (`europe-r1`), for comparing revisions under the same rules
const legacy = parseLegacyId(SCEN);
if (legacy) await ensureLegacyMap(legacy[0], legacy[1]);

interface Row {
  nid: NationId;
  provinces: number;
  /** development held (comparable between revisions of a map; province counts are not) */
  dev: number;
  conquered: number;
  income: number;
  factories: number;
  regs: number;
  men: number;
  manpower: number;
  research: number;
  wars: number;
}

function snapshot(sim: Sim, nid: NationId, core: Set<string>): Row {
  const st = sim.state;
  const n = st.nations[nid];
  const own = sim.world.provIds.filter((p) => st.provinces[p].owner === nid);
  const arm = Object.values(st.armies).filter((a) => a.nation === nid);
  return {
    nid,
    provinces: own.length,
    dev: own.reduce((s, p) => s + st.provinces[p].dev, 0),
    conquered: own.filter((p) => !core.has(`${nid}|${p}`)).length,
    income: Math.round(Object.values(n.lastMonth?.income ?? {}).reduce((a, b) => a + b, 0)),
    factories: own.reduce((s, p) => s + (st.provinces[p].factories ?? 0), 0),
    regs: arm.reduce((s, a) => s + a.regiments.length, 0),
    men: Math.round(arm.reduce((s, a) => s + menOf(a), 0) / 1000),
    manpower: Math.round(n.manpower / 1000),
    research: n.research.done.length,
    wars: Object.values(st.wars).filter((w) => w.attackers.includes(nid) || w.defenders.includes(nid)).length,
  };
}

function main(): void {
  const all: unknown[] = [];
  for (const seed of SEEDS) {
    const sim = createGame({ scenario: SCEN, seed, playerNation: PLAYER, difficulty: DIFF });
    const st = sim.state;
    if (MODE === 'proxy') st.nations[PLAYER].isPlayer = false;
    const core = new Set(sim.world.provIds.map((p) => `${st.provinces[p].owner}|${p}`));
    // the great powers: the ten largest realms by land at the start, and the player
    const majors = Object.keys(st.nations)
      .filter((n) => st.nations[n].alive)
      .sort((a, b) => sim.world.provIds.filter((p) => st.provinces[p].owner === b).length - sim.world.provIds.filter((p) => st.provinces[p].owner === a).length)
      .slice(0, 10);
    if (!majors.includes(PLAYER)) majors.push(PLAYER);
    const samples: unknown[] = [];
    const warLog: string[] = [];
    const seenWars = new Set<string>();
    const fails: string[] = [];
    for (let w = 0; w <= YEARS * 52; w++) {
      if (w % 26 === 0) {
        const rows = majors.filter((n) => st.nations[n]).map((n) => snapshot(sim, n, core));
        const totalProv = sim.world.provIds.length;
        const top = [...rows].sort((a, b) => b.provinces - a.provinces);
        const totalDev = sim.world.provIds.reduce((s, p) => s + st.provinces[p].dev, 0);
        const byDev = [...rows].sort((a, b) => b.dev - a.dev);
        samples.push({ week: w, year: +(w / 52).toFixed(1), rows, top3Share: +(top.slice(0, 3).reduce((s, r) => s + r.provinces, 0) / totalProv).toFixed(3), totalDev, top3DevShare: +(byDev.slice(0, 3).reduce((s, r) => s + r.dev, 0) / totalDev).toFixed(3) });
      }
      for (const war of Object.values(st.wars)) {
        if (seenWars.has(war.id)) continue;
        seenWars.add(war.id);
        warLog.push(`wk ${st.tick}: ${war.name} (${war.attackers.join('+')} v ${war.defenders.join('+')}; ${war.goal.type})${war.attackers.includes(PLAYER) || war.defenders.includes(PLAYER) ? ' [player]' : ''}`);
      }
      if (w === YEARS * 52) break;
      step(sim);
      if (w % 52 === 51) {
        const bad = checkInvariants(sim);
        if (bad.length) fails.push(`week ${w}: ${bad.slice(0, 2).join('; ')}`);
      }
    }
    const res = { seed, scenario: SCEN, player: PLAYER, mode: MODE, difficulty: DIFF, samples, wars: warLog, coalitions: st.coalitions.map((c) => ({ target: c.target, members: c.members })), result: st.result, invariantFailures: fails };
    all.push(res);
    // a compact table: per realm, land and regiments at each sample
    console.log(`== seed ${seed} ${SCEN} player ${PLAYER} (${MODE}) ${DIFF}`);
    const first = samples[0] as { rows: Row[] };
    for (const r of first.rows) {
      const line = (samples as Array<{ rows: Row[] }>).map((s) => {
        const x = s.rows.find((y) => y.nid === r.nid);
        return x ? `${x.provinces}p/${x.regs}r/${x.income}c` : '-';
      });
      console.log(`${r.nid.padEnd(4)} ${line.join('  ')}`);
    }
    console.log(`top-3 land share: ${(samples as Array<{ top3Share: number }>).map((s) => s.top3Share).join(' ')}`);
    console.log(`wars: ${warLog.length}; with the player: ${warLog.filter((l) => l.includes('[player]')).length}`);
    for (const l of warLog.filter((x) => x.includes('[player]')).slice(0, 8)) console.log(`  ${l}`);
    console.log(`coalitions at the end: ${JSON.stringify(res.coalitions)}; result ${JSON.stringify(st.result)}`);
  }
  if (OUT) writeFileSync(OUT, `${JSON.stringify(all, null, 1)}\n`);
}

main();
