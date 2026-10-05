# AI-only campaign report

Map: aldmere. Runs: 16 (seeds 1–16, difficulties normal, 60-year limit). Node v22.22.2.

Winners: mor 6, les 3, sol 3, fen 3, aur 1
Victory paths: score 7, economic 3, diplomatic 6
Average campaign length: 48.5 years; wars per campaign 20.5; average war 11.3 months; peace treaties 38.3; forced peaces 0.0; battles 118.
Coalitions formed per campaign: 3.8; coalition wars: 15.4.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 34.30 ms/tick average, 2361 ms worst tick, heap ≈ 81 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 9.8% of all income on average (highest single realm 43.7%); check: at most 30%.
- Realms with a trade agreement: 99.5% of realm-months.
- Industry at the end: 224 of 224 surviving realms ran factories in their last month; factories 512 → 10897 (sum over runs).
- Average treasury at year 40: 3.15× monthly income; check: below 5×.
- Research: the average surviving realm finished 37.9% of the tree; 4632 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 67.5%, cavalry 11.3%, artillery 18.0%, engineers 2.7%, armour 0.5%.
- Shortages (share of realm-months): coal 19.4%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 208 of 208 surviving coastal realms built ships; 192 of the 192 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): ist ×10, fen ×3, ser ×3.
- Air: 174 of 174 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 405.3, naval battle sides 216.0, landings 9.8, blockade weeks 1320.4, fleet weeks at sea 10207.5, wings built 79.0, wing-weeks on missions 54110.4, bombing wing-weeks 151.1.
- Peace settlements per run: 18.8 (57 of 300 shared among several winners); demands won: cede 320, renounce 234, gold 183, reparations 106, sphere 9, disarm 6.
- Guarantees given per run 8.6 (70 of 224 realms gave one), honoured by joining a war 4 times; loans per run 6.4 (39 lenders, 2865 crowns lent per run).
- Trade blocs: 224 of 224 realms were members (89.7% of realm-months); spheres: 82 realms led one, and realms spent 8.1% of realm-months in another's sphere.
- National focus: 35.4 focuses completed per surviving realm (17% national); 224 of 224 completed national focuses, 224 a claim, 219 their ambition. First generic focuses by branch: army 333, diplomacy 169, industry 115, state 51, sea 4. Doctrines: sea_raid 173, army_prof 163, dip_concord 140, army_fortress 130, ind_consumer 126, army_offensive 85, ind_war 79, dip_real 78, army_levy 54, sea_battle 27.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 69% aur, 65% tar, 65% tar, 65% tar, 65% tar, 65% tar, 67% tar, 67% tar, 63% tar, 67% tar, 67% tar, 67% tar, 65% tar, 65% tar, 63% tar, 67% tar; economic 96% mor, 100%/85% les, 95% mor, 96% mor, 97% mor, 100%/83% les, 97% les, 100%/97% mor, 100%/85% les, 97% mor, 92% les, 97% mor, 99% mor, 97% aur, 96% mor, 92% les; diplomatic 100%/97% ser, 100%/72% ser, 100%/82% fen, 100%/95% ser, 100%/92% ser, 100%/92% ser, 100%/92% ser, 100%/73% fen, 100%/55% ser, 100%/92% fen, 100%/83% ser, 100%/83% ser, 100%/87% fen, 100%/93% ser, 100%/87% ser, 100%/80% ser.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 1 | 25→30.4 | 100% | 3.0 | 13.1/6.0 | 4% | 30.6 |
| vos | 0 | 20→20.3 | 100% | 0.6 | 11.3/19.5 | 26% | 25.1 |
| ser | 0 | 20→19.5 | 100% | 0.0 | 4.5/4.5 | 39% | 29.3 |
| cal | 0 | 16→16.5 | 100% | 0.0 | 3.6/4.7 | 17% | 30.2 |
| ist | 0 | 17→16.9 | 100% | 0.0 | 0.0/0.6 | 16% | 27.4 |
| dre | 0 | 21→24.4 | 100% | 5.4 | 23.9/9.3 | 11% | 26.9 |
| mor | 6 | 25→37.3 | 100% | 7.6 | 28.6/15.3 | 14% | 31.8 |
| fen | 3 | 12→16.0 | 100% | 0.0 | 1.4/2.9 | 39% | 24.6 |
| tar | 0 | 30→35.3 | 100% | 0.2 | 7.9/11.6 | 21% | 28.7 |
| car | 0 | 13→13.4 | 100% | 0.1 | 0.9/2.5 | 12% | 25.3 |
| hra | 0 | 14→10.1 | 100% | 0.0 | 6.4/24.1 | 13% | 21.8 |
| sol | 3 | 12→11.3 | 100% | 0.0 | 0.8/5.1 | 55% | 26.0 |
| les | 3 | 24→28.4 | 100% | 2.1 | 6.8/4.8 | 21% | 31.9 |
| ash | 0 | 15→18.1 | 100% | 1.4 | 9.4/6.6 | 35% | 28.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | mor (score) | 1940.1 | 22 | 148 | — |
| 10 | normal | les (economic) | 1898.8 | 11 | 51 | — |
| 11 | normal | les (score) | 1940.1 | 35 | 230 | — |
| 12 | normal | sol (diplomatic) | 1931.3 | 21 | 114 | — |
| 13 | normal | mor (score) | 1940.1 | 21 | 147 | — |
| 14 | normal | fen (diplomatic) | 1907.4 | 13 | 55 | — |
| 15 | normal | fen (diplomatic) | 1929.4 | 17 | 87 | — |
| 16 | normal | mor (economic) | 1918.2 | 20 | 71 | — |
| 2 | normal | les (economic) | 1900.8 | 11 | 56 | — |
| 3 | normal | mor (score) | 1940.1 | 14 | 67 | — |
| 4 | normal | mor (score) | 1940.1 | 24 | 151 | — |
| 5 | normal | fen (diplomatic) | 1921.8 | 27 | 149 | — |
| 6 | normal | mor (score) | 1940.1 | 24 | 159 | — |
| 7 | normal | sol (diplomatic) | 1939.3 | 25 | 135 | — |
| 8 | normal | sol (diplomatic) | 1927.7 | 28 | 192 | — |
| 9 | normal | aur (score) | 1940.1 | 15 | 82 | — |
