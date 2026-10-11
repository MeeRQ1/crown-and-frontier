// Brings the atlas pack (Crown-Frontier-Update-Handoff.zip, committed at the
// repository root) into the game, reproducibly.
//   npm run atlas:assets
//
// 1. Extracts the zip into .cache/atlas-handoff/ (a staging folder, never the
//    source tree) and checks every file the manifest lists against its SHA-256.
// 2. Copies the runtime subset into src/assets/atlas/ (the UI icons go to step 3) (Vite imports it, so every
//    URL resolves under any deployment path) and the fonts into src/assets/fonts/,
//    with their OFL notices in public/licenses/.
// 3. Writes src/ui/atlas-icons.gen.ts: the 24×24 UI icons as SVG path data, so
//    the interface (inline SVG) and the map canvas (Path2D) draw the same shapes.
// 4. Exports the four landmark illustrations at display size (256 px wide WebP,
//    through headless Chromium's canvas): the 1536×1024 masters stay in the zip.
//
// Not copied: the fictional flags and insignia (the realms keep their own
// procedural heraldry), the reference screenshots of the old interface, the TTF
// fonts (WOFF2 is shipped), the catalog page and the build scripts.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const ZIP = 'Crown-Frontier-Update-Handoff.zip';
const STAGE = '.cache/atlas-handoff';
const PACK = join(STAGE, 'crown-frontier-atlas-pack');
const OUT = 'src/assets/atlas';
const GROUPS = ['menu-emblems', 'resources', 'counters', 'markers', 'terrain', 'textures', 'decorations'];
const FONTS = ['BarlowCondensed-Medium.woff2', 'BarlowCondensed-SemiBold.woff2', 'SourceSans3-Variable.woff2'];
const LICENSES = [
  ['BarlowCondensed-OFL.txt', 'BarlowCondensed-OFL.txt'],
  ['SourceSans3-OFL.txt', 'SourceSans3-OFL.txt'],
];

interface Asset {
  path: string;
  group: string;
  sha256: string;
}

function sha(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function extract(): void {
  if (!existsSync(ZIP)) throw new Error(`${ZIP} is missing at the repository root`);
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });
  execFileSync('unzip', ['-q', ZIP, '-d', STAGE], { stdio: 'inherit' });
}

function verify(): Asset[] {
  const manifest = JSON.parse(readFileSync(join(PACK, 'manifest.json'), 'utf8')) as { assets: Asset[] };
  const bad = manifest.assets.filter((a) => !existsSync(join(PACK, a.path)) || sha(join(PACK, a.path)) !== a.sha256);
  if (bad.length) throw new Error(`manifest mismatch: ${bad.map((a) => a.path).join(', ')}`);
  console.log(`manifest: ${manifest.assets.length} files, every SHA-256 matches`);
  return manifest.assets;
}

// ── SVG to path data (circle, ellipse and rect become path segments) ──

const num = (s: string | undefined) => Number(s ?? 0);
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
}

/** A 24×24 monochrome icon as path data; null if it uses anything but strokes. */
export function iconPathData(svg: string): string | null {
  const parts: string[] = [];
  for (const m of svg.matchAll(/<(path|circle|ellipse|rect)\b([^>]*)\/?>/g)) {
    const a = attrs(m[2]);
    if (a.fill && a.fill !== 'none') return null;
    if (a['stroke-width'] && Math.abs(num(a['stroke-width']) - 1.7) > 0.01) return null;
    if (m[1] === 'path') parts.push(a.d);
    else if (m[1] === 'circle') parts.push(ellipsePath(num(a.cx), num(a.cy), num(a.r), num(a.r)));
    else if (m[1] === 'ellipse') parts.push(ellipsePath(num(a.cx), num(a.cy), num(a.rx), num(a.ry)));
    else {
      const [x, y, w, hh] = [num(a.x), num(a.y), num(a.width), num(a.height)];
      const r = Math.min(num(a.rx ?? a.ry), w / 2, hh / 2);
      parts.push(
        r > 0
          ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${hh - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(hh - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
          : `M${x} ${y}h${w}v${hh}h${-w}z`,
      );
    }
  }
  return parts.length ? parts.join('') : null;
}

function copyRuntime(assets: Asset[]): void {
  rmSync(OUT, { recursive: true, force: true });
  let n = 0;
  for (const a of assets) {
    if (!GROUPS.includes(a.group)) continue;
    const to = join(OUT, a.path);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(PACK, a.path), to);
    n++;
  }
  mkdirSync('src/assets/fonts', { recursive: true });
  for (const f of FONTS) copyFileSync(join(PACK, 'fonts', f), join('src/assets/fonts', f));
  for (const [from, to] of LICENSES) copyFileSync(join(PACK, 'licenses', from), join('public/licenses', to));
  copyFileSync(join(PACK, 'PROVENANCE.md'), join(OUT, 'PROVENANCE.md'));
  console.log(`copied ${n} SVG files to ${OUT}/, ${FONTS.length} fonts and ${LICENSES.length} licences`);
}

function writeIcons(assets: Asset[]): void {
  const lines: string[] = [];
  const skipped: string[] = [];
  for (const a of assets.filter((x) => x.group === 'icons').sort((p, q) => (p.path < q.path ? -1 : 1))) {
    const name = a.path.replace(/^icons\//, '').replace(/\.svg$/, '');
    const d = iconPathData(readFileSync(join(PACK, a.path), 'utf8'));
    if (!d) {
      skipped.push(name);
      continue;
    }
    const key = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    lines.push(`  ${key}: '${d}',`);
  }
  writeFileSync(
    'src/ui/atlas-icons.gen.ts',
    `// Generated by tools/atlas-assets.ts from the atlas pack's 24×24 UI icons\n// (1.7-unit round strokes, currentColor). Do not edit by hand.\n\nexport const PACK_ICONS = {\n${lines.join('\n')}\n} as const;\n`,
  );
  console.log(`icons: ${lines.length} written${skipped.length ? `, skipped (not stroke-only): ${skipped.join(', ')}` : ''}`);
}

async function exportLandmarks(assets: Asset[]): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    mkdirSync(join(OUT, 'landmarks'), { recursive: true });
    for (const a of assets.filter((x) => x.group === 'landmarks')) {
      const data = readFileSync(join(PACK, a.path)).toString('base64');
      const out = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const w = 256;
        const h = Math.round((img.height / img.width) * w);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/webp', 0.9).split(',')[1];
      }, data);
      const to = join(OUT, a.path.replace(/\.png$/, '.webp'));
      writeFileSync(to, Buffer.from(out, 'base64'));
      console.log(`landmark ${to}: ${Math.round(Buffer.from(out, 'base64').length / 1024)} KB`);
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  extract();
  const assets = verify();
  copyRuntime(assets);
  writeIcons(assets);
  await exportLandmarks(assets);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
