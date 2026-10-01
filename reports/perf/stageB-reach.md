### reach (99 provinces, 9 realms) — Stage B

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-3; GC exposed: true.

Creation: world build 0.5 ms, new campaign 2.9 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 3.64 | 2.99 | 7.94 | 12.35 | 42.9 (1405) |
| 2 | 1440 | 2.97 | 2.56 | 6.01 | 8.03 | 22.2 (185) |
| 3 | 960 | 2.26 | 1.9 | 4.56 | 6.48 | 12.3 (859) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 2.34 | 8.34 | 42.1 |
| ai.strategic | 1.43 | 4.89 | 11.2 |
| m.economy | 0.97 | 3.81 | 4.4 |
| ai.operational | 0.9 | 5.7 | 41.1 |
| armyCare | 0.54 | 2.13 | 6.4 |
| m.victory | 0.51 | 2.37 | 5.5 |
| m.integration | 0.38 | 1.42 | 6.8 |
| m.diplomacy | 0.23 | 1.15 | 4.5 |
| m.events | 0.19 | 1.09 | 3.9 |
| battles | 0.06 | 0.56 | 21 |
| m.research | 0.06 | 0.18 | 3.9 |
| m.wars | 0.05 | 0.35 | 0.5 |
| sieges | 0.03 | 0.16 | 0.8 |
| movement | 0.02 | 0.15 | 0.8 |
| orders | 0.01 | 0.04 | 0.5 |
| recruitment | 0.01 | 0.07 | 0.4 |
| construction | 0.01 | 0.05 | 1.2 |
| warScores | 0.01 | 0.06 | 0.6 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 1406: 42.9 ms (ai 42.1, ai.operational 41.1)
- week 1189: 25.3 ms (ai 24.3, ai.operational 22.1, ai.strategic 2.2)
- week 79: 23.3 ms (battles 21)
- week 1152: 23 ms (ai 14.2, ai.operational 12.9, m.victory 5.5)
- week 104: 18.1 ms (battles 6.5, m.diplomacy 4.5, ai 2.9)

Call costs at mid-campaign: findPath 0.04 ms (168/200 found), reachFrom 0.03 ms, supply distances (cold, per realm) 0.07 ms, evaluateTreaty 0.07 ms.

State size (KB): y0 47, y1 74, y10 154, y20 185, y30 201. Heap (MB): y0 9.8, y1 11.4, y10 13.5, y20 14.5, y30 15.
Counts: y0: 18 armies, 0 wars, 0 memories; y1: 10 armies, 0 wars, 33 memories; y10: 9 armies, 0 wars, 101 memories; y20: 9 armies, 0 wars, 108 memories; y30: 8 armies, 1 wars, 116 memories.
