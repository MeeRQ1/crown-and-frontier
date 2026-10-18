// A force's commander on its own card (format 9): who leads it (its own, or its
// operation's), what that changes, the force's effective totals with their sources,
// and a quick assignment from the realm's staff.

import { BRANCH_LABELS, commanderOf, commandersOf, COMMANDER_TRAITS, forceSources } from '../../sim/commanders';
import { formatMod, modBreakdown, modSources, MOD_LABELS, type Mods } from '../../sim/modifiers';
import { unitRef } from '../../sim/ops/operations';
import type { App } from '../app';
import { h, row } from '../dom';
import { section } from './common';

const KEYS: Record<'army' | 'fleet' | 'wing', Array<keyof Mods>> = {
  army: ['attack', 'defense', 'moraleRecovery', 'attrition'],
  fleet: ['navalAttack', 'repair'],
  wing: ['airAttack', 'carrierAir'],
};

export function unitCommanderSection(app: App, id: string): HTMLElement | null {
  const sim = app.sim!;
  const r = unitRef(sim, id);
  if (!r || r.unit.nation !== app.player) return null;
  const branch = r.kind === 'army' ? 'land' : r.kind === 'fleet' ? 'sea' : 'air';
  const c = commanderOf(sim, id);
  const staff = commandersOf(sim, app.player!).filter((x) => x.branch === branch);
  const sel = h(
    'select',
    { 'data-fk': 'unit-commander', 'aria-label': 'Commander' },
    h('option', { value: '' }, staff.length ? 'No commander of its own' : `No ${BRANCH_LABELS[branch][1].toLowerCase()} on the staff`),
    staff.map((x) => h('option', { value: x.id, selected: x.assigned === id ? true : undefined }, `${x.name} (${COMMANDER_TRAITS[x.trait].label})${x.assigned && x.assigned !== id ? ' — leads another' : ''}`)),
  ) as HTMLSelectElement;
  sel.addEventListener('change', () => {
    const own = staff.find((x) => x.assigned === id);
    if (sel.value) app.do({ type: 'assignCommander', commander: sel.value, to: id });
    else if (own) app.do({ type: 'assignCommander', commander: own.id, to: null });
  });
  // the force's totals: its realm's and its commander's, one accounting path
  const parts = modBreakdown(forceSources(sim, id, modSources(sim, app.player!))).filter((x) => KEYS[r.kind].includes(x.key));
  return section(
    'Commander',
    c ? h('p', { class: 'small' }, h('b', null, `${BRANCH_LABELS[c.branch][0]} ${c.name}`), ` (${COMMANDER_TRAITS[c.trait].label})${c.assigned === id ? '' : ', through its operation'}: ${COMMANDER_TRAITS[c.trait].summary}`) : h('p', { class: 'small muted' }, 'No commander leads it.'),
    row('Assign', sel),
    parts.length ? h('div', { class: 'small', 'data-sk': 'force-mods' }, parts.map((p) => h('div', null, `${MOD_LABELS[p.key][0]}: ${formatMod(p.key, p.total)}`, h('span', { class: 'faint' }, ` (${p.parts.map((x) => `${x.label} ${formatMod(p.key, x.value)}`).join(', ')})`)))) : null,
  );
}
