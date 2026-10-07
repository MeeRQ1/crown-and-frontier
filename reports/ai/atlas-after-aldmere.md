# AI-only campaign report

Map: aldmere. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: mor 2, les 4, fen 1, tar 1
Victory paths: economic 5, score 1, diplomatic 2
Average campaign length: 32.5 years; wars per campaign 16.9; average war 10.2 months; peace treaties 28.7; forced peaces 0.0; battles 84.
Coalitions formed per campaign: 3.3; coalition wars: 14.9.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 25.34 ms/tick average, 455 ms worst tick, heap ≈ 70 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 7.1% of all income on average (highest single realm 17.1%); check: at most 30%.
- Realms with a trade agreement: 99.3% of realm-months.
- Industry at the end: 112 of 112 surviving realms ran factories in their last month; factories 256 → 4683 (sum over runs).
- Average treasury at year 40: 2.98× monthly income; check: below 5×.
- Research: the average surviving realm finished 28.3% of the tree; 1531 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 66.6%, cavalry 13.3%, artillery 17.7%, engineers 2.3%, armour 0.1%.
- Shortages (share of realm-months): coal 6.0%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 104 of 104 surviving coastal realms built ships; 100 of the 101 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: car ×1); check: all. Never at war with a coastal realm while coastal (built only): ist ×2, fen ×1.
- Air: 44 of 44 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 298.1, naval battle sides 185.0, landings 6.9, blockade weeks 986.1, fleet weeks at sea 5755.5, wings built 37.9, wing-weeks on missions 16268.4, bombing wing-weeks 15.5.
- Peace settlements per run: 14.5 (11 of 116 shared among several winners); demands won: cede 124, renounce 74, gold 67, reparations 40, disarm 1, sphere 1.
- Guarantees given per run 5.9 (25 of 112 realms gave one), honoured by joining a war 1 times; loans per run 2.9 (11 lenders, 1011 crowns lent per run).
- Trade contracts: 1578.9 signed per run (112 of 112 realms signed at least one); realms held one in 82.1% of realm-months, 1.45 contracts in force per realm-month; per run 1496.6 ran their term, 0.0 ended in default, 47.4 were cancelled; 14483 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 10.2% of army-months at war (1.7% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 3 of 133 ended (2%); idle treasuries (over 10 months of income with a builder free) 0.1% of realm-months.
- Trade blocs: 112 of 112 realms were members (83.6% of realm-months); spheres: 38 realms led one, and realms spent 11.3% of realm-months in another's sphere.
- National focus: 30.7 focuses completed per surviving realm (19% national); 112 of 112 completed national focuses, 112 a claim, 102 their ambition. First generic focuses by branch: army 163, diplomacy 86, industry 60, state 22, sea 5. Doctrines: sea_raid 78, army_prof 70, dip_concord 61, army_fortress 55, ind_consumer 45, army_offensive 42, ind_war 38, dip_real 33, army_levy 31, sea_battle 12.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 67% tar, 60% tar, 63% tar, 63% tar, 62% tar, 63% tar, 65% tar, 62% tar; economic 100%/85% mor, 100%/90% les, 100%/92% les, 100%/25% mor, 100%/88% mor, 100%/90% les, 100%/97% les, 100%/73% les; diplomatic 100%/82% ser, 100%/62% ser, 100%/77% fen, 100%/87% ser, 100%/93% fen, 100%/60% fen, 100%/98% fen, 100%/95% ser.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 0 | 25→30.0 | 100% | 3.1 | 11.6/3.9 | 2% | 22.4 |
| vos | 0 | 20→20.8 | 100% | 0.1 | 3.3/15.0 | 22% | 18.5 |
| ser | 0 | 20→20.0 | 100% | 0.0 | 2.1/3.1 | 23% | 22.3 |
| cal | 0 | 16→16.3 | 100% | 0.0 | 1.1/1.4 | 4% | 22.5 |
| ist | 0 | 17→17.0 | 100% | 0.0 | 0.8/1.4 | 9% | 20.8 |
| dre | 0 | 21→24.3 | 100% | 3.8 | 16.1/3.3 | 8% | 19.4 |
| mor | 2 | 25→39.1 | 100% | 5.6 | 20.9/10.1 | 4% | 24.4 |
| fen | 1 | 12→15.8 | 100% | 0.0 | 1.5/6.1 | 26% | 19.4 |
| tar | 1 | 30→33.5 | 100% | 0.8 | 6.4/5.1 | 12% | 20.8 |
| car | 0 | 13→13.4 | 100% | 0.0 | 2.5/2.6 | 22% | 18.6 |
| hra | 0 | 14→9.5 | 100% | 0.0 | 5.5/19.0 | 9% | 16.8 |
| sol | 0 | 12→10.5 | 100% | 0.0 | 1.9/2.6 | 32% | 19.8 |
| les | 4 | 24→31.1 | 100% | 2.3 | 8.5/4.3 | 2% | 23.0 |
| ash | 0 | 15→16.9 | 100% | 1.3 | 1.9/5.3 | 39% | 21.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | mor (economic) | 1913.8 | 20 | 78 | — |
| 2 | normal | les (economic) | 1898.5 | 12 | 65 | — |
| 3 | normal | les (economic) | 1898.4 | 11 | 47 | — |
| 4 | normal | mor (score) | 1930.1 | 19 | 96 | — |
| 5 | normal | fen (diplomatic) | 1924.3 | 19 | 121 | — |
| 6 | normal | les (economic) | 1897.5 | 14 | 73 | — |
| 7 | normal | les (economic) | 1922.2 | 26 | 126 | — |
| 8 | normal | tar (diplomatic) | 1915.3 | 14 | 66 | — |
