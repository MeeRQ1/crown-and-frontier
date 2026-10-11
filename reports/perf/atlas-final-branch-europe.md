### europe (686 provinces, 23 realms) — atlas final: branch 6153e86

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 10 years, seeds 1-2; GC exposed: true.

Creation: world build 21.2 ms, new campaign 26.8 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 480 | 39.62 | 36.85 | 72.99 | 91.25 | 131.5 (385) |
| 2 | 480 | 36.61 | 34.15 | 63.28 | 79.15 | 234.3 (362) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 29.31 | 69.69 | 122 |
| ai.strategic | 15.64 | 31.87 | 54.8 |
| ai.operational | 13.6 | 42.51 | 102.7 |
| m.economy | 8.45 | 14.71 | 22 |
| m.diplomacy | 3.63 | 7.24 | 8.7 |
| m.integration | 3.37 | 12.38 | 19 |
| armyCare | 3.17 | 9.31 | 11.9 |
| m.victory | 2.28 | 5.28 | 6.1 |
| m.events | 1.01 | 3.54 | 4.1 |
| movement | 0.65 | 2.64 | 6.4 |
| air | 0.4 | 2 | 3.6 |
| naval | 0.31 | 1.04 | 2.5 |
| battles | 0.29 | 2.21 | 4.2 |
| m.research | 0.27 | 1.19 | 1.4 |
| m.wars | 0.24 | 0.96 | 1.1 |
| sieges | 0.2 | 1.07 | 3.6 |
| recruitment | 0.15 | 0.57 | 1.9 |
| warScores | 0.06 | 0.62 | 1 |
| orders | 0.04 | 0.11 | 1.7 |
| construction | 0.04 | 0.15 | 0.4 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 386: 131.5 ms (ai 122, ai.operational 102.7, ai.strategic 19.2, armyCare 7.1)
- week 80: 106 ms (ai 49.6, ai.operational 34.9, m.integration 19, ai.strategic 14.6, m.economy 12.3, m.diplomacy 6, m.victory 5.7, armyCare 3, m.events 2.3, battles 2.2)
- week 272: 97.4 ms (ai 48.7, ai.operational 30.3, m.economy 22, ai.strategic 18.4, armyCare 10, m.diplomacy 5.4, m.integration 3.9, m.victory 2.6)
- week 1: 96.2 ms (ai 87.5, ai.strategic 54.8, ai.operational 32.3, armyCare 2.4)
- week 100: 91.3 ms (ai 51.9, ai.operational 35, ai.strategic 16.8, m.economy 11.6, m.diplomacy 6.6, m.integration 5.8, m.victory 5.3, armyCare 3.8)

Call costs at mid-campaign: findPath 0.08 ms (175/200 found), reachFrom 0.06 ms, supply distances (cold, per realm) 0.07 ms, evaluateTreaty 0.03 ms.

Save at the end of the campaign (first seed, median of three): 572 KB; save 6.3 ms, load 25.1 ms.

State size (KB): y0 288, y1 433, y10 572. Heap (MB): y0 20.3, y1 24.3, y10 27.2.
Counts: y0: 42 armies, 0 wars, 0 memories; y1: 50 armies, 0 wars, 115 memories; y10: 81 armies, 0 wars, 383 memories.
