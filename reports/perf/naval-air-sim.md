# Simulation cost of the naval and air update (Node)

`tools/bench-naval-air.ts`: each save is loaded, one week is run to warm the caches, and then
48 weeks are timed per week and per phase, with the AI. The commands were run in a checkout of
`main` (41108f3) and in this branch, alternating, three times each. Nothing else was running.
The machine was an Intel Xeon @ 2.80 GHz (4 cores), Node 22.22.

The two saves were made once with the baseline code, so both builds play the same campaign:

- **World 1936, week 280** (`earth-1936-w280`): the profiler's late-game World, 1936.
- **Stress** (`earth-1936-w280-navalair`): the same save with every realm at war given front
  airfields, four wings on missions over each front and a battle squadron off an enemy coast.
  It starts with 333 wings and 85 fleets (`tools/naval-air-stress.ts`).

Means are milliseconds per week; the per-phase columns are means of each run's per-phase
mean. These runs are on the final code of this branch.

| Save | Code | Runs (mean ms/week) | Mean | p95 | Max | AI | Naval phase | Air phase | Economy (monthly) |
|---|---|---|---|---|---|---|---|---|---|
| World 1936 | `main` | 281.4, 265.5, 260.1 | 269.0 | 415.1 | 521.0 | 192.7 | 1.7 | 1.3 | 93.5 |
| World 1936 | branch | 271.0, 309.1, 288.4 | **289.5** | 475.1 | 576.3 | 195.0 | 5.6 | 3.3 | 110.3 |
| Stress | `main` | 287.1, 302.7, 293.3 | 294.4 | 527.1 | 609.7 | 202.6 | 2.1 | 1.8 | 113.7 |
| Stress | branch | 259.5, 279.7, 292.3 | **277.2** | 447.1 | 694.2 | 181.3 | 6.2 | 4.2 | 109.9 |

An earlier A/B, before the last AI changes (rest at peace, support on call before battles),
measured 256.4 → 255.0 on the World 1936 and 262.9 → 277.1 on the stress save.

## Reading it

- **Overall.** The difference is within the run-to-run noise, in both directions: +8% on
  the World 1936 and −6% on the stress save in the final runs. The earlier A/B measured
  −0.5% and +5%.
- **Run-to-run noise.** Single runs of the same code differ by up to 49 ms a week. The AI
  phase alone varies by ±20 ms between identical runs.
- **Where the cost went.** The naval and air phases together cost about 6 ms more a week
  (2% of a week). They now resolve raiding, bombardment, sea strikes, interception,
  readiness and reports.
- **The economy.** The monthly economy moves between 90 and 119 ms in both builds; sea
  trade is now raided zone by zone.
- **More aircraft.** The branch plays with more aircraft. After the 48 weeks the AI has
  376 wings against 286 on the World 1936, and 418 against 333 on the stress save, because
  it now replaces losses and fills carrier decks.
- **Budget.** Neither build fits the 166 ms a week that the fastest speed asks for (six
  weeks a second) on this map. In the browser profiles (`naval-air-before.md`,
  `naval-air-after.md`), with each week spread over several frames:

| Workload | `main` | Branch |
|---|---|---|
| World 1936, fastest | 3.0 weeks/s | 2.4 weeks/s |
| World 1936, fastest while dragging | 2.8 weeks/s | 2.2 weeks/s |
| Stress save, fastest | 3.1 weeks/s | 3.4 weeks/s |
| Stress save, fastest while dragging | 2.8 weeks/s | 2.7 weeks/s |

Reproduce in each checkout:

```
npx tsx tools/bench-naval-air.ts --weeks 48 --json <file>
```
