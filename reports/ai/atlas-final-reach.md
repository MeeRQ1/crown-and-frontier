# AI-only campaign report

Map: reach. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: aur 3, dre 4, mor 1
Victory paths: economic 4, score 3, diplomatic 1
Average campaign length: 42.9 years; wars per campaign 11.3; average war 7.6 months; peace treaties 16.8; forced peaces 0.0; battles 44.
Coalitions formed per campaign: 1.9; coalition wars: 2.3.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 3.64 ms/tick average, 79 ms worst tick, heap ≈ 74 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 8.7% of all income on average (highest single realm 26.2%); check: at most 30%.
- Realms with a trade agreement: 99.8% of realm-months.
- Industry at the end: 72 of 72 surviving realms ran factories in their last month; factories 144 → 1842 (sum over runs).
- Average treasury at year 40: 4.73× monthly income; check: below 5×.
- Research: the average surviving realm finished 53.1% of the tree; 1136 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 65.6%, cavalry 12.5%, artillery 16.2%, engineers 5.4%, armour 0.3%.
- Shortages (share of realm-months): coal 23.9%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 59 of 59 surviving coastal realms built ships; 47 of the 49 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: aur ×1, vos ×1); check: all. Never at war with a coastal realm while coastal (built only): vos ×4, fen ×3, aur ×1, ser ×1, tar ×1.
- Air: 71 of 71 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 108.6, naval battle sides 54.5, landings 1.4, blockade weeks 281.5, fleet weeks at sea 7280.8, wings built 47.3, wing-weeks on missions 35793.3, bombing wing-weeks 15.5.
- Peace settlements per run: 10.3 (15 of 82 shared among several winners); demands won: cede 85, renounce 56, gold 50, reparations 30, sphere 4, disarm 2.
- Guarantees given per run 7.5 (35 of 72 realms gave one), honoured by joining a war 4 times; loans per run 8.6 (23 lenders, 1991 crowns lent per run).
- Trade contracts: 1066.1 signed per run (72 of 72 realms signed at least one); realms held one in 83.4% of realm-months, 1.17 contracts in force per realm-month; per run 1046.9 ran their term, 0.1 ended in default, 1.6 were cancelled; 8507 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 4.1% of army-months at war (1.1% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 0 of 90 ended (0%); idle treasuries (over 10 months of income with a builder free) 2.7% of realm-months.
- Trade blocs: 72 of 72 realms were members (84.0% of realm-months); spheres: 26 realms led one, and realms spent 9.4% of realm-months in another's sphere.
- National focus: 36.8 focuses completed per surviving realm (16% national); 72 of 72 completed national focuses, 72 a claim, 72 their ambition. First generic focuses by branch: army 80, diplomacy 56, industry 45, state 25, sea 10. Doctrines: army_prof 61, sea_raid 57, ind_consumer 47, dip_concord 40, army_offensive 36, army_fortress 33, dip_real 31, ind_war 25, army_levy 9, sea_battle 2.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 67% aur, 67% dre, 67% tar, 61% tar, 66% tar, 67% tar, 61% tar, 67% dre; economic 100%/92% aur, 100%/97% dre, 100%/85% dre, 98% aur, 86% aur, 100%/95% dre, 95% aur, 97% dre; diplomatic 100%/37% ser, 100%/33% ser, 100%/72% ser, 100%/53% ser, 100%/5% ser, 100%/8% ser, 100%/87% cal, 100%/50% ser.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 3 | 12→14.5 | 100% | 1.5 | 4.0/0.3 | 0% | 41.5 |
| vos | 0 | 11→11.8 | 100% | 0.1 | 0.3/0.6 | 7% | 38.8 |
| ser | 0 | 9→8.6 | 100% | 0.0 | 1.6/1.8 | 4% | 39.0 |
| cal | 0 | 8→8.3 | 100% | 0.1 | 1.8/2.1 | 6% | 40.4 |
| ist | 0 | 8→7.9 | 100% | 0.1 | 2.6/7.9 | 8% | 38.3 |
| dre | 4 | 10→16.0 | 100% | 4.6 | 12.6/9.5 | 2% | 38.6 |
| mor | 1 | 10→8.1 | 100% | 2.1 | 13.6/8.8 | 2% | 37.1 |
| fen | 0 | 7→10.9 | 100% | 0.1 | 1.4/1.5 | 10% | 38.1 |
| tar | 0 | 12→13.0 | 100% | 2.5 | 6.5/11.3 | 0% | 37.3 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | aur (economic) | 1934.4 | 13 | 44 | — |
| 2 | normal | dre (economic) | 1924.2 | 11 | 50 | — |
| 3 | normal | dre (economic) | 1931.8 | 14 | 39 | — |
| 4 | normal | aur (score) | 1945.1 | 7 | 17 | — |
| 5 | normal | aur (score) | 1945.1 | 9 | 59 | — |
| 6 | normal | dre (economic) | 1936.3 | 16 | 78 | — |
| 7 | normal | mor (diplomatic) | 1941.7 | 7 | 25 | — |
| 8 | normal | dre (score) | 1945.1 | 13 | 43 | — |
