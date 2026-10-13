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
mean.

| Save | Code | Runs (mean ms/week) | Mean | p95 | Max | AI | Naval phase | Air phase | Economy (monthly) |
|---|---|---|---|---|---|---|---|---|---|
| World 1936 | `main` | 247.5, 256.1, 265.7 | 256.4 | 417.6 | 539.1 | 180.8 | 1.7 | 1.3 | 95.9 |
| World 1936 | branch | 265.9, 248.7, 250.5 | **255.0** | 405.3 | 514.2 | 166.1 | 6.7 | 4.3 | 98.8 |
| Stress | `main` | 264.7, 242.2, 281.7 | 262.9 | 413.4 | 506.7 | 183.9 | 1.9 | 1.8 | 99.0 |
| Stress | branch | 271.8, 260.4, 299.0 | **277.1** | 430.3 | 568.7 | 182.3 | 7.7 | 5.4 | 104.2 |

## Reading it

- **Overall.** On the World 1936, the week costs the same within noise (−0.5%). On the
  stress save it costs 5% more.
- **Run-to-run noise.** The AI phase varies by ±15 ms between identical runs, which is as
  large as the whole difference.
- **Where the cost went.** The naval and air phases together cost about 8 ms more a week
  (1–2% of a week). They now resolve raiding, bombardment, sea strikes, interception,
  readiness and reports.
- **The economy.** The monthly economy costs 3–5 ms more; trade routes are now raided zone
  by zone.
- **More aircraft.** The branch plays with more aircraft. After the 48 weeks the AI has 381
  wings against 286 on the World 1936, and 428 against 333 on the stress save, because it now
  replaces losses and fills carrier decks.
- **Budget.** Neither build fits the 166 ms a week that the fastest speed asks for (six
  weeks a second) on this map. The browser reaches about three weeks a second either way,
  with each week spread over several frames (the sliced phases). The browser figures are in
  `naval-air-before.md` and `naval-air-after.md`.

Reproduce in each checkout:

```
npx tsx tools/bench-naval-air.ts --weeks 48 --json <file>
```
