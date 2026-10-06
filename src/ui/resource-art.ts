// The atlas pack's commodity illustrations (96×88, multicolour), shown at
// 40–56 px in commodity registers. Materiel uses the equipment illustration.

const URLS = import.meta.glob('../assets/atlas/resources/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const BY = new Map(Object.entries(URLS).map(([p, u]) => [p.replace(/^.*\//, '').replace(/\.svg$/, ''), u]));

export function resourceArt(name: string, size = 44): HTMLImageElement {
  const img = document.createElement('img');
  img.src = BY.get(name === 'materiel' ? 'equipment' : name) ?? '';
  img.alt = '';
  img.width = size;
  img.height = Math.round((size * 88) / 96);
  img.className = 'res-art';
  img.decoding = 'async';
  return img;
}
