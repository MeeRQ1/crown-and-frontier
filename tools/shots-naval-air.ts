// Screenshots of the naval and air update: mission assignment, coverage while
// choosing a target, a battle's resolved fire support, a carrier's air group,
// the air operations ledger, who holds the sky, and Albania's reach assessment.
//   npm run build && npx tsx tools/shots-naval-air.ts
// Writes docs/screenshots/naval-air/*.png.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';
import { seaAirSave } from './sea-air-save';

const OUT = 'docs/screenshots/naval-air';
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
  const errors: string[] = [];
  const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT, name) });
  const pause = async (page: Page) => {
    await page.evaluate(() => {
      const app = (window as any).cnf;
      app.setSpeed(0);
      document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
      // the map key covers what these pictures are about (it is opened again for the sky)
      app.ui.legendOpen = false;
      app.refresh();
    });
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
  const screenOf = (page: Page, pid: string) =>
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
  try {
    // ── the prepared war: Serrata against Aurelian (tools/sea-air-save.ts)
    const { text, ids } = seaAirSave();
    mkdirSync('reports/tmp', { recursive: true });
    writeFileSync('reports/tmp/sea-air.json', text);
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin);
    await page.getByRole('button', { name: /New campaign/ }).click();
    await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
    await page.waitForSelector('canvas.map');
    await page.getByRole('button', { name: 'Game menu' }).click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
    await chooser.setFiles('reports/tmp/sea-air.json');
    await page.waitForFunction(() => (window as any).cnf.player === 'ser');
    await pause(page);

    // 1. the wing card: state, readiness, base, the missions it may fly
    await centre(page, 'serenna', 60);
    await page.evaluate((w) => (window as any).cnf.selectWing(w), ids.attack);
    await page.waitForTimeout(400);
    await shot(page, '01-wing-card-missions.png');

    // 2. choosing a ground-support target: the reach shaded, the hover says whether it can be flown
    await page.getByRole('button', { name: /Fly ground support/ }).first().click();
    await centre(page, 'ostra', 26);
    await page.waitForTimeout(300);
    const dp = await screenOf(page, 'duncairn');
    if (dp) await page.mouse.move(dp.x, dp.y);
    await page.waitForTimeout(400);
    await shot(page, '02-targeting-coverage-hover.png');
    if (dp) await page.mouse.click(dp.x, dp.y);
    await page.waitForTimeout(200);

    // 3. fighters over Duncairn, the attack forecast with support on call
    for (const w of [ids.f1, ids.f2, ids.f3]) await page.evaluate((wing) => (window as any).cnf.do({ type: 'airMission', wing, mission: 'superiority', target: 'duncairn' }), w);
    await page.evaluate((a) => (window as any).cnf.selectArmy(a), ids.theirs);
    await page.waitForTimeout(400);
    await shot(page, '03-forecast-support-on-call.png');

    // 4. the attack goes in; Aurelian strikes at Calvi instead, where our wing and the
    //    squadron offshore both fire in support: the battle card's resolved fire support
    await page.evaluate((a) => (window as any).cnf.do({ type: 'move', army: a, dest: 'duncairn' }), ids.ours);
    let fight: { province: string; army: string } | null = null;
    for (let i = 0; i < 8 && !fight; i++) {
      await page.evaluate(() => (window as any).cnf.debugAdvance(1));
      await pause(page);
      fight = await page.evaluate(() => {
        const st = (window as any).cnf.sim.state;
        const b = Object.values<any>(st.battles).find((x) => x.support && [...x.support.att, ...x.support.def].some((l: any) => l.nation === 'ser'));
        if (!b) return null;
        const army = [...b.attackers, ...b.defenders].find((id: string) => st.armies[id]?.nation === 'ser');
        return army ? { province: b.province, army } : null;
      });
    }
    if (fight) {
      await centre(page, fight.province, 60);
      await page.evaluate((a) => (window as any).cnf.selectArmy(a), fight.army);
      await page.waitForTimeout(300);
      await page.locator('aside.inspector .support-grid').first().scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(200);
      await shot(page, '04-battle-fire-support-resolved.png');
    } else console.warn('no battle with our fire support');

    // 5. the attack wing's card after a week flown: last week's resolved report
    await page.evaluate((w) => (window as any).cnf.selectWing(w), ids.attack);
    await page.waitForTimeout(300);
    await shot(page, '05-wing-last-week-report.png');

    // 6. the carrier: an empty deck explains itself; then a fighter flies aboard
    await page.evaluate((f) => (window as any).cnf.selectFleet(f, true), ids.carrier);
    await page.waitForTimeout(400);
    await shot(page, '06-carrier-empty-deck.png');
    const flyAboard = page.locator('aside.inspector .action button', { hasText: /^Fly .*Fighter wing.* aboard/ }).first();
    if (await flyAboard.count()) await flyAboard.click();
    await page.waitForTimeout(300);
    await shot(page, '07-carrier-air-group.png');

    // 8. the fleet card: what the squadron is doing this week (blockade, escort, roles)
    await page.evaluate((f) => (window as any).cnf.selectFleet(f, true), ids.fleet);
    await page.waitForTimeout(400);
    await shot(page, '08-fleet-operations.png');

    // 9. a naval strike chosen on a sea zone: the hover over the water
    await page.evaluate((w) => (window as any).cnf.selectWing(w), ids.attack);
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: /Fly naval strike/ }).first().click();
    const zp = await page.evaluate((z) => {
      const app = (window as any).cnf;
      const c = app.renderer.zoneCenter(z);
      app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(40), false);
      app.mapDirty = true;
      const r = app.canvas.getBoundingClientRect();
      const s = app.renderer.camera.toScreen(c.x, c.y);
      for (let d = 0; d < 160; d += 4) for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0]]) if (app.renderer.zoneAt(s.x + dx, s.y + dy) === z && !app.renderer.fleetAt(s.x + dx, s.y + dy)) return { x: s.x + dx + r.left, y: s.y + dy + r.top };
      return null;
    }, ids.zone);
    await page.waitForTimeout(300);
    if (zp) await page.mouse.move(zp.x, zp.y);
    await page.waitForTimeout(400);
    await shot(page, '09-naval-strike-hover.png');
    await page.keyboard.press('Escape');

    // 10. a grounded wing gives its reason
    await page.evaluate((w) => {
      const app = (window as any).cnf;
      app.sim.state.wings[w].readiness = 10;
      app.selectWing(w);
    }, ids.f3);
    await page.waitForTimeout(300);
    await shot(page, '10-grounded-reason.png');
    await page.keyboard.press('Escape');

    // 11. the Military map mode: who holds the sky, and the province card's Sky row
    await page.mouse.move(700, 740);
    await centre(page, 'duncairn', 30);
    await page.evaluate(() => {
      const app = (window as any).cnf;
      app.setMode('military');
      app.ui.legendOpen = true;
      app.selectProvince('duncairn');
      app.refresh();
    });
    await page.waitForTimeout(700);
    await shot(page, '11-military-mode-sky.png');

    // 12. the Military ledger's air operations table
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    await page.locator('[data-sk="air-operations"]').first().scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(200);
    await shot(page, '12-air-operations-ledger.png');
    await page.close();

    // ── Albania on the World, 1914: a war without a shared border, assessed first
    const alb = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    alb.on('pageerror', (e) => errors.push(e.message));
    await alb.goto(origin);
    await alb.waitForSelector('.screen .menu-list button', { timeout: 15000 });
    await alb.evaluate(() => (window as any).cnf.newGame({ scenario: 'earth', seed: 1, playerNation: 'alb', difficulty: 'normal' }, false));
    await alb.waitForSelector('canvas.map', { timeout: 120000 });
    await alb.waitForFunction(() => !!(window as any).cnf.renderer, null, { timeout: 120000 });
    await alb.evaluate(() => {
      const app = (window as any).cnf;
      app.dialogLayer.classList.add('hidden');
      app.openDiplomacy('ott');
    });
    await alb.waitForTimeout(500);
    await alb.locator('.diplo-detail .reach').first().scrollIntoViewIfNeeded().catch(() => undefined);
    await alb.waitForTimeout(200);
    await shot(alb, '13-albania-reach-assessment.png');
    const war = alb.locator('.diplo-detail .action button', { hasText: /War of conquest/ }).first();
    if (await war.count()) {
      await war.click();
      await alb.waitForTimeout(300);
      await shot(alb, '14-albania-declare-confirm.png');
      await alb.keyboard.press('Escape');
    }
    await alb.close();

    // ── phone size: the wing card by touch
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const phone = await ctx.newPage();
    phone.on('pageerror', (e) => errors.push(e.message));
    await phone.goto(origin);
    await phone.getByRole('button', { name: /New campaign/ }).tap();
    await phone.locator('button:visible', { hasText: 'Begin campaign' }).first().tap();
    await phone.waitForSelector('canvas.map');
    await phone.getByRole('button', { name: 'Game menu' }).tap();
    const [ch2] = await Promise.all([phone.waitForEvent('filechooser'), phone.getByRole('button', { name: 'Import file' }).tap()]);
    await ch2.setFiles('reports/tmp/sea-air.json');
    await phone.waitForFunction(() => (window as any).cnf.player === 'ser');
    await pause(phone);
    await phone.evaluate((w) => (window as any).cnf.selectWing(w), ids.attack);
    await phone.waitForTimeout(500);
    await shot(phone, '15-phone-wing-card.png');
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length) console.error(`page errors: ${errors.slice(0, 5).join('; ')}`);
  console.log(`Screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
