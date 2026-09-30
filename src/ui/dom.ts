// Minimal DOM helpers (no framework).

import { icon, type IconName } from './icons';
import { setRestoringFocus } from './panels/common';

export type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'html') el.innerHTML = String(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function setChildren(el: Element, ...children: Child[]): void {
  clear(el);
  append(el, children);
}

export function button(
  label: Child,
  onClick: () => void,
  opts: { disabled?: string | null | boolean; title?: string; cls?: string; key?: string; icon?: IconName; fk?: string } = {},
): HTMLButtonElement {
  const disabled = !!opts.disabled;
  const b = h(
    'button',
    {
      class: `btn ${opts.cls ?? ''}`.trim(),
      type: 'button',
      title: opts.title ?? (typeof opts.disabled === 'string' ? opts.disabled : undefined),
      'aria-disabled': disabled ? 'true' : undefined,
      'aria-keyshortcuts': opts.key,
      'data-fk': opts.fk ?? (typeof label === 'string' ? label : undefined),
    },
    opts.icon ? icon(opts.icon) : null,
    label,
  );
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (disabled) return;
    onClick();
  });
  if (disabled) b.classList.add('disabled');
  return b;
}

/**
 * Rebuild a container's contents without losing the reader's place: the
 * scroll position and the focused control (matched by its data-fk key) are
 * restored after the rebuild.
 */
export function rebuild(el: Element, render: () => void): void {
  const active = document.activeElement as HTMLElement | null;
  const fk = active && el.contains(active) ? active.getAttribute('data-fk') : null;
  const scrollers = [...el.querySelectorAll('.scroll')].map((s) => [s.getAttribute('data-sk'), (s as HTMLElement).scrollTop] as const);
  render();
  for (const [k, top] of scrollers) {
    if (!k) continue;
    const s = el.querySelector(`.scroll[data-sk="${k}"]`) as HTMLElement | null;
    if (s) s.scrollTop = top;
  }
  if (fk) {
    const again = el.querySelector(`[data-fk="${CSS.escape(fk)}"]`) as HTMLElement | null;
    setRestoringFocus(true);
    again?.focus({ preventScroll: true });
    setRestoringFocus(false);
  }
}

/** A button whose unavailability reason is always visible below it (not hover-only). */
export function action(label: Child, detail: Child, onClick: () => void, problem: string | null, cls = ''): HTMLElement {
  return h('div', { class: `action ${problem ? 'is-disabled' : ''}` }, button(label, onClick, { disabled: problem, cls }), h('div', { class: problem ? 'why' : 'detail' }, problem ?? detail));
}

export function bar(value: number, max: number, cls = '', label?: string): HTMLElement {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1e-9, max)) * 100));
  return h(
    'div',
    { class: `meter ${cls}`, role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': Math.round(value), 'aria-label': label },
    h('div', { class: 'meter-fill', style: `width:${pct.toFixed(1)}%` }),
  );
}

export function row(label: Child, value: Child, cls = ''): HTMLElement {
  return h('div', { class: `kv ${cls}` }, h('span', { class: 'k' }, label), h('span', { class: 'v' }, value));
}
