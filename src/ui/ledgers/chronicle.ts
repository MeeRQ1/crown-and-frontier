// Chronicle: the campaign's register, newest first and grouped by month. Every
// entry is a message the game actually recorded for our realm or for the whole
// world; filters narrow it by kind, entries about a place link to it, and battle
// reports list the factors that decided each fight. Export for bug reports
// stays here as a utility.

import { diagnosticBundle } from '../../sim/diagnostics';
import { zoneName } from '../../sim/naval';
import { dateOf, nationName, provName } from '../../sim/state';
import type { BattleReport, Notification } from '../../sim/types';
import type { App } from '../app';
import { button, h } from '../dom';
import { men } from '../format';
import { icon, type IconName } from '../icons';
import { downloadText } from '../storage';

export type LogFilter = 'all' | 'urgent' | 'war' | 'diplomacy' | 'economy' | 'realm' | 'battles';

type Category = 'war' | 'diplomacy' | 'economy' | 'realm';

const CATEGORY: Record<string, Category> = {
  war: 'war', peace: 'war', occupation: 'war', battle: 'war', surrender: 'war', coalition: 'war', claim: 'war', move: 'war', attrition: 'war', navy: 'war', air: 'war', recruit: 'war', eliminated: 'war', capital: 'war', result: 'war',
  proposal: 'diplomacy', treaty: 'diplomacy', bloc: 'diplomacy', loan: 'diplomacy', sphere: 'diplomacy', guarantee: 'diplomacy', envoy: 'diplomacy',
  contract: 'economy', build: 'economy', debt: 'economy', shortage: 'economy', supplies: 'economy', bankrupt: 'economy',
  revolt: 'realm', unrest: 'realm', event: 'realm', research: 'realm', focus: 'realm',
};

const CAT_ICON: Record<Category, IconName> = { war: 'wars', diplomacy: 'diplomacy', economy: 'treasury', realm: 'crown' };
const CAT_LABEL: Record<Category, string> = { war: 'War', diplomacy: 'Diplomacy', economy: 'Economy', realm: 'Realm' };

const EMPTY: Record<LogFilter, string> = {
  all: 'Nothing recorded yet. Messages about our realm and world news appear here as the weeks pass.',
  urgent: 'No urgent messages: wars, defaults, bankruptcy and other matters that need us at once are listed here.',
  war: 'No war news yet: declarations, occupations, battles and peace treaties are listed here.',
  diplomacy: 'No diplomatic news yet: proposals, treaties, blocs, loans and guarantees are listed here.',
  economy: 'No economic news yet: contracts, construction, shortages and debt are listed here.',
  realm: 'No news of the realm yet: events, unrest, research and focus completions are listed here.',
  battles: 'No battle reports yet: each battle our realm fights is reported here with the factors that decided it.',
};

const catOf = (n: Notification): Category => CATEGORY[n.kind] ?? 'realm';

export function chronicleLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const f = app.ui.logFilter;
  const all = sim.state.notifications.filter((n) => n.nation === me || n.nation === null);
  const count = (k: LogFilter) => (k === 'all' ? all.length : k === 'urgent' ? all.filter((n) => n.priority === 'urgent').length : k === 'battles' ? reportsFor(app).length : all.filter((n) => catOf(n) === k).length);
  const filters: Array<[LogFilter, string]> = [['all', 'All'], ['urgent', 'Urgent'], ['war', 'War'], ['diplomacy', 'Diplomacy'], ['economy', 'Economy'], ['realm', 'Realm'], ['battles', 'Battle reports']];
  const bar = h(
    'div',
    { class: 'filter-bar', role: 'toolbar', 'aria-label': 'Show' },
    filters.map(([k, label]) =>
      h(
        'button',
        {
          type: 'button',
          class: `btn small ${f === k ? 'active' : ''}`,
          'aria-pressed': f === k ? 'true' : 'false',
          'data-fk': `log:${k}`,
          onclick: () => {
            app.ui.logFilter = k;
            app.refresh();
          },
        },
        label,
        h('span', { class: 'count' }, String(count(k))),
      ),
    ),
  );
  const body = f === 'battles' ? battles(app) : entries(app, all, f);
  const exportBug = () => {
    const st = sim.state;
    const build = `${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'} (${import.meta.env?.MODE ?? 'unknown'})`;
    const report = diagnosticBundle(sim, { build, userAgent: navigator.userAgent });
    downloadText(`crown-and-frontier-bug-${st.settings.seed}-${st.tick}.json`, JSON.stringify(report, null, 1));
  };
  return h(
    'div',
    { class: 'chronicle' },
    bar,
    body,
    h(
      'div',
      { class: 'utility-row' },
      h('p', { class: 'small muted' }, 'The chronicle keeps the latest 400 messages (older ones roll off) and shows the last 30 battle reports.'),
      button('Export bug report', exportBug, { cls: 'small quiet', icon: 'download', title: 'Seed, settings, your command log and AI diagnostics for reproducing a problem' }),
    ),
  );
}

function entries(app: App, all: Notification[], f: LogFilter): HTMLElement {
  const sim = app.sim!;
  let list = all;
  if (f === 'urgent') list = list.filter((n) => n.priority === 'urgent');
  else if (f !== 'all') list = list.filter((n) => catOf(n) === f);
  list = list.slice(-200).reverse();
  if (!list.length) return h('div', { class: 'empty-state' }, icon('chronicle'), h('p', null, EMPTY[f]));
  // group by month
  const groups: Array<{ label: string; items: Notification[] }> = [];
  for (const n of list) {
    const label = dateOf(sim, n.tick).short;
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return h(
    'ol',
    { class: 'chron-list' },
    groups.map((g) =>
      h(
        'li',
        { class: 'chron-month' },
        h('h4', null, g.label),
        h(
          'ul',
          null,
          g.items.map((n) => {
            const c = catOf(n);
            const go = n.province
              ? h('button', {
                  type: 'button',
                  class: 'btn quiet small',
                  'aria-label': `Show ${provName(sim, n.province)} on the map`,
                  onclick: () => {
                    app.closeLedger();
                    app.selectProvince(n.province!, true);
                  },
                }, icon('target'), provName(sim, n.province))
              : null;
            return h(
              'li',
              { class: `chron-item ${n.priority}` },
              h('span', { class: 'chron-cat', title: CAT_LABEL[c] }, icon(CAT_ICON[c])),
              h('span', { class: 'chron-text' }, n.nation === null ? h('span', { class: 'tag' }, 'World') : null, ' ', n.text),
              go,
            );
          }),
        ),
      ),
    ),
  );
}

function reportsFor(app: App): BattleReport[] {
  const me = app.player;
  return app.sim!.state.reports.filter((r) => !me || r.attackerNations.includes(me) || r.defenderNations.includes(me));
}

function battles(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const reports = reportsFor(app).slice(-30).reverse();
  if (!reports.length) return h('div', { class: 'empty-state' }, icon('battle'), h('p', null, EMPTY.battles));
  return h(
    'div',
    { class: 'battle-list' },
    reports.map((r) => {
      const weAttacked = !!me && r.attackerNations.includes(me);
      const won = me ? (r.winner === 'attacker') === weAttacked : null;
      const place = r.sea ? zoneName(sim, r.province) : provName(sim, r.province);
      return h(
        'details',
        { class: `battle-item ${won === null ? '' : won ? 'won' : 'lost'}` },
        h(
          'summary',
          null,
          h('span', { class: 'bi-date' }, dateOf(sim, r.tick).short),
          h('span', { class: 'bi-place' }, `${r.sea ? 'Sea battle' : 'Battle'} of ${place}`),
          won === null ? null : h('span', { class: `tag ${won ? 'good' : 'bad'}` }, won ? 'Won' : 'Lost'),
        ),
        h(
          'table',
          { class: 'register compact' },
          h('thead', null, h('tr', null, h('th', null, 'Side'), h('th', { class: 'r' }, r.sea ? 'Ships' : 'Men'), h('th', { class: 'r' }, 'Lost'))),
          h(
            'tbody',
            null,
            h('tr', null, h('td', null, `Attackers: ${r.attackerNations.map((n) => nationName(sim, n)).join(', ')}`), h('td', { class: 'r' }, r.sea ? String(r.attStartMen) : men(r.attStartMen)), h('td', { class: 'r' }, r.sea ? String(r.attLosses) : men(r.attLosses))),
            h('tr', null, h('td', null, `Defenders: ${r.defenderNations.map((n) => nationName(sim, n)).join(', ')}`), h('td', { class: 'r' }, r.sea ? String(r.defStartMen) : men(r.defStartMen)), h('td', { class: 'r' }, r.sea ? String(r.defLosses) : men(r.defLosses))),
          ),
        ),
        h('p', { class: 'small' }, r.outcome),
        r.factors.length ? h('div', null, h('h5', null, 'What decided it'), h('ul', { class: 'notes' }, r.factors.map((x) => h('li', null, x)))) : null,
      );
    }),
  );
}
