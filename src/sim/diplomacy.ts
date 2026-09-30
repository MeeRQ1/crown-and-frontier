// Diplomacy: opinion (with visible causes), remembered actions, envoys,
// treaties, alarm about expansion, coalitions and pending proposals.
//
// Acceptance is a transparent score: every term is listed with its value and
// the proposal is accepted when the total is >= 0. No hidden dice.

import { C } from './config';
import { PERSONALITIES } from './data/personalities';
import { POLICIES } from './data/policies';
import { tradeValue } from './economy';
import { nationStrength } from './military';
import { nationMods } from './modifiers';
import {
  aliveNations,
  alliesOf,
  atWar,
  borders,
  bump,
  clamp,
  enemiesOf,
  hasTreaty,
  months,
  nationDistance,
  nationName,
  notify,
  ownedProvinces,
  provName,
  treatyPartners,
  warsOf,
  type Sim,
} from './state';
import type { CommandResult, Memory, NationId, ProvinceId, Proposal, TreatyType, VictoryPath } from './types';

export const MEMORY_LABELS: Record<string, string> = {
  envoy: 'Envoy improved relations',
  war: 'Declared war on us',
  conquest: 'Took our land',
  allyAttacked: 'Attacked our ally',
  betrayal: 'Broke a treaty with us',
  honored: 'Honoured our alliance',
  dishonored: 'Abandoned us in war',
  fabricate: 'Fabricated claims on us',
  rebuffed: 'Rebuffed our proposal',
  event: 'Recent dealings',
  liberated: 'Liberated our land',
  rivalBid: 'Wary of their bid for diplomatic leadership',
  separatePeace: 'Made a separate peace and left us fighting',
};

export const TREATY_LABELS: Record<TreatyType, string> = {
  nap: 'Non-aggression pact',
  trade: 'Trade agreement',
  alliance: 'Defensive alliance',
};

// ───────────────────────────── Memories & opinion ───────────────────────────

export function memoriesOf(sim: Sim, holder: NationId, about: NationId): Memory[] {
  const m = (sim.state.memories[holder] ??= {});
  return (m[about] ??= []);
}

export function addMemory(sim: Sim, holder: NationId, about: NationId, kind: string, value: number, decay: number): void {
  if (holder === about) return;
  const list = memoriesOf(sim, holder, about);
  const ex = list.find((x) => x.kind === kind);
  if (ex) {
    ex.value = clamp(ex.value + value, -80, 80);
    ex.decay = decay;
  } else list.push({ kind, value, decay });
}

export interface OpinionPart {
  label: string;
  value: number;
}

/** Why `a` regards `b` the way it does. */
export function opinionParts(sim: Sim, a: NationId, b: NationId): OpinionPart[] {
  const parts: OpinionPart[] = [];
  if (a === b) return parts;
  for (const m of memoriesOf(sim, a, b)) if (Math.abs(m.value) >= 0.5) parts.push({ label: MEMORY_LABELS[m.kind] ?? m.kind, value: m.value });
  if (borders(sim, a, b)) parts.push({ label: 'Border friction', value: C.diplomacy.borderFriction });
  if (hasTreaty(sim, 'alliance', a, b)) parts.push({ label: 'Defensive alliance', value: C.diplomacy.allianceOpinion });
  if (hasTreaty(sim, 'nap', a, b)) parts.push({ label: 'Non-aggression pact', value: C.diplomacy.napOpinion });
  if (hasTreaty(sim, 'trade', a, b)) parts.push({ label: 'Trade agreement', value: C.diplomacy.tradeOpinion });
  const ea = enemiesOf(sim, a);
  const eb = enemiesOf(sim, b);
  if (ea.some((x) => eb.includes(x))) parts.push({ label: 'Common enemy', value: C.diplomacy.commonEnemy });
  const alarm = sim.state.alarm[a]?.[b] ?? 0;
  if (alarm >= 1) parts.push({ label: `Alarmed by their conquests or power (${Math.round(alarm)})`, value: -alarm * C.diplomacy.alarmOpinion });
  const trust = sim.state.nations[b].trust;
  const tv = (trust - 50) * 0.3;
  if (Math.abs(tv) >= 0.5) parts.push({ label: `Their reputation (trust ${Math.round(trust)})`, value: tv });
  const om = nationMods(sim, b).opinion;
  if (om) parts.push({ label: 'Their diplomatic standing', value: om });
  if (claimsOn(sim, a, b).length) parts.push({ label: 'They hold land we claim', value: -10 });
  if (claimsOn(sim, b, a).length) parts.push({ label: 'They claim our land', value: -5 });
  if (atWar(sim, a, b)) parts.push({ label: 'At war', value: -40 });
  if (sim.state.coalitions.some((c) => c.target === b && c.members.includes(a))) parts.push({ label: 'Coalition against them', value: -20 });
  return parts;
}

export function opinion(sim: Sim, a: NationId, b: NationId): number {
  let v = 0;
  for (const p of opinionParts(sim, a, b)) v += p.value;
  return clamp(Math.round(v), -100, 100);
}

const claimIndex = new WeakMap<object, { key: string; map: Map<string, ProvinceId[]> }>();

/**
 * Provinces owned by `target` that `nid` holds a claim on. Indexed once per
 * state revision (every change of ownership or claims bumps the revision).
 */
export function claimsOn(sim: Sim, nid: NationId, target: NationId): ProvinceId[] {
  const key = `${sim.state.tick}|${sim.state.rev}`;
  let idx = claimIndex.get(sim.state);
  if (!idx || idx.key !== key) {
    const map = new Map<string, ProvinceId[]>();
    for (const pid of sim.world.provIds) {
      const p = sim.state.provinces[pid];
      if (!p.owner) continue;
      for (const c of p.claims) {
        const k = `${c}|${p.owner}`;
        (map.get(k) ?? map.set(k, []).get(k)!).push(pid);
      }
    }
    idx = { key, map };
    claimIndex.set(sim.state, idx);
  }
  return [...(idx.map.get(`${nid}|${target}`) ?? [])];
}

// ───────────────────────────── Envoys ───────────────────────────────────────

export function envoySlots(sim: Sim, nid: NationId): number {
  return C.diplomacy.envoysBase + nationMods(sim, nid).envoys;
}

export function envoyProblem(sim: Sim, from: NationId, to: NationId): string | null {
  const st = sim.state;
  if (!st.nations[from]?.alive || !st.nations[to]?.alive) return 'That realm no longer exists.';
  if (from === to) return 'Cannot send an envoy to yourself.';
  if (atWar(sim, from, to)) return 'Cannot improve relations while at war.';
  if (st.envoys.some((e) => e.from === from && e.to === to)) return 'An envoy is already at their court.';
  const used = st.envoys.filter((e) => e.from === from).length;
  if (used >= envoySlots(sim, from)) return `All ${envoySlots(sim, from)} envoys are busy.`;
  if (st.nations[from].treasury < C.diplomacy.envoyCost) return 'Cannot afford the envoy.';
  return null;
}

export function startEnvoy(sim: Sim, from: NationId, to: NationId): void {
  sim.state.envoys.push({ from, to, until: sim.state.tick + months(C.diplomacy.envoyMonths) });
}

export function recallEnvoy(sim: Sim, from: NationId, to: NationId): void {
  sim.state.envoys = sim.state.envoys.filter((e) => !(e.from === from && e.to === to));
}

// ───────────────────────────── Treaties ─────────────────────────────────────

export function treatyProblem(sim: Sim, from: NationId, to: NationId, type: TreatyType): string | null {
  const st = sim.state;
  if (!st.nations[from]?.alive || !st.nations[to]?.alive) return 'That realm no longer exists.';
  if (from === to) return 'Cannot sign a treaty with yourself.';
  if (hasTreaty(sim, type, from, to)) return `A ${TREATY_LABELS[type].toLowerCase()} already exists.`;
  if (atWar(sim, from, to)) return 'You are at war with them.';
  if (type === 'alliance') {
    for (const e of enemiesOf(sim, from)) if (hasTreaty(sim, 'alliance', to, e)) return `Conflicting commitments: they are allied to ${nationName(sim, e)}, your enemy.`;
    for (const e of enemiesOf(sim, to)) if (hasTreaty(sim, 'alliance', from, e)) return `Conflicting commitments: you are allied to ${nationName(sim, e)}, their enemy.`;
    if (sim.state.coalitions.some((c) => (c.target === from && c.members.includes(to)) || (c.target === to && c.members.includes(from))))
      return 'A coalition member cannot ally with the coalition target.';
  }
  if (sim.state.proposals.some((p) => p.kind === type && ((p.from === from && p.to === to) || (p.from === to && p.to === from))))
    return 'A proposal is already awaiting an answer.';
  return null;
}

export interface Evaluation {
  accept: boolean;
  score: number;
  reasons: OpinionPart[];
}

/** How `to` evaluates a treaty offered by `from`. Same rules for every nation. */
export function evaluateTreaty(sim: Sim, from: NationId, to: NationId, type: TreatyType): Evaluation {
  const st = sim.state;
  const reasons: OpinionPart[] = [];
  const add = (label: string, value: number) => {
    if (Math.abs(value) >= 0.5) reasons.push({ label, value: Math.round(value) });
  };
  const op = opinion(sim, to, from);
  const trust = st.nations[from].trust;
  const pers = PERSONALITIES[st.nations[to].ai.personality];
  const sFrom = nationStrength(sim, from);
  const sTo = Math.max(0.5, nationStrength(sim, to));
  const dist = nationDistance(sim, from, to);
  const plan = st.nations[to].ai.warPlan;
  if (plan && plan.target === from) add('We have designs on their land', -100);
  if (type === 'nap') {
    add('Base reluctance', -10);
    add(`Opinion of them (${op})`, op * 0.4);
    add(`Their trust (${Math.round(trust)})`, (trust - 50) * 0.4);
    if (sFrom > sTo * 1.2) add('They are stronger: a pact keeps us safe', 15);
    else if (sTo > sFrom * 1.1 && pers.aggression >= 1) add('They are weaker: a pact would bind our hands', -Math.min(30, (sTo / Math.max(0.5, sFrom) - 1) * 20 * pers.aggression));
    if (claimsOn(sim, to, from).length) add('We claim their land', -15);
    if (dist <= 1) add('Neighbours', 5);
    else if (dist > 3) add('Too distant to matter', -10);
    add(`${pers.label} outlook`, (pers.treaty.nap - 1) * 20);
  } else if (type === 'trade') {
    add('Base', 0);
    add(`Opinion of them (${op})`, op * 0.5);
    add(`Their trust (${Math.round(trust)})`, (trust - 50) * 0.3);
    const tv = tradeValue(sim, to, from);
    add(`Trade would earn us ${tv.toFixed(1)} crowns/month`, Math.min(15, tv * 2));
    if (enemiesOf(sim, to).some((e) => alliesOf(sim, from).includes(e))) add('They are allied to our enemy', -20);
    add(`${pers.label} outlook`, (pers.treaty.trade - 1) * 25);
  } else {
    add('Base reluctance', -25);
    add(`Opinion of them (${op})`, op * 0.5);
    add(`Their trust (${Math.round(trust)})`, (trust - 50) * 0.5);
    const threat = sharedThreat(sim, from, to);
    if (threat) add(`Shared threat: ${nationName(sim, threat)}`, 25);
    const ratio = sFrom / sTo;
    if (ratio >= 0.5) add('A useful military partner', 10);
    else if (ratio < 0.3) add('Too weak to help us', -15);
    if (warsOf(sim, from).length) add('They are at war', -10);
    if (dist > 2) add('Too far away to help', -20);
    if (claimsOn(sim, to, from).length) add('We claim their land', -25);
    const allies = alliesOf(sim, to).length;
    if (allies >= 2) add('We already have enough allies', -30);
    add(`${pers.label} outlook`, (pers.treaty.alliance - 1) * 25);
  }
  const score = reasons.reduce((s, r) => s + r.value, 0);
  return { accept: score >= 0, score, reasons };
}

/** A nation both parties fear, or a strong hostile neighbour of both. */
export function sharedThreat(sim: Sim, a: NationId, b: NationId): NationId | null {
  const st = sim.state;
  for (const t of aliveNations(sim)) {
    if (t === a || t === b) continue;
    const aa = st.alarm[a]?.[t] ?? 0;
    const ab = st.alarm[b]?.[t] ?? 0;
    if (aa >= 20 && ab >= 20) return t;
    if (atWar(sim, a, t) && (borders(sim, b, t) || ab >= 15)) return t;
    if (atWar(sim, b, t) && (borders(sim, a, t) || aa >= 15)) return t;
  }
  return null;
}

export function signTreaty(sim: Sim, type: TreatyType, a: NationId, b: NationId): void {
  const st = sim.state;
  st.counters.treaty++;
  st.treaties.push({
    id: `t${st.counters.treaty}`,
    type,
    a,
    b,
    since: st.tick,
    until: type === 'nap' ? st.tick + months(C.diplomacy.napMonths) : null,
  });
  bump(sim);
}

export function removeTreaty(sim: Sim, type: TreatyType, a: NationId, b: NationId): boolean {
  const before = sim.state.treaties.length;
  sim.state.treaties = sim.state.treaties.filter((t) => !(t.type === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a))));
  if (sim.state.treaties.length !== before) {
    bump(sim);
    return true;
  }
  return false;
}

/** Offers a treaty. AI targets answer immediately; a human target gets a pending proposal. */
export function proposeTreaty(sim: Sim, from: NationId, to: NationId, type: TreatyType): CommandResult {
  const prob = treatyProblem(sim, from, to, type);
  if (prob) return { ok: false, reason: prob };
  const target = sim.state.nations[to];
  if (target.isPlayer) {
    addProposal(sim, { kind: type, from, to });
    notify(sim, to, 'normal', 'proposal', `${nationName(sim, from)} proposes a ${TREATY_LABELS[type].toLowerCase()}.`);
    return { ok: true, message: 'Proposal sent.' };
  }
  const ev = evaluateTreaty(sim, from, to, type);
  if (!ev.accept) {
    const top = [...ev.reasons].sort((x, y) => x.value - y.value).slice(0, 3).map((r) => `${r.label} (${r.value > 0 ? '+' : ''}${r.value})`);
    return { ok: false, reason: `${nationName(sim, to)} declines (score ${Math.round(ev.score)}): ${top.join('; ')}.` };
  }
  signTreaty(sim, type, from, to);
  notify(sim, from, 'normal', 'treaty', `${nationName(sim, to)} accepted a ${TREATY_LABELS[type].toLowerCase()}.`);
  notify(sim, to, 'low', 'treaty', `We signed a ${TREATY_LABELS[type].toLowerCase()} with ${nationName(sim, from)}.`);
  return { ok: true, message: `${nationName(sim, to)} accepts.` };
}

export function cancelTreatyProblem(sim: Sim, nid: NationId, other: NationId, type: TreatyType): string | null {
  if (!hasTreaty(sim, type, nid, other)) return 'No such treaty.';
  return null;
}

export function cancelTreaty(sim: Sim, nid: NationId, other: NationId, type: TreatyType): void {
  const st = sim.state;
  removeTreaty(sim, type, nid, other);
  const n = st.nations[nid];
  if (type === 'trade') addMemory(sim, other, nid, 'betrayal', -15, 0.5);
  if (type === 'nap') {
    addMemory(sim, other, nid, 'betrayal', -30, 0.3);
    n.trust = Math.max(0, n.trust - 10);
    // a cancelled pact leaves a 12-month cooling-off period before war is possible
    st.truces.push({ a: nid, b: other, until: st.tick + months(12) });
  }
  if (type === 'alliance') {
    const inWar = warsOf(sim, other).length > 0;
    addMemory(sim, other, nid, inWar ? 'dishonored' : 'betrayal', inWar ? -40 : -25, 0.3);
    if (inWar) n.trust = Math.max(0, n.trust - 15);
  }
  notify(sim, other, 'normal', 'treaty', `${nationName(sim, nid)} cancelled their ${TREATY_LABELS[type].toLowerCase()} with us.`);
}

// ───────────────────────────── Claims ───────────────────────────────────────

export function fabricateProblem(sim: Sim, nid: NationId, pid: ProvinceId): string | null {
  const st = sim.state;
  const p = st.provinces[pid];
  if (!p) return 'Unknown province.';
  if (!p.owner || p.owner === nid) return 'Claims can only be fabricated on provinces owned by another realm.';
  if (p.claims.includes(nid)) return 'We already hold a claim here.';
  if (st.fabrications.some((f) => f.nation === nid && f.province === pid)) return 'Our agents are already forging this claim.';
  if (st.fabrications.filter((f) => f.nation === nid).length >= 1) return 'Only one claim can be fabricated at a time.';
  const adjacent = sim.world.prov[pid].neighbors.some((nb) => st.provinces[nb].owner === nid);
  if (!adjacent) return 'Claims can only be fabricated on provinces bordering our own.';
  if (st.nations[nid].treasury < C.diplomacy.fabricateCost) return `Needs ${C.diplomacy.fabricateCost} crowns.`;
  return null;
}

export function startFabrication(sim: Sim, nid: NationId, pid: ProvinceId): void {
  const st = sim.state;
  st.nations[nid].treasury -= C.diplomacy.fabricateCost;
  st.fabrications.push({ nation: nid, province: pid, until: st.tick + months(C.diplomacy.fabricateMonths) });
  const owner = st.provinces[pid].owner!;
  addMemory(sim, owner, nid, 'fabricate', -15, 0.4);
  st.nations[nid].trust = Math.max(0, st.nations[nid].trust - 2);
}

// ───────────────────────────── Alarm & coalitions ───────────────────────────

export function worldDev(sim: Sim): number {
  let d = 0;
  for (const pid of sim.world.provIds) d += sim.state.provinces[pid].dev;
  return d;
}

export function devShare(sim: Sim, nid: NationId): number {
  let d = 0;
  for (const pid of ownedProvinces(sim, nid)) d += sim.state.provinces[pid].dev;
  return d / Math.max(1, worldDev(sim));
}

/** Conquest of `pid` by `conqueror` alarms nearby realms (proximity, size, province value). */
export function alarmForConquest(sim: Sim, conqueror: NationId, pid: ProvinceId): void {
  const st = sim.state;
  const size = 0.6 + 4 * devShare(sim, conqueror);
  const dev = st.provinces[pid].dev;
  const gen = Math.max(0, 1 + nationMods(sim, conqueror).alarmGen);
  for (const nid of aliveNations(sim)) {
    if (nid === conqueror || hasTreaty(sim, 'alliance', nid, conqueror)) continue;
    let d = Infinity;
    for (const q of ownedProvinces(sim, nid)) d = Math.min(d, sim.world.hops[q][pid] ?? Infinity);
    const prox = d <= 1 ? 1 : d === 2 ? 0.6 : d === 3 ? 0.3 : d === 4 ? 0.15 : 0;
    if (!prox) continue;
    const add = (dev + 3) * prox * size * C.diplomacy.alarmConquestMul * gen;
    const row = (st.alarm[nid] ??= {});
    row[conqueror] = clamp((row[conqueror] ?? 0) + add, 0, 100);
  }
}

export function addAlarm(sim: Sim, holder: NationId, about: NationId, v: number): void {
  const row = (sim.state.alarm[holder] ??= {});
  row[about] = clamp((row[about] ?? 0) + v, 0, 100);
}

export function coalitionAgainst(sim: Sim, target: NationId) {
  return sim.state.coalitions.find((c) => c.target === target);
}

/** The victory path a realm has visibly held long enough to worry its rivals, if any. */
export function visibleBid(sim: Sim, nid: NationId): VictoryPath | null {
  const s = sim.state.nations[nid].victoryStreak;
  const need: Record<VictoryPath, number> = { territorial: C.victory.territorialMonths, economic: C.victory.economicMonths, diplomatic: C.victory.diplomaticMonths };
  let best: VictoryPath | null = null;
  let bf = 0;
  for (const k of ['territorial', 'economic', 'diplomatic'] as const) {
    const f = s[k] / need[k];
    if (f >= C.victory.rivalReaction && f > bf) {
      best = k;
      bf = f;
    }
  }
  return best;
}

export function joinCoalitionProblem(sim: Sim, nid: NationId, target: NationId): string | null {
  const st = sim.state;
  if (nid === target) return 'Cannot join a coalition against yourself.';
  if (!st.nations[target]?.alive) return 'That realm no longer exists.';
  const c = coalitionAgainst(sim, target);
  if (c?.members.includes(nid)) return 'Already a member.';
  const alarm = st.alarm[nid]?.[target] ?? 0;
  if (alarm < C.diplomacy.alarmCoalition) return `Alarm about ${nationName(sim, target)} must reach ${C.diplomacy.alarmCoalition} (now ${Math.round(alarm)}).`;
  if (hasTreaty(sim, 'alliance', nid, target)) return 'Cannot join a coalition against an ally.';
  return null;
}

export function joinCoalition(sim: Sim, nid: NationId, target: NationId): void {
  const st = sim.state;
  let c = coalitionAgainst(sim, target);
  if (!c) {
    st.counters.coalition++;
    c = { id: `c${st.counters.coalition}`, target, members: [], since: st.tick };
    st.coalitions.push(c);
    const bid = visibleBid(sim, target);
    const why = bid ? `Our bid for ${bid === 'territorial' ? 'territorial dominance' : 'economic prosperity'} has alarmed our neighbours.` : 'Our expansion has alarmed our neighbours.';
    notify(sim, target, 'urgent', 'coalition', `A coalition has formed against us, led by ${nationName(sim, nid)}. ${why}`);
  }
  if (!c.members.includes(nid)) c.members.push(nid);
  c.members.sort();
  bump(sim);
}

export function leaveCoalition(sim: Sim, nid: NationId, target: NationId): void {
  const c = coalitionAgainst(sim, target);
  if (!c) return;
  c.members = c.members.filter((m) => m !== nid);
  bump(sim);
}

function updateCoalitions(sim: Sim): void {
  const st = sim.state;
  for (const target of aliveNations(sim)) {
    const alarmed = aliveNations(sim).filter(
      (n) => n !== target && (st.alarm[n]?.[target] ?? 0) >= C.diplomacy.alarmCoalition && !hasTreaty(sim, 'alliance', n, target),
    );
    let c = coalitionAgainst(sim, target);
    if (c) {
      c.members = c.members.filter(
        (m) => st.nations[m]?.alive && (st.alarm[m]?.[target] ?? 0) >= C.diplomacy.alarmLeave && !hasTreaty(sim, 'alliance', m, target),
      );
    }
    const aiAlarmed = alarmed.filter((n) => !st.nations[n].isPlayer);
    if (!c && aiAlarmed.length >= 2) {
      for (const n of aiAlarmed) joinCoalition(sim, n, target);
      c = coalitionAgainst(sim, target);
    } else if (c) {
      for (const n of aiAlarmed) if (!c.members.includes(n)) c.members.push(n);
      c.members.sort();
    }
    for (const n of alarmed) {
      if (st.nations[n].isPlayer && !(c?.members.includes(n)) && (aiAlarmed.length >= 1 || c)) {
        if ((st.tick / 4) % 12 === 0)
          notify(sim, n, 'normal', 'coalition', `Alarm about ${nationName(sim, target)} is high: you may join a coalition against them (Diplomacy).`);
      }
    }
    if (c && c.members.length < 2) {
      st.coalitions = st.coalitions.filter((x) => x !== c);
      notify(sim, target, 'normal', 'coalition', 'The coalition against us has dissolved.');
      bump(sim);
    }
  }
}

// ───────────────────────────── Proposals ────────────────────────────────────

export function addProposal(sim: Sim, p: Omit<Proposal, 'id' | 'tick' | 'expires'> & { expires?: number }): Proposal {
  const st = sim.state;
  st.counters.proposal++;
  const prop: Proposal = { id: `pr${st.counters.proposal}`, tick: st.tick, expires: p.expires ?? st.tick + C.diplomacy.proposalWeeks, ...p } as Proposal;
  st.proposals.push(prop);
  return prop;
}

export function proposalsFor(sim: Sim, nid: NationId): Proposal[] {
  return sim.state.proposals.filter((p) => p.to === nid);
}

// ───────────────────────────── Monthly upkeep ───────────────────────────────

export function monthlyDiplomacy(sim: Sim): void {
  const st = sim.state;
  const tick = st.tick;
  // envoys
  for (const e of st.envoys) {
    if (!st.nations[e.to]?.alive) continue;
    const gain = C.diplomacy.envoyGain * Math.max(0, 1 + nationMods(sim, e.from).relationGain);
    const list = memoriesOf(sim, e.to, e.from);
    const m = list.find((x) => x.kind === 'envoy');
    if (m) m.value = Math.min(C.diplomacy.envoyCap, m.value + gain);
    else list.push({ kind: 'envoy', value: gain, decay: 0.5 });
  }
  const ended = st.envoys.filter((e) => e.until <= tick || !st.nations[e.to]?.alive || atWar(sim, e.from, e.to));
  st.envoys = st.envoys.filter((e) => !ended.includes(e));
  for (const e of ended) if (st.nations[e.from]?.alive) notify(sim, e.from, 'low', 'envoy', `Our envoy has returned from ${nationName(sim, e.to)}.`);
  // memory decay (envoy memory holds while an envoy is present)
  for (const a in st.memories) {
    for (const b in st.memories[a]) {
      const envoyActive = st.envoys.some((e) => e.from === b && e.to === a);
      st.memories[a][b] = st.memories[a][b].filter((m) => {
        if (m.kind === 'envoy' && envoyActive) return true;
        if (m.value > 0) m.value = Math.max(0, m.value - m.decay);
        else m.value = Math.min(0, m.value + m.decay);
        return Math.abs(m.value) >= 0.5;
      });
    }
  }
  // alarm decay
  for (const a in st.alarm) {
    for (const b in st.alarm[a]) {
      const dec = C.diplomacy.alarmDecay * Math.max(0.2, 1 + (st.nations[b]?.alive ? nationMods(sim, b).alarmDecay : 1));
      st.alarm[a][b] = Math.max(0, st.alarm[a][b] - dec);
      if (st.alarm[a][b] <= 0) delete st.alarm[a][b];
    }
  }
  // treaty expiry
  const expired = st.treaties.filter((t) => t.until !== null && t.until <= tick);
  if (expired.length) {
    st.treaties = st.treaties.filter((t) => !expired.includes(t));
    for (const t of expired) {
      notify(sim, t.a, 'low', 'treaty', `Our ${TREATY_LABELS[t.type].toLowerCase()} with ${nationName(sim, t.b)} has expired.`);
      notify(sim, t.b, 'low', 'treaty', `Our ${TREATY_LABELS[t.type].toLowerCase()} with ${nationName(sim, t.a)} has expired.`);
    }
    bump(sim);
  }
  st.truces = st.truces.filter((t) => t.until > tick);
  // trust recovers slowly toward 75
  for (const nid of aliveNations(sim)) {
    const n = st.nations[nid];
    if (n.trust < 75) n.trust = Math.min(75, n.trust + C.diplomacy.trustRecovery * Math.max(0, 1 + nationMods(sim, nid).trustGain));
  }
  // claim fabrication
  const doneFab = st.fabrications.filter((f) => f.until <= tick);
  st.fabrications = st.fabrications.filter((f) => f.until > tick);
  for (const f of doneFab) {
    const p = st.provinces[f.province];
    if (p.owner && p.owner !== f.nation && !p.claims.includes(f.nation)) {
      p.claims.push(f.nation);
      bump(sim);
      notify(sim, f.nation, 'normal', 'claim', `We now hold a claim on ${provName(sim, f.province)}.`, { province: f.province });
    }
  }
  updateCoalitions(sim);
}

/** Policy restriction check used by war declarations. */
export function claimsOnlyPolicy(sim: Sim, nid: NationId): boolean {
  return !!POLICIES[sim.state.nations[nid].policy]?.claimsOnly;
}

export { treatyPartners };
