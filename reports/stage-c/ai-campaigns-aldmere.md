# AI-only campaign report

Map: aldmere. Runs: 10 (seeds 1–10, difficulties normal, 60-year limit). Node v22.22.2.

Winners: mor 3, les 6, sol 1
Victory paths: economic 4, score 5, diplomatic 1
Average campaign length: 48.8 years; wars per campaign 40.7; average war 11.3 months; peace treaties 68.0; forced peaces 0.0; battles 212.
Coalitions formed per campaign: 5.7; coalition wars: 19.8.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.20.
Performance: 13.88 ms/tick average, 138 ms worst tick, heap ≈ 80 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 12.3% of all income on average (highest single realm 81.4%); check: at most 30%.
- Realms with a trade agreement: 99.5% of realm-months.
- Industry at the end: 139 of 140 surviving realms ran factories in their last month; factories 320 → 5103 (sum over runs); without industry: dre (1 provinces).
- Average treasury at year 40: 2.63× monthly income; check: below 5×.
- Research: the average surviving realm finished 30.7% of the tree; 2160 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 66.1%, cavalry 12.9%, artillery 17.8%, engineers 2.9%, armour 0.3%.
- Shortages (share of realm-months): coal 13.7%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 129 of 129 surviving coastal realms built ships; 127 of the 128 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: vos ×1); check: all. Never at war with a coastal realm while coastal (built only): ist ×1.
- Air: 97 of 97 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 330.2, naval battle sides 297.1, landings 16.8, blockade weeks 1837.5, fleet weeks at sea 11655.0, wings built 66.6, wing-weeks on missions 38531.6, bombing wing-weeks 207.8.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 0 | 25→33.5 | 100% | 6.6 | 15.0/11.7 | 31% | 24.8 |
| vos | 0 | 20→21.5 | 100% | 4.9 | 16.2/10.5 | 36% | 21.6 |
| ser | 0 | 20→20.2 | 100% | 0.1 | 1.9/1.5 | 78% | 24.7 |
| cal | 0 | 16→17.5 | 100% | 1.0 | 6.1/5.2 | 41% | 25.3 |
| ist | 0 | 17→17.6 | 100% | 0.1 | 1.8/0.8 | 71% | 23.0 |
| dre | 0 | 21→10.5 | 100% | 3.2 | 25.3/31.7 | 28% | 18.5 |
| mor | 3 | 25→46.8 | 100% | 13.5 | 61.7/49.6 | 17% | 24.0 |
| fen | 0 | 12→8.8 | 100% | 0.0 | 10.6/22.1 | 17% | 18.5 |
| tar | 0 | 30→33.2 | 100% | 1.7 | 23.3/20.3 | 12% | 23.6 |
| car | 0 | 13→13.7 | 100% | 0.0 | 5.9/6.4 | 36% | 20.8 |
| hra | 0 | 14→10.2 | 100% | 2.0 | 7.2/14.0 | 40% | 18.6 |
| sol | 1 | 12→12.0 | 100% | 0.0 | 1.3/3.9 | 65% | 21.7 |
| les | 6 | 24→35.4 | 100% | 7.3 | 22.1/11.5 | 30% | 26.1 |
| ash | 0 | 15→17.1 | 100% | 0.3 | 13.7/17.3 | 9% | 22.8 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | mor (economic) | 1934.8 | 59 | 261 | — |
| 10 | normal | les (economic) | 1903.1 | 24 | 80 | — |
| 2 | normal | mor (score) | 1940.1 | 48 | 303 | — |
| 3 | normal | les (score) | 1940.1 | 22 | 192 | — |
| 4 | normal | mor (score) | 1940.1 | 54 | 264 | — |
| 5 | normal | les (score) | 1940.1 | 60 | 268 | — |
| 6 | normal | les (economic) | 1902.3 | 25 | 148 | — |
| 7 | normal | les (score) | 1940.1 | 46 | 140 | — |
| 8 | normal | les (economic) | 1910.6 | 33 | 176 | — |
| 9 | normal | sol (diplomatic) | 1936.7 | 36 | 289 | — |
