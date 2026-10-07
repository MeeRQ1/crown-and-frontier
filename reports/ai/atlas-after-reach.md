# AI-only campaign report

Map: reach. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: ser 3, fen 3, cal 2
Victory paths: diplomatic 8
Average campaign length: 17.7 years; wars per campaign 5.9; average war 8.0 months; peace treaties 7.6; forced peaces 0.0; battles 18.
Coalitions formed per campaign: 0.4; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 11.47 ms/tick average, 127 ms worst tick, heap ≈ 49 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 8.7% of all income on average (highest single realm 17.2%); check: at most 30%.
- Realms with a trade agreement: 99.6% of realm-months.
- Industry at the end: 72 of 72 surviving realms ran factories in their last month; factories 144 → 1215 (sum over runs).
- Average treasury at year 40: n/a (no run reached year 40); check: below 5×.
- Research: the average surviving realm finished 39.2% of the tree; 404 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 61.2%, cavalry 16.7%, artillery 15.9%, engineers 6.2%, armour 0.0%.
- Shortages (share of realm-months): coal 3.0%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 59 of 59 surviving coastal realms built ships; 38 of the 38 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): aur ×6, ser ×5, vos ×5, fen ×3, ist ×1, tar ×1.
- Air: 9 of 9 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 40.5, naval battle sides 21.1, landings 0.9, blockade weeks 84.9, fleet weeks at sea 2798.1, wings built 16.6, wing-weeks on missions 4749.4, bombing wing-weeks 0.0.
- Peace settlements per run: 5.3 (3 of 42 shared among several winners); demands won: cede 48, renounce 29, reparations 22, gold 21, disarm 4, sphere 1.
- Guarantees given per run 3.8 (27 of 72 realms gave one), honoured by joining a war 2 times; loans per run 1.1 (6 lenders, 178 crowns lent per run).
- Trade contracts: 490.0 signed per run (72 of 72 realms signed at least one); realms held one in 84.7% of realm-months, 1.24 contracts in force per realm-month; per run 458.5 ran their term, 0.1 ended in default, 14.6 were cancelled; 3592 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 1.2% of army-months at war (0.3% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 0 of 46 ended (0%); idle treasuries (over 10 months of income with a builder free) 0.0% of realm-months.
- Trade blocs: 71 of 72 realms were members (63.7% of realm-months); spheres: 22 realms led one, and realms spent 12.5% of realm-months in another's sphere.
- National focus: 20.3 focuses completed per surviving realm (27% national); 72 of 72 completed national focuses, 68 a claim, 58 their ambition. First generic focuses by branch: army 83, diplomacy 56, industry 45, state 24, sea 8. Doctrines: army_prof 42, sea_raid 36, army_offensive 32, dip_concord 27, army_fortress 19, ind_consumer 15, dip_real 11, army_levy 8, ind_war 4, sea_battle 3.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 61% tar, 67% dre, 67% tar, 61% tar, 66% tar, 61% tar, 67% tar, 67% dre; economic 85% aur, 88% aur, 93% aur, 89% aur, 86% aur, 87% aur, 93% aur, 100%/42% aur; diplomatic 100%/90% ser, 100%/95% ser, 100%/98% fen, 100%/82% ser, 100%/90% ser, 100%/88% ser, 100%/97% ser, 100%/87% fen.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 0 | 12→13.6 | 100% | 0.4 | 1.1/0.0 | 1% | 29.4 |
| vos | 0 | 11→11.3 | 100% | 0.3 | 0.4/1.3 | 1% | 28.1 |
| ser | 3 | 9→9.0 | 100% | 0.0 | 0.4/0.5 | 8% | 29.4 |
| cal | 2 | 8→8.3 | 100% | 0.1 | 0.3/0.6 | 1% | 29.1 |
| ist | 0 | 8→8.0 | 100% | 0.0 | 1.4/3.0 | 2% | 28.5 |
| dre | 0 | 10→14.4 | 100% | 2.5 | 6.6/2.0 | 2% | 28.1 |
| mor | 0 | 10→9.5 | 100% | 1.4 | 7.3/2.9 | 0% | 28.3 |
| fen | 3 | 7→10.6 | 100% | 0.0 | 0.6/2.9 | 2% | 28.5 |
| tar | 0 | 12→14.4 | 100% | 1.3 | 0.4/6.0 | 0% | 28.1 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ser (diplomatic) | 1905.5 | 3 | 10 | — |
| 2 | normal | fen (diplomatic) | 1911.3 | 5 | 19 | — |
| 3 | normal | ser (diplomatic) | 1914.1 | 8 | 17 | — |
| 4 | normal | cal (diplomatic) | 1911.9 | 5 | 17 | — |
| 5 | normal | ser (diplomatic) | 1911.8 | 5 | 16 | — |
| 6 | normal | fen (diplomatic) | 1927.6 | 7 | 22 | — |
| 7 | normal | cal (diplomatic) | 1908.2 | 5 | 24 | — |
| 8 | normal | fen (diplomatic) | 1911.7 | 9 | 22 | — |
