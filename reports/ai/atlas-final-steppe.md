# AI-only campaign report

Map: steppe. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: ast 7, pel 1
Victory paths: economic 3, score 5
Average campaign length: 44.7 years; wars per campaign 20.0; average war 10.3 months; peace treaties 31.6; forced peaces 0.0; battles 139.
Coalitions formed per campaign: 1.4; coalition wars: 1.3.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 7.08 ms/tick average, 55 ms worst tick, heap ≈ 73 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.2% of all income on average (highest single realm 19.4%); check: at most 30%.
- Realms with a trade agreement: 99.7% of realm-months.
- Industry at the end: 88 of 88 surviving realms ran factories in their last month; factories 208 → 5092 (sum over runs).
- Average treasury at year 40: 9.26× monthly income; check: below 5×.
- Research: the average surviving realm finished 35.2% of the tree; 1647 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 67.1%, cavalry 13.2%, artillery 17.1%, engineers 2.4%, armour 0.1%.
- Shortages (share of realm-months): coal 15.7%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 66 of 66 surviving coastal realms built ships; 64 of the 64 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): pih ×1, tor ×1.
- Air: 64 of 64 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 337.0, naval battle sides 233.8, landings 10.1, blockade weeks 1108.5, fleet weeks at sea 8231.3, wings built 62.9, wing-weeks on missions 25569.8, bombing wing-weeks 143.4.
- Peace settlements per run: 18.8 (27 of 150 shared among several winners); demands won: cede 184, renounce 98, gold 81, reparations 65, disarm 5.
- Guarantees given per run 8.5 (34 of 88 realms gave one), honoured by joining a war 10 times; loans per run 15.4 (20 lenders, 4761 crowns lent per run).
- Trade contracts: 600.0 signed per run (88 of 88 realms signed at least one); realms held one in 50.1% of realm-months, 0.51 contracts in force per realm-month; per run 589.6 ran their term, 0.0 ended in default, 0.0 were cancelled; 5026 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 3.1% of army-months at war (1.5% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 3 of 159 ended (2%); idle treasuries (over 10 months of income with a builder free) 5.1% of realm-months.
- Trade blocs: 88 of 88 realms were members (86.5% of realm-months); spheres: 30 realms led one, and realms spent 9.0% of realm-months in another's sphere.
- National focus: 36.2 focuses completed per surviving realm (17% national); 88 of 88 completed national focuses, 88 a claim, 88 their ambition. First generic focuses by branch: army 117, diplomacy 81, industry 44, state 22. Doctrines: army_prof 66, ind_consumer 61, sea_raid 58, dip_concord 56, army_fortress 50, army_offensive 38, dip_real 32, ind_war 27, army_levy 22, sea_battle 8.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 57% ast, 57% ast, 67% pel, 71% ast, 57% pel, 57% ast, 71% ast, 57% ast; economic 100%/87% ast, 100%/92% ast, 100%/95% ast, 90% ast, 79% ast, 97% ast, 96% ast, 93% ast; diplomatic 92% gor, 83% pih, 83% gor, 100%/35% ast, 100%/8% volo, 83% volo, 100%/38% volo, 100%/32% volo.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| vol | 0 | 14→11.0 | 100% | 0.0 | 5.8/10.9 | 4% | 21.3 |
| san | 0 | 23→25.5 | 100% | 0.1 | 6.9/9.6 | 4% | 28.8 |
| ast | 7 | 31→42.1 | 100% | 7.6 | 38.9/27.1 | 1% | 28.9 |
| ots | 0 | 19→17.8 | 100% | 0.3 | 6.4/16.1 | 5% | 24.6 |
| kyz | 0 | 19→22.9 | 100% | 2.6 | 16.9/10.8 | 1% | 23.9 |
| gor | 0 | 22→21.9 | 100% | 0.0 | 3.3/4.3 | 2% | 24.8 |
| tor | 0 | 22→22.9 | 100% | 0.1 | 9.6/13.5 | 2% | 27.6 |
| pel | 1 | 28→32.8 | 100% | 5.5 | 22.6/16.4 | 3% | 25.5 |
| pih | 0 | 16→18.1 | 100% | 0.0 | 4.1/6.0 | 3% | 23.5 |
| dor | 0 | 20→23.3 | 100% | 3.8 | 17.0/15.6 | 10% | 27.1 |
| volo | 0 | 26→24.9 | 100% | 0.0 | 7.4/8.1 | 0% | 27.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ast (economic) | 1914.7 | 14 | 97 | — |
| 2 | normal | ast (economic) | 1913.4 | 16 | 83 | — |
| 3 | normal | ast (economic) | 1919.3 | 25 | 187 | — |
| 4 | normal | ast (score) | 1930.1 | 20 | 127 | — |
| 5 | normal | pel (score) | 1930.1 | 16 | 92 | — |
| 6 | normal | ast (score) | 1930.1 | 33 | 238 | — |
| 7 | normal | ast (score) | 1930.1 | 16 | 130 | — |
| 8 | normal | ast (score) | 1930.1 | 20 | 156 | — |
