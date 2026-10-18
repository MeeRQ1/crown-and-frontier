# Playability diagnosis (before the corrective update)

`main` at 9be7367 (after the quality-of-life update, save format 8).

## Evidence

All of it was produced with the real simulation and a production build:

| Evidence | What it covers |
|---|---|
| `tools/concentration.ts` | The 40k-concentration investigation |
| `tools/progression.ts` | AI strength over six years |
| `tools/play-audit.ts` | Production and branch control in the browser |
| `reports/tmp` | Probes (not committed) |

No player save was available. The 40k case is therefore a **representative scenario**, labelled as such. It is built from an ordinary campaign:

1. Europe 1936 as Germany.
2. The first year is played by the AI for every realm, so Germany builds up as a computer would.
3. Germany becomes the player's, with 100 regiments.
4. Germany declares war on Poland.

After a year Poland keeps its army in one concentration of **33 to 40 regiments (about 40,000 men)**, as the report describes. The "alone" variant sets Poland's alliances aside, so Germany (100 regiments against 41) is the stronger military.

## The 40k concentration: what decides it

Three workflows were run for 40 weeks from the same seeds:

- **Delegated:** one conquest operation over Poland with every army and wing, at default settings.
- **Greedy:** each week every idle army marches to the nearest enemy-held province.
- **Massed:** gather at one border province, merge, and strike the concentration together.

| Seed | Workflow | Polish provinces taken (of 31) | German land lost | German men lost | Polish men lost | Battles won / lost |
|---|---|---|---|---|---|---|
| 1 | delegated | 13 | 0 | 13.1k | 12.2k | 4 / 3 |
| 1 | greedy | 1 | 3 | 55.2k | 16.2k | 1 / 8 |
| 1 | massed | 1 | 9 | 47.0k | 16.2k | 4 / 3 |
| 2 | delegated | 2 | 2 | 35.8k | 8.5k | 3 / 3 |
| 2 | greedy | 1 | 4 | 53.8k | 12.0k | 6 / 9 |
| 2 | massed | 6 | 4 | 42.8k | 7.9k | 1 / 5 |
| 3 | delegated | 15 | 0 | 13.0k | 19.5k | 9 / 2 |
| 3 | greedy | 10 | 0 | 59.1k | 17.0k | 5 / 7 |
| 3 | massed | 7 | 1 | 48.0k | 22.1k | 7 / 7 |

When France and Romania keep their alliances, every workflow takes **0 to 3** Polish provinces and loses up to 12 German ones.

### Battle traces (seed 1)

| Battle | Forces | Supply and morale | Forecast | Result |
|---|---|---|---|---|
| Delegated, wk 2, North Warsaw | 2 German regiments ran into the 33-regiment concentration | — | — | — |
| Delegated, wk 6, Inowrocław | 22 regiments against 20 | "strained" | "likely defeat" | Lost, 5.5k men to 2.7k |
| Greedy, wk 6, Inowrocław | 75 regiments against 33 | Germans **unsupplied** (75 regiments in one enemy province overloads it) | — | Lost, 15k men to 5.7k |
| Greedy, wk 22 | 87 regiments | Unsupplied, morale **0.02** | — | — |

### Decisive factors, measured in controlled simulations

These use the combat code with no randomness, on open plains with no fort.

| Factor | Effect |
|---|---|
| **Frontage** | At most 16 line regiments and 8 supporting ones fight each round on plains (fewer on rough ground). A side's extra regiments only slow its morale loss. |
| **Entrenchment** | Dug in for four weeks, 33 supplied defenders beat **66** supplied attackers. It takes about **99** (3:1) to win. Without entrenchment 48 win. |
| **Supply at the target** | A province feeds about 2.5 × its capacity before strain. Foreign land counts 0.75 of capacity, so a plains province takes about 30 attacking regiments. 66 attackers at 0.3 supply lose even against an undug defender. |
| **Means to break a dug-in stack** | 66 attackers with 6 armour (breakthrough), or with +30% air support, beat 33 dug in. 33 with 6 armour and air support also win. |
| **Morale** | Poland's maximum morale is 3.7 against Germany's 3.5 (a national trait, shown in the realm's modifiers). |

The rules give no side an advantage based on who controls it:

- AI skill (difficulty) changes only decisions.
- The only built-in bonus is the optional, disclosed AI income assistance (default none).
- Reinforcement, morale recovery and attrition follow the same code for everyone.

Reinforcement needs friendly ground and supply, so an attacker in enemy land is never replaced.

### What the planner did wrong (delegated, from the operation's own task notes)

1. **It ignored where enemy armies were going.** A 2-regiment detachment was routed through North Warsaw the week the concentration was marching there (its route is public). Safe routing avoided only provinces where enemy troops *stood*.
2. **It sent detachments that were too small, too deep.** Four 2-regiment detachments went for undefended provinces 3–4 marches inside Poland while a 33-regiment field army was loose. Exposure looked only one province around the target.
3. **It used its main force as an occupier.** The 38-regiment 1st Army was sent to occupy an empty province because it was nearest.
4. **It parked the reserve far behind.** The reserve (23 regiments) waited at the base, 3–4 marches from the fighting.
5. **Its forecasts used the wrong supply.** The forecast gate used each army's *current* supply (at home), not the supply it would have at the target with the whole group there. Strikes went in, came out "strained", and lost.
6. **It never used its aircraft.** Ground-attack and fighter wings were out of range all war ("allow rebasing, or move it yourself"), because rebasing is off by default.
7. **It could not decide.** With most armies resting it reported "Cannot make progress (9 armies resting)" with no plan.

## AI progression (Europe 1936, six years, Normal, seed 1)

`tools/progression.ts` played the campaign twice:

- **Proxy:** the player's Germany is run by the same AI.
- **Passive:** the player does nothing.

| Realm | Start | Year 3 | Year 6 |
|---|---|---|---|
| France | 95 provinces, 65 regiments | 95, 215 | 92, 158 (250 at the peak) |
| Soviet Union | 146, 113 | 146, 203 | 144, 250 |
| Poland | 31, 29 | 31, 92 | 31, 100–110 |
| Germany (AI, proxy) | 36, 43 | 38, 107 | 39, 160 |
| Germany (passive human) | 36, 43 | 36, 43 | 36, 43 |

- **Land does not run away.** The three largest realms hold 41% of the map throughout, and conquests are small.
- **Armies run away.** Every AI realm triples its army in three to four years, at peace. It recruits up to its target (income share, three quarters of the reserve, food) up to twice a week on Normal, under the player's rules, and keeps the regiments in 40-regiment concentrations.
- **The human has to match it by hand.** One recruitment, slipway and airfield at a time, so the AI's "advantage" is diligence the interface makes expensive.
- **No AI realm attacked the passive player in six years.** The alarm-based coalitions (against any aggressor) did not form.
- **The difficulty choice says nothing about its effects.** The description shown under AI skill was only its label.

## Interface (browser, production build, developed campaign)

| Task | Inputs on `main` | Notes |
|---|---|---|
| Ten fighter wings | 13 | Seven airfields, opened one by one |
| Ten torpedo boats | 12, and only **8** laid down | All slipways then full. The rest must be ordered again each time a slipway frees, weeks later. |
| A patrol for several fleets | 3 per fleet | No group order for fleets |
| A mission or a move for wings at different airfields | 3 per wing | Group orders exist only for wings at the same airfield |

The selection card offers group orders (march, merge) only for armies. Fleets and wings in a selection can only be put into an operation.

## Ranked friction list

| # | Kind | Friction | Impact |
|---|---|---|---|
| 1 | Ineffective delegation | The conquest planner walks small detachments into enemy concentrations, ignores declared enemy movement, sizes strikes on the wrong supply, idles its reserve far behind and leaves aircraft out of range | Release blocker. Delegation loses to a concentration it outnumbers 2.4:1. |
| 2 | Unclear rules | Frontage, entrenchment, supply at the target, morale and the means to break a dug-in stack are not visible before a commitment. Battle reports list modifiers but not what decided the result. | The player cannot see why 75 lost to 33 or what would have won |
| 3 | Missing bulk actions | Ships and wings are ordered one at a time, a slipway or airfield at a time, with no standing order when capacity frees | Repetitive work for every navy and air force |
| 4 | Ineffective delegation | No simple war mandate. An operation needs an area, and there is no homeland defence, no response when the war ends and no automatic air rebasing. | Delegation needs configuration before it helps |
| 5 | Inconsistent controls | Group orders exist for armies only. Fleets and wings must be ordered one by one or put into an operation. | Navy and air control does not follow the ground pattern |
| 6 | Interface | A manual march takes the shortest route through enemy-held land and enemy armies without warning | The greedy and massed scripts walked into the concentration, as a busy player would |
| 7 | Balance and pacing | AI armies triple at peace, and the human must match the recruiting by hand. The difficulty text does not say what differs. | "The AI becomes overwhelming at some point" |
| 8 | Interface | Forces, production queues, damaged units and blocked operations are spread over province cards, the Military ledger and fleet and wing cards | No single place to see what the armed forces are doing |
