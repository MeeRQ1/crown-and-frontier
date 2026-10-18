# Denser historical maps: measurements

Revision 1 is the map as shipped on `main` (9be7367), kept with the game under its own id
(`europe-r1`, …); revision 2 is the redrawn map (format 9). Every comparison below runs the
same code on both revisions, so the difference is the map.

| File | What it is | Made by |
|---|---|---|
| `stats-before.jsonl`, `stats-after.jsonl` | Starting totals of each map: provinces, sea zones, development, population, factories, ports, forts, deposits, regiments, income | `reports/tmp/mapstats.ts` (scratch) |
| `progression-<map>-r1.json` | Eight years of AI play on revision 1, seeds 1 and 2: every half year, each great power's land, development, income, factories, regiments, research and wars | `npx tsx tools/progression.ts --scenario europe-r1 --player ger --mode proxy --years 8 --seeds 1,2` |
| `progression-<map>-unscaled.json` | The same on revision 2 before land was taken into account (development, factories and builders by province count) | as above, on the redrawn map before the fix |
| `progression-<map>.json` | The same on revision 2 as shipped | `… --scenario europe …` |
| `bench-<map>-before.json` | Simulation cost per week before the redraw (revision 1, seed 1, 3 years) | `npx tsx tools/bench.ts --scenario europe --seeds 1-1 --years 3` |
| `bench-<map>-r2.json`, `bench-<map>-r1.json` | Simulation cost per week, seeds 1–3, 3 years each, revision 2 and revision 1 run one after the other on one machine with nothing else running | `npx tsx tools/bench.ts --scenario europe --seeds 1-3 --years 3` and `--scenario europe-r1` |
| `web-maps.md` | Browser drawing, hit-testing, fastest speed and a world war in progress, on both revisions | `npm run build && npx tsx tools/bench-web.ts …` |

`progression` runs are "proxy" runs: the player's realm (Germany) is played by the AI under
the same rules, so they show what the AI does with a map, not what a human does.
