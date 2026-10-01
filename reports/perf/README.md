# Performance and rule-equivalence records

All numbers come from one machine (4-core Xeon @ 2.1 GHz, Node 22, headless
Chromium with software rendering). Compare them between revisions on the same
machine; they are not real-device numbers.

| File | What it is | How to reproduce |
|---|---|---|
| `baseline-*.md/json` | Simulation benchmarks of `main` at 2246696, before Stage A | `npm run bench -- --scenario reach --seeds 1-3 --years 30 --label baseline` (from a checkout of 2246696) |
| `stageA-*.md/json` | The same benchmarks after the Stage A indexes | `npm run bench -- --scenario aldmere --seeds 1-2 --years 30 --label "Stage A optimised"` |
| `*-stress900.*` | The 900-province procedural map | `npm run genstress -- --provinces 900 --nations 24 --seed 7`, then `npm run bench -- --map .scratch/stress-900.map.json --seeds 1 --years 20` |
| `web-stageA.md` | Browser: load, panning per zoom tier, map modes, ledgers, fastest speed, battles, long session | `npm run build && npm run bench:web -- --maps reach,aldmere,.scratch/stress-900.map.json --years 10` |
| `rulecheck-2246696.json` | Yearly state checksums of six fixed-seed AI campaigns on 2246696 | `npm run rulecheck -- --compare reports/perf/rulecheck-2246696.json --map .scratch/stress-900.map.json` |

The rule-equivalence record proves that the performance work changed no rule:
every campaign's yearly checksums match. Later Stage A commits fix rule bugs
deliberately, so they are expected to differ from this record; each such
change is listed in `docs/expansion/AUDIT.md`.
