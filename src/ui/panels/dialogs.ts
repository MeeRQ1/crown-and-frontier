// Dialogs: events, proposals (treaties, peace, calls to arms), confirmations.

import { EVENT_MAP } from '../../sim/data/events';
import { TREATY_LABELS } from '../../sim/diplomacy';
import { eventCtx } from '../../sim/events';
import { dateOf, nationName, provName } from '../../sim/state';
import { termsCost } from '../../sim/war';
import type { App } from '../app';
import { button, h, setChildren } from '../dom';
import { shield } from './topbar';

export function dialog(app: App, title: string, body: (Node | string | null)[], buttons?: HTMLElement[], narrow = true): () => void {
  const layer = app.dialogLayer;
  const close = () => {
    layer.classList.add('hidden');
    setChildren(layer);
    app.canvas?.focus({ preventScroll: true });
  };
  const ok = button('Close', close, { cls: 'primary' });
  const modal = h(
    'div',
    { class: `modal ${narrow ? 'narrow' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', null, h('h2', null, title)),
    h('div', { class: 'body' }, ...body),
    h('footer', null, ...(buttons ?? [ok])),
  );
  setChildren(layer, modal);
  layer.classList.remove('hidden');
  setTimeout(() => (modal.querySelector('button:not(.disabled)') as HTMLButtonElement | null)?.focus(), 0);
  return close;
}

export function confirmDialog(app: App, title: string, text: string, onYes: () => void): void {
  let close = () => {};
  const yes = button('Confirm', () => {
    close();
    onYes();
  }, { cls: 'danger' });
  const no = button('Cancel', () => close());
  close = dialog(app, title, [h('p', null, text)], [no, yes]);
}

export function showEventDialog(app: App, instance: string): void {
  const sim = app.sim!;
  const pid = app.player!;
  const n = sim.state.nations[pid];
  const pe = n.pendingEvents.find((e) => e.id === instance);
  if (!pe) return;
  const def = EVENT_MAP[pe.event];
  const ctx = eventCtx(sim, pid, pe);
  app.setSpeed(0);
  let close = () => {};
  const choices = def.choices.map((ch, i) => {
    const prob = ch.problem ? ch.problem(ctx) : null;
    const b = h(
      'button',
      { class: `btn choice ${prob ? 'disabled' : ''}`, type: 'button', 'aria-disabled': prob ? 'true' : undefined },
      h('b', null, ch.label),
      h('span', { class: 'eff' }, ch.effect(ctx)),
      prob ? h('span', { class: 'eff bad' }, prob) : null,
    );
    b.addEventListener('click', () => {
      if (prob) return;
      const r = app.do({ type: 'eventChoice', instance, choice: i }, true);
      if (r.ok) close();
    });
    return b;
  });
  const later = button('Decide later', () => close(), { title: 'The first available choice is taken automatically when the event expires.' });
  close = dialog(
    app,
    def.title,
    [
      h('p', null, def.text(ctx)),
      pe.province ? h('p', { class: 'small muted' }, `Province: ${provName(sim, pe.province)}`) : null,
      ...choices,
      h('p', { class: 'small muted', style: 'margin-top:10px' }, `If no choice is made by ${dateOf(sim, pe.expires).short}, “${def.choices[0].label}” (or the first affordable option) is taken.`),
    ],
    [later],
  );
}

export function showProposalDialog(app: App, id: string): void {
  const sim = app.sim!;
  const p = sim.state.proposals.find((x) => x.id === id);
  if (!p) return;
  app.setSpeed(0);
  let close = () => {};
  const body: (Node | string | null)[] = [];
  const from = nationName(sim, p.from);
  let title = '';
  if (p.kind === 'callToArms') {
    const w = sim.state.wars[p.war!];
    title = `${from} calls us to arms`;
    body.push(h('p', null, `Our ally ${from} was attacked by ${w ? nationName(sim, w.attackerLead) : 'an enemy'} (${w?.name ?? 'war'}). Honouring the alliance brings us into the war as a defender.`));
    body.push(h('p', { class: 'small muted' }, 'Declining breaks the alliance, costs 15 trust and angers our former ally. If we do not answer within four weeks we honour the call.'));
  } else if (p.kind === 'peace') {
    const w = sim.state.wars[p.war!];
    const t = p.terms!;
    title = `Peace offer from ${from}`;
    if (t.mode === 'white') body.push(h('p', null, 'A white peace: all occupied land returns to its owner, nobody pays.'));
    else {
      const giver = t.mode === 'demand' ? nationName(sim, p.to) : from;
      body.push(h('p', null, `${giver} would cede: ${t.provinces.length ? t.provinces.map((x) => provName(sim, x)).join(', ') : 'no land'}${t.gold ? ` and pay ${Math.round(t.gold)} crowns` : ''}.`));
      if (w) body.push(h('p', { class: 'small muted' }, `Value of these terms: ${termsCost(sim, w, t.mode === 'demand' ? p.to : p.from, t.mode === 'demand' ? p.from : p.to, t)} war-score points. Current war score: ${Math.round(w.score)} (attacker's view).`));
    }
    body.push(h('p', { class: 'small muted' }, 'A 5-year truce follows any peace.'));
  } else {
    title = `${from} proposes a ${TREATY_LABELS[p.kind].toLowerCase()}`;
    const what: Record<string, string> = {
      nap: 'Neither side may declare war on the other for 5 years (cancelling early costs trust and imposes a 12-month cooling-off).',
      trade: 'Both realms gain crowns every month; cancelled automatically by war.',
      alliance: 'Each side is called to arms when the other is attacked (defensive only). Grants military access.',
    };
    body.push(h('p', null, what[p.kind]));
  }
  body.unshift(h('div', { class: 'row' }, shield(app, p.from), h('b', null, from)));
  const accept = button('Accept', () => {
    const r = app.do({ type: 'respond', proposal: id, accept: true });
    if (r.ok) close();
  }, { cls: 'primary' });
  const decline = button(p.kind === 'callToArms' ? 'Decline (break alliance)' : 'Decline', () => {
    app.do({ type: 'respond', proposal: id, accept: false });
    close();
  }, { cls: p.kind === 'callToArms' ? 'danger' : '' });
  const later = button('Later', () => close());
  body.push(h('p', { class: 'small muted' }, `Expires ${dateOf(sim, p.expires).short}.`));
  close = dialog(app, title, body, [later, decline, accept]);
}

export function renderDecisions(app: App): void {
  const sim = app.sim!;
  const pid = app.player;
  const el = app.decisionsEl;
  if (!pid) return setChildren(el);
  const events = sim.state.nations[pid].pendingEvents;
  const props = sim.state.proposals.filter((p) => p.to === pid);
  const total = events.length + props.length;
  if (!total) return setChildren(el);
  const b = button(`⚑ ${total} decision${total > 1 ? 's' : ''} waiting`, () => {
    if (events.length) showEventDialog(app, events[0].id);
    else showProposalDialog(app, props[0].id);
  }, { cls: 'primary' });
  setChildren(el, b);
}
