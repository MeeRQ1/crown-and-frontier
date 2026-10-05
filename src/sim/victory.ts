// Victory paths, evaluated monthly for every realm (player and AI alike).
//
// Territorial dominance: own and control >= 75% of the provinces in 3 regions
//   AND >= 23% of all provinces, held for 24 months.
// Economic prosperity: integrated development (dev of controlled provinces with
//   integration >= 75, not in revolt) >= 25% of the world's development, with
//   dev-weighted unrest <= 25, a non-negative treasury, no bankruptcy and no
//   province under enemy occupation — held for 60 months.
// Diplomatic leadership: influence from established ties with partners whose
//   opinion of us is >= 35. Each partner counts once for its strongest bond —
//   an alliance (36 months old) or being in our sphere 2, our guarantee (a year
//   old) 1 — plus 1 for a trade agreement (36 months old). Needs
//   1.25 influence per other surviving realm (min 6), trust >= 65 and no
//   offensive war — held for 60 months. New treaties do not count, so treaty
//   cycling is useless; rivals may cancel trade with a realm close to winning.
// A month in which a condition fails pauses its timer; from the second failing
// month in a row, the timer loses 6 months a month (not a full reset).
// Several winners in one month: highest campaign score wins.
// Campaign limit: highest campaign score (formula in campaignScore()).

import { C } from './config';
import { opinion, worldDev } from './diplomacy';
import { sphereMembers } from './influence';
import { ownedProvinces, aliveNations, months, notify, nationName, endTick, dateOf, type Sim, warsOf } from './state';
import type { NationId, VictoryPath } from './types';

/**
 * Victory thresholds for the map being played: the defaults in config,
 * overridden by the scenario (a larger map spreads land and wealth over more
 * realms, so the shares that mean "dominant" are smaller).
 */
export function victoryRules(sim: Sim) {
  return { ...C.victory, ...(sim.world.scenario.victory ?? {}) };
}

export const VICTORY_MONTHS: Record<VictoryPath, number> = {
  territorial: C.victory.territorialMonths,
  economic: C.victory.economicMonths,
  diplomatic: C.victory.diplomaticMonths,
};

export const VICTORY_LABELS: Record<VictoryPath, string> = {
  territorial: 'Territorial Dominance',
  economic: 'Economic Prosperity',
  diplomatic: 'Diplomatic Leadership',
};

export interface PathProgress {
  met: boolean;
  /** 0..1 progress toward meeting the condition */
  progress: number;
  streak: number;
  required: number;
  lines: string[];
}

export interface VictoryProgress {
  territorial: PathProgress;
  economic: PathProgress;
  diplomatic: PathProgress;
}

export function dominatedRegions(sim: Sim, nid: NationId): string[] {
  const out: string[] = [];
  for (const r of sim.world.scenario.regions) {
    const provs = sim.world.regionProvinces[r.id] ?? [];
    if (!provs.length) continue;
    const held = provs.filter((p) => sim.state.provinces[p].owner === nid && sim.state.provinces[p].controller === nid).length;
    if (held / provs.length >= C.victory.regionHold) out.push(r.id);
  }
  return out;
}

export function integratedDev(sim: Sim, nid: NationId): number {
  let d = 0;
  for (const pid of ownedProvinces(sim, nid)) {
    const p = sim.state.provinces[pid];
    if (p.controller === nid && p.integration >= C.integration.economicMin && p.revoltUntil <= sim.state.tick) d += p.dev;
  }
  return d;
}

export function establishedPartners(sim: Sim, nid: NationId): NationId[] {
  return Object.keys(influenceByPartner(sim, nid)).sort();
}

/**
 * Influence per partner: its strongest bond (an established alliance or our
 * sphere 2, our guarantee 1) plus an established trade agreement (1).
 */
export function influenceByPartner(sim: Sim, nid: NationId): Record<NationId, number> {
  const st = sim.state;
  const bond: Record<NationId, number> = {};
  const trade: Record<NationId, number> = {};
  const ok = (other: NationId) => opinion(sim, other, nid) >= C.victory.diplomaticOpinion;
  const old = (since: number, m: number) => st.tick - since >= months(m);
  for (const t of st.treaties) {
    if (t.type === 'nap' || (t.a !== nid && t.b !== nid) || !old(t.since, C.victory.diplomaticTreatyAge)) continue;
    const other = t.a === nid ? t.b : t.a;
    if (t.type === 'alliance') bond[other] = 2;
    else trade[other] = 1;
  }
  for (const m of sphereMembers(sim, nid)) bond[m] = Math.max(bond[m] ?? 0, C.influence.victory);
  for (const g of st.guarantees) if (g.by === nid && old(g.since, 12)) bond[g.of] = Math.max(bond[g.of] ?? 0, 1);
  const out: Record<NationId, number> = {};
  for (const o of new Set([...Object.keys(bond), ...Object.keys(trade)])) {
    if (!st.nations[o]?.alive || !ok(o)) continue;
    out[o] = (bond[o] ?? 0) + (trade[o] ?? 0);
  }
  return out;
}

export function influence(sim: Sim, nid: NationId): number {
  return Object.values(influenceByPartner(sim, nid)).reduce((a, b) => a + b, 0);
}

export function influenceNeeded(sim: Sim, nid: NationId): number {
  const others = aliveNations(sim).filter((x) => x !== nid).length;
  return Math.max(victoryRules(sim).diplomaticMinInfluence, Math.ceil(others * victoryRules(sim).diplomaticInfluencePerRealm));
}

export function victoryProgress(sim: Sim, nid: NationId): VictoryProgress {
  const st = sim.state;
  const n = st.nations[nid];
  const total = sim.world.provIds.length;
  const held = ownedProvinces(sim, nid).filter((p) => st.provinces[p].controller === nid).length;
  const regions = dominatedRegions(sim, nid);
  const share = held / total;
  const tMet = regions.length >= victoryRules(sim).territorialRegions && share >= victoryRules(sim).territorialShare;
  const territorial: PathProgress = {
    met: tMet,
    progress: Math.min(1, Math.min(regions.length / victoryRules(sim).territorialRegions, share / victoryRules(sim).territorialShare)),
    streak: n.victoryStreak.territorial,
    required: C.victory.territorialMonths,
    lines: [
      `Regions dominated: ${regions.length}/${victoryRules(sim).territorialRegions} (own ≥75% of a region)`,
      `Provinces held: ${held}/${total} (${Math.round(share * 100)}% of ${Math.round(victoryRules(sim).territorialShare * 100)}% needed)`,
    ],
  };

  const idev = integratedDev(sim, nid);
  const wdev = worldDev(sim);
  const devShareV = idev / Math.max(1, wdev);
  let unrestNum = 0;
  let unrestDen = 0;
  let occupied = false;
  for (const pid of ownedProvinces(sim, nid)) {
    const p = st.provinces[pid];
    unrestNum += p.unrest * p.dev;
    unrestDen += p.dev;
    if (p.controller !== nid) occupied = true;
  }
  const unrest = unrestDen ? unrestNum / unrestDen : 0;
  const bankrupt = n.bankruptUntil > st.tick;
  const eMet = devShareV >= victoryRules(sim).economicShare && unrest <= C.victory.economicUnrest && n.treasury >= 0 && !bankrupt && !occupied;
  const economic: PathProgress = {
    met: eMet,
    progress: Math.min(1, devShareV / victoryRules(sim).economicShare),
    streak: n.victoryStreak.economic,
    required: C.victory.economicMonths,
    lines: [
      `Integrated development: ${idev}/${Math.ceil(wdev * victoryRules(sim).economicShare)} (${Math.round(devShareV * 100)}% of the world, ${Math.round(victoryRules(sim).economicShare * 100)}% needed)`,
      `Average unrest ${Math.round(unrest)} (max ${C.victory.economicUnrest})${n.treasury < 0 ? ' · treasury in debt' : ''}${bankrupt ? ' · bankrupt' : ''}${occupied ? ' · land under occupation' : ''}`,
    ],
  };

  const need = influenceNeeded(sim, nid);
  const infl = influence(sim, nid);
  const offensive = warsOf(sim, nid).some((w) => w.attackers.includes(nid));
  const dMet = infl >= need && n.trust >= C.victory.diplomaticTrust && !offensive;
  const diplomatic: PathProgress = {
    met: dMet,
    progress: Math.min(1, infl / need, n.trust / C.victory.diplomaticTrust),
    streak: n.victoryStreak.diplomatic,
    required: C.victory.diplomaticMonths,
    lines: [
      `Influence: ${infl}/${need} (per partner at opinion ≥ ${C.victory.diplomaticOpinion}: alliance after ${C.victory.diplomaticTreatyAge / 12} years or our sphere 2, our guarantee 1; plus trade after ${C.victory.diplomaticTreatyAge / 12} years 1)`,
      `Trust ${Math.round(n.trust)} (need ${C.victory.diplomaticTrust})${offensive ? ' · fighting an offensive war' : ''}`,
    ],
  };
  return { territorial, economic, diplomatic };
}

/** Disclosed campaign score used for simultaneous wins and the campaign limit. */
export function campaignScore(sim: Sim, nid: NationId): number {
  const st = sim.state;
  const n = st.nations[nid];
  if (!n.alive) return 0;
  const vp = victoryProgress(sim, nid);
  const provinces = ownedProvinces(sim, nid).length;
  let s = provinces * 3 + integratedDev(sim, nid) * 0.6 + n.research.done.length * 3 + influence(sim, nid) * 3 + Math.min(2000, Math.max(0, n.treasury)) / 100;
  for (const k of ['territorial', 'economic', 'diplomatic'] as VictoryPath[]) s += (vp[k].streak / vp[k].required) * 20 + vp[k].progress * 10;
  return Math.round(s * 10) / 10;
}

export const SCORE_FORMULA =
  'Score = 3 × provinces + 0.6 × integrated development + 3 × technologies + 3 × diplomatic influence + min(treasury, 2000)/100 + for each victory path (20 × timer fraction + 10 × condition progress).';

export function monthlyVictory(sim: Sim): void {
  const st = sim.state;
  if (st.result && !st.continueAfterResult) return;
  const winners: Array<{ nid: NationId; path: VictoryPath }> = [];
  for (const nid of aliveNations(sim)) {
    const n = st.nations[nid];
    const vp = victoryProgress(sim, nid);
    const missed = (n.victoryMissed ??= { territorial: 0, economic: 0, diplomatic: 0 });
    for (const k of ['territorial', 'economic', 'diplomatic'] as VictoryPath[]) {
      const before = n.victoryStreak[k];
      if (vp[k].met) {
        n.victoryStreak[k] = Math.min(VICTORY_MONTHS[k], before + 1);
        missed[k] = 0;
      } else {
        missed[k]++;
        if (missed[k] >= 2) n.victoryStreak[k] = Math.max(0, before - C.victory.streakDecay);
      }
      if (vp[k].met && before === 0) {
        notify(sim, null, nid === playerId(sim) ? 'normal' : 'urgent', 'victory', `${nationName(sim, nid)} now meets the conditions for ${VICTORY_LABELS[k]}. They win if they hold them for ${VICTORY_MONTHS[k]} months.`);
      }
      if (n.victoryStreak[k] >= VICTORY_MONTHS[k] && !st.result) winners.push({ nid, path: k });
    }
  }
  if (winners.length && !st.result) {
    const scores = allScores(sim);
    winners.sort((a, b) => scores[b.nid] - scores[a.nid] || (a.nid < b.nid ? -1 : 1));
    const w = winners[0];
    const player = playerId(sim);
    st.result = {
      tick: st.tick,
      winner: w.nid,
      path: w.path,
      reason: `${sim.world.nationDefs[w.nid].name} achieved ${VICTORY_LABELS[w.path]}${winners.length > 1 ? ' (highest score among simultaneous winners)' : ''}.`,
      scores,
      playerOutcome: player ? (w.nid === player ? 'victory' : 'defeat') : null,
    };
    notify(sim, null, 'urgent', 'result', st.result.reason);
    return;
  }
  if (st.tick >= endTick(sim) && !st.result) {
    const scores = allScores(sim);
    const best = aliveNations(sim).sort((a, b) => scores[b] - scores[a] || (a < b ? -1 : 1))[0] ?? null;
    const player = playerId(sim);
    st.result = {
      tick: st.tick,
      winner: best,
      path: 'score',
      reason: `The campaign reached its limit (${dateOf(sim).short}). ${best ? sim.world.nationDefs[best].name : 'No one'} leads on campaign score.`,
      scores,
      playerOutcome: player ? (best === player ? 'victory' : st.nations[player].alive ? 'survived' : 'defeat') : null,
    };
    notify(sim, null, 'urgent', 'result', st.result.reason);
  }
}

export function allScores(sim: Sim): Record<NationId, number> {
  const out: Record<NationId, number> = {};
  for (const nid of sim.world.nationIds) out[nid] = campaignScore(sim, nid);
  return out;
}

export function playerId(sim: Sim): NationId | null {
  return sim.state.settings.playerNation;
}

/** Called after eliminations: the player's realm destroyed ends the campaign for them. */
export function checkPlayerDefeat(sim: Sim): void {
  const st = sim.state;
  const pid = playerId(sim);
  if (!pid || st.result) return;
  if (!st.nations[pid].alive) {
    st.result = {
      tick: st.tick,
      winner: null,
      path: 'elimination',
      reason: `${sim.world.nationDefs[pid].name} has been destroyed.`,
      scores: allScores(sim),
      playerOutcome: 'defeat',
    };
  }
}
