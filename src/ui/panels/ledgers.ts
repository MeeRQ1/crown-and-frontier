// Modal ledgers opened from the navigation bar.

import { C, forceLabel, RESOURCE_INFO, UNITS, UNIT_TYPES } from '../../sim/config';
import { navyAirSection } from './sea';
import { PROJECT_LABELS } from '../../sim/construction';
import { PERSONALITIES } from '../../sim/data/personalities';
import { FOCUS_BRANCHES, type FocusBranch, type FocusDef } from '../../sim/data/focus';
import { describeReward, focusMonthsLeft, focusProblem, focusStatus, focusTree, getFocus } from '../../sim/focus';
import { BRANCHES, ERAS, TECH_LIST, TECHS, type Branch, type Era } from '../../sim/data/techs';
import { claimsOn, coalitionAgainst, envoyProblem, envoySlots, evaluateTreaty, joinCoalitionProblem, opinion, opinionParts, TREATY_LABELS, treatyProblem } from '../../sim/diplomacy';
import { debtStage, grossIncome, manpowerRegen, menServing, poolCap, provinceCrowns, reserveCap, stockpileCap } from '../../sim/economy';
import { checkCommand } from '../../sim/commands';
import { armyCap, blocOf, evaluateBloc, evaluateLoan, foundBlocProblem, guaranteeProblem, guaranteesBy, guaranteeSlots, guarantorsOf, influenceGain, influenceOver, inviteProblem, joinProblem, loanProblem, sphereMembers, sphereOf } from '../../sim/influence';
import { adminCapacity, frontierLoad, overextension } from '../../sim/integration';
import { maxMorale, nationStrength, unitUnlocked } from '../../sim/military';
import { describeEffects } from '../../sim/modifiers';
import { earliestYear, researchProblem, researchRate, techCost, yearsEarly } from '../../sim/progression';
import { diagnosticBundle } from '../../sim/diagnostics';
import { aliveNations, alliesOf, armiesOf, atWar, dateOf, endTick, hasTreaty, menOf, nationName, ownedProvinces, provName, sideOf, truceUntil, warsOf } from '../../sim/state';
import { armySupplyInfo } from '../../sim/supply';
import type { Army, Demand, DemandKind, NationId, PeaceTerms, StrategicResource, TreatyType, War } from '../../sim/types';
import { buildSettlement, contributionShares, counterOffer, DEMAND_LABELS, demandCost, describeDemand, evaluateSettlement, settlementCost } from '../../sim/settlement';
import { allScores, victoryRules, dominatedRegions, influence, influenceByPartner, influenceNeeded, SCORE_FORMULA, VICTORY_LABELS, VICTORY_MONTHS, victoryProgress } from '../../sim/victory';
import { computeWarScore, evaluatePeace, goalOptions, provinceCost, scoreFor, termsCost, declareWarProblem } from '../../sim/war';
import type { App } from '../app';
import { action, bar, button, h, rebuild, row, setChildren } from '../dom';
import { fmt, men, plural, signed } from '../format';
import { downloadText } from '../storage';
import { confirmDialog } from './dialogs';
import { section, shield } from './common';
import { icon } from '../icons';
import { emblem, type EmblemName } from '../emblems';
import { industryLedger as industryLedgerNew } from '../ledgers/industry';

export type LedgerTab = 'realm' | 'industry' | 'military' | 'research' | 'focus' | 'diplomacy' | 'wars' | 'victory' | 'log' | 'help';

const TITLES: Record<LedgerTab, string> = {
  realm: 'Realm & Budget',
  industry: 'Industry & Trade',
  military: 'Military',
  research: 'Research',
  focus: 'National Focus',
  diplomacy: 'Diplomacy',
  wars: 'Wars & Peace',
  victory: 'Victory',
  log: 'Chronicle',
  help: 'How to Play',
};

/** Each ledger's section motif (the pack's menu emblems), shown once in its header. */
const EMBLEMS: Record<LedgerTab, EmblemName> = {
  realm: 'realm-budget',
  industry: 'industry-trade',
  military: 'military',
  research: 'research',
  focus: 'national-focus',
  diplomacy: 'diplomacy',
  wars: 'wars-peace',
  victory: 'victory',
  log: 'chronicle',
  help: 'help',
};

/**
 * The open ledger. The rail is the one way between ledgers, so the drawer has
 * no second row of global tabs: a slate header names the task, and the ivory
 * register below holds it.
 */
export function renderLedger(app: App): void {
  const tab = app.ui.ledgerTab;
  if (!tab || !app.sim) return;
  rebuild(app.drawerEl, () => {
    const close = h('button', { class: 'btn quiet icon', type: 'button', 'aria-label': 'Close ledger (Esc)', 'data-fk': 'drawer-close' }, icon('close'));
    close.addEventListener('click', () => app.closeLedger());
    const content = BODIES[tab](app);
    app.stageEl.classList.toggle('wide-ledger', WIDE.has(tab));
    setChildren(
      app.drawerEl,
      h('header', null, emblem(EMBLEMS[tab], 40), h('h2', { tabindex: '-1', id: 'ledger-title' }, TITLES[tab]), close),
      h('div', { class: 'body scroll', 'data-sk': `ledger-${tab}`, role: 'region', 'aria-labelledby': 'ledger-title' }, content),
    );
  });
}

/** Ledgers that need a wide workspace (trees and negotiations). */
const WIDE = new Set<LedgerTab>(['industry']);

const BODIES: Record<LedgerTab, (app: App) => HTMLElement> = {
  realm: realmLedger,
  industry: industryLedgerNew,
  military: militaryLedger,
  research: researchLedger,
  focus: focusLedger,
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
          : h('p', { class: 'small muted' }, 'Conquered and settled provinces add frontier load until integrated. Charters, railways, garrisons and the Frontier Settlement focus speed integration.'),
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

// Industry & Trade: src/ui/ledgers/industry.ts

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
            h('div', { class: 'army-head' }, h('span', null, 'Army'), h('span', null, 'Where'), h('span', null, 'Mix'), h('span', null, 'Men'), h('span', null, 'Morale'), h('span', null, ''), h('span', null, 'Doing')),
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
  const navy = navyAirSection(app);
  if (navy) kids.push(navy);
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
      t.unlocks ? h('p', { class: 'small good' }, `Unlocks ${forceLabel(t.unlocks).toLowerCase()}.`) : null,
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

// ───────────────────────────── National focus ───────────────────────────────

function focusLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return noRealm();
  const n = sim.state.nations[pid];
  const tree = focusTree(sim, pid);
  const cur = n.focus.current ? getFocus(sim, pid, n.focus.current) : null;
  const card = (d: FocusDef) => {
    const status = focusStatus(sim, pid, d.id);
    const prob = focusProblem(sim, pid, d.id);
    const effects = describeEffects(d.effects);
    const reward = describeReward(sim, d);
    const req = [
      ...d.requires.map((r) => getFocus(sim, pid, r)?.name ?? r),
      ...(d.requiresAny?.length ? [d.requiresAny.map((r) => getFocus(sim, pid, r)?.name ?? r).join(' or ')] : []),
    ];
    const start = () => {
      const go = () => app.do({ type: 'focus', focus: d.id });
      if (cur && n.focus.progress > 0) confirmDialog(app, `Switch to ${d.name}?`, `${n.focus.progress} month${n.focus.progress === 1 ? '' : 's'} of work on ${cur.name} will be lost.`, go);
      else go();
    };
    return h(
      'div',
      { class: `card focus-card ${status}`, 'data-focus': d.id },
      h('h4', null, d.name, ' ', h('span', { class: 'tag' }, `${d.months} months`), d.year && status !== 'done' ? h('span', { class: `tag ${dateOf(sim).year < d.year ? 'warn' : ''}` }, `from ${d.year}`) : null),
      effects.length ? h('p', { class: 'small' }, effects.join(' · ')) : null,
      reward.length ? h('p', { class: 'small good' }, `On completion: ${reward.join('; ')}.`) : null,
      d.claimsOnly ? h('p', { class: 'small warn' }, 'While held, wars may be declared only over claims.') : null,
      h('p', { class: 'small muted' }, d.description),
      req.length ? h('p', { class: 'small muted' }, `Requires ${req.join(', ')}`) : null,
      d.excludes?.length ? h('p', { class: 'small muted' }, `Excludes ${d.excludes.map((x) => getFocus(sim, pid, x)?.name ?? x).join(', ')}`) : null,
      d.provinces?.length ? button('Show on map', () => app.highlightProvinces(d.provinces!), { cls: 'small quiet', icon: 'target' }) : null,
      status === 'done'
        ? h('span', { class: 'tag good' }, 'Completed')
        : status === 'current'
          ? h('div', null, bar(n.focus.progress, d.months, 'info', 'Focus progress'), h('span', { class: 'small' }, `${n.focus.progress}/${d.months} months`))
          : status === 'excluded'
            ? h('span', { class: 'tag bad' }, 'Excluded by an earlier choice')
            : action('Make this our focus', cur ? `Replaces ${cur.name}${n.focus.progress ? ` (${n.focus.progress} months of work lost)` : ''}` : `${d.months} months`, start, prob),
    );
  };
  const branches = Object.keys(FOCUS_BRANCHES) as FocusBranch[];
  return h(
    'div',
    null,
    h(
      'p',
      null,
      cur ? h('span', null, 'National focus: ', h('b', null, cur.name), ` — ${n.focus.progress}/${cur.months} months, done in ${focusMonthsLeft(sim, pid)}.`) : h('span', { class: 'warn' }, 'No national focus: choose one below. A month without a focus is a month lost.'),
    ),
    h('p', { class: 'small muted' }, `The realm works on one focus at a time; each one finished is permanent. Some exclude others, some wait for a year or need a coast. Switching loses the work done on the current focus. ${n.focus.done.length} of ${tree.length} completed.`),
    branches.map((b) => {
      const list = tree.filter((d) => d.branch === b).sort((x, y) => x.row - y.row || x.col - y.col);
      if (!list.length) return null;
      const done = list.filter((d) => n.focus.done.includes(d.id)).length;
      const open = b === 'national' || list.some((d) => focusStatus(sim, pid, d.id) === 'available' || focusStatus(sim, pid, d.id) === 'current');
      return h(
        'details',
        { class: 'section', open: open ? true : null, 'data-branch': b },
        h('summary', { class: 'eyebrow' }, `${FOCUS_BRANCHES[b].name} — ${done}/${list.length} completed`),
        h('p', { class: 'small muted' }, FOCUS_BRANCHES[b].blurb),
        h('div', { class: 'focus-grid' }, list.map((d) => h('div', { style: `grid-column:${d.col + 1};grid-row:${d.row + 1}` }, card(d)))),
      );
    }),
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
  const bloc = blocOf(sim, me);
  const sphere = sphereMembers(sim, me);
  const patron = sphereOf(sim, me);
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'diplo-summary' },
      h('span', null, icon('envoy'), `Envoys ${envoysUsed}/${envoySlots(sim, me)}`),
      h('span', null, icon('pact'), `Trust ${Math.round(st.nations[me].trust)}`),
      h('span', null, icon('alliance'), `Allies: ${alliesOf(sim, me).map((a) => sim.world.nationDefs[a].short).join(', ') || 'none'}`),
      h('span', { title: 'Guarantees of independence we give (focuses add more)' }, icon('pact'), `Guarantees ${guaranteesBy(sim, me).length}/${guaranteeSlots(sim, me)}`),
      h('span', { title: 'Realms in our sphere of influence' }, icon('relations'), `Sphere: ${sphere.map((m) => sim.world.nationDefs[m].short).join(', ') || 'none'}`),
    ),
    coal ? h('div', { class: 'callout bad', style: 'margin-bottom:10px' }, icon('alert'), `Coalition against us: ${coal.members.map((m) => nationName(sim, m)).join(', ')}. Attack any member and all join; they may attack together.`) : null,
    patron ? h('div', { class: 'callout', style: 'margin-bottom:10px' }, icon('relations'), `We are in the sphere of ${nationName(sim, patron)}: they defend us if we are attacked, and we will not ally or join a coalition against them.`) : null,
    standingBlock(app, bloc),
    h('div', { class: 'diplo-split' }, list, target ? nationDetail(app, target) : h('div')),
  );
}

/** Our trade bloc, loans, reparations and treaty limits, when there are any. */
function standingBlock(app: App, bloc: ReturnType<typeof blocOf>): HTMLElement | null {
  const sim = app.sim!;
  const me = app.player!;
  const st = sim.state;
  const lent = st.loans.filter((l) => l.from === me);
  const owed = st.loans.filter((l) => l.to === me);
  const reps = st.reparations.filter((r) => r.from === me || r.to === me);
  const cap = armyCap(sim, me);
  const imposed = st.disarmaments.filter((d) => d.by === me);
  if (!bloc && !lent.length && !owed.length && !reps.length && cap === null && !imposed.length) return null;
  return h(
    'div',
    { class: 'cols', style: 'margin-bottom:10px', 'data-sk': 'diplo-standing' },
    bloc
      ? h(
          'div',
          { class: 'card' },
          h('h4', null, bloc.name),
          h('p', { class: 'small' }, `Led by ${nationName(sim, bloc.leader)} since ${dateOf(sim, bloc.since).short}. Members: ${bloc.members.map((m) => nationName(sim, m)).join(', ')}.`),
          h('p', { class: 'small muted' }, `Inside the bloc: purchases ${Math.round(C.bloc.buyDiscount * 100)}% cheaper, commerce +${Math.round(C.bloc.commerceBonus * 100)}%, blockade losses shared.`),
          action('Leave the bloc', 'Members stay; a bloc of one dissolves.', () => confirmDialog(app, `Leave the ${bloc.name}?`, 'We lose the bloc’s trade terms at once.', () => app.do({ type: 'leaveBloc' })), null, 'danger'),
        )
      : null,
    lent.length || owed.length
      ? h(
          'div',
          { class: 'card' },
          h('h4', null, 'Loans'),
          lent.map((l) => row(`Lent to ${nationName(sim, l.to)}`, `${Math.round(l.remaining)} owed · ${fmt(l.monthly, 1)}/month`)),
          owed.map((l) => row(`Owed to ${nationName(sim, l.from)}`, `${Math.round(l.remaining)} left · ${fmt(l.monthly, 1)}/month`)),
        )
      : null,
    reps.length || cap !== null || imposed.length
      ? h(
          'div',
          { class: 'card' },
          h('h4', null, 'Peace terms in force'),
          reps.map((r) => row(r.from === me ? `Reparations to ${nationName(sim, r.to)}` : `Reparations from ${nationName(sim, r.from)}`, `${Math.round(r.share * 100)}% of income until ${dateOf(sim, r.until).short}`)),
          cap !== null ? row('Our army limit', `${cap} regiments, no battleships or carriers`) : null,
          imposed.map((d) => row(`${nationName(sim, d.nation)} disarmed`, `at most ${d.cap} regiments until ${dateOf(sim, d.until).short}`)),
        )
      : null,
  );
}

/** Influence, the sphere, our guarantee, a loan and the trade bloc, for one realm. */
function influenceSection(app: App, o: NationId): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const st = sim.state;
  const ours = influenceOver(sim, me, o);
  const theirs = influenceOver(sim, o, me);
  const gain = influenceGain(sim, me, o);
  const patron = sphereOf(sim, o);
  const guaranteed = st.guarantees.some((g) => g.by === me && g.of === o);
  const loanBtn = (amount: number) => {
    const prob = loanProblem(sim, me, o, amount);
    const ev = evaluateLoan(sim, me, o, amount);
    return action(`Lend ${amount} crowns`, h('span', { class: ev.accept ? 'good' : 'bad' }, `${ev.accept ? 'Likely to accept' : 'Likely to refuse'} (${signed(ev.score, 0)}); repaid ${Math.round((amount * (1 + C.loan.interest)) / C.loan.months)}/month for ${C.loan.months} months`), () => app.do({ type: 'loan', target: o, amount }), prob);
  };
  const myBloc = blocOf(sim, me);
  const theirBloc = blocOf(sim, o);
  let blocAction: HTMLElement | null = null;
  if (myBloc && theirBloc && myBloc === theirBloc) blocAction = h('p', { class: 'small good' }, `Fellow members of the ${myBloc.name}.`);
  else if (myBloc && myBloc.leader === me) {
    const ev = evaluateBloc(sim, me, o, o);
    blocAction = action(`Invite into the ${myBloc.name}`, h('span', { class: ev.accept ? 'good' : 'bad' }, `${ev.accept ? 'Likely to accept' : 'Likely to refuse'} (${signed(ev.score, 0)})`), () => app.do({ type: 'inviteBloc', target: o }), inviteProblem(sim, me, o));
  } else if (!myBloc && theirBloc) {
    const ev = evaluateBloc(sim, theirBloc.leader, me, theirBloc.leader);
    blocAction = action(`Ask to join the ${theirBloc.name}`, h('span', { class: ev.accept ? 'good' : 'bad' }, `${nationName(sim, theirBloc.leader)} ${ev.accept ? 'is likely to agree' : 'is likely to refuse'} (${signed(ev.score, 0)})`), () => app.do({ type: 'joinBloc', bloc: theirBloc.id }), joinProblem(sim, me, theirBloc.id));
  } else if (!myBloc && !theirBloc) {
    const ev = evaluateBloc(sim, me, o, o);
    blocAction = action('Found a trade bloc with them', h('span', null, `${C.bloc.cost} crowns; we lead it. `, h('span', { class: ev.accept ? 'good' : 'bad' }, `${ev.accept ? 'Likely to accept' : 'Likely to refuse'} (${signed(ev.score, 0)})`)), () => app.do({ type: 'foundBloc', target: o }), foundBlocProblem(sim, me, o));
  }
  return section(
    'Influence, guarantees and trade',
    row('Our influence over them', h('span', null, `${Math.round(ours)}/100 `, h('span', { class: gain.total >= 0 ? 'good' : 'bad' }, `(${signed(gain.total, 1)}/month)`))),
    bar(ours, 100, ours >= C.influence.sphere ? 'good' : 'info', 'Our influence over them'),
    h('details', null, h('summary', { class: 'small muted' }, 'Where our influence comes from'), reasonsList(gain.parts.map((p) => ({ label: p.label, value: Math.round(p.value * 10) / 10 })))),
    row('Their influence over us', `${Math.round(theirs)}/100`),
    row('Their sphere', patron ? (patron === me ? h('b', { class: 'good' }, 'Ours') : nationName(sim, patron)) : 'none'),
    h('p', { class: 'small muted' }, `A realm falls into the sphere of a larger realm holding ${C.influence.sphere} influence over it and ${C.influence.sphereRatio}× any rival's. Envoys, trade, loans, guarantees and alliances build influence; war erodes it.`),
    guaranteed
      ? action('Revoke our guarantee', 'They will resent it.', () => confirmDialog(app, `Revoke the guarantee of ${nationName(sim, o)}?`, 'They will resent it; our word counts for less.', () => app.do({ type: 'revokeGuarantee', target: o })), null, 'danger')
      : action('Guarantee their independence', `We are called to arms when they are attacked; refusing costs ${C.guarantee.trustLoss} trust. They think better of us (+${C.guarantee.opinion}).`, () => app.do({ type: 'guarantee', target: o }), guaranteeProblem(sim, me, o)),
    loanBtn(100),
    loanBtn(250),
    blocAction,
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
            // a realm bound to us by an alliance or a pact cannot join against us
            const bound = (a: string) => hasTreaty(sim, 'alliance', a, me) || hasTreaty(sim, 'nap', a, me);
            const names = (list: string[]) => list.map((a) => nationName(sim, a)).join(', ');
            const allies = alliesOf(sim, o).filter((a) => a !== me && !bound(a));
            const held = alliesOf(sim, o).filter((a) => a !== me && bound(a));
            const guarantors = sim.state.guarantees.filter((x) => x.of === o && x.by !== me && !allies.includes(x.by) && !bound(x.by)).map((x) => x.by);
            const coal = coalitionAgainst(sim, me);
            const cons = [
              g.type === 'conquest' ? `Costs ${C.war.conquestTrustLoss} trust and alarms their neighbours.` : g.type === 'claim' ? 'Pressing a claim costs no trust.' : 'All coalition members join you.',
              allies.length ? `Their allies may join: ${names(allies)}.` : held.length ? 'None of their allies can join.' : 'They have no allies.',
              held.length ? `${names(held)} ${held.length === 1 ? 'is' : 'are'} bound to us by a treaty and cannot.` : '',
              guarantors.length ? `${names(guarantors)} ${guarantors.length === 1 ? 'guarantees' : 'guarantee'} their independence and will be called to arms.` : '',
              coal?.members.includes(o) ? 'They are in a coalition against you: all members will join them!' : '',
            ].join(' ');
            const label = `${g.type === 'claim' ? 'Press claims' : g.type === 'coalition' ? 'Coalition war' : 'War of conquest'}: ${g.provinces.map((p) => provName(sim, p)).join(', ')}`;
            return action(label, cons, () => confirmDialog(app, `Declare war on ${def.short}?`, cons, () => app.do(g.type === 'coalition' ? { type: 'coalitionWar', target: o } : { type: 'declareWar', target: o, goal: g })), prob, 'danger');
          }),
        )
      : h('p', { class: 'small muted' }, 'No war goal: we need a claim on their land (fabricate one on a province bordering ours, or on a coast within one sea zone of one of our ports) or a shared border for a war of conquest.');
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
    influenceSection(app, o),
    section(
      'Their situation',
      row('Allies', alliesOf(sim, o).map((a) => sim.world.nationDefs[a].short).join(', ') || 'none'),
      row('Guaranteed by', guarantorsOf(sim, o).map((a) => sim.world.nationDefs[a].short).join(', ') || 'none'),
      row('Trade bloc', blocOf(sim, o)?.name ?? 'none'),
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
          : h('p', { class: 'small muted' }, 'None yet. Fabricate a claim on a province bordering ours or on a coast within one sea zone of one of our ports, or share a border for a war of conquest.'),
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
      `War score (−100…100) = occupation of enemy land − occupation of yours + battles (±${C.war.battleScoreCap}) + war goal (±${C.war.goalScoreCap}). Wars end in a forced white peace after ${C.war.forcedPeaceMonths / 12} years or ${C.war.stalemateMonths / 12} years of stalemate; a side holding ≥90 for a year dictates a settlement for itself and its allies. Peace brings a 5-year truce.`,
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
    mine && me && (me === w.attackerLead || me === w.defenderLead) ? settlementBuilder(app, w) : null,
    mine && me ? peaceBuilder(app, w) : null,
  );
}

const DEMAND_KINDS: DemandKind[] = ['cede', 'gold', 'reparations', 'disarm', 'renounce', 'sphere'];

/**
 * The peace conference: a war leader drafts a settlement for every realm in
 * the war, with demands from the losing side to the winners, shared by their
 * contribution, and sees the other leader's answer before proposing it.
 */
function settlementBuilder(app: App, w: War): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const mySide = sideOf(w, me) === 'attacker' ? w.attackers : w.defenders;
  const theirSide = mySide === w.attackers ? w.defenders : w.attackers;
  const other = me === w.attackerLead ? w.defenderLead : w.attackerLead;
  const draft = (app.ui.settle[w.id] ??= { demands: [], offer: scoreFor(w, me) < -10, kind: 'cede', from: theirSide[0], to: me, province: '', amount: 0 });
  const winners = draft.offer ? theirSide : mySide;
  const losers = draft.offer ? mySide : theirSide;
  draft.demands = draft.demands.filter((d) => winners.includes(d.to) && losers.includes(d.from));
  if (!winners.includes(draft.to)) draft.to = draft.offer ? other : me;
  if (!losers.includes(draft.from)) draft.from = draft.offer ? me : other;
  const redraw = () => renderLedger(app);
  const shares = contributionShares(w, winners);
  const cost = settlementCost(sim, w, draft.demands);
  const ev = draft.demands.length ? evaluateSettlement(sim, w.id, other, draft.demands) : null;
  const counter = ev && !ev.accept && !draft.offer ? counterOffer(sim, w.id, other, draft.demands) : null;
  const prob = draft.demands.length ? checkCommand(sim, { type: 'settle', nation: me, war: w.id, demands: draft.demands }) : 'Add at least one demand.';
  const got: Record<string, number> = {};
  for (const d of draft.demands) got[d.to] = (got[d.to] ?? 0) + demandCost(sim, w, d);
  const modeBtn = (offer: boolean, label: string) =>
    button(label, () => {
      draft.offer = offer;
      draft.demands = [];
      redraw();
    }, { cls: `small ${draft.offer === offer ? 'active' : ''}`, fk: offer ? 'settle-offer' : 'settle-dictate' });
  const sel = (label: string, fk: string, opts: Array<[string, string]>, value: string, set: (v: string) => void) => {
    const el = h('select', { 'aria-label': label, 'data-fk': fk }, opts.map(([v, t]) => h('option', { value: v, selected: v === value ? true : undefined }, t)));
    el.addEventListener('change', () => {
      set(el.value);
      redraw();
    });
    return el;
  };
  // the form for one more demand
  const giverProvs = ownedProvinces(sim, draft.from).sort((a, b) => {
    const oa = winners.includes(sim.state.provinces[a].controller ?? '') ? 0 : 1;
    const ob = winners.includes(sim.state.provinces[b].controller ?? '') ? 0 : 1;
    return oa - ob || sim.state.provinces[b].dev - sim.state.provinces[a].dev || (a < b ? -1 : 1);
  });
  if (draft.kind === 'cede' && !giverProvs.includes(draft.province)) draft.province = giverProvs[0] ?? '';
  if (draft.kind === 'reparations' && ![0.1, 0.2, 0.3].includes(draft.amount)) draft.amount = 0.1;
  const purse = Math.floor(Math.max(0, sim.state.nations[draft.from]?.treasury ?? 0));
  if (draft.kind === 'gold' && (draft.amount < 10 || draft.amount > purse)) draft.amount = Math.min(purse, 100);
  const next: Demand = { kind: draft.kind, from: draft.from, to: draft.to, ...(draft.kind === 'cede' ? { province: draft.province } : {}), ...(draft.kind === 'gold' || draft.kind === 'reparations' ? { amount: draft.amount } : {}) };
  const addProb = checkCommand(sim, { type: 'settle', nation: me, war: w.id, demands: [...draft.demands, next] });
  const amountInput =
    draft.kind === 'gold'
      ? (() => {
          const el = h('input', { type: 'range', min: 0, max: purse, step: 10, value: draft.amount, 'aria-label': 'Crowns', 'data-fk': 'settle-gold' });
          el.addEventListener('change', () => {
            draft.amount = Number(el.value);
            redraw();
          });
          return h('span', { class: 'row' }, el, h('span', { class: 'small' }, `${draft.amount} crowns`));
        })()
      : draft.kind === 'reparations'
        ? sel('Share of income', 'settle-share', [['0.1', '10% of income'], ['0.2', '20% of income'], ['0.3', '30% of income']], String(draft.amount), (v) => (draft.amount = Number(v)))
        : draft.kind === 'cede'
          ? sel('Province', 'settle-province', giverProvs.map((p) => [p, `${provName(sim, p)}${winners.includes(sim.state.provinces[p].controller ?? '') ? ' (occupied)' : ''} · ${demandCost(sim, w, { kind: 'cede', from: draft.from, to: draft.to, province: p })}`]), draft.province, (v) => (draft.province = v))
          : null;
  return h(
    'div',
    { class: 'settle', style: 'margin-top:8px;border-top:1px solid var(--line);padding-top:8px', 'data-sk': 'peace-conference' },
    h('h4', null, 'Peace conference'),
    h('p', { class: 'small muted' }, `As war leader we can end the war for every realm in it. Each demand is paid by a realm on the losing side to one on the winning side. The winners' contribution (battles won, enemy land held) sets their fair share; an ally given less than half its share resents us.`),
    h('div', { class: 'row' }, modeBtn(false, 'We dictate terms'), modeBtn(true, 'We offer terms'), !draft.offer ? button('Suggest terms', () => {
      draft.demands = buildSettlement(sim, w.id, me);
      redraw();
    }, { cls: 'small quiet', fk: 'settle-suggest', disabled: scoreFor(w, me) < 5 ? 'We are not winning.' : null }) : null),
    h(
      'table',
      { class: 'mini' },
      h('tr', null, h('th', null, draft.offer ? 'They receive' : 'We and our allies'), h('th', null, 'Contribution'), h('th', null, 'Fair share'), h('th', null, 'In this draft')),
      winners.map((n) => h('tr', null, h('td', null, shield(app, n), ' ', nationName(sim, n)), h('td', null, `${Math.round(shares[n] * 100)}%`), h('td', null, String(Math.round(shares[n] * cost))), h('td', { class: (got[n] ?? 0) < shares[n] * cost * C.settlement.resent && n !== (draft.offer ? other : me) ? 'bad' : '' }, String(got[n] ?? 0)))),
    ),
    draft.demands.length
      ? h(
          'ul',
          { class: 'demand-list' },
          draft.demands.map((d, i) =>
            h(
              'li',
              null,
              h('span', { class: 'grow' }, describeDemand(sim, d), h('span', { class: 'small faint' }, ` (${demandCost(sim, w, d)})`)),
              button('Remove', () => {
                draft.demands = draft.demands.filter((_, j) => j !== i);
                redraw();
              }, { cls: 'small quiet', fk: `settle-remove-${i}` }),
            ),
          ),
        )
      : h('p', { class: 'small muted' }, 'No demands yet.'),
    h(
      'div',
      { class: 'row', style: 'flex-wrap:wrap;gap:6px' },
      sel('Demand', 'settle-kind', DEMAND_KINDS.map((k) => [k, DEMAND_LABELS[k]]), draft.kind, (v) => (draft.kind = v as DemandKind)),
      sel('From', 'settle-from', losers.map((n) => [n, `from ${nationName(sim, n)}`]), draft.from, (v) => (draft.from = v)),
      sel('To', 'settle-to', winners.map((n) => [n, `to ${nationName(sim, n)}`]), draft.to, (v) => (draft.to = v)),
      amountInput,
      button('Add demand', () => {
        draft.demands = [...draft.demands, next];
        redraw();
      }, { cls: 'small', fk: 'settle-add', disabled: addProb }),
    ),
    row('Value of the settlement', `${cost} war-score points (war score ${signed(scoreFor(w, me), 0)} in our view)`),
    ev ? row(`${nationName(sim, other)}'s answer`, h('b', { class: ev.accept ? 'good' : 'bad' }, `${ev.accept ? 'Would accept' : 'Would refuse'} (${signed(ev.score, 0)})`)) : null,
    ev ? h('details', null, h('summary', { class: 'small muted' }, 'Why?'), reasonsList(ev.reasons)) : null,
    counter
      ? h(
          'div',
          { class: 'callout' },
          h('span', { class: 'grow small' }, `They would accept ${counter.length} of these ${draft.demands.length} demands: ${counter.map((d) => describeDemand(sim, d)).join('; ')}.`),
          button('Use their terms', () => {
            draft.demands = counter;
            redraw();
          }, { cls: 'small', fk: 'settle-counter' }),
        )
      : ev && !ev.accept && !draft.offer
        ? h('p', { class: 'small bad' }, 'They would rather fight on than accept any part of this.')
        : null,
    action('Propose settlement', 'An accepted settlement ends the war for everyone at once.', () => {
      const r = app.do({ type: 'settle', war: w.id, demands: draft.demands });
      if (r.ok) delete app.ui.settle[w.id];
    }, prob),
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
    h('h4', null, me === w.attackerLead || me === w.defenderLead ? 'White peace or a separate peace' : 'Negotiate peace'),
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
  return h('p', { class: 'small warn', style: 'margin-top:6px' }, `How to stop ${name}: ${text} A month in which the condition fails pauses their timer; every further month in a row costs them 6 months of progress.`);
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
    diplomatic: `Influence over partners whose opinion of you is ≥${C.victory.diplomaticOpinion}: an alliance at least ${C.victory.diplomaticTreatyAge / 12} years old or a realm in your sphere 2, your guarantee (a year old) 1, plus a trade agreement at least ${C.victory.diplomaticTreatyAge / 12} years old 1 — ${victoryRules(sim).diplomaticInfluencePerRealm} per other surviving realm; trust ≥${C.victory.diplomaticTrust}; no offensive war — for ${VICTORY_MONTHS.diplomatic} months.`,
  };
  // one evaluation per realm serves all three path cards
  const progress = new Map(alive.map((n) => [n, victoryProgress(sim, n)]));
  const mine = me ? (progress.get(me) ?? victoryProgress(sim, me)) : null;
  const infl = me ? influenceByPartner(sim, me) : {};
  return h(
    'div',
    null,
    h('p', null, `The campaign ends in ${dateOf(sim, endTick(sim)).short}. A timer pauses the first month its condition fails, then loses ${C.victory.streakDecay} months for every further month in a row — unless the realm is within ${Math.round((1 - C.victory.nearMiss) * 100)}% of the main measure with every other condition met, when it stays paused. Every realm, AI or not, can win.`),
    h(
      'div',
      { class: 'cols' },
      paths.map((k) =>
        h(
          'div',
          { class: 'card' },
          h('h3', null, VICTORY_LABELS[k]),
          h('p', { class: 'small muted' }, desc[k]),
          mine ? h('div', null, ...mine[k].lines.map((l) => h('p', { class: 'small' }, l)), row('Held', `${mine[k].streak}/${mine[k].required} months${mine[k].near ? ' · paused, just short' : ''}`), bar(mine[k].streak, mine[k].required, mine[k].met ? 'good' : 'warn')) : null,
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
    sec('Controls', 'Click / tap: select a province or army. Drag: pan. Wheel / pinch: zoom. Right-click, long-press, or “Set destination” (G): move the selected army.', 'Space: pause. 1–4: speed. B, I, M, T, P, D, W, V, L, H: ledgers. Shift+1…9: map modes (political, terrain, supply, economy, frontier, diplomacy, military, resources, sea control); O cycles them. N: next army. Home: capital. Esc: close / deselect.'),
    sec('The loop', 'Read the world → choose a priority → commit crowns, materiel, resources and men → watch the consequences → adapt. Orders persist until completed or invalidated. The game is paused whenever a decision needs you (configurable in Settings).'),
    sec('Frontier integration', 'Every province has integration 0–100. Low integration means little tax, few recruits, no development, no supply source and more unrest. New conquests start at 10 (25 with a claim), settled land at 20. Roads, garrisons, claims, charters and the Frontier Settlement focus speed it up; too much raw frontier at once overextends your administration.'),
    sec('Economy', 'Crowns come from development and population (scaled by integration and unrest), from trade and from surplus manufactured goods; armies, forts, envoys and research funding cost upkeep. Food feeds armies on supply lines. Deposits yield coal, iron, oil, rubber and nitrates; factories burn coal to make materiel, which equips and reinforces regiments. Trade agreements move surplus resources to partners who need them at fixed prices. Running short of a resource has a named effect shown on the Industry ledger (I). The manpower pool refills from the military reserve, which men under arms already use.'),
    sec('War', 'Declare war with a claim (no trust cost) or a conquest goal (costs trust, alarms neighbours). Battles: terrain, forts, entrenchment, supply, composition, morale and technology decide; forecasts show three outcomes. Winning a battle does not take land — standing in a province besieges it. Peace uses war score; every choice shows whether the enemy would accept and why.'),
    sec(
      'Navy and air',
      'The seas are divided into zones. Fleets sail between zones (select one, then right-click a zone, or press G). Ships are built in ports; each port level is a slipway. Hostile fleets meeting in a zone fight: guns hit surface ships, submarines torpedo big ships and only torpedo boats and cruisers can hunt them, carriers strike from the air.',
      'Enemy warships that outgun ours in a zone close the straits it commands to our armies and supply. Where every zone on a coast holds enemy warships, that coast is blockaded: it loses a quarter of its crowns and its sea trade.',
      'Transports carry two regiments each: select an army on a coast with a fleet offshore and choose “Ship by sea”. Troops landing on an enemy coast fight at a disadvantage that week.',
      'With Aviation, build airfields and raise air wings. Missions: superiority (fighters), ground support, interdiction of enemy supply and movement, strategic bombing of factories, and reconnaissance. Whoever holds 1.5× the enemy’s air power over a province holds the sky there.',
    ),
    sec('Diplomacy', 'Envoys raise opinion. Pacts forbid war; trade agreements exchange surplus resources and earn commerce; alliances are defensive calls to arms. Proposals show the other side’s reasoning before you send them. Rapid conquest raises alarm, and so does a visible bid for territorial or economic victory; alarmed neighbours form coalitions. A bid for diplomatic leadership instead makes rivals wary (lower opinion) and may cost you their trade.'),
    sec(
      'Peace settlements',
      'A war leader can end a war for everyone in it with a settlement (Wars & Peace → Peace conference). Each demand is paid by a realm on the losing side to one on the winning side: a province, crowns, reparations (10–30% of income for five years), disarmament (half the army for five years, no battleships or carriers), renouncing claims (and no war on the receiver for ten years), or entering the receiver’s sphere.',
      'Every demand has a cost in war-score points; the other leader accepts when the war has gone badly enough for it, weighing demands on its allies at 60%. If it refuses, the conference shows the part it would accept. Offered a settlement yourself, untick demands to send a counter-offer.',
      'The winners’ contribution — battles won, casualties inflicted, ships sunk, enemy land held — sets each one’s fair share of the spoils. An ally given less than half its share resents its leader; a claim handed to someone else is resented too. A side that holds a war score of 90 for a year dictates a settlement.',
    ),
    sec(
      'Influence, guarantees, loans and trade blocs',
      'Influence (0–100) is what you hold over another realm. Envoys, trade agreements (for the larger economy), loans, guarantees, alliances (for the stronger partner) and leading their trade bloc build it each month; it fades slowly, and fast in war. A smaller realm over which you hold 40 influence, and 1.25× any rival’s, is in your sphere: it thinks better of you, will not ally or join a coalition against you, and you defend it when it is attacked. Each realm in your sphere counts 2 toward Diplomatic Leadership.',
      'A guarantee of independence calls you to arms when that realm is attacked; refusing ends it and costs trust. Focuses add guarantees. A loan (at least 50 crowns) is repaid over two years with 20% interest and buys influence; war repudiates it.',
      'A trade bloc is founded with a trade partner and led by its founder (up to six members). Members buy from each other 20% cheaper, earn 50% more commerce from each other, and share the crowns blockades cost any member.',
    ),
    sec(
      'National focus',
      'The Focus ledger (P) holds your realm’s tree: a national branch made for it from the map (claims on neighbouring regions, its home region, its deposits, its coast, and an ambition that follows its temperament), and generic branches for industry, the army, sea and air, diplomacy and the state. Work on one focus at a time; a finished focus is permanent, and some exclude others. Switching loses the work done.',
    ),
    sec('Saves', 'The game autosaves every few months (Settings) and when the tab is hidden. Saves live in this browser only: they do not sync across devices or sites and can be erased by private browsing or managed-device policies. Use Menu → Export to keep a copy, and Import to restore it.'),
    sec('Fog of war', 'All information is public for everyone — AI realms see exactly what you see and follow the same rules, costs and formulas.'),
  );
}
