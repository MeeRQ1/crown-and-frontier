// Restrained procedural heraldry: every realm bears a heater shield with one
// field, at most one ordinary and one charge. The same shapes are drawn as
// inline SVG (panels) and on canvas (map markers), so identity is consistent.

import type { NationDef } from '../sim/types';

export type Tincture = 'realm' | 'or' | 'argent' | 'sable' | 'gules' | 'azure' | 'vert' | 'purpure';
export type Ordinary =
  | 'none'
  | 'pale'
  | 'fess'
  | 'bend'
  | 'bendSinister'
  | 'chevron'
  | 'cross'
  | 'saltire'
  | 'chief'
  | 'bordure'
  | 'perPale'
  | 'perFess'
  | 'quarterly'
  | 'pile';
export type Charge =
  | 'none'
  | 'sun'
  | 'star'
  | 'crescent'
  | 'tower'
  | 'ship'
  | 'book'
  | 'mountain'
  | 'tree'
  | 'hammer'
  | 'reed'
  | 'horse'
  | 'crown'
  | 'key'
  | 'wheat'
  | 'roundel'
  | 'lozenge';

export interface Arms {
  field: Tincture;
  ordinary: Ordinary;
  ordinaryTincture: Tincture;
  charge: Charge;
  chargeTincture: Tincture;
}

const TINCTURES: Record<Exclude<Tincture, 'realm'>, string> = {
  or: '#d7b25a',
  argent: '#ece6d6',
  sable: '#22272d',
  gules: '#a5322a',
  azure: '#2d5893',
  vert: '#3a7141',
  purpure: '#664485',
};

export const SHIELD = 'M6 5H94V53C94 84 74 102 50 113C26 102 6 84 6 53Z';
const SHIELD_INSET = 'M15 14H85V53C85 78 69 93 50 102C31 93 15 78 15 53Z';

const ORDINARIES: Record<Exclude<Ordinary, 'none'>, string> = {
  pale: 'M36 0H64V120H36Z',
  fess: 'M0 40H100V68H0Z',
  bend: 'M-8 10 10-8 112 94 94 112Z',
  bendSinister: 'M108 10 90-8-12 94 6 112Z',
  chevron: 'M-4 92 50 44 104 92V118L50 70-4 118Z',
  cross: 'M38 0H62V120H38ZM0 42H100V66H0Z',
  saltire: 'M-8 10 10-8 112 94 94 112ZM108 10 90-8-12 94 6 112Z',
  chief: 'M0 0H100V34H0Z',
  bordure: `${SHIELD}${SHIELD_INSET}`,
  perPale: 'M50 0H100V120H50Z',
  perFess: 'M0 57H100V120H0Z',
  quarterly: 'M50 0H100V57H50ZM0 57H50V120H0Z',
  pile: 'M26 0H74L50 84Z',
};

function starPath(cx: number, cy: number, ro: number, ri: number, n: number, rot = -Math.PI / 2): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return d + 'Z';
}

function sunPath(): string {
  let d = 'M50 36a14 14 0 1 1 0 28a14 14 0 1 1 0-28Z';
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const b = a + 0.2;
    const c = a - 0.2;
    const p = (r: number, t: number) => `${(50 + Math.cos(t) * r).toFixed(1)} ${(50 + Math.sin(t) * r).toFixed(1)}`;
    d += `M${p(18, c)}L${p(31, a)}L${p(18, b)}Z`;
  }
  return d;
}

// Charges are drawn in a 100×100 box centred on (50, 50).
const CHARGES: Record<Exclude<Charge, 'none'>, string> = {
  sun: sunPath(),
  star: starPath(50, 52, 30, 12.5, 5),
  crescent: 'M62 22A28 28 0 1 0 62 78A22 22 0 1 1 62 22Z',
  tower: 'M31 82V42H27V24H35V31H42V24H58V31H65V24H73V42H69V82ZM44 82V67A6 6 0 0 1 56 67V82Z',
  ship: 'M16 62H84L73 79H27ZM48 18H52V62H48ZM54 22 78 57H54ZM46 29 25 57H46Z',
  book: 'M50 33C42 27 30 26 19 28V73C30 71 42 72 50 78C58 72 70 71 81 73V28C70 26 58 27 50 33ZM49 34H51V77H49Z',
  mountain: 'M12 78 37 35 49 54 61 29 88 78Z',
  tree: 'M50 14 75 49H63L79 70H21L37 49H25ZM45.5 70H54.5V85H45.5Z',
  hammer: 'M22 22H66V41H22ZM66 27H76V36H66ZM40 41H49V86H40Z',
  reed: 'M33 86V40H36.5V86ZM48 86V29H51.5V86ZM63 86V43H66.5V86ZM30.5 40C30.5 30 34.5 22 34.8 20C35 22 39 30 39 40C39 46 30.5 46 30.5 40ZM45.5 29C45.5 19 49.5 11 49.8 9C50 11 54 19 54 29C54 35 45.5 35 45.5 29ZM60.5 43C60.5 33 64.5 25 64.8 23C65 25 69 33 69 43C69 49 60.5 49 60.5 43Z',
  horse: 'M33 84 35 65C29 60 27 51 31 43L43 25 45 13 52 22C65 22 76 33 76 48L72 61 61 63 59 57 51 59 55 71 63 84Z',
  crown: 'M20 70 24 34 38 51 50 28 62 51 76 34 80 70ZM22 74H78V83H22Z',
  key: 'M50 16A13 13 0 1 1 50 42A13 13 0 1 1 50 16ZM50 24A5 5 0 1 0 50 34A5 5 0 1 0 50 24ZM46.5 42H53.5V86H46.5ZM53.5 66H64V72H53.5ZM53.5 77H61V83H53.5Z',
  wheat: 'M49 86V26H51V86ZM50 16C53 20 53 26 50 30C47 26 47 20 50 16ZM49 34C43 32 40 27 41 23C46 24 49 28 49 34ZM51 34C57 32 60 27 59 23C54 24 51 28 51 34ZM49 46C43 44 40 39 41 35C46 36 49 40 49 46ZM51 46C57 44 60 39 59 35C54 36 51 40 51 46ZM49 58C43 56 40 51 41 47C46 48 49 52 49 58ZM51 58C57 56 60 51 59 47C54 48 51 52 51 58Z',
  roundel: 'M50 28A22 22 0 1 1 50 72A22 22 0 1 1 50 28Z',
  lozenge: 'M50 18 75 50 50 82 25 50Z',
};

/** Arms for a realm: authored in its definition, or derived from its emblem and id. */
export function armsOf(def: NationDef): Arms {
  if (def.arms) return def.arms as Arms;
  let h = 2166136261;
  for (const ch of def.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const ords: Ordinary[] = ['none', 'chief', 'fess', 'bend', 'chevron', 'pale', 'bordure'];
  const metals: Tincture[] = ['or', 'argent'];
  const charge = (def.emblem in CHARGES ? def.emblem : (['star', 'crescent', 'roundel', 'lozenge'] as Charge[])[h % 4]) as Charge;
  const ordinary = ords[(h >>> 3) % ords.length];
  const metal = metals[(h >>> 7) % 2];
  return { field: 'realm', ordinary, ordinaryTincture: metal, charge, chargeTincture: ordinary === 'none' || ordinary === 'bordure' ? metal : metals[1 - ((h >>> 7) % 2)] };
}

function tinct(t: Tincture, realm: string): string {
  return t === 'realm' ? realm : TINCTURES[t];
}

/** Where the charge sits (centre and scale) given the ordinary. */
function chargePlacement(o: Ordinary): { cx: number; cy: number; s: number } {
  if (o === 'chief') return { cx: 50, cy: 66, s: 0.5 };
  if (o === 'bordure') return { cx: 50, cy: 56, s: 0.52 };
  if (o === 'pile') return { cx: 50, cy: 36, s: 0.36 };
  if (o === 'chevron') return { cx: 50, cy: 30, s: 0.36 };
  return { cx: 50, cy: 55, s: 0.6 };
}

interface Layer {
  d: string;
  fill: string;
  transform?: [number, number, number]; // translate x, y, scale
}

function layers(arms: Arms, realmColor: string): Layer[] {
  const out: Layer[] = [{ d: SHIELD, fill: tinct(arms.field, realmColor) }];
  if (arms.ordinary !== 'none') out.push({ d: ORDINARIES[arms.ordinary], fill: tinct(arms.ordinaryTincture, realmColor) });
  if (arms.charge !== 'none') {
    const p = chargePlacement(arms.ordinary);
    out.push({ d: CHARGES[arms.charge], fill: tinct(arms.chargeTincture, realmColor), transform: [p.cx - 50 * p.s, p.cy - 50 * p.s, p.s] });
  }
  return out;
}

let uid = 0;
const NS = 'http://www.w3.org/2000/svg';

/** An SVG shield for a realm (inline, scalable). */
export function shieldSvg(def: NationDef, cls = ''): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 118');
  svg.setAttribute('class', `shield ${cls}`.trim());
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Arms of ${def.name}`);
  const id = `sh${++uid}`;
  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<clipPath id="${id}c"><path d="${SHIELD}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>`;
  svg.appendChild(defs);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('clip-path', `url(#${id}c)`);
  for (const l of layers(armsOf(def), def.color)) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', l.d);
    p.setAttribute('fill', l.fill);
    p.setAttribute('fill-rule', 'evenodd');
    if (l.transform) p.setAttribute('transform', `translate(${l.transform[0]} ${l.transform[1]}) scale(${l.transform[2]})`);
    g.appendChild(p);
  }
  const shade = document.createElementNS(NS, 'path');
  shade.setAttribute('d', SHIELD);
  shade.setAttribute('fill', `url(#${id}g)`);
  g.appendChild(shade);
  svg.appendChild(g);
  const rim = document.createElementNS(NS, 'path');
  rim.setAttribute('d', SHIELD);
  rim.setAttribute('fill', 'none');
  rim.setAttribute('stroke', '#12161b');
  rim.setAttribute('stroke-width', '4');
  svg.appendChild(rim);
  return svg;
}

const canvasCache = new Map<string, HTMLCanvasElement>();
const pathCache = new Map<string, Path2D>();
const P = (d: string) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

/** Draw a realm's shield on a canvas; (x, y) is the top-left, w the width in CSS pixels. */
export function drawShield(ctx: CanvasRenderingContext2D, def: NationDef, x: number, y: number, w: number): void {
  const dpr = Math.max(1, Math.min(3, (ctx.getTransform().a || 1)));
  const px = Math.max(8, Math.round(w * dpr));
  const key = `${def.id}|${def.color}|${px}`;
  let c = canvasCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = px + 2;
    c.height = Math.round(px * 1.18) + 2;
    const g = c.getContext('2d')!;
    g.translate(1, 1);
    g.scale(px / 100, px / 100);
    g.save();
    g.clip(P(SHIELD));
    for (const l of layers(armsOf(def), def.color)) {
      g.save();
      if (l.transform) {
        g.translate(l.transform[0], l.transform[1]);
        g.scale(l.transform[2], l.transform[2]);
      }
      g.fillStyle = l.fill;
      g.fill(P(l.d), 'evenodd');
      g.restore();
    }
    const grad = g.createLinearGradient(0, 0, 100, 118);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad;
    g.fill(P(SHIELD));
    g.restore();
    g.lineWidth = Math.max(4, 150 / px);
    g.strokeStyle = '#12161b';
    g.stroke(P(SHIELD));
    canvasCache.set(key, c);
  }
  ctx.drawImage(c, x, y, w + 2 * (w / px), w * 1.18 + 2 * (w / px));
}
