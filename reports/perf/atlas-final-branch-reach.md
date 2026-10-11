### reach (99 provinces, 9 realms) — atlas final: branch 6153e86

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 0.7 ms, new campaign 4.1 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 3.6 | 2.98 | 7.24 | 10.75 | 26.8 (0) |
| 2 | 1400 | 3.46 | 2.95 | 6.38 | 8.98 | 12.5 (791) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 2.35 | 6.86 | 21.3 |
| ai.strategic | 1.88 | 4.6 | 17.4 |
| m.economy | 1.08 | 2.77 | 7.5 |
| m.diplomacy | 0.57 | 2.14 | 3.5 |
| m.victory | 0.46 | 1.66 | 2 |
| ai.operational | 0.45 | 3.21 | 8.1 |
| m.integration | 0.32 | 0.78 | 1.7 |
| armyCare | 0.22 | 1.03 | 2.4 |
| m.events | 0.17 | 0.9 | 2.2 |
| air | 0.1 | 0.39 | 5.6 |
| m.research | 0.08 | 0.51 | 1.4 |
| naval | 0.07 | 0.36 | 1.9 |
| battles | 0.04 | 0.34 | 14.3 |
| sieges | 0.03 | 0.11 | 4.7 |
| m.wars | 0.03 | 0.19 | 0.4 |
| recruitment | 0.02 | 0.13 | 0.8 |
| movement | 0.01 | 0.08 | 1.5 |
| construction | 0.01 | 0.06 | 0.3 |
| proposals | 0 | 0 | 0.1 |
| orders | 0 | 0.01 | 0.2 |
| warScores | 0 | 0.06 | 0.4 |

Slowest weeks, first seed:

- week 1: 26.8 ms (ai 21.3, ai.strategic 17.4, ai.operational 3.8)
- week 80: 20.8 ms (m.economy 7.5, sieges 4.7, m.diplomacy 3.5, ai 3, ai.strategic 2.3)
- week 86: 17.4 ms (battles 14.3)
- week 4: 15.8 ms (ai 6.1, ai.strategic 5.3, m.economy 3, m.diplomacy 2)
- week 360: 15.5 ms (ai 8.8, ai.operational 5, ai.strategic 3.8, m.economy 2.6)

Call costs at mid-campaign: findPath 0.05 ms (200/200 found), reachFrom 0.05 ms, supply distances (cold, per realm) 0.03 ms, evaluateTreaty 0.02 ms.

Save at the end of the campaign (first seed, median of three): 208 KB; save 2.2 ms, load 7.7 ms.

State size (KB): y0 59, y1 109, y10 201, y20 205, y30 208. Heap (MB): y0 18.2, y1 20.7, y10 23.5, y20 25.3, y30 25.8.
Counts: y0: 18 armies, 0 wars, 0 memories; y1: 9 armies, 0 wars, 49 memories; y10: 9 armies, 0 wars, 109 memories; y20: 9 armies, 0 wars, 95 memories; y30: 9 armies, 0 wars, 80 memories.
