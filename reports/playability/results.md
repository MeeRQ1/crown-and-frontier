# Playability, balance and control parity: results

`main` at 9be7367 against this branch, measured with the real simulation and a production
build on one machine (4-core Xeon, headless Chromium with software rendering). The diagnosis
that set the work is [`diagnosis.md`](diagnosis.md). Revision 1 is the map `main` ships;
revision 2 is the denser map of this branch. The 40k case was diagnosed on revision 1, so the
comparison with `main` is made on revision 1, and revision 2 is shown beside it.

Every number below comes from a file in this directory, made by the command in its section.
The simulation is deterministic: run again, a simulation command gives the same results.
Timings and browser runs vary from run to run.

## 1. Combat fairness and delegation (release blockers)

**Fairness.** The rules give no side an advantage based on who controls it: the same
combat, reinforcement, morale and attrition code for every realm, and AI skill changes only
decisions (`diagnosis.md`, *Decisive factors*). What lost the 40k case was the planner.

**The 40k concentration.** `npx tsx tools/concentration.ts --setup natural --allies alone|allies --weeks 40 --seeds 1,2,3 [--scenario europe-1936-r1] --out …`
(`concentration-*-before.json` on `main`, `concentration-*-after-r1.json` and
`concentration-*-after.json` on the branch). Europe 1936 as Germany: a year of AI play, then
the player's war on Poland, whose army stands in one concentration of 32–40 regiments.

**Poland alone (100 German regiments against 41)**, 40 weeks, seeds 1–3 (averages; battles summed):

| Workflow | Build and map | Poland taken | German men lost | Polish men lost | Battles won–lost | German provinces lost | Inputs |
|---|---|---|---|---|---|---|---|
| Simple Auto-conquer (3 inputs) | `main`, revision 1 | — (not in `main`) | | | | | |
| Simple Auto-conquer (3 inputs) | branch, revision 1 | 10.7 of 31 (34%) | 6.4k | 5.6k | 8–1 | 0.7 | 3 |
| Simple Auto-conquer (3 inputs) | branch, revision 2 | 10.7 of 42 (25%) | 14.9k | 14.1k | 15–4 | 0.0 | 3 |
| One conquest operation (4 inputs) | `main`, revision 1 | 10.0 of 31 (32%) | 20.6k | 13.4k | 16–8 | 0.7 | 4 |
| One conquest operation (4 inputs) | branch, revision 1 | 12.0 of 31 (39%) | 7.8k | 11.8k | 16–2 | 0.7 | 4 |
| One conquest operation (4 inputs) | branch, revision 2 | 8.7 of 42 (21%) | 13.2k | 10.1k | 12–1 | 0.7 | 4 |
| Each army at the nearest enemy province, every week | `main`, revision 1 | 4.0 of 31 (13%) | 56.0k | 15.1k | 12–24 | 2.3 | 55 |
| Each army at the nearest enemy province, every week | branch, revision 1 | 5.7 of 31 (18%) | 46.4k | 13.4k | 13–11 | 1.3 | 68 |
| Each army at the nearest enemy province, every week | branch, revision 2 | 5.0 of 42 (12%) | 39.7k | 4.6k | 12–6 | 2.7 | 72 |
| Gather, merge and strike the concentration | `main`, revision 1 | 4.7 of 31 (15%) | 45.9k | 15.4k | 12–15 | 4.7 | 85 |
| Gather, merge and strike the concentration | branch, revision 1 | 3.3 of 31 (11%) | 39.3k | 7.1k | 6–9 | 8.7 | 103 |
| Gather, merge and strike the concentration | branch, revision 2 | 2.3 of 42 (6%) | 43.8k | 7.5k | 7–13 | 6.7 | 54 |

**Poland with its allies (Romania joins)**, 40 weeks, seeds 1–3 (averages; battles summed):

| Workflow | Build and map | Poland taken | German men lost | Polish men lost | Battles won–lost | German provinces lost | Inputs |
|---|---|---|---|---|---|---|---|
| Simple Auto-conquer (3 inputs) | `main`, revision 1 | — (not in `main`) | | | | | |
| Simple Auto-conquer (3 inputs) | branch, revision 1 | 5.3 of 31 (17%) | 9.7k | 6.3k | 10–2 | 0.3 | 3 |
| Simple Auto-conquer (3 inputs) | branch, revision 2 | 4.0 of 42 (10%) | 21.0k | 9.3k | 7–7 | 0.7 | 3 |
| One conquest operation (4 inputs) | `main`, revision 1 (2 seeds) | 1.5 of 31 (5%) | 35.5k | 8.2k | 6–8 | 4.0 | 4 |
| One conquest operation (4 inputs) | branch, revision 1 | 7.3 of 31 (24%) | 10.2k | 7.6k | 9–3 | 0.7 | 4 |
| One conquest operation (4 inputs) | branch, revision 2 | 3.0 of 42 (7%) | 20.6k | 3.9k | 3–11 | 0.7 | 4 |
| Each army at the nearest enemy province, every week | `main`, revision 1 (2 seeds) | 0.0 of 31 (0%) | 56.3k | 11.8k | 6–15 | 8.0 | 54 |
| Each army at the nearest enemy province, every week | branch, revision 1 | 5.3 of 31 (17%) | 49.0k | 15.7k | 18–21 | 0.7 | 81 |
| Each army at the nearest enemy province, every week | branch, revision 2 | 3.3 of 42 (8%) | 38.9k | 5.6k | 12–5 | 1.7 | 66 |
| Gather, merge and strike the concentration | `main`, revision 1 (2 seeds) | 0.0 of 31 (0%) | 49.1k | 13.7k | 5–10 | 12.0 | 42 |
| Gather, merge and strike the concentration | branch, revision 1 | 1.7 of 31 (5%) | 50.7k | 12.1k | 12–12 | 6.0 | 76 |
| Gather, merge and strike the concentration | branch, revision 2 | 0.3 of 42 (1%) | 46.9k | 4.7k | 4–18 | 13.3 | 33 |


What changed in the planner (shared by the player's operations, Simple Auto-conquer and the
AI's wars):
- forecasts made with the supply an army will have at the target with the whole force there;
- armies placed where they can be fed;
- a first wave the target can feed;
- routes around declared enemy marches and large field armies;
- the main body and the reserve with the main effort, not spent on empty provinces;
- a target that keeps refusing is set aside;
- aircraft rebase to reach the fighting by default;
- a task force keeps its objective while it still suffices for it. Within each kind of
  target, the force already marching on an objective is planned first, with only its own
  armies; the other objectives then take their pick of the free armies. Before, 26% of
  army-weeks with an objective (33% on revision 2) switched to another one while the old
  objective still stood;
- detachments are sized to stand against an enemy field army loose within a few marches, or
  not sent.

Those last two, measured over six seeds of the natural case
([`planner-seeds.md`](planner-seeds.md)), raise the share of Poland taken from 24.7% to 28.1%
on revision 1 and from 15.6% to 22.7% on revision 2. German losses fall from 12.9k to 10.0k
and from 14.8k to 13.4k.

The scripted "manual" workflows are fixed scripts, not a person: they show what a busy or a
careful player loses without the planner, against an AI that now plans its own war with the
same, better planner.

**A developed campaign with 100 regiments.** `npx tsx tools/qol-demo.ts [--scenario europe-1936-r1] --out …`
(`../qol/demo.json` on `main`, `demo-100-after-r1.json` and `demo-100-after.json`). Europe
1936 as Germany: 100 regiments, fleets and air wings, two land fronts, a landing in France
and an airborne drop, 26 weeks, by hand and delegated.

| Build and map | Control | Inputs | Provinces taken | Provinces lost | German / enemy men lost | Battles won–lost |
|---|---|---|---|---|---|---|
| `main`, revision 1 | by hand | 183 | 16 | 0 | 30.3k / 25.9k | 6–3 |
| `main`, revision 1 | delegated | 29 | 12 | 0 | 11.8k / 6.2k | 1–7 |
| branch, revision 1 | by hand | 261 | 18 | 0 | 15.7k / 21.2k | 12–2 |
| branch, revision 1 | delegated | 29 | 9 | 0 | 5.6k / 2.1k | 1–3 |
| branch, revision 2 | by hand | 199 | 26 | 0 | 32.5k / 26.1k | 7–6 |
| branch, revision 2 | delegated | 28 | 18 | 0 | 10.0k / 17.3k | 13–1 |

## 2. Production orders (§2) and control parity (§3)

`npx tsx tools/play-audit.ts` in the browser, the same developed campaign on `main` and on
the branch (`before/audit.json`, `after/audit.json`, screenshots in `after/`).

| Task (browser, production build) | `main` | Branch |
|---|---|---|
| Ten fighter wings over seven airfields | 13 inputs; 10 in training | 6 inputs; 10 in training |
| Ten torpedo boats over four ports | 12 inputs; 8 laid down, 0 waiting in the order | 6 inputs; 8 laid down, 2 waiting in the order |
| A patrol for four fleets | 12 inputs; 3 patrolling | 3 inputs; 3 patrolling |
| Six wings at different airfields move | 18 inputs; 6 moved | 3 inputs; 6 moved |

Checked in `tests/production.test.ts` (11 tests):
- one order over several places;
- full slipways waited out;
- missing technology, a foreign port and shortage of money;
- cancelling, pausing, a port lost to the enemy;
- the rally point, wings filling an airfield, regiments per place;
- a save half-way through.

Checked in `tests/fleet-orders.test.ts` (13 tests) and `tests/operations-forces.test.ts`
(13 tests): the same one-order-for-all pattern for armies, fleets and wings, and every member
that cannot take an order with the reason.

## 3. Simple Auto-conquer (§4)

`npx tsx tools/autoconquer-audit.ts` in the browser (`after/autoconquer.json`, screenshots
`after/autoconquer-*.png`):
- Activate from the Military ledger with the defaults: 16 members at once, 18 after eight
  weeks (new forces join), 4 provinces taken, no order given by the player;
- pause and resume;
- the opponents and the priority changed in its settings;
- one army kept for direct command, then everything taken over (8 armies back under
  direct command, all kept out of it);
- the Wars ledger offers the same button.

`tests/auto-conquer.test.ts` (12 tests) covers:
- it never starts a war;
- one order takes enemy land;
- kept forces are never taken;
- new forces join;
- it defends against a realm outside the mandate;
- an outmatched army holds the capital;
- peace completes it;
- a finished mandate's forces go to the next one;
- a concentration on one enemy;
- a save;
- a landing organised overseas, and what is missing without transports.

The complete campaign (section 6) found two faults, both fixed and covered by those tests:
1. Outmatched near home, it spread detachments over enemy land and sent its main army deep
   into enemy territory. It now holds a keep until the threat is met.
2. A finished mandate kept absorbing every new army, so the next war's mandate had none.

## 4. AI progression and difficulty (§5)

`npx tsx tools/progression.ts --scenario europe-1936[-r1] --player ger --mode proxy|passive --years 6 --seeds 1`
(`progression-*-before.json` on `main`, `progression-*-final-r1.json` and
`progression-*-final.json`).

**Germany played by the AI**, Europe 1936, Normal, seed 1: regiments at the start / year 3 / year 6 (provinces at year 6)

| Realm | `main` | branch, revision 1 | branch, revision 2 |
|---|---|---|---|
| France | 65 / 215 / 158 (peak 248; 92 provinces) | 65 / 177 / 267 (peak 267; 96 provinces) | 64 / 223 / 190 (peak 236; 136 provinces) |
| Soviet Union | 113 / 203 / 250 (peak 250; 144 provinces) | 113 / 202 / 247 (peak 253; 146 provinces) | 113 / 261 / 242 (peak 318; 208 provinces) |
| Poland | 29 / 92 / 110 (peak 110; 31 provinces) | 29 / 60 / 126 (peak 126; 33 provinces) | 29 / 84 / 64 (peak 84; 42 provinces) |
| Germany | 43 / 107 / 160 (peak 160; 39 provinces) | 43 / 87 / 153 (peak 153; 36 provinces) | 43 / 92 / 139 (peak 139; 51 provinces) |
| Italy | 36 / 91 / 125 (peak 125; 41 provinces) | 36 / 80 / 156 (peak 156; 39 provinces) | 36 / 84 / 105 (peak 114; 55 provinces) |
| Wars in six years | 16 | 18 | 14 |

**Germany passive (a player who does nothing)**, Europe 1936, Normal, seed 1: regiments at the start / year 3 / year 6 (provinces at year 6)

| Realm | `main` | branch, revision 1 | branch, revision 2 |
|---|---|---|---|
| France | 65 / 215 / 152 (peak 254; 92 provinces) | 65 / 151 / 244 (peak 244; 97 provinces) | 64 / 212 / 192 (peak 247; 136 provinces) |
| Soviet Union | 113 / 220 / 253 (peak 253; 146 provinces) | 113 / 264 / 238 (peak 319; 148 provinces) | 113 / 270 / 273 (peak 329; 206 provinces) |
| Poland | 29 / 69 / 100 (peak 100; 32 provinces) | 29 / 64 / 66 (peak 72; 31 provinces) | 29 / 69 / 67 (peak 80; 42 provinces) |
| Germany | 43 / 43 / 43 (peak 43; 36 provinces) | 43 / 43 / 43 (peak 43; 36 provinces) | 43 / 43 / 43 (peak 43; 51 provinces) |
| Italy | 36 / 96 / 153 (peak 153; 40 provinces) | 36 / 97 / 91 (peak 107; 39 provinces) | 36 / 96 / 116 (peak 116; 54 provinces) |
| Wars in six years | 13 | 14 | 9 |


- AI armies still grow to two to three times their size over six years: each realm recruits
  to the budget its income, reserve and food allow, under the player's rules, and the player
  can now match it with production orders instead of one regiment at a time.
- A war no longer ratchets armies up for good: after a war a realm stands down regiments
  beyond its peacetime budget. It shows as dips, not as a lower ceiling. The ten largest
  realms hold 1,043 regiments at year 6 with Germany passive and 1,370 with Germany played
  by the AI, against 1,125 and 1,256 on `main`. With Germany passive, they hold 951 in
  year 5, against 1,133 on `main`.
- No realm runs away with the map: the largest realms end six years with the land they
  started with, give or take a few provinces, on both revisions. The three largest hold the
  same share of development (section 7).
- Each difficulty level says what it changes, and Normal is recommended
  (`tests/ai-demobilise.test.ts`, `tests/ai-decisions.test.ts`).

## 5. Feedback, overview, government, leagues (§6–§10, §12)

- **Battles** say what decided them, from the figures each side fought with: fire,
  regiments engaged and held back, supply, morale, support, defence
  (`tests/battle-reasons.test.ts`). Forecasts show who fights at once. A march through enemy
  troops is warned before it starts. Two more pause choices are offered: an operation needs
  attention, and a defeat.
- **Military overview:** land, sea and air in the same status categories, each count selects
  its forces, and one *Needs attention* list gives the order that answers each problem
  (`after/military-overview.png`).
- **Government** (`tests/government.test.ts`, 12 tests):
  - forms of government by scenario and date;
  - the cost of a change, the 10-year wait, and no communism before 1917;
  - one accounting path: the totals the rules use are the sum of the sources shown, for
    every realm, and changing government replaces its effects instead of stacking them;
  - heads of government, with elections and replacement;
  - commanders, assigned per force or per operation, changing battles through the same
    figures;
  - Austria-Hungary formable on the 1936 map only;
  - the trade minister buying within the budget and price limits, never touching a
    contract signed by hand.
- **Offensive leagues** (`tests/leagues.test.ts`, 7 tests):
  - an alliance and good relations make a realm eligible, but do not make it accept;
  - the player must answer explicitly;
  - a member's deliberate war brings every bound member in, once;
  - a member the rules forbid to join says why;
  - joining never enrols a realm in a war already under way;
  - a broken alliance suspends the league, and leaving keeps the wars already joined;
  - a save.

## 6. A complete campaign in the browser (§13)

`npx tsx tools/campaign-web.ts --dist dist --years 25` (`after/campaign.json`,
`after/campaign-end.png`). The Reach as Fenward, 25 years, Normal, from the main menu to the
end screen through the real controls:
- New campaign, map, realm, length, Begin; the clock at the fastest speed;
- Simple Auto-conquer from the Military ledger whenever a war is under way;
- Export to file and Import file half-way, and the campaign plays on from the imported copy;
- at the end, the end screen's *Export save*, loaded again in Node, and every invariant
  checked.

The other decisions are a plain player's, through the interface's command call:
- war on a weaker neighbour, counting the allies the declaration screen lists;
- a yearly production order;
- peace accepted unless it costs land (or once half our land is occupied);
- alliances and trade accepted.

| | |
|---|---|
| Reached | week 924 (17.8 years), the end screen "Defeat": Kingdom of Aurel achieved Economic Prosperity. Fenward held 2 of its 7 provinces |
| Wars declared by the player | 0 |
| Auto-conquer activations | 2 |
| Production orders | 8 |
| Proposals answered | 23 |
| Half-way export and import | week 208, 208 KB; the campaign played on from the imported copy |
| Final save | exported by Export save on the end screen; it loads (yes); invariant failures: 0 |
| Frames at the fastest speed | 9228 frames, p50 16.6 ms, p95 29.1 ms, worst 93.1 ms |
| Page errors | 0 |
| Wall time | 177 s |

<details><summary>The campaign, year by year</summary>

- year 0: 7 provinces, 7 regiments, 151 crowns
- year 1: 7 provinces, 11 regiments, 126 crowns
- wk 78: accepted trade from dre
- year 2: 7 provinces, 11 regiments, 304 crowns
- wk 104: accepted trade from mor
- wk 130: accepted trade from aur
- year 3: 7 provinces, 15 regiments, 318 crowns
- wk 156: accepted trade from tar
- wk 182: accepted trade from ser
- wk 182: declined contract from tar
- year 4: 7 provinces, 19 regiments, 306 crowns
- wk 208: declined contract from aur
- wk 208: exported, imported, continuing
- year 5: 7 provinces, 23 regiments, 201 crowns
- wk 286: declined contract from aur
- year 6: 7 provinces, 27 regiments, 86 crowns
- wk 312: declined contract from tar
- year 7: 7 provinces, 27 regiments, 113 crowns
- wk 364: accepted trade from ist
- wk 390: declined contract from tar
- year 8: 7 provinces, 27 regiments, 85 crowns
- wk 416: declined contract from aur
- year 9: 7 provinces, 27 regiments, 19 crowns
- wk 483: Auto-conquer against mor
- wk 494: declined contract from aur
- wk 502: declined contract from ist
- year 10: 7 provinces, 22 regiments, -15 crowns
- wk 520: declined contract from ist
- wk 546: accepted settlement from mor
- year 11: 5 provinces, 10 regiments, -11 crowns
- wk 598: declined contract from ist
- year 12: 5 provinces, 0 regiments, -13 crowns
- wk 624: Auto-conquer against dre
- wk 624: declined contract from aur
- year 13: 2 provinces, 0 regiments, 82 crowns
- wk 702: declined contract from aur
- year 14: 2 provinces, 0 regiments, 146 crowns
- wk 728: declined contract from tar
- year 15: 2 provinces, 0 regiments, 281 crowns
- wk 806: declined contract from ist
- year 16: 2 provinces, 4 regiments, 302 crowns
- wk 832: declined contract from aur
- year 17: 2 provinces, 8 regiments, 273 crowns
- wk 910: declined contract from aur

</details>

What happened:
- Fenward is the smallest realm in its corner of the Reach. Counting the allies the
  declaration screen lists, it never found a neighbour weak enough to attack.
- Morvaine attacked it in year 9. Auto-conquer took two of Morvaine's provinces. Once the
  enemy near our land outweighed us (strength 37 against 27), it held the capital and lost
  them again. The script accepted a settlement when half its land was occupied, and lost
  two provinces.
- The script's yearly orders had grown the army beyond what the treasury could keep: the
  treasury was negative from year 10, and the army was gone by year 12. The mandate
  against Drevenholt that year had no forces ("No armies are assigned"), and Fenward lost
  three more provinces when that war ended eight weeks later.
- Aurel won on economic prosperity at 17.8 years.

A player who keeps the budget in order would fare better. The run shows that the whole flow
works from the menu to the end screen, not how well a script plays.

## 7. Denser maps (§11)

[`docs/atlas/MAPS.md`](../../docs/atlas/MAPS.md#revision-2-denser-historical-maps-format-9)
has the counts, what was added, the conservation of wealth, the room to build, the step
lengths and the abstractions; [`maps/`](maps/) has the measurements.

| Map | Development growth in 8 years, revision 1 (seeds 1 / 2) | Revision 2 | Great powers' income at year 8, r1 → r2 | Their factories, r1 → r2 | Top three realms' share of development, r1 → r2 | Wars begun, r1 → r2 |
|---|---|---|---|---|---|---|
| Europe, 1914 | +43 / 42% | +47 / 42% | 4947 / 4761 → 5304 / 5188 | 595 / 623 → 659 / 645 | 0.48 / 0.49 → 0.47 / 0.46 | 13 / 19 → 16 / 17 |
| Europe, 1936 | +47 / 46% | +53 / 51% | 4150 / 4559 → 4376 / 4440 | 350 / 352 → 347 / 354 | 0.38 / 0.38 → 0.36 / 0.38 | 19 / 25 → 23 / 17 |
| The World, 1914 | +76 / 73% | +84 / 82% | 6451 / 6272 → 6671 / 6313 | 641 / 689 → 568 / 568 | 0.36 / 0.35 → 0.35 / 0.35 | 31 / 31 → 29 / 28 |

## 8. Saves

- Formats 1–8 are converted to format 9 when loaded, each with a notice (`tests/format7.test.ts`,
  `tests/saves-maps.test.ts`).
- `tests/map-revisions.test.ts` loads a real save made by the `main` build:
  - it is Europe 1914 revision 1, format 8, 26 weeks in, with a ship on the slipways;
  - it continues on the retained revision 1, with a notice;
  - every province, realm, army and treasury is as saved;
  - it plays on identically whether saved and reloaded half-way or not.
- Without the retained revision, such a save is refused with the reason; it is never
  attached to the new provinces.
- In the browser, the complete campaign's half-way export and import, and its final export
  loaded in Node with every invariant holding (section 6).

## 9. Performance

All on one 4-core Xeon virtual machine, nothing else running. Run to run, the machine
varies by about a tenth.

**Simulation** (`npx tsx tools/bench.ts --scenario <map> --seeds 1-3 --years 3`; ms per week, the
average of three seeds' averages, AI only, from the start;
[`maps/bench-*.json`](maps/)). The budget at the fastest speed is about 166 ms a week.

| Map | `main` | Branch, revision 1 | Branch, revision 2 | p99, revision 2 |
|---|---|---|---|---|
| Europe, 1914 | 43.0 | 42.8 | 48.8 | 97 |
| Europe, 1936 | 54.8 | 59.5 | 83.9 | 192 |
| The World, 1914 | 149.8 | 134.6 | 156.7 | 298 |
| The World, 1936 | 196.7 | 162.6 | 193.5 | 357 |

- Revision 2 costs 14–19% more a week than revision 1 on three maps, and 41% more on
  Europe 1936.
- Profiled over two years of Europe 1936 (`node --cpu-prof`), the AI takes two thirds of the
  week:
  - strategic decisions 40%, diplomacy's treaty motives 10% of it;
  - operational 28%, war planning 16% (the ground planner 12%).
- No function takes more than 4% on its own: the extra cost is planning over 40% more
  provinces and objectives, not one slow step.
- Weeks are planned in slices across frames, so a dear week slows the clock, not the screen.

**Browser** (production build, headless Chromium with software rendering, 1366×768;
[`maps/web-maps.md`](maps/web-maps.md), [`maps/web-stress.md`](maps/web-stress.md), `main`
with its own build and tool: [`maps/web-main.md`](maps/web-main.md),
[`maps/web-main-earth.md`](maps/web-main-earth.md)).

| | `main` | Branch, revision 1 | Branch, revision 2 |
|---|---|---|---|
| Fastest speed for 6 s at the start, Europe 1914 (target 36 weeks) | — | 33 | 36 |
| The same, Europe 1936 | — | 36 | 35 |
| The same, the World 1914 | 35 (frame p95 32 ms) | 32 (p95 35 ms) | 27 (p95 52 ms) |
| A world war, the World 1914, week 280: 12 weeks in slices at the fastest speed | 3.0 weeks/s, p95 41 ms (5 wars, 280 armies) | 3.1, p95 39 ms (3 wars, 177 armies) | 2.5, p95 52 ms (5 wars, 179 armies) |
| The same, the World 1936 | 1.4 weeks/s, p95 46 ms (10 wars, 271 armies) | 2.1, p95 40 ms (6 wars, 214 armies) | 2.0, p95 44 ms (7 wars, 225 armies) |
| Finding the province, and the forces, under the pointer | | 0.33–0.62 µs, 0.13–1.14 µs | 0.25–0.66 µs, 0.16–1.11 µs |

- Drawing the same view at the same zoom (over France's capital) costs the same on Europe
  and up to a quarter more on the World at medium zoom ([`maps/web-maps-same-view.md`](maps/web-maps-same-view.md)).
  At the World's default medium zoom, revision 2 draws in 43 ms against 24–26 ms.
- Frames stay under 55 ms at the 95th percentile on every map, at the fastest speed and in
  a world war. The lag of the earliest releases, a whole week in one frame (400–600 ms here),
  is not back.
- The World 1914 on revision 2 is the slowest case: 27 weeks in the first 6 seconds, against
  35 on `main`.
- Memory, the World 1914 after two years (`node --expose-gc`): 19.3 MB retained on
  revision 2, 16.6 MB on revision 1. The browser's JS heap without forced collection reads
  193 MB against 93 MB; that is uncollected garbage, not retained state.
- The complete campaign (the Reach, 17.8 years at the fastest speed) ran at frame p50
  16.6 ms and p95 29.1 ms.

Found by profiling the redrawn maps and fixed (commit 65954d3):
- administration is worked out once a month per realm, not per province;
- blockades are counted from the realm's own coasts;
- the trade estimate is skipped where it cannot change an envoy's choice.

`npm run verify:web` passes 97 of 97 checks. Its performance probe on Aldmere, the default
campaign, which this update did not redraw, wants an average map draw under 16 ms. On this
machine that is within run-to-run variation:
- the branch measured 19.7 ms, then 16.0 ms;
- `main`'s own build measured 18.7 ms in the same session, and failed it.

Benchmarked side by side on Aldmere, the branch draws in 20.6 ms at medium zoom against
`main`'s 22.6, and simulates 36 weeks in 6 seconds against 35
([`maps/web-aldmere-branch.md`](maps/web-aldmere-branch.md),
[`maps/web-aldmere-main.md`](maps/web-aldmere-main.md)).
