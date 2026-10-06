// The atlas pack's map art — terrain motifs, point markers, counter frames,
// branch symbols, status symbols and surface textures — decoded once at start
// and rasterised on demand into small canvases cached by name, size, tint and
// pixel ratio (never per frame). Landmark illustrations load lazily, the first
// time a local view needs one. Every URL comes from a Vite import, so the files
// resolve under any deployment path.

const URLS = import.meta.glob('../../assets/atlas/{terrain,markers,counters/frames,counters/symbols,counters/status,textures,decorations}/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const LANDMARK_URLS = import.meta.glob('../../assets/atlas/landmarks/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Pack-relative name, e.g. "terrain/hills" or "counters/symbols/infantry". */
const nameOf = (path: string) => path.replace(/^.*assets\/atlas\//, '').replace(/\.(svg|webp)$/, '');

const images = new Map<string, HTMLImageElement>();
const cache = new Map<string, HTMLCanvasElement>();

function decode(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(
    () => img,
    () => null,
  );
}

/** Resolves when every vector sprite is decoded (or after 3 s: the map never waits longer). */
export const spritesReady: Promise<void> = (() => {
  const all = Object.entries(URLS).map(([path, url]) =>
    decode(url).then((img) => {
      if (img) images.set(nameOf(path), img);
    }),
  );
  return Promise.race([Promise.all(all).then(() => undefined), new Promise<void>((r) => setTimeout(r, 3000))]);
})();

export function hasSprite(name: string): boolean {
  return images.has(name);
}

/**
 * A sprite rasterised at `w`×`h` CSS pixels for `dpr` device pixels per CSS
 * pixel. `tint` recolours a monochrome (currentColor) symbol. Null until decoded.
 */
export function sprite(name: string, w: number, h: number, dpr: number, tint?: string): HTMLCanvasElement | null {
  const img = images.get(name);
  if (!img) return null;
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  const key = `${name}|${pw}|${ph}|${tint ?? ''}`;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = pw;
  c.height = ph;
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, pw, ph);
  if (tint) {
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = tint;
    g.fillRect(0, 0, pw, ph);
  }
  if (cache.size > 600) cache.clear();
  cache.set(key, c);
  return c;
}

/** The decoded image itself (patterns from the surface textures). */
export function spriteImage(name: string): HTMLImageElement | null {
  return images.get(name) ?? null;
}

// ── landmark illustrations: lazy ──

const landmarks = new Map<string, HTMLImageElement | 'loading' | 'failed'>();

/** A landmark illustration, or null while it loads (`onLoad` then asks for a redraw). */
export function landmark(name: string, onLoad: () => void): HTMLImageElement | null {
  const got = landmarks.get(name);
  if (got && got !== 'loading' && got !== 'failed') return got;
  if (got) return null;
  const url = Object.entries(LANDMARK_URLS).find(([p]) => nameOf(p) === `landmarks/${name}`)?.[1];
  if (!url) {
    landmarks.set(name, 'failed');
    return null;
  }
  landmarks.set(name, 'loading');
  void decode(url).then((img) => {
    landmarks.set(name, img ?? 'failed');
    if (img) onLoad();
  });
  return null;
}

/** Visible bounds of each landmark inside its canvas (the pack's alpha bounding boxes, as fractions). */
export const LANDMARK_BOUNDS: Record<string, [number, number, number, number]> = {
  'coastal-fort': [21 / 1536, 35 / 1024, 1521 / 1536, 974 / 1024],
  harbor: [43 / 1536, 31 / 1024, 1496 / 1536, 980 / 1024],
  'industrial-works': [0, 0, 1492 / 1536, 982 / 1024],
  'provincial-town': [0, 0, 1518 / 1536, 1010 / 1024],
};
