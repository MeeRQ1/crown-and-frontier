// Industry & Trade: a production and stock ledger with a trade workspace.
//
// The commodity register shows, for every good, what is held and what of it is
// already promised (reserved for contracts), what the provinces produce and the
// realm uses, the contracted flows in and out, goods under way, and the
// forecast's verdict. Selecting a good opens its workspace: the stock forecast,
// the contracts in force and how this month's shipment went, goods under way,
// and every trade partner's position in that good, with an offer form whose
// acceptance, cost and effect on our stock are shown before it is sent.

import { C, RESOURCE_INFO } from '../../sim/config';
import { activeProjects, buildSlots } from '../../sim/construction';
import { effectiveFactories, factoryCount, materielCap, provinceDeposit, resourcePlan, shortageEffect } from '../../sim/economy';
import { checkCommand } from '../../sim/commands';
import {
  cancelFee,
  capOf,
  contractLag,
  contractPlan,
  contractsOf,
  dependence,
  forecast,
  listPrice,
  monthlyBalance,
  monthlyValue,
  nextSettlement,
  resLabel,
  stockOf,
  surplusOf,
  TRADEABLE,
} from '../../sim/trade';
import { sameBloc } from '../../sim/influence';
import { aliveNations, atWar, dateOf, hasTreaty, nationName, ownedProvinces, provName, treatyPartners } from '../../sim/state';
import type { ContractTerms, NationId, Tradeable } from '../../sim/types';
import type { App } from '../app';
import { button, h } from '../dom';
import { fmt, plural, signed } from '../format';
import { icon } from '../icons';
import { confirmDialog } from '../panels/dialogs';
import { shield } from '../panels/common';
import { renderLedger } from '../panels/ledgers';
import { resourceArt } from '../resource-art';
import { acceptance, forecastChart, termsTable } from '../trade-ui';

interface Position {
  res: Tradeable;
  stock: number;
  cap: number;
  reserved: number;
  produced: number;
  need: number;
  inQty: number;
  outQty: number;
  underWay: number;
  short: number;
  firstShort: number;
  minStock: number;
  wasted: number;
}

function position(app: App, nid: NationId, res: Tradeable): Position {
  const sim = app.sim!;
  const st = sim.state;
  const mine = contractsOf(sim, nid).filter((c) => c.res === res);
  const f = forecast(sim, nid, res, 6);
  const firstShort = f.findIndex((m) => m.short > 0.05);
  const { produced, need } = monthlyBalance(sim, nid, res);
  return {
    res,
    stock: stockOf(sim, nid, res),
    cap: capOf(sim, nid, res),
    reserved: mine.filter((c) => c.seller === nid).reduce((a, c) => a + c.qty, 0),
    produced,
    need,
    inQty: mine.filter((c) => c.buyer === nid).reduce((a, c) => a + c.qty, 0),
    outQty: mine.filter((c) => c.seller === nid).reduce((a, c) => a + c.qty, 0),
    underWay: st.shipments.filter((s) => s.buyer === nid && s.res === res).reduce((a, s) => a + s.qty, 0),
    short: f.reduce((a, m) => a + m.short, 0),
    firstShort,
    minStock: Math.min(...f.map((m) => m.stock)),
    wasted: f.reduce((a, m) => a + m.wasted, 0),
  };
}

function statusOf(p: Position): { cls: string; text: string } {
  if (p.firstShort >= 0) return { cls: 'bad', text: p.firstShort === 0 ? 'Short now' : `Short in ${p.firstShort + 1} months` };
  if (p.minStock < p.cap * C.resources.keepShare) return { cls: 'warn', text: 'Below reserve' };
  if (p.wasted > 0.5) return { cls: 'warn', text: `Full: ${fmt(p.wasted)} lost` };
  return { cls: 'good', text: 'Sound' };
}

/** A stock bar: free stock, the part reserved for contracts (hatched), and the reserve line. */
function stockBar(p: Position): HTMLElement {
  const cap = Math.max(1, p.cap);
  const reserved = Math.min(p.stock, p.reserved);
  return h(
    'div',
    { class: 'stockbar', title: `${fmt(p.stock)} of ${fmt(p.cap)}; ${fmt(reserved)} of it reserved for contracts; reserve kept: ${fmt(p.cap * C.resources.keepShare)}` },
    h('span', { class: 'free', style: `width:${((p.stock - reserved) / cap) * 100}%` }),
    h('span', { class: 'reserved', style: `width:${(reserved / cap) * 100}%` }),
    h('i', { class: 'keep', style: `left:${C.resources.keepShare * 100}%` }),
  );
}

export function industryLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return h('p', { class: 'muted' }, 'Observer mode: no realm of your own.');
  const st = sim.state;
  const n = st.nations[pid];
  const positions = TRADEABLE.map((r) => position(app, pid, r));
  // the workspace opens on the chosen good, else the most pressing one
  // urgency: a shortfall first (soonest first), then stock below the reserve, then goods going to waste
  const rank = (p: Position) => (p.firstShort >= 0 ? p.firstShort : p.minStock < p.cap * C.resources.keepShare ? 10 : p.wasted > 0.5 ? 20 : 30);
  const urgent = [...positions].sort((a, b) => rank(a) - rank(b) || a.minStock / Math.max(1, a.cap) - b.minStock / Math.max(1, b.cap))[0];
  const good = app.ui.tradeGood ?? urgent.res;
  const partners = treatyPartners(sim, 'trade', pid).filter((o) => st.nations[o]?.alive);
  const mine = contractsOf(sim, pid);
  const plan = contractPlan(sim);

  // ── summary strip ──
  const fac = factoryCount(sim, pid);
  const summary = h(
    'div',
    { class: 'strip' },
    h('div', null, h('span', { class: 'k' }, 'Trade agreements'), h('b', null, String(partners.length))),
    h('div', null, h('span', { class: 'k' }, 'Contracts'), h('b', null, `${mine.filter((c) => c.buyer === pid).length} buying · ${mine.filter((c) => c.seller === pid).length} selling`)),
    h('div', null, h('span', { class: 'k' }, 'Last month'), h('b', null, `${signed((n.lastMonth.income['Contract sales'] ?? 0) - (n.lastMonth.expenses['Contract purchases'] ?? 0), 1)} cr`)),
    h('div', null, h('span', { class: 'k' }, 'Under way to us'), h('b', null, plural(st.shipments.filter((s) => s.buyer === pid).length, 'shipment'))),
    h('div', null, h('span', { class: 'k' }, 'Factories'), h('b', null, `${fac} · IC ${fmt(n.lastMonth.industry, 1)}`)),
  );

  // ── commodity register ──
  const head = h('tr', null, ...['Good', 'Stock (reserved)', 'Output', 'Use', 'Bought', 'Sold', 'Under way', 'Six months'].map((t, i) => h('th', { class: i && i < 7 ? 'r' : '' }, t)));
  const rows = positions.map((p) => {
    const sel = p.res === good;
    const s = statusOf(p);
    const tr = h(
      'tr',
      { class: `link ${sel ? 'selected' : ''}`, tabindex: '0', 'data-fk': `good-${p.res}`, 'aria-selected': sel ? 'true' : 'false' },
      h('td', { class: 'good-cell' }, resourceArt(p.res, 40), h('span', null, h('b', null, resLabel(p.res)), h('small', { class: 'muted' }, `list ${listPrice(p.res)}`))),
      h('td', { class: 'r' }, h('div', null, `${fmt(p.stock)} / ${fmt(p.cap)}`, p.reserved ? h('span', { class: 'muted' }, ` (${fmt(Math.min(p.stock, p.reserved))})`) : null), stockBar(p)),
      h('td', { class: 'r' }, fmt(p.produced, 1)),
      h('td', { class: 'r' }, fmt(p.need, 1)),
      h('td', { class: 'r' }, p.inQty ? `+${fmt(p.inQty, 0)}` : '—'),
      h('td', { class: 'r' }, p.outQty ? `−${fmt(p.outQty, 0)}` : '—'),
      h('td', { class: 'r' }, p.underWay ? fmt(p.underWay, 1) : '—'),
      h('td', null, h('span', { class: `tag ${s.cls}` }, s.text)),
    );
    const pick = () => {
      app.ui.tradeGood = p.res;
      app.ui.tradeDraft = null;
      renderLedger(app);
      app.refresh();
    };
    tr.addEventListener('click', pick);
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });
    return tr;
  });
  const register = h('table', { class: 'register commodity', 'data-sk': 'commodities' }, h('thead', null, head), h('tbody', null, rows));

  return h(
    'div',
    { class: 'ledger-industry' },
    summary,
    register,
    h('p', { class: 'small faint' }, `Reserved: stock promised to buyers this month; contracted goods are shipped before our own use. Six months: the forecast from this month's production and use and the contracts in force. Click a good to trade it.`),
    workspace(app, pid, good, positions.find((p) => p.res === good)!, partners, plan),
    industrySection(app, pid),
    h(
      'details',
      { class: 'more rules' },
      h('summary', null, 'How trade works'),
      h('p', { class: 'small' }, `Goods move between realms only under a contract, signed under a trade agreement: a good, a quantity a month (${C.trade.minQty}–${C.trade.maxQty}), a price per unit (${Math.round(C.trade.priceMin * 100)}–${Math.round(C.trade.priceMax * 100)}% of list) and a term (${C.trade.terms.join(', ')} months). Each month the seller ships before its own use; overland the goods arrive the same month, by sea a month later, and the buyer pays on delivery. A blockade holds back its share of a sea shipment. A buyer in debt is not shipped to.`),
      h('p', { class: 'small' }, `Two months short (seller) or unable to pay (buyer) end a contract in default (−${C.trade.defaultTrust} trust). Ending one early costs a month of its value and ${C.trade.cancelTrust} trust; ending the trade agreement ends its contracts at the same cost. War ends contracts at once, and goods under way go back to the seller unpaid. Inside a trade bloc, members offer each other ${Math.round(C.bloc.buyDiscount * 100)}% below list. Each agreement also brings ${C.economy.tradeCommerce} crown of commerce a month.`),
    ),
  );
}

function workspace(app: App, pid: NationId, res: Tradeable, p: Position, partners: NationId[], plan: ReturnType<typeof contractPlan>): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const draft = app.ui.tradeDraft && app.ui.tradeDraft.res === res ? app.ui.tradeDraft : null;
  const contracts = st.contracts.filter((c) => c.res === res && (c.seller === pid || c.buyer === pid));
  const ship = st.shipments.filter((s) => s.res === res && (s.buyer === pid || s.seller === pid));
  const kids: Array<Node | null> = [];
  kids.push(
    h(
      'header',
      { class: 'ws-head' },
      resourceArt(res, 52),
      h('div', null, h('h3', null, resLabel(res)), h('p', { class: 'small muted' }, RESOURCE_INFO[res].use), res !== 'food' && p.firstShort >= 0 ? h('p', { class: 'small bad' }, shortageEffect(res)) : null),
    ),
  );
  kids.push(forecastChart(sim, pid, res, 12, draft));

  // contracts in force
  kids.push(h('h4', null, `Contracts in force (${contracts.length})`));
  if (!contracts.length) kids.push(h('p', { class: 'small muted' }, `No ${resLabel(res).toLowerCase()} contracts. Partners' positions are below.`));
  else {
    kids.push(
      h(
        'table',
        { class: 'register', 'data-sk': 'contracts' },
        h('thead', null, h('tr', null, ...['Partner', 'Terms', 'Delivery', 'Term left', 'This month', ''].map((t) => h('th', null, t)))),
        h(
          'tbody',
          null,
          contracts.map((c) => {
            const other = c.seller === pid ? c.buyer : c.seller;
            const line = plan.lines.find((l) => l.c.id === c.id);
            const status = !line
              ? '—'
              : line.withheld
                ? c.buyer === pid
                  ? 'Withheld: we are in debt'
                  : 'Withheld: they are in debt'
                : line.short > 0.05
                  ? `Short: ${fmt(line.ship, 1)} of ${c.qty}`
                  : line.blocked > 0.05
                    ? `Blockade holds back ${fmt(line.blocked, 1)}`
                    : `Ships ${fmt(line.ship, 1)} in full`;
            const left = Math.max(0, Math.round((c.until - nextSettlement(st.tick)) / 4));
            const end = button('End early', () =>
              confirmDialog(
                app,
                `End the ${resLabel(c.res).toLowerCase()} contract with ${nationName(sim, other)}?`,
                `We pay ${nationName(sim, other)} ${cancelFee(c).toFixed(1)} crowns (a month of its value) and lose ${C.trade.cancelTrust} trust; they will think less of us. Goods already under way still arrive and are paid for.`,
                () => app.do({ type: 'cancelContract', contract: c.id }),
                'End the contract',
              ),
            { cls: 'small quiet', fk: `end-${c.id}` });
            return h(
              'tr',
              null,
              h('td', null, shield(app, other), ' ', nationName(sim, other)),
              h('td', null, `${c.seller === pid ? 'Sell' : 'Buy'} ${c.qty}/mo at ${c.price.toFixed(2)}`, h('br'), h('small', { class: 'muted' }, `${monthlyValue(c).toFixed(1)} cr a month`)),
              h('td', null, c.lag ? `Sea, ${c.lag} mo` : 'Overland'),
              h('td', null, `${left} mo`, h('br'), h('small', { class: 'muted' }, `to ${dateOf(sim, c.until).short}`)),
              h('td', { class: line && (line.short > 0.05 || line.withheld) ? 'bad' : line && line.blocked > 0.05 ? 'warn' : '' }, status, c.sellerMisses || c.buyerMisses ? h('small', { class: 'bad' }, ' · one more miss ends it') : null),
              h('td', null, end),
            );
          }),
        ),
      ),
    );
  }
  if (ship.length) {
    kids.push(h('h4', null, 'Under way'));
    kids.push(
      h(
        'ul',
        { class: 'plain small' },
        ship.map((s) => h('li', null, `${fmt(s.qty, 1)} ${s.buyer === pid ? `from ${nationName(sim, s.seller)}` : `to ${nationName(sim, s.buyer)}`}, arriving ${dateOf(sim, s.arrives).short}; paid on delivery (${(s.qty * s.price).toFixed(1)} cr)`)),
      ),
    );
  }

  // dependence on single suppliers
  const dep = dependence(sim, pid).filter((d) => d.res === res && d.share >= C.trade.dependence);
  for (const d of dep) kids.push(h('p', { class: 'callout warn small' }, icon('alert'), `${nationName(sim, d.partner)} supplies ${Math.round(d.share * 100)}% of our ${resLabel(res).toLowerCase()}. A war with them, or a blockade, would cut it.`));

  // partners and their positions
  kids.push(h('h4', null, 'Partners'));
  if (!partners.length) kids.push(h('p', { class: 'small muted' }, 'We have no trade agreements: contracts are signed under one. Propose one in Diplomacy.'));
  else {
    kids.push(
      h(
        'table',
        { class: 'register', 'data-sk': 'partners' },
        h('thead', null, h('tr', null, ...['Partner', `Their ${resLabel(res).toLowerCase()}`, 'Delivery', ''].map((t) => h('th', null, t)))),
        h(
          'tbody',
          null,
          partners.map((o) => {
            const s = surplusOf(sim, o, res);
            const theirs = s.short > 0.5 ? h('span', { class: 'bad' }, `short ${fmt(s.need, 1)}/mo`) : s.need >= 0.5 ? h('span', { class: 'warn' }, `wants ${fmt(s.need, 1)}/mo`) : s.surplus >= 1 ? h('span', { class: 'good' }, `spare ${fmt(s.surplus, 1)}/mo`) : h('span', { class: 'muted' }, 'balanced');
            const ours = surplusOf(sim, pid, res);
            const label = resLabel(res).toLowerCase();
            // only what can be traded is offered; the reason is given when it cannot
            const canBuy = s.surplus >= 1 ? null : `${nationName(sim, o)} has no ${label} to spare`;
            const canSell = ours.surplus >= 1 ? null : `We have no ${label} to spare`;
            const buy = button('Buy', () => startDraft(app, { seller: o, buyer: pid, res, qty: clampQty(Math.max(1, Math.min(s.surplus, Math.max(ours.need, 3)))), price: defaultPrice(app, o, pid, res), months: 12 }), { cls: `small ${!canBuy && ours.need >= 0.5 ? 'primary' : ''}`, fk: `buy-${o}`, disabled: canBuy });
            const sell = button('Sell', () => startDraft(app, { seller: pid, buyer: o, res, qty: clampQty(Math.max(1, Math.min(Math.max(s.need, 3), ours.surplus))), price: defaultPrice(app, pid, o, res), months: 12 }), { cls: `small ${!canSell && s.need >= 0.5 ? 'primary' : ''}`, fk: `sell-${o}`, disabled: canSell });
            return h('tr', null, h('td', null, shield(app, o), ' ', nationName(sim, o), sameBloc(sim, pid, o) ? h('small', { class: 'muted' }, ' · bloc') : null), h('td', null, theirs), h('td', null, contractLag(sim, o, pid) ? 'Sea' : 'Overland'), h('td', { class: 'r' }, buy, ' ', sell));
          }),
        ),
      ),
    );
  }
  const others = aliveNations(sim).filter((o) => o !== pid && !hasTreaty(sim, 'trade', pid, o) && !atWar(sim, pid, o));
  const wanting = others.filter((o) => surplusOf(sim, o, res).surplus >= 1);
  if (wanting.length) kids.push(h('p', { class: 'small muted' }, `Without a trade agreement, ${wanting.slice(0, 4).map((o) => nationName(sim, o)).join(', ')}${wanting.length > 4 ? ` and ${wanting.length - 4} more` : ''} also ${wanting.length === 1 ? 'has' : 'have'} ${resLabel(res).toLowerCase()} to spare.`));

  if (draft) kids.push(draftForm(app, pid, draft));
  return h('section', { class: 'workspace', 'data-sk': 'trade-workspace' }, ...kids);
}

function clampQty(v: number): number {
  return Math.max(C.trade.minQty, Math.min(C.trade.maxQty, Math.round(v)));
}

function defaultPrice(app: App, seller: NationId, buyer: NationId, res: Tradeable): number {
  const lp = listPrice(res);
  return Math.round(lp * (sameBloc(app.sim!, seller, buyer) ? 1 - C.bloc.buyDiscount : 1) * 100) / 100;
}

function startDraft(app: App, t: ContractTerms): void {
  app.ui.tradeDraft = t;
  renderLedger(app);
  (app.drawerEl.querySelector('[data-sk="contract-draft"]') as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
}

/** The offer form: quantity, price and term, with the other side's view, the cost and the effect, before sending. */
function draftForm(app: App, pid: NationId, t: ContractTerms): HTMLElement {
  const sim = app.sim!;
  const other = t.seller === pid ? t.buyer : t.seller;
  const update = (patch: Partial<ContractTerms>) => {
    app.ui.tradeDraft = { ...t, ...patch };
    renderLedger(app);
  };
  const lp = listPrice(t.res);
  const qty = h('input', { type: 'number', min: String(C.trade.minQty), max: String(C.trade.maxQty), step: '1', value: String(t.qty), 'aria-label': 'Units a month', 'data-fk': 'draft-qty' });
  qty.addEventListener('change', () => update({ qty: clampQty(Number(qty.value) || 1) }));
  const minus = button('', () => update({ qty: clampQty(t.qty - 1) }), { cls: 'icon small', icon: 'minus', title: 'One unit fewer' });
  const plus = button('', () => update({ qty: clampQty(t.qty + 1) }), { cls: 'icon small', icon: 'plus', title: 'One unit more' });
  const price = h('input', { type: 'range', min: String(lp * C.trade.priceMin), max: String(lp * C.trade.priceMax), step: '0.05', value: String(t.price), 'aria-label': 'Price per unit', 'data-fk': 'draft-price' });
  const priceOut = h('output', null, `${t.price.toFixed(2)} (${Math.round((t.price / lp) * 100)}% of list)`);
  price.addEventListener('input', () => (priceOut.textContent = `${Number(price.value).toFixed(2)} (${Math.round((Number(price.value) / lp) * 100)}% of list)`));
  price.addEventListener('change', () => update({ price: Math.round(Number(price.value) * 100) / 100 }));
  const terms = h(
    'div',
    { class: 'segmented' },
    C.trade.terms.map((m) => {
      const b = h('button', { type: 'button', class: m === t.months ? 'active' : '', 'aria-pressed': m === t.months ? 'true' : 'false' }, `${m} mo`);
      b.addEventListener('click', () => update({ months: m }));
      return b;
    }),
  );
  const problem = checkCommand(sim, { type: 'offerContract', nation: pid, terms: t });
  const send = button(sim.state.nations[other].isPlayer ? 'Propose to them' : 'Propose', () => {
    const r = app.do({ type: 'offerContract', terms: t });
    if (r.ok) app.ui.tradeDraft = null;
    renderLedger(app);
  }, { cls: 'primary', disabled: problem, fk: 'draft-send' });
  const cancel = button('Discard', () => {
    app.ui.tradeDraft = null;
    renderLedger(app);
  }, { cls: 'quiet', fk: 'draft-discard' });
  return h(
    'div',
    { class: 'draft card-register', 'data-sk': 'contract-draft' },
    h('h4', null, t.seller === pid ? `Offer to sell to ${nationName(sim, other)}` : `Offer to buy from ${nationName(sim, other)}`),
    h(
      'div',
      { class: 'draft-grid' },
      h('label', { class: 'field' }, h('span', { class: 'label' }, 'Units a month'), h('div', { class: 'row' }, minus, qty, plus)),
      h('label', { class: 'field' }, h('span', { class: 'label' }, 'Price per unit'), price, priceOut),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Term'), terms),
    ),
    termsTable(sim, t),
    acceptance(sim, other, t),
    h('p', { class: 'small muted' }, `${t.buyer === pid ? `We pay ${monthlyValue(t).toFixed(1)} crowns a month on delivery` : `They pay us ${monthlyValue(t).toFixed(1)} crowns a month on delivery`}; the forecast above shows the effect on our stock. Ending it early would cost ${cancelFee(t).toFixed(1)} crowns.`),
    problem ? h('p', { class: 'small bad' }, problem) : null,
    h('div', { class: 'row' }, send, cancel),
  );
}

function industrySection(app: App, pid: NationId): HTMLElement {
  const sim = app.sim!;
  const n = sim.state.nations[pid];
  const l = n.lastMonth;
  const plan = resourcePlan(sim, pid);
  const mcap = materielCap(sim, pid);
  const link = (p: string) => {
    const b = h('button', { class: 'linkish', type: 'button' }, provName(sim, p));
    b.addEventListener('click', () => {
      app.closeLedger();
      app.selectProvince(p, true);
    });
    return b;
  };
  const factoryProvs = ownedProvinces(sim, pid)
    .filter((p) => sim.state.provinces[p].factories > 0)
    .sort((a, b) => sim.state.provinces[b].factories - sim.state.provinces[a].factories || (a < b ? -1 : 1));
  const deposits = ownedProvinces(sim, pid)
    .map((p) => ({ p, d: provinceDeposit(sim, p) }))
    .filter((x): x is { p: string; d: NonNullable<ReturnType<typeof provinceDeposit>> } => !!x.d)
    .sort((a, b) => b.d.amount - a.d.amount || (a.p < b.p ? -1 : 1));
  const coalShort = n.shortages.includes('coal');
  return h(
    'section',
    { class: 'section industry' },
    h('div', { class: 'eyebrow' }, 'Industry'),
    h(
      'table',
      { class: 'register' },
      h(
        'tbody',
        null,
        h('tr', null, h('td', null, 'Factories'), h('td', { class: 'r' }, `${factoryCount(sim, pid)} (${fmt(effectiveFactories(sim, pid), 1)} effective)`)),
        h('tr', null, h('td', null, 'Industrial capacity'), h('td', { class: 'r' }, `${fmt(l.industry, 1)}${coalShort ? ' — coal short' : ''}`)),
        h('tr', null, h('td', null, 'Coal for factories'), h('td', { class: 'r' }, `${fmt(plan.factoryCoal, 1)} a month`)),
        h('tr', null, h('td', null, 'Materiel'), h('td', { class: 'r' }, `${fmt(n.materiel)} / ${fmt(mcap)} (+${fmt(l.materielIn, 1)} last month)`)),
        l.income['Manufactured goods'] ? h('tr', null, h('td', null, 'Surplus sold as goods'), h('td', { class: 'r' }, `${fmt(l.income['Manufactured goods'], 1)} crowns`)) : null,
        h('tr', null, h('td', null, 'Builders'), h('td', { class: 'r' }, `${activeProjects(sim, pid).length} of ${buildSlots(sim, pid)} busy`)),
      ),
    ),
    h('p', { class: 'small muted' }, `Each factory makes ${C.industry.materielPerIC} materiel a month at full coal and integration (without coal, ${Math.round(C.industry.unpowered * 100)}%); workshops add a little everywhere. Materiel equips new regiments and replaces losses; a full stockpile's output is sold as manufactured goods. Build factories from a province card.`),
    h(
      'div',
      { class: 'cols' },
      h(
        'div',
        null,
        h('h4', null, 'Factory provinces'),
        factoryProvs.length
          ? h('ul', { class: 'plain linklist' }, factoryProvs.slice(0, 10).map((p) => h('li', null, link(p), ` · ${sim.state.provinces[p].factories}`)))
          : h('p', { class: 'small muted' }, 'None yet.'),
      ),
      h(
        'div',
        null,
        h('h4', null, 'Deposits'),
        deposits.length
          ? h('ul', { class: 'plain linklist' }, deposits.slice(0, 10).map((x) => h('li', null, link(x.p), ` · ${RESOURCE_INFO[x.d.res].label} ${fmt(x.d.amount, 1)}/mo`)))
          : h('p', { class: 'small muted' }, 'No deposits in our provinces.'),
      ),
    ),
  );
}
