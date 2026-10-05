### aldmere (298 provinces, 14 realms) — Stage A optimised

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 3.5 ms, new campaign 5.2 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 6.46 | 5.94 | 10.73 | 15.68 | 42.4 (0) |
| 2 | 1440 | 5.83 | 5.24 | 10.64 | 15.58 | 22.5 (380) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 4.32 | 11.66 | 37.6 |
| ai.strategic | 2.92 | 6.51 | 30.9 |
| ai.operational | 1.38 | 5.85 | 17.8 |
| m.economy | 1.28 | 2.88 | 3.8 |
| armyCare | 1.06 | 2.29 | 5.2 |
| m.victory | 0.8 | 2.12 | 4.9 |
| m.integration | 0.71 | 1.54 | 4 |
| m.diplomacy | 0.25 | 0.95 | 1.5 |
| m.events | 0.23 | 1.22 | 3.7 |
| battles | 0.07 | 0.42 | 14.6 |
| m.wars | 0.07 | 0.41 | 0.9 |
| sieges | 0.05 | 0.15 | 3.5 |
| m.research | 0.04 | 0.09 | 0.4 |
| movement | 0.03 | 0.19 | 0.8 |
| recruitment | 0.02 | 0.1 | 1 |
| construction | 0.02 | 0.07 | 0.4 |
| warScores | 0.02 | 0.12 | 0.5 |
| orders | 0.01 | 0.03 | 0.2 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 1: 42.4 ms (ai 37.6, ai.strategic 30.9, ai.operational 6.4, armyCare 2.1)
- week 81: 26.5 ms (battles 14.6, ai 10, ai.strategic 5.8, ai.operational 4.2)
- week 2: 25.6 ms (ai 21.9, ai.strategic 17.4, ai.operational 4.5, armyCare 3.3)
- week 78: 25.4 ms (ai 24.4, ai.operational 17.8, ai.strategic 6.5)
- week 4: 23.3 ms (ai 7, ai.strategic 5.4, m.integration 4, m.economy 3.8, m.victory 3.4, armyCare 2.3)

Call costs at mid-campaign: findPath 0.1 ms (179/200 found), reachFrom 0.1 ms, supply distances (cold, per realm) 0.08 ms, evaluateTreaty 0.02 ms.

State size (KB): y0 93, y1 185, y10 256, y20 277, y30 307. Heap (MB): y0 9.7, y1 11.8, y10 13.9, y20 14.6, y30 15.2.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 27 armies, 0 wars, 37 memories; y10: 23 armies, 2 wars, 169 memories; y20: 29 armies, 1 wars, 221 memories; y30: 28 armies, 0 wars, 222 memories.
