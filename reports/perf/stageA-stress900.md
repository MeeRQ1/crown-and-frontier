### stress-900 (900 provinces, 24 realms) — Stage A optimised

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 20 years, seeds 1-1; GC exposed: true.

Creation: world build 34 ms, new campaign 28.8 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 960 | 29.15 | 25.69 | 51.93 | 66.36 | 88.6 (101) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 19.45 | 51.34 | 83 |
| ai.strategic | 12.13 | 21.78 | 41.8 |
| m.economy | 7.98 | 14.44 | 14.8 |
| ai.operational | 7.29 | 36.88 | 59.2 |
| armyCare | 5.41 | 10.37 | 12.9 |
| m.victory | 2.63 | 5.43 | 6.5 |
| m.integration | 2.3 | 5.44 | 9.1 |
| m.events | 0.76 | 2.35 | 3.1 |
| m.diplomacy | 0.62 | 1.96 | 2.7 |
| movement | 0.18 | 1.15 | 2.7 |
| m.wars | 0.17 | 0.84 | 2.9 |
| sieges | 0.15 | 0.43 | 3.4 |
| battles | 0.13 | 1.21 | 2 |
| m.research | 0.1 | 0.25 | 1.1 |
| warScores | 0.08 | 0.43 | 2.1 |
| recruitment | 0.05 | 0.24 | 1.8 |
| construction | 0.04 | 0.13 | 0.2 |
| orders | 0.02 | 0.05 | 0.2 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 102: 88.6 ms (ai 83, ai.operational 59.2, ai.strategic 23.8, armyCare 3.6)
- week 110: 85.4 ms (ai 73.7, ai.operational 52, ai.strategic 21.7, armyCare 8.9)
- week 112: 85.4 ms (ai 57.9, ai.operational 38.7, ai.strategic 19.1, m.economy 8.7, armyCare 5.7, m.integration 5.4)
- week 100: 85.1 ms (ai 51.9, ai.operational 36.1, ai.strategic 15.7, m.economy 11.4, m.integration 5.3, armyCare 5.1, sieges 2.2)
- week 80: 80.4 ms (ai 46.7, ai.operational 24.3, ai.strategic 22.4, m.economy 13.4, armyCare 9, m.integration 4.8)

Call costs at mid-campaign: findPath 0.21 ms (200/200 found), reachFrom 0.24 ms, supply distances (cold, per realm) 0.35 ms, evaluateTreaty 0.05 ms.

State size (KB): y0 240, y1 400, y10 511, y20 528. Heap (MB): y0 13.6, y1 16.1, y10 17.5, y20 18.1.
Counts: y0: 48 armies, 0 wars, 0 memories; y1: 62 armies, 0 wars, 55 memories; y10: 58 armies, 3 wars, 333 memories; y20: 67 armies, 1 wars, 356 memories.
