// Modal ledgers opened from the navigation bar.

import { C, RESOURCE_INFO, UNITS, UNIT_TYPES } from '../../sim/config';
import { navyAirSection } from './sea';
import { PERSONALITIES } from '../../sim/data/personalities';
import { TECHS } from '../../sim/data/techs';
import { orderStatus, readiness } from '../../sim/readiness';
import { contractsBetween, dependence, monthlyValue, resLabel } from '../../sim/trade';
import { claimsOn, coalitionAgainst, envoyProblem, envoySlots, evaluateTreaty, joinCoalitionProblem, opinion, opinionParts, TREATY_LABELS, treatyProblem } from '../../sim/diplomacy';
import { menServing, reserveCap } from '../../sim/economy';
import { checkCommand } from '../../sim/commands';
import { armyCap, blocOf, evaluateBloc, evaluateLoan, foundBlocProblem, guaranteeProblem, guaranteesBy, guaranteeSlots, guarantorsOf, influenceGain, influenceOver, inviteProblem, joinProblem, loanProblem, sphereMembers, sphereOf } from '../../sim/influence';
import { maxMorale, nationStrength, unitUnlocked } from '../../sim/military';
import { aliveNations, alliesOf, armiesOf, atWar, dateOf, hasTreaty, menOf, nationName, ownedProvinces, provName, sideOf, truceUntil, warsOf } from '../../sim/state';
import { armySupplyInfo } from '../../sim/supply';
import type { Army, Demand, DemandKind, NationId, PeaceTerms, StrategicResource, TreatyType, War } from '../../sim/types';
import { buildSettlement, contributionShares, counterOffer, DEMAND_LABELS, demandCost, describeDemand, evaluateSettlement, settlementCost } from '../../sim/settlement';
import { computeWarScore, evaluatePeace, goalOptions, provinceCost, scoreFor, termsCost, declareWarProblem } from '../../sim/war';
import type { App } from '../app';
import { action, bar, button, h, rebuild, row, setChildren } from '../dom';
import { fmt, men, plural, signed } from '../format';
import { confirmDialog } from './dialogs';
import { section, shield } from './common';
import { icon } from '../icons';
import { emblem, type EmblemName } from '../emblems';
import { industryLedger as industryLedgerNew } from '../ledgers/industry';
import { realmLedger as realmLedgerNew } from '../ledgers/realm';
import { researchLedger as researchLedgerNew } from '../ledgers/research';
import { focusLedger as focusLedgerNew } from '../ledgers/focus';
import { victoryLedger as victoryLedgerNew } from '../ledgers/victory';
import { chronicleLedger } from '../ledgers/chronicle';
import { helpLedger as helpLedgerNew } from '../ledgers/help';

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
const WIDE = new Set<LedgerTab>(['industry', 'research', 'focus']);

const BODIES: Record<LedgerTab, (app: App) => HTMLElement> = {
  realm: realmLedgerNew,
  industry: industryLedgerNew,
  military: militaryLedger,
  research: researchLedgerNew,
  focus: focusLedgerNew,
  diplomacy: diplomacyLedger,
  wars: warsLedger,
  victory: victoryLedgerNew,
  log: chronicleLedger,
  help: helpLedgerNew,
};

function noRealm(): HTMLElement {
  return h('p', { class: 'muted' }, 'Observer mode: no realm of your own.');
}

// ───────────────────────────── Realm ────────────────────────────────────────

// Realm & Budget: src/ui/ledgers/realm.ts

// Industry & Trade: src/ui/ledgers/industry.ts

// ───────────────────────────── Military ─────────────────────────────────────

function armyRow(app: App, a: Army): HTMLElement {
  const sim = app.sim!;
  const mm = maxMorale(sim, a.nation);
  const c = (t: string) => a.regiments.filter((r) => r.type === t).length;
  const sup = armySupplyInfo(sim, a, true);
  const os = orderStatus(sim, a);
  const status = os.state === 'moving' ? `To ${provName(sim, a.path[a.path.length - 1])} · ${os.eta} wk` : os.text;
  const weak = readiness(sim, a).filter((n) => n.tone === 'bad');
  const stalled = os.state === 'pinned' || os.state === 'blocked';
  const el = h(
    'button',
    { class: `army-row ${app.selectedArmy === a.id ? 'selected' : ''}`, type: 'button', 'data-fk': `army-${a.id}` },
    h('span', { class: 'ar-n' }, a.group ? h('span', { class: 'grp' }, String(a.group)) : null, a.name),
    h('span', { class: 'ar-loc' }, provName(sim, a.location)),
    h('span', { class: 'ar-mix', title: UNIT_TYPES.map((t) => `${UNITS[t].abbr} ${UNITS[t].plural}`).join(' · ') }, UNIT_TYPES.filter((t) => c(t)).map((t) => `${c(t)}${UNITS[t].abbr}`).join(' ') || '—'),
    h('span', { class: 'ar-men' }, men(menOf(a))),
    h('span', { class: 'ar-mor' }, bar(a.morale, mm, a.morale / mm > 0.5 ? 'good' : a.morale / mm > 0.25 ? 'warn' : 'bad', 'Morale')),
    h('span', { class: `ar-sup dot ${sup.status}`, title: `Supply: ${sup.status}` }),
    h(
      'span',
      { class: `ar-st ${a.battle || stalled ? 'bad' : a.retreating ? 'warn' : ''}`, title: [...os.reasons, ...weak.map((w) => w.text)].join('\n') || undefined },
      status,
      weak.length ? h('span', { class: 'tag warn', 'aria-label': `${weak.length} readiness warning${weak.length === 1 ? '' : 's'}` }, `${weak.length}!`) : null,
    ),
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
  const stalled = armies.filter((a) => ['pinned', 'blocked'].includes(orderStatus(sim, a).state)).length;
  const cell = (label: string, value: string, cls = '') => h('div', null, h('span', { class: 'k' }, label), h('b', { class: cls }, value));
  const kids: Array<Node | null> = [
    h(
      'div',
      { class: 'strip' },
      cell('Armies', `${armies.length} · ${regs} regiments`),
      cell('Men serving', `${men(menServing(sim, pid))} · reserve ${men(reserveCap(sim, pid))}`),
      cell('Upkeep', `${fmt(upkeep)} cr/mo`),
      cell('Supply', troubled ? `${troubled} short` : 'All supplied', troubled ? 'bad' : 'good'),
      cell('Orders', stalled ? `${stalled} stalled` : 'None stalled', stalled ? 'bad' : ''),
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
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'register unit-table' },
          h('thead', null, h('tr', null, h('th', null, 'Regiment'), h('th', null, 'Role'), h('th', { class: 'r' }, 'Fire'), h('th', { class: 'r' }, 'Shock'), h('th', { class: 'r' }, 'Speed'), h('th', null, 'Cost'), h('th', null, 'Upkeep a month'))),
          h(
            'tbody',
            null,
            UNIT_TYPES.map((t) => {
              const u = UNITS[t];
              const res = Object.entries(u.resources).map(([r, v]) => `${v} ${RESOURCE_INFO[r as StrategicResource].label.toLowerCase()}`);
              const burn = Object.entries(u.burn).map(([r, v]) => `${v} ${RESOURCE_INFO[r as StrategicResource].label.toLowerCase()}${r === 'nitrates' ? ' in war' : ''}`);
              const locked = !unitUnlocked(sim, pid, t);
              return h(
                'tr',
                { class: locked ? 'locked' : '', title: u.description },
                h('td', null, h('b', null, u.label), locked && u.requires ? h('div', { class: 'small muted' }, `needs ${TECHS[u.requires].name}`) : null),
                h('td', { class: 'small' }, u.role),
                h('td', { class: 'r' }, `${u.attack}×`),
                h('td', { class: 'r' }, `${u.morale}×`),
                h('td', { class: 'r' }, String(u.speed)),
                h('td', { class: 'small' }, `${u.cost} cr, ${u.materiel} materiel${res.length ? `, ${res.join(', ')}` : ''}`),
                h('td', { class: 'small' }, `${u.upkeep} cr, ${u.supplyUse} food${burn.length ? `, ${burn.join(', ')}` : ''}`),
              );
            }),
          ),
        ),
      ),
      h('p', { class: 'small muted' }, 'Terrain limits how many regiments fight at once (frontage). Cavalry gains +20–30% on plains and steppe, loses up to 50% in mountains and suffers from enemy machine guns; at least 20% cavalry on open ground flanks for +15%. Artillery and engineers fire at half effect without an infantry screen. Armour breaks through forts and trenches but bogs down in forest, marsh and mountains. Attacking across a river gives the defender +20% (half with engineers).'),
    ),
  );
  return h('div', null, ...kids);
}

// ───────────────────────────── Research ─────────────────────────────────────

// Research: src/ui/ledgers/research.ts

// ───────────────────────────── National focus ───────────────────────────────

// National Focus: src/ui/ledgers/focus.ts

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

/**
 * Trade between us and another realm: the contracts in force, how much each side
 * depends on the other for a good, and what a war would end.
 */
function economicTies(app: App, o: NationId): { section: HTMLElement; summary: { value: string; note: string } | null; war: string } {
  const sim = app.sim!;
  const me = app.player!;
  const list = contractsBetween(sim, me, o);
  const ours = dependence(sim, me).filter((d) => d.partner === o && d.share >= 0.05);
  const theirs = dependence(sim, o).filter((d) => d.partner === me && d.share >= 0.05);
  const name = sim.world.nationDefs[o].short;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const sells = list.filter((c) => c.seller === me);
  const buys = list.filter((c) => c.buyer === me);
  const value = (cs: typeof list) => cs.reduce((a, c) => a + monthlyValue(c), 0);
  const rows = list.map((c) =>
    h(
      'tr',
      null,
      h('td', null, c.seller === me ? 'We sell' : 'We buy'),
      h('td', null, resLabel(c.res)),
      h('td', { class: 'r' }, `${c.qty}/mo`),
      h('td', { class: 'r' }, `${c.price.toFixed(2)} cr`),
      h('td', { class: 'r' }, dateOf(sim, c.until).short),
    ),
  );
  const dep = [
    ...ours.map((d) => h('li', { class: d.share >= C.trade.dependence ? 'warn' : '' }, `We get ${pct(d.share)} of our ${resLabel(d.res).toLowerCase()} from ${name}${d.share >= C.trade.dependence ? ': a dependence' : ''}.`)),
    ...theirs.map((d) => h('li', null, `${name} gets ${pct(d.share)} of its ${resLabel(d.res).toLowerCase()} from us${d.share >= C.trade.dependence ? ': they depend on us' : ''}.`)),
  ];
  const tradeOk = hasTreaty(sim, 'trade', me, o);
  const section_ = section(
    'Trade between us',
    list.length
      ? h('table', { class: 'register compact' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Good'), h('th', { class: 'r' }, 'Amount'), h('th', { class: 'r' }, 'Price'), h('th', { class: 'r' }, 'Until'))), h('tbody', null, rows))
      : h('p', { class: 'small muted' }, tradeOk ? 'No contracts between us yet. Draft one in Industry & Trade.' : 'No trade agreement: contracts need one first.'),
    dep.length ? h('ul', { class: 'notes small' }, dep) : null,
    list.length || tradeOk ? button('Open Industry & Trade', () => app.openLedger('industry'), { cls: 'small quiet', icon: 'trade' }) : null,
  );
  const summary = list.length ? { value: `${list.length} contract${list.length === 1 ? '' : 's'}`, note: `we sell ${value(sells).toFixed(1)}, buy ${value(buys).toFixed(1)} crowns a month` } : null;
  const war = list.length
    ? `War ends our ${list.length} contract${list.length === 1 ? '' : 's'} with them at once; goods under way go back unpaid${buys.length ? `, and we lose ${buys.map((c) => `${c.qty} ${resLabel(c.res).toLowerCase()}`).join(' and ')} a month${ours.some((d) => d.share >= C.trade.dependence) ? ` (${ours.filter((d) => d.share >= C.trade.dependence).map((d) => `${pct(d.share)} of our ${resLabel(d.res).toLowerCase()}`).join(', ')})` : ''}` : ''}.`
    : '';
  return { section: section_, summary, war };
}

function nationDetail(app: App, o: NationId): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const st = sim.state;
  const def = sim.world.nationDefs[o];
  const ties = economicTies(app, o);
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
              ties.war,
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
  const brief = (label: string, value: string, cls: string, note: string) => h('tr', null, h('th', { scope: 'row' }, label), h('td', { class: `r ${cls}` }, value), h('td', { class: 'small muted' }, note));
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
      'table',
      { class: 'register briefing', 'data-sk': 'briefing' },
      h(
        'tbody',
        null,
        brief('Their opinion of us', signed(op, 0), op >= 0 ? 'good' : 'bad', 'treaties and their acceptance depend on it'),
        brief('Their alarm about us', String(Math.round(theirAlarm)), theirAlarm >= C.diplomacy.alarmCoalition ? 'bad' : theirAlarm >= C.diplomacy.alarmCoalition * 0.6 ? 'warn' : '', `at ${C.diplomacy.alarmCoalition} they may join a coalition against us`),
        brief('Their trust', String(Math.round(st.nations[o].trust)), '', 'their record for keeping agreements'),
        brief('Their strength', `${ratio.toFixed(1)}× ours`, ratio > 1.3 ? 'bad' : ratio < 0.77 ? 'good' : '', 'armies, fleets and wings, weighed alike for every realm'),
        ties.summary ? brief('Trade between us', ties.summary.value, '', ties.summary.note) : null,
      ),
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
    ties.section,
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
      h('div', { class: 'callout good' }, icon('pact'), 'We are at peace. Below are grounds for war we hold, not wars: nothing starts until a war is declared from Diplomacy.'),
      section(
        'Grounds for war we hold',
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

/**
 * A war as a campaign briefing: the sides, what is being fought for and who
 * holds it now, the war score in its components, what it has cost and when
 * the war will be forced to end; then, for the realms in it, the peace tools.
 */
function warCard(app: App, w: War, mine: boolean): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const me = app.player;
  const b = computeWarScore(sim, w);
  const side = me && mine ? sideOf(w, me) : null;
  const sign = side === 'defender' ? -1 : 1;
  const my = me && mine ? scoreFor(w, me) : w.score;
  const age = Math.floor((st.tick - w.startTick) / 4);
  const sideList = (arr: string[]) => h('span', { class: 'side-list' }, arr.map((n) => h('span', null, shield(app, n), ' ', nationName(sim, n))));
  const us = side === 'defender' ? w.defenders : w.attackers;
  const them = side === 'defender' ? w.attackers : w.defenders;
  // the goal, province by province, with who holds it now
  const goal = h(
    'ul',
    { class: 'goal-list' },
    w.goal.provinces.map((p) => {
      const c = st.provinces[p].controller;
      const ours = !!c && us.includes(c);
      return h('li', null, h('button', { type: 'button', class: 'linkish', onclick: () => (app.closeLedger(), app.selectProvince(p, true)) }, provName(sim, p)), h('span', { class: `small ${mine ? (ours ? 'good' : 'muted') : 'muted'}` }, ` held by ${c ? sim.world.nationDefs[c].short : 'no one'}`));
    }),
  );
  // battles in this war between its sides
  const inWar = (n: NationId) => w.attackers.includes(n) || w.defenders.includes(n);
  const reports = st.reports.filter((r) => r.tick >= w.startTick && r.attackerNations.some(inWar) && r.defenderNations.some(inWar) && (!side || [...r.attackerNations, ...r.defenderNations].some((n) => us.includes(n))));
  const won = side ? reports.filter((r) => (r.winner === 'attacker' ? r.attackerNations : r.defenderNations).some((n) => us.includes(n))).length : 0;
  const forcedIn = Math.max(0, C.war.forcedPeaceMonths - age);
  const stalemateIn = Math.max(0, C.war.stalemateMonths - w.stalemateMonths);
  const comp = (label: string, v: number, note: string) => h('tr', null, h('td', null, label), h('td', { class: `r ${v * sign > 0 ? 'good' : v * sign < 0 ? 'bad' : ''}` }, signed(v * sign, 0)), h('td', { class: 'small muted' }, note));
  return h(
    'section',
    { class: `war-brief ${mine ? 'mine' : ''}`, 'data-sk': `war-${w.id}` },
    h(
      'header',
      { class: 'route-head' },
      h('h3', null, w.name),
      h('p', null, side ? `We are ${side === 'attacker' ? 'attacking' : 'defending'}${me === w.attackerLead || me === w.defenderLead ? ' and lead our side' : ''}. ${age} month${age === 1 ? '' : 's'} at war.` : `${age} month${age === 1 ? '' : 's'} at war.`),
    ),
    h(
      'div',
      { class: 'route-body' },
      h(
        'div',
        null,
        h('table', { class: 'register compact' }, h('tbody', null, h('tr', null, h('td', { class: 'muted' }, side ? 'Our side' : 'Attackers'), h('td', null, sideList(side ? us : w.attackers))), h('tr', null, h('td', { class: 'muted' }, side ? 'Against us' : 'Defenders'), h('td', null, sideList(side ? them : w.defenders))))),
        h('h4', null, `War goal: ${w.goal.type === 'claim' ? 'press claims' : w.goal.type === 'conquest' ? 'conquest' : 'coalition war'}`),
        goal,
        w.goal.provinces.length ? button('Show the goal on the map', () => app.highlightProvinces(w.goal.provinces), { cls: 'small quiet', icon: 'target' }) : null,
      ),
      h(
        'div',
        null,
        h('div', { class: 'timer-row' }, h('span', { class: 'k' }, mine ? 'War score, our view' : 'War score, attackers'), h('b', { class: my >= 0 ? 'good' : 'bad' }, signed(my, 0))),
        bar(my + 100, 200, my >= 0 ? 'good' : 'bad', 'War score'),
        h(
          'table',
          { class: 'register compact' },
          h(
            'tbody',
            null,
            comp('Enemy land we hold', side === 'defender' ? b.occDef : b.occAtt, 'share of their land, weighted by development'),
            comp('Our land they hold', -(side === 'defender' ? b.occAtt : b.occDef), ''),
            comp('Battles', b.battle, `capped at ±${C.war.battleScoreCap}`),
            comp('War goal', b.goal, `held goal provinces, ±${C.war.goalScoreCap}`),
          ),
        ),
        side ? h('p', { class: 'small' }, `Battles on record: won ${won} of ${reports.length}. Our war exhaustion ${Math.round(st.nations[me!].warExhaustion)} (raises unrest).`) : null,
        h('p', { class: 'small muted' }, `A white peace is forced in ${forcedIn} month${forcedIn === 1 ? '' : 's'}${w.stalemateMonths ? `, or after ${stalemateIn} more of stalemate` : ''}. A side holding 90 for a year dictates terms.`),
      ),
    ),
    mine && me && (me === w.attackerLead || me === w.defenderLead) ? h('div', { class: 'war-tools' }, settlementBuilder(app, w)) : null,
    mine && me ? h('div', { class: 'war-tools' }, peaceBuilder(app, w)) : null,
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
// Victory: src/ui/ledgers/victory.ts

// Chronicle: src/ui/ledgers/chronicle.ts
// How to Play: src/ui/ledgers/help.ts
