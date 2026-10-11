### midsea (548 provinces, 16 realms) — atlas final: main 99e0322

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 12.8 ms, new campaign 13.8 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 16.39 | 12.72 | 33.06 | 53.73 | 83.4 (1182) |
| 2 | 1440 | 16.69 | 13.95 | 31.31 | 42.53 | 58.4 (987) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 10.56 | 41.48 | 77 |
| ai.strategic | 7.92 | 16.64 | 36.5 |
| m.economy | 6.55 | 13.27 | 15.1 |
| ai.operational | 2.61 | 28.65 | 54.1 |
| armyCare | 2.09 | 5.98 | 8.6 |
| m.diplomacy | 1.76 | 4.64 | 7.4 |
| m.integration | 1.72 | 4.03 | 7.4 |
| m.victory | 1.72 | 4.28 | 9.3 |
| m.events | 0.57 | 2.35 | 3.9 |
| naval | 0.2 | 0.94 | 2.8 |
| m.research | 0.16 | 1.12 | 2.8 |
| sieges | 0.1 | 0.44 | 3.3 |
| battles | 0.08 | 0.62 | 16.4 |
| m.wars | 0.08 | 0.31 | 0.7 |
| recruitment | 0.07 | 0.27 | 2.9 |
| movement | 0.04 | 0.25 | 2.2 |
| construction | 0.04 | 0.1 | 0.4 |
| warScores | 0.02 | 0.13 | 0.3 |
| orders | 0.01 | 0.05 | 0.2 |
| air | 0.01 | 0.03 | 0.6 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 1183: 83.4 ms (ai 77, ai.operational 54.1, ai.strategic 22.8, armyCare 4.4)
- week 1181: 76.4 ms (ai 65.2, ai.operational 44.6, ai.strategic 20.6, armyCare 7.3)
- week 1184: 72.9 ms (ai 42, ai.operational 28.8, m.economy 14.9, ai.strategic 13.1, armyCare 5.7, m.victory 2.9, m.integration 2.2)
- week 4: 71.5 ms (ai 43.2, ai.strategic 36.4, m.economy 8.4, ai.operational 6.8, m.integration 6.3, m.diplomacy 3.6, recruitment 2.9, m.victory 2.8, armyCare 2.2)
- week 1176: 68.7 ms (ai 43.8, ai.operational 29.3, ai.strategic 14.4, m.economy 12.8, armyCare 4.1, m.diplomacy 2.1)

Call costs at mid-campaign: findPath 0.1 ms (200/200 found), reachFrom 0.19 ms, supply distances (cold, per realm) 0.15 ms, evaluateTreaty 0.04 ms.

Save at the end of the campaign (first seed, median of three): 445 KB; save 5.1 ms, load 17.3 ms.

State size (KB): y0 206, y1 303, y10 398, y20 431, y30 445. Heap (MB): y0 14.3, y1 17.3, y10 20.4, y20 20.5, y30 20.5.
Counts: y0: 32 armies, 0 wars, 0 memories; y1: 29 armies, 0 wars, 37 memories; y10: 30 armies, 0 wars, 201 memories; y20: 36 armies, 2 wars, 324 memories; y30: 44 armies, 0 wars, 286 memories.
