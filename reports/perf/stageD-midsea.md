### midsea (548 provinces, 16 realms) — Stage D

Node v22.22.2, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, linux 6.18.44-fc-v70; AI-only, 30 years, seeds 1-2; GC exposed: true.

Creation: world build 12.4 ms, new campaign 13.1 ms (median of 5).

| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |
|---|---|---|---|---|---|---|
| 1 | 1440 | 12.49 | 10.01 | 22.79 | 31.03 | 55.4 (0) |
| 2 | 1440 | 14.17 | 12.8 | 25.69 | 31.7 | 49.6 (1043) |

Per phase (ms per week it runs; monthly phases run every 4th week), first seed:

| Phase | Avg | p99 | Max |
|---|---|---|---|
| ai | 7.96 | 22.52 | 44.9 |
| ai.strategic | 5.99 | 11.4 | 37.6 |
| m.economy | 5.5 | 10.4 | 17.3 |
| ai.operational | 1.96 | 11.64 | 18.7 |
| armyCare | 1.77 | 3.8 | 5 |
| m.integration | 1.48 | 3.4 | 5.2 |
| m.victory | 1.23 | 2.59 | 5.9 |
| m.diplomacy | 0.35 | 0.7 | 1.4 |
| m.events | 0.32 | 1.31 | 3 |
| naval | 0.13 | 0.39 | 5 |
| sieges | 0.1 | 0.37 | 5.2 |
| battles | 0.09 | 0.95 | 2.6 |
| m.research | 0.08 | 0.21 | 0.5 |
| m.wars | 0.07 | 0.3 | 1.3 |
| movement | 0.05 | 0.3 | 2.6 |
| recruitment | 0.05 | 0.21 | 1.2 |
| construction | 0.03 | 0.08 | 0.6 |
| warScores | 0.02 | 0.14 | 0.3 |
| orders | 0.01 | 0.05 | 0.2 |
| proposals | 0 | 0 | 0.1 |
| air | 0 | 0.02 | 0.3 |

Slowest weeks, first seed:

- week 1: 55.4 ms (ai 44.9, ai.strategic 31.8, ai.operational 12.9, armyCare 4.8)
- week 4: 50.7 ms (ai 28.6, ai.strategic 24.4, m.economy 7.4, m.integration 5.2, ai.operational 4.2, m.victory 2.6, armyCare 2.3)
- week 3: 49.3 ms (ai 44.3, ai.strategic 37.6, ai.operational 6.6, armyCare 3.7)
- week 2: 45.5 ms (ai 39.7, ai.strategic 35.4, ai.operational 4.2, armyCare 4.1)
- week 188: 42.3 ms (ai 21, ai.strategic 11, ai.operational 9.9, m.economy 9.6, m.integration 4.1, armyCare 2.8)

Call costs at mid-campaign: findPath 0.1 ms (185/200 found), reachFrom 0.16 ms, supply distances (cold, per realm) 0.13 ms, evaluateTreaty 0.03 ms.

State size (KB): y0 203, y1 302, y10 419, y20 415, y30 421. Heap (MB): y0 13.5, y1 16.4, y10 19.1, y20 19.9, y30 20.4.
Counts: y0: 32 armies, 0 wars, 0 memories; y1: 26 armies, 0 wars, 39 memories; y10: 44 armies, 0 wars, 157 memories; y20: 48 armies, 0 wars, 224 memories; y30: 48 armies, 0 wars, 172 memories.
