// Stage E screenshots: the focus tree, the Diplomacy ledger with influence,
// guarantees, loans and a trade bloc, the peace conference, a settlement
// offered to the player with a counter-offer, and the Diplomacy map mode.
//   npm run build && npx tsx tools/shots-stage-e.ts
// Writes docs/screenshots/stage-e/*.png.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { diploSave } from './diplo-save';

const OUT = 'docs/screenshots/stage-e';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

async function main(): Promise<void> {
  if (!existsSync('dist/index.html')) throw new Error('dist/ missing: run npm run build');
  mkdirSync(OUT, { recursive: true });
  const { text, ids } = diploSave();
  mkdirSync(join('reports', 'tmp'), { recursive: true });
  const path = join('reports', 'tmp', 'diplomacy-shots.json');
  writeFileSync(path, text);
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = normalize(join('dist', rel));
    if (!file.startsWith('dist') || !existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const browser = await chromium.launch();
  const errors: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(origin);
    await page.waitForSelector('.menu-list button');
    await page.getByRole('button', { name: /New campaign/ }).click();
    await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
    await page.waitForSelector('canvas.map');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const end = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('End tutorial'));
      (end as HTMLButtonElement | undefined)?.click();
    });
    await page.getByRole('button', { name: 'Game menu' }).click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
    await chooser.setFiles(path);
    await page.waitForFunction(() => (window as any).cnf.player === 'aur', null, { timeout: 10000 });
    await page.evaluate(() => {
      const app = (window as any).cnf;
      app.setSpeed(0);
      app.ui.dockOpen = false;
      document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
      app.refresh();
    });
    await page.waitForTimeout(600);
    const shot = (name: string) => page.screenshot({ path: join(OUT, name) });

    // the focus tree
    await page.keyboard.press('p');
    await page.waitForTimeout(400);
    await shot('01-focus-tree.png');
    await page.locator('[data-branch="national"] .focus-card.available button').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-branch="diplomacy"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot('02-focus-generic-branches.png');

    // diplomacy: a guarantee, a loan, a trade bloc, and the influence section
    await page.evaluate((o) => (window as any).cnf.openDiplomacy(o), ids.protege);
    await page.waitForTimeout(200);
    await page.locator('[data-fk="Guarantee their independence"]').click();
    await page.evaluate((o) => (window as any).cnf.openDiplomacy(o), ids.borrower);
    await page.waitForTimeout(200);
    await page.locator('[data-fk="Lend 100 crowns"]').click();
    await page.evaluate((o) => (window as any).cnf.openDiplomacy(o), ids.partner);
    await page.waitForTimeout(200);
    await page.locator('[data-fk="Found a trade bloc with them"]').click();
    await page.waitForTimeout(300);
    await shot('03-diplomacy-bloc-and-loans.png');
    await page.locator('.diplo-detail').getByText('Influence, guarantees and trade').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot('04-diplomacy-influence.png');

    // the peace conference
    await page.evaluate(() => (window as any).cnf.openLedger('wars'));
    await page.waitForTimeout(300);
    await page.locator('[data-sk="peace-conference"]').first().locator('[data-fk="settle-suggest"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-sk="peace-conference"]').first().locator('.demand-list').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot('05-peace-conference.png');
    await page.locator('[data-sk="peace-conference"]').first().locator('[data-fk="Propose settlement"]').click();
    await page.waitForTimeout(300);

    // a settlement offered to us, one demand struck out
    await page.evaluate(() => {
      const app = (window as any).cnf;
      app.closeLedger();
      app.ui.dockOpen = true;
      app.refresh();
    });
    await page.waitForTimeout(300);
    await page.locator('.decision-card [data-fk="demand-1"]').uncheck();
    await page.waitForTimeout(300);
    await shot('06-settlement-counter-offer.png');

    // the Diplomacy map mode
    await page.evaluate(() => {
      const app = (window as any).cnf;
      app.ui.dockOpen = false;
      app.setMode('diplomacy');
      app.refresh();
    });
    await page.waitForTimeout(800);
    await shot('07-diplomacy-map.png');
    console.log(errors.length ? `page errors: ${errors.join('; ')}` : 'no page errors');
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
