### midsea (548 provinces, 16 realms) — atlas final: branch 6153e86

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 12.3 ms, new campaign 13.2 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 12.38 | 10.09 | 23.57 | 32.82 | 77.6 (3) |
| 2 | 1440 | 11.99 | 10.38 | 23.48 | 27.74 | 37.5 (555) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 8.6 | 20.67 | 46.1 |
| ai.strategic | 6.91 | 14.59 | 33.8 |
| m.economy | 4.37 | 10.32 | 13.2 |
| m.integration | 1.72 | 3.66 | 10 |
| ai.operational | 1.66 | 7.43 | 16.9 |
| m.diplomacy | 1.61 | 3.29 | 4.8 |
| m.victory | 1.43 | 3.68 | 6.4 |
| armyCare | 0.67 | 3.33 | 7 |
| m.events | 0.56 | 1.95 | 5.2 |
| naval | 0.17 | 0.45 | 2.4 |
| m.research | 0.15 | 0.81 | 2.2 |
| sieges | 0.1 | 0.48 | 2 |
| battles | 0.07 | 0.57 | 18.5 |
| recruitment | 0.07 | 0.36 | 1.5 |
| m.wars | 0.07 | 0.36 | 0.8 |
| movement | 0.04 | 0.31 | 0.7 |
| construction | 0.03 | 0.11 | 1.4 |
| orders | 0.01 | 0.05 | 0.1 |
| air | 0.01 | 0.06 | 0.6 |
| warScores | 0.01 | 0.15 | 0.7 |
| proposals | 0 | 0.01 | 1.6 |

Slowest weeks, first seed:

- week 4: 77.6 ms (ai 38.5, ai.strategic 31.6, m.economy 13.2, m.integration 10, ai.operational 6.8, m.victory 6.4, m.diplomacy 4.8)
- week 1: 50.7 ms (ai 42.3, ai.strategic 32.8, ai.operational 9.1, armyCare 3.1)
- week 117: 49.6 ms (ai 46.1, ai.strategic 33.8, ai.operational 12.3)
- week 1156: 47.1 ms (ai 26.1, ai.strategic 13.3, ai.operational 12.8, m.economy 5.6, armyCare 5, m.integration 2.4, m.victory 2.3, m.diplomacy 2.2)
- week 1154: 39.8 ms (ai 31.7, ai.operational 16.9, ai.strategic 14.6, armyCare 5.3)

Call costs at mid-campaign: findPath 0.07 ms (199/200 found), reachFrom 0.1 ms, supply distances (cold, per realm) 0 ms, evaluateTreaty 0.02 ms.

Save at the end of the campaign (first seed, median of three): 457 KB; save 4.6 ms, load 16.7 ms.

State size (KB): y0 207, y1 318, y10 421, y20 442, y30 456. Heap (MB): y0 19.2, y1 22.4, y10 25.8, y20 26.9, y30 27.7.
Counts: y0: 32 armies, 0 wars, 0 memories; y1: 31 armies, 0 wars, 49 memories; y10: 35 armies, 0 wars, 209 memories; y20: 38 armies, 0 wars, 302 memories; y30: 36 armies, 0 wars, 236 memories.
