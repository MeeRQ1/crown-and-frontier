# AI-only campaign report

Map: aldmere. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: aur 2, les 2, mor 3, sol 1
Victory paths: score 6, economic 1, diplomatic 1
Average campaign length: 46.3 years; wars per campaign 22.6; average war 11.5 months; peace treaties 40.2; forced peaces 0.0; battles 126.
Coalitions formed per campaign: 3.3; coalition wars: 16.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 17.63 ms/tick average, 196 ms worst tick, heap ≈ 82 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 9.6% of all income on average (highest single realm 45.5%); check: at most 30%.
- Realms with a trade agreement: 99.5% of realm-months.
- Industry at the end: 112 of 112 surviving realms ran factories in their last month; factories 256 → 5442 (sum over runs).
- Average treasury at year 40: 3.11× monthly income; check: below 5×.
- Research: the average surviving realm finished 36.3% of the tree; 2185 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 67.4%, cavalry 11.8%, artillery 17.9%, engineers 2.7%, armour 0.2%.
- Shortages (share of realm-months): coal 18.2%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 104 of 104 surviving coastal realms built ships; 99 of the 99 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): ist ×3, ser ×2.
- Air: 96 of 96 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 407.5, naval battle sides 206.1, landings 8.5, blockade weeks 1482.6, fleet weeks at sea 9371.9, wings built 84.1, wing-weeks on missions 45597.6, bombing wing-weeks 130.3.
- Peace settlements per run: 20.0 (30 of 160 shared among several winners); demands won: cede 177, renounce 115, gold 95, reparations 57, sphere 3, disarm 2.
- Guarantees given per run 9.3 (32 of 112 realms gave one), honoured by joining a war 4 times; loans per run 5.0 (17 lenders, 1850 crowns lent per run).
- Trade contracts: 0.0 signed per run (0 of 112 realms signed at least one); realms held one in 0.0% of realm-months, 0.00 contracts in force per realm-month; per run 0.0 ran their term, 0.0 ended in default, 0.0 were cancelled; 0 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 21.6% of army-months at war; pointless wars (no land and no demand changed hands) 1 of 180 ended (1%); idle treasuries (over 10 months of income with a builder free) 0.2% of realm-months.
- Trade blocs: 112 of 112 realms were members (89.9% of realm-months); spheres: 44 realms led one, and realms spent 7.4% of realm-months in another's sphere.
- National focus: 36.0 focuses completed per surviving realm (17% national); 112 of 112 completed national focuses, 112 a claim, 110 their ambition. First generic focuses by branch: army 171, diplomacy 85, industry 57, state 22, sea 1. Doctrines: army_prof 83, sea_raid 80, dip_concord 71, army_fortress 67, ind_consumer 63, army_offensive 41, ind_war 40, dip_real 39, army_levy 25, sea_battle 21.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 63% tar, 63% tar, 67% tar, 67% tar, 67% tar, 65% tar, 65% tar, 63% tar; economic 92% les, 100%/85% les, 95% mor, 100%/87% mor, 99% mor, 100%/60% mor, 97% aur, 100%/82% les; diplomatic 100%/85% ser, 100%/55% ser, 100%/73% fen, 100%/73% ser, 100%/90% ser, 100%/82% fen, 100%/67% ser, 100%/95% ser.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 2 | 25→31.9 | 100% | 3.9 | 16.6/8.6 | 10% | 29.1 |
| vos | 0 | 20→19.9 | 100% | 1.1 | 11.9/21.3 | 34% | 23.9 |
| ser | 0 | 20→19.6 | 100% | 0.0 | 4.8/1.9 | 51% | 28.8 |
| cal | 0 | 16→16.8 | 100% | 0.0 | 3.3/4.8 | 19% | 29.3 |
| ist | 0 | 17→17.0 | 100% | 0.0 | 0.1/0.3 | 34% | 26.1 |
| dre | 0 | 21→23.8 | 100% | 5.9 | 22.0/8.8 | 12% | 25.8 |
| mor | 3 | 25→35.9 | 100% | 8.3 | 31.8/16.0 | 12% | 30.5 |
| fen | 0 | 12→15.9 | 100% | 0.0 | 2.6/4.3 | 35% | 24.3 |
| tar | 0 | 30→34.0 | 100% | 0.1 | 8.4/13.1 | 12% | 27.5 |
| car | 0 | 13→13.3 | 100% | 0.0 | 0.9/3.9 | 25% | 23.6 |
| hra | 0 | 14→10.1 | 100% | 0.1 | 7.0/26.8 | 17% | 20.9 |
| sol | 1 | 12→11.3 | 100% | 0.0 | 1.0/3.5 | 61% | 25.3 |
| les | 2 | 24→29.6 | 100% | 2.3 | 8.1/5.5 | 16% | 29.3 |
| ash | 0 | 15→19.1 | 100% | 1.0 | 7.9/8.9 | 24% | 27.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | aur (score) | 1930.1 | 22 | 131 | — |
| 2 | normal | les (economic) | 1900.8 | 11 | 56 | — |
| 3 | normal | mor (score) | 1930.1 | 14 | 67 | — |
| 4 | normal | mor (score) | 1930.1 | 21 | 116 | — |
| 5 | normal | mor (score) | 1930.1 | 30 | 150 | — |
| 6 | normal | sol (diplomatic) | 1928.9 | 29 | 186 | — |
| 7 | normal | aur (score) | 1930.1 | 23 | 126 | — |
| 8 | normal | les (score) | 1930.1 | 31 | 178 | — |
