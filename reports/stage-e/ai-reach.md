# AI-only campaign report

Map: reach. Runs: 16 (seeds 1–16, difficulties normal, 40-year limit). Node v22.22.2.

Winners: fen 5, tar 1, aur 6, ser 2, cal 1, dre 1
Victory paths: diplomatic 8, score 6, economic 2
Average campaign length: 33.3 years; wars per campaign 13.1; average war 7.2 months; peace treaties 20.0; forced peaces 0.0; battles 44.
Coalitions formed per campaign: 1.9; coalition wars: 6.4.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.13.
Performance: 15.12 ms/tick average, 338 ms worst tick, heap ≈ 52 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 12.0% of all income on average (highest single realm 63.5%); check: at most 30%.
- Realms with a trade agreement: 99.7% of realm-months.
- Industry at the end: 144 of 144 surviving realms ran factories in their last month; factories 288 → 3356 (sum over runs).
- Average treasury at year 40: 5.04× monthly income; check: below 5×.
- Research: the average surviving realm finished 47.0% of the tree; 1633 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 64.3%, cavalry 14.1%, artillery 16.0%, engineers 5.5%, armour 0.0%.
- Shortages (share of realm-months): coal 17.5%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 117 of 117 surviving coastal realms built ships; 107 of the 112 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: aur ×3, vos ×2); check: all. Never at war with a coastal realm while coastal (built only): mor ×2, ser ×2, cal ×1.
- Air: 119 of 119 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 108.2, naval battle sides 56.0, landings 2.8, blockade weeks 301.1, fleet weeks at sea 5523.3, wings built 43.3, wing-weeks on missions 21767.6, bombing wing-weeks 56.4.
- Peace settlements per run: 12.6 (41 of 201 shared among several winners); demands won: cede 188, gold 149, renounce 115, reparations 87, sphere 9, disarm 4.
- Guarantees given per run 7.7 (66 of 144 realms gave one), honoured by joining a war 11 times; loans per run 10.2 (54 lenders, 1702 crowns lent per run).
- Trade blocs: 144 of 144 realms were members (82.3% of realm-months); spheres: 44 realms led one, and realms spent 8.5% of realm-months in another's sphere.
- National focus: 34.0 focuses completed per surviving realm (18% national); 144 of 144 completed national focuses, 144 a claim, 141 their ambition. First generic focuses by branch: army 179, diplomacy 109, industry 86, state 40, sea 18. Doctrines: sea_raid 109, army_prof 108, ind_consumer 80, dip_concord 75, army_fortress 71, army_offensive 65, dip_real 57, ind_war 46, army_levy 27, sea_battle 4.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 67% tar, 67% dre, 67% tar, 67% dre, 67% dre, 67% dre, 67% dre, 67% tar, 67% tar, 67% tar, 67% dre, 67% tar, 67% dre, 67% tar, 67% tar, 67% dre; economic 100%/40% aur, 100%/43% aur, 96% aur, 100%/98% aur, 100%/82% aur, 100%/52% aur, 99% aur, 99% aur, 100%/88% aur, 94% aur, 100%/85% aur, 100%/17% aur, 97% aur, 94% dre, 93% aur, 100%/88% aur; diplomatic 100%/82% ser, 100%/93% ser, 100%/78% ser, 100%/75% ser, 100%/88% ser, 100%/68% ser, 100%/72% ser, 100%/95% fen, 100%/92% ser, 100%/87% ser, 100%/80% ser, 100%/88% ser, 100%/97% ser, 100%/83% ser, 100%/85% ser, 100%/80% ser.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 6 | 12→14.1 | 100% | 2.0 | 8.1/1.5 | 4% | 36.1 |
| vos | 0 | 11→11.9 | 100% | 0.9 | 1.7/1.9 | 9% | 34.1 |
| ser | 2 | 9→8.6 | 100% | 0.0 | 0.9/2.8 | 28% | 35.3 |
| cal | 1 | 8→8.2 | 100% | 0.3 | 1.7/1.9 | 2% | 35.7 |
| ist | 0 | 8→7.3 | 100% | 0.0 | 0.9/7.3 | 2% | 33.8 |
| dre | 1 | 10→16.5 | 100% | 5.2 | 12.3/4.5 | 4% | 34.2 |
| mor | 0 | 10→8.1 | 100% | 1.9 | 8.7/9.3 | 2% | 32.8 |
| fen | 5 | 7→8.9 | 100% | 0.1 | 1.3/5.3 | 19% | 33.4 |
| tar | 1 | 12→15.4 | 100% | 2.6 | 8.7/8.3 | 3% | 33.6 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | fen (diplomatic) | 1925.9 | 13 | 30 | — |
| 10 | normal | fen (diplomatic) | 1933.7 | 12 | 61 | — |
| 11 | normal | tar (score) | 1935.1 | 16 | 61 | — |
| 12 | normal | aur (economic) | 1912.1 | 8 | 39 | — |
| 13 | normal | ser (diplomatic) | 1931.6 | 13 | 43 | — |
| 14 | normal | aur (score) | 1935.1 | 17 | 65 | — |
| 15 | normal | aur (score) | 1935.1 | 11 | 31 | — |
| 16 | normal | ser (diplomatic) | 1926.3 | 13 | 50 | — |
| 2 | normal | fen (diplomatic) | 1918.4 | 10 | 19 | — |
| 3 | normal | cal (diplomatic) | 1925.8 | 14 | 46 | — |
| 4 | normal | aur (economic) | 1916.8 | 13 | 36 | — |
| 5 | normal | fen (diplomatic) | 1926.6 | 7 | 18 | — |
| 6 | normal | aur (score) | 1935.1 | 13 | 38 | — |
| 7 | normal | fen (diplomatic) | 1925.8 | 18 | 37 | — |
| 8 | normal | dre (score) | 1935.1 | 12 | 46 | — |
| 9 | normal | aur (score) | 1935.1 | 19 | 87 | — |
