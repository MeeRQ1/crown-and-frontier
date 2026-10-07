seed 1: 1440 weeks, avg 15.68 ms, p99 50.23 ms, max 78.8 ms
seed 2: 1440 weeks, avg 15.21 ms, p99 35.62 ms, max 53 ms
### midsea (548 provinces, 16 realms) — atlas before (main 99e0322)

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 13.8 ms, new campaign 20.1 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 15.68 | 12.16 | 31.72 | 50.23 | 78.8 (1179) |
| 2 | 1440 | 15.21 | 13.2 | 29.01 | 35.62 | 53 (1387) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 9.99 | 41.25 | 61.4 |
| ai.strategic | 7.52 | 15.69 | 46.8 |
| m.economy | 6.47 | 12.23 | 16.5 |
| ai.operational | 2.45 | 28.77 | 42.3 |
| armyCare | 2.15 | 5.7 | 8.8 |
| m.integration | 1.57 | 3.6 | 5.8 |
| m.diplomacy | 1.55 | 3.29 | 4.6 |
| m.victory | 1.53 | 3.73 | 6.1 |
| m.events | 0.54 | 1.83 | 9.8 |
| naval | 0.18 | 0.76 | 3.3 |
| m.research | 0.15 | 0.97 | 3 |
| battles | 0.09 | 0.65 | 39.2 |
| sieges | 0.09 | 0.31 | 1.9 |
| recruitment | 0.07 | 0.27 | 1.6 |
| m.wars | 0.07 | 0.31 | 0.5 |
| movement | 0.04 | 0.23 | 6.1 |
| construction | 0.03 | 0.1 | 0.4 |
| warScores | 0.02 | 0.15 | 0.4 |
| orders | 0.01 | 0.05 | 0.2 |
| proposals | 0 | 0.01 | 0.1 |
| air | 0 | 0.01 | 0.6 |

Slowest weeks, first seed:

- week 1180: 78.8 ms (ai 52.3, ai.operational 34, ai.strategic 18.1, armyCare 8.8, m.economy 7.7, m.diplomacy 2.4, m.victory 2.3, m.integration 2.1)
- week 1: 74.5 ms (ai 61.4, ai.strategic 46.8, ai.operational 14.2, armyCare 7.5)
- week 1156: 70.9 ms (ai 49, ai.operational 32.7, ai.strategic 16.4, m.economy 6.4, armyCare 5.9, m.diplomacy 2.2, m.victory 2.2, m.integration 2.2)
- week 1181: 66.9 ms (ai 60.7, ai.operational 42.3, ai.strategic 18.3, armyCare 4.2)
- week 1176: 64.9 ms (ai 41.8, ai.operational 31.3, ai.strategic 10.5, m.economy 10.1, armyCare 4.2, m.diplomacy 2.5, m.victory 2.2)

Call costs at mid-campaign: findPath 0.1 ms (200/200 found), reachFrom 0.13 ms, supply distances (cold, per realm) 0.13 ms, evaluateTreaty 0.05 ms.

State size (KB): y0 206, y1 303, y10 398, y20 431, y30 445. Heap (MB): y0 14.2, y1 17.3, y10 20.3, y20 20.4, y30 20.5.
Counts: y0: 32 armies, 0 wars, 0 memories; y1: 29 armies, 0 wars, 37 memories; y10: 30 armies, 0 wars, 201 memories; y20: 36 armies, 2 wars, 324 memories; y30: 44 armies, 0 wars, 286 memories.
