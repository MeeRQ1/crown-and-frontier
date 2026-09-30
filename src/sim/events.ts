// Event scheduling. Each realm draws an event every 5–11 months (gameplay PRNG,
// so reloading a save reproduces the same event — events cannot be farmed).
// AI realms answer immediately with the same choices; the player has 8 weeks
// before the first available choice is taken by default.

import { C } from './config';
import { EVENT_MAP, EVENTS, type EventCtx } from './data/events';
import { intRange, nextFloat } from './rng';
import { months, notify, type Sim } from './state';
import type { NationId, PendingEvent } from './types';

export function eventCtx(sim: Sim, nid: NationId, pe: PendingEvent): EventCtx {
  return { sim, nid, province: pe.province, other: pe.other };
}

export function choiceProblem(sim: Sim, nid: NationId, pe: PendingEvent, choice: number): string | null {
  const def = EVENT_MAP[pe.event];
  if (!def) return 'Unknown event.';
  const ch = def.choices[choice];
  if (!ch) return 'Unknown choice.';
  return ch.problem ? ch.problem(eventCtx(sim, nid, pe)) : null;
}

export function resolveEvent(sim: Sim, nid: NationId, instance: string, choice: number): void {
  const n = sim.state.nations[nid];
  const pe = n.pendingEvents.find((e) => e.id === instance);
  if (!pe) return;
  const def = EVENT_MAP[pe.event];
  const ctx = eventCtx(sim, nid, pe);
  def.choices[choice].apply(ctx);
  n.pendingEvents = n.pendingEvents.filter((e) => e.id !== instance);
  if (n.isPlayer) notify(sim, nid, 'low', 'event', `${def.title}: ${def.choices[choice].label}.`);
}

function aiChoice(sim: Sim, nid: NationId, pe: PendingEvent): number {
  const def = EVENT_MAP[pe.event];
  const ctx = eventCtx(sim, nid, pe);
  let best = -1;
  let bestScore = -Infinity;
  def.choices.forEach((ch, i) => {
    if (ch.problem && ch.problem(ctx)) return;
    const s = ch.ai(ctx);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return Math.max(0, best);
}

export function defaultChoice(sim: Sim, nid: NationId, pe: PendingEvent): number {
  const def = EVENT_MAP[pe.event];
  const ctx = eventCtx(sim, nid, pe);
  const i = def.choices.findIndex((ch) => !ch.problem || !ch.problem(ctx));
  return Math.max(0, i);
}

export function monthlyEvents(sim: Sim): void {
  const st = sim.state;
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    if (!n.alive) continue;
    // expire unanswered player events with the default choice
    for (const pe of [...n.pendingEvents]) {
      if (pe.expires <= st.tick) resolveEvent(sim, nid, pe.id, defaultChoice(sim, nid, pe));
    }
    if (st.tick < n.nextEventTick || n.pendingEvents.length) continue;
    const eligible: Array<{ id: string; weight: number; province?: string; other?: string }> = [];
    for (const def of EVENTS) {
      if ((n.eventCooldowns[def.id] ?? -1) > st.tick) continue;
      const e = def.eligible({ sim, nid });
      if (e && e.weight > 0) eligible.push({ id: def.id, ...e });
    }
    n.nextEventTick = st.tick + months(intRange(st.rng, C.events.minGapMonths, C.events.maxGapMonths));
    if (!eligible.length) continue;
    const total = eligible.reduce((s, e) => s + e.weight, 0);
    let r = nextFloat(st.rng) * total;
    let pick = eligible[eligible.length - 1];
    for (const e of eligible) {
      r -= e.weight;
      if (r < 0) {
        pick = e;
        break;
      }
    }
    const def = EVENT_MAP[pick.id];
    n.eventCooldowns[def.id] = st.tick + months(def.cooldownMonths);
    st.counters.event++;
    const pe: PendingEvent = { id: `e${st.counters.event}`, event: def.id, tick: st.tick, province: pick.province, other: pick.other, expires: st.tick + C.events.expireWeeks };
    n.pendingEvents.push(pe);
    if (n.isPlayer) notify(sim, nid, 'urgent', 'event', `Event: ${def.title}. A decision awaits.`, { province: pick.province });
    else resolveEvent(sim, nid, pe.id, aiChoice(sim, nid, pe));
  }
}
