// Original line icons (24×24 grid, 1.8 px stroke) used across the interface.
// Paths are plain SVG path data so the map canvas can draw them via Path2D.

export const ICONS = {
  dice: 'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.6 8.6h.01M15.4 8.6h.01M12 12h.01M8.6 15.4h.01M15.4 15.4h.01',
  crown: 'M3.5 17.5 5 8l4.2 4.2L12 5.5l2.8 6.7L19 8l1.5 9.5zM4.5 20.5h15',
  treasury: 'M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3zM4 7v5c0 1.66 3.58 3 8 3s8-1.34 8-3V7M4 12v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5',
  supplies: 'M8.5 5h7l-1.8 3c3 1.2 5.3 4.2 5.3 8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4c0-3.8 2.3-6.8 5.3-8zM9.5 12.5h5M12 10v5',
  manpower: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20c0-3.1 2.5-5.6 5.5-5.6s5.5 2.5 5.5 5.6M16.5 11a2.6 2.6 0 1 0-.9-5M20.5 20c0-2.7-1.6-4.9-3.8-5.5',
  research: 'M12 6.5c-2.2-1.6-5.2-2.1-8-1.6v14.2c2.8-.5 5.8 0 8 1.6 2.2-1.6 5.2-2.1 8-1.6V4.9c-2.8-.5-5.8 0-8 1.6zM12 6.5v14.2',
  policy: 'M7.5 4H18a2 2 0 0 1 2 2v1.5h-4M16 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.2h9.5M7.5 4a2 2 0 0 0-2 2v10.8M8.8 9h4.4M8.8 12.5h4.4',
  diplomacy: 'M3 7.5 12 13l9-5.5M3.5 6.5h17v11h-17zM12 16.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
  wars: 'M4 4l9.5 9.5M4 4v3.2l7.8 7.8M4 4h3.2l7.8 7.8M13 17.3l4.3-4.3M20 4l-9.5 9.5M20 4v3.2l-1.6 1.6M20 4h-3.2l-1.6 1.6M11 17.3 6.7 13M6.4 18.6 4.5 20.5M17.6 18.6l1.9 1.9',
  victory: 'M8 4h8v5.2a4 4 0 0 1-8 0zM8 6.2H5.2A3.2 3.2 0 0 0 8.6 10M16 6.2h2.8a3.2 3.2 0 0 1-3.4 3.8M12 13.2v3.6M8 20.5h8M9.5 16.8h5',
  chronicle: 'M5.5 3.5h10l3 3v14h-13zM15.5 3.5v3h3M8.8 10h6.4M8.8 13.5h6.4M8.8 17h3.8',
  military: 'M12 3.5 19.5 6v5.7c0 4.6-3.2 7.6-7.5 8.8-4.3-1.2-7.5-4.2-7.5-8.8V6zM12 8v8M8.8 11.5h6.4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.62.28-1.1.9-1.1 1.6v.7M12 17v.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  settings: 'M4 6.5h9M17 6.5h3M15 4.5v4M4 12h3M11 12h9M9 10v4M4 17.5h11M19 17.5h1M17 15.5v4',
  play: 'M7.5 5.2 18.5 12 7.5 18.8z',
  pause: 'M8.5 5.5v13M15.5 5.5v13',
  step: 'M6 5.5 14.5 12 6 18.5zM18 5.5v13',
  zoomIn: 'M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6zM20 20l-4.4-4.4M10.8 8v5.6M8 10.8h5.6',
  zoomOut: 'M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6zM20 20l-4.4-4.4M8 10.8h5.6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 12h6M12 9v6',
  capital: 'M4.5 20V9.5l2-1V5h2.2v2h2.1V5h2.4v2h2.1V5h2.2v3.5l2 1V20M10 20v-3.5a2 2 0 0 1 4 0V20M3 20h18',
  army: 'M6 21V3.5M6 4.5h11.5l-2.4 4 2.4 4H6',
  battle: 'M4 4l9.5 9.5M4 4v3.2l7.8 7.8M4 4h3.2l7.8 7.8M13 17.3l4.3-4.3M20 4l-9.5 9.5M20 4v3.2l-1.6 1.6M20 4h-3.2l-1.6 1.6M11 17.3 6.7 13M6.4 18.6 4.5 20.5M17.6 18.6l1.9 1.9',
  bell: 'M6 16.5v-5a6 6 0 0 1 12 0v5l1.8 1.8H4.2zM10 20.5a2 2 0 0 0 4 0',
  eye: 'M2.5 12S6.2 5.5 12 5.5 21.5 12 21.5 12 17.8 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  layers: 'M12 3.5 21 8.2 12 13 3 8.2zM3 12.3l9 4.8 9-4.8M3 16.3l9 4.8 9-4.8',
  political: 'M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20zM9 4v13.5M15 6.5V20',
  terrain: 'M2.8 19.5 9 9l4.2 6.3 2.3-3.3 5.7 7.5zM7.4 11.8 9 13l1.5-1.2',
  supply: 'M3 14.5h12.5v-6H3zM15.5 10.5h3.2l2.3 4h-5.5M7 18.8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 18.8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  economy: 'M4 7c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3zM4 7v5c0 1.66 3.58 3 8 3s8-1.34 8-3V7M4 12v5c0 1.66 3.58 3 8 3s8-1.34 8-3v-5',
  relations: 'M3 7.5 12 13l9-5.5M3.5 6.5h17v11h-17z',
  threat: 'M12 3.5 21.5 20h-19zM12 10v4.5M12 17.2v.01',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronLeft: 'M14.5 6l-6 6 6 6',
  chevronDown: 'M6 9.5l6 6 6-6',
  chevronUp: 'M6 14.5l6-6 6 6',
  move: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v4M12 17v4M3 12h4M17 12h4',
  build: 'M14.2 3.8 20.2 9.8l-3 3-6-6zM11.2 6.8 3.2 14.8l3 3 8-8',
  fort: 'M6.5 21V9.5h-2V4h3v2h2V4h5v2h2V4h3v5.5h-2V21zM10 21v-4h4v4',
  road: 'M8 3.5 4.5 20.5M16 3.5l3.5 17M12 4.5v3M12 10.5v3M12 16.5v3',
  charter: 'M7.5 4H18a2 2 0 0 1 2 2v1.5h-4M16 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.2h9.5M7.5 4a2 2 0 0 0-2 2v10.8M13 15.5a2 2 0 1 0-4 0 2 2 0 0 0 4 0z',
  settle: 'M3.5 20h17M6 20v-7l6-5 6 5v7M10 20v-4h4v4M12 8V3.5l4 1.5-4 1.5',
  merge: 'M6 4v5a5 5 0 0 0 5 5h7.5M18.5 14l-3-3M18.5 14l-3 3M6 20.5V14',
  split: 'M12 20.5V13M12 13 6.5 6.5M12 13l5.5-6.5M6.5 6.5V10M6.5 6.5H10M17.5 6.5V10M17.5 6.5H14',
  disband: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  stop: 'M6.5 6.5h11v11h-11z',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z',
  alert: 'M12 3.5 21.5 20h-19zM12 10v4.5M12 17.2v.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.6v.01',
  check: 'M5 12.5l4.6 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  save: 'M4 8.5h16V20H4zM4 8.5 6 4h12l2 4.5M10 12.5h4',
  upload: 'M12 16V4.5M7.5 9 12 4.5 16.5 9M4.5 15.5V20h15v-4.5',
  download: 'M12 4.5V16M7.5 11.5 12 16l4.5-4.5M4.5 15.5V20h15v-4.5',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z',
  target: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 12v.01',
  flag: 'M5.5 21V4M5.5 4.5h12l-2.2 4 2.2 4h-12',
  pact: 'M12 3.5 19.5 6v5.7c0 4.6-3.2 7.6-7.5 8.8-4.3-1.2-7.5-4.2-7.5-8.8V6zM8.8 12l2.2 2.2 4.2-4.4',
  trade: 'M4 8h13M13.5 4.5 17 8l-3.5 3.5M20 16H7M10.5 12.5 7 16l3.5 3.5',
  alliance: 'M8.5 4.5 3.5 7v4.5c0 3.6 2.2 6 5 7 2.8-1 5-3.4 5-7V7zM15.5 4.5l5 2.5v4.5c0 3.6-2.2 6-5 7',
  envoy: 'M12 3.5v17M12 5h7l-2 3 2 3h-7M8.5 20.5h7',
  claim: 'M5.5 20.5 12 4l6.5 16.5M8.2 14h7.6',
  hourglass: 'M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5',
  scroll: 'M7.5 4H18a2 2 0 0 1 2 2v1.5h-4M16 7.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.2h9.5M7.5 4a2 2 0 0 0-2 2v10.8',
  keyboard: 'M3 7h18v10H3zM6.5 10.5h1M10 10.5h1M13.5 10.5h1M17 10.5h.5M7.5 14h9',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11',
  factory: 'M3.5 20.5V10.5l5 3v-3l5 3v-3l5 3V4.5h2v16zM7 17h2M11 17h2M15 17h2',
  materiel: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8M8 6l8 4',
  mine: 'M4.5 19.5 13.5 10.5M11.8 5.3c2.9-1.2 5.8-.8 7.6 1.1-1.5-.6-3.3-.5-4.8.4M18.7 12.2c1.2-2.9.8-5.8-1.1-7.6.6 1.5.5 3.3-.4 4.8M12.2 6.2l5.6 5.6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 12h17M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
  ship: 'M3 14.5h18l-2.4 4.5H5.6zM6 14.5V11h12v3.5M9 11V7.5h5V11M11.5 7.5V4.5M3 20.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0',
  plane: 'M12 3.5c.9 0 1.5.8 1.5 1.8V10l7 4v1.8l-7-2v4l2 1.6v1.6L12 20l-3.5 1v-1.6l2-1.6v-4l-7 2V14l7-4V5.3c0-1 .6-1.8 1.5-1.8z',
  anchor: 'M12 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 7.5v13M8 11h8M4.5 13.5c0 4 3.4 7 7.5 7s7.5-3 7.5-7M4.5 13.5l-1.5 1.5M19.5 13.5l1.5 1.5',
} as const;

export type IconName = keyof typeof ICONS;

const SOLID = new Set<IconName>(['play', 'star']);
const NS = 'http://www.w3.org/2000/svg';

/** An inline SVG icon element (inherits currentColor). */
export function icon(name: IconName, cls = ''): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `ico ${SOLID.has(name) ? 'solid' : ''} ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name]);
  svg.appendChild(p);
  return svg;
}

const pathCache = new Map<IconName, Path2D>();
/** The icon as a Path2D in its 24×24 space (for drawing on the map canvas). */
export function iconPath(name: IconName): Path2D {
  let p = pathCache.get(name);
  if (!p) {
    p = new Path2D(ICONS[name]);
    pathCache.set(name, p);
  }
  return p;
}
