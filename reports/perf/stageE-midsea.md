### midsea (548 provinces, 16 realms) — Stage E

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 15.1 ms, new campaign 12.1 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 17.62 | 14.22 | 36.08 | 52.67 | 78.3 (707) |
| 2 | 1440 | 16.67 | 13.17 | 33.78 | 52.32 | 84.8 (907) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 11.29 | 34.92 | 54.8 |
| ai.strategic | 8.23 | 16.46 | 42 |
| m.economy | 7.18 | 13.61 | 18.2 |
| ai.operational | 3.04 | 25.09 | 33.8 |
| armyCare | 2.37 | 5.82 | 10.8 |
| m.diplomacy | 1.81 | 3.84 | 16 |
| m.integration | 1.77 | 5.51 | 7.6 |
| m.victory | 1.67 | 4.06 | 7.3 |
| m.events | 0.62 | 2.55 | 4.9 |
| naval | 0.18 | 0.74 | 2.6 |
| m.research | 0.17 | 1.24 | 2.5 |
| sieges | 0.12 | 0.49 | 3.4 |
| m.wars | 0.11 | 0.55 | 3.5 |
| battles | 0.09 | 0.86 | 16.7 |
| recruitment | 0.07 | 0.31 | 2.3 |
| movement | 0.05 | 0.29 | 1.9 |
| construction | 0.03 | 0.11 | 0.3 |
| warScores | 0.03 | 0.19 | 2.4 |
| orders | 0.01 | 0.04 | 0.1 |
| air | 0.01 | 0.11 | 1.6 |
| proposals | 0 | 0.01 | 1.2 |

Slowest weeks, first seed:

- week 708: 78.3 ms (ai 45.5, ai.operational 31.2, ai.strategic 14.2, m.economy 13, armyCare 10.8, m.victory 2.5, m.diplomacy 2.2, m.integration 2)
- week 4: 69.6 ms (ai 31.5, ai.strategic 29.2, m.economy 18.2, m.integration 7.6, m.victory 3.9, m.diplomacy 3.7, ai.operational 2.2, armyCare 2.1)
- week 692: 68.6 ms (ai 42.1, ai.operational 27.3, ai.strategic 14.8, m.economy 11.4, armyCare 5.9, m.victory 2.8, m.integration 2.7)
- week 660: 62.2 ms (ai 33.8, ai.operational 17.8, ai.strategic 15.9, m.economy 14.1, armyCare 5.7, m.victory 2.9, m.diplomacy 2.3, m.integration 2.2)
- week 661: 61.7 ms (ai 54.8, ai.operational 33.8, ai.strategic 20.9, armyCare 5.5)

Call costs at mid-campaign: findPath 0.09 ms (199/200 found), reachFrom 0.22 ms, supply distances (cold, per realm) 0.22 ms, evaluateTreaty 0.06 ms.

State size (KB): y0 206, y1 302, y10 405, y20 429, y30 441. Heap (MB): y0 14.2, y1 17.3, y10 20.7, y20 20.8, y30 21.1.
Counts: y0: 32 armies, 0 wars, 0 memories; y1: 26 armies, 0 wars, 37 memories; y10: 35 armies, 0 wars, 204 memories; y20: 35 armies, 1 wars, 242 memories; y30: 37 armies, 0 wars, 248 memories.
