// Follows one realm through an AI-only campaign: its wars (with whom, who
// started them, how they ended) and every province it gains or loses.
//   npx tsx tools/trace-realm.ts --scenario aldmere --seed 1 --realm mor [--years 60]
// Used to investigate collapses and runaway realms in AI batches.

import { createGame } from '../src/sim/game';
import { ownedProvinces } from '../src/sim/state';
import { isOver, step } from '../src/sim/tick';

const a = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const scenario = get('scenario', 'aldmere');
const seed = Number(get('seed', '1'));
const realm = get('realm', 'mor');
const years = Number(get('years', '60'));

const sim = createGame({ scenario, seed, playerNation: null, campaignYears: years });
const st = sim.state;
const owner = new Map(sim.world.provIds.map((p) => [p, st.provinces[p].owner]));
const seenWars = new Map<string, string>();
const year = () => (st.tick / 48 + sim.world.scenario.startYear).toFixed(1);
const name = (n: string | null) => (n ? sim.world.nationDefs[n].short : 'nobody');
const counts: Record<string, number> = {};
while (!isOver(sim) && st.tick < years * 48 + 4) {
  step(sim);
  for (const [id, w] of Object.entries(st.wars)) {
    if (seenWars.has(id)) continue;
    if (![...w.attackers, ...w.defenders].includes(realm)) continue;
    seenWars.set(id, w.name);
    console.log(`${year()} WAR ${w.name}: ${w.attackers.map(name).join('+')} vs ${w.defenders.map(name).join('+')} (${w.goal.type})`);
  }
  for (const [id, nm] of seenWars) {
    if (nm && !st.wars[id]) {
      console.log(`${year()} END ${nm}`);
      seenWars.set(id, '');
    }
  }
  for (const p of sim.world.provIds) {
    const o = st.provinces[p].owner;
    const before = owner.get(p)!;
    if (o === before) continue;
    owner.set(p, o);
    if (before === realm || o === realm) {
      const k = before === realm ? `lost to ${name(o)}` : `gained from ${name(before)}`;
      counts[k] = (counts[k] ?? 0) + 1;
      console.log(`${year()}   ${sim.world.prov[p].name}: ${name(before)} -> ${name(o)}`);
    }
  }
}
console.log(`\n${name(realm)} ends with ${ownedProvinces(sim, realm).length} provinces (${st.nations[realm].alive ? 'alive' : 'destroyed'}).`);
console.log(Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('\n'));
