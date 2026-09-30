// Captures a fixed tour of the interface for before/after comparison.
//   node e2e/capture.mjs http://localhost:4173/ <out-dir> [scenario]
// The tour uses one campaign state (seed 7, Calder, normal) advanced 30 weeks
// with the AI running every realm, then hands control to the player.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'docs/screenshots/current';
const scenario = process.argv[4] ?? 'reach';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];

async function tour(viewport, prefix, touch = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${prefix} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${prefix} console: ${m.text()}`));
  const shot = (n) => page.screenshot({ path: `${out}/${prefix}-${n}.jpg`, type: 'jpeg', quality: 80 });
  await page.goto(base);
  await page.waitForSelector('.menu-buttons button, [data-screen="menu"]');
  await page.waitForTimeout(400);
  await shot('01-menu');
  // campaign setup
  const newBtn = page.locator('button', { hasText: /New campaign/ }).first();
  if (await newBtn.count()) {
    await newBtn.click();
    await page.waitForTimeout(400);
    await shot('02-setup');
  }
  await page.evaluate((scn) => {
    const a = window.cnf;
    a.newGame({ scenario: scn, seed: 7, playerNation: 'cal', difficulty: 'normal' }, false);
  }, scenario);
  await page.waitForSelector('canvas');
  await page.evaluate(() => {
    const a = window.cnf;
    a.updateSettings({ autoPauseProposal: false, autoPauseEvent: false, autoPauseWar: false });
    a.debugAdvance(30);
    a.dialogLayer?.classList.add('hidden');
    a.selectProvince?.(null);
  });
  await page.waitForTimeout(600);
  await shot('03-map-overview');
  // province panel: player's capital
  await page.evaluate(() => { const a = window.cnf; const cap = a.sim.state.nations[a.player].capital; a.selectProvince(cap, true); });
  await page.waitForTimeout(500);
  await shot('04-province');
  // army panel with a route preview
  await page.evaluate(() => {
    const a = window.cnf;
    const army = Object.values(a.sim.state.armies).find((x) => x.nation === a.player);
    if (army) a.selectArmy(army.id, true);
  });
  await page.waitForTimeout(500);
  await shot('05-army');
  for (const [key, name] of [['b', 'realm'], ['m', 'military'], ['t', 'research'], ['d', 'diplomacy'], ['w', 'wars'], ['v', 'victory'], ['l', 'log']]) {
    await page.evaluate(() => window.cnf.selectProvince(null));
    await page.keyboard.press('Escape');
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    await shot(`06-ledger-${name}`);
    await page.keyboard.press('Escape');
  }
  // overlays
  for (const [key, name] of [['w', 'terrain'], ['e', 'supply'], ['r', 'relations']]) {
    await page.evaluate((k) => { const a = window.cnf; a.setOverlay?.(k); }, name === 'relations' ? 'diplomacy' : name);
    await page.waitForTimeout(300);
    await shot(`07-overlay-${name}`);
  }
  await page.evaluate(() => window.cnf.setOverlay?.('political'));
  // zoomed in
  await page.evaluate(() => { const a = window.cnf; const cap = a.sim.state.nations[a.player].capital; const r = a.renderer; const c = r.constructor.provinceCenter ? r.constructor.provinceCenter(cap) : null; if (c) r.camera.centerOn(c.x, c.y, 2.2); a.refresh?.(); });
  await page.waitForTimeout(500);
  await shot('08-zoomed');
  await ctx.close();
}

await tour({ width: 1366, height: 768 }, 'laptop');
await tour({ width: 390, height: 844 }, 'phone', true);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
