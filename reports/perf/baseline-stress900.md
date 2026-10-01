### stress-900 (900 provinces, 24 realms) — baseline

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 20 years, seeds 1-1; GC exposed: true.

Creation: world build 262.8 ms, new campaign 35.8 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 960 | 125.47 | 103.33 | 238.07 | 295.61 | 377.4 (111) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 81.73 | 217.42 | 296.3 |
| ai.strategic | 54.19 | 108.65 | 174.8 |
| m.integration | 46.69 | 66.38 | 81.5 |
| m.economy | 36.17 | 59.62 | 63.7 |
| ai.operational | 27.51 | 149.38 | 204.7 |
| armyCare | 15.18 | 30.2 | 37.6 |
| m.victory | 5.09 | 8.47 | 11.5 |
| sieges | 4.94 | 10.22 | 14.9 |
| m.research | 1.79 | 2.57 | 3.3 |
| m.events | 1.39 | 3.39 | 6.4 |
| m.diplomacy | 0.75 | 2.13 | 3.6 |
| m.wars | 0.24 | 0.84 | 1.7 |
| battles | 0.22 | 2.44 | 5.6 |
| movement | 0.15 | 0.69 | 1.3 |
| warScores | 0.08 | 0.39 | 1.3 |
| recruitment | 0.06 | 0.22 | 0.6 |
| construction | 0.05 | 0.13 | 0.4 |
| orders | 0.01 | 0.03 | 0.2 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 112: 377.4 ms (ai 237.1, ai.operational 172.1, ai.strategic 64.9, m.integration 54.8, m.economy 42, armyCare 23.9, sieges 7.1, m.victory 2.8, m.events 2.3, m.diplomacy 2.1)
- week 108: 369.9 ms (ai 225.6, ai.operational 158.1, ai.strategic 67.5, m.integration 56.5, m.economy 44.2, armyCare 21.4, sieges 11, m.events 3, m.victory 2.8)
- week 100: 346.3 ms (ai 204.5, ai.operational 132.5, ai.strategic 72, m.integration 62, m.economy 44.7, armyCare 18.3, sieges 6.1, m.victory 2.9)
- week 116: 325.8 ms (ai 195.2, ai.operational 132, ai.strategic 63.1, m.integration 55.1, m.economy 36.7, armyCare 21.5, sieges 6.8, m.victory 4.4)
- week 180: 325.4 ms (ai 192.2, ai.operational 116.6, ai.strategic 75.5, m.integration 48.9, armyCare 37.6, m.economy 29.6, sieges 6.1, m.victory 4.4, m.research 2)

Call costs at mid-campaign: findPath 0.26 ms (200/200 found), reachFrom 0.4 ms, supply distances (cold, per realm) 0.79 ms, evaluateTreaty 0.14 ms.

State size (KB): y0 240, y1 400, y10 511, y20 528. Heap (MB): y0 55.7, y1 58.1, y10 59.5, y20 60.
Counts: y0: 48 armies, 0 wars, 0 memories; y1: 62 armies, 0 wars, 55 memories; y10: 58 armies, 3 wars, 333 memories; y20: 67 armies, 1 wars, 356 memories.
