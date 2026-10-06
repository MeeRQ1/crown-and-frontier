// Influence and spheres, guarantees of independence, loans and trade blocs.
//
// Influence (0–100) is what one realm holds over another. Each month it
// gains from:  an envoy at their court (1.5 × size factor 0.5–2, the ratio
//              of our development to theirs), a trade agreement (0.5 for the
//              larger economy), an outstanding loan (1), a guarantee (0.75), an
//              alliance (0.3 for the stronger partner), leading their trade bloc (0.5);
//              all × (1 + influence modifiers);
// and loses:   0.5 a month always, 3 a month while at war with them.
// Sphere:      a realm is in the sphere of the larger realm holding at least 40
//              influence over it and 1.25 × any rival's. A sphere member thinks
//              better of its leader (+15), will not ally against it or join a
//              coalition against it, and is defended by it when attacked. Each
//              member gives the leader 2 diplomatic influence (victory).
// Guarantee:   unilateral; the guarantor is called to arms when the guaranteed
//              realm is attacked (refusing breaks the guarantee and costs 10 trust).
//              One guarantee per realm, more with focuses.
// Loan:        at least 50 crowns, repaid over 24 months with 20% interest. The
//              lender gains influence at once (5 per month of the borrower's income
//              lent, at most 20) and while it is repaid. War between the two
//              repudiates it.
// Trade bloc:  a customs union of up to 6 realms led by its founder. Members buy
//              from members 20% cheaper and earn 50% more commerce from their
//              agreements with each other; the crowns a blockade costs any member
//              are shared among all members by the size of their taxes.

import { C } from './config';
import { PERSONALITIES } from './data/personalities';
import { addMemory, opinion, type Evaluation, type OpinionPart } from './diplomacy';
import { grossIncome, totalDev, tradeValue } from './economy';
import { memoize } from './index';
import { nationStrength } from './military';
import { nationMods } from './modifiers';
import { aliveNations, atWar, bump, clamp, hasTreaty, nationName, notify, warsOf, type Sim } from './state';
import type { CommandResult, Guarantee, NationId, TradeBloc } from './types';

// ───────────────────────────── Influence ────────────────────────────────────

export function influenceOver(sim: Sim, holder: NationId, target: NationId): number {
  return sim.state.influence[holder]?.[target] ?? 0;
}

export function addInfluence(sim: Sim, holder: NationId, target: NationId, v: number): void {
  if (holder === target) return;
  const row = (sim.state.influence[holder] ??= {});
  const next = clamp((row[target] ?? 0) + v, 0, 100);
  if (next <= 0) delete row[target];
  else row[target] = next;
}

/** The realm whose sphere `target` is in, if any. */
export function sphereOf(sim: Sim, target: NationId): NationId | null {
  return memoize(sim, 'sphereOf', target, () => {
    const st = sim.state;
    let best: NationId | null = null;
    let bv = 0;
    let second = 0;
    for (const h of aliveNations(sim)) {
      if (h === target) continue;
      const v = st.influence[h]?.[target] ?? 0;
      if (v > bv || (v === bv && best !== null && h < best)) {
        second = bv;
        bv = v;
        best = h;
      } else if (v > second) second = v;
    }
    if (!best || bv < C.influence.sphere || bv < second * C.influence.sphereRatio) return null;
    if (atWar(sim, best, target)) return null;
    // a sphere is held by the larger realm
    if (totalDev(sim, best) <= totalDev(sim, target)) return null;
    return best;
  });
}

export function sphereMembers(sim: Sim, leader: NationId): NationId[] {
  return aliveNations(sim).filter((n) => n !== leader && sphereOf(sim, n) === leader);
}

/** Influence gained this month by `holder` over `target`, with its sources (for the interface). */
export function influenceGain(sim: Sim, holder: NationId, target: NationId): { total: number; parts: OpinionPart[] } {
  const st = sim.state;
  const parts: OpinionPart[] = [];
  const add = (label: string, v: number) => {
    if (v) parts.push({ label, value: v });
  };
  const mul = Math.max(0, 1 + nationMods(sim, holder).influenceGain);
  if (st.envoys.some((e) => e.from === holder && e.to === target)) {
    const size = clamp(totalDev(sim, holder) / Math.max(1, totalDev(sim, target)), 0.5, 2);
    add('Envoy at their court', C.influence.envoy * size * mul);
  }
  if (hasTreaty(sim, 'trade', holder, target) && grossIncome(st.nations[holder].lastMonth) > grossIncome(st.nations[target].lastMonth)) add('Trade agreement (the larger economy)', C.influence.trade * mul);
  if (st.loans.some((l) => l.from === holder && l.to === target)) add('Loan being repaid', C.influence.loan * mul);
  if (st.guarantees.some((g) => g.by === holder && g.of === target)) add('Guarantee of their independence', C.influence.guarantee * mul);
  if (hasTreaty(sim, 'alliance', holder, target) && nationStrength(sim, holder) > nationStrength(sim, target)) add('Alliance (the stronger partner)', C.influence.alliance * mul);
  const bloc = blocOf(sim, target);
  if (bloc && bloc.leader === holder) add('Leads their trade bloc', C.influence.blocLeader * mul);
  add('Fades', -C.influence.decay);
  if (atWar(sim, holder, target)) add('At war', -C.influence.warDecay);
  return { total: parts.reduce((s, p) => s + p.value, 0), parts };
}

// ───────────────────────────── Guarantees ───────────────────────────────────

export function guaranteesBy(sim: Sim, nid: NationId): Guarantee[] {
  return sim.state.guarantees.filter((g) => g.by === nid);
}

export function guarantorsOf(sim: Sim, nid: NationId): NationId[] {
  return sim.state.guarantees.filter((g) => g.of === nid).map((g) => g.by);
}

export function guaranteeSlots(sim: Sim, nid: NationId): number {
  return Math.max(0, C.guarantee.base + nationMods(sim, nid).guarantees);
}

export function guaranteeProblem(sim: Sim, by: NationId, of: NationId): string | null {
  const st = sim.state;
  if (!st.nations[by]?.alive || !st.nations[of]?.alive) return 'That realm no longer exists.';
  if (by === of) return 'A realm cannot guarantee itself.';
  if (st.guarantees.some((g) => g.by === by && g.of === of)) return 'We already guarantee their independence.';
  if (atWar(sim, by, of)) return 'We are at war with them.';
  if (hasTreaty(sim, 'alliance', by, of)) return 'An alliance already binds us to defend them.';
  const used = guaranteesBy(sim, by).length;
  const slots = guaranteeSlots(sim, by);
  if (used >= slots) return `We can give ${slots} guarantee${slots === 1 ? '' : 's'} (focuses add more); all are in use.`;
  if (nationStrength(sim, of) > nationStrength(sim, by) * 1.2) return 'They are stronger than we are: our guarantee would mean nothing.';
  return null;
}

export function giveGuarantee(sim: Sim, by: NationId, of: NationId): void {
  const st = sim.state;
  st.guarantees.push({ by, of, since: st.tick });
  st.nations[by].stats.guaranteesGiven++;
  addMemory(sim, of, by, 'guarantee', C.guarantee.opinion, 0);
  bump(sim, 'terms');
  notify(sim, of, 'normal', 'guarantee', `${nationName(sim, by)} guarantees our independence: they will defend us if we are attacked.`);
  notify(sim, null, 'low', 'guarantee', `${nationName(sim, by)} guarantees the independence of ${nationName(sim, of)}.`);
}

/** Ends a guarantee; `broken` when the guarantor walks away from it (memory and notice). */
export function endGuarantee(sim: Sim, by: NationId, of: NationId, broken: boolean): void {
  const st = sim.state;
  const before = st.guarantees.length;
  st.guarantees = st.guarantees.filter((g) => !(g.by === by && g.of === of));
  if (st.guarantees.length === before) return;
  const list = st.memories[of]?.[by];
  if (list) st.memories[of][by] = list.filter((m) => m.kind !== 'guarantee');
  if (broken) {
    addMemory(sim, of, by, 'betrayal', C.guarantee.revokeOpinion, 0.3);
    notify(sim, of, 'normal', 'guarantee', `${nationName(sim, by)} no longer guarantees our independence.`);
  }
  bump(sim, 'terms');
}

// ───────────────────────────── Loans ────────────────────────────────────────

export function loanProblem(sim: Sim, from: NationId, to: NationId, amount: number): string | null {
  const st = sim.state;
  if (!st.nations[from]?.alive || !st.nations[to]?.alive) return 'That realm no longer exists.';
  if (from === to) return 'A realm cannot lend to itself.';
  if (!Number.isFinite(amount) || amount < C.loan.min) return `Loans are at least ${C.loan.min} crowns.`;
  if (amount > Math.floor(st.nations[from].treasury / 2)) return `We can lend at most half our treasury (${Math.max(0, Math.floor(st.nations[from].treasury / 2))} crowns).`;
  if (atWar(sim, from, to)) return 'We are at war with them.';
  if (st.loans.some((l) => l.from === from && l.to === to)) return 'They are still repaying our last loan.';
  if (st.proposals.some((p) => p.kind === 'loan' && p.from === from && p.to === to)) return 'Our offer is still awaiting their answer.';
  return null;
}

/** How `to` judges a loan of `amount` offered by `from`. */
export function evaluateLoan(sim: Sim, from: NationId, to: NationId, amount: number): Evaluation {
  const st = sim.state;
  const n = st.nations[to];
  const reasons: OpinionPart[] = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.5) reasons.push({ label, value: Math.round(v) });
  };
  const gross = Math.max(5, grossIncome(n.lastMonth));
  const spend = Object.values(n.lastMonth.expenses).reduce((a, b) => a + b, 0);
  add('Base reluctance', -5);
  if (n.treasury < 0) add('Our treasury is in debt', 25);
  else if (n.treasury < spend * 2) add('Our treasury is low', 15);
  if (warsOf(sim, to).length) add('We are at war', 10);
  const op = opinion(sim, to, from);
  add(`Opinion of them (${op})`, op * 0.3);
  const alarm = st.alarm[to]?.[from] ?? 0;
  if (alarm >= 20) add('We fear them', -20);
  add('Interest to repay', -(amount / gross) * 2);
  const inf = influenceOver(sim, from, to);
  if (inf >= C.influence.sphere * 0.6) add('Their influence over us is already strong', -10);
  const p = PERSONALITIES[n.ai.personality];
  if (p.id === 'commercial' || p.id === 'diplomat') add(`${p.label} outlook`, 5);
  const score = reasons.reduce((s, r) => s + r.value, 0);
  return { accept: score >= 0, score, reasons };
}

export function makeLoan(sim: Sim, from: NationId, to: NationId, amount: number): void {
  const st = sim.state;
  st.counters.loan++;
  const total = amount * (1 + C.loan.interest);
  st.loans.push({ id: `l${st.counters.loan}`, from, to, remaining: Math.round(total * 100) / 100, monthly: Math.round((total / C.loan.months) * 100) / 100, since: st.tick });
  st.nations[from].treasury -= amount;
  st.nations[to].treasury += amount;
  st.nations[from].stats.loansGiven++;
  st.nations[from].stats.loanCrowns += amount;
  const gross = Math.max(5, grossIncome(st.nations[to].lastMonth));
  addInfluence(sim, from, to, Math.min(C.influence.loanGrantCap, (amount / gross) * C.influence.loanGrant) * Math.max(0, 1 + nationMods(sim, from).influenceGain));
  addMemory(sim, to, from, 'loan', C.loan.opinion, 0.4);
  notify(sim, to, 'normal', 'loan', `${nationName(sim, from)} lent us ${Math.round(amount)} crowns, repaid at ${Math.round(total / C.loan.months)} a month for ${C.loan.months} months.`);
  notify(sim, from, 'low', 'loan', `We lent ${nationName(sim, to)} ${Math.round(amount)} crowns.`);
}

/** Offers a loan: an AI borrower answers at once, a player gets a proposal. */
export function offerLoan(sim: Sim, from: NationId, to: NationId, amount: number): CommandResult {
  const st = sim.state;
  if (st.nations[to].isPlayer) {
    st.counters.proposal++;
    st.proposals.push({ id: `pr${st.counters.proposal}`, kind: 'loan', from, to, tick: st.tick, expires: st.tick + C.diplomacy.proposalWeeks, amount });
    notify(sim, to, 'normal', 'proposal', `${nationName(sim, from)} offers us a loan of ${Math.round(amount)} crowns.`);
    return { ok: true, message: 'Offer sent.' };
  }
  const ev = evaluateLoan(sim, from, to, amount);
  if (!ev.accept) {
    const top = [...ev.reasons].sort((x, y) => x.value - y.value).slice(0, 3).map((r) => `${r.label} (${r.value > 0 ? '+' : ''}${r.value})`);
    return { ok: false, reason: `${nationName(sim, to)} declines the loan (score ${Math.round(ev.score)}): ${top.join('; ')}.` };
  }
  makeLoan(sim, from, to, amount);
  return { ok: true, message: `${nationName(sim, to)} accepts the loan.` };
}

/** This month's instalment of a loan (nothing while the two are at war). */
export function loanInstalment(sim: Sim, l: { from: NationId; to: NationId; remaining: number; monthly: number }): number {
  if (atWar(sim, l.from, l.to)) return 0;
  return Math.min(l.monthly, l.remaining);
}

/** Ends loans and reparations between two realms that went to war. */
export function repudiate(sim: Sim, a: NationId, b: NationId): void {
  const st = sim.state;
  const pair = (x: { from: NationId; to: NationId }) => (x.from === a && x.to === b) || (x.from === b && x.to === a);
  for (const l of st.loans.filter(pair)) {
    addMemory(sim, l.from, l.to, 'betrayal', -20, 0.3);
    notify(sim, l.from, 'normal', 'loan', `${nationName(sim, l.to)} repudiated the ${Math.round(l.remaining)} crowns it still owed us.`);
  }
  st.loans = st.loans.filter((l) => !pair(l));
  st.reparations = st.reparations.filter((r) => !pair(r));
}

// ───────────────────────────── Trade blocs ──────────────────────────────────

export function blocOf(sim: Sim, nid: NationId): TradeBloc | undefined {
  return sim.state.blocs.find((b) => b.members.includes(nid));
}

export function sameBloc(sim: Sim, a: NationId, b: NationId): boolean {
  const x = blocOf(sim, a);
  return !!x && x.members.includes(b);
}

/** Why `nid` cannot found a trade bloc with `partner` (null = it can, if the partner agrees). */
export function foundBlocProblem(sim: Sim, nid: NationId, partner: NationId): string | null {
  const st = sim.state;
  if (blocOf(sim, nid)) return 'We already belong to a trade bloc.';
  if (!st.nations[partner]?.alive || partner === nid) return 'Choose a trade partner to found the bloc with.';
  if (!hasTreaty(sim, 'trade', nid, partner)) return 'A trade bloc is founded with a realm we have a trade agreement with.';
  if (blocOf(sim, partner)) return 'They belong to another trade bloc.';
  if (st.nations[nid].treasury < C.bloc.cost) return `Founding a trade bloc costs ${C.bloc.cost} crowns.`;
  if (st.proposals.some((p) => p.kind === 'blocInvite' && p.from === nid && p.to === partner)) return 'Our proposal is still awaiting their answer.';
  return null;
}

export function foundBloc(sim: Sim, nid: NationId, partner: NationId): TradeBloc {
  const st = sim.state;
  st.counters.bloc++;
  const b: TradeBloc = { id: `b${st.counters.bloc}`, name: `${sim.world.nationDefs[nid].adjective} Customs Union`, leader: nid, members: [nid, partner].sort(), since: st.tick };
  st.blocs.push(b);
  st.nations[nid].treasury -= C.bloc.cost;
  bump(sim, 'terms');
  notify(sim, null, 'low', 'bloc', `${nationName(sim, nid)} and ${nationName(sim, partner)} found the ${b.name}.`);
  notify(sim, partner, 'normal', 'bloc', `We joined ${nationName(sim, nid)} in founding the ${b.name}.`);
  return b;
}

export function inviteProblem(sim: Sim, leader: NationId, target: NationId): string | null {
  const st = sim.state;
  const b = blocOf(sim, leader);
  if (!b || b.leader !== leader) return 'Only the leader of a trade bloc can invite members.';
  if (!st.nations[target]?.alive) return 'That realm no longer exists.';
  if (b.members.includes(target)) return 'They are already a member.';
  if (blocOf(sim, target)) return 'They belong to another trade bloc.';
  if (b.members.length >= C.bloc.maxMembers) return `A trade bloc has at most ${C.bloc.maxMembers} members.`;
  if (b.members.some((m) => atWar(sim, m, target))) return 'They are at war with a member.';
  if (st.proposals.some((p) => (p.kind === 'blocInvite' || p.kind === 'blocJoin') && ((p.from === leader && p.to === target) || (p.from === target && p.to === leader)))) return 'A proposal is already awaiting an answer.';
  return null;
}

export function joinProblem(sim: Sim, nid: NationId, blocId: string): string | null {
  const st = sim.state;
  const b = st.blocs.find((x) => x.id === blocId);
  if (!b) return 'That trade bloc no longer exists.';
  if (b.members.includes(nid)) return 'We are already a member.';
  if (blocOf(sim, nid)) return 'We belong to another trade bloc.';
  if (b.members.length >= C.bloc.maxMembers) return `A trade bloc has at most ${C.bloc.maxMembers} members.`;
  if (b.members.some((m) => atWar(sim, m, nid))) return 'We are at war with a member.';
  if (st.proposals.some((p) => p.kind === 'blocJoin' && p.from === nid)) return 'Our request is still awaiting an answer.';
  return null;
}

/** How `target` judges joining `leader`'s bloc (an invitation), or how `leader` judges `target`'s request. */
export function evaluateBloc(sim: Sim, leader: NationId, target: NationId, judge: NationId): Evaluation {
  const st = sim.state;
  const b = blocOf(sim, leader);
  const other = judge === leader ? target : leader;
  const reasons: OpinionPart[] = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.5) reasons.push({ label, value: Math.round(v) });
  };
  add('Base reluctance: our own tariffs', -30);
  if (judge === target && b) add(`A bloc of ${b.members.length}: their leader's influence over us`, -2 * b.members.length);
  const op = opinion(sim, judge, other);
  add(`Opinion of them (${op})`, op * 0.4);
  if (hasTreaty(sim, 'trade', leader, target)) add('We already trade with them', 15);
  const partners = b ? b.members.filter((m) => m !== leader && hasTreaty(sim, 'trade', m, target)).length : 0;
  if (partners) add('Trade agreements with other members', 5 * partners);
  if (judge === leader) add(`Their trade is worth ${tradeValue(sim, leader, target).toFixed(1)} crowns a month to us`, Math.min(15, tradeValue(sim, leader, target) * 2));
  const alarm = st.alarm[judge]?.[other] ?? 0;
  if (alarm >= 25) add('We fear them', -20);
  if (judge === target && sphereOf(sim, target) === leader) add('We are in their sphere', 15);
  const p = PERSONALITIES[st.nations[judge].ai.personality];
  if (p.id === 'commercial') add('Commercial outlook', 10);
  const score = reasons.reduce((s, r) => s + r.value, 0);
  return { accept: score >= 0, score, reasons };
}

export function addToBloc(sim: Sim, blocId: string, nid: NationId): void {
  const b = sim.state.blocs.find((x) => x.id === blocId);
  if (!b || b.members.includes(nid)) return;
  b.members.push(nid);
  b.members.sort();
  bump(sim, 'terms');
  for (const m of b.members) if (m !== nid) notify(sim, m, 'low', 'bloc', `${nationName(sim, nid)} joins the ${b.name}.`);
  notify(sim, nid, 'normal', 'bloc', `We joined the ${b.name}.`);
}

export function leaveBloc(sim: Sim, nid: NationId, why?: string): void {
  const st = sim.state;
  const b = blocOf(sim, nid);
  if (!b) return;
  b.members = b.members.filter((m) => m !== nid);
  if (b.leader === nid) b.leader = [...b.members].sort((x, y) => totalDev(sim, y) - totalDev(sim, x) || (x < y ? -1 : 1))[0] ?? nid;
  if (b.members.length < 2) {
    st.blocs = st.blocs.filter((x) => x !== b);
    for (const m of b.members) notify(sim, m, 'normal', 'bloc', `The ${b.name} has dissolved.`);
  } else for (const m of b.members) notify(sim, m, 'low', 'bloc', `${nationName(sim, nid)} left the ${b.name}${why ? ` (${why})` : ''}.`);
  bump(sim, 'terms');
}

/**
 * Blockade losses shared inside each trade bloc: what each member gains (the
 * blockaded) or pays (the rest) so that every member bears the bloc's total
 * loss in proportion to its taxes.
 */
export function blocSolidarity(sim: Sim, lossOf: (nid: NationId) => number): Map<NationId, number> {
  const out = new Map<NationId, number>();
  for (const b of sim.state.blocs) {
    const loss = new Map<NationId, number>();
    let total = 0;
    let weight = 0;
    const w = new Map<NationId, number>();
    for (const m of b.members) {
      if (!sim.state.nations[m]?.alive) continue;
      const l = lossOf(m);
      loss.set(m, l);
      total += l;
      const tax = Math.max(1, sim.state.nations[m].lastMonth.income['Provincial taxes'] ?? 1);
      w.set(m, tax);
      weight += tax;
    }
    if (total <= 0) continue;
    for (const [m, l] of loss) out.set(m, l - (total * w.get(m)!) / weight);
  }
  return out;
}

// ───────────────────────────── Monthly upkeep ───────────────────────────────

export function monthlyInfluence(sim: Sim): void {
  const st = sim.state;
  const alive = aliveNations(sim);
  // influence: every pair with a source or a value
  const gains: Array<[NationId, NationId, number]> = [];
  for (const h of alive) {
    for (const t of alive) {
      if (h === t) continue;
      const has = (st.influence[h]?.[t] ?? 0) > 0;
      const source =
        st.envoys.some((e) => e.from === h && e.to === t) ||
        hasTreaty(sim, 'trade', h, t) ||
        hasTreaty(sim, 'alliance', h, t) ||
        st.loans.some((l) => l.from === h && l.to === t) ||
        st.guarantees.some((g) => g.by === h && g.of === t) ||
        blocOf(sim, t)?.leader === h;
      if (!has && !source) continue;
      gains.push([h, t, influenceGain(sim, h, t).total]);
    }
  }
  const before = new Map(alive.map((t) => [t, sphereOf(sim, t)]));
  for (const [h, t, v] of gains) addInfluence(sim, h, t, v);
  // dead realms hold and are held by nothing
  for (const h of Object.keys(st.influence)) {
    if (!st.nations[h]?.alive) delete st.influence[h];
    else for (const t of Object.keys(st.influence[h])) if (!st.nations[t]?.alive) delete st.influence[h][t];
  }
  bump(sim, 'terms');
  for (const t of alive) {
    const now = sphereOf(sim, t);
    const was = before.get(t);
    if (now === was) continue;
    if (now) {
      notify(sim, t, 'normal', 'sphere', `We have fallen into the sphere of ${nationName(sim, now)}.`);
      notify(sim, now, 'normal', 'sphere', `${nationName(sim, t)} is now in our sphere of influence.`);
    } else if (was && st.nations[was]?.alive) {
      notify(sim, was, 'normal', 'sphere', `${nationName(sim, t)} has left our sphere of influence.`);
      notify(sim, t, 'low', 'sphere', `We are no longer in the sphere of ${nationName(sim, was)}.`);
    }
  }
  // the sphere and bloc counters (system usage)
  const leaders = new Set<NationId>();
  for (const t of alive) {
    const s = sphereOf(sim, t);
    if (s) leaders.add(s);
  }
  for (const l of leaders) st.nations[l].stats.sphereMonths++;
  for (const b of st.blocs) for (const m of b.members) if (st.nations[m]?.alive) st.nations[m].stats.blocMonths++;
  // expired reparations and disarmament
  const ended = st.reparations.filter((r) => r.until <= st.tick);
  st.reparations = st.reparations.filter((r) => r.until > st.tick && st.nations[r.from]?.alive && st.nations[r.to]?.alive);
  for (const r of ended) if (st.nations[r.from]?.alive) notify(sim, r.from, 'normal', 'peace', `Our reparations to ${nationName(sim, r.to)} are paid off.`);
  const freed = st.disarmaments.filter((d) => d.until <= st.tick);
  st.disarmaments = st.disarmaments.filter((d) => d.until > st.tick && st.nations[d.nation]?.alive);
  for (const d of freed) if (st.nations[d.nation]?.alive) notify(sim, d.nation, 'normal', 'peace', `The limit on our army imposed by ${nationName(sim, d.by)} has expired.`);
  // guarantees and blocs with dead realms, or members at war with each other
  st.guarantees = st.guarantees.filter((g) => st.nations[g.by]?.alive && st.nations[g.of]?.alive);
  for (const b of [...st.blocs]) {
    for (const m of [...b.members]) if (!st.nations[m]?.alive) leaveBloc(sim, m);
  }
}

/** The army limit a peace settlement imposes on a realm (null = none). */
export function armyCap(sim: Sim, nid: NationId): number | null {
  let cap: number | null = null;
  for (const d of sim.state.disarmaments) if (d.nation === nid && d.until > sim.state.tick) cap = cap === null ? d.cap : Math.min(cap, d.cap);
  return cap;
}
