# Military control, combined warfare, national scale and adaptive AI: verification

The audit of `main` (b479032) and the plan are in [`control-audit.md`](control-audit.md); the
rules are in [`DESIGN.md`](../../DESIGN.md). Everything below was measured on this branch and,
where a comparison is made, on `main` built and run the same way on the same machine.

## Control workflows in the browser

`tools/audit-control.ts` plays the same campaign (`tools/sea-air-save.ts`: Serrata at war with
Aurelian) on a production build at 1366 × 768 and records each input and what the inspector
shows. `tools/touch-control.ts` does the touch flows on a phone (390 × 844, touch only: taps
and long-presses through the DevTools protocol). Screenshots and step tables:
[`before/`](../../docs/screenshots/control/before/) (main),
[`after/`](../../docs/screenshots/control/after/),
[`touch/`](../../docs/screenshots/control/touch/). No page errors in any run.

| Task | `main` | This branch |
|---|---|---|
| Find and select a wing on the map | impossible: the wing counter selects nothing; open the airfield's province card, then the wing (2 inputs) | click its counter (1); again for the next wing there; own counters drawn at every zoom |
| Rebase a wing | scroll the card to a list of base names (no map) | the airfields and carriers it can move to are ringed on the map; right-click one, or pick it in the card's Base section |
| Send a wing to support a battle | select, scroll to "Fly ground support…", click the province (3–4 after finding it) | select, right-click the battle, choose "Ground support over …" (3); the menu lists every mission that fits, with range and reasons |
| Several wings at a base | each wing alone | "All N fly …" on the wing card: one map pick for all; a wing that cannot says why |
| Give a fleet an operation | none: Sail, Merge, Pay off | right-click a place: sail, patrol, blockade, raid, shell a coast, return to port, escort or join a fleet, land troops (3 inputs); the order, its effect and how to end it on the card |
| Ship an army overseas | from the army only, if a fleet with room lies off its coast | also from the fleet: "Embark …" lists the armies on its coast, then click the beach (3); the army card names the fleet that can carry it, or at sea when it lands and the threats on the route |
| Airborne operation | none | select the airborne army at an airfield, "Airborne drop", point at the target (tooltip: losses expected from fighters and anti-aircraft fire, the troops waiting), click, review, Launch (4); Call off until it is flown |
| Touch | long-press marched an army; wings could not be selected | long-press opens the same order menu; tap a counter to select; the targeting banner's Cancel sits above the toasts |

## Fleet orders, air, airborne and anti-aircraft: scenario tests

All through the weekly tick on the small test maps:

- `tests/fleet-orders.test.ts` (13): every order's reasons (transports alone, no raiders, no
  guns, troops aboard, no route, not ours); a patrol sails one zone at a time and stays; manual
  sailing and halting end an order; an escort follows its fleet and its order lapses with a note
  when that fleet is gone; return to port repairs ×1.5 in harbour; a beaten fleet is sent to port;
  a blockade order closes waters three cruisers against two could not close on station; raid
  orders take more trade and held raiders none; a patrol protects trade ×1.5; shelling under
  orders hits only its province, on station the largest battle; naval guns speed a coastal siege
  (capped) and the fort fires back; orders survive a save.
- `tests/airborne-aa.test.ts` (10): the drop's preconditions with their reasons (technology,
  airborne only, at an airfield, a ready transport per regiment, range, transports already
  committed); the army waits and can be called off; dropped on undefended enemy land it takes the
  province by siege (the only way aircraft take ground); fighters over the target and
  anti-aircraft guns take their share, capped at half; landing on enemy troops it fights at 70%
  that week (named in the battle); a drop whose airfield falls first is called off with the
  reason; a pending drop survives a save; batteries and mobile guns add to a cap of 4; without
  Air Defence artillery has no anti-aircraft fire; anti-aircraft fire cuts bombing by 8% a level
  and costs bombers strength; batteries need the technology, stop at level 3 and cost upkeep.
- `tests/combined-warfare.test.ts` (4): the coastal campaign below; a captured port re-homes
  the fleets based there; captured batteries are wrecked; forts fire on ships blockading their
  coast (not on raiders standing off, and never twice in a week).

### A coastal campaign by land, air, sea and all together

8 infantry and 2 artillery attack 7 infantry and a battery dug in behind a level-1 fort in a
coastal province next door; averaged over six seeds (`COMBINED_EVIDENCE=… npx vitest run
tests/combined-warfare.test.ts`):

| Arms | Weeks to take the port | Attacker men lost | Defender men lost |
|---|---|---|---|
| Ground only | 12.8 | 1,936 | 1,656 |
| + air (2 ground attack on support, a fighter over it) | 12.0 | 1,567 | 2,013 |
| + navy (a battleship and a cruiser ordered to shell it) | 10.0 | 1,617 | 1,766 |
| Coordinated (both) | 9.0 | 1,261 | 1,660 |

Aircraft win the battle more cheaply but do not shorten the siege; the guns offshore shorten the
siege; together they take it four weeks sooner for two thirds of the losses.

## Adaptive AI

### The reported case: a realm that has lost half its land

`tools/half-country.ts` (World 1936, the player as Italy; Italian armies hold half of
Yugoslavia, which keeps two regiments and cannot retake it), 24 weeks with the player
answering nothing, on `main` and on this branch: [`half-country-before.md`](half-country-before.md),
[`half-country-after.md`](half-country-after.md).

- **`main`:** white peace at week 5 and again at week 17; nothing else, ever.
- **Now:** at week 1 Yugoslavia offers the four occupied provinces it cannot retake; refused
  (unanswered), it adds a fifth at week 5, then 59 crowns at week 9; then it holds out rather
  than repeat an offer already refused. Each decision is logged with the assessment (40% of its
  land held by the enemy, field strength 1 against 42, a 14–19% chance to retake, standing −61)
  and the options it rejected.

`tests/ai-decisions.test.ts` (13) covers the assessment, conceding when the land cannot be
retaken, fighting on when it can, a refused concession never repeated, a winning AI offering
the player a settlement, a winner pressing on and logging why, stalemate white peace,
personalities asking for different terms, alliances proposed for a stated reason that the
player sees, pacts to keep a border quiet, the recipient weighing an alliance's obligations, a
refused proposal not repeated within the realm's patience, and envoys kept within means.

### AI-only campaigns (six years, seed 2; `tools/ai-behaviour.ts`)

| | World 1936, `main` | World 1936, now | Europe 1936, `main` | Europe 1936, now |
|---|---|---|---|---|
| Wars; ended | 37; 33 | 35; 31 | 18; 18 | 17; 16 |
| Settlements dictated by a winner (agreed) | 30 | 23 | 18 | 10 |
| Settlements judged refused by the loser | not counted | 8 | not counted | 3 |
| **Concessions offered by a losing realm and agreed** | **0** | **8** | **0** | **6** |
| Concessions judged refused (raised next time) | 0 | 7 | 0 | 3 |
| White peace agreed | 4 | 0 | 0 | 0 |
| White peace judged refused | 18 | 16 | 26 | 4 |
| Decisions logged: fighting on / pressing on / holding out | not logged | 29 / 50 / 1 | not logged | 18 / 39 / 0 |
| Treaty proposals: trade; pact; alliance | 2253; 114; 40 | 1502; 136; 39 | 455; 45; 16 | 443; 60; 12 |
| Sounded out and found unwelcome (pact; alliance) | — | 111; 84 | — | 60; 16 |
| Treaties standing at the end: trade; pact; alliance | 2224; 66; 62 | 1472; 80; 57 | 440; 29; 33 | 433; 39; 29 |
| Alliances left | 0 | 2 | 0 | 0 |

On `main` no losing realm ever conceded anything in these twelve campaign-years; its white peace
offers were refused 44 times. Now losing realms concede land that cannot be retaken (14 such
peaces agreed), refused concessions come back larger, realms fight on while lost land can be
retaken and say so, and white peace is asked for only by a realm with nothing left to give.
Trade proposals fall by a third on the World (commerce is no longer free money); the files are
`ai-before-*.json` and `ai-after-*.json` here.

## National scale

`tools/national-scale.ts` (World 1936, seed 1; [`national-scale.md`](national-scale.md)). On
`main`, 19 of 69 realms started with no men to call up or in deficit, Albania had 36,000
people and a reserve of 1,152 men against a minimum army of 3,000, and small realms earned
more from flat commerce than from their land (`control-audit.md`).

### At the start

| Realm | People | Fit for service | Serving | Pool | Regiments | Gross income | Spending | Balance |
|---|---|---|---|---|---|---|---|---|
| Kingdom of Albania | 360k | 29k | 3k | 13k | 3 | 9.6 | 6.2 | +3.4 |
| Republic of Latvia | 520k | 42k | 3k | 19k | 3 | 12.3 | 6.4 | +5.9 |
| Portuguese Republic | 4.15M | 209k | 9k | 100k | 9 | 33.9 | 18.4 | +15.5 |
| Kingdom of Yugoslavia | 3.51M | 281k | 10k | 135k | 10 | 40.9 | 20.5 | +20.4 |
| Kingdom of Italy | 7.55M | 561k | 20k | 270k | 20 | 77.7 | 39.1 | +38.6 |
| German Reich | 11.65M | 932k | 30k | 451k | 30 | 130.1 | 54.1 | +76.0 |
| United Kingdom | 46.85M | 1.89M | 67k | 914k | 67 | 288.4 | 114.8 | +173.6 |

Realms in deficit: 0 of 69; with no men to call up: 0.

### After 3 years of AI play

| Realm | People | Fit for service | Serving | Pool | Regiments | Gross income | Spending | Balance |
|---|---|---|---|---|---|---|---|---|
| Kingdom of Albania | 388k | 31k | 4k | 27k | 4 | 16.8 | 10.5 | +6.2 |
| lat | (gone) | | | | | | | |
| Portuguese Republic | 4.44M | 333k | 19k | 314k | 18 | 90.5 | 53.3 | +37.3 |
| Kingdom of Yugoslavia | 3.74M | 299k | 19k | 280k | 19 | 67.6 | 46.7 | +21.0 |
| Kingdom of Italy | 8.02M | 641k | 56k | 584k | 54 | 133.8 | 110.9 | +22.9 |
| German Reich | 12.27M | 856k | 77k | 777k | 72 | 149.2 | 134.9 | +14.3 |
| United Kingdom | 50.02M | 2.45M | 110k | 2.32M | 109 | 542.2 | 316.5 | +225.7 |

Realms in deficit: 0 of 68; with no men to call up: 0.


Latvia is gone after three years: Poland conquered it (its war goal, Riga, the capital, now
ends the war by settlement at week 102 instead of the war running on). Population is in people;
5% are fit for service at full integration; the pool refills at 1/60 of the reserve a month;
the war dead stay missing from the reserve and recover at 1% a month. Income scales with land
and trade from Albania's 10 to Britain's 288 crowns a month at the start, and every realm
starts in balance.

## Saves

- A format-6 campaign converts to format 7 with every treasury, pool, stockpile and force as it
  was, no war dead charged retroactively, fleets on station, no batteries and no drops, and the
  notice (`tests/format7.test.ts`); it then plays on with the invariants intact.
- The older fixtures (formats 1–5) still convert through every step (`tests/saves-maps.test.ts`).

## Performance

Simulation, `tools/bench-naval-air.ts`, 48 weeks after a warm-up week, `main` and this branch
alternated on the same saves (week 280 of the 1936 maps, made by the baseline; this branch
converts them to format 7). Mean / 95th percentile ms per week:

| Workload | `main` (two runs) | This branch | Note |
|---|---|---|---|
| World 1936, week 280 | 291 / 472, 330 / 526 | 319 / 502 | 2,053 regiments on average against 1,540: the larger reserve fields a third more |
| World 1936, naval and air stress (333 wings, 85 fleets) | 276 / 483, 266 / 410 | 288 / 437 | |
| Europe 1936, week 280 | 50 / 87, 52 / 91 | 68 / 115 | a war under way most weeks (1.1 on average against 0.2: realms no longer settle for white peace at once) and 16% more regiments |

`tools/workload-size.ts` measures what each save turns into on each build. The first run of this
branch measured the World 1936 week at 630 ms: judging a trade agreement summed a realm's whole
commerce for every pair of realms every month. A realm's raw commerce is now worked out once a
week, a treaty motive once a week per pair and never for a treaty already signed.

The map, `tools/profile-web.ts` on the same machine, headless Chromium without a GPU
([`control-web-before.md`](../perf/control-web-before.md), [`control-web-after.md`](../perf/control-web-after.md)):

| World 1936, week 280 | `main`: frame p50 / p95, script ms/s | This branch |
|---|---|---|
| paused, dragging | 16.7 / 16.8, 181 | 16.7 / 16.8, 178 |
| paused, 12 clicks | 16.7 / 33.4, 79 | 16.7 / 33.3, 66 |
| fastest speed | 16.7 / 50, 850 | 16.7 / 50, 875 |
| naval and air stress, dragging | 16.7 / 16.8, 316 | 16.7 / 16.8, 314 |
| naval and air stress, fastest speed | 16.7 / 50, 851 | 16.7 / 50, 856 |

## Checks and browsers

- `npm run typecheck`, `npm test` (28 files, 323 tests), `npm run build`, `npm run package`: pass.
- `npm run verify:web` on the final build: **96 of 97** at the site root, the project subpath,
  the unpacked release ZIP and in an iframe ([`reports/web-verification.md`](../web-verification.md)).
  The one failure is the performance probe (average map draw under 16 ms at the fastest speed,
  headless Chromium with software rendering): 30.1 ms in this run, 16.6 ms in the run before it
  on the same build family; the previous update measured `main` at 16.5–30.5 ms on this machine.
  The controlled comparison above (`tools/profile-web.ts`, both builds, same machine, same
  workloads) shows no difference in drawing cost.
- An earlier full check found new campaigns pausing in their first week (an AI trade proposal
  to the player); fixed: a human gets three quiet months.

Untested: Firefox, Safari and real phones and tablets (the touch run emulates a phone in
Chromium); screen readers.
