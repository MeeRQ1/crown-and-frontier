// Selection gestures never buy or order anything, and military automation leaves
// the province batches and manual orders usable. In a production build, on the
// large-force campaign (a save, as Germany), through real pointer and key input:
//   1. Ctrl+click ten provinces, Ctrl+drag a box, Shift+drag a box over our armies,
//      Shift+click an army, the Select tool (X) for forces and then provinces:
//      after each, no command, no project, no recruit, no march, no crown spent;
//   2. an operation paused from its card and changed through its editor: then
//      Ctrl+click provinces shows the batch card, a double click on Confirm sends
//      one request, and a right-click march for one of its armies is obeyed (the
//      army taken under direct command); Resume from the card.
//   npx tsx tools/qol-gestures.ts --dist dist --save reports/tmp/qol-large.json [--out reports/qol/gestures.json]

import { writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { loadSave, provincePoint, serve } from './qol-audit';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const SAVE = get('save', 'reports/tmp/qol-large.json');
const OUT = get('out', '');

type Snap = { log: number; projects: number; recruits: number; marches: string; treasury: number };
const snap = (page: Page): Promise<Snap> =>
  page.evaluate(() => {
    const st = (window as any).cnf.sim.state;
    const ger = Object.values(st.armies).filter((a: any) => a.nation === 'ger') as any[];
    return {
      log: st.playerLog.length,
      projects: Object.values(st.provinces).filter((p: any) => p.project?.nation === 'ger').length,
      recruits: Object.values(st.provinces).reduce((s: number, p: any) => s + p.recruits.filter((r: any) => r.nation === 'ger').length, 0),
      marches: ger.map((a) => `${a.id}:${a.path.join(',')}`).join('|'),
      treasury: st.nations.ger.treasury,
    };
  });
const same = (a: Snap, b: Snap) => JSON.stringify(a) === JSON.stringify(b);

async function ctrlClick(page: Page, pids: string[]): Promise<number> {
  let n = 0;
  for (const pid of pids) {
    const pt = await provincePoint(page, pid);
    if (!pt) continue;
    await page.keyboard.down('Control');
    await page.mouse.click(pt.x, pt.y);
    await page.keyboard.up('Control');
    n++;
    await page.waitForTimeout(40);
  }
  return n;
}

async function drag(page: Page, key: 'Control' | 'Shift' | null, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  if (key) await page.keyboard.down(key);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
  await page.mouse.move(x1, y1, { steps: 4 });
  await page.mouse.up();
  if (key) await page.keyboard.up(key);
  await page.waitForTimeout(100);
}

async function main(): Promise<void> {
  const { origin, close } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await loadSave(page, origin, SAVE, 'ger');
  const out: Record<string, unknown> = {};

  // ten provinces of ours around the capital, each with a point clear of counters
  const ours = await page.evaluate(() => {
    const app = (window as any).cnf;
    const st = app.sim.state;
    const cap = st.nations.ger.capital;
    return app.sim.world.provIds
      .filter((p: string) => st.provinces[p].owner === 'ger')
      .sort((a: string, b: string) => (app.sim.world.hop(cap, a) ?? 99) - (app.sim.world.hop(cap, b) ?? 99) || (a < b ? -1 : 1))
      .slice(0, 16) as string[];
  });
  const base = await snap(page);

  // ── 1. selection gestures ──
  const clicked = await ctrlClick(page, ours.slice(0, 10));
  const s1 = await snap(page);
  out.ctrlClick = { provinces: clicked, selected: await page.evaluate(() => (window as any).cnf.provSel.length), batchCard: await page.locator('[data-fk="batch-confirm"]').count(), noCommand: same(base, s1) };
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    const app = (window as any).cnf;
    const c = app.renderer.provinceCenter(app.sim.state.nations.ger.capital);
    app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(36), false);
    app.mapDirty = true;
  });
  await page.waitForTimeout(300);
  await drag(page, 'Control', 420, 260, 700, 500);
  const s2 = await snap(page);
  out.ctrlDrag = { selected: await page.evaluate(() => (window as any).cnf.provSel.length), noCommand: same(base, s2) };
  await page.keyboard.press('Escape');

  const box = await page.evaluate(() => {
    const app = (window as any).cnf;
    const r = app.canvas.getBoundingClientRect();
    const ms = app.renderer.markers.filter((m: any) => app.sim.state.armies[m.army]?.nation === 'ger');
    const xs = ms.flatMap((m: any) => [m.x, m.x + m.w]);
    const ys = ms.flatMap((m: any) => [m.y, m.y + m.h]);
    const first = ms[0];
    return { x0: Math.min(...xs) - 6 + r.left, y0: Math.min(...ys) - 6 + r.top, x1: Math.max(...xs) + 6 + r.left, y1: Math.max(...ys) + 6 + r.top, one: first ? { x: first.x + first.w / 2 + r.left, y: first.y + first.h / 2 + r.top } : null, markers: ms.length };
  });
  await drag(page, 'Shift', box.x0, box.y0, box.x1, box.y1);
  const s3 = await snap(page);
  const boxed = await page.evaluate(() => (window as any).cnf.forceSel.length);
  if (box.one) {
    await page.keyboard.down('Shift');
    await page.mouse.click(box.one.x, box.one.y);
    await page.keyboard.up('Shift');
  }
  const s4 = await snap(page);
  out.shiftDragAndClick = { markers: box.markers, boxed, afterShiftClick: await page.evaluate(() => (window as any).cnf.forceSel.length), noCommand: same(base, s3) && same(base, s4) };
  await page.keyboard.press('Escape');

  // the Select tool: X, a drag for forces; the banner switch, two clicks for provinces
  await page.keyboard.press('x');
  await drag(page, null, box.x0, box.y0, box.x1, box.y1);
  const toolForces = await page.evaluate(() => (window as any).cnf.forceSel.length);
  await page.locator('[data-fk="banner-switch"]').click();
  const mode = await page.evaluate(() => (window as any).cnf.selectMode);
  for (const pid of ours.slice(10, 12)) {
    const pt = await provincePoint(page, pid);
    if (pt) await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(40);
  }
  const s5 = await snap(page);
  out.selectTool = { forcesByDrag: toolForces, mode, provincesByClick: await page.evaluate(() => (window as any).cnf.provSel.length), noCommand: same(base, s5) };
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const app = (window as any).cnf;
    app.clearForceSel();
    app.clearProvSel();
    app.setSelectMode('off');
  });

  // ── 2. an operation paused and changed; batches and manual orders still work ──
  const opId = await page.evaluate(() => {
    const app = (window as any).cnf;
    const sim = app.sim;
    const st = sim.state;
    const ger = Object.values(st.armies).filter((a: any) => a.nation === 'ger') as any[];
    const pol = sim.world.provIds.filter((p: string) => st.provinces[p].controller === 'pol' && ger.some((a) => (sim.world.hop(a.location, p) ?? 99) <= 4));
    const r = app.do({ type: 'createOp', kind: 'conquer', area: pol, units: ger.slice(0, 4).map((a) => a.id), activate: true }, true);
    const id = r.ok ? (Object.keys(st.operations).at(-1) as string) : null;
    if (id) app.selectOp(id);
    return id;
  });
  await page.waitForTimeout(150);
  await page.locator('[data-fk="op-pause"]').click();
  const paused = await page.evaluate((id) => (window as any).cnf.sim.state.operations[id!]?.status, opId);
  await page.locator('[data-fk="op-edit"]').click();
  await page.locator('[data-fk="op-save"]').click();
  const editedOk = await page.evaluate((id) => (window as any).cnf.sim.state.playerLog.at(-1)?.cmd.type === 'editOp' && !(window as any).cnf.opDraft && (window as any).cnf.selectedOp === id, opId);
  // the operation's card is open: Ctrl+click provinces brings up the batch card
  const before = await snap(page);
  await ctrlClick(page, ours.slice(12, 15));
  const card = await page.locator('[data-fk="batch-confirm"]').count();
  await page.locator('[data-fk="batch-confirm"]').dblclick();
  await page.waitForTimeout(150);
  const after = await snap(page);
  await page.keyboard.press('Escape');
  const backToOp = await page.evaluate((id) => (window as any).cnf.selectedOp === id && !!document.querySelector('[data-fk="op-resume"]'), opId);
  out.pausedOperation = { opCreated: !!opId, status: paused, edited: editedOk, batchCardOverOpCard: card, commandsFromDoubleClick: after.log - before.log, projectsQueued: after.projects - before.projects, escReturnsToOpCard: backToOp };

  // a right-click march for one of its armies: obeyed at once, taken under direct command
  const target = await page.evaluate((id) => {
    const app = (window as any).cnf;
    const st = app.sim.state;
    const a = Object.values(st.armies).find((x: any) => x.op === id && !x.battle) as any;
    const dest = app.sim.world.prov[a.location].neighbors.find((n: string) => st.provinces[n].controller === 'ger');
    app.selectOp(null);
    app.selectArmy(a.id, true);
    return { army: a.id, dest };
  }, opId);
  await page.waitForTimeout(150);
  const pt = await provincePoint(page, target.dest);
  if (pt) await page.mouse.click(pt.x, pt.y, { button: 'right' });
  await page.waitForTimeout(150);
  const manual = await page.evaluate((t) => {
    const st = (window as any).cnf.sim.state;
    const a = st.armies[t.army];
    return { lastCommand: st.playerLog.at(-1)?.cmd.type, heading: a.path.at(-1) === t.dest, underDirectCommand: a.opHold === true, stillMember: !!a.op };
  }, target);
  await page.evaluate((id) => (window as any).cnf.selectOp(id), opId);
  await page.waitForTimeout(100);
  await page.locator('[data-fk="op-resume"]').click();
  const resumed = await page.evaluate((id) => (window as any).cnf.sim.state.operations[id!]?.status, opId);
  out.manualOrder = { ...manual, resumedStatus: resumed };
  out.errors = errors;

  console.log(JSON.stringify(out, null, 1));
  if (OUT) writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  await browser.close();
  close();
}

void main();
