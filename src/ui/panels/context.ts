// Right-hand context panel: realm summary, province, army or battle details.

import { C, TERRAIN, UNITS } from '../../sim/config';
import { forecastBattle } from '../../sim/combat';
import { activeProjects, buildProblem, buildSlots, devCap, PROJECT_LABELS, projectCost } from '../../sim/construction';
import { coalitionAgainst, fabricateProblem } from '../../sim/diplomacy';
import { debtStage, integrationFactor, provinceCrowns, provinceSupplies, reserveCap } from '../../sim/economy';
import { integrationRate, overextension, unrestTarget } from '../../sim/integration';
import { maxMorale, recruitProblem, splitProblem, mergeProblem, unitCost } from '../../sim/military';
import { etaWeeks } from '../../sim/movement';
import { siegeInfo } from '../../sim/siege';
import { armiesAt, atWar, menOf, nationName, provName, warsOf } from '../../sim/state';
import { armySupplyInfo, provinceSupplyCapacity } from '../../sim/supply';
import type { Army, ProjectKind, ProvinceId, UnitType } from '../../sim/types';
import { VICTORY_LABELS, victoryProgress } from '../../sim/victory';
import { rivalLeader } from '../../sim/ai/strategic';
import { scoreFor } from '../../sim/war';
import type { App } from '../app';
import { action, bar, button, h, row, setChildren } from '../dom';
import { fmt, men, signed, weeks } from '../format';
import { confirmDialog, showEventDialog, showProposalDialog } from './dialogs';
import { shield } from './topbar';

export function renderContext(app: App): void {
  const sim = app.sim!;
  const el = app.contextEl;
  const close = button('✕', () => {
    app.selectedArmy = null;
    app.selectProvince(null);
  }, { cls: 'small close', title: 'Close (Esc)' });
  if (app.selectedArmy && sim.state.armies[app.selectedArmy]) setChildren(el, close, armyView(app, sim.state.armies[app.selectedArmy]));
  else if (app.selectedProvince) setChildren(el, close, provinceView(app, app.selectedProvince));
  else setChildren(el, realmSummary(app));
}

function section(title: string, ...children: (Node | string | null | false)[]): HTMLElement {
  return h('section', null, h('h4', null, title), ...children);
}

// ───────────────────────────── Realm summary ────────────────────────────────

function realmSummary(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return h('div', null, h('h2', null, 'Observer'), h('p', { class: 'muted' }, 'AI realms play among themselves. Select any province or army to inspect it.'));
  const st = sim.state;
  const n = st.nations[pid];
  const def = sim.world.nationDefs[pid];
  const notes: HTMLElement[] = [];
  const warn = (text: string, onClick?: () => void, cls = 'warn') => {
    const li = h('li', { style: 'margin:4px 0', class: cls }, text);
    if (onClick) {
      li.style.cursor = 'pointer';
      li.style.textDecoration = 'underline dotted';
      li.addEventListener('click', onClick);
    }
    notes.push(li);
  };
  if (!n.alive) warn('Your realm has been destroyed. You are observing the rest of the campaign.', undefined, 'bad');
  for (const pe of n.pendingEvents) warn(`Decision awaiting: event — click to decide.`, () => showEventDialog(app, pe.id), 'bad');
  for (const pr of st.proposals.filter((p) => p.to === pid)) warn(`${nationName(sim, pr.from)} awaits your answer (${pr.kind === 'callToArms' ? 'call to arms' : pr.kind}).`, () => showProposalDialog(app, pr.id), 'bad');
  const stage = debtStage(sim, pid);
  if (stage) warn(['', 'Treasury in debt: 2% monthly interest.', 'Severe debt: morale recovery halved, unrest rising.', 'Bankruptcy imminent!'][stage], () => app.openLedger('realm'), 'bad');
  if (n.supplies <= 0) warn('Supply stockpile empty: armies on supply lines are starving.', () => app.openLedger('realm'), 'bad');
  if (!n.research.current) warn('No research selected — points are being wasted.', () => app.openLedger('research'));
  const free = buildSlots(sim, pid) - activeProjects(sim, pid).length;
  if (free > 0 && n.treasury > 60) warn(`${free} construction slot${free > 1 ? 's' : ''} idle. Select a province to develop, build roads or grant charters.`);
  const ox = overextension(sim, pid);
  if (ox > 0) warn(`Overextended by ${Math.round(ox * 100)}%: too much raw frontier. Integration slows and unrest rises.`, () => app.setOverlay('integration'));
  const restless = sim.world.provIds.filter((p) => st.provinces[p].owner === pid && st.provinces[p].unrest >= 60 && st.provinces[p].integration < 50);
  for (const p of restless.slice(0, 3)) warn(`${provName(sim, p)} may revolt (unrest ${Math.round(st.provinces[p].unrest)}). Garrison it.`, () => app.selectProvince(p, true));
  const coal = coalitionAgainst(sim, pid);
  if (coal) warn(`A coalition of ${coal.members.map((m) => nationName(sim, m)).join(', ')} stands against you.`, () => app.openLedger('diplomacy'), 'bad');
  for (const w of warsOf(sim, pid)) warn(`${w.name}: war score ${Math.round(scoreFor(w, pid))} in our favour.`, () => app.openLedger('wars'), scoreFor(w, pid) < 0 ? 'bad' : 'warn');
  const rival = rivalLeader(sim, pid);
  if (rival) warn(`${nationName(sim, rival.nid)} is closing in on ${VICTORY_LABELS[rival.path]}!`, () => app.openLedger('victory'), 'bad');
  const vp = victoryProgress(sim, pid);
  return h(
    'div',
    null,
    h('h2', null, shield(app, pid), def.name),
    h('p', { class: 'muted small' }, def.summary),
    h('p', { class: 'small' }, h('span', { class: 'good' }, '▲ '), def.strength),
    h('p', { class: 'small' }, h('span', { class: 'bad' }, '▼ '), def.constraint),
    section('Attention', notes.length ? h('ul', { style: 'margin:0;padding-left:18px' }, notes) : h('p', { class: 'muted' }, 'Nothing urgent. Grow the realm, or choose a rival.')),
    section(
      'Victory progress',
      ...(['territorial', 'economic', 'diplomatic'] as const).map((k) =>
        h('div', { style: 'margin:6px 0' }, row(VICTORY_LABELS[k], `${Math.round(vp[k].progress * 100)}%${vp[k].streak ? ` · held ${vp[k].streak}/${vp[k].required} mo` : ''}`), bar(vp[k].progress, 1, vp[k].met ? 'good' : '')),
      ),
      button('Victory details (V)', () => app.openLedger('victory'), { cls: 'small' }),
    ),
    section('Tips', h('p', { class: 'small muted' }, 'Click a province or army to inspect it. Right-click (or long-press, or “Set destination”) moves the selected army. Space pauses; 1–4 set the speed.')),
  );
}

// ───────────────────────────── Province ─────────────────────────────────────

function provinceView(app: App, pid: ProvinceId): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const p = st.provinces[pid];
  const def = sim.world.prov[pid];
  const me = app.player;
  const region = sim.world.scenario.regions.find((r) => r.id === def.region)?.name ?? def.region;
  const tags: HTMLElement[] = [];
  if (p.owner && p.controller !== p.owner) tags.push(h('span', { class: 'tag bad' }, `Occupied by ${nationName(sim, p.controller)}`));
  if (p.revoltUntil > st.tick) tags.push(h('span', { class: 'tag bad' }, 'In revolt'));
  if (p.owner && st.nations[p.owner].capital === pid) tags.push(h('span', { class: 'tag warn' }, 'Capital'));
  if (p.claims.length) tags.push(h('span', { class: 'tag' }, `Claimed by ${p.claims.map((c) => nationName(sim, c)).join(', ')}`));
  const out: (HTMLElement | null)[] = [];
  out.push(h('h2', null, shield(app, p.owner), def.name));
  out.push(h('p', { class: 'muted small' }, `${TERRAIN[def.terrain].label} · ${region}${def.resource ? ` · ${def.resource}` : ''} · ${p.owner ? sim.world.nationDefs[p.owner].name : 'Unclaimed frontier'}`));
  if (tags.length) out.push(h('div', { class: 'row' }, tags));

  const terr = TERRAIN[def.terrain];
  const stats = [
    row('Development', `${p.dev} / ${devCap(sim, pid)}`),
    row('Roads', `${p.infra} / ${C.construction.infraMax}`),
    row('Fort', `${p.fort} / ${C.construction.fortMax}`),
    row('Population', `${fmt(p.pop, 1)}k`),
    row('Terrain', `move ${terr.move}, defence +${Math.round(terr.defense * 100)}%, frontage ${terr.frontage}`),
  ];
  out.push(section('Province', ...stats));
  if (p.owner) {
    const ir = integrationRate(sim, pid);
    const ut = unrestTarget(sim, pid);
    out.push(
      section(
        'Frontier integration',
        row('Integration', `${Math.floor(p.integration)} / 100 (${signed(ir.rate, 1)}/mo)`),
        bar(p.integration, 100, p.integration >= 75 ? 'good' : p.integration >= 40 ? 'warn' : 'bad', 'Integration'),
        h(
          'p',
          { class: 'small muted' },
          `Output ${Math.round(integrationFactor(p.integration) * 100)}% · troops ${p.integration >= C.integration.recruitMin ? '✓' : `at ${C.integration.recruitMin}`} · development ${p.integration >= C.integration.developMin ? '✓' : `at ${C.integration.developMin}`} · supply source ${p.integration >= C.integration.supplySourceMin || p.fort > 0 ? '✓' : `at ${C.integration.supplySourceMin}`} · counts for prosperity ${p.integration >= C.integration.economicMin ? '✓' : `at ${C.integration.economicMin}`}`,
        ),
        h('ul', { class: 'reasons' }, ir.parts.map(([l, v]) => h('li', null, h('span', null, l), h('span', null, v >= 1 && l !== 'Base' ? `×${v.toFixed(2)}` : l === 'Base' ? `${v}` : `×${v.toFixed(2)}`)))),
        row('Unrest', `${Math.round(p.unrest)} → ${Math.round(ut.target)}`),
        bar(p.unrest, 100, p.unrest >= 60 ? 'bad' : p.unrest >= 30 ? 'warn' : 'good', 'Unrest'),
        h('ul', { class: 'reasons' }, ut.parts.map(([l, v]) => h('li', null, h('span', null, l), h('span', { class: v > 0 ? 'neg' : 'pos' }, signed(v, 0))))),
      ),
    );
    out.push(
      section(
        'Output (per month)',
        row('Crowns to owner', fmt(provinceCrowns(sim, pid), 1)),
        row('Supplies', fmt(provinceSupplies(sim, pid), 1)),
        me ? row('Supply capacity (your troops)', `${Math.floor(provinceSupplyCapacity(sim, me, pid))} regiments`) : null,
        row('Military reserve', `${fmt(p.pop * C.population.reservePerPop * (0.2 + 0.8 * p.integration / 100))} men`),
      ),
    );
  }
  const si = siegeInfo(sim, pid);
  if (p.siege || si) {
    out.push(
      section(
        'Siege',
        p.siege ? row('Besieger', nationName(sim, p.siege.nation)) : null,
        p.siege ? bar(p.siege.progress, 100, 'bad', 'Siege progress') : null,
        si ? row('Progress per week', `${si.weeklyRate.toFixed(1)}% (${si.weeklyRate > 0 ? weeks(Math.ceil((100 - (p.siege?.progress ?? 0)) / si.weeklyRate)) : 'stalled'})`) : null,
        si ? h('ul', { class: 'reasons' }, si.notes.map((x) => h('li', null, x))) : null,
      ),
    );
  }

  // projects
  if (me && (p.owner === me || (!p.owner && sim.world.prov[pid].neighbors.some((nb) => st.provinces[nb].owner === me)))) {
    const items: HTMLElement[] = [];
    if (p.project) {
      items.push(row(`${PROJECT_LABELS[p.project.kind]}${p.project.nation !== me ? ` (${nationName(sim, p.project.nation)})` : ''}`, `${p.project.progress}/${p.project.total} weeks`));
      items.push(bar(p.project.progress, p.project.total, 'info', 'Project progress'));
      if (p.project.nation === me) items.push(button('Cancel project (50% refund)', () => app.do({ type: 'cancelBuild', province: pid }), { cls: 'small' }));
    } else {
      const kinds: ProjectKind[] = p.owner === me ? ['dev', 'infra', 'fort', 'charter'] : ['settle'];
      const acts = kinds.map((k) => {
        const cost = projectCost(sim, me, pid, k);
        const prob = buildProblem(sim, me, pid, k);
        const what: Record<ProjectKind, string> = {
          dev: '+1 dev: more crowns, supplies, research',
          infra: '+1 roads: faster moves, supply, integration',
          fort: '+1 fort: siege needed, defence, supply source',
          charter: `+${C.construction.charterGain} integration, −10 unrest`,
          settle: 'Claim this land as a new frontier province',
        };
        const costText = `${cost.crowns} crowns${cost.supplies ? `, ${cost.supplies} supplies` : ''}${cost.manpower ? `, ${cost.manpower} men` : ''} · ${weeks(cost.weeks)}. ${what[k]}.`;
        return action(PROJECT_LABELS[k], costText, () => app.do({ type: 'build', province: pid, project: k }), prob);
      });
      items.push(h('div', { class: 'actions' }, acts));
      items.push(h('p', { class: 'small muted' }, `Construction slots: ${activeProjects(sim, me).length}/${buildSlots(sim, me)} in use.`));
    }
    out.push(section('Projects', ...items));
  }

  // recruitment
  if (me && p.owner === me) {
    const units: UnitType[] = ['foot', 'horse', 'guns'];
    const acts = units.map((u) => {
      const c = unitCost(sim, me, u);
      const prob = recruitProblem(sim, me, pid, u);
      const b = action(
        `Raise ${UNITS[u].label}`,
        `${c.crowns} crowns, ${c.supplies} supplies, 1,000 men · ${c.weeks} weeks · upkeep ${UNITS[u].upkeep}/mo. ${UNITS[u].role}${c.notes.length ? ` (${c.notes.join(', ')})` : ''}`,
        () => app.do({ type: 'recruit', province: pid, unit: u }),
        prob,
      );
      if (!prob) {
        const x3 = button('×3', () => app.do({ type: 'recruit', province: pid, unit: u, count: 3 }), { cls: 'small', title: 'Queue three regiments (as many as can be afforded)' });
        b.appendChild(x3);
      }
      return b;
    });
    const queue = p.recruits.filter((r) => r.nation === me);
    out.push(
      section(
        'Recruit',
        h('div', { class: 'actions' }, acts),
        queue.length
          ? h('div', null, h('p', { class: 'small' }, `In training: ${queue.map((r) => `${UNITS[r.unit].label} (${r.weeksLeft} wk)`).join(', ')}`), button('Cancel training', () => app.do({ type: 'cancelRecruit', province: pid }), { cls: 'small' }))
          : null,
      ),
    );
  }

  // armies present
  const here = armiesAt(sim, pid);
  if (here.length) {
    out.push(
      section(
        'Armies here',
        ...here.map((a) => {
          const b = h('button', { class: 'btn small', type: 'button', style: 'width:100%;text-align:left;margin:2px 0;display:flex;gap:6px;align-items:center' }, shield(app, a.nation), `${a.name} — ${a.regiments.length} regiments, ${men(menOf(a))} men${a.battle ? ' ⚔' : ''}`);
          b.addEventListener('click', () => app.selectArmy(a.id));
          return b;
        }),
      ),
    );
  }

  // diplomacy quick actions
  if (me && p.owner && p.owner !== me) {
    const fp = fabricateProblem(sim, me, pid);
    out.push(
      section(
        'Diplomacy',
        action('Fabricate claim', `${C.diplomacy.fabricateCost} crowns, 12 months. A claim gives a war goal without the trust cost of conquest.`, () => app.do({ type: 'fabricate', province: pid }), fp),
        button(`Relations with ${nationName(sim, p.owner)}`, () => {
          app.ui.diploTarget = p.owner;
          app.openLedger('diplomacy');
        }, { cls: 'small' }),
      ),
    );
  }
  return h('div', null, out);
}

// ───────────────────────────── Army ─────────────────────────────────────────

function armyView(app: App, a: Army): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const mine = a.nation === app.player;
  const out: (HTMLElement | null)[] = [];
  out.push(h('h2', null, shield(app, a.nation), a.name));
  const loc = h('a', { href: '#', class: 'small' }, provName(sim, a.location));
  loc.addEventListener('click', (e) => {
    e.preventDefault();
    app.selectProvince(a.location, true);
  });
  let status = 'Holding position';
  if (a.battle) status = 'In battle';
  else if (a.retreating) status = `Retreating to ${provName(sim, a.path[0])}`;
  else if (a.path.length) status = `Marching to ${provName(sim, a.path[a.path.length - 1])} — ${weeks(etaWeeks(sim, a, a.path, a.progress))}`;
  else if (st.provinces[a.location].siege?.nation === a.nation) status = 'Besieging';
  out.push(h('p', { class: 'small' }, `${nationName(sim, a.nation)} · in `, loc, ` · ${status}`));

  const byType = (t: UnitType) => a.regiments.filter((r) => r.type === t);
  const mm = maxMorale(sim, a.nation);
  out.push(
    section(
      'Composition',
      ...(['foot', 'horse', 'guns'] as UnitType[]).map((t) => {
        const regs = byType(t);
        const m = regs.reduce((s, r) => s + r.men, 0);
        return row(`${UNITS[t].plural}`, `${regs.length} regiments · ${men(m)} men`);
      }),
      row('Total', `${men(menOf(a))} / ${men(a.regiments.length * C.regimentSize)} men`),
      row('Morale', `${a.morale.toFixed(2)} / ${mm.toFixed(1)}`),
      bar(a.morale, mm, a.morale / mm > 0.5 ? 'good' : a.morale / mm > 0.25 ? 'warn' : 'bad', 'Morale'),
    ),
  );
  const sup = armySupplyInfo(sim, a);
  out.push(
    section(
      'Supply',
      row('Status', h('span', { class: sup.status === 'supplied' ? 'good' : sup.status === 'strained' ? 'warn' : 'bad' }, `${sup.status[0].toUpperCase()}${sup.status.slice(1)} (${Math.round(sup.level * 100)}%)`)),
      row('Supply line', sup.connected ? `connected, ${sup.distance.toFixed(1)} of ${sup.range} steps` : 'cut — foraging only'),
      row('Local capacity', `${Math.floor(sup.capacity)} regiments (${sup.load} here)`),
      sup.reasons.length ? h('ul', { class: 'reasons' }, sup.reasons.map((r) => h('li', { class: 'bad' }, r))) : null,
      sup.remedies.length ? h('ul', { class: 'reasons' }, sup.remedies.map((r) => h('li', { class: 'muted' }, `Remedy: ${r}`))) : null,
      h('p', { class: 'small muted' }, 'Strained: no reinforcement, half morale recovery, −10% combat. Unsupplied: 2% attrition per week, morale loss, −25% combat.'),
    ),
  );

  if (a.battle && st.battles[a.battle]) out.push(battleSection(app, a.battle));
  else if (a.path.length && !a.retreating) {
    const dest = a.path[0];
    const foes = armiesAt(sim, dest).filter((x) => atWar(sim, a.nation, x.nation) && !x.retreating);
    if (foes.length) {
      const f = forecastBattle(sim, dest, [a], foes);
      out.push(section('Battle forecast', row('Next step', provName(sim, dest)), forecastView(f)));
    }
  }

  if (mine) {
    const acts: HTMLElement[] = [];
    const moveProb = a.battle ? 'The army is engaged in battle.' : a.retreating ? 'Retreating armies cannot take orders.' : null;
    acts.push(action('Set destination (G)', 'Then click a province. Right-click also moves.', () => app.startMoveMode(), moveProb, 'primary'));
    if (a.path.length && !a.retreating) acts.push(action('Halt', 'Stop at the current province.', () => app.do({ type: 'stop', army: a.id }), null));
    // merge
    const others = armiesAt(sim, a.location).filter((x) => x.nation === a.nation && x.id !== a.id);
    if (others.length) {
      const ids = [a.id, ...others.map((o) => o.id)];
      acts.push(action(`Merge ${ids.length} armies`, 'Combine every army of ours in this province.', () => app.do({ type: 'merge', armies: ids }), mergeProblem(sim, a.nation, ids)));
    }
    out.push(section('Orders', h('div', { class: 'actions' }, acts)));
    // split
    const counts = app.ui.split;
    const stepper = (t: UnitType) => {
      const have = byType(t).length;
      const v = counts[t] ?? 0;
      const minus = button('−', () => {
        counts[t] = Math.max(0, v - 1);
        app.refresh();
      }, { cls: 'small icon', disabled: v <= 0 ? 'None selected' : null });
      const plus = button('+', () => {
        counts[t] = Math.min(have, v + 1);
        app.refresh();
      }, { cls: 'small icon', disabled: v >= have ? 'No more of this type' : null });
      return h('div', { class: 'row' }, h('span', { class: 'grow' }, `${UNITS[t].plural}: ${v}/${have}`), minus, plus);
    };
    const splitProb = splitProblem(sim, a.nation, a.id, counts as Record<UnitType, number>);
    out.push(
      section(
        'Detach regiments',
        stepper('foot'),
        stepper('horse'),
        stepper('guns'),
        action('Form new army', 'Detached regiments keep their morale.', () => {
          const r = app.do({ type: 'split', army: a.id, counts: { ...counts } });
          if (r.ok) app.ui.split = {};
        }, splitProb),
      ),
    );
    out.push(
      section(
        'Disband',
        action(
          'Disband army',
          'Survivors return to the manpower pool (up to its limit).',
          () => confirmDialog(app, `Disband ${a.name}?`, `${men(menOf(a))} men will go home. This cannot be undone.`, () => app.do({ type: 'disband', army: a.id })),
          a.battle ? 'Cannot disband during a battle.' : null,
          'danger',
        ),
      ),
    );
  } else if (app.player) {
    // could our adjacent armies beat it?
    const ours = sim.world.prov[a.location].neighbors.flatMap((nb) => armiesAt(sim, nb).filter((x) => x.nation === app.player && !x.battle));
    if (ours.length && atWar(sim, app.player, a.nation)) {
      const f = forecastBattle(sim, a.location, ours, armiesAt(sim, a.location).filter((x) => atWar(sim, app.player!, x.nation)));
      out.push(section(`Forecast: our ${ours.length} adjacent army(ies) attack`, forecastView(f)));
    }
  }
  return h('div', null, out);
}

export function forecastView(f: ReturnType<typeof forecastBattle>): HTMLElement {
  const cls = f.verdict === 'Likely victory' ? 'good' : f.verdict === 'Likely defeat' ? 'bad' : 'warn';
  return h(
    'div',
    null,
    row('Outlook', h('b', { class: cls }, f.verdict)),
    row('Strength', `${men(f.attMen)} vs ${men(f.defMen)}`),
    row('Expected losses', `ours ${men(f.attLoss)}, theirs ${men(f.defLoss)} (~${f.rounds} weeks)`),
    h('p', { class: 'small muted' }, `Outcomes under unlucky / even / lucky rolls: ${f.outcomes.map((o) => (o === 'attacker' ? 'win' : 'loss')).join(' / ')}.`),
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
    row('Attackers', `${b.attackerNations.map((n) => nationName(sim, n)).join(', ')} — ${men(m(att))} (lost ${men(b.attLosses)})`),
    last ? bar(last.attMorale, 1, 'bad', 'Attacker morale') : null,
    row('Defenders', `${b.defenderNations.map((n) => nationName(sim, n)).join(', ')} — ${men(m(def))} (lost ${men(b.defLosses)})`),
    last ? bar(last.defMorale, 1, 'info', 'Defender morale') : null,
    row('Round', `${b.rounds.length} of max ${C.combat.maxRounds}`),
    b.factors.length ? h('ul', { class: 'reasons' }, b.factors.map((x) => h('li', null, x))) : null,
    h('p', { class: 'small muted' }, 'A side breaks at 25% morale or after losing 90% of its men. Reinforcements arriving in the province join the battle.'),
  );
}

export { reserveCap };
