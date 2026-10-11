// Decisions and dialogs.
//
// Events and proposals appear as a decision card docked above the map: the
// map stays usable while you read, and "Later" folds the card into a chip.
// True modal dialogs are kept for confirmations and messages.

import { EVENT_MAP } from '../../sim/data/events';
import { C } from '../../sim/config';
import { evaluateTreaty, TREATY_LABELS } from '../../sim/diplomacy';
import { eventCtx } from '../../sim/events';
import { demandCost, describeDemand, evaluateSettlement, settlementCost } from '../../sim/settlement';
import { dateOf, hasTreaty, nationName, provName } from '../../sim/state';
import { scoreFor, termsCost } from '../../sim/war';
import type { App } from '../app';
import { cancelFee, evaluateContract, resLabel } from '../../sim/trade';
import { forecastChart, termsTable } from '../trade-ui';
import { button, h, rebuild, setChildren } from '../dom';
import { icon } from '../icons';
import { shield } from './common';

export function dialog(app: App, title: string, body: (Node | string | null)[], buttons?: HTMLElement[], narrow = true): () => void {
  const layer = app.dialogLayer;
  const prev = document.activeElement as HTMLElement | null;
  const close = () => {
    layer.classList.add('hidden');
    setChildren(layer);
    (prev && document.contains(prev) ? prev : app.canvas)?.focus({ preventScroll: true });
  };
  const ok = button('Close', close, { cls: 'primary' });
  const modal = h(
    'div',
    { class: `modal ${narrow ? 'narrow' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', null, h('h2', null, title)),
    h('div', { class: 'body' }, ...body),
    h('footer', null, ...(buttons ?? [ok])),
  );
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
    if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = [...modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea')].filter((x) => !x.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  });
  setChildren(layer, modal);
  layer.classList.remove('hidden');
  setTimeout(() => (modal.querySelector('footer button:not(.disabled)') as HTMLButtonElement | null)?.focus(), 0);
  return close;
}

export function confirmDialog(app: App, title: string, text: string, onYes: () => void, yesLabel = 'Confirm', danger = true): void {
  let close = () => {};
  const yes = button(yesLabel, () => {
    close();
    onYes();
  }, { cls: danger ? 'danger' : 'primary' });
  const no = button('Cancel', () => close());
  close = dialog(app, title, [h('p', null, text)], [no, yes]);
}

// ───────────────────────────── Decision dock ────────────────────────────────

export interface Decision {
  kind: 'event' | 'proposal';
  id: string;
}

export function pendingDecisions(app: App): Decision[] {
  const sim = app.sim;
  const pid = app.player;
  if (!sim || !pid) return [];
  return [
    ...sim.state.nations[pid].pendingEvents.map((e) => ({ kind: 'event' as const, id: e.id })),
    ...sim.state.proposals.filter((p) => p.to === pid).map((p) => ({ kind: 'proposal' as const, id: p.id })),
  ];
}

export function renderDock(app: App): void {
  const el = app.dockEl;
  const list = pendingDecisions(app);
  rebuild(el, () => {
    if (!list.length) {
      app.ui.dockOpen = false;
      return setChildren(el);
    }
    if (!app.ui.dockOpen) {
      const chip = h('button', { class: 'alert-chip seal', type: 'button', 'data-fk': 'dock-chip' }, icon('scroll'), `${list.length} decision${list.length > 1 ? 's' : ''} waiting`);
      chip.addEventListener('click', () => app.openDecisions());
      return setChildren(el, chip);
    }
    const cur = list.find((d) => d.id === app.ui.dockItem) ?? list[0];
    app.ui.dockItem = cur.id;
    const card = cur.kind === 'event' ? eventCard(app, cur.id, list.length) : proposalCard(app, cur.id, list.length);
    setChildren(el, card ?? h('span'));
  });
}

function cardShell(app: App, title: string, nid: string | null, n: number, body: (Node | null)[], actions: HTMLElement[]): HTMLElement {
  const later = button('Later', () => {
    app.ui.dockOpen = false;
    app.refresh();
  }, { cls: 'quiet small', title: 'Fold this card; the decision stays waiting' });
  const more = n > 1 ? h('span', { class: 'badge soft' }, `1 of ${n}`) : null;
  return h(
    'div',
    { class: 'decision-card', role: 'dialog', 'aria-label': title },
    h('div', { class: 'dc-head' }, nid ? shield(app, nid) : icon('scroll'), h('h3', null, title), more, later),
    ...body,
    h('div', { class: 'choices' }, ...actions),
  );
}

function eventCard(app: App, instance: string, n: number): HTMLElement | null {
  const sim = app.sim!;
  const pid = app.player!;
  const pe = sim.state.nations[pid].pendingEvents.find((e) => e.id === instance);
  if (!pe) return null;
  const def = EVENT_MAP[pe.event];
  const ctx = eventCtx(sim, pid, pe);
  const choices = def.choices.map((ch, i) => {
    const prob = ch.problem ? ch.problem(ctx) : null;
    const b = h(
      'button',
      { class: `btn choice ${i === 0 ? 'primary' : ''} ${prob ? 'disabled' : ''}`, type: 'button', 'aria-disabled': prob ? 'true' : undefined, 'data-fk': `choice-${i}` },
      h('b', null, ch.label),
      h('span', { class: 'eff' }, ch.effect(ctx)),
      prob ? h('span', { class: 'eff bad' }, prob) : null,
    );
    b.addEventListener('click', () => {
      if (prob) return;
      app.do({ type: 'eventChoice', instance, choice: i }, true);
    });
    return b;
  });
  return cardShell(
    app,
    def.title,
    pe.other ?? null,
    n,
    [
      h('p', { class: 'serif', style: 'font-size:var(--fs-md);margin-top:8px' }, def.text(ctx)),
      pe.province
        ? (() => {
            const a = h('button', { class: 'btn quiet small', type: 'button' }, icon('target'), provName(sim, pe.province!));
            a.addEventListener('click', () => app.selectProvince(pe.province!, true));
            return a;
          })()
        : null,
      h('p', { class: 'small faint' }, `If no choice is made by ${dateOf(sim, pe.expires).short}, “${def.choices[0].label}” (or the first affordable option) is taken.`),
    ],
    choices,
  );
}

function proposalCard(app: App, id: string, n: number): HTMLElement | null {
  const sim = app.sim!;
  const p = sim.state.proposals.find((x) => x.id === id);
  if (!p) return null;
  const body: (Node | null)[] = [];
  const from = nationName(sim, p.from);
  let title = '';
  let declineLabel = 'Decline';
  let acceptLabel = 'Accept';
  const extra: HTMLElement[] = [];
  if (p.kind === 'callToArms') {
    const w = sim.state.wars[p.war!];
    const me = app.player!;
    const ally = hasTreaty(sim, 'alliance', me, p.from);
    const guarantor = !ally && sim.state.guarantees.some((g) => g.by === me && g.of === p.from);
    title = `${from} calls us to arms`;
    const why = ally ? `Our ally ${from}` : guarantor ? `${from}, whose independence we guarantee,` : `${from}, a realm in our sphere of influence,`;
    body.push(h('p', null, `${why} was attacked by ${w ? nationName(sim, w.attackerLead) : 'an enemy'} (${w?.name ?? 'war'}). Answering brings us into the war as a defender.`));
    body.push(
      h(
        'p',
        { class: 'small faint' },
        `${ally ? 'Declining breaks the alliance, costs 15 trust and angers our former ally.' : guarantor ? `Declining ends the guarantee and costs ${C.guarantee.trustLoss} trust.` : 'Declining costs influence over them and their good opinion.'} If we do not answer within four weeks we honour the call.`,
      ),
    );
    declineLabel = ally ? 'Decline (break alliance)' : guarantor ? 'Decline (end guarantee)' : 'Decline';
  } else if (p.kind === 'settlement') {
    const w = sim.state.wars[p.war!];
    const demands = p.demands ?? [];
    const drop = (app.ui.counter = app.ui.counter?.proposal === id ? app.ui.counter : { proposal: id, drop: [] }).drop;
    title = `Peace settlement from ${from}`;
    body.push(h('p', null, `${from} proposes to end the ${w?.name ?? 'war'} for every realm in it, on these terms. Untick demands to make a counter-offer instead.`));
    body.push(
      h(
        'ul',
        { class: 'demand-list' },
        demands.map((d, i) => {
          const cb = h('input', { type: 'checkbox', checked: drop.includes(i) ? undefined : true, 'data-fk': `demand-${i}`, 'aria-label': describeDemand(sim, d) });
          cb.addEventListener('change', () => {
            if (cb.checked) app.ui.counter!.drop = app.ui.counter!.drop.filter((x) => x !== i);
            else app.ui.counter!.drop = [...app.ui.counter!.drop, i];
            // redraw now: the dock is not rebuilt while one of its inputs has focus
            renderDock(app);
          });
          return h('li', null, h('label', null, cb, ' ', describeDemand(sim, d), w ? h('span', { class: 'small faint' }, ` (${demandCost(sim, w, d)})`) : null));
        }),
      ),
    );
    if (w) {
      const kept = demands.filter((_, i) => !drop.includes(i));
      body.push(h('p', { class: 'small faint' }, `Value: ${settlementCost(sim, w, kept)} of ${settlementCost(sim, w, demands)} war-score points. War score: ${Math.round(scoreFor(w, app.player!))} in our view. A 5-year truce follows.`));
      if (drop.length && kept.length) {
        const ev = evaluateSettlement(sim, w.id, p.from, kept);
        body.push(h('p', { class: `small ${ev.accept ? 'good' : 'bad'}` }, `${from} ${ev.accept ? 'would accept' : 'would reject'} this counter-offer (${ev.score >= 0 ? '+' : ''}${Math.round(ev.score)}).`));
      }
      const provs = demands.filter((d) => d.kind === 'cede' && d.province).map((d) => d.province!);
      if (provs.length) {
        const show = h('button', { class: 'btn quiet small', type: 'button' }, icon('target'), 'Show the provinces');
        show.addEventListener('click', () => app.highlightProvinces(provs));
        body.push(show);
      }
    }
    if (drop.length) {
      acceptLabel = 'Send counter-offer';
      if (drop.length >= demands.length) extra.push(h('span', { class: 'small bad' }, 'Keep at least one demand, or decline.'));
    }
    declineLabel = 'Refuse and fight on';
  } else if (p.kind === 'loan') {
    const amount = p.amount ?? 0;
    title = `${from} offers a loan`;
    body.push(h('p', null, `${from} would lend us ${Math.round(amount)} crowns now. We repay ${Math.round((amount * (1 + C.loan.interest)) / C.loan.months)} a month for ${C.loan.months} months (${Math.round(C.loan.interest * 100)}% interest).`));
    body.push(h('p', { class: 'small faint' }, `While we repay, ${from} gains influence over us; enough influence draws a smaller realm into its sphere.`));
  } else if (p.kind === 'contract' && p.contract) {
    const t = p.contract;
    const me = app.player!;
    const buying = t.buyer === me;
    title = buying ? `${from} offers to sell us ${resLabel(t.res).toLowerCase()}` : `${from} wants to buy our ${resLabel(t.res).toLowerCase()}`;
    body.push(termsTable(sim, t));
    body.push(forecastChart(sim, me, t.res, Math.min(12, t.months), t));
    const own = evaluateContract(sim, me, t);
    body.push(
      h(
        'details',
        { class: 'acceptance' },
        h('summary', null, `Our merchants judge it ${own.accept ? 'worth signing' : 'not worth signing'} (${own.score >= 0 ? '+' : ''}${Math.round(own.score)}) — why?`),
        h('ul', { class: 'reasons' }, own.reasons.map((r) => h('li', null, h('span', null, r.label), h('span', { class: r.value >= 0 ? 'pos' : 'neg' }, `${r.value >= 0 ? '+' : ''}${r.value}`)))),
      ),
    );
    body.push(h('p', { class: 'small faint' }, `Ending it early costs a month of its value (${cancelFee(t).toFixed(1)} crowns) and ${C.trade.cancelTrust} trust. Two months short of goods (seller) or unable to pay (buyer) end it in default.`));
    acceptLabel = 'Sign the contract';
  } else if (p.kind === 'blocInvite' || p.kind === 'blocJoin') {
    const b = sim.state.blocs.find((x) => x.id === p.bloc);
    title = p.kind === 'blocJoin' ? `${from} asks to join our trade bloc` : p.bloc === 'new' ? `${from} proposes a trade bloc` : `${from} invites us into the ${b?.name ?? 'trade bloc'}`;
    body.push(h('p', null, `Members offer each other contracts ${Math.round(C.bloc.buyDiscount * 100)}% below list price, earn ${Math.round(C.bloc.commerceBonus * 100)}% more commerce from their agreements with each other, and share the crowns that blockades cost any member.`));
    if (b) body.push(h('p', { class: 'small faint' }, `Members: ${b.members.map((m) => nationName(sim, m)).join(', ')}; led by ${nationName(sim, b.leader)}.`));
  } else if (p.kind === 'peace') {
    const w = sim.state.wars[p.war!];
    const t = p.terms!;
    title = `Peace offer from ${from}`;
    if (t.mode === 'white') body.push(h('p', null, 'A white peace: all occupied land returns to its owner, nobody pays.'));
    else {
      const giver = t.mode === 'demand' ? nationName(sim, p.to) : from;
      body.push(h('p', null, `${giver} would cede ${t.provinces.length ? t.provinces.map((x) => provName(sim, x)).join(', ') : 'no land'}${t.gold ? ` and pay ${Math.round(t.gold)} crowns` : ''}.`));
      if (w) body.push(h('p', { class: 'small faint' }, `Value of these terms: ${termsCost(sim, w, t.mode === 'demand' ? p.to : p.from, t.mode === 'demand' ? p.from : p.to, t)} war-score points. Current war score: ${Math.round(w.score)} (attacker's view).`));
      if (t.provinces.length) {
        const show = h('button', { class: 'btn quiet small', type: 'button' }, icon('target'), 'Show on map');
        show.addEventListener('click', () => app.highlightProvinces(t.provinces));
        body.push(show);
      }
    }
    body.push(h('p', { class: 'small faint' }, 'A 5-year truce follows any peace.'));
  } else if (p.kind === 'nap' || p.kind === 'trade' || p.kind === 'alliance') {
    title = `${from} proposes a ${TREATY_LABELS[p.kind].toLowerCase()}`;
    const what: Record<string, string> = {
      nap: 'Neither side may declare war on the other for 5 years. Cancelling early costs trust and imposes a 12-month cooling-off.',
      trade: `The framework for trade contracts between us (goods move only under a contract), and ${C.economy.tradeCommerce} crown of commerce a month each. War ends it, and every contract under it.`,
      alliance: 'Each side is called to arms when the other is attacked (defensive only). Grants military access.',
    };
    body.push(h('p', null, what[p.kind]));
    if (app.player) {
      const back = evaluateTreaty(sim, app.player, p.from, p.kind as 'nap' | 'trade' | 'alliance');
      body.push(h('p', { class: 'small faint' }, `Their current opinion-based view of the treaty: ${back.score >= 0 ? 'favourable' : 'reluctant'} (${back.score >= 0 ? '+' : ''}${Math.round(back.score)}).`));
    }
  }
  body.push(h('p', { class: 'small faint' }, `Expires ${dateOf(sim, p.expires).short}.`));
  const drop = p.kind === 'settlement' && app.ui.counter?.proposal === id ? app.ui.counter.drop : [];
  const accept = button(acceptLabel, () => {
    const r = app.do(drop.length ? { type: 'respond', proposal: id, accept: true, drop } : { type: 'respond', proposal: id, accept: true });
    if (r.ok) app.ui.counter = null;
  }, { cls: 'primary choice', fk: 'accept', disabled: drop.length && drop.length >= (p.demands?.length ?? 0) ? 'Keep at least one demand.' : null });
  const decline = button(declineLabel, () => {
    app.ui.counter = null;
    app.do({ type: 'respond', proposal: id, accept: false });
  }, { cls: `choice ${p.kind === 'callToArms' ? 'danger' : ''}`, fk: 'decline' });
  return cardShell(app, title, p.from, n, [...body, ...extra], [accept, decline]);
}
