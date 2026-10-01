### reach (99 provinces, 9 realms) — baseline

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v50; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 4.1 ms, new campaign 3.7 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 3.04 | 2.58 | 6.52 | 9.19 | 31.4 (0) |
| 2 | 1440 | 2.83 | 2.58 | 5.3 | 6.79 | 10.5 (1267) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 2.03 | 6.78 | 25.7 |
| ai.strategic | 1.24 | 3.31 | 21.6 |
| ai.operational | 0.78 | 5.03 | 6.8 |
| m.economy | 0.63 | 1.86 | 2.6 |
| m.integration | 0.55 | 1.17 | 3.4 |
| armyCare | 0.37 | 1.01 | 2 |
| m.victory | 0.32 | 0.8 | 1.9 |
| m.diplomacy | 0.12 | 0.42 | 1.5 |
| m.events | 0.11 | 0.49 | 2.8 |
| sieges | 0.1 | 0.37 | 2 |
| m.research | 0.07 | 0.14 | 0.6 |
| battles | 0.04 | 0.35 | 14.2 |
| m.wars | 0.03 | 0.21 | 0.6 |
| movement | 0.01 | 0.07 | 0.5 |
| recruitment | 0.01 | 0.04 | 0.4 |
| construction | 0.01 | 0.04 | 0.3 |
| warScores | 0.01 | 0.05 | 0.6 |
| proposals | 0 | 0 | 0.1 |
| orders | 0 | 0.01 | 0.2 |

Slowest weeks, first seed:

- week 1: 31.4 ms (ai 25.7, ai.strategic 21.6, ai.operational 3.9)
- week 89: 20.8 ms (battles 14.2, ai 5.4, ai.strategic 4.9)
- week 4: 19.9 ms (ai 7.5, ai.strategic 6.7, m.integration 3.4, m.economy 2.5)
- week 2: 12 ms (ai 10.5, ai.strategic 9.8)
- week 244: 11.8 ms (ai 6.2, ai.operational 4.5)

Call costs at mid-campaign: findPath 0.01 ms (32/200 found), reachFrom 0.03 ms, supply distances (cold, per realm) 0.04 ms, evaluateTreaty 0.01 ms.

State size (KB): y0 38, y1 68, y10 158, y20 178, y30 199. Heap (MB): y0 9.7, y1 11.1, y10 13.2, y20 13.5, y30 14.2.
Counts: y0: 17 armies, 0 wars, 0 memories; y1: 10 armies, 0 wars, 24 memories; y10: 9 armies, 0 wars, 91 memories; y20: 9 armies, 0 wars, 105 memories; y30: 12 armies, 1 wars, 107 memories.
