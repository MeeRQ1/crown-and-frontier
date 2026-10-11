### earth (1225 provinces, 57 realms) — atlas final: branch 6153e86

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v114; AI-only, 10 years, seeds 1-2; GC exposed: true.

Creation: world build 35.4 ms, new campaign 88.4 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 480 | 137.9 | 130.51 | 217.35 | 272 | 305.9 (391) |
| 2 | 480 | 139.17 | 129.66 | 229.23 | 296.68 | 378.1 (383) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 97.74 | 172.79 | 200.7 |
| ai.strategic | 65.57 | 119.16 | 166.9 |
| m.economy | 41.81 | 79.03 | 111.9 |
| ai.operational | 31.98 | 61.99 | 82.3 |
| m.diplomacy | 21.99 | 39.13 | 46.6 |
| armyCare | 13.35 | 35.84 | 43.7 |
| m.victory | 8.82 | 18.38 | 20.8 |
| m.integration | 7.05 | 17.67 | 18.1 |
| m.events | 3.17 | 8.6 | 11.2 |
| naval | 1.14 | 2.88 | 3.5 |
| movement | 1.05 | 3.44 | 5.2 |
| air | 0.9 | 3.12 | 6.1 |
| m.research | 0.9 | 3.87 | 6.3 |
| m.wars | 0.87 | 2.64 | 4.2 |
| sieges | 0.59 | 2.22 | 2.9 |
| battles | 0.58 | 3.2 | 8.3 |
| recruitment | 0.49 | 1.67 | 3.5 |
| warScores | 0.33 | 2.01 | 2.8 |
| construction | 0.14 | 0.31 | 10.6 |
| orders | 0.06 | 0.13 | 0.3 |
| proposals | 0 | 0.01 | 0.1 |

Slowest weeks, first seed:

- week 392: 305.9 ms (ai 148.6, ai.strategic 96.6, m.economy 79, ai.operational 51.8, armyCare 27.6, m.diplomacy 25.2, m.victory 6.9, m.integration 4.8, air 3.4, m.events 2.7)
- week 76: 286.8 ms (ai 152.1, ai.strategic 93.5, ai.operational 58.2, m.diplomacy 40, m.economy 34.9, m.integration 15.1, armyCare 14.8, m.victory 14, m.events 3.5, m.wars 2.8)
- week 332: 286.1 ms (ai 115.3, m.economy 111.9, ai.strategic 79.8, ai.operational 35.3, m.diplomacy 18.9, armyCare 15.8, m.victory 9.6, m.integration 4.5, m.events 2.7)
- week 80: 283.5 ms (ai 149.6, ai.strategic 75.9, ai.operational 73.3, m.economy 57.1, m.diplomacy 26, m.integration 17.8, armyCare 12.8, m.victory 6.5, m.events 3.3, m.wars 2.1)
- week 412: 274.6 ms (ai 128.7, m.economy 72.8, ai.strategic 71.7, ai.operational 56.7, m.diplomacy 23.5, armyCare 19, m.victory 10.2, m.integration 5.4, m.events 3.4)

Call costs at mid-campaign: findPath 0.05 ms (166/200 found), reachFrom 0.07 ms, supply distances (cold, per realm) 0.25 ms, evaluateTreaty 0.03 ms.

Save at the end of the campaign (first seed, median of three): 1124 KB; save 12.9 ms, load 50.9 ms.

State size (KB): y0 557, y1 804, y10 1123. Heap (MB): y0 23.3, y1 27.8, y10 31.9.
Counts: y0: 86 armies, 0 wars, 0 memories; y1: 120 armies, 0 wars, 289 memories; y10: 116 armies, 3 wars, 1331 memories.
