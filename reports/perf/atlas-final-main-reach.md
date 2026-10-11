### reach (99 provinces, 9 realms) — atlas final: main 99e0322

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 0.7 ms, new campaign 4.2 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 3.83 | 3.08 | 7.61 | 10.31 | 27.1 (0) |
| 2 | 1440 | 4.02 | 3.46 | 8.05 | 11.84 | 35.1 (935) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 2.25 | 5.96 | 20.6 |
| ai.strategic | 1.68 | 4.41 | 16.6 |
| m.economy | 1.62 | 3.68 | 4.3 |
| m.diplomacy | 0.59 | 1.58 | 2 |
| ai.operational | 0.56 | 3.45 | 6.1 |
| armyCare | 0.48 | 1.42 | 4.5 |
| m.victory | 0.46 | 1.41 | 3.8 |
| m.integration | 0.34 | 1.12 | 4.4 |
| m.events | 0.17 | 0.76 | 2.5 |
| m.research | 0.09 | 0.55 | 3.2 |
| air | 0.08 | 0.39 | 1.6 |
| naval | 0.07 | 0.42 | 2.1 |
| battles | 0.04 | 0.35 | 15.9 |
| m.wars | 0.04 | 0.23 | 1.2 |
| sieges | 0.02 | 0.11 | 0.8 |
| recruitment | 0.02 | 0.11 | 2.6 |
| movement | 0.01 | 0.1 | 0.8 |
| construction | 0.01 | 0.05 | 0.3 |
| proposals | 0 | 0 | 0.1 |
| orders | 0 | 0.01 | 0.2 |
| warScores | 0 | 0.05 | 0.2 |

Slowest weeks, first seed:

- week 1: 27.1 ms (ai 20.6, ai.strategic 16.6, ai.operational 3.8)
- week 78: 18.9 ms (battles 15.9, ai 2.1)
- week 4: 15.5 ms (ai 6.1, ai.strategic 5.3, m.economy 2.9)
- week 124: 12.9 ms (ai 6.2, ai.operational 3.4, ai.strategic 2.8, m.economy 2.6)
- week 108: 12.6 ms (m.integration 4.4, ai 3.5)

Call costs at mid-campaign: findPath 0.05 ms (183/200 found), reachFrom 0.04 ms, supply distances (cold, per realm) 0.05 ms, evaluateTreaty 0.02 ms.

Save at the end of the campaign (first seed, median of three): 212 KB; save 2.1 ms, load 7.2 ms.

State size (KB): y0 58, y1 89, y10 193, y20 202, y30 211. Heap (MB): y0 13.3, y1 15.6, y10 18.1, y20 19.7, y30 20.5.
Counts: y0: 18 armies, 0 wars, 0 memories; y1: 9 armies, 0 wars, 31 memories; y10: 9 armies, 0 wars, 100 memories; y20: 9 armies, 0 wars, 104 memories; y30: 9 armies, 0 wars, 88 memories.
