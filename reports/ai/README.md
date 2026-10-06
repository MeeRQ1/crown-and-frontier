# AI batches for the atlas update

Fixed-seed AI-only campaigns: 8 seeds (1–8) × 50-year limit, normal difficulty, on
each of Aldmere, the Reach, the Isles and the Middle Sea, run with
`tools/sim-cli.ts` (see `.scratch`-free command below). Reports record the seed
and settings of every run, so any one can be reproduced.

    npx tsx tools/sim-cli.ts --scenario <map> --seeds <n> --years 50 --quiet --json <out>.json
    npx tsx tools/sim-cli.ts --merge <a>.json,<b>.json,… --out <map>.md

- `atlas-before-<map>.md`: `main` at 99e0322, with only `tools/usage.ts` from
  this branch so that the same AI diagnostics are counted.
- `atlas-after-<map>.md`: this branch with trade contracts and the AI change
  that sends armies without an objective to the war.

The batches ran four processes at once on a 4-core machine that was also
building and taking screenshots, so their ms/tick figures are not a
performance measurement; `reports/perf/` holds the isolated benchmarks.
