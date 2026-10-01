// Stage C screenshots of the navy and air interface, from the prepared
// campaign in tools/sea-air-save.ts and from fresh campaigns on both maps.
//   npm run build && npx tsx tools/shots-stage-c.ts
// Writes docs/screenshots/stage-c/*.png.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';
import { seaAirSave } from './sea-air-save';

const OUT = 'docs/screenshots/stage-c';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

async function main(): Promise<void> {
  if (!existsSync('dist/index.html')) throw new Error('dist/ missing: run npm run build');
  mkdirSync(OUT, { recursive: true });
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = normalize(join('dist', rel));
    if (!file.startsWith('dist') || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const browser = await chromium.launch();
  const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT, name) });
  const pause = async (page: Page) => {
    await page.evaluate(() => {
      const app = (window as any).cnf;
      app.setSpeed(0);
      document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
    });
    // the welcome tour is not what these pictures are about
    const end = page.getByRole('button', { name: 'End tutorial' });
    if (await end.count()) await end.first().click();
  };
  const centre = (page: Page, pid: string, px = 70) =>
    page.evaluate(
      ([p, z]) => {
        const app = (window as any).cnf;
        const c = app.renderer.provinceCenter(p);
        app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(z), false);
        app.mapDirty = true;
      },
      [pid, px] as const,
    );
  try {
    // ── the prepared war: Serrata against Aurelian
    const { text, ids } = seaAirSave();
    mkdirSync('reports/tmp', { recursive: true });
    writeFileSync('reports/tmp/sea-air.json', text);
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(origin);
    await page.getByRole('button', { name: /New campaign/ }).click();
    await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
    await page.waitForSelector('canvas.map');
    await page.getByRole('button', { name: 'Game menu' }).click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
    await chooser.setFiles('reports/tmp/sea-air.json');
    await page.waitForFunction(() => (window as any).cnf.player === 'ser');
    await pause(page);
    // 1. a fleet blockading an enemy coast, its card open
    await centre(page, 'calvi', 46);
    await page.evaluate((f) => (window as any).cnf.selectFleet(f), ids.fleet);
    await page.waitForTimeout(400);
    await shot(page, '01-fleet-blockading.png');
    // 2. the sea zone card: sea control, straits, blockaded coasts
    await page.evaluate((z) => (window as any).cnf.selectZone(z), ids.zone);
    await page.waitForTimeout(300);
    await shot(page, '02-sea-zone-card.png');
    // 3. troops at sea: ship the army at Calvi to Westmere
    await page.evaluate(
      ([a, f]) => (window as any).cnf.do({ type: 'shipArmies', armies: [a], fleet: f, dest: 'westmere' }),
      [ids.landing, ids.fleet] as const,
    );
    await page.evaluate((a) => (window as any).cnf.selectArmy(a), ids.landing);
    await page.waitForTimeout(400);
    await shot(page, '03-army-at-sea.png');
    // 4. air: missions over Duncairn, the wing card, the attack forecast
    for (const [w, m] of [[ids.attack, 'support'], [ids.f1, 'superiority'], [ids.f2, 'superiority'], [ids.f3, 'superiority']] as const) {
      await page.evaluate(([wing, mission]) => (window as any).cnf.do({ type: 'airMission', wing, mission, target: 'duncairn' }), [w, m] as const);
    }
    await centre(page, 'duncairn', 60);
    await page.evaluate((w) => (window as any).cnf.selectWing(w), ids.attack);
    await page.waitForTimeout(400);
    await shot(page, '04-air-wing-missions.png');
    await page.evaluate((a) => (window as any).cnf.selectArmy(a), ids.theirs);
    await page.waitForTimeout(400);
    await shot(page, '05-forecast-with-air-support.png');
    // 5. the Military ledger's navy and air section
    await page.keyboard.press('Escape');
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const heads = [...document.querySelectorAll<HTMLElement>('.drawer:not(.closed) *')].filter((e) => e.children.length === 0 && /^navy and air$/i.test(e.textContent?.trim() ?? ''));
      heads[0]?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(200);
    await shot(page, '06-military-ledger-navy-air.png');
    await page.keyboard.press('Escape');
    // 6. a port's shipyard in the province card
    await centre(page, 'calvi', 60);
    await page.evaluate(() => (window as any).cnf.selectProvince('calvi'));
    await page.waitForTimeout(300);
    await page.locator('aside.inspector', { hasText: 'Launches into' }).locator('text=Launches into').scrollIntoViewIfNeeded();
    await shot(page, '07-port-shipyard.png');
    await page.close();
    // ── fresh campaigns: sea zones on both maps
    for (const [map, realm, file] of [['aldmere', 'hra', '08-aldmere-sea-zones.png'], ['reach', 'fen', '09-reach-sea-zones.png']] as const) {
      const p = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      await p.goto(origin);
      await p.getByRole('button', { name: /New campaign/ }).click();
      await p.locator(`[data-map="${map}"]`).click();
      await p.locator(`[data-realm="${realm}"]`).click();
      await p.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
      await p.waitForSelector('canvas.map');
      await pause(p);
      await p.keyboard.press('KeyF');
      await p.waitForTimeout(900);
      const zone = await p.evaluate(() => {
        const app = (window as any).cnf;
        const nid = app.player;
        const f = Object.values<any>(app.sim.state.fleets).find((x) => x.nation === nid);
        return f?.zone ?? null;
      });
      if (zone) {
        await p.evaluate((z) => {
          const app = (window as any).cnf;
          app.selectZone(z);
          const c = app.renderer.zoneCenter(z);
          app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(34), false);
          app.mapDirty = true;
        }, zone);
      }
      await p.waitForTimeout(400);
      await shot(p, file);
      await p.close();
    }
    // ── phone size: the fleet card
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const phone = await ctx.newPage();
    await phone.goto(origin);
    await phone.getByRole('button', { name: /New campaign/ }).tap();
    await phone.locator('button:visible', { hasText: 'Begin campaign' }).first().tap();
    await phone.waitForSelector('canvas.map');
    await pause(phone);
    await phone.evaluate(() => {
      const app = (window as any).cnf;
      const f = Object.values<any>(app.sim.state.fleets).find((x) => x.nation === app.player);
      if (f) app.selectFleet(f.id, true);
    });
    await phone.waitForTimeout(600);
    await shot(phone, '10-phone-fleet-card.png');
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
