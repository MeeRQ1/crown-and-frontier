// A dependency tree drawn in code: nodes are buttons laid out on a plane, the
// dependencies between them SVG connectors. Used by the Research and National
// Focus workspaces. Time (or depth) runs left to right; lanes group branches.
// The plane scrolls in both directions and keeps its position across the
// ledger's weekly re-render (rebuild() restores .scroll positions by data-sk);
// the first time it opens it brings the selected node into view.

import { h } from './dom';
import { icon, type IconName } from './icons';

export type NodeState = 'done' | 'current' | 'available' | 'locked' | 'early' | 'excluded';

export interface TreeNode {
  id: string;
  x: number;
  y: number;
  title: string;
  /** one short line under the title: year and cost, months */
  meta: string;
  state: NodeState;
  /** 0–1, shown on the current node */
  progress?: number;
  /** the state in words for screen readers and the tooltip */
  stateText: string;
}

export interface TreeEdge {
  from: string;
  to: string;
  /** requires: needed; any: one of several is needed; excludes: choosing one bars the other */
  kind: 'requires' | 'any' | 'excludes';
}

export interface TreeBand {
  label: string;
  /** offset along the band's axis (y for lanes, x for columns) and its size */
  at: number;
  size: number;
  sub?: string;
}

export interface TreeSpec {
  /** data-sk of the scrolling plane: keeps its scroll position between re-renders */
  key: string;
  label: string;
  nodes: TreeNode[];
  edges: TreeEdge[];
  lanes: TreeBand[];
  columns: TreeBand[];
  nodeW: number;
  nodeH: number;
  selected: string | null;
  onSelect: (id: string) => void;
}

const STATE_ICON: Record<NodeState, IconName | null> = {
  done: 'check',
  current: 'hourglass',
  available: null,
  locked: 'minus',
  early: 'alert',
  excluded: 'close',
};

const HEAD = 30; // column header height
const GUTTER = 0; // lanes carry their label inside the band

export function treePlane(spec: TreeSpec): HTMLElement {
  const { nodes, edges, nodeW, nodeH } = spec;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const W = Math.max(...spec.columns.map((c) => c.at + c.size), ...nodes.map((n) => n.x + nodeW)) + 24;
  const H = HEAD + Math.max(...spec.lanes.map((l) => l.at + l.size), ...nodes.map((n) => n.y + nodeH)) + 16;
  const first = !document.querySelector(`.scroll[data-sk="${CSS.escape(spec.key)}"]`);
  // which edges touch the selected node: drawn on top and darker
  const sel = spec.selected;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tree-edges');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('aria-hidden', 'true');
  const ordered = [...edges].sort((a, b) => Number(a.from === sel || a.to === sel) - Number(b.from === sel || b.to === sel));
  for (const e of ordered) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    let d: string;
    if (e.kind === 'excludes') {
      // mutually exclusive choices: a short dashed tie between the two nodes
      const [p, q] = a.y <= b.y ? [a, b] : [b, a];
      // same step: a bracket in the gap to their left, clear of any node between them
      if (p.x === q.x) d = `M${p.x} ${HEAD + p.y + nodeH * 0.78} C${p.x - 16} ${HEAD + p.y + nodeH * 0.78} ${q.x - 16} ${HEAD + q.y + nodeH * 0.22} ${q.x} ${HEAD + q.y + nodeH * 0.22}`;
      else {
        const [l, r] = p.x < q.x ? [p, q] : [q, p];
        d = `M${l.x + nodeW} ${HEAD + l.y + nodeH / 2} L${r.x} ${HEAD + r.y + nodeH / 2}`;
      }
    } else {
      const x1 = a.x + nodeW;
      const y1 = HEAD + a.y + nodeH / 2;
      const x2 = b.x;
      const y2 = HEAD + b.y + nodeH / 2;
      const mid = Math.max(12, (x2 - x1) / 2);
      d = `M${x1} ${y1} C${x1 + mid} ${y1} ${x2 - mid} ${y2} ${x2} ${y2}`;
    }
    path.setAttribute('d', d);
    const met = a.state === 'done';
    const touch = e.from === sel || e.to === sel;
    path.setAttribute('class', `edge ${e.kind} ${met ? 'met' : ''} ${touch ? 'touch' : ''}`);
    svg.appendChild(path);
    // the "or" label only on ties across steps; a same-step bracket is explained by the legend
    if (e.kind === 'excludes' && a.x !== b.x) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const [p, q] = [a, b];
      t.setAttribute('x', String((p.x + q.x) / 2 + nodeW / 2));
      t.setAttribute('y', String(HEAD + (p.y + q.y) / 2 + nodeH / 2 - 4));
      t.setAttribute('class', 'edge-label');
      t.textContent = 'or';
      svg.appendChild(t);
    }
  }
  const lanes = spec.lanes.map((l, i) =>
    h('div', { class: `tree-lane ${i % 2 ? 'odd' : ''}`, style: `top:${HEAD + l.at}px;height:${l.size}px;width:${W}px` }, h('span', { class: 'tree-lane-label' }, l.label, l.sub ? h('small', null, ` ${l.sub}`) : null)),
  );
  const cols = spec.columns.map((c) => h('div', { class: 'tree-col', style: `left:${c.at + GUTTER}px;width:${c.size}px;height:${H}px` }, h('span', { class: 'tree-col-label' }, c.label, c.sub ? h('small', null, ` ${c.sub}`) : null)));
  const nodeEls = nodes.map((n) => {
    const ic = STATE_ICON[n.state];
    const el = h(
      'button',
      {
        type: 'button',
        class: `tree-node ${n.state} ${n.id === sel ? 'selected' : ''}`,
        style: `left:${n.x}px;top:${HEAD + n.y}px;width:${nodeW}px;height:${nodeH}px`,
        'data-node': n.id,
        'data-fk': `${spec.key}:${n.id}`,
        'aria-pressed': n.id === sel ? 'true' : 'false',
        'aria-label': `${n.title}. ${n.stateText}. ${n.meta}.`,
        title: `${n.title} — ${n.stateText}`,
      },
      h('span', { class: 'tn-title' }, n.title),
      h('span', { class: 'tn-meta' }, ic ? icon(ic) : null, n.meta),
      n.state === 'current' && n.progress !== undefined ? h('span', { class: 'tn-progress', style: `width:${Math.round(Math.min(1, n.progress) * 100)}%` }) : null,
    );
    el.addEventListener('click', () => spec.onSelect(n.id));
    return el;
  });
  const plane = h('div', { class: 'tree-plane', style: `width:${W}px;height:${H}px` }, ...lanes, ...cols, svg, ...nodeEls);
  const scroller = h('div', { class: 'tree-scroll scroll', 'data-sk': spec.key, role: 'group', 'aria-label': spec.label }, plane);
  // arrow keys move between nodes by position: left/right along the time axis, up/down across lanes
  scroller.addEventListener('keydown', (ev) => {
    const k = ev.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return;
    const cur = (document.activeElement as HTMLElement | null)?.getAttribute('data-node');
    const from = cur ? byId.get(cur) : null;
    if (!from) return;
    ev.preventDefault();
    let best: TreeNode | null = null;
    let score = Infinity;
    for (const n of nodes) {
      if (n === from) continue;
      const dx = n.x - from.x;
      const dy = n.y - from.y;
      const along = k === 'ArrowRight' ? dx : k === 'ArrowLeft' ? -dx : k === 'ArrowDown' ? dy : -dy;
      const across = k === 'ArrowRight' || k === 'ArrowLeft' ? Math.abs(dy) : Math.abs(dx);
      if (along <= 0) continue;
      const s = along + across * 2.5;
      if (s < score) (score = s), (best = n);
    }
    if (best) {
      const el = scroller.querySelector(`[data-node="${CSS.escape(best.id)}"]`) as HTMLElement | null;
      el?.focus();
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });
  if (first && sel) {
    const n = byId.get(sel);
    if (n) requestAnimationFrame(() => {
      scroller.scrollLeft = Math.max(0, n.x - 60);
      scroller.scrollTop = Math.max(0, HEAD + n.y - 80);
    });
  }
  return scroller;
}

/** The legend for node states, shown once under the plane. */
export function treeLegend(states: Array<[NodeState, string]>, extra: Array<[string, string]> = []): HTMLElement {
  return h(
    'div',
    { class: 'tree-legend small' },
    states.map(([s, label]) => h('span', { class: `tl-key ${s}` }, h('i', { class: `tree-node mini ${s}` }), label)),
    extra.map(([cls, label]) => h('span', { class: `tl-key ${cls}` }, h('i', { class: `tl-edge ${cls}` }), label)),
  );
}
