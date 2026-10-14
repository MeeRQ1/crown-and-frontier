// National scale at a glance: people, men fit for service, the pool, regiments,
// income, spending and the balance of small, middling and large realms at the
// start and after some years of AI play, and how many realms start in deficit or
// with no men to call up.   npx tsx tools/national-scale.ts [scenario] [years] [realms]

import '../src/maps/builtin';
import { createGame } from '../src/sim/game';
import { menServing, nationPopulation, poolCap, reserveCap } from '../src/sim/economy';
import { step } from '../src/sim/tick';

const [scenario = 'earth-1936', years = '3', list = 'alb,lat,por,yug,ita,ger,gbr'] = process.argv.slice(2);
const sim = createGame({ scenario, seed: 1, playerNation: null });
const st = sim.state;
const gross = (l: { income: Record<string, number> }) => Object.values(l.income).reduce((a, b) => a + b, 0);
const spend = (l: { expenses: Record<string, number> }) => Object.values(l.expenses).reduce((a, b) => a + b, 0);
const M = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1000)}k`);
const table = (when: string) => {
  const out = [`### ${when}`, '', '| Realm | People | Fit for service | Serving | Pool | Regiments | Gross income | Spending | Balance |', '|---|---|---|---|---|---|---|---|---|'];
  for (const id of list.split(',')) {
    const n = st.nations[id];
    if (!n?.alive) {
      out.push(`| ${id} | (gone) | | | | | | | |`);
      continue;
    }
    const regs = Object.values(st.armies).filter((a) => a.nation === id).reduce((s, a) => s + a.regiments.length, 0);
    out.push(`| ${sim.world.nationDefs[id].name} | ${M(nationPopulation(sim, id))} | ${M(reserveCap(sim, id))} | ${M(menServing(sim, id))} | ${M(n.manpower)} | ${regs} | ${gross(n.lastMonth).toFixed(1)} | ${spend(n.lastMonth).toFixed(1)} | ${n.lastMonth.net >= 0 ? '+' : ''}${n.lastMonth.net.toFixed(1)} |`);
  }
  const alive = sim.world.nationIds.filter((id) => st.nations[id].alive);
  const deficit = alive.filter((id) => st.nations[id].lastMonth.net < 0).length;
  const noMen = alive.filter((id) => poolCap(sim, id) <= 0).length;
  out.push('', `Realms in deficit: ${deficit} of ${alive.length}; with no men to call up: ${noMen}.`, '');
  return out.join('\n');
};
const parts = [`## ${scenario}: national scale (seed 1)`, '', table('At the start')];
for (let w = 0; w < Number(years) * 48; w++) step(sim);
parts.push(table(`After ${years} years of AI play`));
console.log(parts.join('\n'));
