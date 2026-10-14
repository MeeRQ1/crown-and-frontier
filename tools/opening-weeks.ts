// What reaches the player in the first weeks of a new campaign (the recommended
// realm on the default map): notifications that pause the game, and proposals.
//   npx tsx tools/opening-weeks.ts [scenario] [weeks]
import '../src/maps/builtin';
import { createGame } from '../src/sim/game';
import { step } from '../src/sim/tick';
import { getWorld } from '../src/sim/world';
const [scenario = 'aldmere', weeks = '8'] = process.argv.slice(2);
const w = getWorld(scenario);
const player = (w.scenario.nations.find((n) => (n as { rating?: string }).rating === 'recommended') ?? w.scenario.nations[0]).id;
const sim = createGame({ scenario, seed: 1, playerNation: player });
const st = sim.state;
let seen = st.notifications.at(-1)?.id ?? 0;
for (let i = 0; i < Number(weeks); i++) {
  step(sim);
  for (const n of st.notifications) if (n.id > seen && n.nation === player && ['war', 'event', 'proposal', 'focus', 'research'].includes(n.kind)) console.log(`week ${st.tick}: [${n.kind}/${n.priority}] ${n.text}`);
  seen = st.notifications.at(-1)?.id ?? seen;
}
console.log('player', player, 'proposals open', st.proposals.filter((p) => p.to === player).map((p) => `${p.kind} from ${p.from}${p.reason ? ` (${p.reason})` : ''}`));
