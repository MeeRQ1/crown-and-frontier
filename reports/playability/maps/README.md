# Denser historical maps: measurements

Revision 1 is the map as shipped on `main` (9be7367), kept with the game under its own id
(`europe-r1`, …). Revision 2 is the redrawn map (format 9). Every comparison below runs the
same code on both revisions, so the difference is the map. `main` rows run `main`'s own code
(a worktree at 9be7367) on its own map.

| File | What it is | Made by |
|---|---|---|
| `stats-before.jsonl`, `stats-after.jsonl` | Starting totals of each map: provinces, sea zones, development, population, factories, ports, forts, deposits, regiments, income | `reports/tmp/mapstats.ts` (scratch) |
| `progression-<map>-r1.json` | Eight years of AI play on revision 1, seeds 1 and 2: every half year, each great power's land, development, income, factories, regiments, research and wars | `npx tsx tools/progression.ts --scenario europe-r1 --player ger --mode proxy --years 8 --seeds 1,2` |
| `progression-<map>.json` | The same on revision 2 | `… --scenario europe …` |
| `progression-<map>-unscaled.json` | Revision 2 before land was taken into account (development, factories and builders by province count), with the code of that time | as above, on the redrawn map before the fix |
| `bench-<map>-r2.json`, `bench-<map>-r1.json` | Simulation cost per week, seeds 1–3, 3 years each, run one after the other with nothing else running | `npx tsx tools/bench.ts --scenario europe --seeds 1-3 --years 3` and `--scenario europe-r1` |
| `bench-<map>-main.json` | The same with `main`'s code | `tools/bench.ts` in the `main` worktree |
| `bench-<map>-before.json` | One seed before the redraw (revision 1, the code of that time) | `… --seeds 1-1` |
| `steps.md`, `steps-unweighted.md` | Provinces on the way, march weeks, aircraft steps and supplied land between capitals, revision 1 against revision 2; with steps counting the ground they cover, and as at f36f6be before they did | `npx tsx tools/map-steps.ts --out …` |
| `web-maps.md` | Browser drawing, map modes, hit-testing, ledgers, the fastest speed, a battle on screen and two years at full speed, on both revisions of Europe 1914, Europe 1936 and the World 1914 | `npm run build && npx tsx tools/bench-web.ts --maps europe,<europe-rev1.json>,… --years 2` |
| `web-maps-same-view.md` | Drawing the same view (France's capital) at the same zooms on both revisions | `… --at fra --only panning` |
| `web-stress.md` | A world war at week 280 on both revisions of the World 1914 and 1936: 12 weeks a week per frame, and in slices at the fastest speed | `… --maps '' --stress earth-1936:1:280,earth-1936-r1:1:280,earth:1:280,earth-r1:1:280` |
| `web-main.md`, `web-main-earth.md` | The World 1914 and the same stress states with `main`'s build and tool | `tools/bench-web.ts` in the `main` worktree |
| `web-aldmere-branch.md`, `web-aldmere-main.md` | Aldmere (not redrawn) on the branch and on `main`, side by side | `… --maps aldmere --years 2` |

`progression` runs are "proxy" runs: the player's realm (Germany) is played by the AI under
the same rules, so they show what the AI does with a map, not what a human does. The browser
runs use headless Chromium with software rendering on a 4-core machine; the revision-1 map
files for the browser are the retained revision packed as a map package (scenario and
geometry), registered under its own id.
