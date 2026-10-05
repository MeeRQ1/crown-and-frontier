// Condition-based events. Each event has an eligibility weight (0 = not
// eligible), an optional subject (province / other nation), a cooldown, and
// choices whose effects use the normal rules. Every event has at least one
// choice that can always be taken. Effects are described to the player before
// choosing.

import { addAlarm, addMemory, opinion } from '../diplomacy';
import { resourceCap, stockpileCap } from '../economy';
import { maxMorale } from '../military';
import { enemiesOf, months, ownedProvinces, provName, nationName, armiesOf, borders, aliveNations, atWar, warsOf, clamp, type Sim } from '../state';
import type { NationId, ProvinceId } from '../types';

export interface EventCtx {
  sim: Sim;
  nid: NationId;
  province?: ProvinceId;
  other?: NationId;
}

export interface EventChoice {
  label: string;
  effect: (c: EventCtx) => string;
  problem?: (c: EventCtx) => string | null;
  apply: (c: EventCtx) => void;
  ai: (c: EventCtx) => number;
}

export interface EventDef {
  id: string;
  title: string;
  cooldownMonths: number;
  /** returns weight > 0 and the subject when eligible */
  eligible: (c: EventCtx) => { weight: number; province?: ProvinceId; other?: NationId } | null;
  text: (c: EventCtx) => string;
  choices: EventChoice[];
}

const N = (c: EventCtx) => c.sim.state.nations[c.nid];
const P = (c: EventCtx) => c.sim.state.provinces[c.province!];
const PN = (c: EventCtx) => provName(c.sim, c.province!);
const ON = (c: EventCtx) => nationName(c.sim, c.other!);

function pay(c: EventCtx, crowns: number): string | null {
  return N(c).treasury >= crowns ? null : `Needs ${crowns} crowns.`;
}

function modifier(c: EventCtx, id: string, label: string, monthsLong: number, effects: Record<string, number>) {
  const n = N(c);
  n.modifiers = n.modifiers.filter((m) => m.id !== id);
  n.modifiers.push({ id, label, until: c.sim.state.tick + months(monthsLong), effects });
}

function ownIntegrated(c: EventCtx, filter: (pid: ProvinceId) => boolean): ProvinceId[] {
  return ownedProvinces(c.sim, c.nid).filter((pid) => c.sim.state.provinces[pid].controller === c.nid && filter(pid));
}

function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

export const EVENTS: EventDef[] = [
  {
    id: 'harvest',
    title: 'Bountiful Harvest',
    cooldownMonths: 24,
    eligible: (c) => {
      const pid = first(ownIntegrated(c, (p) => c.sim.world.prov[p].resource === 'food' && c.sim.state.provinces[p].integration >= 50));
      return pid ? { weight: 3, province: pid } : null;
    },
    text: (c) => `The fields of ${PN(c)} have yielded far more than expected. The surplus can fill the army depots or be sold abroad.`,
    choices: [
      { label: 'Fill the depots', effect: () => '+40 food (up to the stockpile limit).', apply: (c) => { N(c).supplies = Math.min(stockpileCap(c.sim, c.nid), N(c).supplies + 40); }, ai: (c) => (N(c).supplies < stockpileCap(c.sim, c.nid) * 0.5 ? 2 : 0.5) },
      { label: 'Sell the surplus', effect: () => '+45 crowns.', apply: (c) => { N(c).treasury += 45; }, ai: () => 1 },
    ],
  },
  {
    id: 'border_incident',
    title: 'Border Incident',
    cooldownMonths: 36,
    eligible: (c) => {
      const st = c.sim.state;
      for (const o of aliveNations(c.sim)) {
        if (o === c.nid || atWar(c.sim, c.nid, o) || !borders(c.sim, c.nid, o)) continue;
        if (opinion(c.sim, c.nid, o) > -5) continue;
        const pid = c.sim.world.provIds.find((p) => st.provinces[p].owner === o && !st.provinces[p].claims.includes(c.nid) && c.sim.world.prov[p].neighbors.some((nb) => st.provinces[nb].owner === c.nid));
        if (pid) return { weight: 2, province: pid, other: o };
      }
      return null;
    },
    text: (c) => `Soldiers of ${ON(c)} and our border wardens have clashed near ${PN(c)}. Our magistrates say old charters give us a right to the district.`,
    choices: [
      { label: 'Press our claim', effect: (c) => `Gain a claim on ${PN(c)}. ${ON(c)} will resent it (−15 opinion).`, apply: (c) => { P(c).claims.push(c.nid); addMemory(c.sim, c.other!, c.nid, 'event', -15, 0.4); }, ai: () => 1.2 },
      { label: 'Let it pass', effect: (c) => `Relations with ${ON(c)} improve (+10 opinion). Trust +2.`, apply: (c) => { addMemory(c.sim, c.other!, c.nid, 'event', 10, 0.4); N(c).trust = Math.min(100, N(c).trust + 2); }, ai: () => 1 },
    ],
  },
  {
    id: 'frontier_unrest',
    title: 'Frontier Discontent',
    cooldownMonths: 12,
    eligible: (c) => {
      const pid = first(ownIntegrated(c, (p) => c.sim.state.provinces[p].integration < 40 && c.sim.state.provinces[p].unrest > 25));
      return pid ? { weight: 4, province: pid } : null;
    },
    text: (c) => `The people of ${PN(c)} complain that the crown takes their taxes and their sons but grants them no vote.`,
    choices: [
      { label: 'Grant local charters', effect: (c) => `−40 crowns. ${PN(c)}: unrest −20, integration +10.`, problem: (c) => pay(c, 40), apply: (c) => { N(c).treasury -= 40; P(c).unrest = clamp(P(c).unrest - 20, 0, 100); P(c).integration = clamp(P(c).integration + 10, 0, 100); }, ai: (c) => (N(c).treasury > 120 ? 2 : 0.5) },
      { label: 'Send the gendarmerie', effect: (c) => `−10 food. ${PN(c)}: unrest −25, integration −5.`, problem: (c) => (N(c).supplies >= 10 ? null : 'Needs 10 food.'), apply: (c) => { N(c).supplies -= 10; P(c).unrest = clamp(P(c).unrest - 25, 0, 100); P(c).integration = clamp(P(c).integration - 5, 0, 100); }, ai: () => 1 },
      { label: 'Ignore them', effect: (c) => `${PN(c)}: unrest +10.`, apply: (c) => { P(c).unrest = clamp(P(c).unrest + 10, 0, 100); }, ai: () => 0.2 },
    ],
  },
  {
    id: 'merchant_guild',
    title: "Industrialists' Petition",
    cooldownMonths: 48,
    eligible: (c) => {
      const pid = first(ownIntegrated(c, (p) => c.sim.state.provinces[p].factories >= 2));
      return pid && N(c).treasury > 60 ? { weight: 2, province: pid } : null;
    },
    text: (c) => `The mill-owners of ${PN(c)} ask for a tariff on foreign manufactures and crown contracts, and offer a generous loan in return.`,
    choices: [
      { label: 'Grant the tariff', effect: () => '−60 crowns now; industrial capacity +10% and crown income +5% for 3 years.', problem: (c) => pay(c, 60), apply: (c) => { N(c).treasury -= 60; modifier(c, 'guild_charter', 'Protective tariff', 36, { industryMul: 0.1, incomeMul: 0.05 }); }, ai: () => 1.5 },
      { label: 'Refuse', effect: (c) => `${PN(c)}: unrest +5.`, apply: (c) => { P(c).unrest = clamp(P(c).unrest + 5, 0, 100); }, ai: () => 0.5 },
    ],
  },
  {
    id: 'plague',
    title: 'Cholera',
    cooldownMonths: 72,
    eligible: (c) => {
      const pid = ownIntegrated(c, (p) => c.sim.state.provinces[p].pop > 45).sort((a, b) => c.sim.state.provinces[b].pop - c.sim.state.provinces[a].pop)[0];
      return pid ? { weight: 1, province: pid } : null;
    },
    text: (c) => `Cholera has broken out in the slums of ${PN(c)}. Physicians urge closing the railway stations; merchants urge calm.`,
    choices: [
      { label: 'Quarantine', effect: (c) => `Crown income −15% for 6 months; ${PN(c)} loses 2% of its people.`, apply: (c) => { modifier(c, 'quarantine', 'Quarantine', 6, { incomeMul: -0.15 }); P(c).pop *= 0.98; }, ai: () => 1 },
      { label: 'Keep trade open', effect: (c) => `${PN(c)} loses 10% of its people and gains +10 unrest; its neighbours lose 4%.`, apply: (c) => { P(c).pop *= 0.9; P(c).unrest = clamp(P(c).unrest + 10, 0, 100); for (const nb of c.sim.world.prov[c.province!].neighbors) c.sim.state.provinces[nb].pop *= 0.96; }, ai: () => 0.6 },
    ],
  },
  {
    id: 'deserters',
    title: 'Desertion in the Ranks',
    cooldownMonths: 24,
    eligible: (c) => {
      const armies = armiesOf(c.sim, c.nid);
      if (!armies.length) return null;
      const bad = armies.some((a) => a.supply < 0.4) || (warsOf(c.sim, c.nid).length > 0 && N(c).warExhaustion > 35);
      return bad ? { weight: 3 } : null;
    },
    text: () => 'Hungry, unpaid soldiers are slipping away from the depots at night.',
    choices: [
      { label: 'Pay a bonus', effect: (c) => `−${bonus(c)} crowns; all armies +0.5 morale.`, problem: (c) => pay(c, bonus(c)), apply: (c) => { N(c).treasury -= bonus(c); for (const a of armiesOf(c.sim, c.nid)) a.morale = Math.min(maxMorale(c.sim, c.nid), a.morale + 0.5); }, ai: (c) => (N(c).treasury > bonus(c) * 2 ? 1.5 : 0.3) },
      { label: 'Let them go', effect: () => 'Every army loses 5% of its men.', apply: (c) => { for (const a of armiesOf(c.sim, c.nid)) for (const r of a.regiments) r.men = Math.max(100, Math.round(r.men * 0.95)); }, ai: () => 1 },
    ],
  },
  {
    id: 'veterans',
    title: 'Veteran Officers',
    cooldownMonths: 36,
    eligible: (c) => {
      const recent = c.sim.state.reports.some((r) => r.tick >= c.sim.state.tick - months(6) && ((r.winner === 'attacker' && r.attackerNations.includes(c.nid)) || (r.winner === 'defender' && r.defenderNations.includes(c.nid))));
      return recent ? { weight: 3 } : null;
    },
    text: () => 'Officers hardened by our recent victory ask how their experience should serve the crown.',
    choices: [
      { label: 'Promote them to the line', effect: () => 'Morale recovery +25% for 2 years.', apply: (c) => modifier(c, 'veterans', 'Veteran officers', 24, { moraleRecoveryMul: 0.25 }), ai: (c) => (warsOf(c.sim, c.nid).length ? 2 : 1) },
      { label: 'Found a staff college', effect: () => '+30 research progress.', apply: (c) => { N(c).research.progress += 30; }, ai: () => 1 },
    ],
  },
  {
    id: 'goodwill',
    title: 'Foreign Goodwill',
    cooldownMonths: 36,
    eligible: (c) => {
      const o = aliveNations(c.sim).find((x) => x !== c.nid && opinion(c.sim, x, c.nid) >= 25);
      return o ? { weight: 2, other: o } : null;
    },
    text: (c) => `The court of ${ON(c)} sends gifts and proposes an exchange of scholars.`,
    choices: [
      { label: 'Exchange scholars', effect: (c) => `+25 research progress; ${ON(c)} +10 opinion of us.`, apply: (c) => { N(c).research.progress += 25; addMemory(c.sim, c.other!, c.nid, 'event', 10, 0.3); }, ai: () => 1.2 },
      { label: 'Accept the gifts', effect: () => '+40 crowns.', apply: (c) => { N(c).treasury += 40; }, ai: () => 1 },
    ],
  },
  {
    id: 'refugees',
    title: 'Refugees at the Border',
    cooldownMonths: 36,
    eligible: (c) => {
      const st = c.sim.state;
      for (const o of aliveNations(c.sim)) {
        if (o === c.nid || atWar(c.sim, c.nid, o) || !borders(c.sim, c.nid, o) || !warsOf(c.sim, o).length) continue;
        const occupied = ownedProvinces(c.sim, o).some((p) => st.provinces[p].controller !== o);
        if (!occupied) continue;
        const pid = ownIntegrated(c, (p) => c.sim.world.prov[p].neighbors.some((nb) => st.provinces[nb].owner === o))[0];
        if (pid) return { weight: 2, province: pid, other: o };
      }
      return null;
    },
    text: (c) => `Families fleeing the war in ${ON(c)} are crossing into ${PN(c)}.`,
    choices: [
      { label: 'Welcome them', effect: (c) => `−20 food; ${PN(c)} gains 5,000 people and +5 unrest; ${ON(c)} +10 opinion.`, problem: (c) => (N(c).supplies >= 20 ? null : 'Needs 20 food.'), apply: (c) => { N(c).supplies -= 20; P(c).pop += 5; P(c).unrest = clamp(P(c).unrest + 5, 0, 100); addMemory(c.sim, c.other!, c.nid, 'event', 10, 0.3); }, ai: () => 1 },
      { label: 'Close the border', effect: (c) => `${ON(c)} −10 opinion of us.`, apply: (c) => addMemory(c.sim, c.other!, c.nid, 'event', -10, 0.3), ai: () => 0.8 },
    ],
  },
  {
    id: 'inventor',
    title: 'A Brilliant Inventor',
    cooldownMonths: 48,
    eligible: (c) => (N(c).research.current && N(c).research.funding >= 1 ? { weight: 2 } : null),
    text: () => 'An engineer claims an invention that will astonish the academies — if the crown funds the laboratory.',
    choices: [
      { label: 'Fund the laboratory', effect: () => '−50 crowns; +60 research progress.', problem: (c) => pay(c, 50), apply: (c) => { N(c).treasury -= 50; N(c).research.progress += 60; }, ai: () => 1.3 },
      { label: 'Sell the patent', effect: () => '+35 crowns.', apply: (c) => { N(c).treasury += 35; }, ai: () => 1 },
    ],
  },
  {
    id: 'bankers',
    title: "Bankers' Offer",
    cooldownMonths: 36,
    eligible: (c) => (N(c).treasury < 15 ? { weight: 4 } : null),
    text: () => 'A banking house offers the crown a loan against future taxes.',
    choices: [
      { label: 'Take the loan', effect: () => '+150 crowns now; crown income −12% for 2 years.', apply: (c) => { N(c).treasury += 150; modifier(c, 'loan', 'Bank loan repayments', 24, { incomeMul: -0.12 }); }, ai: (c) => (N(c).treasury < 0 ? 2 : 0.8) },
      { label: 'Refuse', effect: () => 'No effect.', apply: () => {}, ai: () => 1 },
    ],
  },
  {
    id: 'separatists',
    title: 'Separatist Agitation',
    cooldownMonths: 24,
    eligible: (c) => {
      const st = c.sim.state;
      const pid = first(ownIntegrated(c, (p) => st.provinces[p].integration < 25 && st.provinces[p].claims.some((x) => x !== c.nid && st.nations[x]?.alive)));
      if (!pid) return null;
      const other = st.provinces[pid].claims.find((x) => x !== c.nid && st.nations[x]?.alive)!;
      return { weight: 3, province: pid, other };
    },
    text: (c) => `Agitators in ${PN(c)} call for a return to ${ON(c)}.`,
    choices: [
      { label: 'Grant autonomy', effect: (c) => `−30 crowns. ${PN(c)}: unrest −15, integration +15.`, problem: (c) => pay(c, 30), apply: (c) => { N(c).treasury -= 30; P(c).unrest = clamp(P(c).unrest - 15, 0, 100); P(c).integration = clamp(P(c).integration + 15, 0, 100); }, ai: () => 1.2 },
      { label: 'Arrest the ringleaders', effect: (c) => `${PN(c)}: unrest +10; ${ON(c)} −10 opinion.`, apply: (c) => { P(c).unrest = clamp(P(c).unrest + 10, 0, 100); addMemory(c.sim, c.other!, c.nid, 'event', -10, 0.3); }, ai: () => 0.7 },
    ],
  },
  {
    id: 'road_guild',
    title: 'Railway Syndicate',
    cooldownMonths: 48,
    eligible: (c) => {
      if (warsOf(c.sim, c.nid).length || N(c).treasury < 60) return null;
      const pid = ownIntegrated(c, (p) => c.sim.state.provinces[p].infra < 3 && !c.sim.state.provinces[p].project).sort((a, b) => c.sim.state.provinces[a].integration - c.sim.state.provinces[b].integration || (a < b ? -1 : 1))[0];
      return pid ? { weight: 2, province: pid } : null;
    },
    text: (c) => `A railway syndicate offers to lay a branch line to ${PN(c)} at a discount.`,
    choices: [
      { label: 'Sign the contract', effect: (c) => `−40 crowns; ${PN(c)} railway +1.`, problem: (c) => pay(c, 40), apply: (c) => { N(c).treasury -= 40; P(c).infra = Math.min(3, P(c).infra + 1); c.sim.state.rev++; }, ai: () => 1.4 },
      { label: 'Decline', effect: () => 'No effect.', apply: () => {}, ai: () => 0.5 },
    ],
  },
  {
    id: 'silver',
    title: 'Gold Strike',
    cooldownMonths: 60,
    eligible: (c) => {
      const pid = first(ownIntegrated(c, (p) => c.sim.state.provinces[p].integration < 60 && c.sim.state.provinces[p].lastOwnerChange > 0));
      return pid ? { weight: 2, province: pid } : null;
    },
    text: (c) => `Prospectors have struck gold in the hills of ${PN(c)}.`,
    choices: [
      { label: 'Declare a crown monopoly', effect: (c) => `+80 crowns; ${PN(c)} unrest +15.`, apply: (c) => { N(c).treasury += 80; P(c).unrest = clamp(P(c).unrest + 15, 0, 100); }, ai: () => 1 },
      { label: 'Open it to settlers', effect: (c) => `${PN(c)}: integration +20 and 3,000 settlers.`, apply: (c) => { P(c).integration = clamp(P(c).integration + 20, 0, 100); P(c).pop += 3; }, ai: () => 1.2 },
    ],
  },
  {
    id: 'war_weariness',
    title: 'War Weariness',
    cooldownMonths: 24,
    eligible: (c) => (warsOf(c.sim, c.nid).length && N(c).warExhaustion > 45 ? { weight: 4 } : null),
    text: () => 'Widows march in the capital and the unions threaten a general strike against new war taxes.',
    choices: [
      { label: 'Hold festivals and promise peace', effect: () => '−30 crowns; war exhaustion −10.', problem: (c) => pay(c, 30), apply: (c) => { N(c).treasury -= 30; N(c).warExhaustion = Math.max(0, N(c).warExhaustion - 10); }, ai: () => 1.2 },
      { label: 'Suppress dissent', effect: () => 'War exhaustion −5; unrest +8 in every province for a year.', apply: (c) => { N(c).warExhaustion = Math.max(0, N(c).warExhaustion - 5); modifier(c, 'suppression', 'Suppression', 12, { unrestAdd: 8 }); }, ai: () => 0.8 },
    ],
  },
  {
    id: 'rival_ascendant',
    title: 'A Rival Ascendant',
    cooldownMonths: 48,
    eligible: (c) => {
      const lead = c.sim.state.nations;
      for (const o of aliveNations(c.sim)) {
        if (o === c.nid) continue;
        const s = lead[o].victoryStreak;
        if (s.territorial >= 12 || s.economic >= 24 || s.diplomatic >= 18) return { weight: 5, other: o };
      }
      return null;
    },
    text: (c) => `${ON(c)} is close to mastering the continent. Our court debates whether to rally others against them or to seek their favour.`,
    choices: [
      { label: 'Denounce them', effect: (c) => `Every other realm's alarm about ${ON(c)} +10; our trust −3; ${ON(c)} −20 opinion.`, apply: (c) => { for (const x of aliveNations(c.sim)) if (x !== c.other) addAlarm(c.sim, x, c.other!, 10); N(c).trust = Math.max(0, N(c).trust - 3); addMemory(c.sim, c.other!, c.nid, 'event', -20, 0.3); }, ai: () => 1.3 },
      { label: 'Seek their favour', effect: (c) => `${ON(c)} +15 opinion of us.`, apply: (c) => addMemory(c.sim, c.other!, c.nid, 'event', 15, 0.3), ai: () => 0.7 },
    ],
  },
  {
    id: 'alarm',
    title: 'Neighbours Take Alarm',
    cooldownMonths: 36,
    eligible: (c) => {
      const worried = aliveNations(c.sim).filter((x) => x !== c.nid && (c.sim.state.alarm[x]?.[c.nid] ?? 0) >= 35);
      return worried.length ? { weight: 4, other: worried[0] } : null;
    },
    text: (c) => `Envoys report that ${ON(c)} and others fear our ambitions and speak of a coalition.`,
    choices: [
      { label: 'Send reassurances', effect: () => '−50 crowns; every realm\'s alarm about us −15.', problem: (c) => pay(c, 50), apply: (c) => { N(c).treasury -= 50; for (const x of aliveNations(c.sim)) { const row = c.sim.state.alarm[x]; if (row?.[c.nid]) row[c.nid] = Math.max(0, row[c.nid] - 15); } }, ai: (c) => (enemiesOf(c.sim, c.nid).length ? 0.8 : 1.3) },
      { label: 'Ignore them', effect: () => 'No effect.', apply: () => {}, ai: () => 0.6 },
    ],
  },
  {
    id: 'strike',
    title: 'Factory Strike',
    cooldownMonths: 30,
    eligible: (c) => {
      const pid = first(ownIntegrated(c, (p) => c.sim.state.provinces[p].factories >= 1 && c.sim.state.provinces[p].unrest >= 10));
      return pid ? { weight: 3, province: pid } : null;
    },
    text: (c) => `The workers of ${PN(c)} have walked out of the mills, demanding shorter hours and higher pay.`,
    choices: [
      { label: 'Meet their demands', effect: (c) => `−40 crowns. ${PN(c)}: unrest −10.`, problem: (c) => pay(c, 40), apply: (c) => { N(c).treasury -= 40; P(c).unrest = clamp(P(c).unrest - 10, 0, 100); }, ai: (c) => (N(c).treasury > 100 ? 1.5 : 0.5) },
      { label: 'Break the strike', effect: (c) => `Industrial capacity −10% for 6 months. ${PN(c)}: unrest +10.`, apply: (c) => { modifier(c, 'strike', 'Strike broken', 6, { industryMul: -0.1 }); P(c).unrest = clamp(P(c).unrest + 10, 0, 100); }, ai: () => 1 },
    ],
  },
  {
    id: 'mine_disaster',
    title: 'Mine Disaster',
    cooldownMonths: 48,
    eligible: (c) => {
      const pid = first(ownIntegrated(c, (p) => ['coal', 'iron'].includes(c.sim.world.prov[p].resource ?? '')));
      return pid ? { weight: 1, province: pid } : null;
    },
    text: (c) => `Fire-damp has exploded in a pit at ${PN(c)}. The town mourns, and the miners ask who will pay.`,
    choices: [
      { label: 'Fund relief and inspectors', effect: (c) => `−30 crowns. ${PN(c)}: unrest −5.`, problem: (c) => pay(c, 30), apply: (c) => { N(c).treasury -= 30; P(c).unrest = clamp(P(c).unrest - 5, 0, 100); }, ai: () => 1.3 },
      { label: 'Keep the pits working', effect: (c) => `${PN(c)}: unrest +12.`, apply: (c) => { P(c).unrest = clamp(P(c).unrest + 12, 0, 100); }, ai: () => 0.7 },
    ],
  },
  {
    id: 'oil_boom',
    title: 'Oil Boom',
    cooldownMonths: 60,
    eligible: (c) => {
      const pid = first(ownIntegrated(c, (p) => c.sim.world.prov[p].resource === 'oil'));
      return pid ? { weight: 2, province: pid } : null;
    },
    text: (c) => `Gushers at ${PN(c)} draw speculators from across the continent.`,
    choices: [
      { label: 'License the wells', effect: () => '+70 crowns.', apply: (c) => { N(c).treasury += 70; }, ai: () => 1 },
      { label: 'Keep it for the crown', effect: () => '+25 oil (up to the stockpile limit).', apply: (c) => { N(c).stock.oil = Math.min(resourceCap(c.sim, c.nid), N(c).stock.oil + 25); }, ai: (c) => (N(c).stock.oil < resourceCap(c.sim, c.nid) * 0.4 ? 1.5 : 0.5) },
    ],
  },
];

function bonus(c: EventCtx): number {
  let regs = 0;
  for (const a of armiesOf(c.sim, c.nid)) regs += a.regiments.length;
  return Math.max(10, regs * 4);
}

export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
