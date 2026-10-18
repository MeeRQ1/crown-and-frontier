// Government & Cabinet (format 9): the form of government, the head of government, a
// nation to proclaim, the commanders' staff, the cabinet's trade minister, and every
// national modifier with its sources — one ledger, each choice showing its effects,
// costs and conditions before it is taken (the same rules for every realm).

import { BRANCH_LABELS, commandLimit, commandersOf, COMMANDER_TRAITS, COMMANDER_TRAIT_IDS, recruitCommanderCost } from '../../sim/commanders';
import { checkCommand } from '../../sim/commands';
import { hireFee, MANAGED, stockTarget, tradeCandidates } from '../../sim/cabinet';
import { checkFormable, FORMABLES, formablesFor, formableProvinces, ideologyCost, ideologyOf, IDEOLOGIES, IDEOLOGY_IDS, IDEOLOGY_WAIT_WEEKS, leaderOf, LEADER_TRAITS, LEADER_TRAIT_IDS, replaceLeaderCost } from '../../sim/government';
import { describeEffects, formatMod, modBreakdown, modSources, MOD_LABELS } from '../../sim/modifiers';
import { dateOf, nationName, treatyPartners } from '../../sim/state';
import { resLabel, TRADEABLE } from '../../sim/trade';
import type { Commander, CommanderTrait, IdeologyId, LeaderTrait, Tradeable } from '../../sim/types';
import type { App } from '../app';
import { button, h } from '../dom';
import { icon } from '../icons';
import { section } from '../panels/common';
import { confirmDialog } from '../panels/dialogs';

export function governmentLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  if (!me) return h('p', { class: 'muted' }, 'Observer mode: no realm of your own.');
  return h('div', { class: 'ledger-gov' }, ideologySection(app), leaderSection(app), formableSection(app), commanderSection(app), cabinetSection(app), modifierSection(app), h('p', { class: 'small faint' }, `${nationName(sim, me)}: the same rules, costs and waits apply to every realm. Names of heads of government, commanders and ministers are generated, not historical.`));
}

function effects(list: string[]): HTMLElement {
  return h('ul', { class: 'notes small' }, list.map((x) => h('li', null, x)));
}

function ideologySection(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const n = sim.state.nations[me];
  const cur = ideologyOf(sim, me);
  const def = IDEOLOGIES[cur];
  const since = n.ideology?.since ?? 0;
  const cards = IDEOLOGY_IDS.filter((id) => id !== cur).map((id: IdeologyId) => {
    const d = IDEOLOGIES[id];
    const prob = checkCommand(sim, { type: 'setIdeology', nation: me, ideology: id });
    return h(
      'div',
      { class: 'group-card' },
      h('div', { class: 'gc-head' }, h('b', { class: 'grow' }, d.label), button('Adopt…', () => confirmDialog(app, `Adopt ${d.label.toLowerCase()}?`, [h('p', null, d.strategy), effects(describeEffects(d.effects)), h('p', { class: 'small' }, `Costs ${ideologyCost(sim, me)} crowns now and a year of upheaval (unrest +8, research −10%); a new head of government takes office; the next change is possible in ten years.`)], () => app.do({ type: 'setIdeology', ideology: id }), 'Adopt', false), { cls: 'small', fk: `gov-ideology-${id}`, disabled: prob })),
      h('div', { class: 'small muted' }, d.strategy),
      effects(describeEffects(d.effects)),
      prob ? h('div', { class: 'small warn' }, prob) : null,
    );
  });
  return section(
    'Form of government',
    h('div', { class: 'callout info', style: 'display:block', 'data-sk': 'gov-current' }, h('b', null, def.label), h('div', { class: 'small' }, def.strategy), effects(describeEffects(def.effects)), h('div', { class: 'small faint' }, since > 0 ? `Since ${dateOf(sim, since).label}; a change is possible from ${dateOf(sim, since + IDEOLOGY_WAIT_WEEKS).label}.` : 'As at the start of the campaign: a change is possible now.')),
    h('details', null, h('summary', { class: 'small' }, `The other forms (${cards.length})`), ...cards),
  );
}

function leaderSection(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const l = leaderOf(sim, me);
  const t = LEADER_TRAITS[l.trait];
  const term = ideologyOf(sim, me) === 'democracy' ? 'Elections every five years.' : 'Serves a long tenure (twelve to twenty years).';
  return section(
    'Head of government',
    h('div', { class: 'gc-head' }, icon('crown'), h('b', { class: 'grow' }, `${l.name} — ${t.label}`), h('span', { class: 'small faint' }, l.since > 0 ? `in office since ${dateOf(sim, l.since).year}` : 'in office at the start')),
    h('p', { class: 'small' }, t.summary),
    h('p', { class: 'small muted' }, `${term} You may replace the head of government once in three years for ${replaceLeaderCost(sim, me)} crowns and six months of unrest (+4).`),
    h(
      'div',
      { class: 'row wrap', style: 'gap:6px' },
      LEADER_TRAIT_IDS.filter((x) => x !== l.trait).map((trait: LeaderTrait) =>
        button(`A ${LEADER_TRAITS[trait].label.toLowerCase()}`, () => app.do({ type: 'replaceLeader', trait }), { cls: 'small quiet', fk: `gov-leader-${trait}`, disabled: checkCommand(sim, { type: 'replaceLeader', nation: me, trait }), title: LEADER_TRAITS[trait].summary }),
      ),
    ),
  );
}

function formableSection(app: App): HTMLElement | null {
  const sim = app.sim!;
  const me = app.player!;
  const list = formablesFor(sim, me);
  const n = sim.state.nations[me];
  if (!list.length && !n.formed) return null;
  if (n.formed) {
    const f = FORMABLES[n.formed.id];
    return section('Nation', h('p', null, h('b', null, f.name), ` proclaimed ${dateOf(sim, n.formed.tick).label}. ${f.summary}`), effects(describeEffects(f.effects)));
  }
  return section(
    'A nation to proclaim',
    ...list.map((id) => {
      const f = FORMABLES[id];
      const c = checkFormable(sim, me, id);
      return h(
        'div',
        { class: 'group-card', 'data-sk': `formable-${id}` },
        h(
          'div',
          { class: 'gc-head' },
          h('b', { class: 'grow' }, f.name),
          button('Show on the map', () => app.showProvinces(c.missing.length ? c.missing : formableProvinces(sim, id), c.missing.length ? `${f.short}: ${c.missing.length} provinces still to hold` : `${f.short}: its land`), { cls: 'small quiet', icon: 'target', fk: `gov-form-show-${id}` }),
          button('Proclaim…', () => confirmDialog(app, `Proclaim the ${f.name}?`, [h('p', null, f.summary), effects(describeEffects(f.effects)), h('p', { class: 'small' }, `Costs ${c.cost} crowns. Our realm keeps its forces, treaties, research and operations; its provinces of the union that are not yet integrated gain 20 integration; neighbours are alarmed (+10). Once a campaign.`)], () => app.do({ type: 'formNation', formable: id }), 'Proclaim', false), { cls: 'small primary', fk: `gov-form-${id}`, disabled: c.ok ? null : 'Not every condition is met (see the list).' }),
        ),
        h('div', { class: 'small muted' }, f.summary),
        effects(describeEffects(f.effects)),
        h('ul', { class: 'checklist small' }, c.conditions.map((x) => h('li', { class: x.met ? 'good' : 'bad' }, icon(x.met ? 'check' : 'close'), ` ${x.text}`))),
      );
    }),
  );
}

function commanderSection(app: App): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const me = app.player!;
  const list = commandersOf(sim, me);
  const ops = Object.values(st.operations).filter((o) => o.nation === me && o.status !== 'complete');
  const forces = (c: Commander) =>
    c.branch === 'land'
      ? Object.values(st.armies).filter((a) => a.nation === me).sort((a, b) => b.regiments.length - a.regiments.length).map((a) => [a.id, `${a.name} (${a.regiments.length} regiments)`] as [string, string])
      : c.branch === 'sea'
        ? Object.values(st.fleets).filter((f) => f.nation === me).sort((a, b) => b.ships.length - a.ships.length).map((f) => [f.id, `${f.name} (${f.ships.length} ships)`] as [string, string])
        : Object.values(st.wings).filter((w) => w.nation === me).map((w) => [w.id, w.name] as [string, string]);
  const row = (c: Commander) => {
    const sel = h(
      'select',
      { 'data-fk': `cmd-assign-${c.id}`, 'aria-label': `Command of ${c.name}` },
      h('option', { value: '' }, 'Unassigned'),
      ...forces(c).slice(0, 40).map(([id, label]) => h('option', { value: id, selected: c.assigned === id ? true : undefined }, label)),
      ...ops.map((o) => h('option', { value: o.id, selected: c.assigned === o.id ? true : undefined }, `Operation: ${o.name}`)),
    ) as HTMLSelectElement;
    sel.addEventListener('change', () => app.do({ type: 'assignCommander', commander: c.id, to: sel.value || null }));
    return h('div', { class: 'kv' }, h('span', { class: 'k' }, h('b', null, `${BRANCH_LABELS[c.branch][0]} ${c.name}`), h('div', { class: 'small muted' }, `${COMMANDER_TRAITS[c.trait].label}: ${COMMANDER_TRAITS[c.trait].summary}`)), h('span', { class: 'v' }, sel));
  };
  const limits = (['land', 'sea', 'air'] as const).map((b) => `${BRANCH_LABELS[b][1]} ${list.filter((c) => c.branch === b).length} of ${commandLimit(sim, me, b)}`).join(' · ');
  return section(
    'Commanders',
    h('p', { class: 'small muted' }, 'Each leads one army, fleet or air wing — or an operation, where it leads the members of its branch that have no commander of their own. A force has one commander at most: assigning another relieves the first. Its effect counts only where that force fights, recovers or repairs.'),
    list.length ? h('div', { 'data-sk': 'commanders' }, list.map(row)) : h('p', { class: 'small muted' }, 'No commanders yet.'),
    h('div', { class: 'small', style: 'margin-top:6px' }, `${limits} — limits grow with regiments (one more per 15), ships (per 8) and wings (per 4).`),
    h(
      'details',
      null,
      h('summary', { class: 'small' }, `Appoint a commander (${recruitCommanderCost(sim, me)} crowns)`),
      h(
        'div',
        { class: 'row wrap', style: 'gap:6px' },
        COMMANDER_TRAIT_IDS.map((t: CommanderTrait) => button(`${BRANCH_LABELS[COMMANDER_TRAITS[t].branch][0]}: ${COMMANDER_TRAITS[t].label}`, () => app.do({ type: 'recruitCommander', trait: t }), { cls: 'small quiet', fk: `cmd-recruit-${t}`, disabled: checkCommand(sim, { type: 'recruitCommander', nation: me, trait: t }), title: COMMANDER_TRAITS[t].summary })),
      ),
    ),
  );
}

function cabinetSection(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const n = sim.state.nations[me];
  const t = n.cabinet?.trade;
  if (!t) {
    const cands = tradeCandidates(sim, me);
    return section(
      'Cabinet: trade',
      h('p', { class: 'small muted' }, 'A trade minister keeps the realm supplied through the ordinary trade system: each month it buys the goods you allow that the forecast says will fall short of their targets, from permitted partners with a surplus, within your monthly budget and price limit — and, if you allow it, sells what lies well above a target. It never touches contracts you signed, never turns round on a good within six months, and does nothing else. Without one, trade works exactly as before.'),
      h(
        'div',
        { 'data-sk': 'cabinet-candidates' },
        cands.map((c, i) =>
          h('div', { class: 'kv' }, h('span', { class: 'k' }, h('b', null, c.name), h('div', { class: 'small muted' }, `Competence ${c.competence}: manages up to ${MANAGED[c.competence - 1]} contracts, ${c.competence === 3 ? 'opens at the list price' : `opens ${(3 - c.competence) * 5}% above it`}`)), h('span', { class: 'v' }, `${c.salary} cr/mo `, button(`Hire (${hireFee(c.salary)} cr)`, () => app.do({ type: 'cabinet', action: 'hire', candidate: i }), { cls: 'small', fk: `cab-hire-${i}`, disabled: checkCommand(sim, { type: 'cabinet', nation: me, action: 'hire', candidate: i }) }))),
        ),
      ),
    );
  }
  const s = t.settings;
  const set = (patch: Record<string, unknown>) => app.do({ type: 'cabinet', action: 'settings', settings: patch });
  const goods = TRADEABLE.map((r: Tradeable) => {
    const box = h('input', { type: 'checkbox', 'data-fk': `cab-res-${r}` }) as HTMLInputElement;
    box.checked = s.resources.includes(r);
    box.addEventListener('change', () => set({ resources: box.checked ? [...s.resources, r] : s.resources.filter((x) => x !== r) }));
    const target = h('input', { type: 'number', min: '0', step: '5', value: String(Math.round(stockTarget(sim, me, t, r))), style: 'width:5em', 'aria-label': `${resLabel(r)} target`, 'data-fk': `cab-target-${r}` }) as HTMLInputElement;
    target.addEventListener('change', () => set({ targets: { [r]: Math.max(0, Number(target.value) || 0) } }));
    return h('tr', null, h('td', null, h('label', { class: 'switch' }, box, h('span', null, resLabel(r)))), h('td', { class: 'r' }, target), h('td', { class: 'r small' }, String(Math.floor(r === 'food' ? n.supplies : (n.stock[r] ?? 0)))));
  });
  const partners = treatyPartners(sim, 'trade', me).filter((o) => sim.state.nations[o]?.alive);
  const budget = h('input', { type: 'number', min: '0', step: '5', value: String(s.budget), style: 'width:6em', 'data-fk': 'cab-budget' }) as HTMLInputElement;
  budget.addEventListener('change', () => set({ budget: Math.max(0, Number(budget.value) || 0) }));
  const maxP = h('select', { 'data-fk': 'cab-maxprice' }, [1, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4, 1.6].map((v) => h('option', { value: String(v), selected: Math.abs(s.maxPrice - v) < 1e-9 ? true : undefined }, `${Math.round(v * 100)}% of list`))) as HTMLSelectElement;
  maxP.addEventListener('change', () => set({ maxPrice: Number(maxP.value) }));
  const sell = h('input', { type: 'checkbox', 'data-fk': 'cab-sell' }) as HTMLInputElement;
  sell.checked = s.sell;
  sell.addEventListener('change', () => set({ sell: sell.checked }));
  const committed = sim.state.contracts.filter((c) => t.managed.includes(c.id) && c.buyer === me).reduce((a, c) => a + c.qty * c.price, 0);
  return section(
    'Cabinet: trade',
    h(
      'div',
      { class: 'gc-head', 'data-sk': 'cabinet-trade' },
      h('b', { class: 'grow' }, `${t.name} (competence ${t.competence}, ${t.salary} cr/mo)`),
      h('span', { class: `tag ${t.paused ? 'warn' : 'good'}` }, t.paused ? 'Paused' : 'At work'),
      button(t.paused ? 'Resume' : 'Pause', () => app.do({ type: 'cabinet', action: t.paused ? 'resume' : 'pause' }), { cls: 'small quiet', fk: 'cab-pause' }),
      button('Dismiss', () => app.do({ type: 'cabinet', action: 'dismiss' }), { cls: 'small quiet', fk: 'cab-dismiss', title: 'Its contracts run to term under your direct management' }),
    ),
    h('div', { class: 'small' }, `Manages ${t.managed.length} of ${MANAGED[t.competence - 1]} contracts; its purchases cost ${committed.toFixed(1)} of the ${s.budget} crowns a month allowed.`),
    h('div', { class: 'row wrap', style: 'gap:12px;margin:6px 0' }, h('label', null, 'Monthly budget ', budget, ' cr'), h('label', null, 'Pays at most ', maxP), h('label', { class: 'switch' }, sell, h('span', null, `May sell surpluses (at ${Math.round(s.minPrice * 100)}% of list or more)`))),
    h('div', { class: 'table-scroll' }, h('table', { class: 'register compact' }, h('thead', null, h('tr', null, h('th', null, 'Good it may trade'), h('th', { class: 'r' }, 'Keep at least'), h('th', { class: 'r' }, 'Stock'))), h('tbody', null, goods))),
    partners.length
      ? h('div', { class: 'small', style: 'margin-top:6px' }, 'Partners: ', ...partners.map((o) => {
          const box = h('input', { type: 'checkbox', 'data-fk': `cab-partner-${o}` }) as HTMLInputElement;
          box.checked = !s.partners.length || s.partners.includes(o);
          box.addEventListener('change', () => {
            const all = s.partners.length ? s.partners : partners;
            set({ partners: box.checked ? [...all, o] : all.filter((x) => x !== o) });
          });
          return h('label', { class: 'switch', style: 'margin-right:8px' }, box, h('span', null, nationName(sim, o)));
        }))
      : h('p', { class: 'small warn' }, 'No trade agreements yet: the minister deals only with realms we have one with (Diplomacy).'),
    t.log.length ? h('details', { open: true }, h('summary', { class: 'small' }, 'Report'), h('ul', { class: 'notes small', 'data-sk': 'cabinet-log' }, t.log.slice(-8).reverse().map((l) => h('li', null, `${dateOf(sim, l.tick).short}: ${l.text}`)))) : h('p', { class: 'small faint' }, 'It reports here after the next monthly settlement.'),
  );
}

function modifierSection(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player!;
  const rows = modBreakdown(modSources(sim, me));
  return h(
    'details',
    { class: 'section' },
    h('summary', { class: 'eyebrow' }, `National modifiers and their sources (${rows.length})`),
    h('p', { class: 'small muted' }, 'Every source adds to the same total, once: national character, research, national focus, the form of government, a proclaimed nation, the head of government, timed effects and the treasury. Commanders add to the forces they lead only.'),
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'register compact', 'data-sk': 'mod-sources' },
        h('thead', null, h('tr', null, h('th', null, 'Modifier'), h('th', { class: 'r' }, 'Total'), h('th', null, 'From'))),
        h('tbody', null, rows.map((r) => h('tr', null, h('td', null, MOD_LABELS[r.key][0]), h('td', { class: 'r' }, h('b', null, formatMod(r.key, r.total))), h('td', { class: 'small' }, r.parts.map((p) => `${p.label} ${formatMod(r.key, p.value)}`).join(' · '))))),
      ),
    ),
  );
}
