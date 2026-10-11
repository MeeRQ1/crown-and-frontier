# AI-only campaign report

Map: reach. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: fen 5, cal 1, aur 2
Victory paths: diplomatic 6, economic 1, score 1
Average campaign length: 35.4 years; wars per campaign 13.9; average war 6.5 months; peace treaties 19.8; forced peaces 0.0; battles 43.
Coalitions formed per campaign: 1.6; coalition wars: 3.8.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.25.
Performance: 7.28 ms/tick average, 61 ms worst tick, heap ≈ 47 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 11.9% of all income on average (highest single realm 48.3%); check: at most 30%.
- Realms with a trade agreement: 99.7% of realm-months.
- Industry at the end: 72 of 72 surviving realms ran factories in their last month; factories 144 → 1707 (sum over runs).
- Average treasury at year 40: 4.82× monthly income; check: below 5×.
- Research: the average surviving realm finished 48.4% of the tree; 888 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 64.6%, cavalry 13.5%, artillery 16.2%, engineers 5.5%, armour 0.1%.
- Shortages (share of realm-months): coal 17.4%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 57 of 57 surviving coastal realms built ships; 53 of the 56 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: aur ×2, vos ×1); check: all. Never at war with a coastal realm while coastal (built only): ser ×1.
- Air: 57 of 57 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 105.3, naval battle sides 44.4, landings 2.5, blockade weeks 260.6, fleet weeks at sea 5227.5, wings built 41.0, wing-weeks on missions 25402.9, bombing wing-weeks 38.5.
- Peace settlements per run: 13.5 (20 of 108 shared among several winners); demands won: cede 97, gold 71, renounce 68, reparations 43, sphere 4, disarm 2.
- Guarantees given per run 7.8 (33 of 72 realms gave one), honoured by joining a war 9 times; loans per run 13.8 (30 lenders, 2654 crowns lent per run).
- Trade contracts: 0.0 signed per run (0 of 72 realms signed at least one); realms held one in 0.0% of realm-months, 0.00 contracts in force per realm-month; per run 0.0 ran their term, 0.0 ended in default, 0.0 were cancelled; 0 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 4.9% of army-months at war; pointless wars (no land and no demand changed hands) 1 of 111 ended (1%); idle treasuries (over 10 months of income with a builder free) 1.9% of realm-months.
- Trade blocs: 72 of 72 realms were members (83.1% of realm-months); spheres: 24 realms led one, and realms spent 6.9% of realm-months in another's sphere.
- National focus: 33.5 focuses completed per surviving realm (18% national); 72 of 72 completed national focuses, 72 a claim, 70 their ambition. First generic focuses by branch: army 85, diplomacy 54, industry 48, state 21, sea 8. Doctrines: army_prof 54, sea_raid 51, ind_consumer 37, dip_concord 37, army_fortress 33, army_offensive 33, dip_real 28, ind_war 23, army_levy 13, sea_battle 5.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 67% tar, 61% tar, 67% tar, 67% dre, 67% tar, 67% dre, 67% tar, 67% tar; economic 100%/62% aur, 100%/65% aur, 94% aur, 100%/85% aur, 100%/17% aur, 97% dre, 94% dre, 93% aur; diplomatic 100%/92% ser, 100%/93% ser, 100%/87% ser, 100%/80% ser, 100%/88% ser, 100%/93% ser, 100%/83% ser, 100%/78% ser.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 2 | 12→14.3 | 100% | 2.1 | 7.3/0.5 | 1% | 37.9 |
| vos | 0 | 11→11.9 | 100% | 1.1 | 2.0/2.1 | 1% | 35.0 |
| ser | 0 | 9→8.8 | 100% | 0.0 | 0.8/2.6 | 34% | 36.3 |
| cal | 1 | 8→8.1 | 100% | 0.5 | 2.0/1.9 | 2% | 36.8 |
| ist | 0 | 8→7.0 | 100% | 0.0 | 0.8/7.4 | 2% | 34.5 |
| dre | 0 | 10→16.0 | 100% | 4.8 | 12.4/5.0 | 3% | 35.0 |
| mor | 0 | 10→7.1 | 100% | 1.9 | 8.8/10.3 | 2% | 33.0 |
| fen | 5 | 7→10.1 | 100% | 0.1 | 0.8/3.6 | 22% | 34.9 |
| tar | 0 | 12→15.8 | 100% | 3.4 | 8.5/7.6 | 2% | 34.8 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | fen (diplomatic) | 1942.4 | 18 | 69 | — |
| 2 | normal | fen (diplomatic) | 1918.3 | 9 | 24 | — |
| 3 | normal | cal (diplomatic) | 1925.8 | 14 | 46 | — |
| 4 | normal | aur (economic) | 1916.8 | 13 | 36 | — |
| 5 | normal | fen (diplomatic) | 1926.6 | 7 | 18 | — |
| 6 | normal | fen (diplomatic) | 1942.3 | 18 | 62 | — |
| 7 | normal | fen (diplomatic) | 1925.8 | 18 | 37 | — |
| 8 | normal | aur (score) | 1945.1 | 14 | 53 | — |
