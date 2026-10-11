### hesperia (754 provinces, 22 realms) — atlas final: branch 6153e86

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 10 years, seeds 1-2; GC exposed: true.

Creation: world build 22.3 ms, new campaign 20.6 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 480 | 25.01 | 22.21 | 46.98 | 62.11 | 79.1 (339) |
| 2 | 480 | 23.05 | 21.35 | 39.98 | 49.74 | 66.6 (463) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 17.63 | 40.34 | 59.5 |
| ai.strategic | 12.33 | 25.41 | 47.5 |
| m.economy | 6.76 | 14.4 | 19.4 |
| ai.operational | 5.23 | 20.78 | 24.2 |
| m.diplomacy | 3.58 | 7.99 | 14 |
| m.integration | 2.77 | 4.87 | 7.6 |
| m.victory | 2.14 | 4.35 | 5.6 |
| armyCare | 1.96 | 7.62 | 11.3 |
| m.events | 1.04 | 3 | 4.9 |
| m.research | 0.32 | 1.06 | 1.2 |
| naval | 0.29 | 0.85 | 2 |
| m.wars | 0.19 | 0.79 | 0.9 |
| movement | 0.18 | 1.16 | 3.7 |
| battles | 0.18 | 1.02 | 15.9 |
| sieges | 0.17 | 0.75 | 2 |
| recruitment | 0.12 | 0.54 | 2 |
| construction | 0.05 | 0.15 | 0.3 |
| warScores | 0.05 | 0.48 | 0.6 |
| orders | 0.02 | 0.07 | 0.3 |
| air | 0.01 | 0.04 | 0.3 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 340: 79.1 ms (ai 38.8, ai.strategic 19.9, m.economy 19.4, ai.operational 18.8, m.diplomacy 8.8, m.integration 3.9, m.victory 2.9, m.events 2.1)
- week 156: 74.6 ms (ai 38.8, ai.operational 21.7, ai.strategic 17, m.economy 13.5, m.diplomacy 5, armyCare 4.7, m.integration 4.5, m.victory 3.5)
- week 152: 67.9 ms (ai 36.8, ai.strategic 18.9, ai.operational 17.6, m.economy 10.4, m.diplomacy 5.4, m.integration 4.8, m.victory 3.6, m.events 2.7)
- week 84: 67.7 ms (ai 28.1, ai.operational 18.3, battles 15.9, ai.strategic 9.8, m.economy 7.4, m.diplomacy 3, armyCare 3, m.integration 2.7)
- week 1: 67.5 ms (ai 59.5, ai.strategic 47.5, ai.operational 11.6)

Call costs at mid-campaign: findPath 0.1 ms (199/200 found), reachFrom 0.12 ms, supply distances (cold, per realm) 0.03 ms, evaluateTreaty 0.03 ms.

Save at the end of the campaign (first seed, median of three): 548 KB; save 6 ms, load 23.9 ms.

State size (KB): y0 287, y1 428, y10 547. Heap (MB): y0 20.2, y1 23.7, y10 27.
Counts: y0: 43 armies, 0 wars, 0 memories; y1: 32 armies, 0 wars, 107 memories; y10: 45 armies, 0 wars, 485 memories.
