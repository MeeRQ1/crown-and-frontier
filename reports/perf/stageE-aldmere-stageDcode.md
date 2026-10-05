### aldmere (298 provinces, 14 realms) — Stage D code (9e67015), same machine

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-3; GC exposed: true.

Creation: world build 4.5 ms, new campaign 7.9 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 9.44 | 8.2 | 17.82 | 26.14 | 40.5 (0) |
| 2 | 1440 | 10.14 | 9.44 | 18.02 | 22.25 | 63.1 (279) |
| 3 | 1440 | 9.1 | 8.01 | 17.31 | 22.23 | 43 (947) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 5.95 | 19.59 | 33.6 |
| m.economy | 4.17 | 7.72 | 15.3 |
| ai.strategic | 3.72 | 8.45 | 25.8 |
| ai.operational | 2.2 | 12.41 | 26.2 |
| armyCare | 1.3 | 3.41 | 8.1 |
| m.victory | 0.99 | 2.46 | 3.9 |
| m.integration | 0.89 | 2.24 | 7.9 |
| m.diplomacy | 0.33 | 0.99 | 1.3 |
| m.events | 0.28 | 1.51 | 3 |
| naval | 0.15 | 0.49 | 1.7 |
| m.wars | 0.1 | 0.48 | 6.1 |
| battles | 0.09 | 0.7 | 17.3 |
| sieges | 0.07 | 0.29 | 1.2 |
| m.research | 0.07 | 0.14 | 0.4 |
| movement | 0.05 | 0.2 | 1.6 |
| recruitment | 0.04 | 0.19 | 0.6 |
| warScores | 0.03 | 0.15 | 0.3 |
| air | 0.02 | 0.24 | 0.5 |
| construction | 0.02 | 0.06 | 0.4 |
| orders | 0.01 | 0.04 | 0.1 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 1: 40.5 ms (ai 33.6, ai.strategic 25.8, ai.operational 7.5, armyCare 2.4)
- week 516: 36.5 ms (ai 20.6, ai.operational 18.3, m.economy 7.7, armyCare 3.9, ai.strategic 2.3)
- week 520: 35.4 ms (ai 20.2, ai.operational 18.2, m.economy 7.7, armyCare 3.8, ai.strategic 2)
- week 499: 35.3 ms (ai 30.7, ai.operational 26.2, ai.strategic 4.4, armyCare 3.8)
- week 500: 34 ms (ai 22.3, ai.operational 16.9, ai.strategic 5.3, m.economy 4.9, armyCare 3.4)

Call costs at mid-campaign: findPath 0.07 ms (187/200 found), reachFrom 0.07 ms, supply distances (cold, per realm) 0.09 ms, evaluateTreaty 0.03 ms.

State size (KB): y0 123, y1 192, y10 294, y20 304, y30 315. Heap (MB): y0 13, y1 15.7, y10 18.4, y20 19.7, y30 19.9.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 23 armies, 0 wars, 37 memories; y10: 17 armies, 1 wars, 142 memories; y20: 19 armies, 1 wars, 188 memories; y30: 23 armies, 0 wars, 205 memories.
