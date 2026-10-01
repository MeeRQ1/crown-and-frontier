### aldmere (298 provinces, 14 realms) — baseline

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 25 ms, new campaign 5.3 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 14.1 | 13.55 | 22.93 | 30.45 | 55.9 (1039) |
| 2 | 1440 | 13.6 | 12.14 | 25.5 | 40.33 | 77.3 (383) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 9.09 | 19.39 | 38 |
| ai.strategic | 6.51 | 13.27 | 32.6 |
| m.integration | 4.05 | 6.8 | 7.7 |
| m.economy | 3.48 | 7.46 | 8.5 |
| ai.operational | 2.57 | 11.03 | 18.6 |
| armyCare | 1.66 | 3.62 | 6.1 |
| m.victory | 1.05 | 2.11 | 4.6 |
| sieges | 0.8 | 1.64 | 32.4 |
| m.research | 0.3 | 0.51 | 1.4 |
| m.events | 0.28 | 1.11 | 3 |
| m.diplomacy | 0.27 | 0.85 | 1.2 |
| battles | 0.08 | 0.55 | 14.3 |
| m.wars | 0.07 | 0.35 | 0.8 |
| movement | 0.03 | 0.16 | 0.6 |
| construction | 0.02 | 0.05 | 0.2 |
| warScores | 0.02 | 0.14 | 2.2 |
| orders | 0.01 | 0.02 | 0.1 |
| recruitment | 0.01 | 0.08 | 0.6 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 1040: 55.9 ms (sieges 32.4, ai 7.4, m.integration 6.7, ai.strategic 6.5, m.economy 4.1, armyCare 2.4)
- week 1: 42.7 ms (ai 38, ai.strategic 32.6, ai.operational 5.1)
- week 956: 36.8 ms (ai 19.8, ai.operational 11.8, ai.strategic 8, m.economy 4.8, m.integration 4.3, armyCare 3.6)
- week 112: 35.7 ms (ai 17.8, ai.operational 11.8, m.integration 6.7, ai.strategic 6, m.economy 4.9)
- week 4: 34.7 ms (ai 14.2, ai.strategic 12.2, m.integration 7.5, m.economy 5, m.victory 2.1)

Call costs at mid-campaign: findPath 0.16 ms (179/200 found), reachFrom 0.21 ms, supply distances (cold, per realm) 0.25 ms, evaluateTreaty 0.07 ms.

State size (KB): y0 93, y1 185, y10 256, y20 277, y30 307. Heap (MB): y0 12.9, y1 14.9, y10 16.8, y20 17.5, y30 18.1.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 27 armies, 0 wars, 37 memories; y10: 23 armies, 2 wars, 169 memories; y20: 29 armies, 1 wars, 221 memories; y30: 28 armies, 0 wars, 222 memories.
