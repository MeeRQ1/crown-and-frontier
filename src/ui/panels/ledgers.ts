// Modal ledgers opened from the navigation bar.

import { C, RESOURCE_INFO, STRATEGIC, UNITS, UNIT_TYPES } from '../../sim/config';
import { activeProjects, buildSlots, PROJECT_LABELS } from '../../sim/construction';
import { PERSONALITIES } from '../../sim/data/personalities';
import { POLICIES, POLICY_COOLDOWN_MONTHS, POLICY_LIST } from '../../sim/data/policies';
import { BRANCHES, ERAS, TECH_LIST, TECHS, type Branch, type Era } from '../../sim/data/techs';
import {
  claimsOn,
  coalitionAgainst,
  envoyProblem,
  envoySlots,
  evaluateTreaty,
  joinCoalitionProblem,
  opinion,
  opinionParts,
  TREATY_LABELS,
  treatyProblem,
} from '../../sim/diplomacy';
import { debtStage, effectiveFactories, factoryCount, grossIncome, manpowerRegen, materielCap, menServing, poolCap, provinceCrowns, provinceDeposit, reserveCap, resourceCap, resourcePlan, shortageEffect, stockpileCap, tradeFlows } from '../../sim/economy';
import { checkCommand } from '../../sim/commands';
import { adminCapacity, frontierLoad, overextension } from '../../sim/integration';
import { maxMorale, nationStrength, unitUnlocked } from '../../sim/military';
import { describeEffects } from '../../sim/modifiers';
import { earliestYear, policyProblem, policySwitchCost, researchProblem, researchRate, techCost, yearsEarly } from '../../sim/progression';
import { diagnosticBundle } from '../../sim/diagnostics';
import {
  aliveNations,
  alliesOf,
  armiesOf,
  atWar,
  dateOf,
  endTick,
  hasTreaty,
  menOf,
  months,
  nationName,
  ownedProvinces,
  provName,
  sideOf,
  treatyPartners,
  truceUntil,
  warsOf,
} from '../../sim/state';
import { armySupplyInfo } from '../../sim/supply';
import type { Army, NationId, PeaceTerms, StrategicResource, TreatyType, War } from '../../sim/types';
import { allScores, victoryRules, dominatedRegions, influence, influenceByPartner, influenceNeeded, SCORE_FORMULA, VICTORY_LABELS, VICTORY_MONTHS, victoryProgress } from '../../sim/victory';
import { computeWarScore, evaluatePeace, goalOptions, provinceCost, scoreFor, termsCost, declareWarProblem } from '../../sim/war';
import type { App } from '../app';
import { action, bar, button, h, rebuild, row, setChildren } from '../dom';
import { fmt, men, plural, signed } from '../format';
import { downloadText } from '../storage';
import { confirmDialog } from './dialogs';
import { section, shield } from './common';
import { icon } from '../icons';

export type LedgerTab = 'realm' | 'industry' | 'military' | 'research' | 'policy' | 'diplomacy' | 'wars' | 'victory' | 'log' | 'help';

const TITLES: Record<LedgerTab, string> = {
  realm: 'Realm & Budget',
  industry: 'Industry & Trade',
  military: 'Military',
  research: 'Research',
  policy: 'National Policy',
  diplomacy: 'Diplomacy',
  wars: 'Wars & Peace',
  victory: 'Victory',
  log: 'Chronicle',
  help: 'How to Play',
};

export function renderLedger(app: App): void {
  const tab = app.ui.ledgerTab;
  if (!tab || !app.sim) return;
  rebuild(app.drawerEl, () => {
    const tabs = h(
      'div',
      { class: 'tabs', role: 'tablist' },
      (Object.keys(TITLES) as LedgerTab[]).map((t) => {
        const b = h('button', { class: `tab ${t === tab ? 'active' : ''}`, type: 'button', role: 'tab', 'aria-selected': t === tab ? 'true' : 'false', 'data-fk': `tab-${t}` }, TITLES[t]);
        b.addEventListener('click', () => app.openLedger(t));
        return b;
      }),
    );
    const close = h('button', { class: 'btn quiet icon', type: 'button', 'aria-label': 'Close ledger (Esc)', 'data-fk': 'drawer-close' }, icon('close'));
    close.addEventListener('click', () => app.closeLedger());
    const content = BODIES[tab](app);
    setChildren(app.drawerEl, h('header', null, h('h2', null, TITLES[tab]), close), tabs, h('div', { class: 'body scroll', 'data-sk': `ledger-${tab}`, role: 'tabpanel' }, content));
  });
}

const BODIES: Record<LedgerTab, (app: App) => HTMLElement> = {
  realm: realmLedger,
  industry: industryLedger,
  military: militaryLedger,
  research: researchLedger,
  policy: policyLedger,
  diplomacy: diplomacyLedger,
  wars: warsLedger,
  victory: victoryLedger,
  log: logLedger,
  help: helpLedger,
};

function noRealm(): HTMLElement {
  return h('p', { class: 'muted' }, 'Observer mode: no realm of your own.');
}

// ───────────────────────────── Realm ────────────────────────────────────────

function realmLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return noRealm();
  const n = sim.state.nations[pid];
  const l = n.lastMonth;
  const list = (obj: Record<string, number>) => Object.entries(obj).map(([k, v]) => row(k, fmt(v, 1)));
  const stage = debtStage(sim, pid);
  const funding = h(
    'div',
    { class: 'row' },
    ([0, 1, 2, 3] as const).map((lvl) =>
      button(`${['Minimal', 'Standard', 'Generous', 'Lavish'][lvl]} (${Math.round(C.economy.fundingCost[lvl] * 100)}% → ×${C.economy.fundingMul[lvl]})`, () => app.do({ type: 'funding', level: lvl }), {
        cls: `small ${n.research.funding === lvl ? 'active' : ''}`,
      }),
    ),
  );
  const cap = adminCapacity(sim, pid);
  const load = frontierLoad(sim, pid);
  const provs = ownedProvinces(sim, pid).sort((a, b) => sim.state.provinces[a].integration - sim.state.provinces[b].integration || (a < b ? -1 : 1));
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'cols' },
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'Crowns (last month)'),
        h('h4', null, 'Income'),
        ...list(l.income),
        h('h4', { style: 'margin-top:8px' }, 'Expenses'),
        ...list(l.expenses),
        row(h('b', null, 'Net'), h('b', { class: l.net >= 0 ? 'good' : 'bad' }, signed(l.net))),
        row('Treasury', fmt(n.treasury)),
        stage
          ? h('p', { class: 'bad small' }, ['', 'In debt: 2% interest a month. Projects and recruitment need positive funds.', 'Severe debt: morale recovery halved, +3 unrest. Bankruptcy when debt exceeds 3 months of income.', 'Bankruptcy!'][stage])
          : h('p', { class: 'small muted' }, 'Debt is allowed but telegraphed: in debt → severe debt (after 3 months) → bankruptcy (debt beyond 3 months of income) which halts construction, halves morale and costs 25% income for two years.'),
      ),
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'Food'),
        ...list(l.suppliesIn),
        ...list(l.suppliesOut),
        row(h('b', null, 'Net'), h('b', { class: l.netSupplies >= 0 ? 'good' : 'bad' }, signed(l.netSupplies))),
        row('Stockpile', `${fmt(n.supplies)} / ${fmt(stockpileCap(sim, pid))}`),
        bar(n.supplies, stockpileCap(sim, pid), n.supplies > 0 ? 'good' : 'bad', 'Stockpile'),
        h('p', { class: 'small muted' }, 'Armies within supply range eat from the stockpile; cut-off armies forage (at most “strained”). Food deposits add 3 a month; trade partners sell surplus food.'),
        h('h3', { style: 'margin-top:10px' }, 'Manpower'),
        row('Military reserve', `${fmt(reserveCap(sim, pid))} men`),
        row('Serving (incl. training)', `${fmt(menServing(sim, pid))} men`),
        row('Pool available', `${fmt(n.manpower)} / ${fmt(poolCap(sim, pid))}`),
        row('Recovery', `${fmt(manpowerRegen(sim, pid))} / month`),
        h('p', { class: 'small muted' }, 'The pool can never exceed the reserve minus men already serving. Casualties are permanent and reduce population.'),
      ),
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'Administration'),
        row('Frontier load', `${load.toFixed(1)} (sum of missing integration)`),
        row('Administrative capacity', cap.toFixed(1)),
        bar(load, Math.max(cap, load), load > cap ? 'bad' : 'good', 'Frontier load'),
        overextension(sim, pid) > 0
          ? h('p', { class: 'bad small' }, `Overextended ${Math.round(overextension(sim, pid) * 100)}%: integration slows, unrest and research penalties apply.`)
          : h('p', { class: 'small muted' }, 'Conquered and settled provinces add frontier load until integrated. Charters, railways, garrisons and the Frontier Settlement policy speed integration.'),
        h('h3', { style: 'margin-top:10px' }, 'Research funding'),
        funding,
        h('p', { class: 'small muted' }, `Research: ${researchRate(sim, pid).toFixed(2)} points/month. Funding costs a share of gross income (${fmt(grossIncome(l), 1)}).`),
      ),
    ),
    h('h3', { style: 'margin-top:14px' }, 'Provinces'),
    h(
      'table',
      { class: 'data' },
      h('thead', null, h('tr', null, ['Province', 'Dev', 'Rail', 'Fort', 'Factories', 'Deposit', 'Integration', 'Unrest', 'Crowns/mo', 'Project'].map((t) => h('th', null, t)))),
      h(
        'tbody',
        null,
        provs.map((p) => {
          const s = sim.state.provinces[p];
          const tr = h(
            'tr',
            { class: 'clickable' },
            h('td', null, provName(sim, p), s.controller !== pid ? h('span', { class: 'tag bad' }, 'occupied') : null, s.revoltUntil > sim.state.tick ? h('span', { class: 'tag bad' }, 'revolt') : null),
            h('td', null, String(s.dev)),
            h('td', null, String(s.infra)),
            h('td', null, String(s.fort)),
            h('td', null, String(s.factories)),
            h('td', null, sim.world.prov[p].resource ? RESOURCE_INFO[sim.world.prov[p].resource!].label : '—'),
            h('td', { class: s.integration < 40 ? 'bad' : s.integration < 75 ? 'warn' : '' }, String(Math.floor(s.integration))),
            h('td', { class: s.unrest >= 60 ? 'bad' : '' }, String(Math.round(s.unrest))),
            h('td', null, fmt(provinceCrowns(sim, p), 1)),
            h('td', null, s.project ? `${PROJECT_LABELS[s.project.kind]} ${s.project.progress}/${s.project.total}` : '—'),
          );
          tr.addEventListener('click', () => {
            app.closeLedger();
            app.selectProvince(p, true);
          });
          return tr;
        }),
      ),
    ),
  );
}

// ───────────────────────────── Industry & trade ─────────────────────────────

function industryLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return noRealm();
  const n = sim.state.nations[pid];
  const l = n.lastMonth;
  const plan = resourcePlan(sim, pid);
  const rcap = resourceCap(sim, pid);
  const fac = factoryCount(sim, pid);
  const mcap = materielCap(sim, pid);
  const trade = tradeFlows(sim).filter((t) => t.from === pid || t.to === pid);
  const resRows = STRATEGIC.map((r) => {
    const f = l.resources[r];
    const short = n.shortages.includes(r);
    const net = f.produced + f.imported - f.exported - f.used;
    return h(
      'tr',
      null,
      h('td', null, h('span', { title: RESOURCE_INFO[r].use }, RESOURCE_INFO[r].label), short ? h('span', { class: 'tag bad', title: shortageEffect(r) }, 'short') : null),
      h('td', null, `${fmt(n.stock[r])} / ${fmt(rcap)}`),
      h('td', null, fmt(f.produced, 1)),
      h('td', null, fmt(plan.need[r], 1)),
      h('td', null, f.imported ? `+${fmt(f.imported, 1)}` : '—'),
      h('td', null, f.exported ? `−${fmt(f.exported, 1)}` : '—'),
      h('td', { class: net >= 0 ? 'good' : 'bad' }, signed(net, 1)),
    );
  });
  const deposits = ownedProvinces(sim, pid)
    .map((p) => ({ p, d: provinceDeposit(sim, p) }))
    .filter((x): x is { p: string; d: NonNullable<ReturnType<typeof provinceDeposit>> } => !!x.d)
    .sort((a, b) => b.d.amount - a.d.amount || (a.p < b.p ? -1 : 1));
  const factoryProvs = ownedProvinces(sim, pid)
    .filter((p) => sim.state.provinces[p].factories > 0)
    .sort((a, b) => sim.state.provinces[b].factories - sim.state.provinces[a].factories || (a < b ? -1 : 1));
  const goto = (p: string) => () => {
    app.closeLedger();
    app.selectProvince(p, true);
  };
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'cols' },
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'Industry'),
        row('Factories', `${fac} (${fmt(effectiveFactories(sim, pid), 1)} effective)`),
        row('Industrial capacity', fmt(l.industry, 1)),
        row('Coal for factories', `${fmt(plan.factoryCoal, 1)} / month`),
        row('Materiel', `${fmt(n.materiel)} / ${fmt(mcap)}`),
        bar(n.materiel, mcap, 'info', 'Materiel'),
        row('Added last month', `+${fmt(l.materielIn, 1)}${l.income['Manufactured goods'] ? ' (stockpile full)' : ''}`),
        l.income['Manufactured goods'] ? row('Surplus sold as goods', `${fmt(l.income['Manufactured goods'], 1)} crowns`) : null,
        h('p', { class: 'small muted' }, `Each factory makes ${C.industry.materielPerIC} materiel a month at full coal and integration; workshops add a little everywhere. Materiel equips new regiments and replaces losses; a full stockpile's output is sold as goods. Build factories from a province card (${activeProjects(sim, pid).length} of ${buildSlots(sim, pid)} builders busy).`),
      ),
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'Trade'),
        trade.length
          ? h(
              'table',
              { class: 'data' },
              h('thead', null, h('tr', null, ['Partner', 'Goods', 'Amount', 'Crowns'].map((t) => h('th', null, t)))),
              h(
                'tbody',
                null,
                trade.map((t) => {
                  const sell = t.from === pid;
                  const other = sell ? t.to : t.from;
                  return h('tr', null, h('td', null, nationName(sim, other)), h('td', null, `${sell ? 'Sell' : 'Buy'} ${RESOURCE_INFO[t.res].label.toLowerCase()}`), h('td', null, fmt(t.amount, 1)), h('td', { class: sell ? 'good' : 'bad' }, signed(sell ? t.amount * t.price : -t.amount * t.price, 1)));
                }),
              ),
            )
          : h('p', { class: 'muted small' }, 'No goods change hands this month.'),
        row('Trade agreements', String(treatyPartners(sim, 'trade', pid).length)),
        h('p', { class: 'small muted' }, `A trade agreement moves resources each month from one partner's surplus (above ${Math.round(C.resources.keepShare * 100)}% of its stockpile cap after its own use) to the other's need, at fixed prices: ${(['food', ...STRATEGIC] as const).map((r) => `${RESOURCE_INFO[r].label.toLowerCase()} ${RESOURCE_INFO[r].price}`).join(', ')} crowns. Each agreement also brings ${C.economy.tradeCommerce} crown of commerce. A realm in debt does not buy.`),
      ),
    ),
    h('h3', { style: 'margin-top:14px' }, 'Strategic resources'),
    h(
      'table',
      { class: 'data' },
      h('thead', null, h('tr', null, ['Resource', 'Stock', 'Mined', 'Needed', 'Bought', 'Sold', 'Net'].map((t) => h('th', null, t)))),
      h('tbody', null, resRows),
    ),
    n.shortages.length ? h('ul', { class: 'reasons' }, n.shortages.map((r) => h('li', { class: 'bad' }, `${RESOURCE_INFO[r].label}: ${shortageEffect(r)}`))) : null,
    h('p', { class: 'small muted' }, 'Coal fuels factories; iron builds artillery, armour, factories, forts and railways; oil fuels armour; rubber builds armour; nitrates make shells for artillery in war. Shortages are announced and never stop the game: they weaken what needs the resource until trade, conquest or research (chemistry, synthetic fuel and rubber) fills the gap.'),
    h(
      'div',
      { class: 'cols', style: 'margin-top:10px' },
      h(
        'div',
        { class: 'card' },
        h('h4', null, 'Deposits'),
        deposits.length
          ? deposits.map(({ p, d }) => {
              const b = h('button', { class: 'btn quiet small', type: 'button', style: 'width:100%;justify-content:space-between' }, h('span', null, provName(sim, p)), h('span', { class: 'faint' }, `${RESOURCE_INFO[d.res].label} ${fmt(d.amount, 1)}/mo`));
              b.addEventListener('click', goto(p));
              return b;
            })
          : h('p', { class: 'muted small' }, 'No mines or wells of our own.'),
      ),
      h(
        'div',
        { class: 'card' },
        h('h4', null, 'Factory towns'),
        factoryProvs.length
          ? factoryProvs.map((p) => {
              const b = h('button', { class: 'btn quiet small', type: 'button', style: 'width:100%;justify-content:space-between' }, h('span', null, provName(sim, p)), h('span', { class: 'faint' }, `${sim.state.provinces[p].factories} factor${sim.state.provinces[p].factories === 1 ? 'y' : 'ies'}`));
              b.addEventListener('click', goto(p));
              return b;
            })
          : h('p', { class: 'muted small' }, 'No factories yet.'),
      ),
    ),
  );
}

// ───────────────────────────── Military ─────────────────────────────────────

function armyRow(app: App, a: Army): HTMLElement {
  const sim = app.sim!;
  const mm = maxMorale(sim, a.nation);
  const c = (t: string) => a.regiments.filter((r) => r.type === t).length;
  const sup = armySupplyInfo(sim, a, true);
  const status = a.battle ? 'In battle' : a.retreating ? 'Retreating' : a.path.length ? `To ${provName(sim, a.path[a.path.length - 1])}` : a.order ? `Stationed at ${provName(sim, a.order.province)}` : 'Holding';
  const el = h(
    'button',
    { class: `army-row ${app.selectedArmy === a.id ? 'selected' : ''}`, type: 'button', 'data-fk': `army-${a.id}` },
    h('span', { class: 'ar-n' }, a.group ? h('span', { class: 'grp' }, String(a.group)) : null, a.name),
    h('span', { class: 'ar-loc' }, provName(sim, a.location)),
    h('span', { class: 'ar-mix', title: UNIT_TYPES.map((t) => `${UNITS[t].abbr} ${UNITS[t].plural}`).join(' · ') }, UNIT_TYPES.filter((t) => c(t)).map((t) => `${c(t)}${UNITS[t].abbr}`).join(' ') || '—'),
    h('span', { class: 'ar-men' }, men(menOf(a))),
    h('span', { class: 'ar-mor' }, bar(a.morale, mm, a.morale / mm > 0.5 ? 'good' : a.morale / mm > 0.25 ? 'warn' : 'bad', 'Morale')),
    h('span', { class: `ar-sup dot ${sup.status}`, title: `Supply: ${sup.status}` }),
    h('span', { class: `ar-st ${a.battle ? 'bad' : a.retreating ? 'warn' : ''}` }, status),
  );
  el.addEventListener('click', () => app.selectArmy(a.id, true));
  return el;
}

function militaryLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const pid = app.player;
  if (!pid) return noRealm();
  const armies = armiesOf(sim, pid).sort((a, b) => (a.id < b.id ? -1 : 1));
  const regs = armies.reduce((n, a) => n + a.regiments.length, 0);
  const upkeep = st.nations[pid].lastMonth.expenses['Army upkeep'] ?? 0;
  const troubled = armies.filter((a) => armySupplyInfo(sim, a, true).status !== 'supplied').length;
  const training = sim.world.provIds.flatMap((p) => st.provinces[p].recruits.filter((r) => r.nation === pid).map((r) => ({ p, r })));
  const tile = (label: string, value: string, sub?: string) => h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, label), h('div', { class: 'big' }, value), sub ? h('div', { class: 'sub' }, sub) : null);
  const kids: Array<Node | null> = [
    h(
      'div',
      { class: 'stat-grid' },
      tile('Armies', String(armies.length), `${regs} regiments`),
      tile('Men serving', men(menServing(sim, pid)), `reserve ${men(reserveCap(sim, pid))}`),
      tile('Upkeep', `${fmt(upkeep)}/mo`, 'crowns, last month'),
      tile('Supply', troubled ? `${troubled} short` : 'All supplied', troubled ? 'armies strained or cut off' : undefined),
    ),
  ];

  // fronts: every war enemy, with what stands near the shared border
  const wars = warsOf(sim, pid);
  if (wars.length) {
    const enemies = new Set<NationId>();
    for (const w of wars) for (const n of sideOf(w, pid) === 'attacker' ? w.defenders : w.attackers) enemies.add(n);
    const mine = new Set(ownedProvinces(sim, pid));
    const near = (pids: Set<string>, hops: number) => {
      const out = new Set(pids);
      let frontier = [...pids];
      for (let i = 0; i < hops; i++) {
        const next: string[] = [];
        for (const p of frontier) for (const n of sim.world.prov[p].neighbors) if (!out.has(n)) (out.add(n), next.push(n));
        frontier = next;
      }
      return out;
    };
    const ourZone = near(mine, 2);
    kids.push(
      section(
        'Fronts',
        ...[...enemies].map((e) => {
          const theirs = new Set(ownedProvinces(sim, e));
          const theirZone = near(theirs, 1);
          const foes = Object.values(st.armies).filter((x) => x.nation === e && ourZone.has(x.location));
          const ours = armies.filter((x) => theirZone.has(x.location));
          const fr = foes.reduce((n, x) => n + x.regiments.length, 0);
          const or = ours.reduce((n, x) => n + x.regiments.length, 0);
          const occ = [...mine].filter((p) => st.provinces[p].controller === e).length;
          const show = button('Show', () => {
            app.setMode('military');
            const target = foes[0]?.location ?? ours[0]?.location ?? [...theirs][0];
            if (target) app.centerOn(target, 70);
          }, { cls: 'small quiet', icon: 'target', fk: `front-${e}` });
          return h(
            'div',
            { class: 'front-row' },
            shield(app, e),
            h('div', { class: 'grow' }, h('b', null, nationName(sim, e)), h('div', { class: 'small muted' }, `Their ${fr} regiment${fr === 1 ? '' : 's'} near our land · our ${or} at their border${occ ? ` · ${occ} of our provinces occupied` : ''}`)),
            h('span', { class: `tag ${fr > or * 1.3 ? 'bad' : or > fr * 1.3 ? 'good' : 'warn'}` }, fr > or * 1.3 ? 'Outnumbered' : or > fr * 1.3 ? 'Stronger' : 'Even'),
            show,
          );
        }),
      ),
    );
  }

  // army groups
  const groups = [...new Set(armies.filter((a) => a.group).map((a) => a.group!))].sort((a, b) => a - b);
  if (groups.length) {
    kids.push(
      section(
        'Army groups',
        ...groups.map((g) => {
          const list = armies.filter((a) => a.group === g);
          const sel = button('Select group', () => {
            app.selectArmy(list[0].id, true);
            app.ui.groupOrders = true;
            app.refresh();
          }, { cls: 'small', fk: `group-sel-${g}` });
          return h(
            'div',
            { class: 'group-card' },
            h('div', { class: 'gc-head' }, h('span', { class: 'grp big' }, String(g)), h('b', { class: 'grow' }, `Group ${g}`), h('span', { class: 'small muted' }, `${plural(list.length, 'army', 'armies')} · ${plural(list.reduce((n, a) => n + a.regiments.length, 0), 'regiment')}`), sel),
            ...list.map((a) => armyRow(app, a)),
          );
        }),
        h('p', { class: 'small faint' }, 'Select a group (or press Shift+N) and every move order goes to all of its armies.'),
      ),
    );
  }

  // armies by region: where our strength stands, and what faces it there
  const byRegion = new Map<string, Army[]>();
  for (const a of armies) {
    const r = sim.world.prov[a.location].region;
    (byRegion.get(r) ?? byRegion.set(r, []).get(r)!).push(a);
  }
  const regionName = (id: string) => sim.world.scenario.regions.find((r) => r.id === id)?.name ?? id;
  kids.push(
    section(
      'Armies by region',
      armies.length
        ? h(
            'div',
            { class: 'army-table' },
            h('div', { class: 'army-head' }, h('span', null, 'Army'), h('span', null, 'Where'), h('span', null, 'F·H·G'), h('span', null, 'Men'), h('span', null, 'Morale'), h('span', null, ''), h('span', null, 'Doing')),
            ...[...byRegion.entries()]
              .sort((x, y) => y[1].length - x[1].length || regionName(x[0]).localeCompare(regionName(y[0])))
              .flatMap(([r, list]) => {
                const provs = sim.world.regionProvinces[r] ?? [];
                const ours = provs.filter((p) => st.provinces[p].owner === pid).length;
                const hostile = Object.values(st.armies).filter((x) => provs.includes(x.location) && atWar(sim, pid, x.nation));
                const hr = hostile.reduce((n, x) => n + x.regiments.length, 0);
                return [
                  h('div', { class: 'region-head' }, h('b', null, regionName(r)), h('span', { class: 'small muted' }, `${ours}/${provs.length} provinces ours`), hr ? h('span', { class: 'tag bad' }, `${hr} enemy regiments`) : null),
                  ...list.map((a) => armyRow(app, a)),
                ];
              }),
          )
        : h('div', { class: 'callout info' }, icon('info'), 'No armies. Raise regiments from a province panel (select one of your provinces).'),
    ),
  );
  kids.push(
    section(
      'In training',
      training.length
        ? h('div', null, training.map(({ p, r }) => row(`${UNITS[r.unit].label} at ${provName(sim, p)}`, `${r.weeksLeft} wk`)))
        : h('p', { class: 'small muted' }, 'No regiments in training.'),
    ),
  );
  kids.push(
    h(
      'details',
      { class: 'section' },
      h('summary', { class: 'eyebrow' }, 'Regiment types'),
      h(
        'div',
        { class: 'cols' },
        UNIT_TYPES.map((t) => {
          const u = UNITS[t];
          const res = Object.entries(u.resources).map(([r, v]) => `${v} ${RESOURCE_INFO[r as StrategicResource].label.toLowerCase()}`);
          const burn = Object.entries(u.burn).map(([r, v]) => `${v} ${RESOURCE_INFO[r as StrategicResource].label.toLowerCase()}${r === 'nitrates' ? ' in war' : ''}`);
          const locked = !unitUnlocked(sim, pid, t);
          return h(
            'div',
            { class: `card ${locked ? 'locked' : ''}` },
            h('h4', null, u.label, locked && u.requires ? h('span', { class: 'tag' }, `needs ${TECHS[u.requires].name}`) : null),
            h('p', { class: 'small' }, u.description),
            row('Cost', `${u.cost} crowns, ${u.materiel} materiel${res.length ? `, ${res.join(', ')}` : ''}`),
            row('Upkeep / month', `${u.upkeep} crowns, ${u.supplyUse} food${burn.length ? `, ${burn.join(', ')}` : ''}`),
            row('Firepower', `${u.attack}× (shock ${u.morale}×)`),
            row('Role · speed', `${u.role} · ${u.speed}`),
          );
        }),
      ),
      h('p', { class: 'small muted' }, 'Terrain limits how many regiments fight at once (frontage). Cavalry gains +20–30% on plains and steppe, loses up to 50% in mountains and suffers from enemy machine guns; at least 20% cavalry on open ground flanks for +15%. Artillery and engineers fire at half effect without an infantry screen. Armour breaks through forts and trenches but bogs down in forest, marsh and mountains. Attacking across a river gives the defender +20% (half with engineers).'),
    ),
  );
  return h('div', null, ...kids);
}

// ───────────────────────────── Research ─────────────────────────────────────

function researchLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return noRealm();
  const n = sim.state.nations[pid];
  const rate = researchRate(sim, pid);
  const cur = n.research.current ? TECHS[n.research.current] : null;
  const year = dateOf(sim).year;
  const branches = (Object.keys(BRANCHES) as Branch[]).filter((b) => TECH_LIST.some((t) => t.branch === b));
  const card = (id: string) => {
    const t = TECHS[id];
    const done = n.research.done.includes(t.id);
    const current = n.research.current === t.id;
    const prob = researchProblem(sim, pid, t.id);
    const locked = !done && t.requires.some((r) => !n.research.done.includes(r));
    const early = yearsEarly(sim, t.id);
    const cost = techCost(sim, t.id);
    const when = done ? null : early > 10 ? h('span', { class: 'tag bad' }, `from ${earliestYear(t.id)}`) : early > 0 ? h('span', { class: 'tag warn', title: `Researching before ${t.year} costs ${Math.round(early * 15)}% more.` }, `${early} yr early +${Math.round(early * 15)}%`) : null;
    return h(
      'div',
      { class: `card ${done ? 'done' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''}`, style: 'margin:6px 0' },
      h('h4', null, t.name, ' ', h('span', { class: 'tag' }, `${t.year} · ${cost} pts`), ' ', when),
      t.unlocks ? h('p', { class: 'small good' }, `Unlocks ${UNITS[t.unlocks].plural.toLowerCase()}.`) : null,
      h('p', { class: 'small' }, describeEffects(t.effects).join(' · ')),
      h('p', { class: 'small muted' }, t.description),
      t.requires.length ? h('p', { class: 'small muted' }, `Requires ${t.requires.map((r) => TECHS[r].name).join(', ')}`) : null,
      done
        ? h('span', { class: 'tag good' }, 'Researched')
        : current
          ? h('div', null, bar(n.research.progress, cost, 'info'), h('span', { class: 'small' }, `${Math.floor(n.research.progress)}/${cost} · ~${Math.max(0, Math.ceil((cost - n.research.progress) / Math.max(0.1, rate)))} months`))
          : action('Research this', `~${Math.ceil(cost / Math.max(0.1, rate))} months at the current rate`, () => app.do({ type: 'research', tech: t.id }), prob),
    );
  };
  const eraBlock = (era: Era) => {
    const techs = TECH_LIST.filter((t) => t.era === era);
    const doneCount = techs.filter((t) => n.research.done.includes(t.id)).length;
    const nextEra = (ERAS as Record<number, { year: number }>)[era + 1];
    const open = doneCount < techs.length && year >= ERAS[era].year - 12 && (!nextEra || year < nextEra.year + 10);
    return h(
      'details',
      { class: 'section', open: open ? true : null },
      h('summary', { class: 'eyebrow' }, `Era ${['I', 'II', 'III', 'IV', 'V'][era - 1]} · ${ERAS[era].name} (from ${ERAS[era].year}) — ${doneCount}/${techs.length} researched`),
      h(
        'div',
        { class: 'cols' },
        branches.map((b) => {
          const list = techs.filter((t) => t.branch === b);
          return list.length ? h('div', { class: 'tech-col' }, h('h4', null, BRANCHES[b].name), list.map((t) => card(t.id))) : null;
        }),
      ),
    );
  };
  return h(
    'div',
    null,
    h('p', null, `Research rate: `, h('b', null, `${rate.toFixed(2)} points/month`), ` — from integrated development, funding (Realm ledger) and modifiers. `, cur ? `Researching ${cur.name}.` : h('span', { class: 'warn' }, 'Nothing selected: up to 60 points are banked.')),
    h('p', { class: 'small muted' }, `Every technology has a horizon year. Researching it earlier costs 15% more per year early, and no technology can be finished more than 10 years before its horizon. Progress is kept when switching. ${n.research.done.length} of ${TECH_LIST.length} researched.`),
    ([1, 2, 3, 4, 5] as Era[]).map(eraBlock),
  );
}

// ───────────────────────────── Policy ───────────────────────────────────────

function policyLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return noRealm();
  const n = sim.state.nations[pid];
  const ready = n.policySince + months(POLICY_COOLDOWN_MONTHS);
  return h(
    'div',
    null,
    h('p', null, 'Current policy: ', h('b', null, POLICIES[n.policy].name), sim.state.tick < 4 ? ' — the first change in the opening month is free.' : sim.state.tick < ready ? ` — locked until ${dateOf(sim, ready).short}.` : ` — may be changed for ${policySwitchCost(sim, pid)} crowns.`),
    h('p', { class: 'small muted' }, `Policies express the realm's priority. Each change costs 20 crowns plus half a month's income and locks policy for ${POLICY_COOLDOWN_MONTHS} months.`),
    h(
      'div',
      { class: 'cols' },
      POLICY_LIST.map((p) =>
        h(
          'div',
          { class: `card ${n.policy === p.id ? 'current' : ''}` },
          h('h4', null, p.name),
          h('p', { class: 'small good' }, `▲ ${p.benefit}`),
          h('p', { class: 'small bad' }, `▼ ${p.drawback}`),
          n.policy === p.id ? h('span', { class: 'tag good' }, 'Current') : action('Adopt', `Cost ${policySwitchCost(sim, pid)} crowns`, () => app.do({ type: 'policy', policy: p.id }), policyProblem(sim, pid, p.id)),
        ),
      ),
    ),
  );
}

// ───────────────────────────── Diplomacy ────────────────────────────────────

function relationTag(app: App, nid: NationId): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  if (atWar(sim, me, nid)) return h('span', { class: 'tag bad' }, 'War');
  const tags: string[] = [];
  if (hasTreaty(sim, 'alliance', me, nid)) tags.push('Ally');
  if (hasTreaty(sim, 'nap', me, nid)) tags.push('Pact');
  if (hasTreaty(sim, 'trade', me, nid)) tags.push('Trade');
  if (truceUntil(sim, me, nid) > sim.state.tick) tags.push('Truce');
  return h('span', { class: `tag ${tags.includes('Ally') ? 'good' : ''}` }, tags.join(', ') || 'Neutral');
}

function reasonsList(parts: Array<{ label: string; value: number }>): HTMLElement {
  return h(
    'ul',
    { class: 'reasons' },
    parts.map((p) => h('li', null, h('span', null, p.label), h('span', { class: p.value >= 0 ? 'pos' : 'neg' }, signed(p.value, 0)))),
  );
}

function sharesBorder(app: App, a: NationId, b: NationId): boolean {
  const sim = app.sim!;
  for (const p of ownedProvinces(sim, a)) for (const n of sim.world.prov[p].neighbors) if (sim.state.provinces[n].owner === b) return true;
  return false;
}

function diplomacyLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  if (!me) return noRealm();
  const st = sim.state;
  const others = aliveNations(sim).filter((n) => n !== me);
  if (!app.ui.diploTarget || !others.includes(app.ui.diploTarget)) app.ui.diploTarget = others[0] ?? null;
  const target = app.ui.diploTarget;
  const groupOf = (o: NationId) =>
    atWar(sim, me, o) ? 0 : hasTreaty(sim, 'alliance', me, o) || hasTreaty(sim, 'nap', me, o) || hasTreaty(sim, 'trade', me, o) ? 1 : sharesBorder(app, me, o) ? 2 : 3;
  const GROUPS = ['At war', 'Allies and partners', 'Neighbours', 'Farther realms'];
  const sorted = [...others].sort((x, y) => groupOf(x) - groupOf(y) || opinion(sim, y, me) - opinion(sim, x, me));
  const list = h('div', { class: 'diplo-list', role: 'listbox', 'aria-label': 'Realms' });
  let last = -1;
  for (const o of sorted) {
    const g = groupOf(o);
    if (g !== last) {
      list.appendChild(h('div', { class: 'dl-group' }, GROUPS[g]));
      last = g;
    }
    const op = opinion(sim, o, me);
    const alarm = st.alarm[o]?.[me] ?? 0;
    const item = h(
      'button',
      { class: `diplo-item ${o === target ? 'selected' : ''}`, type: 'button', role: 'option', 'aria-selected': o === target ? 'true' : 'false', 'data-fk': `diplo-${o}` },
      shield(app, o),
      h('span', { class: 'di-n' }, sim.world.nationDefs[o].short),
      h('span', { class: `di-op ${op >= 0 ? 'good' : 'bad'}`, title: 'Their opinion of us' }, signed(op, 0)),
      alarm >= C.diplomacy.alarmCoalition * 0.8 ? h('span', { class: 'di-al', title: `Alarmed by us (${Math.round(alarm)})` }, icon('alert')) : null,
    );
    item.addEventListener('click', () => {
      app.ui.diploTarget = o;
      app.focusNation = null;
      app.refresh();
    });
    list.appendChild(item);
  }
  const envoysUsed = st.envoys.filter((e) => e.from === me).length;
  const coal = coalitionAgainst(sim, me);
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'diplo-summary' },
      h('span', null, icon('envoy'), `Envoys ${envoysUsed}/${envoySlots(sim, me)}`),
      h('span', null, icon('pact'), `Trust ${Math.round(st.nations[me].trust)}`),
      h('span', null, icon('alliance'), `Allies: ${alliesOf(sim, me).map((a) => sim.world.nationDefs[a].short).join(', ') || 'none'}`),
    ),
    coal ? h('div', { class: 'callout bad', style: 'margin-bottom:10px' }, icon('alert'), `Coalition against us: ${coal.members.map((m) => nationName(sim, m)).join(', ')}. Attack any member and all join; they may attack together.`) : null,
    h('div', { class: 'diplo-split' }, list, target ? nationDetail(app, target) : h('div')),
  );
}

function nationDetail(app: App, o: NationId): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const st = sim.state;
  const def = sim.world.nationDefs[o];
  const parts = opinionParts(sim, o, me).map((p) => ({ label: p.label, value: Math.round(p.value) }));
  const treaty = (t: TreatyType) => {
    if (hasTreaty(sim, t, me, o)) {
      const warning = t === 'nap' ? 'Breaking a pact costs 10 trust and imposes a 12-month cooling-off before war.' : t === 'alliance' ? 'Leaving an ally at war costs 15 trust.' : 'They will resent it.';
      return action(`Cancel ${TREATY_LABELS[t].toLowerCase()}`, warning, () => confirmDialog(app, `Cancel ${TREATY_LABELS[t].toLowerCase()}?`, warning, () => app.do({ type: 'cancelTreaty', target: o, treaty: t })), null, 'danger');
    }
    const prob = treatyProblem(sim, me, o, t);
    const ev = evaluateTreaty(sim, me, o, t);
    const likely = ev.accept ? h('span', { class: 'good' }, `Likely to accept (${signed(ev.score, 0)})`) : h('span', { class: 'bad' }, `Likely to refuse (${signed(ev.score, 0)})`);
    return h(
      'div',
      { class: 'treaty' },
      action(`Propose ${TREATY_LABELS[t].toLowerCase()}`, h('span', null, likely), () => app.do({ type: 'propose', target: o, treaty: t }), prob),
      prob ? null : h('details', null, h('summary', { class: 'small muted' }, 'Why?'), reasonsList(ev.reasons)),
    );
  };
  const envoyHere = st.envoys.find((e) => e.from === me && e.to === o);
  const goals = goalOptions(sim, me, o);
  const warBlock = atWar(sim, me, o)
    ? h('div', { class: 'callout bad' }, icon('wars'), h('span', { class: 'grow' }, 'We are at war.'), button('Wars & Peace', () => app.openLedger('wars'), { cls: 'small' }))
    : goals.length
      ? h(
          'div',
          null,
          goals.map((g) => {
            const prob = declareWarProblem(sim, me, o, g);
            const allies = alliesOf(sim, o).filter((a) => a !== me);
            const coal = coalitionAgainst(sim, me);
            const cons = [
              g.type === 'conquest' ? `Costs ${C.war.conquestTrustLoss} trust and alarms their neighbours.` : g.type === 'claim' ? 'Pressing a claim costs no trust.' : 'All coalition members join you.',
              allies.length ? `Their allies may join: ${allies.map((a) => nationName(sim, a)).join(', ')}.` : 'They have no allies.',
              coal?.members.includes(o) ? 'They are in a coalition against you: all members will join them!' : '',
            ].join(' ');
            const label = `${g.type === 'claim' ? 'Press claims' : g.type === 'coalition' ? 'Coalition war' : 'War of conquest'}: ${g.provinces.map((p) => provName(sim, p)).join(', ')}`;
            return action(label, cons, () => confirmDialog(app, `Declare war on ${def.short}?`, cons, () => app.do(g.type === 'coalition' ? { type: 'coalitionWar', target: o } : { type: 'declareWar', target: o, goal: g })), prob, 'danger');
          }),
        )
      : h('p', { class: 'small muted' }, 'No war goal: we need a claim on their land (fabricate one from a province of ours that borders it) or a shared border for a war of conquest.');
  const coalAgainstThem = coalitionAgainst(sim, o);
  const myAlarm = st.alarm[me]?.[o] ?? 0;
  const theirAlarm = st.alarm[o]?.[me] ?? 0;
  const ratio = nationStrength(sim, o) / Math.max(0.1, nationStrength(sim, me));
  const op = opinion(sim, o, me);
  const ourClaims = claimsOn(sim, me, o);
  const theirClaims = claimsOn(sim, o, me);
  const tile = (label: string, value: string, cls: string, tipText: string) => h('div', { class: 'stat-tile', title: tipText }, h('div', { class: 'eyebrow' }, label), h('div', { class: `big ${cls}` }, value));
  const onMap = button('Their relations on the map', () => {
    app.focusNation = o;
    app.setMode('diplomacy');
  }, { cls: 'small quiet', icon: 'relations', fk: 'their-view' });
  const find = button('Show on map', () => {
    const cap = st.nations[o].capital;
    if (cap) app.centerOn(cap, 60);
  }, { cls: 'small quiet', icon: 'target', fk: 'show-realm' });
  return h(
    'div',
    { class: 'diplo-detail' },
    h('div', { class: 'dd-head' }, shield(app, o, 'lg'), h('div', { class: 'grow' }, h('h3', null, def.name), h('div', { class: 'small muted' }, `${PERSONALITIES[st.nations[o].ai.personality].label} · ${ownedProvinces(sim, o).length} provinces · ${def.startType ?? ''}`)), relationTag(app, o)),
    h('div', { class: 'row', style: 'gap:6px;margin:6px 0 10px;flex-wrap:wrap' }, find, onMap),
    h(
      'div',
      { class: 'stat-grid' },
      tile('Their opinion', signed(op, 0), op >= 0 ? 'good' : 'bad', 'How they regard us. Treaties and war goals depend on it.'),
      tile('Their alarm', String(Math.round(theirAlarm)), theirAlarm >= C.diplomacy.alarmCoalition ? 'bad' : '', `How threatened they feel by us. At ${C.diplomacy.alarmCoalition} realms may join coalitions.`),
      tile('Strength', `${ratio.toFixed(1)}×`, ratio > 1.3 ? 'bad' : ratio < 0.77 ? 'good' : '', 'Their military strength relative to ours.'),
      tile('Their trust', String(Math.round(st.nations[o].trust)), '', 'Their reputation for keeping agreements.'),
    ),
    h('details', { class: 'section', open: true }, h('summary', { class: 'eyebrow' }, 'Why they feel this way'), reasonsList(parts)),
    section(
      'Envoy and treaties',
      envoyHere
        ? action('Recall envoy', `Envoy at their court until ${dateOf(sim, envoyHere.until).short} (+${C.diplomacy.envoyGain}/month opinion, up to ${C.diplomacy.envoyCap}).`, () => app.do({ type: 'recallEnvoy', target: o }), null)
        : action('Send envoy', `${C.diplomacy.envoyCost} crowns/month for 12 months: +${C.diplomacy.envoyGain} opinion each month (up to ${C.diplomacy.envoyCap}).`, () => app.do({ type: 'envoy', target: o }), envoyProblem(sim, me, o)),
      treaty('trade'),
      treaty('nap'),
      treaty('alliance'),
    ),
    section(
      'Their situation',
      row('Allies', alliesOf(sim, o).map((a) => sim.world.nationDefs[a].short).join(', ') || 'none'),
      row('Wars', warsOf(sim, o).map((w) => w.name).join(', ') || 'none'),
      row('Shared border', sharesBorder(app, me, o) ? 'yes' : 'no'),
      row('Our claims on them', ourClaims.length ? ourClaims.map((p) => provName(sim, p)).join(', ') : 'none'),
      row('Their claims on us', theirClaims.length ? theirClaims.map((p) => provName(sim, p)).join(', ') : 'none'),
    ),
    section(
      'Coalition',
      coalAgainstThem?.members.includes(me)
        ? action('Leave coalition', `Members: ${coalAgainstThem.members.map((m) => nationName(sim, m)).join(', ')}`, () => app.do({ type: 'leaveCoalition', target: o }), null)
        : action(`Join coalition against ${def.short}`, `Our alarm about them: ${Math.round(myAlarm)} (needs ${C.diplomacy.alarmCoalition}). Members defend each other against them.`, () => app.do({ type: 'joinCoalition', target: o }), joinCoalitionProblem(sim, me, o)),
    ),
    section('War', warBlock),
  );
}

// ───────────────────────────── Wars ─────────────────────────────────────────

function warsLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const mine = me ? warsOf(sim, me) : [];
  const others = Object.values(sim.state.wars).filter((w) => !mine.includes(w));
  // at peace: what we could fight for, and who might come for us
  const peace: Array<Node | null> = [];
  if (me && !mine.length) {
    const sim2 = sim;
    const rows = aliveNations(sim2)
      .filter((o) => o !== me)
      .map((o) => ({ o, goals: goalOptions(sim2, me, o), theirClaims: claimsOn(sim2, o, me).length, alarm: sim2.state.alarm[o]?.[me] ?? 0 }));
    const targets = rows.filter((r) => r.goals.length);
    const threats = rows.filter((r) => r.theirClaims || r.alarm >= C.diplomacy.alarmCoalition * 0.8).sort((a, b) => b.theirClaims - a.theirClaims || b.alarm - a.alarm);
    const open = (o: NationId) => button('Diplomacy', () => app.openDiplomacy(o), { cls: 'small quiet', fk: `wars-dip-${o}` });
    peace.push(
      h('div', { class: 'callout good' }, icon('pact'), 'We are at peace.'),
      section(
        'War goals we hold',
        targets.length
          ? h(
              'div',
              null,
              targets.map((r) =>
                h(
                  'div',
                  { class: 'front-row' },
                  shield(app, r.o),
                  h('div', { class: 'grow' }, h('b', null, nationName(sim2, r.o)), h('div', { class: 'small muted' }, r.goals.map((g) => `${g.type === 'claim' ? 'claims' : g.type === 'conquest' ? 'conquest' : 'coalition'}: ${g.provinces.map((p) => provName(sim2, p)).join(', ')}`).join(' · '))),
                  open(r.o),
                ),
              ),
            )
          : h('p', { class: 'small muted' }, 'None yet. Fabricate a claim from a province of ours that borders the land we want, or share a border for a war of conquest.'),
      ),
      section(
        'Who might come for us',
        threats.length
          ? h(
              'div',
              null,
              threats.map((r) =>
                h(
                  'div',
                  { class: 'front-row' },
                  shield(app, r.o),
                  h('div', { class: 'grow' }, h('b', null, nationName(sim2, r.o)), h('div', { class: 'small muted' }, [r.theirClaims ? `claims ${r.theirClaims} of our provinces` : '', r.alarm >= C.diplomacy.alarmCoalition * 0.8 ? `alarmed by us (${Math.round(r.alarm)})` : ''].filter(Boolean).join(' · '))),
                  open(r.o),
                ),
              ),
            )
          : h('p', { class: 'small muted' }, 'No realm claims our land or is alarmed by us.'),
      ),
    );
  }
  return h(
    'div',
    null,
    mine.length ? mine.map((w) => warCard(app, w, true)) : peace,
    others.length ? h('h3', { style: 'margin-top:16px' }, 'Other wars') : null,
    others.map((w) => warCard(app, w, false)),
    h(
      'p',
      { class: 'small muted', style: 'margin-top:12px' },
      `War score (−100…100) = occupation of enemy land − occupation of yours + battles (±${C.war.battleScoreCap}) + war goal (±${C.war.goalScoreCap}). Wars end in a forced white peace after ${C.war.forcedPeaceMonths / 12} years or ${C.war.stalemateMonths / 12} years of stalemate; a side holding ≥90 for a year imposes its goal. Peace brings a 5-year truce.`,
    ),
  );
}

function warCard(app: App, w: War, mine: boolean): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const b = computeWarScore(sim, w);
  const my = me && mine ? scoreFor(w, me) : w.score;
  const age = Math.floor((sim.state.tick - w.startTick) / 4);
  const sideList = (arr: string[]) => h('span', null, arr.map((n) => h('span', { style: 'margin-right:6px' }, shield(app, n), ' ', nationName(sim, n))));
  return h(
    'div',
    { class: 'card', style: 'margin-bottom:12px' },
    h('h3', null, w.name),
    row('Attackers', sideList(w.attackers)),
    row('Defenders', sideList(w.defenders)),
    row('Goal', `${w.goal.type}: ${w.goal.provinces.map((p) => provName(sim, p)).join(', ')}`),
    row('Duration', `${age} months${w.stalemateMonths ? ` · stalemate ${w.stalemateMonths} mo` : ''}`),
    row(mine ? 'War score (our view)' : 'War score (attackers)', h('b', { class: my >= 0 ? 'good' : 'bad' }, signed(my, 0))),
    bar(my + 100, 200, my >= 0 ? 'good' : 'bad', 'War score'),
    h('p', { class: 'small muted' }, `Attackers occupy ${Math.round(b.occAtt)}% of defender land; defenders occupy ${Math.round(b.occDef)}%; battles ${signed(b.battle, 0)}; goal ${signed(b.goal, 0)}.`),
    mine && me ? peaceBuilder(app, w) : null,
  );
}

function peaceBuilder(app: App, w: War): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const mySide = sideOf(w, me)!;
  const leaders = [w.attackerLead, w.defenderLead];
  const opp = mySide === 'attacker' ? w.defenders : w.attackers;
  const partners = leaders.includes(me) ? opp : [mySide === 'attacker' ? w.defenderLead : w.attackerLead];
  let pb = app.ui.peace;
  if (!pb || pb.war !== w.id || !partners.includes(pb.with)) pb = app.ui.peace = { war: w.id, with: partners[0], mode: scoreFor(w, me) >= 10 ? 'demand' : 'white', provinces: [], gold: 0 };
  const state = pb;
  const giver = state.mode === 'demand' ? state.with : me;
  const receiver = state.mode === 'demand' ? me : state.with;
  const recvSide = sideOf(w, receiver) === 'attacker' ? w.attackers : w.defenders;
  const terms: PeaceTerms = { mode: state.mode, provinces: state.mode === 'white' ? [] : state.provinces.filter((p) => sim.state.provinces[p].owner === giver), gold: state.mode === 'white' ? 0 : state.gold };
  const cost = termsCost(sim, w, giver, receiver, terms);
  const ev = evaluatePeace(sim, w.id, me, state.with, terms);
  const prob = checkCommand(sim, { type: 'peace', nation: me, war: w.id, with: state.with, terms });
  const modeBtn = (m: 'demand' | 'white' | 'concede', label: string) =>
    button(label, () => {
      state.mode = m;
      state.provinces = [];
      state.gold = 0;
      renderLedger(app);
    }, { cls: `small ${state.mode === m ? 'active' : ''}` });
  const partnerSel = h('select', { 'aria-label': 'Negotiate with' }, partners.map((p) => h('option', { value: p, selected: p === state.with ? true : undefined }, `${nationName(sim, p)}${leaders.includes(p) ? ' (war leader)' : ' (separate peace)'}`)));
  partnerSel.addEventListener('change', () => {
    state.with = partnerSel.value;
    state.provinces = [];
    renderLedger(app);
  });
  const provs = state.mode === 'white' ? [] : ownedProvinces(sim, giver).sort((a, b) => {
    const oa = recvSide.includes(sim.state.provinces[a].controller ?? '') ? 0 : 1;
    const ob = recvSide.includes(sim.state.provinces[b].controller ?? '') ? 0 : 1;
    return oa - ob || sim.state.provinces[b].dev - sim.state.provinces[a].dev || (a < b ? -1 : 1);
  });
  const goldMax = Math.floor(Math.max(0, sim.state.nations[giver].treasury));
  const goldInput = h('input', { type: 'range', min: 0, max: goldMax, step: 10, value: Math.min(state.gold, goldMax), 'aria-label': 'Gold' });
  goldInput.addEventListener('change', () => {
    state.gold = Number(goldInput.value);
    renderLedger(app);
  });
  return h(
    'div',
    { style: 'margin-top:8px;border-top:1px solid var(--line);padding-top:8px' },
    h('h4', null, 'Negotiate peace'),
    h('div', { class: 'row' }, partnerSel, modeBtn('demand', 'Demand'), modeBtn('white', 'White peace'), modeBtn('concede', 'Offer concessions')),
    state.mode !== 'white'
      ? h(
          'div',
          null,
          h('p', { class: 'small muted' }, `${state.mode === 'demand' ? `Provinces ${nationName(sim, giver)} would cede` : 'Provinces we would cede'} (occupied ones are cheaper):`),
          h(
            'div',
            { class: 'row', style: 'max-height:140px;overflow:auto' },
            provs.map((p) => {
              const occ = recvSide.includes(sim.state.provinces[p].controller ?? '');
              const cb = h('input', { type: 'checkbox', checked: state.provinces.includes(p) ? true : undefined, id: `pp-${p}` });
              cb.addEventListener('change', () => {
                if (cb.checked) state.provinces.push(p);
                else state.provinces = state.provinces.filter((x) => x !== p);
                renderLedger(app);
              });
              return h('label', { class: 'tag', for: `pp-${p}`, style: `cursor:pointer;${occ ? 'border-color:var(--gold)' : ''}` }, cb, ` ${provName(sim, p)} (${provinceCost(sim, giver, recvSide, p)})`);
            }),
          ),
          h('div', { class: 'row' }, h('span', { class: 'small' }, `Gold: ${state.gold} crowns (max ${goldMax})`), goldInput),
        )
      : null,
    row('Value of terms', `${cost} points`),
    row(`${nationName(sim, state.with)}'s answer`, h('b', { class: ev.accept ? 'good' : 'bad' }, `${ev.accept ? 'Would accept' : 'Would refuse'} (${signed(ev.score, 0)})`)),
    h('details', null, h('summary', { class: 'small muted' }, 'Why?'), reasonsList(ev.reasons)),
    action('Send peace offer', 'Accepted offers take effect immediately.', () => {
      const r = app.do({ type: 'peace', war: w.id, with: state.with, terms });
      if (r.ok) app.ui.peace = null;
    }, prob),
  );
}

// ───────────────────────────── Victory ──────────────────────────────────────

/** How to break the rival furthest along a path (shown only when one is holding it). */
function counterplay(app: App, k: 'territorial' | 'economic' | 'diplomatic'): HTMLElement | null {
  const sim = app.sim!;
  const rival = aliveNations(sim)
    .filter((n) => n !== app.player)
    .map((n) => ({ n, p: victoryProgress(sim, n)[k] }))
    .filter((x) => x.p.met && x.p.streak > 0)
    .sort((a, b) => b.p.streak - a.p.streak)[0];
  if (!rival) return null;
  const name = nationName(sim, rival.n);
  let text: string;
  if (k === 'territorial') {
    const regions = dominatedRegions(sim, rival.n).map((r) => sim.world.scenario.regions.find((x) => x.id === r)?.name ?? r);
    text = `${name} dominates ${regions.join(', ')}. Occupying or taking land there, or cutting their share of all provinces, breaks the condition.`;
  } else if (k === 'economic') {
    text = `Occupying any one province of ${name} in a war, driving their unrest above ${C.victory.economicUnrest}, or pushing them into debt breaks the condition.`;
  } else {
    const parts = Object.entries(influenceByPartner(sim, rival.n)).map(([n, v]) => `${nationName(sim, n)} ${v}`);
    text = `${name}'s influence: ${parts.join(', ')} (needs ${influenceNeeded(sim, rival.n)}). Ending your own treaties with them, or turning a partner's opinion of them below ${C.victory.diplomaticOpinion}, breaks it; so would an offensive war of theirs.`;
  }
  return h('p', { class: 'small warn', style: 'margin-top:6px' }, `How to stop ${name}: ${text} Each month the condition fails costs them 6 months of progress.`);
}

function victoryLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const scores = allScores(sim);
  const alive = aliveNations(sim);
  const paths = ['territorial', 'economic', 'diplomatic'] as const;
  const desc: Record<(typeof paths)[number], string> = {
    territorial: `Own and control ≥75% of the provinces in ${victoryRules(sim).territorialRegions} regions and ≥${Math.round(victoryRules(sim).territorialShare * 100)}% of all provinces, then hold it for ${VICTORY_MONTHS.territorial} months.`,
    economic: `Integrated development (dev of provinces at integration ≥75) of ≥${Math.round(victoryRules(sim).economicShare * 100)}% of the world's, with average unrest ≤${C.victory.economicUnrest}, no debt or bankruptcy and none of your land occupied — for ${VICTORY_MONTHS.economic} months.`,
    diplomatic: `Influence from treaties at least ${C.victory.diplomaticTreatyAge / 12} years old with partners whose opinion of you is ≥${C.victory.diplomaticOpinion} (alliance 2, trade 1): ${victoryRules(sim).diplomaticInfluencePerRealm} per other surviving realm; trust ≥${C.victory.diplomaticTrust}; no offensive war — for ${VICTORY_MONTHS.diplomatic} months.`,
  };
  // one evaluation per realm serves all three path cards
  const progress = new Map(alive.map((n) => [n, victoryProgress(sim, n)]));
  const mine = me ? (progress.get(me) ?? victoryProgress(sim, me)) : null;
  const infl = me ? influenceByPartner(sim, me) : {};
  return h(
    'div',
    null,
    h('p', null, `The campaign ends in ${dateOf(sim, endTick(sim)).short}. Timers lose 6 months for each month their conditions fail. Every realm, AI or not, can win.`),
    h(
      'div',
      { class: 'cols' },
      paths.map((k) =>
        h(
          'div',
          { class: 'card' },
          h('h3', null, VICTORY_LABELS[k]),
          h('p', { class: 'small muted' }, desc[k]),
          mine ? h('div', null, ...mine[k].lines.map((l) => h('p', { class: 'small' }, l)), row('Held', `${mine[k].streak}/${mine[k].required} months`), bar(mine[k].streak, mine[k].required, mine[k].met ? 'good' : 'warn')) : null,
          k === 'diplomatic' && me && Object.keys(infl).length ? h('p', { class: 'small muted' }, `Partners: ${Object.entries(infl).map(([n, v]) => `${nationName(sim, n)} ${v}`).join(', ')} (need ${influenceNeeded(sim, me)}, have ${influence(sim, me)})`) : null,
          h('h4', { style: 'margin-top:8px' }, 'Leaders'),
          ...alive
            .map((n) => ({ n, p: progress.get(n)![k] }))
            .sort((a, b) => b.p.streak - a.p.streak || b.p.progress - a.p.progress)
            .slice(0, 4)
            .map(({ n, p }) => row(h('span', null, shield(app, n), ' ', nationName(sim, n)), `${Math.round(p.progress * 100)}%${p.streak ? ` · held ${p.streak} mo` : ''}`)),
          counterplay(app, k),
        ),
      ),
    ),
    h('h3', { style: 'margin-top:14px' }, 'Campaign score'),
    h('p', { class: 'small muted' }, `${SCORE_FORMULA} Used to break simultaneous wins and to decide the result at the campaign limit.`),
    h(
      'table',
      { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Realm'), h('th', null, 'Provinces'), h('th', null, 'Score'))),
      h(
        'tbody',
        null,
        sim.world.nationIds
          .slice()
          .sort((a, b) => scores[b] - scores[a])
          .map((n) => h('tr', null, h('td', null, shield(app, n), ' ', nationName(sim, n), sim.state.nations[n].alive ? '' : ' ✝'), h('td', null, String(ownedProvinces(sim, n).length)), h('td', null, fmt(scores[n], 1)))),
      ),
    ),
  );
}

// ───────────────────────────── Log & diagnostics ────────────────────────────

function logLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const f = app.ui.logFilter;
  const filterBtn = (id: typeof f, label: string) =>
    button(label, () => {
      app.ui.logFilter = id;
      renderLedger(app);
    }, { cls: `small ${f === id ? 'active' : ''}` });
  let notes = sim.state.notifications.filter((n) => n.nation === me || n.nation === null);
  if (f === 'urgent') notes = notes.filter((n) => n.priority === 'urgent');
  const reports = sim.state.reports.filter((r) => !me || r.attackerNations.includes(me) || r.defenderNations.includes(me)).slice(-30).reverse();
  const bugReport = () => {
    const st = sim.state;
    const build = `${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'} (${import.meta.env?.MODE ?? 'unknown'})`;
    const report = diagnosticBundle(sim, { build, userAgent: navigator.userAgent });
    downloadText(`crown-and-frontier-bug-${st.settings.seed}-${st.tick}.json`, JSON.stringify(report, null, 1));
  };
  return h(
    'div',
    null,
    h('div', { class: 'row' }, filterBtn('all', 'All'), filterBtn('urgent', 'Urgent'), filterBtn('battles', 'Battle reports'), h('span', { class: 'grow' }), button('Export bug report', bugReport, { cls: 'small', title: 'Seed, settings, your command log and AI diagnostics for reproducing a problem' })),
    f === 'battles'
      ? h(
          'div',
          null,
          reports.length
            ? reports.map((r) =>
                h(
                  'div',
                  { class: 'card', style: 'margin:6px 0' },
                  h('h4', null, `Battle of ${provName(sim, r.province)} — ${dateOf(sim, r.tick).short}`),
                  h('p', { class: 'small' }, r.outcome),
                  row('Attackers', `${r.attackerNations.map((n) => nationName(sim, n)).join(', ')}: ${men(r.attStartMen)} (lost ${men(r.attLosses)})`),
                  row('Defenders', `${r.defenderNations.map((n) => nationName(sim, n)).join(', ')}: ${men(r.defStartMen)} (lost ${men(r.defLosses)})`),
                  r.factors.length ? h('ul', { class: 'reasons' }, r.factors.map((x) => h('li', null, x))) : null,
                ),
              )
            : h('p', { class: 'muted' }, 'No battles yet.'),
        )
      : h(
          'div',
          null,
          notes
            .slice(-200)
            .reverse()
            .map((n) => {
              const d = h('div', { class: `kv ${n.priority === 'urgent' ? 'bad' : n.priority === 'low' ? 'muted' : ''}`, style: n.province ? 'cursor:pointer' : '' }, h('span', { class: 'k nowrap' }, dateOf(sim, n.tick).short), h('span', { class: 'v', style: 'text-align:left;flex:1;margin-left:10px' }, n.text));
              if (n.province) d.addEventListener('click', () => {
                app.closeLedger();
                app.selectProvince(n.province!, true);
              });
              return d;
            }),
        ),
  );
}

// ───────────────────────────── Help ─────────────────────────────────────────

function helpLedger(app: App): HTMLElement {
  void app;
  const sec = (t: string, ...ps: string[]) => h('div', { class: 'card' }, h('h3', null, t), ...ps.map((p) => h('p', { class: 'small' }, p)));
  return h(
    'div',
    { class: 'cols' },
    sec('Controls', 'Click / tap: select a province or army. Drag: pan. Wheel / pinch: zoom. Right-click, long-press, or “Set destination” (G): move the selected army.', 'Space: pause. 1–4: speed. B, I, M, T, P, D, W, V, L, H: ledgers. O: cycle map overlays. N: next army. Home: capital. Esc: close / deselect.'),
    sec('The loop', 'Read the world → choose a priority → commit crowns, materiel, resources and men → watch the consequences → adapt. Orders persist until completed or invalidated. The game is paused whenever a decision needs you (configurable in Settings).'),
    sec('Frontier integration', 'Every province has integration 0–100. Low integration means little tax, few recruits, no development, no supply source and more unrest. New conquests start at 10 (25 with a claim), settled land at 20. Roads, garrisons, claims, charters and the Frontier Settlement policy speed it up; too much raw frontier at once overextends your administration.'),
    sec('Economy', 'Crowns come from development and population (scaled by integration and unrest), from trade and from surplus manufactured goods; armies, forts, envoys and research funding cost upkeep. Food feeds armies on supply lines. Deposits yield coal, iron, oil, rubber and nitrates; factories burn coal to make materiel, which equips and reinforces regiments. Trade agreements move surplus resources to partners who need them at fixed prices. Running short of a resource has a named effect shown on the Industry ledger (I). The manpower pool refills from the military reserve, which men under arms already use.'),
    sec('War', 'Declare war with a claim (no trust cost) or a conquest goal (costs trust, alarms neighbours). Battles: terrain, forts, entrenchment, supply, composition, morale and technology decide; forecasts show three outcomes. Winning a battle does not take land — standing in a province besieges it. Peace uses war score; every choice shows whether the enemy would accept and why.'),
    sec('Diplomacy', 'Envoys raise opinion. Pacts forbid war; trade agreements exchange surplus resources and earn commerce; alliances are defensive calls to arms. Proposals show the other side’s reasoning before you send them. Rapid conquest raises alarm, and so does a visible bid for territorial or economic victory; alarmed neighbours form coalitions. A bid for diplomatic leadership instead makes rivals wary (lower opinion) and may cost you their trade.'),
    sec('Saves', 'The game autosaves every few months (Settings) and when the tab is hidden. Saves live in this browser only: they do not sync across devices or sites and can be erased by private browsing or managed-device policies. Use Menu → Export to keep a copy, and Import to restore it.'),
    sec('Fog of war', 'All information is public for everyone — AI realms see exactly what you see and follow the same rules, costs and formulas.'),
  );
}
