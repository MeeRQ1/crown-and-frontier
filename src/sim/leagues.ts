// Voluntary offensive leagues (format 9): allies who explicitly agree to join each
// other's deliberate wars. An alliance alone stays defensive; the league is the extra,
// offensive commitment, and it binds only those who accepted it.
//
// Rules (player and AI alike):
//  - members: at most four, each allied (an ordinary defensive alliance) with every
//    other and of good opinion of each (25 or more both ways) when admitted; a realm
//    belongs to one league at most; who left one waits two years to join another;
//  - admission is explicit: the player accepts in the dock; an AI realm weighs common
//    interests and rivals, the members' appetite for war, its own commitments to their
//    likely targets, its means and its outlook — good relations make it eligible, never
//    obliged; a declined proposal is not repeated within a year;
//  - the commitment: when a member deliberately declares a war (a claim or a conquest),
//    every other bound member joins it on the attacking side at once, once, against
//    that target — unless the ordinary rules forbid it (an alliance or pact with a
//    defender, a truce, a war with an attacker, being the target): then it says why and
//    nothing else happens. The joins are not declarations: they never trigger another
//    league, a coalition war or a call to arms of their own;
//  - joining a league never enrols a realm in a war already under way;
//  - a member whose alliance with another member ends, or whose opinion of one falls
//    below 0, is suspended (not bound) until both hold again; leaving takes effect at
//    once for future wars, leaves the wars already joined as they are, and costs the
//    other members' good opinion; a league of fewer than two bound members dissolves.

import { addMemory, opinion } from './diplomacy';
import { aliveNations, alliesOf, atWar, enemiesOf, hasTreaty, nationName, notify, truceUntil, type Sim } from './state';
import type { League, NationId, War } from './types';
import { canJoin, joinWar } from './war';

export const LEAGUE = { maxMembers: 4, opinionJoin: 25, opinionStay: 0, rejoinWeeks: 104, proposalWeeks: 52, recordMax: 20 };

export function leagueOf(sim: Sim, nid: NationId): League | null {
  return (sim.state.leagues ?? []).find((l) => l.members.includes(nid)) ?? null;
}

export function boundMembers(l: League): NationId[] {
  return l.members.filter((m) => !l.suspended[m]);
}

/** Why `a` and `b` could not be in a league together now (null: they could). */
export function pairProblem(sim: Sim, a: NationId, b: NationId, threshold = LEAGUE.opinionJoin): string | null {
  if (!hasTreaty(sim, 'alliance', a, b)) return `${nationName(sim, a)} and ${nationName(sim, b)} are not allied (a league needs an ordinary alliance between every two members)`;
  if (atWar(sim, a, b)) return `${nationName(sim, a)} and ${nationName(sim, b)} are at war`;
  const ab = opinion(sim, a, b);
  const ba = opinion(sim, b, a);
  if (ab < threshold || ba < threshold) return `opinion between ${nationName(sim, a)} and ${nationName(sim, b)} is ${Math.round(Math.min(ab, ba))} (${threshold} or more needed)`;
  return null;
}

export function proposeLeagueProblem(sim: Sim, from: NationId, to: NationId): string | null {
  const st = sim.state;
  if (!st.nations[to]?.alive || from === to) return 'Choose another realm.';
  if (leagueOf(sim, to)) return `${nationName(sim, to)} already belongs to a league.`;
  const mine = leagueOf(sim, from);
  if (mine && mine.suspended[from]) return `We are suspended from our league (${mine.suspended[from]}).`;
  if (mine && mine.members.length >= LEAGUE.maxMembers) return `A league has at most ${LEAGUE.maxMembers} members.`;
  const recent = (nid: NationId) => st.nations[nid].leagueLeft !== undefined && st.tick - st.nations[nid].leagueLeft! < LEAGUE.rejoinWeeks;
  if (recent(to)) return `${nationName(sim, to)} left a league recently: it may join another two years after.`;
  if (!mine && recent(from)) return 'We left a league recently: we may found another two years after.';
  for (const m of mine ? boundMembers(mine) : [from]) {
    const p = pairProblem(sim, m, to);
    if (p) return `Not eligible: ${p}.`;
  }
  if (st.proposals.some((p) => p.kind === 'league' && ((p.from === from && p.to === to) || (p.from === to && p.to === from)))) return 'A league proposal between us is awaiting an answer.';
  const last = st.nations[from].ai.lastProposal[`${to}:league`];
  if (last !== undefined && st.tick - last < LEAGUE.proposalWeeks) return `We proposed a league to ${nationName(sim, to)} less than a year ago.`;
  return null;
}

/** What membership would bind a realm to, in words (shown before it is accepted). */
export function leagueTerms(sim: Sim, from: NationId, to: NationId): string {
  const l = leagueOf(sim, from);
  const members = l ? l.members : [from];
  return `Members: ${[...members, to].map((m) => nationName(sim, m)).join(', ')}. Whenever a member deliberately declares a war of claim or conquest, every other member joins it on the attacking side at once — unless an alliance or pact with the target's side, a truce, or a war with an attacker forbids it. It does not bring us into wars already under way. Leaving is possible at any time (for future wars only) and costs the members' good opinion.`;
}

export interface LeagueEvaluation {
  accept: boolean;
  score: number;
  reasons: Array<{ label: string; value: number }>;
}

/** How an AI realm judges joining (its own interests; eligibility alone is not acceptance). */
export function evaluateLeague(sim: Sim, judge: NationId, from: NationId): LeagueEvaluation {
  const st = sim.state;
  const n = st.nations[judge];
  const l = leagueOf(sim, from);
  const members = l ? boundMembers(l) : [from];
  const reasons: Array<{ label: string; value: number }> = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.5) reasons.push({ label, value: Math.round(v) });
  };
  add('An offensive commitment binds us to their wars', -12);
  for (const m of members) add(`Opinion of ${nationName(sim, m)} (${Math.round(opinion(sim, judge, m))})`, opinion(sim, judge, m) * 0.2);
  // common rivals: realms we and the members both dislike (likely targets in common)
  const rivals = aliveNations(sim).filter((x) => x !== judge && !members.includes(x) && opinion(sim, judge, x) < -10 && members.some((m) => opinion(sim, m, x) < -10));
  if (rivals.length) add(`Rivals in common (${rivals.slice(0, 3).map((x) => nationName(sim, x)).join(', ')})`, Math.min(20, 8 * rivals.length));
  // our commitments to the realms they dislike: a league could drag us against our partners
  const partners = aliveNations(sim).filter((x) => x !== judge && !members.includes(x) && (hasTreaty(sim, 'alliance', judge, x) || hasTreaty(sim, 'nap', judge, x)) && members.some((m) => opinion(sim, m, x) < -10));
  if (partners.length) add(`They are hostile to our partners (${partners.slice(0, 3).map((x) => nationName(sim, x)).join(', ')})`, -10 * partners.length);
  // their appetite for war against ours
  const pers = n.ai.personality;
  const warlike = members.filter((m) => ['expansionist', 'opportunist'].includes(st.nations[m].ai.personality)).length;
  if (warlike) add(`${warlike} of them ${warlike === 1 ? 'is' : 'are'} warlike`, pers === 'expansionist' || pers === 'opportunist' ? 4 * warlike : -6 * warlike);
  add(`Our outlook (${pers})`, pers === 'expansionist' ? 10 : pers === 'opportunist' ? 5 : pers === 'defensive' ? -10 : pers === 'diplomat' ? -8 : -4);
  // our means
  if (n.treasury < 0) add('Our treasury is in debt', -15);
  if (n.warExhaustion > 30) add(`War-weariness (${Math.round(n.warExhaustion)})`, -10);
  if (enemiesOf(sim, judge).length) add('We are at war already', -8);
  const score = reasons.reduce((a, r) => a + r.value, 0);
  return { accept: score >= 0, score, reasons };
}

function newLeague(sim: Sim, founder: NationId, other: NationId): League {
  const st = sim.state;
  st.counters.league = (st.counters.league ?? 0) + 1;
  const l: League = {
    id: `lg${st.counters.league}`,
    name: `${sim.world.nationDefs[founder].adjective}–${sim.world.nationDefs[other].adjective} League`,
    founder,
    members: [founder, other],
    suspended: {},
    formed: st.tick,
    record: [],
  };
  (st.leagues ??= []).push(l);
  return l;
}

/** Admits `to` (founding a league with `from` if it has none). */
export function admitToLeague(sim: Sim, from: NationId, to: NationId): League {
  const mine = leagueOf(sim, from);
  const l = mine ?? newLeague(sim, from, to);
  if (mine) l.members.push(to);
  for (const m of l.members) notify(sim, m, 'normal', 'league', mine ? `${nationName(sim, to)} joins the ${l.name}: it is bound to our deliberate wars, and we to its.` : `The ${l.name} is founded: ${l.members.map((x) => nationName(sim, x)).join(' and ')} join each other's deliberate wars.`);
  return l;
}

/** The proposal: to the player in the dock (explicit acceptance); an AI realm answers by its own judgement. */
export function proposeLeague(sim: Sim, from: NationId, to: NationId): { ok: boolean; message: string } {
  const st = sim.state;
  st.nations[from].ai.lastProposal[`${to}:league`] = st.tick;
  const l = leagueOf(sim, from);
  if (st.nations[to].isPlayer) {
    st.counters.proposal++;
    st.proposals.push({ id: `pr${st.counters.proposal}`, kind: 'league', from, to, tick: st.tick, expires: st.tick + 8, league: l?.id ?? 'new' });
    notify(sim, to, 'normal', 'proposal', `${nationName(sim, from)} proposes ${l ? `that we join the ${l.name}` : 'an offensive league'}: we would join each other's deliberate wars.`);
    return { ok: true, message: 'Proposal sent.' };
  }
  const ev = evaluateLeague(sim, to, from);
  if (!ev.accept) {
    const top = [...ev.reasons].sort((x, y) => x.value - y.value).slice(0, 3).map((r) => `${r.label} (${r.value > 0 ? '+' : ''}${r.value})`);
    return { ok: false, message: `${nationName(sim, to)} declines (score ${Math.round(ev.score)}): ${top.join('; ')}.` };
  }
  const league = admitToLeague(sim, from, to);
  return { ok: true, message: `${nationName(sim, to)} accepts: the ${league.name} binds ${league.members.map((m) => nationName(sim, m)).join(', ')}.` };
}

export function leaveLeague(sim: Sim, nid: NationId): string {
  const st = sim.state;
  const l = leagueOf(sim, nid)!;
  l.members = l.members.filter((m) => m !== nid);
  delete l.suspended[nid];
  st.nations[nid].leagueLeft = st.tick;
  for (const m of l.members) {
    addMemory(sim, m, nid, 'rebuffed', -10, 1);
    notify(sim, m, 'normal', 'league', `${nationName(sim, nid)} has left the ${l.name}. The wars it joined go on.`);
  }
  if (boundMembers(l).length < 2) dissolve(sim, l, 'fewer than two bound members remain');
  return `We left the ${l.name}: future wars of its members no longer bind us; the wars we joined go on.`;
}

function dissolve(sim: Sim, l: League, why: string): void {
  const st = sim.state;
  st.leagues = (st.leagues ?? []).filter((x) => x !== l);
  for (const m of l.members) notify(sim, m, 'normal', 'league', `The ${l.name} is dissolved: ${why}.`);
}

/** Monthly: members who no longer qualify are suspended (and restored when they do); dead members leave. */
export function monthlyLeagues(sim: Sim): void {
  const st = sim.state;
  for (const l of [...(st.leagues ?? [])]) {
    l.members = l.members.filter((m) => st.nations[m]?.alive);
    for (const m of l.members) {
      const others = l.members.filter((x) => x !== m);
      const why = others.map((o) => pairProblem(sim, m, o, LEAGUE.opinionStay)).find((p) => p) ?? null;
      if (why && !l.suspended[m]) {
        l.suspended[m] = why;
        notify(sim, m, 'normal', 'league', `Suspended from the ${l.name}: ${why}. We are not bound to its wars until that changes.`);
      } else if (!why && l.suspended[m]) {
        delete l.suspended[m];
        notify(sim, m, 'normal', 'league', `Bound by the ${l.name} again.`);
      }
    }
    if (boundMembers(l).length < 2) dissolve(sim, l, 'fewer than two bound members remain');
  }
}

/** Why `nid` could not join `w` as an attacker (the ordinary rules), or null. */
export function joinBlocker(sim: Sim, nid: NationId, w: Pick<War, 'attackers' | 'defenders'> & Partial<War>): string | null {
  const st = sim.state;
  if (!st.nations[nid]?.alive) return 'no longer exists';
  if (w.defenders.includes(nid)) return 'it is the target';
  if (w.attackers.includes(nid)) return 'already in the war';
  for (const o of w.defenders) {
    if (hasTreaty(sim, 'alliance', nid, o)) return `allied with ${nationName(sim, o)}`;
    if (hasTreaty(sim, 'nap', nid, o)) return `a non-aggression pact with ${nationName(sim, o)}`;
    if (truceUntil(sim, nid, o) > st.tick) return `a truce with ${nationName(sim, o)}`;
    if (atWar(sim, nid, o)) return `already at war with ${nationName(sim, o)}`;
  }
  for (const o of w.attackers) if (atWar(sim, nid, o)) return `at war with ${nationName(sim, o)}`;
  return null;
}

/** Before a declaration: who of our league would join, and who could not and why. */
export function leaguePreview(sim: Sim, attacker: NationId, target: NationId): { joining: NationId[]; cannot: Array<{ nid: NationId; why: string }>; suspended: Array<{ nid: NationId; why: string }> } {
  const l = leagueOf(sim, attacker);
  const out = { joining: [] as NationId[], cannot: [] as Array<{ nid: NationId; why: string }>, suspended: [] as Array<{ nid: NationId; why: string }> };
  if (!l || l.suspended[attacker]) return out;
  // the target's defensive allies are called first; they count as the other side
  const defenders = [target, ...alliesOf(sim, target).filter((a) => a !== attacker && !hasTreaty(sim, 'alliance', a, attacker) && !hasTreaty(sim, 'nap', a, attacker))];
  for (const m of l.members) {
    if (m === attacker) continue;
    if (l.suspended[m]) {
      out.suspended.push({ nid: m, why: l.suspended[m]! });
      continue;
    }
    const why = joinBlocker(sim, m, { attackers: [attacker], defenders });
    if (why) out.cannot.push({ nid: m, why });
    else out.joining.push(m);
  }
  return out;
}

/**
 * A member deliberately declared `w`: every other bound member joins it as an attacker
 * (once), or says why it cannot. The joins are not declarations, so nothing here can
 * trigger another league (no recursion).
 */
export function honourLeague(sim: Sim, w: War, by: NationId): void {
  const st = sim.state;
  const l = leagueOf(sim, by);
  if (!l || l.suspended[by] || w.goal.type === 'coalition') return;
  const joined: NationId[] = [];
  const refused: Array<{ nid: NationId; why: string }> = [];
  for (const m of [...l.members].sort()) {
    if (m === by || l.suspended[m]) continue;
    const why = joinBlocker(sim, m, w) ?? (canJoin(sim, m, w, 'attacker') ? null : 'its treaties forbid it');
    if (why) {
      refused.push({ nid: m, why });
      continue;
    }
    joinWar(sim, w, m, 'attacker');
    joined.push(m);
    notify(sim, m, 'urgent', 'league', `The ${l.name} binds us: ${nationName(sim, by)} declared the ${w.name}, and we join it against ${nationName(sim, w.defenderLead)}.`);
  }
  l.record.push({ tick: st.tick, war: w.id, by, target: w.defenderLead, joined, refused });
  if (l.record.length > LEAGUE.recordMax) l.record.splice(0, l.record.length - LEAGUE.recordMax);
  notify(sim, by, 'normal', 'league', `${l.name}: ${joined.length ? `${joined.map((m) => nationName(sim, m)).join(', ')} join${joined.length === 1 ? 's' : ''} our war` : 'no member could join our war'}${refused.length ? `; ${refused.map((r) => `${nationName(sim, r.nid)} cannot (${r.why})`).join('; ')}` : ''}.`);
}

/** AI: an expansive realm founds a league with a like-minded ally, or invites another into its own (rarely). */
export function aiLeagues(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  if (!['expansionist', 'opportunist'].includes(n.ai.personality) && n.ai.goal.victory !== 'territorial') return;
  const l = leagueOf(sim, nid);
  if (l && (l.suspended[nid] || l.members.length >= LEAGUE.maxMembers)) return;
  const candidates = alliesOf(sim, nid)
    .filter((o) => !proposeLeagueProblem(sim, nid, o) && opinion(sim, nid, o) >= 40)
    .sort((a, b) => opinion(sim, nid, b) - opinion(sim, nid, a) || (a < b ? -1 : 1));
  const to = candidates[0];
  if (!to) return;
  // once in a while: not every month a proposal
  if (Math.floor(st.tick / 4) % 6 !== 0) return;
  proposeLeague(sim, nid, to);
}
