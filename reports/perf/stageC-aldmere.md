### aldmere (298 provinces, 14 realms) — Stage C

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 4.2 ms, new campaign 7 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 7.97 | 6.95 | 15.2 | 21.29 | 42.2 (496) |
| 2 | 1440 | 7.66 | 6.75 | 13.95 | 19.14 | 28.5 (527) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 5.01 | 13.86 | 38.5 |
| m.economy | 3.53 | 7.62 | 10 |
| ai.strategic | 3.14 | 7.57 | 23.1 |
| ai.operational | 1.85 | 10.49 | 27 |
| armyCare | 1.1 | 2.58 | 5.4 |
| m.victory | 0.8 | 1.82 | 3.7 |
| m.integration | 0.78 | 2.47 | 10.1 |
| m.diplomacy | 0.29 | 0.97 | 2.8 |
| m.events | 0.22 | 0.98 | 3.2 |
| naval | 0.13 | 0.64 | 1.6 |
| m.wars | 0.08 | 0.46 | 4.1 |
| battles | 0.07 | 0.57 | 14.9 |
| sieges | 0.06 | 0.26 | 1.3 |
| m.research | 0.06 | 0.17 | 0.9 |
| movement | 0.04 | 0.18 | 1.9 |
| recruitment | 0.03 | 0.17 | 0.8 |
| air | 0.02 | 0.18 | 0.4 |
| construction | 0.02 | 0.05 | 0.3 |
| warScores | 0.02 | 0.12 | 0.6 |
| orders | 0.01 | 0.03 | 0.6 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 497: 42.2 ms (ai 38.5, ai.operational 27, ai.strategic 11.4, armyCare 3.3)
- week 4: 37.3 ms (ai 10.1, m.integration 10.1, m.economy 10, ai.strategic 8, m.victory 2.1, ai.operational 2)
- week 1: 36.4 ms (ai 30.1, ai.strategic 23.1, ai.operational 6.6)
- week 499: 33.8 ms (ai 29.7, ai.operational 22.1, ai.strategic 7.5, armyCare 3.5)
- week 500: 33.1 ms (ai 18.6, ai.operational 14.1, m.economy 7.8, ai.strategic 4.4, armyCare 3)

Call costs at mid-campaign: findPath 0.06 ms (187/200 found), reachFrom 0.07 ms, supply distances (cold, per realm) 0.08 ms, evaluateTreaty 0.03 ms.

State size (KB): y0 123, y1 192, y10 294, y20 304, y30 315. Heap (MB): y0 11, y1 13.6, y10 16.4, y20 17.7, y30 17.8.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 23 armies, 0 wars, 37 memories; y10: 17 armies, 1 wars, 142 memories; y20: 19 armies, 1 wars, 188 memories; y30: 23 armies, 0 wars, 205 memories.
