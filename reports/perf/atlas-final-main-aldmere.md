### aldmere (298 provinces, 14 realms) — atlas final: main 99e0322

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 6.1 ms, new campaign 14.3 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 10.14 | 8.39 | 20.71 | 29.01 | 62.7 (3) |
| 2 | 996 | 9.37 | 7.91 | 17.78 | 23.49 | 38 (374) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 6.36 | 20.64 | 42.2 |
| m.economy | 4.13 | 8.47 | 13.5 |
| ai.strategic | 4.11 | 9.83 | 32.8 |
| ai.operational | 2.22 | 14.04 | 20.7 |
| m.diplomacy | 1.33 | 2.89 | 6.7 |
| armyCare | 1.3 | 3.07 | 12.3 |
| m.victory | 1.14 | 2.93 | 3.9 |
| m.integration | 0.88 | 2.25 | 12.9 |
| m.events | 0.35 | 1.34 | 3.2 |
| naval | 0.15 | 0.55 | 2.1 |
| m.research | 0.12 | 0.61 | 1.1 |
| m.wars | 0.09 | 0.72 | 4.4 |
| battles | 0.08 | 0.69 | 16.6 |
| sieges | 0.07 | 0.24 | 1.5 |
| movement | 0.04 | 0.24 | 1.8 |
| recruitment | 0.04 | 0.2 | 1.8 |
| air | 0.03 | 0.27 | 1.2 |
| construction | 0.02 | 0.08 | 0.6 |
| warScores | 0.02 | 0.14 | 0.4 |
| orders | 0.01 | 0.04 | 0.2 |
| proposals | 0 | 0.01 | 0.4 |

Slowest weeks, first seed:

- week 4: 62.7 ms (ai 20.6, ai.strategic 14.7, m.integration 12.9, m.economy 10.5, ai.operational 5.9, m.diplomacy 4.7, m.wars 4.4, m.victory 3.9, armyCare 2.7)
- week 1: 49.7 ms (ai 42.2, ai.strategic 32.8, ai.operational 9.2, armyCare 2.4)
- week 448: 39.7 ms (ai 23.9, ai.operational 20.7, m.economy 4.9, armyCare 3.8, ai.strategic 3.2, m.diplomacy 2.2)
- week 420: 37.9 ms (ai 16.5, ai.operational 12.5, m.economy 9.2, ai.strategic 3.9, armyCare 3.1, m.integration 2.6, m.diplomacy 2.5)
- week 449: 35.7 ms (ai 29.9, ai.operational 19.1, ai.strategic 10.7, armyCare 3.9)

Call costs at mid-campaign: findPath 0.09 ms (200/200 found), reachFrom 0.15 ms, supply distances (cold, per realm) 0.16 ms, evaluateTreaty 0.04 ms.

Save at the end of the campaign (first seed, median of three): 341 KB; save 3.9 ms, load 12 ms.

State size (KB): y0 126, y1 198, y10 309, y20 322, y30 341. Heap (MB): y0 13.8, y1 16.7, y10 20, y20 21.3, y30 21.9.
Counts: y0: 28 armies, 0 wars, 0 memories; y1: 19 armies, 0 wars, 36 memories; y10: 15 armies, 1 wars, 182 memories; y20: 16 armies, 0 wars, 273 memories; y30: 19 armies, 0 wars, 214 memories.
