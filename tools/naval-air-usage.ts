// How AI realms use ships and aircraft in a real campaign, sampled every week
// (read-only: it never changes the state). Used for the naval-and-air update's
// AI checks: purposeful missions, carriers flown, convoys escorted, wars overseas,
// order stability and solvency.
//
//   npx tsx tools/naval-air-usage.ts [scenario] [years] [seed]

import '../src/maps/builtin';
import { wingStatus } from '../src/sim/air';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { borders } from '../src/sim/state';
import { step } from '../src/sim/tick';

export interface NavalAirUsage {
  scenario: string;
  years: number;
  seed: number;
  weeks: number;
  warWeeks: number;
  wingWeeks: number;
  byState: Record<string, number>;
  /** wing-weeks of realms at war, and how many of them idle (no mission flown or ordered) */
  atWarWingWeeks: number;
  idleAtWar: number;
  flyingByMission: Record<string, number>;
  carrierWingWeeks: number;
  battles: number;
  battlesWithAir: number;
  battlesWithGunfire: number;
  /** mission orders changed per hundred wing-weeks (churn) */
  orderChanges: number;
  supportWeeks: number;
  airKills: number;
  navalStrikeHits: number;
  bombardWeeks: number;
  raidWeeks: number;
  landings: number;
  navalBattles: number;
  /** wars declared on a realm the attacker did not border, and how many of them saw a landing by the attacker */
  overseasWars: number;
  /** realm-months in debt (treasury below zero) */
  debtMonths: number;
  realmMonths: number;
  invariantFailures: string[];
  secs: number;
}

export function navalAirUsage(scenario: string, years: number, seed: number): NavalAirUsage {
  const sim = createGame({ scenario, seed, playerNation: null });
  const st = sim.state;
  const u: NavalAirUsage = { scenario, years, seed, weeks: 0, warWeeks: 0, wingWeeks: 0, byState: {}, atWarWingWeeks: 0, idleAtWar: 0, flyingByMission: {}, carrierWingWeeks: 0, battles: 0, battlesWithAir: 0, battlesWithGunfire: 0, orderChanges: 0, supportWeeks: 0, airKills: 0, navalStrikeHits: 0, bombardWeeks: 0, raidWeeks: 0, landings: 0, navalBattles: 0, overseasWars: 0, debtMonths: 0, realmMonths: 0, invariantFailures: [], secs: 0 };
  const t0 = Date.now();
  const seen = new Set<string>();
  const seenWars = new Set<string>();
  const lastOrder = new Map<string, string>();
  let changes = 0;
  for (let w = 0; w < years * 48; w++) {
    step(sim);
    u.weeks++;
    if (Object.keys(st.wars).length) u.warWeeks++;
    const fighting = new Set<string>();
    for (const war of Object.values(st.wars)) for (const n of [...war.attackers, ...war.defenders]) fighting.add(n);
    for (const id of Object.keys(st.wings)) {
      const wg = st.wings[id];
      u.wingWeeks++;
      const s = wingStatus(sim, wg);
      u.byState[s.state] = (u.byState[s.state] ?? 0) + 1;
      if (fighting.has(wg.nation)) {
        u.atWarWingWeeks++;
        if (s.state === 'idle') u.idleAtWar++;
      }
      if (s.state === 'flying') u.flyingByMission[wg.mission] = (u.flyingByMission[wg.mission] ?? 0) + 1;
      if (wg.carrier) u.carrierWingWeeks++;
      const order = `${wg.mission}|${wg.target}|${wg.zone}`;
      const prev = lastOrder.get(id);
      if (prev !== undefined && prev !== order) changes++;
      lastOrder.set(id, order);
    }
    for (const b of Object.values(st.battles)) {
      if (seen.has(b.id)) continue;
      if (!b.support) continue;
      seen.add(b.id);
      u.battles++;
      const lines = [...b.support.att, ...b.support.def];
      if (lines.some((l) => l.kind !== 'naval')) u.battlesWithAir++;
      if (lines.some((l) => l.kind === 'naval')) u.battlesWithGunfire++;
    }
    for (const war of Object.values(st.wars)) {
      if (seenWars.has(war.id)) continue;
      seenWars.add(war.id);
      if (!borders(sim, war.attackerLead, war.defenderLead)) u.overseasWars++;
    }
    if ((w + 1) % 4 === 0) {
      for (const n of Object.values(st.nations)) {
        if (!n.alive) continue;
        u.realmMonths++;
        if (n.treasury < 0) u.debtMonths++;
      }
    }
    if (w % 24 === 23) {
      const inv = checkInvariants(sim);
      if (inv.length) u.invariantFailures.push(`week ${w}: ${inv.slice(0, 3).join('; ')}`);
    }
  }
  for (const n of Object.values(st.nations)) {
    u.supportWeeks += n.stats.supportWeeks;
    u.airKills += n.stats.airKills;
    u.navalStrikeHits += n.stats.navalStrikeHits;
    u.bombardWeeks += n.stats.bombardWeeks;
    u.raidWeeks += n.stats.raidWeeks;
    u.landings += n.stats.landings;
    u.navalBattles += n.stats.navalBattles;
  }
  u.orderChanges = Math.round((changes / Math.max(1, u.wingWeeks)) * 1000) / 10;
  u.airKills = Math.round(u.airKills * 10) / 10;
  u.navalStrikeHits = Math.round(u.navalStrikeHits * 10) / 10;
  u.secs = (Date.now() - t0) / 1000;
  return u;
}

if (process.argv[1]?.endsWith('naval-air-usage.ts')) {
  const [scenario = 'earth-1936', years = '6', seed = '2'] = process.argv.slice(2);
  console.log(JSON.stringify(navalAirUsage(scenario, Number(years), Number(seed))));
}
