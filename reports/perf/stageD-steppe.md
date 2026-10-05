### steppe (263 provinces, 11 realms) — Stage D

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-1; GC exposed: true.

Creation: world build 3.4 ms, new campaign 6.1 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1248 | 7.16 | 6.66 | 12.82 | 17.08 | 55.4 (1235) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 4.81 | 12.01 | 49.5 |
| ai.strategic | 2.82 | 6.61 | 18.9 |
| m.economy | 2.39 | 4.81 | 7.9 |
| ai.operational | 1.97 | 7.68 | 47.1 |
| armyCare | 0.84 | 2.11 | 5.4 |
| m.integration | 0.79 | 2.16 | 6.4 |
| m.victory | 0.6 | 1.7 | 2.1 |
| m.diplomacy | 0.23 | 0.51 | 1.1 |
| m.events | 0.23 | 0.84 | 2 |
| naval | 0.12 | 0.43 | 2.6 |
| battles | 0.08 | 0.67 | 1.8 |
| sieges | 0.06 | 0.23 | 1.3 |
| m.research | 0.06 | 0.13 | 0.4 |
| m.wars | 0.06 | 0.2 | 0.5 |
| movement | 0.05 | 0.17 | 1 |
| recruitment | 0.04 | 0.2 | 1.3 |
| construction | 0.02 | 0.07 | 0.3 |
| warScores | 0.02 | 0.11 | 0.3 |
| orders | 0.01 | 0.04 | 0.2 |
| air | 0.01 | 0.05 | 0.3 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 1236: 55.4 ms (ai 49.5, ai.operational 47.1, ai.strategic 2.4, m.economy 2)
- week 1: 31.4 ms (ai 25.4, ai.strategic 18.9, ai.operational 6.3)
- week 37: 23.6 ms (ai 22.6, ai.operational 19.9, ai.strategic 2.7)
- week 92: 20.5 ms (ai 9.2, m.economy 6.3, ai.operational 5, ai.strategic 4.1)
- week 800: 20 ms (ai 10.1, ai.operational 6.9, m.economy 4.3, ai.strategic 3.1)

Call costs at mid-campaign: findPath 0.07 ms (195/200 found), reachFrom 0.1 ms, supply distances (cold, per realm) 0.09 ms, evaluateTreaty 0.03 ms.

State size (KB): y0 105, y1 151, y10 264, y20 276. Heap (MB): y0 12.9, y1 15.2, y10 18.3, y20 19.1.
Counts: y0: 22 armies, 0 wars, 0 memories; y1: 15 armies, 0 wars, 26 memories; y10: 23 armies, 0 wars, 115 memories; y20: 18 armies, 1 wars, 117 memories.
