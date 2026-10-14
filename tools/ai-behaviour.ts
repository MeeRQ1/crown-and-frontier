// AI behaviour in an AI-only campaign: how wars end and why, who offers peace
// (winning or losing side), treaties proposed and signed, and diplomacy volume.
// Read-only: it samples the AI's own decision log every week.
//
//   npx tsx tools/ai-behaviour.ts [scenario] [years] [seed]

import '../src/maps/builtin';
import { createGame } from '../src/sim/game';
import { step } from '../src/sim/tick';
import type { AIDiagnostic } from '../src/sim/types';

export interface AiBehaviour {
  scenario: string;
  years: number;
  seed: number;
  wars: number;
  warsEnded: number;
  /** peace offers and agreements by kind, from the AI decision log */
  peace: Record<string, number>;
  /** proposals of each treaty type, and how many were signed */
  proposed: Record<string, number>;
  signed: Record<string, number>;
  treatiesAtEnd: Record<string, number>;
  /** the largest number of treaty proposals any realm made in one year */
  maxProposalsPerRealmYear: number;
  samples: string[];
}

export function aiBehaviour(scenario: string, years: number, seed: number): AiBehaviour {
  const sim = createGame({ scenario, seed, playerNation: null });
  const st = sim.state;
  const out: AiBehaviour = { scenario, years, seed, wars: 0, warsEnded: 0, peace: {}, proposed: {}, signed: {}, treatiesAtEnd: {}, maxProposalsPerRealmYear: 0, samples: [] };
  const seenWars = new Set<string>();
  let last: AIDiagnostic | undefined = st.diagnostics.at(-1);
  const perYear = new Map<string, number>();
  const bump = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
  for (let w = 0; w < years * 48; w++) {
    const before = new Set(Object.keys(st.wars));
    step(sim);
    for (const id of Object.keys(st.wars)) if (!seenWars.has(id)) (seenWars.add(id), out.wars++);
    for (const id of before) if (!st.wars[id]) out.warsEnded++;
    const d = st.diagnostics;
    let i = last ? d.lastIndexOf(last) + 1 : 0;
    if (last && i === 0) i = 0;
    for (; i < d.length; i++) {
      const s = d[i].summary;
      let m: RegExpMatchArray | null;
      if ((m = s.match(/^Offered peace to .* \((winning|losing\/tired|conceding)[^)]*\): (sent|invalid)/))) bump(out.peace, `offer to player: ${m[1]}`);
      else if ((m = s.match(/^Peace with .* \((winning|losing\/tired|conceding)[^)]*\): (agreed|failed)/))) bump(out.peace, `AI-AI ${m[1]}: ${m[2]}`);
      else if (/^Peace .* would be refused/.test(s)) bump(out.peace, 'AI-AI offer judged refused');
      else if ((m = s.match(/^Settlement with .*: (agreed|failed)/))) bump(out.peace, `AI-AI settlement: ${m[1]}`);
      else if (/^Proposed a settlement to/.test(s)) bump(out.peace, 'settlement offered to player');
      else if ((m = s.match(/^Proposed (\w+) to .*: (.*)$/))) {
        bump(out.proposed, m[1]);
        if (!/declined|refused|invalid/i.test(m[2])) bump(out.signed, m[1]);
        const key = `${d[i].nation}|${Math.floor(st.tick / 48)}`;
        perYear.set(key, (perYear.get(key) ?? 0) + 1);
      }
      if (/peace|Settlement/i.test(s) && out.samples.length < 12) out.samples.push(`wk${d[i].tick} ${d[i].nation}: ${s}`);
    }
    last = d.at(-1);
  }
  for (const t of st.treaties) bump(out.treatiesAtEnd, t.type);
  out.maxProposalsPerRealmYear = Math.max(0, ...perYear.values());
  return out;
}

if (process.argv[1]?.endsWith('ai-behaviour.ts')) {
  const [scenario = 'earth-1936', years = '6', seed = '2'] = process.argv.slice(2);
  console.log(JSON.stringify(aiBehaviour(scenario, Number(years), Number(seed)), null, 1));
}
