// The military control workflows on a phone, by touch only: tap a fleet, long-press
// its waters for the order menu and give an order; tap a wing counter, long-press
// the front for its missions; start a targeting mode and back out with the banner's
// Cancel (a phone has no Esc). Screenshots and a step table go to --out.
//   npm run build && npx tsx tools/touch-control.ts [--dist dist] [--out docs/screenshots/control/touch]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { seaAirSave } from './sea-air-save';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const OUT = get('out', 'docs/screenshots/control/touch');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = normalize(join(DIST, rel));
    if (!file.startsWith(normalize(DIST)) || !existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const rows: string[] = [];
  let shot = 0;
  const record = async (flow: string, result: string) => {
    rows.push(`| ${rows.length + 1} | ${flow} | ${result.replace(/\|/g, '/')} |`);
    await page.screenshot({ path: join(OUT, `${String(++shot).padStart(2, '0')}-${flow}.png`) });
  };
  const touch = async (x: number, y: number, holdMs: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(holdMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
  };
  const tap = (x: number, y: number) => touch(x, y, 60);
  const longPress = (x: number, y: number) => touch(x, y, 750);
  const app = <T>(f: string, arg?: unknown) => page.evaluate(new Function('arg', `const app = window.cnf; ${f}`) as (a: unknown) => T, arg);
  try {
    const { text, ids } = seaAirSave();
    mkdirSync('reports/tmp', { recursive: true });
    writeFileSync('reports/tmp/sea-air.json', text);
    await page.goto(origin);
    await page.getByRole('button', { name: /New campaign/ }).click();
    await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
    await page.waitForSelector('canvas.map');
    await page.evaluate(() => {
      const a = (window as any).cnf;
      a.openMenu?.();
    });
    await page.getByRole('button', { name: 'Import file' }).waitFor({ timeout: 5000 }).catch(() => page.getByRole('button', { name: 'Game menu' }).click());
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
    await chooser.setFiles('reports/tmp/sea-air.json');
    await page.waitForFunction(() => (window as any).cnf.player === 'ser');
    await app('app.setSpeed(0); document.querySelectorAll(".modal-layer:not(.hidden) footer button").forEach((b) => b.click()); app.ui.legendOpen = false; app.refresh();');
    const centre = (z: string, px: number) => app(`const c = arg.zone ? app.renderer.zoneCenter(arg.zone) : app.renderer.provinceCenter(arg.pid); app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(arg.px), false); app.mapDirty = true;`, z.startsWith('sea') || z.startsWith('z') ? { zone: z, px } : { pid: z, px });
    // 1. a fleet: tap its counter
    await centre(ids.zone, 40);
    await page.waitForTimeout(400);
    const fm = await app<{ x: number; y: number } | null>(`const r = app.canvas.getBoundingClientRect(); const m = app.renderer.fleetMarkers.find((x) => x.fleet === arg); return m ? { x: m.x + m.w / 2 + r.left, y: m.y + m.h / 2 + r.top } : null;`, ids.fleet);
    if (fm) await tap(fm.x, fm.y);
    await record('touch-fleet-tap', `tap the fleet counter: ${(await app<string | null>('return app.selectedFleet;')) === ids.fleet ? 'the fleet is selected' : 'not selected'}`);
    // the card opens over the lower half: C centres the selection in what is left of the map
    await app('app.centreSelection();');
    await page.waitForTimeout(400);
    // 2. long-press its waters: the order menu
    const water = await app<{ x: number; y: number } | null>(`const r = app.canvas.getBoundingClientRect(); const c = app.renderer.zoneCenter(arg); const s = app.renderer.camera.toScreen(c.x, c.y); for (let d = 0; d < 160; d += 6) for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0]]) { const x = s.x + dx, y = s.y + dy; const ins = app.renderer.camera.insets; if (x > ins.left + 10 && y > ins.top + 60 && x < r.width - ins.right - 10 && y < r.height - ins.bottom - 10 && !app.renderer.provinceAt(x, y) && app.renderer.zoneAt(x, y) === arg && !app.renderer.fleetAt(x, y) && !app.renderer.wingAt(x, y)) return { x: x + r.left, y: y + r.top }; } return null;`, ids.zone);
    if (water) await longPress(water.x, water.y);
    const menu = await page.locator('.order-menu').count();
    await record('touch-fleet-menu', menu ? `long-press the water: the order menu (${(await page.locator('.order-menu .order-item').count())} orders)` : 'long-press the water: no menu');
    const patrol = page.locator('.order-menu .order-item', { hasText: /Patrol/ }).first();
    if (await patrol.count()) {
      const b = await patrol.boundingBox();
      if (b) await tap(b.x + b.width / 2, b.y + b.height / 2);
    }
    await record('touch-fleet-order', `tap Patrol: the fleet's order is ${(await app<string | null>(`return app.sim.state.fleets[arg].duty?.kind ?? null;`, ids.fleet)) ?? 'unchanged'}`);
    // 3. a wing: tap its counter, long-press the front
    await centre('serenna', 40);
    await page.waitForTimeout(400);
    const wm = await app<{ x: number; y: number } | null>(`const r = app.canvas.getBoundingClientRect(); const m = app.renderer.wingMarkers.find((x) => x.base === 'serenna'); return m ? { x: m.x + m.w / 2 + r.left, y: m.y + m.h / 2 + r.top } : null;`);
    if (wm) await tap(wm.x, wm.y);
    await record('touch-wing-tap', `tap the wing counter: ${(await app<string | null>('return app.selectedWing;')) ? 'a wing is selected' : 'nothing selected'}`);
    await centre('duncairn', 40);
    await page.waitForTimeout(300);
    const front = await app<{ x: number; y: number } | null>(`const r = app.canvas.getBoundingClientRect(); const c = app.renderer.provinceCenter('duncairn'); const s = app.renderer.camera.toScreen(c.x, c.y); for (let d = 0; d < 80; d += 4) for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0]]) { const x = s.x + dx, y = s.y + dy; const ins = app.renderer.camera.insets; if (y < r.height - ins.bottom - 10 && y > ins.top + 40 && app.renderer.provinceAt(x, y) === 'duncairn' && !app.renderer.armyAt(x, y) && !app.renderer.fleetAt(x, y) && !app.renderer.wingAt(x, y)) return { x: x + r.left, y: y + r.top }; } return null;`);
    if (front) await longPress(front.x, front.y);
    await record('touch-wing-menu', (await page.locator('.order-menu').count()) ? `long-press the front: ${((await page.locator('.order-menu').innerText()) || '').replace(/\s+/g, ' ').slice(0, 140)}` : 'long-press the front: no menu');
    const first = page.locator('.order-menu .order-item:not(.is-disabled)').first();
    if (await first.count()) {
      const b = await first.boundingBox();
      if (b) await tap(b.x + b.width / 2, b.y + b.height / 2);
    }
    await record('touch-wing-order', `tap the first order: the wing flies ${(await app<string>('const w = app.sim.state.wings[app.selectedWing]; return w ? w.mission + " over " + (w.target ?? w.zone) : "?";'))}`);
    // 4. a targeting mode, backed out of with the banner's Cancel
    await app('app.startDutyTarget(arg, "blockade");', ids.fleet);
    await page.waitForTimeout(200);
    const banner = page.locator('[data-fk="banner-cancel"]');
    const shown = await banner.count();
    await record('touch-banner', shown ? 'choosing a place for an order: the banner offers Cancel' : 'no banner');
    if (shown) {
      const b = await banner.boundingBox();
      if (b) await tap(b.x + b.width / 2, b.y + b.height / 2);
    }
    await record('touch-cancel', `tap Cancel: ${(await app<unknown>('return app.targeting;')) ? 'still choosing' : 'back to the selection'}`);
  } finally {
    await browser.close();
    server.close();
  }
  const md = [`# Control by touch (390 × 844, touch only)`, '', '| # | Step | Result |', '|---|---|---|', ...rows, '', errors.length ? `Page errors: ${errors.join('; ')}` : 'No page errors.'].join('\n');
  writeFileSync(join(OUT, 'steps.md'), md);
  console.log(md);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
