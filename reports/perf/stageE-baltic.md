### baltic (233 provinces, 5 realms) — Stage E

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-3; GC exposed: true.

Creation: world build 3.5 ms, new campaign 5 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1240 | 6.56 | 5.81 | 14.79 | 20.04 | 46 (0) |
| 2 | 620 | 5.12 | 4.73 | 10.03 | 12.31 | 15 (107) |
| 3 | 536 | 6.3 | 5.62 | 14.06 | 17.95 | 27.5 (379) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 4.34 | 16.7 | 40.5 |
| ai.strategic | 2.54 | 9.13 | 33.7 |
| m.economy | 2.22 | 5.63 | 12.9 |
| ai.operational | 1.79 | 11.24 | 19.7 |
| m.integration | 0.89 | 2.9 | 9.8 |
| armyCare | 0.8 | 2.18 | 15.5 |
| m.diplomacy | 0.34 | 0.88 | 4.8 |
| m.victory | 0.32 | 0.86 | 1.2 |
| m.events | 0.17 | 0.78 | 5.7 |
| naval | 0.1 | 0.41 | 3.8 |
| m.research | 0.07 | 0.42 | 1.9 |
| air | 0.06 | 0.26 | 1 |
| movement | 0.05 | 0.35 | 1 |
| battles | 0.05 | 0.65 | 14.9 |
| sieges | 0.05 | 0.15 | 1 |
| recruitment | 0.04 | 0.19 | 1.6 |
| m.wars | 0.04 | 0.21 | 0.4 |
| construction | 0.02 | 0.06 | 0.4 |
| orders | 0.01 | 0.04 | 1.1 |
| warScores | 0.01 | 0.09 | 0.3 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 1: 46 ms (ai 40.5, ai.strategic 33.7, ai.operational 6.7)
- week 793: 32.3 ms (ai 30.3, ai.operational 17.5, ai.strategic 12.8)
- week 56: 30.4 ms (m.economy 12.9, m.integration 9.8, ai 5.4, ai.strategic 5.1)
- week 181: 27.9 ms (ai 25.8, ai.strategic 23, ai.operational 2.8)
- week 4: 26.1 ms (m.economy 8.9, ai 8.5, ai.strategic 6.2, m.integration 4.1, ai.operational 2.3)

Call costs at mid-campaign: findPath 0.13 ms (200/200 found), reachFrom 0.18 ms, supply distances (cold, per realm) 0.18 ms, evaluateTreaty 0.08 ms.

State size (KB): y0 86, y1 120, y10 239, y20 238. Heap (MB): y0 13.4, y1 15.8, y10 18.7, y20 19.9.
Counts: y0: 10 armies, 0 wars, 0 memories; y1: 7 armies, 0 wars, 10 memories; y10: 18 armies, 1 wars, 25 memories; y20: 14 armies, 0 wars, 26 memories.
