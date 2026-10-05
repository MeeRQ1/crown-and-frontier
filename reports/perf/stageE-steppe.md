### steppe (263 provinces, 11 realms) — Stage E

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-3; GC exposed: true.

Creation: world build 3.9 ms, new campaign 11.6 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 824 | 7.19 | 5.99 | 13.58 | 18.19 | 43.2 (0) |
| 2 | 1440 | 7.47 | 6.51 | 14.91 | 19.31 | 34.9 (1171) |
| 3 | 1092 | 7.24 | 6.23 | 13.83 | 17.49 | 24.2 (463) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 4.54 | 11.61 | 36 |
| ai.strategic | 3.52 | 8.4 | 28.7 |
| m.economy | 2.78 | 5.52 | 14.1 |
| ai.operational | 1 | 4.96 | 7.6 |
| m.integration | 0.85 | 2 | 7.8 |
| m.diplomacy | 0.84 | 2.32 | 4.9 |
| armyCare | 0.82 | 2.07 | 6.6 |
| m.victory | 0.77 | 1.84 | 4.7 |
| m.events | 0.33 | 0.99 | 2.6 |
| naval | 0.13 | 0.43 | 4.2 |
| m.research | 0.12 | 0.58 | 1.5 |
| battles | 0.07 | 0.46 | 23.8 |
| sieges | 0.06 | 0.21 | 1.6 |
| m.wars | 0.06 | 0.36 | 1 |
| recruitment | 0.04 | 0.23 | 1.4 |
| movement | 0.03 | 0.17 | 0.5 |
| construction | 0.02 | 0.08 | 1.2 |
| orders | 0.01 | 0.04 | 3.5 |
| warScores | 0.01 | 0.13 | 0.4 |
| proposals | 0 | 0.01 | 0.1 |
| air | 0 | 0.01 | 0.4 |

Slowest weeks, first seed:

- week 1: 43.2 ms (ai 36, ai.strategic 28.7, ai.operational 7.1, armyCare 2.1)
- week 4: 41 ms (m.economy 14.1, ai 11, ai.strategic 8.9, m.integration 7.8, m.diplomacy 3.2, ai.operational 2.1)
- week 86: 33.2 ms (battles 23.8, ai 7.3, ai.strategic 5.2, ai.operational 2.1)
- week 7: 31.4 ms (ai 25.4, ai.strategic 23, battles 4.1, ai.operational 2.4)
- week 3: 29.2 ms (ai 27.6, ai.strategic 24.9, ai.operational 2.7)

Call costs at mid-campaign: findPath 0.07 ms (198/200 found), reachFrom 0.08 ms, supply distances (cold, per realm) 0.09 ms, evaluateTreaty 0.03 ms.

State size (KB): y0 107, y1 160, y10 260. Heap (MB): y0 13.6, y1 16.2, y10 19.
Counts: y0: 22 armies, 0 wars, 0 memories; y1: 22 armies, 0 wars, 25 memories; y10: 16 armies, 1 wars, 134 memories.
