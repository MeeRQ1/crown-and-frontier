# AI-only campaign report

Map: steppe. Runs: 16 (seeds 1–16, difficulties normal, 60-year limit). Node v22.22.2.

Winners: ast 9, gor 6, pih 1
Victory paths: economic 7, diplomatic 7, score 2
Average campaign length: 38.3 years; wars per campaign 12.0; average war 10.1 months; peace treaties 21.5; forced peaces 0.0; battles 68.
Coalitions formed per campaign: 2.8; coalition wars: 10.8.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 26.52 ms/tick average, 612 ms worst tick, heap ≈ 62 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.5% of all income on average (highest single realm 15.3%); check: at most 30%.
- Realms with a trade agreement: 98.2% of realm-months.
- Industry at the end: 176 of 176 surviving realms ran factories in their last month; factories 416 → 9236 (sum over runs).
- Average treasury at year 40: 10.39× monthly income; check: below 5×.
- Research: the average surviving realm finished 31.4% of the tree; 2807 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 66.7%, cavalry 13.4%, artillery 17.4%, engineers 2.4%, armour 0.1%.
- Shortages (share of realm-months): coal 14.2%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 129 of 129 surviving coastal realms built ships; 115 of the 117 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: san ×2); check: all. Never at war with a coastal realm while coastal (built only): pih ×3, kyz ×2, ots ×2, dor ×1, pel ×1, san ×1, vol ×1, volo ×1.
- Air: 89 of 89 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 222.1, naval battle sides 129.1, landings 4.6, blockade weeks 609.9, fleet weeks at sea 7086.9, wings built 35.4, wing-weeks on missions 19238.8, bombing wing-weeks 12.1.
- Peace settlements per run: 10.9 (38 of 174 shared among several winners); demands won: cede 207, gold 120, renounce 106, reparations 71, disarm 9, sphere 1.
- Guarantees given per run 4.8 (53 of 176 realms gave one), honoured by joining a war 5 times; loans per run 11.5 (39 lenders, 3678 crowns lent per run).
- Trade blocs: 176 of 176 realms were members (84.4% of realm-months); spheres: 66 realms led one, and realms spent 9.2% of realm-months in another's sphere.
- National focus: 33.0 focuses completed per surviving realm (18% national); 176 of 176 completed national focuses, 176 a claim, 170 their ambition. First generic focuses by branch: army 234, diplomacy 165, industry 82, state 47. Doctrines: army_prof 128, sea_raid 112, ind_consumer 111, dip_concord 110, army_fortress 94, army_offensive 67, dip_real 58, ind_war 50, army_levy 37, sea_battle 9.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 71% ast, 57% pel, 53% pel, 53% pel, 57% ast, 57% ast, 57% pel, 53% pel, 57% ast, 56% pel, 57% ast, 71% ast, 57% ast, 57% pel, 53% pel, 57% ast; economic 100%/97% ast, 96% ast, 90% ast, 100%/88% ast, 100%/82% ast, 99% ast, 100%/83% ast, 100%/72% ast, 98% ast, 100%/93% ast, 100%/87% ast, 100%/92% ast, 100%/85% ast, 91% ast, 94% ast, 98% ast; diplomatic 100%/97% gor, 100%/90% gor, 100%/97% gor, 100%/57% gor, 100%/88% gor, 100%/90% gor, 100%/90% gor, 100%/93% gor, 100%/92% gor, 100%/83% vol, 100%/85% gor, 100%/90% gor, 100%/63% gor, 100%/97% gor, 100%/73% gor, 100%/85% gor.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| vol | 0 | 14→12.4 | 100% | 0.0 | 2.0/6.1 | 4% | 19.1 |
| san | 0 | 23→25.4 | 100% | 0.3 | 2.9/4.0 | 31% | 25.2 |
| ast | 9 | 31→41.5 | 100% | 6.1 | 22.6/16.1 | 4% | 25.6 |
| ots | 0 | 19→19.6 | 100% | 0.1 | 1.8/6.5 | 5% | 22.1 |
| kyz | 0 | 19→21.0 | 100% | 0.9 | 7.5/2.4 | 2% | 21.8 |
| gor | 6 | 22→21.3 | 100% | 0.0 | 1.6/4.0 | 1% | 22.1 |
| tor | 0 | 22→24.8 | 100% | 0.1 | 3.9/7.5 | 8% | 25.9 |
| pel | 0 | 28→30.1 | 100% | 2.4 | 11.8/7.1 | 2% | 22.4 |
| pih | 1 | 16→18.6 | 100% | 0.1 | 0.8/1.9 | 20% | 20.9 |
| dor | 0 | 20→22.5 | 100% | 2.1 | 9.6/7.4 | 6% | 23.4 |
| volo | 0 | 26→25.9 | 100% | 0.0 | 3.3/3.8 | 1% | 23.9 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ast (economic) | 1908.2 | 13 | 64 | — |
| 10 | normal | gor (diplomatic) | 1910.5 | 15 | 76 | — |
| 11 | normal | gor (diplomatic) | 1917.2 | 6 | 34 | — |
| 12 | normal | ast (economic) | 1898.7 | 5 | 16 | — |
| 13 | normal | gor (diplomatic) | 1928.6 | 18 | 110 | — |
| 14 | normal | ast (score) | 1940.1 | 14 | 92 | — |
| 15 | normal | ast (economic) | 1930.8 | 24 | 133 | — |
| 16 | normal | gor (diplomatic) | 1898.4 | 7 | 35 | — |
| 2 | normal | gor (diplomatic) | 1926.4 | 9 | 51 | — |
| 3 | normal | ast (economic) | 1905.3 | 11 | 33 | — |
| 4 | normal | ast (economic) | 1924.7 | 10 | 92 | — |
| 5 | normal | ast (economic) | 1916.4 | 10 | 70 | — |
| 6 | normal | ast (economic) | 1901.8 | 10 | 47 | — |
| 7 | normal | pih (diplomatic) | 1926.5 | 13 | 74 | — |
| 8 | normal | ast (score) | 1940.1 | 13 | 78 | — |
| 9 | normal | gor (diplomatic) | 1918.8 | 14 | 80 | — |
