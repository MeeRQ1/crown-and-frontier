// Province batches (format 8): the provinces selected together (Ctrl/Cmd+click
// or Ctrl/Cmd+drag on the map, or the Select tool on touch), a summary, and one
// existing project or regiment type for all of them at once, with a preview of
// every province (what it gets, or why not), the totals, the shared limits, and
// one confirmation. Single-province actions are unchanged.

import { BATCH_ORDER_LABELS, previewBatchBuild, previewBatchRecruit, RECRUIT_MAX_PER_PROVINCE, type BatchOrder } from '../../sim/batch';
import { RESOURCE_INFO, UNITS, UNIT_TYPES } from '../../sim/config';
import { PROJECT_LABELS } from '../../sim/construction';
import { unitUnlocked } from '../../sim/military';
import { provName } from '../../sim/state';
import type { ProjectKind, ProvinceId, StrategicResource, UnitType } from '../../sim/types';
import type { App } from '../app';
import { button, h, row } from '../dom';
import { fmt, plural } from '../format';
import { icon } from '../icons';
import { section } from './common';

export interface BatchUI {
  tab: 'build' | 'recruit';
  kind: ProjectKind;
  order: BatchOrder;
  unit: UnitType;
  count: number;
  mode: 'per' | 'total';
  /** the request last sent (the same request is not sent twice by a second click) and what happened */
  last: { key: string; message: string; details: string[] } | null;
}

export function freshBatchUI(): BatchUI {
  return { tab: 'build', kind: 'infra', order: 'selected', unit: 'infantry', count: 1, mode: 'per', last: null };
}

const KINDS: ProjectKind[] = ['dev', 'infra', 'factory', 'fort', 'charter', 'port', 'airfield', 'flak'];

function seg<T extends string | number>(label: string, value: T, options: Array<[T, string]>, set: (v: T) => void): HTMLElement {
  return h(
    'div',
    { class: 'field', style: 'margin-top:6px' },
    h('span', { class: 'label' }, label),
    h(
      'div',
      { class: 'segmented wrap' },
      options.map(([v, l]) => {
        const b = h('button', { class: v === value ? 'active' : '', type: 'button', 'data-fk': `batch-${label}-${v}`, 'aria-pressed': v === value ? 'true' : 'false' }, l);
        b.addEventListener('click', () => set(v));
        return b;
      }),
    ),
  );
}

export function provinceBatchCard(app: App): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const me = app.player;
  const ui = app.batch;
  const sel = app.provSel.filter((p) => st.provinces[p]);
  const ours = sel.filter((p) => st.provinces[p].owner === me);
  const out: HTMLElement[] = [];
  const close = h('button', { class: 'btn quiet small icon close', type: 'button', 'aria-label': 'Clear the province selection (Esc)', 'data-fk': 'ins-close' }, icon('close'));
  close.addEventListener('click', () => app.clearProvSel());
  const regions = [...new Set(sel.map((p) => sim.world.prov[p].region))];
  out.push(
    h(
      'div',
      { class: 'ins-head' },
      h('div', { class: 'grow' }, h('h2', null, `${plural(sel.length, 'province')} selected`), h('div', { class: 'sub' }, `${ours.length} ours${sel.length - ours.length ? ` · ${sel.length - ours.length} of other realms` : ''} · development ${sel.reduce((s, p) => s + st.provinces[p].dev, 0)} · ${plural(regions.length, 'region')}`)),
      close,
    ),
  );
  const tabs = h(
    'div',
    { class: 'ins-primary' },
    button('Build', () => setTab('build'), { cls: `small ${ui.tab === 'build' ? 'primary' : ''}`, icon: 'build', fk: 'batch-tab-build' }),
    button('Recruit', () => setTab('recruit'), { cls: `small ${ui.tab === 'recruit' ? 'primary' : ''}`, icon: 'army', fk: 'batch-tab-recruit' }),
    button('Only ours', () => app.setProvSel(ours), { cls: 'small quiet', fk: 'batch-ours', disabled: ours.length === sel.length ? 'All are ours' : null }),
    button('Whole regions', () => app.setProvSel([...new Set([...sel, ...sim.world.provIds.filter((p) => regions.includes(sim.world.prov[p].region) && st.provinces[p].owner === me)])]), { cls: 'small quiet', fk: 'batch-regions', title: 'Add every province of ours in the regions of the selection' }),
  );
  out.push(tabs);
  function setTab(t: 'build' | 'recruit') {
    ui.tab = t;
    app.refresh();
  }
  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins-batch' });
  if (!me) {
    body.appendChild(h('p', null, 'Observing: no realm to build for.'));
    out.push(body);
    return out;
  }
  const set = (patch: Partial<BatchUI>) => {
    Object.assign(ui, patch);
    app.refresh();
  };
  body.appendChild(seg('Order if not all can be done', ui.order, (Object.keys(BATCH_ORDER_LABELS) as BatchOrder[]).map((k) => [k, BATCH_ORDER_LABELS[k]]), (v) => set({ order: v })));
  body.appendChild(h('p', { class: 'small muted' }, 'The provinces are taken in this order, each paid from what is left after the ones before it: if the money, materials or slots run out, the rest are skipped (and listed), never overspent. Confirming sends exactly what is shown; each province is checked again as it is queued.'));
  if (ui.tab === 'build') {
    const kinds = KINDS.filter((k) => (k !== 'airfield' || st.nations[me].research.done.includes('aviation')) && (k !== 'flak' || st.nations[me].research.done.includes('air_defence')));
    const SHORT: Record<ProjectKind, string> = { dev: 'Develop', infra: 'Railway', factory: 'Factory', fort: 'Fort', charter: 'Charters', settle: 'Settle', port: 'Port', airfield: 'Airfield', flak: 'Anti-aircraft' };
    body.appendChild(seg('Project', ui.kind, kinds.map((k) => [k, SHORT[k]]), (v) => set({ kind: v })));
    const pv = previewBatchBuild(sim, me, ui.kind, sel, ui.order);
    const key = JSON.stringify(['b', ui.kind, pv.queued, st.tick]);
    const skipped = pv.rows.filter((r) => !r.ok);
    body.appendChild(
      section(
        `${PROJECT_LABELS[ui.kind]}: ${pv.queued.length} of ${sel.length} queued`,
        row('Total cost', `${fmt(pv.total.crowns)} crowns${pv.total.food ? `, ${pv.total.food} food` : ''}${pv.total.iron ? `, ${pv.total.iron} iron` : ''}${pv.total.men ? `, ${pv.total.men} men` : ''}`),
        pv.upkeep ? row('Upkeep once built', `${fmt(pv.upkeep, 1)} crowns a month`) : null,
        row('Construction slots', `${pv.queued.length} of ${pv.slots.free} free (${pv.slots.total} in all)`),
        row('Left after', `${fmt(pv.left.crowns)} crowns`),
        ...pv.rows.map((r) => h('div', { class: `kv ${r.ok ? '' : 'muted'}` }, h('span', { class: 'k' }, provName(sim, r.pid)), h('span', { class: `v small ${r.ok ? '' : 'why'}` }, r.ok ? `${r.change} · ${r.cost!.crowns} cr · ${r.cost!.weeks} wk` : `skipped: ${r.reason!.replace(/\.$/, '')}`))),
      ),
    );
    const sent = ui.last?.key === key;
    body.appendChild(
      h(
        'div',
        { class: 'row wrap', style: 'gap:6px;margin-top:8px' },
        button(sent ? 'Queued' : `Queue ${plural(pv.queued.length, 'project')}`, () => submit(key, { type: 'batchBuild', project: ui.kind, provinces: pv.queued }), { cls: 'small primary', fk: 'batch-confirm', disabled: sent ? 'This request was just sent: change it to queue more.' : !pv.queued.length ? (skipped[0]?.reason ?? 'Nothing to queue.') : null }),
      ),
    );
  } else {
    const units = UNIT_TYPES.filter((u) => unitUnlocked(sim, me, u));
    body.appendChild(seg('Regiment', ui.unit, units.map((u) => [u, UNITS[u].label]), (v) => set({ unit: v })));
    body.appendChild(seg('Quantity', ui.mode, [['per', 'In each province'], ['total', 'In all, spread over them']], (v) => set({ mode: v })));
    const stepper = h('div', { class: 'row', style: 'gap:6px;margin-top:6px;align-items:center' }, button('−', () => set({ count: Math.max(1, ui.count - 1) }), { cls: 'small', fk: 'batch-minus', disabled: ui.count <= 1 ? 'At least one' : null }), h('b', { 'data-fk': 'batch-count' }, String(ui.count)), button('+', () => set({ count: Math.min(ui.mode === 'per' ? RECRUIT_MAX_PER_PROVINCE : 100, ui.count + 1) }), { cls: 'small', fk: 'batch-plus' }), h('span', { class: 'small muted' }, ui.mode === 'per' ? `regiment${ui.count === 1 ? '' : 's'} in each eligible province (at most ${RECRUIT_MAX_PER_PROVINCE})` : `regiment${ui.count === 1 ? '' : 's'} in all, one province at a time in the order above`));
    body.appendChild(stepper);
    const pv = previewBatchRecruit(sim, me, ui.unit, sel, ui.count, ui.mode, ui.order);
    const key = JSON.stringify(['r', ui.unit, pv.alloc, st.tick]);
    const res = Object.entries(pv.cost.resources) as Array<[StrategicResource, number]>;
    body.appendChild(
      section(
        `${UNITS[ui.unit].label}: ${pv.queued} of ${pv.asked} regiments`,
        row('Total cost', `${fmt(pv.cost.crowns)} crowns, ${fmt(pv.cost.materiel)} materiel, ${pv.cost.men.toLocaleString()} men${res.length ? `, ${res.map(([r, v]) => `${v} ${RESOURCE_INFO[r].label.toLowerCase()}`).join(', ')}` : ''}`),
        row('Upkeep once raised', `${fmt(pv.upkeep, 1)} crowns a month`),
        row('Shared pools', `treasury ${fmt(st.nations[me].treasury)} · materiel ${fmt(st.nations[me].materiel)} · men ${Math.floor(st.nations[me].manpower).toLocaleString()}`),
        pv.limit ? h('div', { class: 'callout warn' }, icon('alert'), `Ran out of ${pv.limit}: ${pv.asked - pv.queued} not queued.`) : null,
        ...pv.rows.map((r) => h('div', { class: `kv ${r.queued ? '' : 'muted'}` }, h('span', { class: 'k' }, provName(sim, r.pid)), h('span', { class: `v small ${r.reason && !r.queued ? 'why' : ''}` }, `${r.queued ? `${r.queued} queued` : 'none'}${r.inQueue ? ` (${r.inQueue} already training)` : ''}${r.reason ? ` · ${r.reason.replace(/\.$/, '')}` : ''}`))),
        h('p', { class: 'small faint' }, `Training takes ${UNITS[ui.unit].weeks} weeks; queued regiments can be cancelled from each province (men and materiel are returned, crowns are lost).`),
      ),
    );
    const sent = ui.last?.key === key;
    body.appendChild(
      h(
        'div',
        { class: 'row wrap', style: 'gap:6px;margin-top:8px' },
        button(sent ? 'Queued' : `Raise ${plural(pv.queued, 'regiment')}`, () => submit(key, { type: 'batchRecruit', unit: ui.unit, alloc: pv.alloc }), { cls: 'small primary', fk: 'batch-confirm', disabled: sent ? 'This request was just sent: change it to raise more.' : !pv.queued ? 'Nothing can be raised here now.' : null }),
      ),
    );
  }
  if (ui.last) body.appendChild(section('Last batch', h('p', null, ui.last.message), ...ui.last.details.slice(0, 20).map((d) => h('div', { class: 'small' }, d))));
  body.appendChild(h('p', { class: 'small faint' }, 'Ctrl/Cmd+click provinces to add or remove them, Ctrl/Cmd+drag a box; on touch, press Select (X) twice for provinces. Esc clears.'));
  out.push(body);
  return out;

  function submit(key: string, cmd: Parameters<App['do']>[0]) {
    // a second click before the card is drawn again (a double click) sends nothing
    if (ui.last?.key === key) return;
    const r = app.do(cmd, true);
    if (!r.ok) return;
    ui.last = { key, message: r.message ?? 'Done.', details: r.details ?? [] };
    app.toast(r.message ?? 'Done.', 'good');
    app.refresh();
  }
}

export function provinceSelectionSummary(app: App, list: ProvinceId[]): string {
  const sim = app.sim!;
  return list.slice(0, 4).map((p) => provName(sim, p)).join(', ') + (list.length > 4 ? '…' : '');
}

