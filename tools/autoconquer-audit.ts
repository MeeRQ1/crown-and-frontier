// Simple Auto-conquer in the browser (production build, real input): on the developed
// campaign at war with Poland (tools/play-audit.ts' save), open Military, press
// Auto-conquer with the defaults, let the weeks run, pause and resume, change the
// opponents and priority in its settings, keep one army for direct command, take
// over everything, and check the Wars ledger's button.
//   npx tsx tools/autoconquer-audit.ts [--dist dist] [--save reports/tmp/play-dev.json] [--out reports/playability/after]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { loadSave, serve } from './qol-audit';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const SAVE = get('save', 'reports/tmp/play-dev.json');
const OUT = get('out', 'reports/playability/after');

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const { origin, close } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await loadSave(page, origin, SAVE, 'ger');
  const r: Record<string, unknown> = {};
  const state = () =>
    page.evaluate(() => {
      const st = (window as any).cnf.sim.state;
      const op = Object.values(st.operations).find((o: any) => o.kind === 'war') as any;
      const ger = (t: string) => Object.values(st[t]).filter((u: any) => u.nation === 'ger') as any[];
      return op
        ? { id: op.id, status: op.status, enemies: op.enemies, strategy: op.strategy, members: ger('armies').filter((a) => a.op === op.id).length + ger('fleets').filter((a) => a.op === op.id).length + ger('wings').filter((a) => a.op === op.id).length, free: ger('armies').filter((a) => !a.op).length, reserved: ger('armies').filter((a) => a.reserved).length, taken: op.stats.taken, issue: op.issue?.text ?? null, playerLog: st.playerLog.length }
        : null;
    });
  // 1. Military (M), the Auto-conquer section, Activate with the defaults: 2 inputs
  await page.keyboard.press('m');
  await page.waitForTimeout(200);
  r.chooser = await page.locator('[data-sk="ac-chooser"]').count();
  r.enemiesOffered = await page.locator('[data-fk^="ac-enemy-"]').count();
  await page.screenshot({ path: join(OUT, 'autoconquer-chooser.png') });
  await page.locator('[data-fk="ac-activate"]').click();
  await page.waitForTimeout(200);
  r.afterActivate = await state();
  await page.screenshot({ path: join(OUT, 'autoconquer-card.png') });
  // 2. eight weeks pass (the player does nothing)
  const log0 = (r.afterActivate as any)?.playerLog ?? 0;
  await page.evaluate(() => (window as any).cnf.debugAdvance(8));
  await page.waitForTimeout(300);
  r.after8 = await state();
  r.ordersByPlayerIn8Weeks = ((r.after8 as any)?.playerLog ?? 0) - log0;
  await page.screenshot({ path: join(OUT, 'autoconquer-8wk.png') });
  // 3. pause and resume from the card
  await page.evaluate((id) => (window as any).cnf.selectOp(id), (r.after8 as any).id);
  await page.waitForTimeout(100);
  await page.locator('[data-fk="op-pause"]').click();
  r.paused = (await state())?.status;
  await page.locator('[data-fk="op-resume"]').click();
  r.resumed = (await state())?.status;
  // 4. settings: priority "Spare our men", save
  await page.locator('[data-fk="op-edit"]').click();
  await page.waitForTimeout(100);
  r.editorEnemyBoxes = await page.locator('[data-fk^="op-enemy-"]').count();
  await page.locator('[data-fk="op-Priority-manpower"]').click();
  await page.screenshot({ path: join(OUT, 'autoconquer-settings.png') });
  r.saveCovered = await page.evaluate(() => {
    const b = document.querySelector('[data-fk="op-save"]') as HTMLElement | null;
    if (!b) return 'no button';
    const rc = b.getBoundingClientRect();
    const top = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
    return top && !b.contains(top) ? (top.closest('[class]') as HTMLElement)?.className ?? 'covered' : null;
  });
  await page.locator('[data-fk="op-save"]').click({ timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(100);
  r.strategy = (await state())?.strategy;
  // 5. one army kept for direct command from its card
  const army = await page.evaluate((id) => {
    const st = (window as any).cnf.sim.state;
    return (Object.values(st.armies) as any[]).find((a) => a.nation === 'ger' && a.op === id)?.id;
  }, (r.after8 as any).id);
  await page.evaluate((id) => (window as any).cnf.selectArmy(id, true), army);
  await page.waitForTimeout(150);
  // a member: take it out (the card's "Take direct command"), which keeps it for direct command
  const takeBtn = page.locator('[data-fk="unit-op-release"]');
  if (await takeBtn.count()) await takeBtn.click();
  else await page.evaluate((id) => (window as any).cnf.do({ type: 'releaseOp', units: [id] }), army);
  await page.waitForTimeout(100);
  r.armyReserved = await page.evaluate((id) => !!(window as any).cnf.sim.state.armies[id]?.reserved, army);
  r.reserveCallout = await page.locator('[data-sk="reserved"]').count();
  await page.screenshot({ path: join(OUT, 'autoconquer-reserved.png') });
  await page.evaluate(() => (window as any).cnf.debugAdvance(1));
  r.armyStillOut = await page.evaluate((id) => !(window as any).cnf.sim.state.armies[id]?.op, army);
  // 6. take over everything from the card
  await page.evaluate((id) => (window as any).cnf.selectOp(id), (r.after8 as any).id);
  await page.waitForTimeout(100);
  await page.locator('[data-fk="ac-takeover"]').click();
  await page.waitForTimeout(100);
  r.afterTakeover = await state();
  // 7. the Wars ledger offers Auto-conquer per war when no mandate covers it (stop the mandate first)
  await page.locator('[data-fk="op-cancel-op"]').click();
  await page.waitForTimeout(100);
  const ok = page.locator('.modal-layer:not(.hidden) footer button.primary, .modal-layer:not(.hidden) footer button.danger');
  if (await ok.count()) await ok.first().click();
  await page.waitForTimeout(100);
  await page.keyboard.press('w');
  await page.waitForTimeout(200);
  r.warsButton = await page.locator('[data-fk^="war-auto-"]').count();
  await page.screenshot({ path: join(OUT, 'autoconquer-wars.png') });
  r.errors = errors;
  writeFileSync(join(OUT, 'autoconquer.json'), `${JSON.stringify(r, null, 1)}\n`);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
  close();
}

void main();
