### aldmere (298 provinces, 14 realms) — Stage D

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 4 ms, new campaign 8 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 8.5 | 7.44 | 16.31 | 24.1 | 41.9 (3) |
| 2 | 1440 | 7.92 | 7.11 | 14.27 | 18.26 | 30.2 (1275) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 5.32 | 17.49 | 32.4 |
| m.economy | 3.79 | 7.25 | 9.7 |
| ai.strategic | 3.35 | 8.59 | 25.2 |
| ai.operational | 1.95 | 10.68 | 20.3 |
| armyCare | 1.14 | 2.46 | 6.5 |
| m.victory | 0.92 | 2.09 | 5 |
| m.integration | 0.83 | 2.31 | 5.2 |
| m.diplomacy | 0.34 | 0.67 | 6.6 |
| m.events | 0.27 | 1.11 | 3.1 |
| naval | 0.14 | 0.45 | 2.6 |
| battles | 0.08 | 0.63 | 16.6 |
| m.wars | 0.08 | 0.46 | 3 |
| sieges | 0.07 | 0.26 | 3.4 |
| m.research | 0.07 | 0.17 | 0.8 |
| movement | 0.05 | 0.22 | 4.8 |
| recruitment | 0.04 | 0.22 | 1 |
| air | 0.02 | 0.18 | 0.9 |
| construction | 0.02 | 0.08 | 0.6 |
| warScores | 0.02 | 0.11 | 0.3 |
| orders | 0.01 | 0.04 | 1.6 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 4: 41.9 ms (ai 21.7, ai.strategic 16.9, m.diplomacy 6.6, ai.operational 4.7, m.integration 4.1, m.economy 4.1)
- week 516: 41.6 ms (ai 22.8, ai.operational 17.2, m.economy 9.7, ai.strategic 5.6, armyCare 4)
- week 1: 39.4 ms (ai 32.4, ai.strategic 25.2, ai.operational 6.9, armyCare 2.3)
- week 517: 38.3 ms (ai 31.7, ai.operational 20.3, ai.strategic 11.4, armyCare 6)
- week 519: 35.3 ms (ai 25.3, ai.operational 15.5, ai.strategic 9.8, armyCare 6.5, movement 3.2)

Call costs at mid-campaign: findPath 0.07 ms (187/200 found), reachFrom 0.07 ms, supply distances (cold, per realm) 0.09 ms, evaluateTreaty 0.02 ms.

State size (KB): y0 123, y1 192, y10 294, y20 304, y30 315. Heap (MB): y0 13, y1 15.7, y10 18.4, y20 19.7, y30 19.9.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 23 armies, 0 wars, 37 memories; y10: 17 armies, 1 wars, 142 memories; y20: 19 armies, 1 wars, 188 memories; y30: 23 armies, 0 wars, 205 memories.

Same machine, same day, for comparison (the rules for Aldmere are unchanged: `npm run rulecheck -- --compare reports/perf/rulecheck-stageC-speedups.json` reports all five campaigns identical):

| Code | Seed 1 p99 | Seed 2 p99 | Seed 1 avg |
|---|---|---|---|
| Stage C (1bf4f4b) | 22.01 | 17.99 | 8.18 |
| Stage D, run 1 (seed 1 only) | 26.24 | — | 9 |
| Stage D, run 2 (above) | 24.1 | 18.26 | 8.5 |

The same campaign's seed-1 p99 ranges from 22 to 26 ms from run to run, so the 25 ms worker trigger is crossed in one of three runs. The decision is recorded in `STATUS.md` and `docs/expansion/PLAN.md`.
