### aldmere (298 provinces, 14 realms) — Stage E

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-3; GC exposed: true.

Creation: world build 4.9 ms, new campaign 9.2 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 10.73 | 8.86 | 22.95 | 31.15 | 44.6 (0) |
| 2 | 996 | 9.62 | 8.12 | 18.98 | 24.72 | 32.1 (363) |
| 3 | 1440 | 9.04 | 8.12 | 17.29 | 20.68 | 30.7 (847) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 6.69 | 21.95 | 38.2 |
| m.economy | 4.51 | 9 | 10.2 |
| ai.strategic | 4.28 | 9.14 | 31.2 |
| ai.operational | 2.39 | 15.78 | 19.6 |
| armyCare | 1.45 | 3.59 | 8.2 |
| m.diplomacy | 1.32 | 3.03 | 5.4 |
| m.victory | 1.18 | 3.03 | 4.4 |
| m.integration | 0.93 | 2.17 | 7.4 |
| m.events | 0.35 | 1.38 | 3 |
| naval | 0.15 | 0.63 | 2 |
| m.research | 0.12 | 0.58 | 1.2 |
| m.wars | 0.09 | 1.03 | 2.8 |
| battles | 0.08 | 0.73 | 15 |
| sieges | 0.07 | 0.24 | 1.3 |
| movement | 0.04 | 0.18 | 1.4 |
| recruitment | 0.04 | 0.17 | 1 |
| air | 0.02 | 0.26 | 1.8 |
| construction | 0.02 | 0.07 | 0.3 |
| warScores | 0.02 | 0.16 | 0.5 |
| orders | 0.01 | 0.04 | 0.1 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 1: 44.6 ms (ai 38.2, ai.strategic 31.2, ai.operational 6.7, armyCare 2.2)
- week 416: 38.6 ms (ai 18.4, ai.operational 15.3, m.economy 10.1, armyCare 3.3, ai.strategic 3.1, m.victory 2)
- week 424: 38.4 ms (ai 20, ai.operational 16.2, m.economy 9, ai.strategic 3.8, armyCare 3.3)
- week 400: 37.9 ms (ai 18.9, ai.operational 13.2, m.economy 8.6, ai.strategic 5.6, armyCare 3.3, m.diplomacy 2.1, m.victory 2.1)
- week 420: 37.9 ms (ai 17.9, ai.operational 14.2, m.economy 8.8, ai.strategic 3.7, armyCare 3.4, m.diplomacy 2.3)

Call costs at mid-campaign: findPath 0.1 ms (200/200 found), reachFrom 0.12 ms, supply distances (cold, per realm) 0.14 ms, evaluateTreaty 0.03 ms.

State size (KB): y0 126, y1 198, y10 309, y20 322, y30 341. Heap (MB): y0 13.8, y1 16.6, y10 19.9, y20 21.2, y30 21.8.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 19 armies, 0 wars, 36 memories; y10: 15 armies, 1 wars, 182 memories; y20: 16 armies, 0 wars, 273 memories; y30: 19 armies, 0 wars, 214 memories.
