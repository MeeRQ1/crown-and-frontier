// The inspector: a card for the selected province or army. The header says
// what is selected, a fact grid gives the essentials, primary actions come
// next, and details follow. Unavailable actions always say why.

import { C, TERRAIN, UNITS } from '../../sim/config';
import { forecastBattle } from '../../sim/combat';
import { activeProjects, buildProblem, buildSlots, devCap, devMax, PROJECT_LABELS, projectCost } from '../../sim/construction';
import { fabricateProblem } from '../../sim/diplomacy';
import { integrationFactor, provinceCrowns, provinceSupplies } from '../../sim/economy';
import { integrationRate, unrestTarget } from '../../sim/integration';
import { maxMorale, mergeProblem, recruitProblem, splitProblem, unitCost } from '../../sim/military';
import { etaWeeks } from '../../sim/movement';
import { siegeInfo } from '../../sim/siege';
import { armiesAt, atWar, menOf, nationName, provName } from '../../sim/state';
import { armySupplyInfo, provinceSupplyCapacity } from '../../sim/supply';
import type { Army, ProjectKind, ProvinceId, UnitType } from '../../sim/types';
import type { App } from '../app';
import { action, bar, button, h, rebuild, row, setChildren } from '../dom';
import { fmt, men, plural, signed, weeks } from '../format';
import { icon, type IconName } from '../icons';
import { section, shield, tip } from './common';
import { confirmDialog } from './dialogs';

export function renderInspector(app: App): void {
  const sim = app.sim!;
  const el = app.inspectorEl;
  const army = app.selectedArmy ? sim.state.armies[app.selectedArmy] : undefined;
  const open = !!army || !!app.selectedProvince;
  el.classList.toggle('closed', !open);
  el.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (!open) {
    if (el.childElementCount) setChildren(el);
    return;
  }
  rebuild(el, () => {
    const card = army ? armyCard(app, army) : provinceCard(app, app.selectedProvince!);
    setChildren(el, ...card);
  });
}

function head(app: App, nid: string | null, title: string, sub: (Node | string)[], tags: HTMLElement[] = []): HTMLElement {
  const close = h('button', { class: 'btn quiet small icon close', type: 'button', 'aria-label': 'Close (Esc)', 'data-fk': 'ins-close' }, icon('close'));
  close.addEventListener('click', () => app.clearSelection());
  const grab = h('button', { class: 'grab', type: 'button', 'aria-label': app.ui.inspectorPeek ? 'Expand details' : 'Collapse details' });
  grab.addEventListener('click', () => {
    app.ui.inspectorPeek = !app.ui.inspectorPeek;
    app.inspectorEl.classList.toggle('peek', app.ui.inspectorPeek);
  });
  return h(
    'div',
    null,
    grab,
    h('div', { class: 'ins-head' }, shield(app, nid, 'lg'), h('div', { class: 'titles' }, h('h2', null, title), h('div', { class: 'sub' }, ...sub), tags.length ? h('div', { class: 'facts' }, tags) : null), close),
  );
}

function tile(label: string, big: Node | string, sub?: Node | string | null, tipText?: string): HTMLElement {
  const t = h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, label), h('div', { class: 'big' }, big), sub ? h('div', { class: 'sub' }, sub) : null);
  if (tipText) tip(t, tipText);
  return t;
}

function quick(ic: IconName, label: string, onClick: () => void, problem: string | null, detail: string, cls = ''): HTMLElement {
  const b = button(label, onClick, { cls: `small ${cls}`, icon: ic, disabled: problem });
  tip(b, () => h('div', null, h('b', { class: 't' }, label), h('p', null, detail), problem ? h('p', { class: 'bad' }, problem) : null));
  return b;
}

// ───────────────────────────── Province ─────────────────────────────────────

function provinceCard(app: App, pid: ProvinceId): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const p = st.provinces[pid];
  const def = sim.world.prov[pid];
  const me = app.player;
  const region = sim.world.scenario.regions.find((r) => r.id === def.region)?.name ?? def.region;
  const terr = TERRAIN[def.terrain];
  const tags: HTMLElement[] = [];
  if (p.owner && st.nations[p.owner].capital === pid) tags.push(h('span', { class: 'tag brass' }, icon('capital'), 'Capital'));
  if (p.owner && p.controller !== p.owner) tags.push(h('span', { class: 'tag bad' }, `Occupied by ${nationName(sim, p.controller)}`));
  if (p.revoltUntil > st.tick) tags.push(h('span', { class: 'tag bad' }, 'In revolt'));
  if (p.siege) tags.push(h('span', { class: 'tag bad' }, `Siege ${Math.round(p.siege.progress)}%`));
  if (p.claims.length) tags.push(h('span', { class: 'tag' }, `Claimed by ${p.claims.map((c) => sim.world.nationDefs[c].short).join(', ')}`));
  if (def.resource) tags.push(h('span', { class: 'tag' }, def.resource));
  const out: HTMLElement[] = [];
  const ownerName = p.owner ? sim.world.nationDefs[p.owner].short : 'Unclaimed frontier';
  out.push(head(app, p.owner, def.name, [`${terr.label} · ${region} · ${ownerName}`], tags));

  // primary actions
  const prim: HTMLElement[] = [];
  if (me && p.owner === me && !p.project) {
    for (const k of ['dev', 'infra', 'fort', 'charter'] as ProjectKind[]) {
      if (k === 'charter' && p.integration >= 90) continue;
      const cost = projectCost(sim, me, pid, k);
      const prob = buildProblem(sim, me, pid, k);
      const ic: Record<string, IconName> = { dev: 'build', infra: 'road', fort: 'fort', charter: 'charter' };
      prim.push(quick(ic[k], PROJECT_LABELS[k], () => app.do({ type: 'build', province: pid, project: k }), prob, `${cost.crowns} crowns${cost.supplies ? `, ${cost.supplies} supplies` : ''} · ${weeks(cost.weeks)}.`, k === 'dev' && !prob ? 'primary' : ''));
    }
  }
  if (me && !p.owner && !p.project) {
    const cost = projectCost(sim, me, pid, 'settle');
    const prob = buildProblem(sim, me, pid, 'settle');
    prim.push(quick('settle', 'Settle', () => app.do({ type: 'build', province: pid, project: 'settle' }), prob, `${cost.crowns} crowns, ${cost.supplies} supplies, ${cost.manpower} men · ${weeks(cost.weeks)}. Claims this land as new frontier.`, prob ? '' : 'primary'));
  }
  if (me && p.owner && p.owner !== me) {
    const owner = p.owner;
    const rel = button(`Relations with ${sim.world.nationDefs[owner].short}`, () => app.openDiplomacy(owner), { cls: 'small', icon: 'relations' });
    prim.push(rel);
  }
  const sel = app.selectedArmyForOrders();
  if (sel && sel.location !== pid) {
    prim.unshift(button(`March ${sel.name} here`, () => app.orderMove(pid, sel.id), { cls: 'small primary', icon: 'move' }));
  }
  if (prim.length) out.push(h('div', { class: 'ins-primary' }, prim));

  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins' });
  // essentials
  if (p.owner) {
    const ir = integrationRate(sim, pid);
    body.appendChild(
      h(
        'div',
        { class: 'stat-grid', style: 'margin-top:10px' },
        tile('Development', `${p.dev}`, `limit ${devCap(sim, pid)} · max ${devMax(sim, pid)}`, 'Development raises crowns, supplies and research. Beyond the terrain limit it costs 2.5× more.'),
        tile('Crowns / mo', fmt(provinceCrowns(sim, pid), 1), `supplies ${fmt(provinceSupplies(sim, pid), 1)}`, 'What this province yields its owner each month, after integration, unrest and occupation.'),
        tile('Integration', `${Math.floor(p.integration)}`, `${signed(ir.rate, 1)}/mo`, 'Frontier integration (0–100): output, recruitment, development and supply all depend on it.'),
        tile('Unrest', `${Math.round(p.unrest)}`, `→ ${Math.round(unrestTarget(sim, pid).target)}`, 'Unrest drifts toward its target. At 60+ in raw frontier the province may revolt.'),
      ),
    );
  } else {
    body.appendChild(h('p', { class: 'muted', style: 'margin-top:10px' }, 'Unclaimed frontier. A realm with a neighbouring province can settle it.'));
  }
  body.appendChild(
    section(
      'Ground',
      row('Terrain', `${terr.label}: march cost ${terr.move}, defenders +${Math.round(terr.defense * 100)}%, frontage ${terr.frontage}`),
      row('Roads · fort', `${p.infra}/${C.construction.infraMax} · ${p.fort}/${C.construction.fortMax}`),
      row('Population', `${fmt(p.pop, 1)}k`),
      me ? row('Supply capacity', plural(Math.floor(provinceSupplyCapacity(sim, me, pid)), 'regiment')) : null,
    ),
  );
  if (p.owner) {
    const ir = integrationRate(sim, pid);
    const ut = unrestTarget(sim, pid);
    const gate = (v: number, lbl: string) => h('span', { class: `tag ${p.integration >= v ? 'good' : ''}` }, `${lbl} ${p.integration >= v ? '✓' : v}`);
    body.appendChild(
      section(
        'Frontier integration',
        bar(p.integration, 100, p.integration >= 75 ? 'good' : p.integration >= 40 ? 'warn' : 'bad', 'Integration'),
        h('div', { class: 'facts' }, gate(C.integration.recruitMin, 'recruits'), gate(C.integration.developMin, 'develop'), gate(C.integration.supplySourceMin, 'supply source'), gate(C.integration.economicMin, 'prosperity')),
        h('p', { class: 'small muted' }, `Output ${Math.round(integrationFactor(p.integration) * 100)}% of full.`),
        h('ul', { class: 'reasons' }, ir.parts.map(([l, v]) => h('li', null, h('span', null, l), h('span', null, l === 'Base' ? `${v}` : `×${v.toFixed(2)}`)))),
        row('Unrest target', `${Math.round(ut.target)}`),
        h('ul', { class: 'reasons' }, ut.parts.map(([l, v]) => h('li', null, h('span', null, l), h('span', { class: v > 0 ? 'neg' : 'pos' }, signed(v, 0))))),
      ),
    );
  }
  const si = siegeInfo(sim, pid);
  if (p.siege || si) {
    body.appendChild(
      section(
        'Siege',
        p.siege ? row('Besieger', nationName(sim, p.siege.nation)) : null,
        p.siege ? bar(p.siege.progress, 100, 'bad', 'Siege progress') : null,
        si ? row('Progress per week', `${si.weeklyRate.toFixed(1)}% (${si.weeklyRate > 0 ? weeks(Math.ceil((100 - (p.siege?.progress ?? 0)) / si.weeklyRate)) : 'stalled'})`) : null,
        si ? h('ul', { class: 'reasons' }, si.notes.map((x) => h('li', null, x))) : null,
      ),
    );
  }
  // projects (full detail)
  if (me && (p.owner === me || (!p.owner && sim.world.prov[pid].neighbors.some((nb) => st.provinces[nb].owner === me)))) {
    const items: HTMLElement[] = [];
    if (p.project) {
      items.push(row(`${PROJECT_LABELS[p.project.kind]}${p.project.nation !== me ? ` (${nationName(sim, p.project.nation)})` : ''}`, `${p.project.progress}/${p.project.total} weeks`));
      items.push(bar(p.project.progress, p.project.total, 'info', 'Project progress'));
      if (p.project.nation === me) items.push(button('Cancel project (50% refund)', () => app.do({ type: 'cancelBuild', province: pid }), { cls: 'small' }));
    } else {
      const kinds: ProjectKind[] = p.owner === me ? ['dev', 'infra', 'fort', 'charter'] : ['settle'];
      const what: Record<ProjectKind, string> = {
        dev: '+1 development: more crowns, supplies and research',
        infra: '+1 roads: faster marches, more supply, faster integration',
        fort: '+1 fort: must be besieged, defence bonus, supply source',
        charter: `+${C.construction.charterGain} integration, −10 unrest`,
        settle: 'Claim this land as a new frontier province',
      };
      items.push(
        h(
          'div',
          { class: 'actions' },
          kinds.map((k) => {
            const cost = projectCost(sim, me, pid, k);
            return action(PROJECT_LABELS[k], `${cost.crowns} crowns${cost.supplies ? `, ${cost.supplies} supplies` : ''}${cost.manpower ? `, ${cost.manpower} men` : ''} · ${weeks(cost.weeks)}. ${what[k]}.`, () => app.do({ type: 'build', province: pid, project: k }), buildProblem(sim, me, pid, k));
          }),
        ),
      );
    }
    items.push(h('p', { class: 'small faint' }, `Builders busy: ${activeProjects(sim, me).length} of ${buildSlots(sim, me)}.`));
    body.appendChild(section('Construction', ...items));
  }
  // recruitment
  if (me && p.owner === me) {
    const units: UnitType[] = ['foot', 'horse', 'guns'];
    const acts = units.map((u) => {
      const c = unitCost(sim, me, u);
      const prob = recruitProblem(sim, me, pid, u);
      const b = action(`Raise ${UNITS[u].label}`, `${c.crowns} crowns, ${c.supplies} supplies, 1,000 men · ${c.weeks} weeks · upkeep ${UNITS[u].upkeep}/mo. ${UNITS[u].role}${c.notes.length ? ` (${c.notes.join(', ')})` : ''}`, () => app.do({ type: 'recruit', province: pid, unit: u }), prob);
      if (!prob) b.appendChild(button('Raise three', () => app.do({ type: 'recruit', province: pid, unit: u, count: 3 }), { cls: 'small quiet', title: 'Queue three regiments (as many as can be afforded)', fk: `x3-${u}` }));
      return b;
    });
    const queue = p.recruits.filter((r) => r.nation === me);
    body.appendChild(
      section(
        'Recruit',
        h('div', { class: 'actions' }, acts),
        queue.length ? h('div', { class: 'row', style: 'margin-top:6px' }, h('span', { class: 'small' }, `Training: ${queue.map((r) => `${UNITS[r.unit].label} (${r.weeksLeft} wk)`).join(', ')}`), button('Cancel training', () => app.do({ type: 'cancelRecruit', province: pid }), { cls: 'small quiet' })) : null,
      ),
    );
  }
  const here = armiesAt(sim, pid);
  if (here.length) body.appendChild(section('Armies here', ...here.map((a) => armyRow(app, a))));
  if (me && p.owner && p.owner !== me) {
    body.appendChild(
      section(
        'Claims',
        action('Fabricate claim', `${C.diplomacy.fabricateCost} crowns, 12 months. A claim gives a war goal without the trust cost of conquest.`, () => app.do({ type: 'fabricate', province: pid }), fabricateProblem(sim, me, pid)),
      ),
    );
  }
  out.push(body);
  return out;
}

function armyRow(app: App, a: Army): HTMLElement {
  const sim = app.sim!;
  const b = h('button', { class: 'btn quiet', type: 'button', style: 'width:100%;justify-content:flex-start;margin:2px 0', 'data-fk': `army-${a.id}` }, shield(app, a.nation), h('span', { class: 'grow', style: 'text-align:left' }, a.name), h('span', { class: 'faint' }, `${plural(a.regiments.length, 'regiment')} · ${men(menOf(a))}`), a.battle ? icon('battle') : null);
  b.addEventListener('click', () => app.selectArmy(a.id));
  void sim;
  return b;
}

// ───────────────────────────── Army ─────────────────────────────────────────

export function armyStatus(app: App, a: Army): string {
  const sim = app.sim!;
  const st = sim.state;
  if (a.battle) return `In battle at ${provName(sim, a.location)}`;
  if (a.retreating) return `Retreating to ${provName(sim, a.path[0])}`;
  if (a.path.length) return `Marching to ${provName(sim, a.path[a.path.length - 1])} · ${weeks(etaWeeks(sim, a, a.path, a.progress))}`;
  if (st.provinces[a.location].siege?.nation === a.nation) return `Besieging ${provName(sim, a.location)}`;
  return `Holding ${provName(sim, a.location)}`;
}

function armyCard(app: App, a: Army): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const mine = a.nation === app.player;
  const out: HTMLElement[] = [];
  const tags: HTMLElement[] = [];
  const sup = armySupplyInfo(sim, a);
  if (sup.status !== 'supplied') tags.push(h('span', { class: `tag ${sup.status === 'strained' ? 'warn' : 'bad'}` }, sup.status === 'strained' ? 'Supply strained' : 'Unsupplied'));
  if (app.player && !mine && atWar(sim, app.player, a.nation)) tags.push(h('span', { class: 'tag bad' }, 'Enemy'));
  if (a.retreating) tags.push(h('span', { class: 'tag warn' }, 'Retreating'));
  out.push(head(app, a.nation, a.name, [`${sim.world.nationDefs[a.nation].short} · ${armyStatus(app, a)}`], tags));

  if (mine) {
    const moveProb = a.battle ? 'The army is engaged in battle.' : a.retreating ? 'Retreating armies cannot take orders.' : null;
    const prim: HTMLElement[] = [];
    prim.push(quick('move', app.moveMode ? 'Choose destination…' : 'Move', () => app.startMoveMode(), moveProb, 'Then click a province on the map (or right-click it directly). Hold Shift to add a waypoint after the current route.', 'primary'));
    if (a.path.length && !a.retreating) prim.push(quick('stop', 'Halt', () => app.do({ type: 'stop', army: a.id }), null, 'Stop at the current province.'));
    const others = armiesAt(sim, a.location).filter((x) => x.nation === a.nation && x.id !== a.id);
    if (others.length) {
      const ids = [a.id, ...others.map((o) => o.id)];
      prim.push(quick('merge', `Merge ${ids.length}`, () => app.do({ type: 'merge', armies: ids }), mergeProblem(sim, a.nation, ids), 'Combine every army of ours in this province into this one.'));
    }
    out.push(h('div', { class: 'ins-primary' }, prim));
  }

  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins' });
  const byType = (t: UnitType) => a.regiments.filter((r) => r.type === t);
  const mm = maxMorale(sim, a.nation);
  body.appendChild(
    h(
      'div',
      { class: 'stat-grid', style: 'margin-top:10px' },
      tile('Regiments', `${a.regiments.length}`, `${byType('foot').length} foot · ${byType('horse').length} horse · ${byType('guns').length} guns`),
      tile('Men', men(menOf(a)), `of ${men(a.regiments.length * C.regimentSize)}`),
      tile('Morale', a.morale.toFixed(1), h('span', null, bar(a.morale, mm, a.morale / mm > 0.5 ? 'good' : a.morale / mm > 0.25 ? 'warn' : 'bad', 'Morale')), `Morale out of ${mm.toFixed(1)}. Armies break when it runs out.`),
      tile('Supply', `${Math.round(sup.level * 100)}%`, sup.connected ? `line ${sup.distance.toFixed(1)}/${sup.range}` : 'cut: foraging', 'Supply level here: capacity versus the regiments drawing on it, and whether a supply line reaches.'),
    ),
  );
  if (a.battle && st.battles[a.battle]) body.appendChild(battleSection(app, a.battle));
  else if (a.path.length && !a.retreating) {
    const dest = a.path[0];
    const foes = armiesAt(sim, dest).filter((x) => atWar(sim, a.nation, x.nation) && !x.retreating);
    if (foes.length) body.appendChild(section(`Battle ahead: ${provName(sim, dest)}`, forecastView(forecastBattle(sim, dest, [a], foes))));
  }
  if (app.player && !a.battle && !a.retreating) {
    const me = app.player;
    let target: ProvinceId | null = null;
    let attackers: Army[] = [];
    if (mine && !a.path.length) {
      target = a.location;
      attackers = Object.values(st.armies).filter((x) => !x.retreating && !x.battle && x.path.includes(a.location) && atWar(sim, me, x.nation));
    } else if (!mine && a.path.length && atWar(sim, me, a.nation)) {
      target = a.path.find((pid) => armiesAt(sim, pid).some((y) => y.nation === me && !y.retreating)) ?? null;
      attackers = [a];
    }
    const holders = target ? armiesAt(sim, target).filter((x) => !x.retreating && !x.battle && !atWar(sim, me, x.nation)) : [];
    if (target && attackers.length && holders.some((x) => x.nation === me)) {
      const f = forecastBattle(sim, target, attackers, holders);
      const eta = Math.min(...attackers.map((x) => etaWeeks(sim, x, x.path.slice(0, x.path.indexOf(target!) + 1), x.progress)));
      body.appendChild(
        section(
          mine ? 'Incoming attack' : `If they reach our army at ${provName(sim, target)}`,
          mine ? row('Enemy', attackers.map((x) => `${x.name} (${sim.world.nationDefs[x.nation].short}, ${plural(x.regiments.length, 'regiment')})`).join(', ')) : null,
          row('Arrives', `in about ${weeks(eta)}`),
          forecastView(f, 'defender'),
          h('p', { class: 'small faint' }, 'Assumes both sides as they are now. Holding still lets defenders dig in; forts and rough terrain favour them.'),
        ),
      );
    }
    if (!mine && atWar(sim, me, a.nation)) {
      const ours = sim.world.prov[a.location].neighbors.flatMap((nb) => armiesAt(sim, nb).filter((x) => x.nation === me && !x.battle));
      if (ours.length) body.appendChild(section(`If our ${ours.length > 1 ? `${ours.length} adjacent armies attack` : 'adjacent army attacks'}`, forecastView(forecastBattle(sim, a.location, ours, armiesAt(sim, a.location).filter((x) => atWar(sim, me, x.nation))))));
    }
  }
  body.appendChild(
    section(
      'Supply',
      row('Status', h('span', { class: sup.status === 'supplied' ? 'good' : sup.status === 'strained' ? 'warn' : 'bad' }, `${sup.status[0].toUpperCase()}${sup.status.slice(1)} (${Math.round(sup.level * 100)}%)`)),
      row('Supply line', sup.connected ? `connected, ${sup.distance.toFixed(1)} of ${sup.range} steps` : 'cut: foraging only'),
      row('Local capacity', `${plural(Math.floor(sup.capacity), 'regiment')} (${sup.load} here)`),
      sup.reasons.length ? h('ul', { class: 'reasons' }, sup.reasons.map((r) => h('li', { class: 'bad' }, r))) : null,
      sup.remedies.length ? h('ul', { class: 'reasons' }, sup.remedies.map((r) => h('li', null, `Remedy: ${r}`))) : null,
      h('p', { class: 'small faint' }, 'Strained: no reinforcement, half morale recovery, −10% in battle. Unsupplied: 2% attrition a week, morale loss, −25% in battle.'),
    ),
  );
  if (mine) {
    const counts = app.ui.split;
    const stepper = (t: UnitType) => {
      const have = byType(t).length;
      const v = counts[t] ?? 0;
      const minus = button('', () => {
        counts[t] = Math.max(0, v - 1);
        app.refresh();
      }, { cls: 'small icon', disabled: v <= 0 ? 'None selected' : null, icon: 'minus', fk: `minus-${t}` });
      const plus = button('', () => {
        counts[t] = Math.min(have, v + 1);
        app.refresh();
      }, { cls: 'small icon', disabled: v >= have ? 'No more of this type' : null, icon: 'plus', fk: `plus-${t}` });
      return h('div', { class: 'row' }, h('span', { class: 'grow' }, `${UNITS[t].plural}: ${v} of ${have}`), minus, plus);
    };
    body.appendChild(
      section(
        'Detach regiments',
        stepper('foot'),
        stepper('horse'),
        stepper('guns'),
        action('Form new army', 'Detached regiments keep their morale.', () => {
          const r = app.do({ type: 'split', army: a.id, counts: { ...counts } });
          if (r.ok) app.ui.split = {};
        }, splitProblem(sim, a.nation, a.id, counts as Record<UnitType, number>)),
      ),
    );
    body.appendChild(
      section(
        'Disband',
        action('Disband army', 'Survivors return to the manpower pool (up to its limit).', () => confirmDialog(app, `Disband ${a.name}?`, `${men(menOf(a))} men will go home. This cannot be undone.`, () => app.do({ type: 'disband', army: a.id })), a.battle ? 'Cannot disband during a battle.' : null, 'danger'),
      ),
    );
  }
  out.push(body);
  return out;
}

/** Forecast from our side: `side` says whether we are the attacker or the defender. */
export function forecastView(f: ReturnType<typeof forecastBattle>, side: 'attacker' | 'defender' = 'attacker'): HTMLElement {
  const ours = (o: string | null) => o === side;
  const wins = f.outcomes.filter(ours).length;
  const verdict = wins === 3 ? 'Likely victory' : wins === 0 ? 'Likely defeat' : 'Uncertain';
  const cls = wins === 3 ? 'good' : wins === 0 ? 'bad' : 'warn';
  const [ourMen, theirMen] = side === 'attacker' ? [f.attMen, f.defMen] : [f.defMen, f.attMen];
  const [ourLoss, theirLoss] = side === 'attacker' ? [f.attLoss, f.defLoss] : [f.defLoss, f.attLoss];
  const rolls = side === 'attacker' ? f.outcomes : [...f.outcomes].reverse();
  return h(
    'div',
    null,
    h('div', { class: `callout ${cls}` }, icon(wins === 3 ? 'check' : wins === 0 ? 'alert' : 'info'), h('div', null, h('b', null, verdict), h('div', null, `Unlucky / even / lucky rolls: ${rolls.map((o) => (ours(o) ? 'win' : o ? 'loss' : 'undecided')).join(' / ')}`))),
    row('Strength', `ours ${men(ourMen)} · theirs ${men(theirMen)}`),
    row('Expected losses', `ours ${men(ourLoss)} · theirs ${men(theirLoss)} (~${f.rounds} weeks)`),
    f.factors.length ? h('ul', { class: 'reasons' }, f.factors.map((x) => h('li', null, x))) : null,
  );
}

function battleSection(app: App, bid: string): HTMLElement {
  const sim = app.sim!;
  const b = sim.state.battles[bid];
  const side = (ids: string[]) => ids.map((i) => sim.state.armies[i]).filter(Boolean) as Army[];
  const att = side(b.attackers);
  const def = side(b.defenders);
  const m = (arr: Army[]) => arr.reduce((s, a) => s + menOf(a), 0);
  const last = b.rounds.at(-1);
  return section(
    `Battle of ${provName(sim, b.province)}`,
    row('Attackers', `${b.attackerNations.map((n) => sim.world.nationDefs[n].short).join(', ')} · ${men(m(att))} (lost ${men(b.attLosses)})`),
    last ? bar(last.attMorale, 1, 'bad', 'Attacker morale') : null,
    row('Defenders', `${b.defenderNations.map((n) => sim.world.nationDefs[n].short).join(', ')} · ${men(m(def))} (lost ${men(b.defLosses)})`),
    last ? bar(last.defMorale, 1, 'info', 'Defender morale') : null,
    row('Round', `${b.rounds.length} of at most ${C.combat.maxRounds}`),
    b.factors.length ? h('ul', { class: 'reasons' }, b.factors.map((x) => h('li', null, x))) : null,
    h('p', { class: 'small faint' }, 'A side breaks at 25% morale or after losing 90% of its men. Reinforcements arriving in the province join the battle.'),
  );
}
