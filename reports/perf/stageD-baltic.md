### baltic (233 provinces, 5 realms) — Stage D

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-1; GC exposed: true.

Creation: world build 2.5 ms, new campaign 5.5 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 5.86 | 5.12 | 13.59 | 19.93 | 38.6 (121) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 4.02 | 15.47 | 33.1 |
| ai.strategic | 2.16 | 6.49 | 27.3 |
| m.economy | 1.91 | 4.03 | 6.5 |
| ai.operational | 1.85 | 11.86 | 20.8 |
| m.integration | 0.83 | 3 | 5.1 |
| armyCare | 0.65 | 1.52 | 2.5 |
| m.victory | 0.24 | 0.62 | 2.5 |
| m.events | 0.12 | 0.65 | 4.2 |
| m.diplomacy | 0.1 | 0.2 | 5.4 |
| naval | 0.07 | 0.23 | 1.8 |
| air | 0.07 | 0.2 | 1.3 |
| battles | 0.06 | 0.54 | 27.5 |
| sieges | 0.05 | 0.21 | 1.3 |
| movement | 0.04 | 0.21 | 1.1 |
| recruitment | 0.04 | 0.17 | 1.2 |
| m.research | 0.04 | 0.14 | 0.6 |
| m.wars | 0.03 | 0.16 | 0.4 |
| orders | 0.01 | 0.04 | 0.4 |
| construction | 0.01 | 0.08 | 0.5 |
| warScores | 0.01 | 0.08 | 0.6 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 122: 38.6 ms (battles 27.5, ai 8.8, ai.operational 6.9)
- week 1: 37.6 ms (ai 33.1, ai.strategic 27.3, ai.operational 5.6)
- week 96: 33.5 ms (ai 23.5, ai.operational 20.8, m.economy 4.4, m.integration 3.2, ai.strategic 2.6)
- week 812: 33.2 ms (ai 26.9, ai.operational 20, ai.strategic 6.8, m.economy 2.3)
- week 808: 24.6 ms (ai 17.5, ai.operational 14, ai.strategic 3.5, m.economy 3.4)

Call costs at mid-campaign: findPath 0.09 ms (195/200 found), reachFrom 0.1 ms, supply distances (cold, per realm) 0.12 ms, evaluateTreaty 0.06 ms.

State size (KB): y0 86, y1 115, y10 229, y20 240, y30 257. Heap (MB): y0 12.8, y1 15, y10 18.1, y20 18.9, y30 19.
Counts: y0: 10 armies, 0 wars, 0 memories; y1: 7 armies, 0 wars, 12 memories; y10: 17 armies, 0 wars, 29 memories; y20: 33 armies, 0 wars, 30 memories; y30: 37 armies, 0 wars, 34 memories.
