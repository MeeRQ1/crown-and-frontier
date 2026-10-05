# Performance and rule-equivalence records

Stages A–C ran on one machine (4-core Xeon @ 2.1 GHz, Node 22, headless
Chromium with software rendering); Stage D ran on a 4-core Xeon @ 2.8 GHz and Stage E on a
4-core Xeon @ 2.1 GHz, with the same software (Stage E includes a same-machine run of the
Stage D code). Compare numbers between revisions only on the same machine (the
Stage D Aldmere report includes a same-machine run of the Stage C code); none are
real-device numbers.

| File | What it is | How to reproduce |
|---|---|---|
| `baseline-*.md/json` | Simulation benchmarks of `main` at 2246696, before Stage A | `npm run bench -- --scenario reach --seeds 1-3 --years 30 --label baseline` (from a checkout of 2246696) |
| `stageA-*.md/json` | The same benchmarks after the Stage A indexes | `npm run bench -- --scenario aldmere --seeds 1-2 --years 30 --label "Stage A optimised"` |
| `*-stress900.*` | The 900-province procedural map | `npm run genstress -- --provinces 900 --nations 24 --seed 7`, then `npm run bench -- --map .scratch/stress-900.map.json --seeds 1 --years 20` |
| `web-stageA.md` | Browser: load, panning per zoom tier, map modes, ledgers, fastest speed, battles, long session | `npm run build && npm run bench:web -- --maps reach,aldmere,.scratch/stress-900.map.json --years 10` |
| `stageB-*.md/json`, `web-stageB.md` | Stage B (industrial economy) benchmarks | as for Stage A, with `--label "Stage B"` |
| `stageC-*.md/json`, `web-stageC.md` | Stage C (navy and air) benchmarks | `npm run bench -- --scenario aldmere --seeds 1-2 --years 30 --label "Stage C"`; the Reach with `--seeds 1-3`; `npm run bench:web -- --maps reach,aldmere,.scratch/stress-900.map.json --years 10` |
| `stageD-*.md/json`, `web-stageD.md` | Stage D (new maps; far-zoom level of detail) benchmarks, run one at a time | `npm run bench -- --scenario aldmere --seeds 1-2 --years 30`; Midsea the same with `--label "Stage D"`; Steppe and the Baltic with `--seeds 1`; `npm run bench:web -- --maps midsea,.scratch/stress-900.map.json --years 2` |
| `stageE-*.md/json`, `web-stageE.md` | Stage E (focus, settlements, influence) benchmarks, run one at a time: three runs per standard map for the worker decision | `npm run bench -- --scenario aldmere --seeds 1-3 --years 30 --label "Stage E"`; the Steppe and the Baltic the same; the Middle Sea with `--seeds 1-2`; `npm run bench:web -- --maps midsea,.scratch/stress-900.map.json --years 2` |
| `rulecheck-stageC-speedups.json` | Checksums recorded with three Stage C speed-ups reverted; the current code matches them | revert the strait pre-check, the per-controller friendliness cache and the one-pass slipway count, `npm run rulecheck -- --record x.json`, restore, `--compare x.json` |
| `rulecheck-2246696.json` | Yearly state checksums of six fixed-seed AI campaigns on 2246696 | `npm run rulecheck -- --compare reports/perf/rulecheck-2246696.json --map .scratch/stress-900.map.json` |

The rule-equivalence record proves that the performance work changed no rule:
every campaign's yearly checksums match. Later Stage A commits fix rule bugs
deliberately, so they are expected to differ from this record; each such
change is listed in `docs/expansion/AUDIT.md`.
