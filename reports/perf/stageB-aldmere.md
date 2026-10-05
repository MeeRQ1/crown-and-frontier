### aldmere (298 provinces, 14 realms) — Stage B

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 5.2 ms, new campaign 9.6 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 8.48 | 7.53 | 15.64 | 21.36 | 58.3 (16) |
| 2 | 1440 | 7.17 | 6.35 | 13.49 | 16.77 | 24.6 (371) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 5.48 | 14.26 | 56.6 |
| ai.strategic | 3.19 | 9.18 | 50.8 |
| m.economy | 2.4 | 7.87 | 24.7 |
| ai.operational | 2.26 | 8 | 27.5 |
| armyCare | 1.38 | 3.74 | 18 |
| m.victory | 0.99 | 2.41 | 3.3 |
| m.integration | 0.93 | 3.5 | 14.5 |
| m.events | 0.36 | 1.64 | 14.5 |
| m.diplomacy | 0.33 | 1.19 | 1.8 |
| m.wars | 0.1 | 0.43 | 0.7 |
| battles | 0.09 | 0.67 | 15.4 |
| sieges | 0.08 | 0.43 | 4.3 |
| m.research | 0.07 | 0.22 | 0.6 |
| movement | 0.05 | 0.27 | 1.9 |
| warScores | 0.04 | 0.26 | 1.3 |
| recruitment | 0.02 | 0.13 | 6.3 |
| construction | 0.02 | 0.07 | 1.3 |
| orders | 0.01 | 0.04 | 2 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 17: 58.3 ms (ai 56.6, ai.strategic 50.8, ai.operational 5.7)
- week 580: 47.2 ms (m.economy 24.7, m.events 14.5, ai 4.2, ai.operational 2.4)
- week 4: 35.6 ms (ai 16.7, ai.strategic 11.9, m.economy 6.6, ai.operational 4.8, m.integration 3.7, m.victory 2.6, armyCare 2.5)
- week 1: 35.5 ms (ai 31.6, ai.strategic 26, ai.operational 5.3)
- week 585: 32.8 ms (ai 31.8, ai.operational 27.5, ai.strategic 4.2)

Call costs at mid-campaign: findPath 0.07 ms (194/200 found), reachFrom 0.08 ms, supply distances (cold, per realm) 0.09 ms, evaluateTreaty 0.02 ms.

State size (KB): y0 105, y1 171, y10 282, y20 311, y30 326. Heap (MB): y0 10.2, y1 12.4, y10 14.8, y20 15.6, y30 16.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 25 armies, 0 wars, 36 memories; y10: 23 armies, 0 wars, 151 memories; y20: 21 armies, 0 wars, 180 memories; y30: 47 armies, 0 wars, 186 memories.
