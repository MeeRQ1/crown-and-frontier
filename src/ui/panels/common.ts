// Small shared interface pieces: realm shields, sections, and rich tooltips
// (hover on desktop, focus for keyboard users, long-press on touch). Tooltips
// only ever add detail; essential information is always visible without them.

import type { App } from '../app';
import { h } from '../dom';
import { shieldSvg } from '../heraldry';

export function shield(app: App, nid: string | null, cls = ''): Element {
  if (!nid || !app.sim) return h('span', { class: `shield ${cls}`, 'aria-hidden': 'true' });
  const def = app.sim.world.nationDefs[nid];
  return shieldSvg(def, cls);
}

export function section(title: string, ...children: (Node | string | null | false)[]): HTMLElement {
  return h('section', { class: 'section' }, h('div', { class: 'eyebrow' }, title), ...children);
}

type TipContent = string | (() => Node | string);
const tips = new WeakMap<Element, TipContent>();
let tipEl: HTMLElement | null = null;
let tipFor: Element | null = null;
let showTimer = 0;
let pressTimer = 0;
let keyboardNav = false;
/** set while panels restore focus after a rebuild (no tooltip for that) */
export let restoringFocus = false;
export function setRestoringFocus(v: boolean): void {
  restoringFocus = v;
}

/** Attach a rich tooltip to an element. */
export function tip<T extends Element>(el: T, content: TipContent): T {
  tips.set(el, content);
  el.setAttribute('data-tip', '');
  return el;
}

function ensureTip(): HTMLElement {
  if (!tipEl) {
    tipEl = h('div', { class: 'tip', role: 'tooltip' });
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function show(el: Element): void {
  const c = tips.get(el);
  if (!c) return;
  const t = ensureTip();
  t.replaceChildren();
  const content = typeof c === 'string' ? c : c();
  if (typeof content === 'string') t.textContent = content;
  else t.appendChild(content);
  tipFor = el;
  const r = el.getBoundingClientRect();
  t.style.left = '0px';
  t.style.top = '0px';
  t.classList.add('show');
  const tw = t.offsetWidth;
  const th = t.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  let y = r.bottom + 8;
  if (y + th > window.innerHeight - 8) y = r.top - th - 8;
  x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
  t.style.left = `${Math.round(x)}px`;
  t.style.top = `${Math.round(y)}px`;
}

export function hideTip(): void {
  clearTimeout(showTimer);
  tipFor = null;
  tipEl?.classList.remove('show');
}

/** Global listeners for all tooltips (installed once). */
export function installTips(): void {
  const find = (t: EventTarget | null) => (t instanceof Element ? t.closest('[data-tip]') : null);
  document.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    const el = find(e.target);
    if (el === tipFor) return;
    clearTimeout(showTimer);
    if (!el) return hideTip();
    showTimer = window.setTimeout(() => show(el), 280);
  });
  document.addEventListener('pointerout', (e) => {
    const el = find(e.target);
    const to = find((e as PointerEvent).relatedTarget);
    if (el && el !== to) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const el = find(e.target);
    if (el && keyboardNav && !restoringFocus) show(el);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') keyboardNav = true;
  }, true);
  document.addEventListener('pointerdown', () => (keyboardNav = false), true);
  document.addEventListener('focusout', () => hideTip());
  document.addEventListener('pointerdown', (e) => {
    hideTip();
    if ((e as PointerEvent).pointerType !== 'touch') return;
    const el = find(e.target);
    if (!el) return;
    clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => show(el), 450);
  });
  document.addEventListener('pointerup', () => clearTimeout(pressTimer));
  document.addEventListener('scroll', () => hideTip(), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip();
  });
}
