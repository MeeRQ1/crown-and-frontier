### aldmere (298 provinces, 14 realms) — atlas final: branch 6153e86

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 4.4 ms, new campaign 11.7 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 8.6 | 7.75 | 15.77 | 21.7 | 44.4 (0) |
| 2 | 1440 | 7.65 | 6.94 | 13.21 | 16.43 | 25.5 (339) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 5.77 | 14.21 | 37.4 |
| ai.strategic | 4.21 | 9.46 | 29 |
| m.economy | 2.76 | 6.46 | 8.8 |
| ai.operational | 1.54 | 6.63 | 13.7 |
| m.diplomacy | 1.32 | 3.38 | 5.6 |
| m.integration | 0.98 | 3.46 | 4.6 |
| m.victory | 0.93 | 2.28 | 4.3 |
| armyCare | 0.63 | 2.63 | 5.5 |
| m.events | 0.39 | 1.63 | 7.4 |
| naval | 0.14 | 0.6 | 2.3 |
| m.research | 0.11 | 0.47 | 0.9 |
| battles | 0.09 | 0.79 | 15.7 |
| m.wars | 0.07 | 0.34 | 0.7 |
| sieges | 0.06 | 0.25 | 1.5 |
| movement | 0.04 | 0.25 | 2.1 |
| recruitment | 0.04 | 0.16 | 1.5 |
| air | 0.03 | 0.28 | 1.8 |
| construction | 0.02 | 0.08 | 3.1 |
| warScores | 0.02 | 0.14 | 1.5 |
| orders | 0.01 | 0.04 | 0.2 |
| proposals | 0 | 0 | 0.1 |

Slowest weeks, first seed:

- week 1: 44.4 ms (ai 37.4, ai.strategic 29, ai.operational 8.1)
- week 92: 38.8 ms (ai 23.1, ai.operational 13, ai.strategic 10.1, armyCare 5.5, m.economy 3.5, m.diplomacy 3.1)
- week 84: 36.8 ms (ai 29.7, ai.strategic 16, ai.operational 13.7, m.economy 2.7)
- week 4: 33.9 ms (ai 10.4, m.economy 8.8, ai.strategic 7.8, m.integration 4.4, m.diplomacy 3.4, m.victory 3.1, ai.operational 2.6)
- week 1256: 28.3 ms (ai 16.2, ai.strategic 8.4, ai.operational 7.7, m.economy 5)

Call costs at mid-campaign: findPath 0.1 ms (200/200 found), reachFrom 0.1 ms, supply distances (cold, per realm) 0.06 ms, evaluateTreaty 0.03 ms.

Save at the end of the campaign (first seed, median of three): 347 KB; save 5.4 ms, load 14.7 ms.

State size (KB): y0 128, y1 206, y10 303, y20 327, y30 346. Heap (MB): y0 18.7, y1 21.7, y10 25.4, y20 26.6, y30 27.2.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 19 armies, 0 wars, 48 memories; y10: 15 armies, 0 wars, 214 memories; y20: 16 armies, 1 wars, 220 memories; y30: 23 armies, 0 wars, 220 memories.
