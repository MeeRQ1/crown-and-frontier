// Modal ledgers opened from the navigation bar.

import { C, UNITS } from '../../sim/config';
import { PERSONALITIES } from '../../sim/data/personalities';
import { POLICIES, POLICY_COOLDOWN_MONTHS, POLICY_LIST } from '../../sim/data/policies';
import { BRANCHES, TECH_LIST, TECHS, type Branch } from '../../sim/data/techs';
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
import { debtStage, grossIncome, manpowerRegen, menServing, poolCap, provinceCrowns, reserveCap, stockpileCap } from '../../sim/economy';
import { checkCommand } from '../../sim/commands';
import { adminCapacity, frontierLoad, overextension } from '../../sim/integration';
import { maxMorale, nationStrength } from '../../sim/military';
import { describeEffects } from '../../sim/modifiers';
import { policyProblem, policySwitchCost, researchProblem, researchRate } from '../../sim/progression';
import { fnv1a } from '../../sim/save';
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
  truceUntil,
  warsOf,
} from '../../sim/state';
import { armySupplyInfo } from '../../sim/supply';
import type { NationId, PeaceTerms, TreatyType, War } from '../../sim/types';
import { allScores, dominatedRegions, influence, influenceByPartner, influenceNeeded, SCORE_FORMULA, VICTORY_LABELS, VICTORY_MONTHS, victoryProgress } from '../../sim/victory';
import { computeWarScore, evaluatePeace, goalOptions, provinceCost, scoreFor, termsCost, declareWarProblem } from '../../sim/war';
import type { App } from '../app';
import { action, bar, button, h, rebuild, row, setChildren } from '../dom';
import { fmt, men, signed } from '../format';
import { downloadText } from '../storage';
import { confirmDialog } from './dialogs';
import { shield } from './common';
import { icon } from '../icons';

export type LedgerTab = 'realm' | 'military' | 'research' | 'policy' | 'diplomacy' | 'wars' | 'victory' | 'log' | 'help';

const TITLES: Record<LedgerTab, string> = {
  realm: 'Realm & Budget',
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
        h('h3', null, 'Supplies'),
        ...list(l.suppliesIn),
        ...list(l.suppliesOut),
        row(h('b', null, 'Net'), h('b', { class: l.netSupplies >= 0 ? 'good' : 'bad' }, signed(l.netSupplies))),
        row('Stockpile', `${fmt(n.supplies)} / ${fmt(stockpileCap(sim, pid))}`),
        bar(n.supplies, stockpileCap(sim, pid), n.supplies > 0 ? 'good' : 'bad', 'Stockpile'),
        h('p', { class: 'small muted' }, 'Armies within supply range draw from the stockpile; cut-off armies forage (at most “strained”). Grain provinces add 3 per month.'),
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
          : h('p', { class: 'small muted' }, 'Conquered and settled provinces add frontier load until integrated. Charters, roads, garrisons and the Frontier Settlement policy speed integration.'),
        h('h3', { style: 'margin-top:10px' }, 'Research funding'),
        funding,
        h('p', { class: 'small muted' }, `Research: ${researchRate(sim, pid).toFixed(2)} points/month. Funding costs a share of gross income (${fmt(grossIncome(l), 1)}).`),
      ),
    ),
    h('h3', { style: 'margin-top:14px' }, 'Provinces'),
    h(
      'table',
      { class: 'data' },
      h('thead', null, h('tr', null, ['Province', 'Dev', 'Roads', 'Fort', 'Integration', 'Unrest', 'Crowns/mo', 'Project'].map((t) => h('th', null, t)))),
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
            h('td', { class: s.integration < 40 ? 'bad' : s.integration < 75 ? 'warn' : '' }, String(Math.floor(s.integration))),
            h('td', { class: s.unrest >= 60 ? 'bad' : '' }, String(Math.round(s.unrest))),
            h('td', null, fmt(provinceCrowns(sim, p), 1)),
            h('td', null, s.project ? `${s.project.kind} ${s.project.progress}/${s.project.total}` : '—'),
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

// ───────────────────────────── Military ─────────────────────────────────────

function militaryLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return noRealm();
  const armies = armiesOf(sim, pid).sort((a, b) => (a.id < b.id ? -1 : 1));
  const mm = maxMorale(sim, pid);
  const training = sim.world.provIds.flatMap((p) => sim.state.provinces[p].recruits.filter((r) => r.nation === pid).map((r) => `${UNITS[r.unit].label} at ${provName(sim, p)} (${r.weeksLeft} wk)`));
  return h(
    'div',
    null,
    h(
      'table',
      { class: 'data' },
      h('thead', null, h('tr', null, ['Army', 'Location', 'Foot/Horse/Guns', 'Men', 'Morale', 'Supply', 'Status'].map((t) => h('th', null, t)))),
      h(
        'tbody',
        null,
        armies.length
          ? armies.map((a) => {
              const c = (t: string) => a.regiments.filter((r) => r.type === t).length;
              const sup = armySupplyInfo(sim, a, true);
              const status = a.battle ? '⚔ battle' : a.retreating ? 'retreating' : a.path.length ? `→ ${provName(sim, a.path[a.path.length - 1])}` : 'holding';
              const tr = h(
                'tr',
                { class: 'clickable' },
                h('td', null, a.name),
                h('td', null, provName(sim, a.location)),
                h('td', null, `${c('foot')}/${c('horse')}/${c('guns')}`),
                h('td', null, men(menOf(a))),
                h('td', { class: a.morale / mm < 0.4 ? 'bad' : '' }, `${Math.round((a.morale / mm) * 100)}%`),
                h('td', { class: sup.status === 'supplied' ? 'good' : sup.status === 'strained' ? 'warn' : 'bad' }, sup.status),
                h('td', null, status),
              );
              tr.addEventListener('click', () => {
                app.closeLedger();
                app.selectArmy(a.id, true);
              });
              return tr;
            })
          : h('tr', null, h('td', { colspan: 7, class: 'muted' }, 'No armies. Raise regiments from a province panel.')),
      ),
    ),
    h('p', { class: 'small' }, training.length ? `In training: ${training.join('; ')}` : 'No regiments in training.'),
    h('h3', { style: 'margin-top:12px' }, 'Regiment types'),
    h(
      'div',
      { class: 'cols' },
      (['foot', 'horse', 'guns'] as const).map((t) =>
        h(
          'div',
          { class: 'card' },
          h('h4', null, UNITS[t].label),
          h('p', { class: 'small' }, UNITS[t].role),
          row('Cost', `${UNITS[t].cost} crowns, ${UNITS[t].supplies} supplies, 1,000 men`),
          row('Upkeep / month', `${UNITS[t].upkeep} crowns, ${UNITS[t].supplyUse} supplies`),
          row('Firepower', `${UNITS[t].attack}× (morale shock ${UNITS[t].morale}×)`),
          row('Speed', `${UNITS[t].speed}`),
        ),
      ),
    ),
    h('p', { class: 'small muted' }, 'Terrain limits how many regiments can fight at once (frontage). Horse gain +20–30% on plains and steppe and lose up to 50% in mountains; ≥20% horse on open ground flanks for +15%. Guns fire at half effect without an infantry screen and speed sieges.'),
  );
}

// ───────────────────────────── Research ─────────────────────────────────────

function researchLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return noRealm();
  const n = sim.state.nations[pid];
  const rate = researchRate(sim, pid);
  const cur = n.research.current ? TECHS[n.research.current] : null;
  const col = (b: Branch) =>
    h(
      'div',
      { class: 'tech-col' },
      h('h3', null, BRANCHES[b].name),
      h('p', { class: 'small muted' }, BRANCHES[b].blurb),
      TECH_LIST.filter((t) => t.branch === b).map((t) => {
        const done = n.research.done.includes(t.id);
        const current = n.research.current === t.id;
        const prob = researchProblem(sim, pid, t.id);
        const locked = !done && t.requires.some((r) => !n.research.done.includes(r));
        const card = h(
          'div',
          { class: `card ${done ? 'done' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''}`, style: 'margin:6px 0' },
          h('h4', null, t.name, ' ', h('span', { class: 'tag' }, `Tier ${t.tier} · ${t.cost} pts`)),
          h('p', { class: 'small' }, describeEffects(t.effects).join(' · ')),
          h('p', { class: 'small muted' }, t.description),
          t.requires.length ? h('p', { class: 'small muted' }, `Requires ${t.requires.map((r) => TECHS[r].name).join(', ')}`) : null,
          done ? h('span', { class: 'tag good' }, 'Researched') : current ? h('div', null, bar(n.research.progress, t.cost, 'info'), h('span', { class: 'small' }, `${Math.floor(n.research.progress)}/${t.cost} · ~${Math.max(0, Math.ceil((t.cost - n.research.progress) / Math.max(0.1, rate)))} months`)) : action('Research this', `~${Math.ceil(t.cost / Math.max(0.1, rate))} months at the current rate`, () => app.do({ type: 'research', tech: t.id }), prob),
        );
        return card;
      }),
    );
  return h(
    'div',
    null,
    h('p', null, `Research rate: `, h('b', null, `${rate.toFixed(2)} points/month`), ` — from integrated development, funding (Realm ledger) and modifiers. `, cur ? `Researching ${cur.name}.` : h('span', { class: 'warn' }, 'Nothing selected: up to 60 points are banked.')),
    h('p', { class: 'small muted' }, 'Progress is kept when switching. Researching everything takes most of a long campaign — specialise.'),
    h('div', { class: 'cols' }, col('arms'), col('statecraft'), col('civics')),
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

function diplomacyLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  if (!me) return noRealm();
  const others = aliveNations(sim).filter((n) => n !== me);
  if (!app.ui.diploTarget || !others.includes(app.ui.diploTarget)) app.ui.diploTarget = others[0] ?? null;
  const target = app.ui.diploTarget;
  const myStr = Math.max(0.1, nationStrength(sim, me));
  const table = h(
    'table',
    { class: 'data' },
    h('thead', null, h('tr', null, ['Realm', 'Relation', 'Their opinion', 'Their alarm', 'Strength', 'Temperament'].map((t) => h('th', null, t)))),
    h(
      'tbody',
      null,
      others.map((o) => {
        const tr = h(
          'tr',
          { class: 'clickable', style: o === target ? 'background:rgba(216,179,106,0.12)' : '' },
          h('td', null, shield(app, o), ' ', nationName(sim, o)),
          h('td', null, relationTag(app, o)),
          h('td', { class: opinion(sim, o, me) >= 0 ? 'good' : 'bad' }, signed(opinion(sim, o, me), 0)),
          h('td', { class: (sim.state.alarm[o]?.[me] ?? 0) >= 35 ? 'bad' : '' }, String(Math.round(sim.state.alarm[o]?.[me] ?? 0))),
          h('td', null, `${(nationStrength(sim, o) / myStr).toFixed(1)}×`),
          h('td', { class: 'small muted' }, PERSONALITIES[sim.state.nations[o].ai.personality].label),
        );
        tr.addEventListener('click', () => {
          app.ui.diploTarget = o;
          renderLedger(app);
        });
        return tr;
      }),
    ),
  );
  const envoysUsed = sim.state.envoys.filter((e) => e.from === me).length;
  const coal = coalitionAgainst(sim, me);
  return h(
    'div',
    null,
    h('p', { class: 'small' }, `Envoys: ${envoysUsed}/${envoySlots(sim, me)} · Trust: ${Math.round(sim.state.nations[me].trust)} · Allies: ${alliesOf(sim, me).map((a) => nationName(sim, a)).join(', ') || 'none'}`),
    coal ? h('p', { class: 'bad small' }, `Coalition against you: ${coal.members.map((m) => nationName(sim, m)).join(', ')}. If you attack any member, all join; they may attack together.`) : null,
    h('div', { class: 'cols', style: 'grid-template-columns: minmax(300px, 1.1fr) minmax(300px, 1fr)' }, h('div', null, table), target ? nationDetail(app, target) : h('div')),
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
      { class: 'card', style: 'margin:6px 0' },
      action(`Propose ${TREATY_LABELS[t].toLowerCase()}`, h('span', null, likely), () => app.do({ type: 'propose', target: o, treaty: t }), prob),
      prob ? null : h('details', null, h('summary', { class: 'small muted' }, 'Why?'), reasonsList(ev.reasons)),
    );
  };
  const envoyHere = st.envoys.find((e) => e.from === me && e.to === o);
  const goals = goalOptions(sim, me, o);
  const warBlock = atWar(sim, me, o)
    ? h('p', { class: 'bad' }, 'You are at war. Make peace from the Wars ledger.')
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
              coal?.members.includes(o) ? 'They are in a coalition against you — all members will join them!' : '',
            ].join(' ');
            const label = `${g.type === 'claim' ? 'Press claims' : g.type === 'coalition' ? 'Coalition war' : 'War of conquest'}: ${g.provinces.map((p) => provName(sim, p)).join(', ')}`;
            return action(label, cons, () =>
              confirmDialog(app, `Declare war on ${def.short}?`, cons, () => app.do(g.type === 'coalition' ? { type: 'coalitionWar', target: o } : { type: 'declareWar', target: o, goal: g })), prob, 'danger');
          }),
        )
      : h('p', { class: 'small muted' }, 'No war goal: you need a claim on their land (fabricate one from a bordering province) or a shared border for a war of conquest.');
  const coalAgainstThem = coalitionAgainst(sim, o);
  const myAlarm = st.alarm[me]?.[o] ?? 0;
  return h(
    'div',
    { class: 'card' },
    h('h3', null, shield(app, o), ' ', def.name),
    h('p', { class: 'small muted' }, def.summary),
    h('p', { class: 'small' }, `Allies: ${alliesOf(sim, o).map((a) => nationName(sim, a)).join(', ') || 'none'} · Wars: ${warsOf(sim, o).map((w) => w.name).join(', ') || 'none'} · Provinces: ${ownedProvinces(sim, o).length} · Trust ${Math.round(st.nations[o].trust)}`),
    claimsOn(sim, me, o).length ? h('p', { class: 'small' }, `Our claims on them: ${claimsOn(sim, me, o).map((p) => provName(sim, p)).join(', ')}`) : null,
    h('h4', null, `Their opinion of us: ${signed(opinion(sim, o, me), 0)}`),
    reasonsList(parts),
    h('div', { class: 'sep' }),
    envoyHere
      ? action('Recall envoy', `Envoy at their court until ${dateOf(sim, envoyHere.until).short} (+${C.diplomacy.envoyGain}/month opinion, up to ${C.diplomacy.envoyCap}).`, () => app.do({ type: 'recallEnvoy', target: o }), null)
      : action('Send envoy', `${C.diplomacy.envoyCost} crowns/month for 12 months: +${C.diplomacy.envoyGain} opinion each month (up to ${C.diplomacy.envoyCap}).`, () => app.do({ type: 'envoy', target: o }), envoyProblem(sim, me, o)),
    treaty('trade'),
    treaty('nap'),
    treaty('alliance'),
    h('h4', { style: 'margin-top:10px' }, 'Coalition'),
    coalAgainstThem?.members.includes(me)
      ? action('Leave coalition', `Members: ${coalAgainstThem.members.map((m) => nationName(sim, m)).join(', ')}`, () => app.do({ type: 'leaveCoalition', target: o }), null)
      : action(`Join coalition against ${def.short}`, `Our alarm about them: ${Math.round(myAlarm)} (needs ${C.diplomacy.alarmCoalition}). Members defend each other against them.`, () => app.do({ type: 'joinCoalition', target: o }), joinCoalitionProblem(sim, me, o)),
    h('h4', { style: 'margin-top:10px' }, 'War'),
    warBlock,
  );
}

// ───────────────────────────── Wars ─────────────────────────────────────────

function warsLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const mine = me ? warsOf(sim, me) : [];
  const others = Object.values(sim.state.wars).filter((w) => !mine.includes(w));
  return h(
    'div',
    null,
    mine.length ? mine.map((w) => warCard(app, w, true)) : h('p', { class: 'muted' }, 'You are at peace.'),
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
    territorial: `Own and control ≥75% of the provinces in ${C.victory.territorialRegions} regions and ≥${Math.round(C.victory.territorialShare * 100)}% of all provinces, then hold it for ${VICTORY_MONTHS.territorial} months.`,
    economic: `Integrated development (dev of provinces at integration ≥75) of ≥${Math.round(C.victory.economicShare * 100)}% of the world's, with average unrest ≤${C.victory.economicUnrest}, no debt or bankruptcy and none of your land occupied — for ${VICTORY_MONTHS.economic} months.`,
    diplomatic: `Influence from treaties at least ${C.victory.diplomaticTreatyAge / 12} years old with partners whose opinion of you is ≥${C.victory.diplomaticOpinion} (alliance 2, trade 1): ${C.victory.diplomaticInfluencePerRealm} per other surviving realm; trust ≥${C.victory.diplomaticTrust}; no offensive war — for ${VICTORY_MONTHS.diplomatic} months.`,
  };
  const mine = me ? victoryProgress(sim, me) : null;
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
            .map((n) => ({ n, p: victoryProgress(sim, n)[k] }))
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
    const report = {
      game: 'crown-and-frontier',
      build: import.meta.env?.MODE ?? 'unknown',
      userAgent: navigator.userAgent,
      scenario: st.scenarioId,
      settings: st.settings,
      tick: st.tick,
      date: dateOf(sim).label,
      stateChecksum: fnv1a(JSON.stringify(st)),
      playerCommands: st.playerLog,
      recentNotifications: st.notifications.slice(-60),
      aiDiagnostics: st.diagnostics.slice(-150),
      howToReproduce: 'npx tsx tools/replay.ts <this file> — replays playerCommands on a fresh game with these settings and compares stateChecksum.',
    };
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
    sec('Controls', 'Click / tap: select a province or army. Drag: pan. Wheel / pinch: zoom. Right-click, long-press, or “Set destination” (G): move the selected army.', 'Space: pause. 1–4: speed. B, M, T, P, D, W, V, L, H: ledgers. O: cycle map overlays. N: next army. Home: capital. Esc: close / deselect.'),
    sec('The loop', 'Read the world → choose a priority → commit crowns, supplies and men → watch the consequences → adapt. Orders persist until completed or invalidated. The game is paused whenever a decision needs you (configurable in Settings).'),
    sec('Frontier integration', 'Every province has integration 0–100. Low integration means little tax, few recruits, no development, no supply source and more unrest. New conquests start at 10 (25 with a claim), settled land at 20. Roads, garrisons, claims, charters and the Frontier Settlement policy speed it up; too much raw frontier at once overextends your administration.'),
    sec('Economy', 'Crowns come from development and population (scaled by integration and unrest); armies, forts, envoys and research funding cost upkeep. Supplies feed armies on supply lines. The manpower pool refills from the military reserve, which men under arms already use.'),
    sec('War', 'Declare war with a claim (no trust cost) or a conquest goal (costs trust, alarms neighbours). Battles: terrain, forts, entrenchment, supply, composition, morale and technology decide; forecasts show three outcomes. Winning a battle does not take land — standing in a province besieges it. Peace uses war score; every choice shows whether the enemy would accept and why.'),
    sec('Diplomacy', 'Envoys raise opinion. Pacts forbid war; trade earns crowns; alliances are defensive calls to arms. Proposals show the other side’s reasoning before you send them. Rapid conquest raises alarm, and so does a visible bid for territorial or economic victory; alarmed neighbours form coalitions. A bid for diplomatic leadership instead makes rivals wary (lower opinion) and may cost you their trade.'),
    sec('Saves', 'The game autosaves every few months (Settings) and when the tab is hidden. Saves live in this browser only: they do not sync across devices or sites and can be erased by private browsing or managed-device policies. Use Menu → Export to keep a copy, and Import to restore it.'),
    sec('Fog of war', 'All information is public for everyone — AI realms see exactly what you see and follow the same rules, costs and formulas.'),
  );
}
