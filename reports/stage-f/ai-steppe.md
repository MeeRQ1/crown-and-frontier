# AI-only campaign report

Map: steppe. Runs: 16 (seeds 1–16, difficulties normal, 60-year limit). Node v22.22.2.

Winners: gor 8, ast 8
Victory paths: diplomatic 8, economic 6, score 2
Average campaign length: 41.6 years; wars per campaign 17.1; average war 9.5 months; peace treaties 30.3; forced peaces 0.0; battles 98.
Coalitions formed per campaign: 3.4; coalition wars: 11.5.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 13.97 ms/tick average, 121 ms worst tick, heap ≈ 65 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.7% of all income on average (highest single realm 16.2%); check: at most 30%.
- Realms with a trade agreement: 98.4% of realm-months.
- Industry at the end: 176 of 176 surviving realms ran factories in their last month; factories 416 → 9579 (sum over runs).
- Average treasury at year 40: 9.72× monthly income; check: below 5×.
- Research: the average surviving realm finished 33.1% of the tree; 3021 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 66.2%, cavalry 13.7%, artillery 17.2%, engineers 2.7%, armour 0.2%.
- Shortages (share of realm-months): coal 17.8%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 130 of 130 surviving coastal realms built ships; 124 of the 124 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): pih ×3, dor ×1, ots ×1, san ×1.
- Air: 109 of 109 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 261.9, naval battle sides 164.4, landings 5.9, blockade weeks 810.6, fleet weeks at sea 7747.4, wings built 45.8, wing-weeks on missions 25289.0, bombing wing-weeks 14.1.
- Peace settlements per run: 15.5 (50 of 248 shared among several winners); demands won: cede 307, gold 173, renounce 154, reparations 125, disarm 12.
- Guarantees given per run 6.3 (61 of 176 realms gave one), honoured by joining a war 5 times; loans per run 16.0 (48 lenders, 5174 crowns lent per run).
- Trade blocs: 176 of 176 realms were members (85.9% of realm-months); spheres: 70 realms led one, and realms spent 9.0% of realm-months in another's sphere.
- National focus: 33.8 focuses completed per surviving realm (18% national); 176 of 176 completed national focuses, 176 a claim, 171 their ambition. First generic focuses by branch: army 226, diplomacy 162, industry 90, state 50. Doctrines: army_prof 119, dip_concord 108, sea_raid 105, army_fortress 101, ind_consumer 91, ind_war 73, army_offensive 66, dip_real 60, army_levy 49, sea_battle 20.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 57% ast, 69% pel, 54% pel, 57% ast, 57% tor, 57% ast, 57% pel, 57% pel, 71% ast, 54% pel, 57% pel, 57% ast, 65% pel, 56% pel, 53% pel, 57% ast; economic 88% ast, 100%/88% ast, 80% ast, 100%/97% ast, 96% ast, 100%/98% ast, 90% ast, 100%/100% ast, 97% ast, 100%/100% ast, 98% ast, 100%/82% ast, 99% ast, 76% ast, 90% ast, 100%/83% ast; diplomatic 100%/98% gor, 100%/70% volo, 100%/90% gor, 100%/88% gor, 100%/100% gor, 100%/75% gor, 100%/100% gor, 100%/83% gor, 100%/88% gor, 100%/87% vol, 100%/92% gor, 100%/65% gor, 100%/80% gor, 100%/97% gor, 100%/98% gor, 100%/72% gor.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| vol | 0 | 14→12.4 | 100% | 0.0 | 5.1/9.4 | 8% | 20.1 |
| san | 0 | 23→25.7 | 100% | 0.3 | 4.0/4.3 | 32% | 26.6 |
| ast | 8 | 31→42.7 | 100% | 7.7 | 32.2/17.6 | 4% | 27.4 |
| ots | 0 | 19→18.9 | 100% | 0.0 | 3.6/10.8 | 17% | 23.3 |
| kyz | 0 | 19→21.8 | 100% | 2.4 | 11.7/4.6 | 5% | 22.2 |
| gor | 8 | 22→20.9 | 100% | 0.0 | 4.6/10.6 | 1% | 22.9 |
| tor | 0 | 22→26.1 | 100% | 0.4 | 6.6/10.4 | 11% | 27.2 |
| pel | 0 | 28→31.2 | 100% | 3.6 | 13.8/9.5 | 4% | 24.2 |
| pih | 0 | 16→18.4 | 100% | 0.4 | 3.1/2.0 | 37% | 22.4 |
| dor | 0 | 20→21.3 | 100% | 2.3 | 8.9/8.1 | 13% | 24.8 |
| volo | 0 | 26→23.7 | 100% | 0.0 | 4.4/9.6 | 3% | 24.8 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | gor (diplomatic) | 1926.1 | 9 | 64 | — |
| 10 | normal | ast (economic) | 1923.6 | 27 | 174 | — |
| 11 | normal | gor (diplomatic) | 1896.5 | 4 | 21 | — |
| 12 | normal | gor (diplomatic) | 1908.6 | 20 | 84 | — |
| 13 | normal | gor (diplomatic) | 1913.0 | 18 | 77 | — |
| 14 | normal | ast (economic) | 1913.1 | 15 | 87 | — |
| 15 | normal | gor (diplomatic) | 1922.0 | 15 | 98 | — |
| 16 | normal | ast (economic) | 1932.0 | 24 | 175 | — |
| 2 | normal | gor (diplomatic) | 1930.6 | 14 | 95 | — |
| 3 | normal | ast (economic) | 1900.0 | 14 | 54 | — |
| 4 | normal | gor (diplomatic) | 1938.4 | 27 | 180 | — |
| 5 | normal | ast (economic) | 1909.9 | 18 | 100 | — |
| 6 | normal | ast (score) | 1940.1 | 25 | 179 | — |
| 7 | normal | ast (score) | 1940.1 | 15 | 75 | — |
| 8 | normal | gor (diplomatic) | 1928.1 | 16 | 69 | — |
| 9 | normal | ast (economic) | 1923.8 | 12 | 32 | — |
