// Shared pieces of the trade interface: the stock forecast chart (drawn from the
// simulation's own forecast), contract terms in words, and acceptance reasons.

import { C } from '../sim/config';
import { capOf, contractLag, describeTerms, evaluateContract, FORECAST_ASSUMPTIONS, forecast, listPrice, monthlyValue, resLabel } from '../sim/trade';
import { dateOf, nationName, type Sim } from '../sim/state';
import type { ContractTerms, NationId, Tradeable } from '../sim/types';
import { h } from './dom';
import { fmt } from './format';

const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/**
 * The next months of a realm's stock of one good: the line as things stand, and
 * (when `extra` is given) the line with the proposed contract; the reserve the
 * realm keeps and its stockpile cap as rules; months with a shortfall marked.
 */
export function forecastChart(sim: Sim, nid: NationId, res: Tradeable, months = 12, extra: ContractTerms | null = null): HTMLElement {
  const base = forecast(sim, nid, res, months);
  const alt = extra ? forecast(sim, nid, res, months, extra) : null;
  const cap = capOf(sim, nid, res);
  const keep = cap * C.resources.keepShare;
  const W = 520;
  const H = 120;
  const L = 34;
  const R = 8;
  const T = 8;
  const B = 22;
  const max = Math.max(cap, 1);
  const x = (i: number) => L + ((W - L - R) * i) / Math.max(1, months - 1);
  const y = (v: number) => T + (H - T - B) * (1 - Math.min(1, Math.max(0, v / max)));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'forecast', role: 'img', preserveAspectRatio: 'none' });
  const label = `${resLabel(res)} stock forecast for ${months} months`;
  svg.setAttribute('aria-label', label);
  // rules: cap and reserve
  svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(cap), y2: y(cap), class: 'fc-cap' }));
  svg.appendChild(s('line', { x1: L, x2: W - R, y1: y(keep), y2: y(keep), class: 'fc-keep' }));
  const t1 = s('text', { x: L - 4, y: y(cap) + 4, class: 'fc-ax', 'text-anchor': 'end' });
  t1.textContent = fmt(cap);
  svg.appendChild(t1);
  const t2 = s('text', { x: L - 4, y: y(keep) + 4, class: 'fc-ax', 'text-anchor': 'end' });
  t2.textContent = fmt(keep);
  svg.appendChild(t2);
  const t0 = s('text', { x: L - 4, y: y(0) + 4, class: 'fc-ax', 'text-anchor': 'end' });
  t0.textContent = '0';
  svg.appendChild(t0);
  // shortfall months
  const shortOf = alt ?? base;
  shortOf.forEach((m, i) => {
    if (m.short > 0.05) svg.appendChild(s('rect', { x: x(i) - 6, y: T, width: 12, height: H - T - B, class: 'fc-short' }));
  });
  const path = (list: typeof base) => list.map((m, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(m.stock).toFixed(1)}`).join('');
  svg.appendChild(s('path', { d: path(base), class: alt ? 'fc-base dim' : 'fc-base' }));
  if (alt) svg.appendChild(s('path', { d: path(alt), class: 'fc-alt' }));
  // month labels: first, middle, last
  for (const i of [0, Math.floor((months - 1) / 2), months - 1]) {
    const t = s('text', { x: x(i), y: H - 6, class: 'fc-ax', 'text-anchor': i === 0 ? 'start' : i === months - 1 ? 'end' : 'middle' });
    t.textContent = dateOf(sim, base[i].tick).short;
    svg.appendChild(t);
  }
  const shortMonths = shortOf.filter((m) => m.short > 0.05).length;
  const wasted = shortOf.reduce((a, m) => a + m.wasted, 0);
  const minStock = Math.min(...shortOf.map((m) => m.stock));
  const legend = h(
    'div',
    { class: 'fc-legend small' },
    h('span', { class: 'fc-key base' }, alt ? 'As things stand' : 'Stock'),
    alt ? h('span', { class: 'fc-key alt' }, 'With this contract') : null,
    h('span', { class: 'fc-key keep' }, `Reserve kept (${fmt(keep)})`),
    h('span', { class: 'fc-key cap' }, `Stockpile cap (${fmt(cap)})`),
    shortMonths ? h('span', { class: 'fc-key short' }, `Short in ${shortMonths} month${shortMonths === 1 ? '' : 's'}`) : null,
  );
  const verdict = shortMonths
    ? h('p', { class: 'small bad' }, `Our own use goes short in ${shortMonths} of the next ${months} months${alt ? ' with this contract' : ''}.`)
    : wasted > 0.5
      ? h('p', { class: 'small warn' }, `About ${fmt(wasted)} would be lost above the stockpile cap over ${months} months.`)
      : h('p', { class: 'small muted' }, `Stock stays between ${fmt(minStock)} and the cap; no shortfall forecast.`);
  return h('figure', { class: 'forecast-fig', 'data-sk': 'forecast' }, svg, legend, verdict, h('figcaption', { class: 'small faint' }, FORECAST_ASSUMPTIONS));
}

/** Acceptance as the other side would judge it now: verdict, score and the reasons behind it. */
export function acceptance(sim: Sim, judge: NationId, t: ContractTerms): HTMLElement {
  const ev = evaluateContract(sim, judge, t);
  const verdict = ev.accept ? (ev.score >= 10 ? 'Likely to accept' : 'Would just accept') : 'Likely to refuse';
  return h(
    'details',
    { class: `acceptance ${ev.accept ? 'good' : 'bad'}` },
    h('summary', null, `${verdict} (${ev.score >= 0 ? '+' : ''}${Math.round(ev.score)}) — why?`),
    h(
      'ul',
      { class: 'reasons' },
      ev.reasons.map((r) => h('li', null, h('span', null, r.label), h('span', { class: r.value >= 0 ? 'pos' : 'neg' }, `${r.value >= 0 ? '+' : ''}${r.value}`))),
    ),
  );
}

/** The terms in one register: who ships what to whom, price, value, term and delivery. */
export function termsTable(sim: Sim, t: ContractTerms): HTMLElement {
  const lag = contractLag(sim, t.seller, t.buyer);
  const rows: Array<[string, string]> = [
    ['Seller', nationName(sim, t.seller)],
    ['Buyer', nationName(sim, t.buyer)],
    ['Goods', `${t.qty} ${resLabel(t.res).toLowerCase()} a month`],
    ['Price', `${t.price.toFixed(2)} crowns a unit (list price ${listPrice(t.res)})`],
    ['Value', `${monthlyValue(t).toFixed(1)} crowns a month, ${(monthlyValue(t) * t.months).toFixed(0)} over the term`],
    ['Term', `${t.months} months`],
    ['Delivery', lag ? `by sea: arrives ${lag} month${lag === 1 ? '' : 's'} after shipping; a blockade holds back its share` : 'overland: delivered the month it is shipped'],
  ];
  return h('table', { class: 'register' }, h('tbody', null, rows.map(([k, v]) => h('tr', null, h('td', { class: 'muted' }, k), h('td', null, v)))));
}

export function termsSentence(sim: Sim, t: ContractTerms): string {
  return describeTerms(sim, t);
}
