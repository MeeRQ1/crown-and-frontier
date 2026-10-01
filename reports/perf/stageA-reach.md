### reach (99 provinces, 9 realms) — Stage A optimised

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 0.4 ms, new campaign 1.7 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 2.12 | 1.84 | 3.99 | 5.84 | 20.1 (88) |
| 2 | 1440 | 1.9 | 1.74 | 3.25 | 4.07 | 6 (723) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 1.41 | 4.08 | 15 |
| ai.strategic | 0.89 | 2.38 | 12.4 |
| ai.operational | 0.52 | 2.92 | 5.4 |
| m.economy | 0.39 | 1.22 | 5.3 |
| armyCare | 0.31 | 0.9 | 7.6 |
| m.victory | 0.3 | 0.94 | 4.3 |
| m.integration | 0.22 | 0.76 | 1.1 |
| m.diplomacy | 0.11 | 0.43 | 0.8 |
| m.events | 0.1 | 0.4 | 1.8 |
| battles | 0.04 | 0.28 | 14.1 |
| m.research | 0.03 | 0.07 | 0.3 |
| m.wars | 0.03 | 0.19 | 0.7 |
| sieges | 0.02 | 0.07 | 0.5 |
| movement | 0.01 | 0.07 | 0.4 |
| recruitment | 0.01 | 0.04 | 0.2 |
| construction | 0.01 | 0.04 | 0.5 |
| warScores | 0.01 | 0.05 | 0.2 |
| proposals | 0 | 0 | 0.1 |
| orders | 0 | 0.01 | 0.3 |

Slowest weeks, first seed:

- week 89: 20.1 ms (battles 14.1, ai 5.4, ai.strategic 4.4)
- week 144: 18.4 ms (armyCare 7.6, m.economy 5.3, ai 3.8, ai.strategic 3.5)
- week 1: 18.3 ms (ai 15, ai.strategic 12.4, ai.operational 2.4)
- week 84: 9.8 ms (ai 5.9, ai.operational 4.4)
- week 4: 9.6 ms (ai 3.6, ai.strategic 3)

Call costs at mid-campaign: findPath 0.03 ms (194/200 found), reachFrom 0.03 ms, supply distances (cold, per realm) 0.04 ms, evaluateTreaty 0.01 ms.

State size (KB): y0 38, y1 68, y10 158, y20 178, y30 199. Heap (MB): y0 9.4, y1 11, y10 13.1, y20 13.4, y30 14.1.
Counts: y0: 17 armies, 0 wars, 0 memories; y1: 10 armies, 0 wars, 24 memories; y10: 9 armies, 0 wars, 91 memories; y20: 9 armies, 0 wars, 105 memories; y30: 12 armies, 1 wars, 107 memories.
