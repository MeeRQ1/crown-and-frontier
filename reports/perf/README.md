# Performance and rule-equivalence records

The performance and stability update (the ground cache, the frame budget and the sliced
phases) is documented in `lag-diagnosis.md`, with its own same-machine before/after
records listed below.

Stages A–C ran on one machine (4-core Xeon @ 2.1 GHz, Node 22, headless
Chromium with software rendering); Stage D ran on a 4-core Xeon @ 2.8 GHz and Stage E on a
4-core Xeon @ 2.1 GHz, with the same software (Stage E includes a same-machine run of the
Stage D code). The atlas update's final run measured `main` and the branch on one 4-core
Xeon @ 2.8 GHz; its results are summarised in `docs/atlas/MAPS.md`. Compare numbers between revisions only on the same machine (the
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
| `atlas-before-*.md/json`, `web-atlas-before.md` | The atlas update's audit: `main` at 99e0322 on a 4-core Xeon @ 2.1 GHz (not comparable with the final run, which used another machine) | `npm run bench -- --scenario aldmere --seeds 1-2 --years 30 --label "atlas before"` from a checkout of 99e0322 |
| `atlas-final-main-*.md/json`, `atlas-final-branch-*.md/json` | The atlas update's final simulation benchmarks: `main` (99e0322) and this branch (6153e86, the final simulation code), alternating per map on one 4-core Xeon @ 2.8 GHz with nothing else running; the Reach, Aldmere and the Middle Sea for both (30 years), Europe, Hesperia and the World for the branch (10 years); each run ends by timing a save and a load | `npx tsx tools/bench.ts --scenario <map> --seeds 1-2 --years 30` in each checkout (`main` with this branch's save-timing lines in `tools/bench.ts`); `--years 10` for the new maps |
| `web-atlas-final-main.md`, `web-atlas-final-branch.md` | The same machine in the browser: `main` on the Reach and Aldmere; the branch on those and the three new maps, plus a late-game run on the World (seed 1, week 280) comparing whole weeks per frame with weeks in slices | `npm run build`, then `npx tsx tools/bench-web.ts --maps reach,aldmere` (`main`) and `--maps reach,aldmere,europe,hesperia,earth --stress earth:1:280` (branch) |
| `lag-diagnosis.md` | The performance and stability update: how the lag was reproduced, its measured causes, the fixes, and before/after tables from the files below | — |
| `profile-before.md/json`, `profile-after.md/json` | Real gameplay workloads in production builds (`tools/profile-web.ts`): pan, zoom, select and ledgers paused; normal and fastest speed; a developed campaign; the World at war (orders, military mode, dragging while running); the editor; a leak soak. `main` 8ba06c6 and this branch, one after the other on a 4-core Xeon @ 2.1 GHz, headless Chromium with software rendering, 1366×800 | `npm run build`, then `npx tsx tools/profile-web.ts --dist <dist> --label <label> --out reports/perf/profile-<x>.md --json reports/perf/profile-<x>.json` in each checkout |
| `profile-hidpi-before.md/json`, `profile-hidpi-after.md/json` | The same at 1920×1080, pixel ratio 2 (idle, drag and fastest speed on Aldmere and the World) | as above with `--only aldmere-idle,aldmere-pan,aldmere-max,world-idle,world-pan,world-max --size 1920x1080 --dpr 2` |
| `profile-1936.md/json` | The two 1936 maps beside the World, 1914 on this branch's production build, each after five years of AI play from seed 1 (drag, zoom, select, ledgers, normal and fastest speed, dragging while running) | `npx tsx tools/profile-web.ts --dist dist --only world-idle,…,e36-…,w36-… --out reports/perf/profile-1936.md` (the 1936 workloads run only when named) |
| `profile-subpath.md` | This branch served under `/crown-and-frontier/`, as on GitHub Pages | `--base /crown-and-frontier/ --only aldmere-pan,aldmere-max,editor-pan` |
| `naval-air-before.md/json`, `naval-air-after.md/json` | The naval and air update in production builds: the World 1936 at week 280 as it stands (`w36-…`) and with every realm at war flying front-line missions (`na-…`, 333 wings and 85 fleets, `tools/naval-air-stress.ts`, made once with the baseline code); `main` 41108f3 and this branch, one after the other on a 4-core Xeon @ 2.8 GHz, headless Chromium with software rendering, 1366×800 | `npm run build`, then `npx tsx tools/profile-web.ts --dist <dist> --only w36-idle,w36-pan,w36-max,w36-max-pan,na-idle,na-pan,na-pan-mid,na-zoom,na-select,na-panels,na-normal,na-max,na-max-pan --label <label> --out reports/perf/naval-air-<x>.md --json reports/perf/naval-air-<x>.json` in each checkout |
| `naval-air-sim.md` | The same two saves in Node, per week and per phase, `main` and this branch alternating, three runs each | `npx tsx tools/bench-naval-air.ts --weeks 48 --json <file>` in each checkout |
| `rulecheck-8ba06c6.json` | Yearly state checksums of fixed-seed AI campaigns on `main` 8ba06c6 (the Reach, Aldmere, Europe, the World); this branch's sliced phases match them | `npm run rulecheck -- --compare reports/perf/rulecheck-8ba06c6.json` |
| `rulecheck-stageC-speedups.json` | Checksums recorded with three Stage C speed-ups reverted; the current code matches them | revert the strait pre-check, the per-controller friendliness cache and the one-pass slipway count, `npm run rulecheck -- --record x.json`, restore, `--compare x.json` |
| `rulecheck-2246696.json` | Yearly state checksums of six fixed-seed AI campaigns on 2246696 | `npm run rulecheck -- --compare reports/perf/rulecheck-2246696.json --map .scratch/stress-900.map.json` |

The rule-equivalence record proves that the performance work changed no rule:
every campaign's yearly checksums match. Later Stage A commits fix rule bugs
deliberately, so they are expected to differ from this record; each such
change is listed in `docs/expansion/AUDIT.md`.
