// Stage D screenshots: the map library, campaign setup with every map, the map
// editor, the new maps in play, and the real-world Baltic. Also times map
// generation in the editor (in the browser's worker) for a small and a large map.
//   npm run build && npx tsx tools/shots-stage-d.ts
// Writes docs/screenshots/stage-d/*.png and prints the timings.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';

const OUT = 'docs/screenshots/stage-d';
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
  const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT, name) });
  const errors: string[] = [];
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(origin);
    await page.waitForSelector('.menu-list button');
    return page;
  };
  const endTutorial = (page: Page) =>
    page.evaluate(() => {
      const end = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('End tutorial'));
      (end as HTMLButtonElement | undefined)?.click();
    });
  const play = async (page: Page, map: string, realm: string | null) => {
    await page.getByRole('button', { name: /New campaign/ }).click();
    await page.locator(`[data-map="${map}"]`).click();
    await page.waitForTimeout(500);
    if (realm) await page.locator(`[data-realm="${realm}"]`).click();
    await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
    await page.waitForSelector('canvas.map');
    await page.waitForTimeout(600);
    await endTutorial(page);
  };
  try {
    // library and setup
    let page = await open();
    await page.getByRole('button', { name: /Map library/ }).click();
    await page.waitForTimeout(1500);
    await shot(page, '01-map-library.png');
    await page.locator('[data-fk="play-baltic"]').click();
    await page.waitForTimeout(1500);
    await shot(page, '02-setup-six-maps.png');
    await page.close();

    // the Baltic in play
    page = await open();
    await play(page, 'baltic', 'dan');
    await shot(page, '03-baltic-denmark.png');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(1200);
    await shot(page, '04-baltic-whole-map.png');
    await page.keyboard.press('Shift+Digit2');
    await page.waitForTimeout(800);
    await shot(page, '05-baltic-terrain.png');
    await page.close();

    // the three generated maps, whole
    for (const [map, n] of [['isles', '06'], ['steppe', '07'], ['midsea', '08']] as const) {
      page = await open();
      await play(page, map, null);
      await page.keyboard.press('KeyF');
      await page.waitForTimeout(1200);
      await shot(page, `${n}-${map}.png`);
      await page.close();
    }

    // the editor
    page = await open();
    await page.getByRole('button', { name: /Map library/ }).click();
    await page.locator('[data-fk="new-map"]').click();
    await page.waitForSelector('.ed-new-card');
    await shot(page, '09-editor-new-map.png');
    const generate = async (provinces: number, realms: number, seed: number) => {
      await page.locator('[data-f=gen-seed]').fill(String(seed));
      await page.locator('[data-f=gen-provinces]').fill(String(provinces));
      await page.locator('[data-f=gen-realms]').fill(String(realms));
      const t0 = Date.now();
      await page.locator('[data-fk=ed-generate]').click();
      await page.waitForSelector('.ed-new.hidden', { state: 'attached', timeout: 120000 });
      return Date.now() - t0;
    };
    const big = await generate(500, 14, 4);
    const bigN = await page.evaluate('window.cnfEditor.pkg.provinces.length');
    console.log(`generated ${bigN} provinces in ${big} ms (browser worker, including the editor opening it)`);
    // back to the form for a small map
    await page.evaluate(() => (document.querySelector('[data-fk=ed-back]') as HTMLButtonElement).click());
    await page.waitForTimeout(400);
    const confirm = page.locator('.modal-layer:not(.hidden) button', { hasText: 'Leave' });
    if (await confirm.count()) await confirm.click();
    await page.locator('[data-fk="new-map"]').click();
    await page.waitForSelector('.ed-new-card');
    await page.locator('[data-f=gen-name]').fill('Westmarch');
    const small = await generate(90, 6, 12);
    console.log(`generated ${await page.evaluate('window.cnfEditor.pkg.provinces.length')} provinces in ${small} ms`);
    await page.waitForTimeout(500);
    const box = (await page.locator('.ed-canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    await shot(page, '10-editor-province.png');
    await page.locator('[data-tool=terrain]').click();
    await page.waitForTimeout(300);
    await shot(page, '11-editor-terrain.png');
    await page.locator('[data-tool=deposit]').click();
    await page.waitForTimeout(300);
    await shot(page, '12-editor-deposits.png');
    // a realm with no land: the finding and its Show button
    await page.locator('[data-tab=realms]').click();
    await page.locator('[data-f=new-realm]').fill('Kingdom of Testmark');
    await page.locator('[data-fk=ed-place-capital]').click();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    const other = await page.evaluate("window.cnfEditor.pkg.nations.find((n) => n.name !== 'Kingdom of Testmark').id");
    await page.locator(`.ed-choice[data-choice="${other}"]`).click();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(500);
    await page.locator('.ed-status').click();
    await page.waitForTimeout(300);
    await shot(page, '13-editor-check.png');
    await page.close();
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
