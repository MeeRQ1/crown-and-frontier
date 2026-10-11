// Realm & Budget: a financial statement. The register sets last month's
// settlement beside the projection for the coming one (the same ledger code the
// settlement runs), every line linked to where its cause is controlled; the
// realm's reserves — food, manpower, administration — sit alongside; research
// funding shows what each level costs before it is chosen.

import { C, RESOURCE_INFO } from '../../sim/config';
import { PROJECT_LABELS } from '../../sim/construction';
import { computeLedger, debtStage, grossIncome, manpowerRegen, menServing, monthsOfFunds, poolCap, provinceCrowns, reserveCap, stockpileCap } from '../../sim/economy';
import { adminCapacity, frontierLoad, overextension } from '../../sim/integration';
import { researchRate } from '../../sim/progression';
import { dateOf, ownedProvinces, provName } from '../../sim/state';
import type { MonthlyLedger } from '../../sim/types';
import type { App } from '../app';
import type { LedgerTab } from '../panels/ledgers';
import { bar, h } from '../dom';
import { fmt, signed } from '../format';

/** statement figures: always one decimal, with a true minus sign */
const n1 = (v: number) => `${v < -0.05 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

/** Where each budget line is controlled. */
const LINKS: Record<string, LedgerTab> = {
  'Army upkeep': 'military',
  'Fleet upkeep': 'military',
  'Air wing upkeep': 'military',
  'Contract purchases': 'industry',
  'Contract sales': 'industry',
  Commerce: 'industry',
  'Manufactured goods': 'industry',
  Envoys: 'diplomacy',
  'Loan repayments': 'diplomacy',
  'Loans repaid to us': 'diplomacy',
  Reparations: 'wars',
  'Reparations received': 'wars',
  'War contributions': 'wars',
  'Bloc solidarity': 'diplomacy',
};

function statement(app: App, last: MonthlyLedger, next: MonthlyLedger): HTMLElement {
  const lines = (pick: (l: MonthlyLedger) => Record<string, number>) => {
    const keys = [...new Set([...Object.keys(pick(last)), ...Object.keys(pick(next))])];
    return keys.sort((a, b) => (pick(next)[b] ?? pick(last)[b] ?? 0) - (pick(next)[a] ?? pick(last)[a] ?? 0));
  };
  const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
  const row = (k: string, a: number | undefined, b: number | undefined, sign: 1 | -1) => {
    const link = LINKS[k];
    const tr = h('tr', { class: link ? 'link' : '' }, h('td', null, k, link ? h('small', { class: 'muted' }, ` → ${link === 'military' ? 'Military' : link === 'industry' ? 'Industry & Trade' : link === 'diplomacy' ? 'Diplomacy' : 'Wars & Peace'}`) : null), h('td', { class: 'r' }, a === undefined ? '—' : n1(sign * a)), h('td', { class: 'r' }, b === undefined ? '—' : n1(sign * b)));
    if (link) tr.addEventListener('click', () => app.openLedger(link));
    return tr;
  };
  const inc = lines((l) => l.income);
  const exp = lines((l) => l.expenses);
  return h(
    'table',
    { class: 'register statement', 'data-sk': 'statement' },
    h('thead', null, h('tr', null, h('th', null, 'Crowns'), h('th', { class: 'r' }, `Last month`), h('th', { class: 'r' }, 'This month (projected)'))),
    h(
      'tbody',
      null,
      h('tr', { class: 'sub' }, h('td', { colspan: '3' }, h('b', null, 'Income'))),
      inc.map((k) => row(k, last.income[k], next.income[k], 1)),
      h('tr', { class: 'sub' }, h('td', null, 'Gross income'), h('td', { class: 'r' }, n1(total(last.income))), h('td', { class: 'r' }, n1(total(next.income)))),
      h('tr', { class: 'sub' }, h('td', { colspan: '3' }, h('b', null, 'Expenses'))),
      exp.map((k) => row(k, last.expenses[k], next.expenses[k], -1)),
      h('tr', { class: 'total' }, h('td', null, 'Net'), h('td', { class: `r ${last.net >= 0 ? 'good' : 'bad'}` }, signed(last.net, 1)), h('td', { class: `r ${next.net >= 0 ? 'good' : 'bad'}` }, signed(next.net, 1))),
    ),
  );
}

export function realmLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return h('p', { class: 'muted' }, 'Observer mode: no realm of your own.');
  const st = sim.state;
  const n = st.nations[pid];
  const last = n.lastMonth;
  const next = computeLedger(sim, pid);
  const stage = debtStage(sim, pid);
  const runway = monthsOfFunds(sim, pid);
  const cap = adminCapacity(sim, pid);
  const load = frontierLoad(sim, pid);
  const over = overextension(sim, pid);
  const food = stockpileCap(sim, pid);

  const strip = h(
    'div',
    { class: 'strip' },
    h('div', null, h('span', { class: 'k' }, 'Treasury'), h('b', { class: n.treasury < 0 ? 'bad' : '' }, `${fmt(n.treasury)} cr`)),
    h('div', null, h('span', { class: 'k' }, 'Net this month'), h('b', { class: next.net >= 0 ? 'good' : 'bad' }, `${signed(next.net, 1)} cr`)),
    h('div', null, h('span', { class: 'k' }, 'Standing'), h('b', { class: stage ? 'bad' : 'good' }, ['Solvent', 'In debt', 'Severe debt', 'Bankrupt'][stage])),
    h('div', null, h('span', { class: 'k' }, 'Runway'), h('b', null, Number.isFinite(runway) ? `${Math.max(0, Math.floor(runway))} months` : 'In surplus')),
    h('div', null, h('span', { class: 'k' }, 'Settled'), h('b', null, dateOf(sim, last.tick).short)),
  );

  // research funding: what each level costs at this month's income, before choosing
  const gross = grossIncome(next);
  const funding = h(
    'div',
    { class: 'choice-row', role: 'radiogroup', 'aria-label': 'Research funding' },
    ([0, 1, 2, 3] as const).map((lvl) => {
      const cur = n.research.funding === lvl;
      const b = h(
        'button',
        { type: 'button', class: `opt ${cur ? 'active' : ''}`, role: 'radio', 'aria-checked': cur ? 'true' : 'false', 'data-fk': `funding-${lvl}` },
        h('b', null, ['Minimal', 'Standard', 'Generous', 'Lavish'][lvl]),
        h('span', null, `${fmt(gross * C.economy.fundingCost[lvl], 1)} cr/mo`),
        h('small', null, `research ×${C.economy.fundingMul[lvl]}`),
      );
      b.addEventListener('click', () => app.do({ type: 'funding', level: lvl }));
      return b;
    }),
  );

  const reserves = h(
    'div',
    { class: 'reserves' },
    h('h4', null, 'Food'),
    h(
      'table',
      { class: 'register' },
      h(
        'tbody',
        null,
        ...Object.entries(next.suppliesIn).map(([k, v]) => h('tr', null, h('td', null, k), h('td', { class: 'r' }, `+${fmt(v, 1)}`))),
        ...Object.entries(next.suppliesOut).filter(([, v]) => v > 0).map(([k, v]) => h('tr', null, h('td', null, k), h('td', { class: 'r' }, `−${fmt(v, 1)}`))),
        h('tr', { class: 'total' }, h('td', null, 'Net'), h('td', { class: `r ${next.netSupplies >= 0 ? 'good' : 'bad'}` }, signed(next.netSupplies, 1))),
      ),
    ),
    h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Stockpile'), h('span', { class: 'v' }, `${fmt(n.supplies)} / ${fmt(food)}`)),
    bar(n.supplies, food, n.supplies > food * 0.25 ? 'good' : 'bad', 'Food stockpile'),
    h('h4', null, 'Manpower'),
    h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Military reserve'), h('span', { class: 'v' }, `${fmt(reserveCap(sim, pid))} men`)),
    h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Serving and training'), h('span', { class: 'v' }, `${fmt(menServing(sim, pid))} men`)),
    h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Pool available'), h('span', { class: 'v' }, `${fmt(n.manpower)} / ${fmt(poolCap(sim, pid))}`)),
    h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Recovery'), h('span', { class: 'v' }, `${fmt(manpowerRegen(sim, pid))} a month`)),
    h('h4', null, 'Administration'),
    h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Frontier load'), h('span', { class: 'v' }, `${load.toFixed(1)} of ${cap.toFixed(1)}`)),
    bar(load, Math.max(cap, load), load > cap ? 'bad' : 'good', 'Frontier load against administrative capacity'),
    over > 0 ? h('p', { class: 'small bad' }, `Overextended ${Math.round(over * 100)}%: integration slows; unrest and research suffer.`) : h('p', { class: 'small muted' }, 'Newly held provinces add frontier load until integrated.'),
  );

  const provs = ownedProvinces(sim, pid).sort((a, b) => st.provinces[a].integration - st.provinces[b].integration || (a < b ? -1 : 1));
  return h(
    'div',
    { class: 'ledger-realm' },
    strip,
    stage
      ? h('div', { class: 'callout bad' }, ['', 'In debt: interest of 2% a month; new projects, recruitment and purchase contracts need positive funds.', 'Severe debt: morale recovery is halved and unrest rises. Bankruptcy follows when debt exceeds three months of income.', 'Bankrupt: construction halted, regiments deserted, income −25% for two years.'][stage])
      : null,
    h('div', { class: 'split-2' }, statement(app, last, next), reserves),
    h('section', { class: 'section' }, h('div', { class: 'eyebrow' }, 'Research funding'), funding, h('p', { class: 'small muted' }, `Research runs at ${researchRate(sim, pid).toFixed(2)} points a month. Funding costs a share of gross income, paid each month.`)),
    h(
      'details',
      { class: 'more' },
      h('summary', null, 'How debt works'),
      h('p', { class: 'small' }, 'A realm may spend into debt, which is telegraphed in stages: in debt (2% interest a month), severe debt after three months (morale recovery halved, unrest rises), and bankruptcy when the debt exceeds three months of income — debts repudiated, construction halted, a fifth of the regiments desert, morale halved and income cut by a quarter for two years.'),
    ),
    h('section', { class: 'section' }, h('div', { class: 'eyebrow' }, `Provinces (${provs.length}), least integrated first`), provinceTable(app, provs)),
  );
}

function provinceTable(app: App, provs: string[]): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const pid = app.player!;
  return h(
    'table',
    { class: 'data', 'data-sk': 'provinces' },
    h('thead', null, h('tr', null, ...['Province', 'Dev', 'Rail', 'Fort', 'Fact.', 'Deposit', 'Integr.', 'Unrest', 'Crowns', 'Project'].map((t, i) => h('th', { class: i && i !== 5 && i !== 9 ? 'r' : '' }, t)))),
    h(
      'tbody',
      null,
      provs.map((p) => {
        const s = st.provinces[p];
        const tr = h(
          'tr',
          { class: 'clickable', tabindex: '0' },
          h('td', null, provName(sim, p), s.controller !== pid ? h('span', { class: 'tag bad' }, 'occupied') : null, s.revoltUntil > st.tick ? h('span', { class: 'tag bad' }, 'revolt') : null),
          h('td', { class: 'r' }, String(s.dev)),
          h('td', { class: 'r' }, String(s.infra)),
          h('td', { class: 'r' }, String(s.fort)),
          h('td', { class: 'r' }, String(s.factories)),
          h('td', null, sim.world.prov[p].resource ? RESOURCE_INFO[sim.world.prov[p].resource!].label : '—'),
          h('td', { class: `r ${s.integration < 40 ? 'bad' : s.integration < 75 ? 'warn' : ''}` }, String(Math.floor(s.integration))),
          h('td', { class: `r ${s.unrest >= 60 ? 'bad' : ''}` }, String(Math.round(s.unrest))),
          h('td', { class: 'r' }, n1(provinceCrowns(sim, p))),
          h('td', null, s.project ? `${PROJECT_LABELS[s.project.kind]} ${s.project.progress}/${s.project.total}` : '—'),
        );
        const go = () => {
          app.closeLedger();
          app.selectProvince(p, true);
        };
        tr.addEventListener('click', go);
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') go();
        });
        return tr;
      }),
    ),
  );
}
