seed 1: 1440 weeks, avg 9.85 ms, p99 25.98 ms, max 57.7 ms
seed 2: 996 weeks, avg 9.14 ms, p99 24.15 ms, max 34.8 ms
### aldmere (298 provinces, 14 realms) — atlas before (main 99e0322)

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 5.2 ms, new campaign 10.5 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 9.85 | 8.49 | 19.32 | 25.98 | 57.7 (3) |
| 2 | 996 | 9.14 | 7.7 | 18.89 | 24.15 | 34.8 (359) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 6.12 | 16.91 | 37.5 |
| m.economy | 4.15 | 8.06 | 10.5 |
| ai.strategic | 4.01 | 9.11 | 29.7 |
| ai.operational | 2.1 | 11.7 | 16.3 |
| armyCare | 1.32 | 3 | 5.3 |
| m.diplomacy | 1.22 | 2.39 | 8.2 |
| m.victory | 1.11 | 2.99 | 6.6 |
| m.integration | 0.89 | 3.1 | 10 |
| m.events | 0.33 | 1.19 | 4.6 |
| naval | 0.13 | 0.52 | 2.7 |
| m.research | 0.12 | 0.71 | 5.1 |
| m.wars | 0.08 | 0.69 | 1.5 |
| battles | 0.07 | 0.66 | 14.5 |
| sieges | 0.06 | 0.22 | 1.5 |
| recruitment | 0.04 | 0.18 | 0.8 |
| movement | 0.03 | 0.22 | 1.1 |
| air | 0.02 | 0.25 | 1.2 |
| construction | 0.02 | 0.06 | 0.3 |
| warScores | 0.02 | 0.12 | 0.4 |
| orders | 0.01 | 0.04 | 0.1 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 4: 57.7 ms (ai 16.2, ai.strategic 13.3, m.integration 10, m.diplomacy 8.2, m.economy 7.1, m.victory 6.6, m.research 5.1, ai.operational 2.9, armyCare 2.3)
- week 1: 43.8 ms (ai 37.5, ai.strategic 29.7, ai.operational 7.5, armyCare 2.1)
- week 1380: 31.5 ms (ai 11.5, m.economy 10.5, ai.operational 6.2, ai.strategic 5.3, armyCare 2.3)
- week 84: 30.8 ms (battles 14.5, ai 5.8, m.economy 5.4, ai.operational 3.1, ai.strategic 2.7)
- week 408: 30.6 ms (ai 12.8, ai.operational 11, m.economy 8.9, armyCare 3.2)

Call costs at mid-campaign: findPath 0.07 ms (200/200 found), reachFrom 0.09 ms, supply distances (cold, per realm) 0.1 ms, evaluateTreaty 0.02 ms.

State size (KB): y0 126, y1 198, y10 309, y20 322, y30 341. Heap (MB): y0 13.7, y1 16.6, y10 19.9, y20 21.2, y30 21.8.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 19 armies, 0 wars, 36 memories; y10: 15 armies, 1 wars, 182 memories; y20: 16 armies, 0 wars, 273 memories; y30: 19 armies, 0 wars, 214 memories.
