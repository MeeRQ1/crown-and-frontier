// The reported regression: a realm that has lost half its land and cannot
// retake it. World 1936, the player as Italy at war with Yugoslavia (its
// treaties removed so no ally joins); Italian armies hold half of Yugoslavia,
// Yugoslavia keeps two regiments at Belgrade and is tired (exhaustion 35).
// Prints every peace offer Yugoslavia makes to the player over 24 weeks and the
// AI's decision log, for a before/after comparison of the same build inputs.
//   npx tsx tools/half-country.ts [weeks]

import '../src/maps/builtin';
import { createGame } from '../src/sim/game';
import { createArmy, newRegiment } from '../src/sim/military';
import { ownedProvinces } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';

const weeks = Number(process.argv[2] ?? 24);
const sim = createGame({ scenario: 'earth-1936', seed: 3, playerNation: 'ita' });
const st = sim.state;
st.tick += 18 * 4; // past the opening months
st.treaties = st.treaties.filter((t) => t.a !== 'yug' && t.b !== 'yug');
declareWar(sim, 'ita', 'yug', { type: 'conquest', provinces: ownedProvinces(sim, 'yug').slice(0, 2) });
const yug = ownedProvinces(sim, 'yug').sort();
const cap = st.nations.yug.capital!;
const taken = yug.filter((p) => p !== cap).slice(0, Math.ceil(yug.length / 2));
for (const p of taken) st.provinces[p].controller = 'ita';
for (const a of Object.values(st.armies)) if (a.nation === 'yug') delete st.armies[a.id];
for (const p of taken) createArmy(sim, 'ita', p, Array.from({ length: 4 }, () => newRegiment(sim, 'infantry')));
createArmy(sim, 'yug', cap, Array.from({ length: 2 }, () => newRegiment(sim, 'infantry')));
st.nations.yug.warExhaustion = 35;
const out: string[] = [`Yugoslavia: ${yug.length} provinces, ${taken.length} occupied by Italy; 2 regiments left at the capital.`, ''];
const t0 = st.tick;
for (let i = 0; i < weeks; i++) {
  step(sim);
  // the player answers nothing: offers lapse or wait, as a player thinking it over would
  for (const p of st.proposals.filter((x) => x.to === 'ita' && (x.kind === 'peace' || x.kind === 'settlement') && x.tick === st.tick - 1)) {
    const what = p.kind === 'peace' ? `${p.terms!.mode}${p.terms!.provinces.length ? ` ceding ${p.terms!.provinces.join(', ')}` : ''}${p.terms!.gold ? ` and ${p.terms!.gold} crowns` : ''}` : 'settlement';
    out.push(`- week ${st.tick - t0}: offer to Italy: ${what}`);
  }
}
out.push('', 'Decision log (Yugoslavia, peace):');
for (const d of st.diagnostics.filter((x) => x.nation === 'yug' && /^(Offered peace|Peace |Fighting on|Holding out|Pressing on|Settlement|Proposed a settlement)/.test(x.summary))) {
  out.push(`- week ${d.tick - t0}: ${d.summary}`);
  for (const line of d.detail ?? []) out.push(`  - ${line}`);
}
console.log(out.join('\n'));
