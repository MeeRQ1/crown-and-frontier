// Stage F screenshots: the tutorial beside an open ledger, the Resources and Sea
// control map modes, a decision card above the mode bar, and the pause settings.
//   npm run build && npx tsx tools/shots-stage-f.ts
// Writes docs/screenshots/stage-f/*.png.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const OUT = 'docs/screenshots/stage-f';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

async function main(): Promise<void> {
  if (!existsSync('dist/index.html')) throw new Error('dist/ missing: run npm run build');
  mkdirSync(OUT, { recursive: true });
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
    const shot = (name: string) => page.screenshot({ path: join(OUT, name) });
    await page.goto(origin);
    await page.waitForSelector('.menu-list button');
    await page.getByRole('button', { name: /New campaign/ }).click();
    await page.locator('[data-map="isles"]').click();
    await page.locator('[data-realm="dun"]').click();
    await page.waitForTimeout(300);
    await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
    await page.waitForSelector('canvas.map');
    await page.waitForTimeout(800);

    // the tutorial: welcome, then a new step with its ledger open beside it
    await shot('01-tutorial-welcome.png');
    const next = async () => {
      await page.locator('.tutorial button', { hasText: /^(Next|Skip step)$/ }).click();
      await page.waitForTimeout(150);
    };
    for (let i = 0; i < 3; i++) await next();
    await page.waitForTimeout(300);
    await shot('02-tutorial-industry-step.png');
    await page.keyboard.press('i');
    await page.waitForTimeout(400);
    await shot('03-tutorial-beside-industry-ledger.png');
    await page.evaluate(() => (window as any).cnf.closeLedger());

    // the new map modes
    await page.evaluate(() => (window as any).cnf.tutorial?.finish());
    await page.keyboard.press('Shift+Digit8');
    await page.waitForTimeout(700);
    await shot('04-resources-mode.png');
    await page.keyboard.press('Shift+Digit9');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(1000);
    await shot('05-sea-control-mode.png');

    // a decision waits above the mode bar
    await page.evaluate(() => (window as any).cnf.setSpeed(4));
    await page.waitForFunction(() => !!document.querySelector('.dock .decision-card'), null, { timeout: 120000 });
    await page.evaluate(() => (window as any).cnf.setSpeed(0));
    await page.waitForTimeout(800);
    await shot('06-decision-above-mode-bar.png');

    // the pause settings
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(300);
    await page.locator('text=When research or a national focus finishes').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot('07-settings-pausing.png');
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
