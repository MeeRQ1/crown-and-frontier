// The military control workflows in a production build, step by step: raising a
// wing, rebasing it and sending it to support a battle, sailing a fleet, flying
// wings aboard a carrier and shipping an army overseas. Counts the player's
// clicks and key presses, records what each step shows, and screenshots it.
//   npm run build && npx tsx tools/audit-control.ts [--dist dist] [--out docs/screenshots/control/before]

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
const OUT = get('out', 'docs/screenshots/control/before');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

interface Step {
  flow: string;
  action: string;
  inputs: number;
  shows: string;
}

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
  const steps: Step[] = [];
  const errors: string[] = [];
  let shot = 0;
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', (e) => errors.push(e.message));
  const inspector = async () => ((await page.locator('aside.inspector').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 220);
  const record = async (flow: string, action: string, inputs: number) => {
    const shows = await inspector();
    steps.push({ flow, action, inputs, shows });
    await page.screenshot({ path: join(OUT, `${String(++shot).padStart(2, '0')}-${flow}.png`) });
  };
  const centre = (pid: string, px = 60) =>
    page.evaluate(
      ([p, z]) => {
        const app = (window as any).cnf;
        const c = app.renderer.provinceCenter(p);
        app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(z), false);
        app.mapDirty = true;
      },
      [pid, px] as const,
    );
  const point = (pid: string) =>
    page.evaluate((id) => {
      const app = (window as any).cnf;
      const r = app.canvas.getBoundingClientRect();
      const c = app.renderer.provinceCenter(id);
      const s = app.renderer.camera.toScreen(c.x, c.y);
      for (let d = 0; d < 80; d += 4)
        for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0], [d, d], [-d, -d]]) {
          const x = s.x + dx;
          const y = s.y + dy;
          if (app.renderer.provinceAt(x, y) === id && !app.renderer.armyAt(x, y) && !app.renderer.fleetAt(x, y) && !app.renderer.battleAt(x, y)) return { x: x + r.left, y: y + r.top };
        }
      return null;
    }, pid);
  // a wing marker on the map: can it be clicked?
  const wingMarker = () =>
    page.evaluate(() => {
      const app = (window as any).cnf;
      const r = app.canvas.getBoundingClientRect();
      const m = (app.renderer.wingMarkers ?? app.renderer.markers ?? []).find((x: any) => x.wing);
      return m ? { x: m.x + m.w / 2 + r.left, y: m.y + m.h / 2 + r.top } : null;
    });
  try {
    const { text, ids } = seaAirSave();
    mkdirSync('reports/tmp', { recursive: true });
    writeFileSync('reports/tmp/sea-air.json', text);
    await page.goto(origin);
    await page.getByRole('button', { name: /New campaign/ }).click();
    await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
    await page.waitForSelector('canvas.map');
    await page.getByRole('button', { name: 'Game menu' }).click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
    await chooser.setFiles('reports/tmp/sea-air.json');
    await page.waitForFunction(() => (window as any).cnf.player === 'ser');
    await page.evaluate(() => {
      const app = (window as any).cnf;
      app.setSpeed(0);
      document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
      app.ui.legendOpen = false;
      app.refresh();
    });

    // 1. aircraft: find a wing on the map, select it, rebase, send it to support
    await centre('serenna', 46);
    await page.waitForTimeout(300);
    const wm = await wingMarker();
    if (wm) await page.mouse.click(wm.x, wm.y);
    await page.waitForTimeout(200);
    const selectedByMarker = await page.evaluate(() => (window as any).cnf.selectedWing);
    await record('air-click-marker', `click the wing marker at Serenna: ${selectedByMarker ? 'selects the wing' : 'nothing selects a wing'}`, 1);
    const sp = await point('serenna');
    if (sp) await page.mouse.click(sp.x, sp.y);
    await page.waitForTimeout(200);
    await record('air-province-card', 'click the airfield province: its card lists the wings based there', 1);
    await page.locator(`[data-fk="wing-${ids.attack}"]`).first().click();
    await page.waitForTimeout(200);
    await record('air-wing-card', 'click the wing in the airfield list: the wing card', 1);
    const rebase = await page.locator('aside.inspector .action button', { hasText: /^(Aboard|At) / }).count();
    await page.locator('aside.inspector').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await record('air-change-base', `scroll to Change base: ${rebase} buttons naming bases (no map preview)`, 1);
    await page.getByRole('button', { name: /Fly ground support/ }).first().click();
    await centre('duncairn', 46);
    await record('air-mission-target', 'choose Fly ground support, then a province on the map', 1);
    const dp = await point('duncairn');
    if (dp) await page.mouse.click(dp.x, dp.y);
    await page.waitForTimeout(200);
    await record('air-mission-set', 'click the target province: the order is set', 1);

    // 2. fleets: select, sail, and look for operation orders
    await page.evaluate((f) => (window as any).cnf.selectFleet(f, true), ids.fleet);
    await page.waitForTimeout(300);
    const fleetButtons = await page.locator('aside.inspector .primary-actions button, aside.inspector .action button').allInnerTexts();
    await record('fleet-card', `select the fleet: actions ${fleetButtons.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ')}`, 1);

    // 3. carrier: the deck and the fly-aboard actions
    await page.evaluate((f) => (window as any).cnf.selectFleet(f, true), ids.carrier);
    await page.waitForTimeout(300);
    await record('carrier-card', 'select the carrier group: Air group with fly-aboard buttons per wing', 1);

    // 4. armies by sea
    await page.evaluate((a) => (window as any).cnf.selectArmy(a, true), ids.landing);
    await page.waitForTimeout(300);
    await record('army-ship-by-sea', 'select the army at Calvi: Ship by sea (a fleet with transports must already lie off its coast)', 1);

    // 5. the Military ledger as a roster
    await page.keyboard.press('Escape');
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    await record('roster', 'the Military ledger: armies by region, fleets, air operations', 1);
  } finally {
    await browser.close();
    server.close();
  }
  const md = [
    `# Control workflows (${OUT})`,
    '',
    '| # | Flow | Action | Inputs | The inspector shows |',
    '|---|---|---|---|---|',
    ...steps.map((s, i) => `| ${i + 1} | ${s.flow} | ${s.action} | ${s.inputs} | ${s.shows.replace(/\|/g, '/')} |`),
    '',
    errors.length ? `Page errors: ${errors.join('; ')}` : 'No page errors.',
  ].join('\n');
  writeFileSync(join(OUT, 'steps.md'), md);
  console.log(md);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
