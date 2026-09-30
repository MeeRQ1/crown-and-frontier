// Scripted player flow against a served build (development helper).
//   node e2e/playthrough.mjs http://localhost:4173/ <screenshot-dir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'e2e/screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const provinceScreen = (id) =>
  page.evaluate((pid) => {
    const app = window.cnf;
    const c = app.renderer.constructor.provinceCenter(pid);
    const s = app.renderer.camera.toScreen(c.x, c.y);
    const r = app.canvas.getBoundingClientRect();
    return { x: s.x + r.left, y: s.y + r.top + 12 };
  }, id);

await page.goto(base);
await page.getByText('New campaign').click();
await page.getByText('Begin campaign').click();
await page.waitForSelector('canvas.map');
await page.waitForTimeout(400);

// select capital
let p = await provinceScreen('aurelon');
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(300);
await shot('01-capital');
// start the first affordable project in a cheaper province, then recruit in the capital
p = await provinceScreen('leyfield');
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
const proj = page.locator('.context .actions button:not(.disabled)', { hasText: /Develop|Build roads|Fortify|Grant charters/ });
if (await proj.count()) await proj.first().click();
else errors.push('no affordable project in Leyfield');
p = await provinceScreen('aurelon');
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
await page.locator('.context button:not(.disabled)', { hasText: 'Raise Foot' }).first().click();
await page.waitForTimeout(300);
await shot('02-after-orders');

// select the largest army by its marker and right-click a neighbour
const marker = await page.evaluate(() => {
  const app = window.cnf;
  const r = app.canvas.getBoundingClientRect();
  const m = app.renderer.markers.find((x) => app.sim.state.armies[x.army].nation === app.player);
  return m ? { x: m.x + m.w / 2 + r.left, y: m.y + m.h / 2 + r.top, id: m.army } : null;
});
if (!marker) errors.push('no own army marker');
else {
  await page.mouse.click(marker.x, marker.y);
  await page.waitForTimeout(200);
  p = await provinceScreen('leyfield');
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(200);
  await shot('03-army-preview');
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.waitForTimeout(200);
  const moving = await page.evaluate((id) => window.cnf.sim.state.armies[id].path.length, marker.id);
  if (!moving) errors.push('army did not receive a move order');
}
await shot('04-army-moving');

// run time, answering decisions as they come (first one is screenshotted)
let dialogs = 0;
const t0 = Date.now();
await page.keyboard.press('4');
while (Date.now() - t0 < 8000) {
  await page.waitForTimeout(250);
  const dlg = page.locator('.modal-layer:not(.hidden) .modal.narrow');
  if (await dlg.count()) {
    if (dialogs === 0) await shot('05a-decision');
    dialogs++;
    const choice = page.locator('.modal-layer:not(.hidden) .modal.narrow button.choice:not(.disabled), .modal-layer:not(.hidden) .modal.narrow footer button', { hasText: /Accept|.+/ });
    const accept = page.locator('.modal-layer:not(.hidden) .modal.narrow footer button', { hasText: 'Accept' });
    const ev = page.locator('.modal-layer:not(.hidden) .modal.narrow button.choice:not(.disabled)');
    if (await ev.count()) await ev.first().click();
    else if (await accept.count()) await accept.first().click();
    else await choice.last().click();
    await page.waitForTimeout(100);
    await page.keyboard.press('4');
  }
}
await page.evaluate(() => window.cnf.setSpeed(0));
await page.waitForTimeout(300);
console.log('decisions answered:', dialogs);
await shot('05-after-time');
const state = await page.evaluate(() => ({ tick: window.cnf.sim.state.tick, projects: Object.values(window.cnf.sim.state.provinces).filter((p) => p.project && p.project.nation === window.cnf.player).length }));
console.log('state after running:', JSON.stringify(state));

// dismiss any open dialog then tour the ledgers
for (const key of ['b', 'm', 't', 'p', 'd', 'w', 'v', 'l', 'h']) {
  if (await page.locator('.modal-layer:not(.hidden) .modal[role=dialog] header h2', { hasText: /Event|proposes|calls|Peace offer/ }).count()) {
    await page.keyboard.press('Escape');
  }
  const dlg = page.locator('.modal-layer:not(.hidden) footer button', { hasText: /Decide later|Later|Close/ });
  if (await dlg.count()) await dlg.first().click();
  await page.keyboard.press(key);
  await page.waitForTimeout(250);
  await shot(`06-ledger-${key}`);
}
await page.keyboard.press('Escape');

// small screen
await page.setViewportSize({ width: 390, height: 780 });
await page.waitForTimeout(400);
await shot('07-mobile');
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no errors');
await browser.close();
process.exitCode = errors.length ? 1 : 0;
