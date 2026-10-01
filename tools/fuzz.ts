// Fuzzes the simulation through the real command boundary: a random "player"
// issues random legal and illegal commands every week while the AI runs every
// other realm. After every week it checks the state invariants and a few
// accounting rules; it also checks that rejected commands leave the state
// untouched, that two identical runs stay identical, and that a game saved and
// loaded mid-run continues exactly like the original.
//
//   npx tsx tools/fuzz.ts [--scenario reach|aldmere] [--seeds 1-5] [--years 10] [--player cal]
//
// Exit code 1 if any check fails. Findings are printed with the seed and tick
// so they can be reproduced.

import { applyCommand, checkCommand } from '../src/sim/commands';
import { poolCap } from '../src/sim/economy';
import { TECH_LIST } from '../src/sim/data/techs';
import { POLICY_LIST } from '../src/sim/data/policies';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { goalOptions } from '../src/sim/war';
import { deserialize, fnv1a, serialize } from '../src/sim/save';
import { nextFloat, seedState } from '../src/sim/rng';
import { armiesOf, ownedProvinces, warsOf, type Sim } from '../src/sim/state';
import { isOver, step } from '../src/sim/tick';
import type { Command, NationId, ProjectKind, TreatyType, UnitType } from '../src/sim/types';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const scenario = get('scenario', 'reach');
const [s0, s1] = get('seeds', '1-3').split('-').map(Number);
const years = Number(get('years', '10'));
const playerArg = get('player', '');

type Rng = number[];
const pick = <T>(r: Rng, xs: readonly T[]): T | undefined => (xs.length ? xs[Math.floor(nextFloat(r) * xs.length)] : undefined);

function randomCommand(sim: Sim, nid: NationId, r: Rng): Command | null {
  const st = sim.state;
  const owned = ownedProvinces(sim, nid);
  const armies = armiesOf(sim, nid);
  const others = sim.world.nationIds.filter((x) => x !== nid);
  const anyProv = () => pick(r, sim.world.provIds)!;
  const kind = Math.floor(nextFloat(r) * 24);
  switch (kind) {
    case 0:
    case 1:
      return { type: 'recruit', nation: nid, province: pick(r, owned) ?? anyProv(), unit: pick(r, ['foot', 'horse', 'guns'] as UnitType[])!, count: 1 + Math.floor(nextFloat(r) * 3) };
    case 2:
      return { type: 'cancelRecruit', nation: nid, province: pick(r, owned) ?? anyProv() };
    case 3:
    case 4:
    case 5: {
      const a = pick(r, armies);
      if (!a) return null;
      // mostly nearby destinations, sometimes anywhere
      const near = sim.world.provIds.filter((p) => (sim.world.hop(a.location, p) ?? 99) <= 4);
      return { type: 'move', nation: nid, army: a.id, dest: (nextFloat(r) < 0.8 ? pick(r, near) : anyProv())!, append: nextFloat(r) < 0.2 };
    }
    case 6: {
      const a = pick(r, armies);
      return a ? { type: 'stop', nation: nid, army: a.id } : null;
    }
    case 7: {
      const a = pick(r, armies);
      if (!a) return null;
      return nextFloat(r) < 0.5
        ? { type: 'setGroup', nation: nid, army: a.id, group: nextFloat(r) < 0.2 ? null : 1 + Math.floor(nextFloat(r) * 9) }
        : { type: 'setOrder', nation: nid, army: a.id, order: nextFloat(r) < 0.3 ? null : { kind: 'station', province: (pick(r, owned) ?? anyProv()) } };
    }
    case 8: {
      const a = pick(r, armies);
      if (!a) return null;
      return { type: 'split', nation: nid, army: a.id, counts: { foot: Math.floor(nextFloat(r) * 3), horse: Math.floor(nextFloat(r) * 2), guns: Math.floor(nextFloat(r) * 2) } };
    }
    case 9: {
      const a = pick(r, armies);
      if (!a) return null;
      const same = armies.filter((b) => b.location === a.location).map((b) => b.id);
      return { type: 'merge', nation: nid, armies: same };
    }
    case 10: {
      if (nextFloat(r) > 0.15) return null;
      const a = pick(r, armies);
      return a ? { type: 'disband', nation: nid, army: a.id } : null;
    }
    case 11:
    case 12: {
      const pk = pick(r, ['dev', 'infra', 'fort', 'charter', 'settle'] as ProjectKind[])!;
      let prov = pick(r, owned) ?? anyProv();
      if (pk === 'settle') {
        const wild = sim.world.provIds.filter((p) => !st.provinces[p].owner && sim.world.prov[p].neighbors.some((n) => st.provinces[n].owner === nid));
        prov = pick(r, wild) ?? anyProv();
      }
      return { type: 'build', nation: nid, province: prov, project: pk };
    }
    case 13:
      return { type: 'cancelBuild', nation: nid, province: pick(r, owned) ?? anyProv() };
    case 14:
      return nextFloat(r) < 0.5
        ? { type: 'research', nation: nid, tech: pick(r, TECH_LIST)!.id }
        : { type: 'funding', nation: nid, level: Math.floor(nextFloat(r) * 4) as 0 | 1 | 2 | 3 };
    case 15:
      return { type: 'policy', nation: nid, policy: pick(r, POLICY_LIST)!.id };
    case 16: {
      const t = pick(r, others)!;
      return nextFloat(r) < 0.7 ? { type: 'envoy', nation: nid, target: t } : { type: 'recallEnvoy', nation: nid, target: t };
    }
    case 17: {
      const t = pick(r, others)!;
      const treaty = pick(r, ['nap', 'trade', 'alliance'] as TreatyType[])!;
      return nextFloat(r) < 0.75 ? { type: 'propose', nation: nid, target: t, treaty } : { type: 'cancelTreaty', nation: nid, target: t, treaty };
    }
    case 18: {
      const border = sim.world.provIds.filter((p) => st.provinces[p].owner && st.provinces[p].owner !== nid && sim.world.prov[p].neighbors.some((n) => st.provinces[n].owner === nid));
      return { type: 'fabricate', nation: nid, province: pick(r, border) ?? anyProv() };
    }
    case 19: {
      if (nextFloat(r) > 0.25) return null;
      const t = pick(r, others)!;
      const goal = pick(r, goalOptions(sim, nid, t));
      if (!goal) return null;
      return { type: 'declareWar', nation: nid, target: t, goal };
    }
    case 20: {
      const w = pick(r, warsOf(sim, nid));
      if (!w) return null;
      const opp = w.attackers.includes(nid) ? w.defenders : w.attackers;
      const other = pick(r, opp)!;
      const mode = pick(r, ['white', 'demand', 'concede'] as const)!;
      const giver = mode === 'demand' ? other : nid;
      const theirs = ownedProvinces(sim, giver);
      const provs = mode === 'white' ? [] : theirs.filter(() => nextFloat(r) < 0.15).slice(0, 4);
      const gold = mode === 'white' ? 0 : Math.floor(nextFloat(r) * 300);
      return { type: 'peace', nation: nid, war: w.id, with: other, terms: { mode, provinces: provs, gold } };
    }
    case 21: {
      const p = pick(r, st.proposals.filter((x) => x.to === nid));
      return p ? { type: 'respond', nation: nid, proposal: p.id, accept: nextFloat(r) < 0.5 } : null;
    }
    case 22: {
      const pe = pick(r, st.nations[nid].pendingEvents);
      return pe ? { type: 'eventChoice', nation: nid, instance: pe.id, choice: Math.floor(nextFloat(r) * 3) } : null;
    }
    case 23: {
      const t = pick(r, others)!;
      const k = Math.floor(nextFloat(r) * 3);
      return k === 0 ? { type: 'joinCoalition', nation: nid, target: t } : k === 1 ? { type: 'leaveCoalition', nation: nid, target: t } : { type: 'coalitionWar', nation: nid, target: t };
    }
  }
  return null;
}

/** Commands that reference things that do not exist, or are malformed. */
function brokenCommand(sim: Sim, nid: NationId, r: Rng): Command {
  const k = Math.floor(nextFloat(r) * 6);
  const a = pick(r, armiesOf(sim, nid));
  switch (k) {
    case 0:
      return { type: 'move', nation: nid, army: 'a999999', dest: sim.world.provIds[0] };
    case 1:
      return { type: 'recruit', nation: nid, province: 'nowhere', unit: 'foot' };
    case 2:
      return { type: 'split', nation: nid, army: a?.id ?? 'x', counts: { foot: -1 } };
    case 3:
      return { type: 'peace', nation: nid, war: 'w9999', with: sim.world.nationIds[0], terms: { mode: 'white', provinces: [], gold: 0 } };
    case 4:
      return { type: 'recruit', nation: nid, province: sim.world.provIds[0], unit: 'foot', count: 99 };
    default:
      return { type: 'build', nation: nid, province: sim.world.provIds[0], project: 'castle' as ProjectKind };
  }
}

interface Finding {
  seed: number;
  tick: number;
  what: string;
}

function hash(sim: Sim): string {
  return fnv1a(JSON.stringify(sim.state));
}

function runOne(seed: number, findings: Finding[], record?: string[]): { hashes: string[] } {
  const sim = createGame({ scenario, seed, playerNation: playerArg || undefined, campaignYears: years + 5 });
  const nid = sim.state.settings.playerNation!;
  const r = seedState(seed * 7919 + 13);
  const hashes: string[] = [];
  const weeks = years * 48;
  let rejectedChecked = 0;
  let tw = 0;
  for (let w = 0; w < weeks && !isOver(sim); w++) {
    const n = 1 + Math.floor(nextFloat(r) * 3);
    for (let i = 0; i < n; i++) {
      const cmd = nextFloat(r) < 0.1 ? brokenCommand(sim, nid, r) : randomCommand(sim, nid, r);
      if (!cmd) continue;
      if (!sim.state.nations[nid].alive) break;
      let problem: string | null;
      try {
        problem = checkCommand(sim, cmd);
      } catch (e) {
        findings.push({ seed, tick: sim.state.tick, what: `checkCommand threw on ${cmd.type}: ${(e as Error).message}` });
        continue;
      }
      if (problem && rejectedChecked < 400 && nextFloat(r) < 0.3) {
        // a rejected command must leave the state untouched
        const before = hash(sim);
        const res = applyCommand(sim, cmd);
        rejectedChecked++;
        if (res.ok) findings.push({ seed, tick: sim.state.tick, what: `checkCommand rejected ${cmd.type} (${problem}) but applyCommand accepted it` });
        else if (hash(sim) !== before) findings.push({ seed, tick: sim.state.tick, what: `rejected ${cmd.type} changed the state` });
        continue;
      }
      try {
        const res = applyCommand(sim, cmd);
        record?.push(`${sim.state.tick}:${cmd.type}:${res.ok ? 'ok' : 'no'}`);
      } catch (e) {
        findings.push({ seed, tick: sim.state.tick, what: `applyCommand threw on ${JSON.stringify(cmd).slice(0, 160)}: ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}` });
      }
    }
    const t0 = performance.now();
    try {
      step(sim);
    } catch (e) {
      findings.push({ seed, tick: sim.state.tick, what: `step threw: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}` });
      break;
    }
    tw += performance.now() - t0;
    if (sim.state.tick % 4 === 0) {
      for (const v of checkInvariants(sim)) findings.push({ seed, tick: sim.state.tick, what: `invariant: ${v}` });
      for (const x of sim.world.nationIds) {
        const ns = sim.state.nations[x];
        if (!ns.alive) continue;
        const cap = poolCap(sim, x);
        if (ns.manpower > cap + 1) findings.push({ seed, tick: sim.state.tick, what: `soft: ${x} manpower pool ${Math.round(ns.manpower)} exceeds reserve minus serving ${Math.round(cap)}` });
      }
      for (const p of sim.state.proposals) {
        if ((p.kind === 'peace' || p.kind === 'callToArms') && !sim.state.wars[p.war!]) findings.push({ seed, tick: sim.state.tick, what: `proposal ${p.id} (${p.kind}) refers to an ended war` });
      }
      for (const id in sim.state.battles) {
        const b = sim.state.battles[id];
        if (!b.attackers.length || !b.defenders.length) findings.push({ seed, tick: sim.state.tick, what: `battle ${id} has an empty side after the week` });
      }
    }
    if (w % 48 === 47) hashes.push(hash(sim));
  }
  // save → load → continue must match the original continuation
  const copy = deserialize(serialize(sim));
  for (let i = 0; i < 24 && !isOver(sim); i++) {
    step(sim);
    step(copy);
  }
  if (hash(sim) !== hash(copy)) findings.push({ seed, tick: sim.state.tick, what: 'save/load continuation diverged after 24 weeks' });
  console.log(`seed ${seed}: ${sim.state.tick} weeks, ${(tw / Math.max(1, sim.state.tick)).toFixed(2)} ms/week, player ${nid} ${sim.state.nations[nid].alive ? 'alive' : 'eliminated'}, wars ${Object.keys(sim.state.wars).length}, rejected-checks ${rejectedChecked}`);
  return { hashes };
}

const findings: Finding[] = [];
for (let seed = s0; seed <= (s1 ?? s0); seed++) {
  const a = runOne(seed, findings);
  // determinism: the same seed and command stream must give the same states
  if (seed === s0) {
    const sink: Finding[] = [];
    const b = runOne(seed, sink);
    if (a.hashes.join() !== b.hashes.join()) findings.push({ seed, tick: -1, what: 'two identical runs diverged' });
  }
}
const uniq = new Map<string, Finding & { count: number }>();
for (const f of findings) {
  const key = f.what.replace(/\d+/g, '#');
  const ex = uniq.get(key);
  if (ex) ex.count++;
  else uniq.set(key, { ...f, count: 1 });
}
console.log(`\n${findings.length} finding(s), ${uniq.size} distinct (map ${scenario}):`);
for (const f of uniq.values()) console.log(`  [seed ${f.seed} tick ${f.tick}] ×${f.count} ${f.what}`);
const hard = findings.filter((f) => !f.what.startsWith('soft:'));
process.exitCode = hard.length ? 1 : 0;
