// State invariants checked by tests, AI campaigns and after loading a save.
// Returns a list of violations (empty = consistent).

import { C, UNITS } from './config';
import { devMax } from './construction';
import { maxMorale } from './military';
import { atWar, hasTreaty, type Sim } from './state';

function scanFinite(v: unknown, path: string, out: string[]): void {
  if (out.length > 20) return;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(`non-finite number at ${path}`);
  } else if (Array.isArray(v)) v.forEach((x, i) => scanFinite(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) scanFinite((v as Record<string, unknown>)[k], `${path}.${k}`, out);
}

export function checkInvariants(sim: Sim): string[] {
  const st = sim.state;
  const out: string[] = [];
  scanFinite(st, 'state', out);
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p) {
      out.push(`missing province ${pid}`);
      continue;
    }
    if (!p.owner && p.controller) out.push(`${pid}: unowned province has a controller`);
    if (p.owner && !st.nations[p.owner]?.alive) out.push(`${pid}: owner ${p.owner} is not alive`);
    if (p.controller && !st.nations[p.controller]?.alive) out.push(`${pid}: controller ${p.controller} is not alive`);
    if (p.owner && p.controller && p.owner !== p.controller && !atWar(sim, p.owner, p.controller)) out.push(`${pid}: occupied by ${p.controller} without a war against ${p.owner}`);
    if (p.integration < 0 || p.integration > 100) out.push(`${pid}: integration ${p.integration}`);
    if (p.unrest < 0 || p.unrest > 100) out.push(`${pid}: unrest ${p.unrest}`);
    if (p.dev < 1 || p.dev > devMax(sim, pid)) out.push(`${pid}: dev ${p.dev}`);
    if (p.infra < 0 || p.infra > C.construction.infraMax) out.push(`${pid}: infra ${p.infra}`);
    if (p.fort < 0 || p.fort > C.construction.fortMax) out.push(`${pid}: fort ${p.fort}`);
    if (!(p.pop > 0)) out.push(`${pid}: pop ${p.pop}`);
    for (const r of p.recruits) if (!st.nations[r.nation]?.alive || r.nation !== p.owner) out.push(`${pid}: recruit of ${r.nation} in foreign/dead realm`);
  }
  const regIds = new Set<string>();
  for (const id in st.armies) {
    const a = st.armies[id];
    if (a.id !== id) out.push(`army key mismatch ${id}`);
    if (!st.nations[a.nation]?.alive) out.push(`${id}: army of dead realm`);
    if (!sim.world.prov[a.location]) out.push(`${id}: bad location`);
    if (!a.regiments.length) out.push(`${id}: army without regiments`);
    for (const r of a.regiments) {
      if (regIds.has(r.id)) out.push(`${id}: duplicated regiment ${r.id}`);
      regIds.add(r.id);
      if (r.men <= 0 || r.men > C.regimentSize) out.push(`${id}: regiment ${r.id} men ${r.men}`);
      if (!UNITS[r.type]) out.push(`${id}: bad unit type`);
    }
    if (a.morale < 0 || a.morale > maxMorale(sim, a.nation) + 1e-6) out.push(`${id}: morale ${a.morale}`);
    if (a.battle && !st.battles[a.battle]) out.push(`${id}: in missing battle ${a.battle}`);
    let from = a.location;
    for (const step of a.path) {
      if (!sim.world.prov[from]?.neighbors.includes(step)) {
        out.push(`${id}: path not contiguous at ${from}->${step}`);
        break;
      }
      from = step;
    }
  }
  for (const bid in st.battles) {
    const b = st.battles[bid];
    for (const aid of [...b.attackers, ...b.defenders]) {
      const a = st.armies[aid];
      if (a && (a.location !== b.province || a.battle !== bid)) out.push(`${bid}: army ${aid} not on the field`);
    }
  }
  for (const wid in st.wars) {
    const w = st.wars[wid];
    if (w.attackers.some((x) => w.defenders.includes(x))) out.push(`${wid}: nation on both sides`);
    if (!w.attackers.includes(w.attackerLead) || !w.defenders.includes(w.defenderLead)) out.push(`${wid}: leader missing from its side`);
    for (const x of [...w.attackers, ...w.defenders]) if (!st.nations[x]?.alive) out.push(`${wid}: dead participant ${x}`);
    for (const a of w.attackers) for (const d of w.defenders) {
      if (hasTreaty(sim, 'alliance', a, d)) out.push(`${wid}: allies ${a}/${d} at war`);
      if (hasTreaty(sim, 'nap', a, d)) out.push(`${wid}: pact partners ${a}/${d} at war`);
    }
  }
  const seen = new Set<string>();
  for (const t of st.treaties) {
    const k = `${t.type}|${[t.a, t.b].sort().join('|')}`;
    if (seen.has(k)) out.push(`duplicate treaty ${k}`);
    seen.add(k);
    if (!st.nations[t.a]?.alive || !st.nations[t.b]?.alive) out.push(`treaty with dead realm ${k}`);
    if (t.a === t.b) out.push(`self treaty ${k}`);
  }
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    if (n.manpower < -1e-6) out.push(`${nid}: negative manpower`);
    if (n.supplies < -1e-6) out.push(`${nid}: negative supplies`);
    if (n.warExhaustion < 0 || n.warExhaustion > 100) out.push(`${nid}: war exhaustion ${n.warExhaustion}`);
    if (n.alive && n.capital && st.provinces[n.capital].owner !== nid) out.push(`${nid}: capital not owned`);
  }
  return out;
}
