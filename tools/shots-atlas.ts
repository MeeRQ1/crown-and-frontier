// The screen inventory in pictures: every screen, ledger, inspector and dialog the
// game has, at 1366×800, and a narrow 390×844 set. The same script makes the
// before and after sets of the atlas update, so the two can be compared shot by shot.
//   npm run build && npx tsx tools/shots-atlas.ts before|after
// Writes docs/screenshots/atlas/<label>/*.jpg and prints any step that failed.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';
import { diploSave } from './diplo-save';
import { seaAirSave } from './sea-air-save';

const label = process.argv[2] ?? 'after';
const OUT = `docs/screenshots/atlas/${label}`;
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain' };
const failed: string[] = [];

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cnf = any;
const cnf = (page: Page, fn: (app: Cnf, arg: any) => unknown, arg?: unknown) => page.evaluate(([f, a]) => new Function('app', 'arg', `return (${f})(app, arg)`)((window as any).cnf, a), [fn.toString(), arg] as const);

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
    const wide = await browser.newPage({ viewport: { width: 1366, height: 800 } });
    wide.on('pageerror', (e) => errors.push(String(e)));
    await run(wide, origin, 'w');
    const narrow = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    narrow.on('pageerror', (e) => errors.push(String(e)));
    await runNarrow(narrow, origin);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(errors.length ? `page errors:\n  ${errors.join('\n  ')}` : 'no page errors');
  console.log(failed.length ? `steps that failed:\n  ${failed.join('\n  ')}` : 'every step ran');
}

async function step(page: Page, name: string, fn: () => Promise<void>): Promise<void> {
  if (only && !only.test(name)) return;
  try {
    await fn();
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 80 });
  } catch (e) {
    failed.push(`${name}: ${String(e).split('\n')[0]}`);
  }
}

const clickText = (page: Page, text: string | RegExp) => page.locator('button:visible', { hasText: text }).first().click();

async function freshGame(page: Page, origin: string, map: string | null, tutorial: boolean): Promise<void> {
  await page.goto(origin);
  await page.waitForSelector('canvas, .menu-list button, [data-fk="new-campaign"]');
  await page.waitForTimeout(300);
  await cnf(page, (app, a) => app.newGame({ scenario: a.map, seed: 7 }, a.tutorial), { map: map ?? 'aldmere', tutorial });
  await page.waitForSelector('canvas.map');
  await page.waitForTimeout(600);
}

async function loadSave(page: Page, origin: string, text: string, player: string): Promise<void> {
  await page.goto(origin);
  await page.waitForTimeout(400);
  await cnf(page, (app, t) => app.loadText(t), text);
  await page.waitForFunction((p) => (window as any).cnf.player === p, player, { timeout: 10000 });
  await cnf(page, (app) => {
    app.setSpeed(0);
    app.ui.dockOpen = false;
    document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
    app.refresh();
  });
  await page.waitForTimeout(500);
}

async function run(page: Page, origin: string, p: string): Promise<void> {
  // ── the menu screens ──
  await page.goto(origin);
  await page.waitForTimeout(800);
  await step(page, `${p}-m01-main-menu`, async () => {});
  await step(page, `${p}-m02-new-campaign`, async () => {
    await clickText(page, 'New campaign');
  });
  await step(page, `${p}-m03-new-campaign-midsea`, async () => {
    await page.locator('[data-map="midsea"]').first().click();
  });
  await step(page, `${p}-m04-load-empty`, async () => {
    await page.goto(origin);
    await page.waitForTimeout(300);
    await clickText(page, 'Load or import');
  });
  await step(page, `${p}-m05-import-malformed`, async () => {
    await cnf(page, (app) => app.loadText('{"format":"crown-and-frontier-save","schema":4,"state":'));
  });
  await step(page, `${p}-m06-map-library`, async () => {
    await page.goto(origin);
    await page.waitForTimeout(300);
    await clickText(page, 'Map library');
  });
  await step(page, `${p}-m07-map-editor`, async () => {
    await page.locator('[data-fk="new-map"]').click();
    await page.waitForTimeout(800);
  });
  await step(page, `${p}-m08-settings`, async () => {
    await page.goto(origin);
    await page.waitForTimeout(300);
    await clickText(page, 'Settings');
  });
  await step(page, `${p}-m09-how-to-play`, async () => {
    await page.goto(origin);
    await page.waitForTimeout(300);
    await clickText(page, 'How to play');
  });

  // ── a fresh campaign on the default map ──
  await freshGame(page, origin, null, true);
  await step(page, `${p}-g01-tutorial-welcome`, async () => {});
  await cnf(page, (app) => app.tutorial?.finish());
  await step(page, `${p}-g02-hud-and-map`, async () => {
    await cnf(page, (app) => {
      app.selectProvince(null);
      app.refresh();
    });
  });
  await step(page, `${p}-g03-province-own-capital`, async () => {
    await cnf(page, (app) => app.selectProvince(app.sim.state.nations[app.player].capital, true));
    await page.waitForTimeout(500);
  });
  await step(page, `${p}-g04-province-foreign`, async () => {
    await cnf(page, (app) => {
      const st = app.sim.state;
      const own = st.nations[app.player].capital;
      const w = app.sim.world;
      let best: string | null = null;
      let bestHop = 1e9;
      for (const id of w.provIds) {
        const o = st.provinces[id].owner;
        if (!o || o === app.player) continue;
        const hop = w.hop(own, id) ?? 1e9;
        if (hop < bestHop) [best, bestHop] = [id, hop];
      }
      const foreign = { id: best };
      app.selectProvince(foreign.id, true);
    });
    await page.waitForTimeout(500);
  });
  await step(page, `${p}-g05-army`, async () => {
    await cnf(page, (app) => {
      const a = Object.values(app.sim.state.armies).find((x: any) => x.nation === app.player) as any;
      app.selectArmy(a.id, true);
    });
    await page.waitForTimeout(500);
  });
  await cnf(page, (app) => {
    app.selectArmy(null);
    app.selectProvince(null);
  });
  const tabs: Array<[string, string]> = [
    ['realm', 'l01'],
    ['industry', 'l02'],
    ['military', 'l03'],
    ['research', 'l04'],
    ['focus', 'l05'],
    ['diplomacy', 'l06'],
    ['wars', 'l07'],
    ['victory', 'l08'],
    ['log', 'l09'],
    ['help', 'l10'],
  ];
  for (const [tab, n] of tabs) {
    await step(page, `${p}-${n}-ledger-${tab}`, async () => {
      await cnf(page, (app, t) => app.openLedger(t), tab);
      await page.waitForTimeout(300);
    });
  }
  await step(page, `${p}-l11-help-with-map-hover`, async () => {
    // the pointer over the part of the map the Help ledger covers
    await page.mouse.move(420, 420);
    await page.mouse.move(430, 430);
    await page.waitForTimeout(400);
  });
  await step(page, `${p}-l12-diplomacy-neighbour`, async () => {
    await cnf(page, (app) => {
      const st = app.sim.state;
      const other = Object.keys(st.nations).find((n) => n !== app.player && st.nations[n].alive !== false);
      app.openDiplomacy(other);
    });
    await page.waitForTimeout(300);
  });
  await cnf(page, (app) => app.closeLedger());
  const modes = ['terrain', 'supply', 'economy', 'frontier', 'diplomacy', 'military', 'resources', 'sea'];
  for (const [i, mode] of modes.entries()) {
    await step(page, `${p}-x${String(i + 1).padStart(2, '0')}-mode-${mode}`, async () => {
      await cnf(page, (app, m) => {
        app.setMode(m);
        app.refresh();
      }, mode);
      await page.waitForTimeout(600);
    });
  }
  await cnf(page, (app) => app.setMode('political'));
  await step(page, `${p}-d01-game-menu`, async () => {
    await cnf(page, (app) => app.openMenu());
  });
  await step(page, `${p}-d02-confirm-quit`, async () => {
    await page.keyboard.press('Escape');
    await cnf(page, (app) => app.openMenu());
    await page.waitForTimeout(200);
    // a confirmation: delete a save from the Load screen
    await cnf(page, (app) => app.save('slot1'));
    await page.waitForTimeout(400);
    await page.goto(origin);
    await page.waitForTimeout(300);
    await clickText(page, 'Load or import');
    await page.waitForTimeout(300);
    await page.locator('button[title="Delete this save"]').first().click();
  });
  await step(page, `${p}-m10-load-with-save`, async () => {
    await page.keyboard.press('Escape');
    await page.locator('.modal-layer:not(.hidden) footer button').first().click({ timeout: 1000 }).catch(() => {});
  });

  // a decision card (an event or proposal) waiting in the dock
  await freshGame(page, origin, null, false);
  await step(page, `${p}-d03-decision-card`, async () => {
    await cnf(page, (app) => app.setSpeed(4));
    await page.waitForFunction(() => !!document.querySelector('.dock .decision-card, .decision-card'), null, { timeout: 120000 });
    await cnf(page, (app) => app.setSpeed(0));
    await page.waitForTimeout(500);
  });
  await step(page, `${p}-d04-end-victory`, async () => {
    await cnf(page, (app) => {
      const st = app.sim.state;
      const scores: Record<string, number> = {};
      for (const n of Object.keys(st.nations)) scores[n] = n === app.player ? 412 : 200 + n.length * 13;
      st.result = { tick: st.tick, winner: app.player, path: 'economic', reason: 'Your realm held the economic lead for the required time.', playerOutcome: 'victory', scores };
      app.showEnd();
    });
  });

  // ── a prepared war: Aurel in the Reach, winning one war and losing another ──
  const d = diploSave();
  await loadSave(page, origin, d.text, 'aur');
  await step(page, `${p}-w01-wars-at-war`, async () => {
    await cnf(page, (app) => app.openLedger('wars'));
  });
  await step(page, `${p}-w02-peace-conference`, async () => {
    await page.locator('[data-sk="peace-conference"] [data-fk="settle-suggest"]').first().click();
    await page.waitForTimeout(300);
    await page.locator('[data-sk="peace-conference"] .demand-list').first().scrollIntoViewIfNeeded();
  });
  await step(page, `${p}-w03-settlement-offered`, async () => {
    await cnf(page, (app) => {
      app.closeLedger();
      app.ui.dockOpen = true;
      app.refresh();
    });
  });
  await step(page, `${p}-w04-diplomacy-partner`, async () => {
    await cnf(page, (app, id) => {
      app.ui.dockOpen = false;
      app.openDiplomacy(id);
    }, d.ids.partner);
  });
  await step(page, `${p}-w05-industry-with-trade`, async () => {
    await cnf(page, (app) => app.openLedger('industry'));
  });
  await step(page, `${p}-w06-victory-mid-game`, async () => {
    await cnf(page, (app) => app.openLedger('victory'));
  });

  // ── a prepared navy and air front: Serrata in the Reach ──
  const s = seaAirSave();
  await loadSave(page, origin, s.text, 'ser');
  await step(page, `${p}-n01-fleet`, async () => {
    await cnf(page, (app, f) => app.selectFleet(f, true), s.ids.fleet);
    await page.waitForTimeout(400);
  });
  await step(page, `${p}-n02-sea-zone`, async () => {
    await cnf(page, (app, z) => app.selectZone(z), s.ids.zone);
    await page.waitForTimeout(400);
  });
  await step(page, `${p}-n03-air-wing`, async () => {
    await cnf(page, (app, w) => app.selectWing(w), s.ids.attack);
    await page.waitForTimeout(400);
  });
  await step(page, `${p}-n04-enemy-army`, async () => {
    await cnf(page, (app, a) => app.selectArmy(a, true), s.ids.theirs);
    await page.waitForTimeout(400);
  });
  await step(page, `${p}-n05-military-navy-air`, async () => {
    await cnf(page, (app) => {
      app.selectArmy(null);
      app.openLedger('military');
    });
    await page.waitForTimeout(300);
    await page.locator('text=/^Navy|Fleets/').first().scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
  });

  // ── the largest map, at world scale ──
  await freshGame(page, origin, 'midsea', false);
  await step(page, `${p}-z01-midsea-world`, async () => {
    await cnf(page, (app) => app.fitWorld());
    await page.waitForTimeout(800);
  });
  await step(page, `${p}-z02-midsea-local`, async () => {
    await cnf(page, (app) => app.selectProvince(app.sim.state.nations[app.player].capital, true));
    await page.mouse.move(683, 400);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -240);
    await page.waitForTimeout(800);
  });
}

async function runNarrow(page: Page, origin: string): Promise<void> {
  const p = 'n';
  await page.goto(origin);
  await page.waitForTimeout(800);
  await step(page, `${p}-m01-main-menu`, async () => {});
  await step(page, `${p}-m02-new-campaign`, async () => {
    await clickText(page, 'New campaign');
  });
  await freshGame(page, origin, null, false);
  await step(page, `${p}-g02-hud-and-map`, async () => {});
  await step(page, `${p}-g03-province-own-capital`, async () => {
    await cnf(page, (app) => app.selectProvince(app.sim.state.nations[app.player].capital, true));
    await page.waitForTimeout(500);
  });
  await step(page, `${p}-l01-ledger-realm`, async () => {
    await cnf(page, (app) => {
      app.selectProvince(null);
      app.openLedger('realm');
    });
  });
  await step(page, `${p}-l06-ledger-diplomacy`, async () => {
    await cnf(page, (app) => app.openLedger('diplomacy'));
  });
  await step(page, `${p}-l04-ledger-research`, async () => {
    await cnf(page, (app) => app.openLedger('research'));
  });
  await step(page, `${p}-d01-game-menu`, async () => {
    await cnf(page, (app) => {
      app.closeLedger();
      app.openMenu();
    });
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
