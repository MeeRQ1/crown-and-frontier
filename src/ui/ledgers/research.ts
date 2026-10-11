// Research: an era-by-branch workspace. Technologies are laid out with time
// running left to right (eras, then the order of dependencies within an era)
// and one lane per branch; connectors show what each one needs. The inspector
// beside the plane explains the selected technology before it is chosen: its
// horizon year and early premium, its cost and time at the current rate, its
// practical effect apart from its flavour, and what it needs and leads to.

import { forceLabel } from '../../sim/config';
import { BRANCHES, ERAS, TECH_LIST, TECHS, type Branch, type Era } from '../../sim/data/techs';
import { describeEffects } from '../../sim/modifiers';
import { earliestYear, researchProblem, researchRate, TECH_EARLY_COST, TECH_LEAD_YEARS, techCost, yearsEarly } from '../../sim/progression';
import { dateOf, type Sim } from '../../sim/state';
import type { NationId } from '../../sim/types';
import type { App } from '../app';
import { action, bar, h } from '../dom';
import { treeLegend, treePlane, type NodeState, type TreeBand, type TreeEdge, type TreeNode } from '../tree';

const NODE_W = 150;
const NODE_H = 60;
const GAP_X = 30;
const GAP_Y = 10;
const LANE_HEAD = 24;
const ERA_PAD = 14;
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

interface Layout {
  pos: Map<string, { x: number; y: number }>;
  lanes: TreeBand[];
  columns: TreeBand[];
}

let cached: Layout | null = null;

/** Positions are fixed by the tree itself, so they are worked out once. */
function layout(): Layout {
  if (cached) return cached;
  const branches = (Object.keys(BRANCHES) as Branch[]).filter((b) => TECH_LIST.some((t) => t.branch === b));
  const eras = [1, 2, 3, 4, 5] as Era[];
  // depth inside an era and branch: how many same-cell prerequisites come first
  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const t = TECHS[id];
    let d = 0;
    for (const r of t.requires) if (TECHS[r].era === t.era && TECHS[r].branch === t.branch) d = Math.max(d, depthOf(r) + 1);
    depth.set(id, d);
    return d;
  };
  const subCols = new Map<Era, number>();
  for (const e of eras) subCols.set(e, 1 + Math.max(0, ...TECH_LIST.filter((t) => t.era === e).map((t) => depthOf(t.id))));
  const columns: TreeBand[] = [];
  const eraX = new Map<Era, number>();
  let x = 0;
  for (const e of eras) {
    const w = subCols.get(e)! * (NODE_W + GAP_X) - GAP_X + ERA_PAD * 2;
    eraX.set(e, x);
    columns.push({ label: `Era ${ROMAN[e - 1]} · ${ERAS[e].name}`, sub: `from ${ERAS[e].year}`, at: x, size: w });
    x += w;
  }
  // rows: stack nodes sharing a cell and depth, ordered by where their prerequisites sit
  const row = new Map<string, number>();
  const laneRows = new Map<Branch, number>();
  for (const b of branches) {
    let rows = 1;
    for (const e of eras) {
      const cell = TECH_LIST.filter((t) => t.era === e && t.branch === b);
      const maxD = Math.max(-1, ...cell.map((t) => depthOf(t.id)));
      for (let d = 0; d <= maxD; d++) {
        const at = cell.filter((t) => depthOf(t.id) === d);
        const want = (id: string) => {
          const rs = TECHS[id].requires.map((r) => row.get(r)).filter((v): v is number => v !== undefined);
          return rs.length ? rs.reduce((a, v) => a + v, 0) / rs.length : 99;
        };
        at.sort((p, q) => want(p.id) - want(q.id) || TECH_LIST.indexOf(p) - TECH_LIST.indexOf(q));
        const used = new Set<number>();
        for (const t of at) {
          // the free row nearest the prerequisites' rows keeps connectors straight
          const w = want(t.id);
          let r = 0;
          if (w !== 99) {
            let best = Infinity;
            for (let c = 0; c < at.length + 4; c++) if (!used.has(c) && Math.abs(c - w) < best) (best = Math.abs(c - w)), (r = c);
          } else while (used.has(r)) r++;
          used.add(r);
          row.set(t.id, r);
          rows = Math.max(rows, r + 1);
        }
      }
    }
    laneRows.set(b, rows);
  }
  const lanes: TreeBand[] = [];
  const laneY = new Map<Branch, number>();
  let y = 0;
  for (const b of branches) {
    const size = LANE_HEAD + laneRows.get(b)! * (NODE_H + GAP_Y) + GAP_Y;
    laneY.set(b, y);
    lanes.push({ label: BRANCHES[b].name, at: y, size });
    y += size;
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const t of TECH_LIST) pos.set(t.id, { x: eraX.get(t.era)! + ERA_PAD + depthOf(t.id) * (NODE_W + GAP_X), y: laneY.get(t.branch)! + LANE_HEAD + row.get(t.id)! * (NODE_H + GAP_Y) });
  cached = { pos, lanes, columns };
  return cached;
}

function stateOf(sim: Sim, nid: NationId, id: string): NodeState {
  const n = sim.state.nations[nid];
  if (n.research.done.includes(id)) return 'done';
  if (n.research.current === id) return 'current';
  if (TECHS[id].requires.some((r) => !n.research.done.includes(r))) return 'locked';
  if (yearsEarly(sim, id) > TECH_LEAD_YEARS) return 'early';
  return 'available';
}

const STATE_TEXT: Record<NodeState, string> = {
  done: 'Researched',
  current: 'Being researched',
  available: 'Can be researched now',
  locked: 'Needs an earlier technology',
  early: 'Too far ahead of its time',
  excluded: 'Excluded',
};

function months(points: number, rate: number): number {
  return Math.max(1, Math.ceil(points / Math.max(0.1, rate)));
}

export function researchLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return h('p', { class: 'muted' }, 'Observer mode: no realm of your own.');
  const n = sim.state.nations[pid];
  const rate = researchRate(sim, pid);
  const year = dateOf(sim).year;
  const L = layout();
  // the inspector follows the selection; with none, the current project, else the first one open now
  const sel = (app.ui.techSel && TECHS[app.ui.techSel] ? app.ui.techSel : null) ?? n.research.current ?? TECH_LIST.find((t) => stateOf(sim, pid, t.id) === 'available')?.id ?? TECH_LIST[0].id;
  const nodes: TreeNode[] = TECH_LIST.map((t) => {
    const st = stateOf(sim, pid, t.id);
    const p = L.pos.get(t.id)!;
    const cost = techCost(sim, t.id);
    return {
      id: t.id,
      x: p.x,
      y: p.y,
      title: t.name,
      meta: st === 'done' ? `${t.year} · researched` : st === 'early' ? `from ${earliestYear(t.id)}` : `${t.year} · ${cost} pts`,
      state: st,
      progress: st === 'current' ? n.research.progress / Math.max(1, cost) : undefined,
      stateText: STATE_TEXT[st],
    };
  });
  const edges: TreeEdge[] = TECH_LIST.flatMap((t) => t.requires.map((r) => ({ from: r, to: t.id, kind: 'requires' as const })));
  const nowEra = ([5, 4, 3, 2, 1] as Era[]).find((e) => year >= ERAS[e].year) ?? 1;
  const columns = L.columns.map((c, i) => (i + 1 === nowEra ? { ...c, sub: `${c.sub} · now` } : c));
  const plane = treePlane({
    key: 'research-plane',
    label: 'Technologies by era and branch',
    nodes,
    edges,
    lanes: L.lanes,
    columns,
    nodeW: NODE_W,
    nodeH: NODE_H,
    selected: sel,
    onSelect: (id) => {
      app.ui.techSel = id;
      app.refresh();
    },
  });

  const cur = n.research.current ? TECHS[n.research.current] : null;
  const curCost = cur ? techCost(sim, cur.id) : 0;
  const strip = h(
    'div',
    { class: 'strip' },
    h('div', null, h('span', { class: 'k' }, 'Rate'), h('b', null, `${rate.toFixed(2)} pts/mo`)),
    h('div', null, h('span', { class: 'k' }, 'Researching'), h('b', { class: cur ? '' : 'warn' }, cur ? cur.name : 'Nothing')),
    h('div', null, h('span', { class: 'k' }, cur ? 'Progress' : 'Banked'), h('b', null, cur ? `${Math.floor(n.research.progress)} / ${curCost}` : `${Math.floor(n.research.progress)} of 60`)),
    h('div', null, h('span', { class: 'k' }, cur ? 'Done in' : 'Researched'), h('b', null, cur ? `~${months(curCost - n.research.progress, rate)} months` : `${n.research.done.length} of ${TECH_LIST.length}`)),
  );
  const note = cur
    ? null
    : h('div', { class: 'callout warn small', role: 'status' }, 'Nothing is being researched: points bank up to 60 and the rest of each month is lost. Choose a technology below.');
  const funding = h(
    'p',
    { class: 'small muted' },
    `Points come from integrated development, research funding and modifiers. `,
    h('button', { type: 'button', class: 'linkish', onclick: () => app.openLedger('realm') }, 'Change funding in Realm & Budget'),
    '.',
  );
  return h(
    'div',
    { class: 'tree-ledger' },
    strip,
    note,
    h('div', { class: 'tree-work' }, h('div', { class: 'tree-main' }, plane, treeLegend([['done', 'Researched'], ['current', 'In progress'], ['available', 'Can start'], ['locked', 'Needs a prerequisite'], ['early', 'Too early']], [['requires', 'Needed for']])), inspector(app, pid, sel, rate)),
    funding,
  );
}

function inspector(app: App, pid: NationId, id: string, rate: number): HTMLElement {
  const sim = app.sim!;
  const n = sim.state.nations[pid];
  const t = TECHS[id];
  const st = stateOf(sim, pid, id);
  const cost = techCost(sim, id);
  const base = Math.round(t.cost * (sim.world.scenario.researchCostMul ?? 1));
  const early = yearsEarly(sim, id);
  const prob = researchProblem(sim, pid, id);
  const pick = (x: string) => {
    app.ui.techSel = x;
    app.refresh();
  };
  const chip = (x: string) => {
    const s = stateOf(sim, pid, x);
    return h('button', { type: 'button', class: `chip ${s}`, onclick: () => pick(x), title: STATE_TEXT[s] }, TECHS[x].name);
  };
  const leadsTo = TECH_LIST.filter((o) => o.requires.includes(id));
  const effects = describeEffects(t.effects);
  const status =
    st === 'done'
      ? h('p', { class: 'state-line good' }, 'Researched. Its effects apply to the realm now.')
      : st === 'current'
        ? h('div', null, h('p', { class: 'state-line' }, `In progress: ${Math.floor(n.research.progress)} of ${cost} points, about ${months(cost - n.research.progress, rate)} months at the current rate.`), bar(n.research.progress, cost, 'info', 'Research progress'))
        : st === 'early'
          ? h('p', { class: 'state-line warn' }, `Too far ahead of its time: research can begin in ${earliestYear(id)}, ${TECH_LEAD_YEARS} years before its ${t.year} horizon.`)
          : st === 'locked'
            ? h('p', { class: 'state-line muted' }, `Needs ${t.requires.filter((r) => !n.research.done.includes(r)).map((r) => TECHS[r].name).join(' and ')} first.`)
            : h('p', { class: 'state-line' }, `Can be researched now: about ${months(Math.max(0, cost - (n.research.current ? 0 : n.research.progress)), rate)} months at ${rate.toFixed(2)} points a month.`);
  const rows: Array<[string, string]> = [
    ['Branch', `${BRANCHES[t.branch].name} · Era ${ROMAN[t.era - 1]}`],
    ['Horizon year', `${t.year}${early > 0 ? ` (${early} year${early === 1 ? '' : 's'} away)` : ''}`],
    ['Cost now', early > 0 ? `${cost} points: ${base} +${Math.round(early * TECH_EARLY_COST * 100)}% for researching early` : `${cost} points`],
  ];
  if (st !== 'done') rows.push(['At the current rate', `about ${months(cost, rate)} months from nothing`]);
  const doIt = () => app.do({ type: 'research', tech: id });
  const switching = n.research.current && n.research.current !== id ? `Switches from ${TECHS[n.research.current].name}; the ${Math.floor(n.research.progress)} points made so far carry over.` : 'Points already banked carry over.';
  return h(
    'aside',
    { class: 'tree-inspector', 'aria-live': 'polite', 'data-sk': 'tech-inspector' },
    h('div', { class: 'eyebrow' }, 'Selected technology'),
    h('h3', null, t.name),
    status,
    h('table', { class: 'register compact' }, h('tbody', null, rows.map(([k, v]) => h('tr', null, h('td', { class: 'muted' }, k), h('td', null, v))))),
    h('h4', null, 'Effect'),
    effects.length || t.unlocks
      ? h('ul', { class: 'notes' }, t.unlocks ? h('li', { class: 'good' }, `Unlocks ${forceLabel(t.unlocks).toLowerCase()}.`) : null, effects.map((e) => h('li', null, e)))
      : h('p', { class: 'small muted' }, 'No direct effect: it opens the way to later technologies.'),
    t.requires.length ? h('div', null, h('h4', null, 'Needs'), h('div', { class: 'chips' }, t.requires.map(chip))) : null,
    leadsTo.length ? h('div', null, h('h4', null, 'Leads to'), h('div', { class: 'chips' }, leadsTo.map((o) => chip(o.id)))) : null,
    h('blockquote', { class: 'flavor' }, t.description),
    st === 'done' || st === 'current' ? null : action(n.research.current ? 'Research this instead' : 'Research this', switching, doIt, prob, 'primary'),
  );
}
