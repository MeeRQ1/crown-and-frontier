// Scripted war-and-peace flow through the real UI (development helper).
//   node e2e/war-flow.mjs http://localhost:4173/ <screenshot-dir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'e2e/screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const log = (...a) => console.log(...a);

await page.goto(base);
await page.waitForSelector('.menu-buttons button');
await page.evaluate(() => window.cnf.newGame({ seed: 3, playerNation: 'vos', difficulty: 'normal' }, false));
await page.waitForSelector('canvas.map');
// the opening phase: let 20 weeks pass with the AI running our realm, then take over
await page.evaluate(() => {
  const a = window.cnf;
  a.updateSettings({ autoPauseProposal: false, autoPauseEvent: false });
  a.debugAdvance(20);
  a.dialogLayer.classList.add('hidden');
});

// declare war on Calder from the diplomacy ledger
await page.keyboard.press('d');
await page.locator('.modal table.data tr', { hasText: 'Calder' }).click();
await page.waitForTimeout(200);
await shot('w01-diplomacy-calder');
const warBtn = page.locator('.modal .action button:not(.disabled)', { hasText: /Press claims|War of conquest/ }).first();
if (!(await warBtn.count())) {
  const why = await page.locator('.modal .action', { hasText: /Press claims|War of conquest/ }).first().innerText().catch(() => 'no war action shown');
  log('war not available:', why);
} else {
  await warBtn.click();
  await page.waitForTimeout(150);
  await shot('w02-confirm');
  await page.locator('.modal-layer:not(.hidden) footer button', { hasText: 'Confirm' }).click();
}
await page.keyboard.press('Escape');
const wars = await page.evaluate(() => Object.values(window.cnf.sim.state.wars).filter((w) => w.attackers.includes('vos')).map((w) => w.name));
log('wars declared:', wars.join(', ') || 'none');

// march the largest army toward the claimed province via the UI
const target = await page.evaluate(() => {
  const a = window.cnf;
  const w = Object.values(a.sim.state.wars).find((x) => x.attackers.includes('vos'));
  return w ? w.goal.provinces[0] : 'harrowgate';
});
const marker = await page.evaluate(() => {
  const a = window.cnf;
  const own = Object.values(a.sim.state.armies).filter((x) => x.nation === 'vos').sort((x, y) => y.regiments.length - x.regiments.length)[0];
  a.selectArmy(own.id, true);
  return own.id;
});
await page.waitForTimeout(300);
await page.locator('.context button', { hasText: 'Set destination' }).click();
const p = await page.evaluate((pid) => {
  const a = window.cnf;
  const c = a.renderer.constructor.provinceCenter(pid);
  const s = a.renderer.camera.toScreen(c.x, c.y);
  const r = a.canvas.getBoundingClientRect();
  return { x: s.x + r.left, y: s.y + r.top + 14, vis: s.x > 0 && s.y > 0 && s.x < r.width && s.y < r.height };
}, target);
await page.evaluate((pid) => window.cnf.centerOn(pid), target);
await page.waitForTimeout(200);
const p2 = await page.evaluate((pid) => {
  const a = window.cnf;
  const c = a.renderer.constructor.provinceCenter(pid);
  const s = a.renderer.camera.toScreen(c.x, c.y);
  const r = a.canvas.getBoundingClientRect();
  return { x: s.x + r.left, y: s.y + r.top + 14 };
}, target);
await page.mouse.click(p2.x, p2.y);
await page.waitForTimeout(200);
await shot('w03-marching');
log('army path:', await page.evaluate((id) => window.cnf.sim.state.armies[id]?.path.join('>'), marker));

// let the war run (answering any dialogs), then look at the war ledger
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.cnf.debugAdvance(4));
  const close = page.locator('.modal-layer:not(.hidden) .modal.narrow footer button', { hasText: /Later|Decide later|Accept|Close/ });
  if (await close.count()) await close.first().click();
}
await shot('w04-after-fighting');
const reports = await page.evaluate(() => window.cnf.sim.state.reports.filter((r) => r.attackerNations.includes('vos') || r.defenderNations.includes('vos')).length);
log('battles involving us:', reports);
await page.keyboard.press('w');
await page.waitForTimeout(200);
await shot('w05-wars-ledger');
// try a peace demand of whatever the builder suggests; else a white peace
const occupied = page.locator('.modal label.tag input[type=checkbox]');
if (await occupied.count()) await occupied.first().check();
await page.waitForTimeout(200);
await shot('w06-peace-builder');
const verdict = await page.locator('.modal .kv', { hasText: /answer/ }).first().innerText().catch(() => '');
log('peace verdict preview:', verdict.replace(/\s+/g, ' '));
const send = page.locator('.modal .action button:not(.disabled)', { hasText: 'Send peace offer' });
if (await send.count()) {
  await send.first().click();
  await page.waitForTimeout(300);
}
const after = await page.evaluate(() => Object.values(window.cnf.sim.state.wars).filter((w) => w.attackers.includes('vos') || w.defenders.includes('vos')).length);
log('wars remaining after offer:', after);
await shot('w07-after-offer');
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no errors');
await browser.close();
process.exitCode = errors.length ? 1 : 0;
