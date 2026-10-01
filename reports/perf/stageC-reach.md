### reach (99 provinces, 9 realms) — Stage C

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-3; GC exposed: true.

Creation: world build 0.9 ms, new campaign 4.4 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 3.38 | 2.95 | 6.63 | 8.82 | 30.2 (0) |
| 2 | 1184 | 2.79 | 2.49 | 5.22 | 7.14 | 12.2 (928) |
| 3 | 1440 | 3.24 | 2.8 | 6.4 | 8.78 | 24.8 (735) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 2.09 | 5.95 | 24.2 |
| m.economy | 1.34 | 3.64 | 8 |
| ai.strategic | 1.26 | 3.72 | 17.5 |
| ai.operational | 0.82 | 3.72 | 22.4 |
| armyCare | 0.44 | 1.11 | 6.7 |
| m.victory | 0.33 | 1.03 | 1.9 |
| m.integration | 0.27 | 0.84 | 2 |
| m.diplomacy | 0.13 | 0.36 | 1.3 |
| m.events | 0.12 | 0.52 | 3.3 |
| naval | 0.07 | 0.26 | 1.9 |
| air | 0.06 | 0.21 | 1.1 |
| battles | 0.04 | 0.49 | 1.1 |
| m.research | 0.04 | 0.11 | 0.6 |
| movement | 0.03 | 0.14 | 0.7 |
| sieges | 0.03 | 0.12 | 0.6 |
| m.wars | 0.03 | 0.16 | 0.5 |
| recruitment | 0.02 | 0.08 | 1.1 |
| construction | 0.01 | 0.05 | 0.6 |
| warScores | 0.01 | 0.05 | 0.2 |
| proposals | 0 | 0 | 4.1 |
| orders | 0 | 0.03 | 0.2 |

Slowest weeks, first seed:

- week 1: 30.2 ms (ai 22.9, ai.strategic 17.5, ai.operational 5.2)
- week 18: 25.3 ms (ai 24.2, ai.operational 22.4)
- week 4: 18.7 ms (ai 7, ai.strategic 5.7, m.economy 3.6, m.integration 2)
- week 636: 13.5 ms (m.economy 8, ai 3.8, ai.operational 2.5)
- week 77: 12.2 ms (ai 11.5, ai.operational 9.4, ai.strategic 2.1)

Call costs at mid-campaign: findPath 0.04 ms (178/200 found), reachFrom 0.04 ms, supply distances (cold, per realm) 0.14 ms, evaluateTreaty 0.01 ms.

State size (KB): y0 56, y1 85, y10 189, y20 203, y30 212. Heap (MB): y0 10.6, y1 12.7, y10 14.8, y20 16.6, y30 17.1.
Counts: y0: 18 armies, 0 wars, 0 memories; y1: 10 armies, 0 wars, 32 memories; y10: 11 armies, 1 wars, 96 memories; y20: 9 armies, 2 wars, 111 memories; y30: 8 armies, 0 wars, 88 memories.
