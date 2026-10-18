# Quality of life and operational command: verification

Every measurement here was taken on one machine (a cloud container, headless Chromium,
software rendering) against `main` at cd38b4f and this branch. The audit and plan
are in [audit.md](audit.md); raw results are next to this file.

| Tool | What it runs | Output |
|---|---|---|
| `tools/qol-scenario.ts` | The large-force campaign. Europe 1936 as Germany with 13 armies (110 regiments), 3 fleets and 8 wings, at war with Poland, Romania and France beside Italy. Eight neutral neighbours. Saved in format 8 and, for `main`, format 7. | `reports/tmp/qol-large*.json` (not committed) |
| `tools/qol-audit.ts --phase before/after` | In the production build with real pointer and key input: the unit-view census at three zooms, railways and recruits in ten provinces, ordering the 13 armies, and touch at tablet and phone sizes. | [before/](before/), [after/](after/) |
| `tools/qol-gestures.ts` | Checks that selection gestures do nothing else, then uses batches and manual orders while an operation is paused and being changed. | [gestures.json](gestures.json) |
| `tools/qol-demo.ts` | The 100-regiment campaign for 26 weeks, played by a manual script and by operations. | [demo.json](demo.json) |
| `tools/war-ai.ts` | The opposing AI at war: 40 weeks, seeds 1–4, on two maps. Run on `main` and on the branch. | [war-ai-before.json](war-ai-before.json), [war-ai-after.json](war-ai-after.json) |
| `tools/qol-frames.ts` | Frame times, long tasks and click-to-frame times at the fastest speed. | [perf/](perf/) |
| `npm run check` | Typecheck, unit and scenario tests, production build, release ZIP, and `verify:web`. `verify:web` covers the site root, the project subpath, the unpacked ZIP, an iframe, layouts, touch and saves. | `reports/web-verification.md` |

## The 100-regiment demonstration (`tools/qol-demo.ts`, seed 3, 26 weeks)

This is the same campaign played twice from the same save:

- **Manual:** a script stands in for a diligent player. Every week it orders each idle army to the weakest enemy province within reach, and then reorders after captures and losses.
- **Delegated:** four operations were created once:
  - **East:** conquer the Polish border land, with 70 regiments, 5 wings, leave to rebase and a one-drop airborne mandate.
  - **West:** hold the French border, with 36 regiments and 1 wing.
  - **Baltic:** keep the seas, with 2 fleets.
  - **Landing:** land at Caen, with 4 regiments and a transport fleet.

  During the run the player stepped in several times:
  - week 6: ordered 3rd Army home (manual override), then resumed it at week 9;
  - weeks 10–12: paused and resumed West;
  - week 13: saved and loaded;
  - week 14: switched East to aggressive.

| | Manual | Delegated |
|---|---|---|
| Player inputs | 183 | **29** |
| Orders given by operations | — | 289 |
| Enemy provinces taken | 16 | 12 |
| Provinces lost | 0 | 0 |
| German men lost | 30,285 | **11,765** |
| Enemy men lost | 25,863 | 6,169 |
| Battles won / lost | 6 / 3 | 1 / 7 |
| Regiments at the end | 110 | 110 |
| Operations planning, ms per week (mean / max) | — | 6.6 / 19.7 |
| Simulated week, ms (mean / max) | 64.5 / 141 | 58.9 / 105.6 |
| Invariant failures | 0 | 0 |

What happened in each operation:

**East**
- Took 10 provinces, including Warsaw, Białystok, Grodno and East Poznań.
- Made one airborne drop under the mandate, and the mandate then ended.
- Detached 7 task forces (6 still separate at the end), merged 4 times, and regrouped idle armies at Warsaw.
- Final tasks: 3 reserve, 4 stage, 3 occupy, 2 wait, 1 recover, 2 rest, 2 cover, 1 interdict.

**West**
- Held its 5 provinces, losing 208 men.
- While paused, its members kept their orders and took new ones only from the player. Resume worked.

**Baltic**
- Patrolled its two zones.

**Landing**
- Sailed with an escort and landed at Caen in week 1, then took it in week 2.
- It lost Caen to counterattacks in weeks 10 and 20, and retook it in week 17. It lost 4,644 men in all.

**Save and load**
- Loaded the week-13 save and played 4 weeks twice from it. Both runs gave identical states, with all 4 operations in the save.

**Reading the outcome honestly.** Delegation cut the player's inputs by 84% and German losses by 61%. But it took 4 fewer provinces than the manual script, inflicted about a quarter of its enemy losses, and won 1 of its 8 battles against 6 of 9. The planner attacks only where the forecast gate allows, so it fought fewer, smaller battles. The ones it lost include the counterattacks that took Caen back twice. The manual script is greedy, not skilled, so it is a burden baseline, not a measure of good play.

## Interaction burden, before and after (`tools/qol-audit.ts`, production build, 1366×768)

| Task | `main` | This branch |
|---|---|---|
| Railways in 10 provinces | 15 inputs. 5 queued, then the slots ran out, shown only as disabled buttons. | **11 inputs**: 10 Ctrl+clicks and 1 confirm. 5 queued. The preview lists the other 5 as "no construction slot left". |
| A regiment in each of 10 provinces | 20 inputs | **13 inputs** for the same 10 regiments. A Ctrl+drag box with "Only ours" raised 32 regiments in 32 provinces in **4 inputs**. |
| Order all 13 armies once | 26 inputs, repeated after every capture and every lost battle | **4 inputs, once**: Shift+drag, New operation, "Enemy land within reach", Activate. After one week, 16 armies (with detachments) were marching or fighting. |
| Touch: select 3 forces and 3 provinces | not possible | 3 of 3 and 3 of 3 at tablet (1024×768) and phone (390×844) sizes, with no horizontal overflow. |

**Gesture safety** (`tools/qol-gestures.ts`). For each gesture below, the test compared the command log, construction projects, recruits, army routes and treasury before and after. Each showed **no change**:
- Ctrl+click on 10 provinces;
- Ctrl+drag over 55 provinces;
- Shift+drag over our forces (20) and a Shift+click;
- the Select tool with X, by drag for forces and by click for provinces.

Then, with an operation **paused from its card and changed through its editor**:
- Ctrl+click on three provinces brought up the batch card above the operation card;
- a **double click** on Confirm sent **one** request and queued 3 projects;
- Esc returned to the operation's card;
- a right-click march for one of its armies was obeyed at once, and the army was taken under direct command but stayed a member;
- Resume from the card worked.

That run found two defects, both fixed on this branch:
- **The batch card was hidden under an open operation card.** Esc already treated the province selection as the top layer; the inspector now does too.
- **A double click sent the batch request twice.** The second request queued nothing, but it was logged.

## Unit-view filters: the census (markers drawn for the 13 German armies' theatre)

`main` versus this branch, at near, regional and far zoom. Every relation is counted, in the same scenario: our side, the enemies at war, an ally (Italy), and 8 neutrals.

| View | `main` | This branch |
|---|---|---|
| Mine + enemies | **Enemy armies: 0** at every zoom (an inverted test). Enemy wings dropped at regional and far zoom. | Enemy armies 5 / 6 / 6, enemy fleets 2 / 3 / 3, enemy wings 2 / 2 / 2. No neutral or allied force. |
| Relevant | **14 neutral fleets drawn at near zoom.** Enemy wings dropped at far zoom. The ally depended on the zoom. | Neutrals 0 at every zoom. Allies follow the setting at every zoom (on by default). Enemy wings 2 at every zoom. |
| All | Neutral fleets (0) and every foreign wing dropped at regional and far zoom | Neutral fleets 22 and foreign wings 2 at regional and far zoom. Fleets are grouped by zone and realm at a distance, so ours read as 2 markers there. |

The same rule (`src/ui/map/visibility.ts`) drives several places:
- the markers;
- the province card's "Armies here" and the sea zone's fleets;
- box selection;
- the hidden-count note under "Forces shown".

`tests/unit-view.test.ts` covers peace, observers, allies, fleets and focus (7 tests).

## Opposing wartime AI (`tools/war-ai.ts`, 40 weeks, seeds 1–4)

`main` and the branch were run from the same starting positions. The tool counts idle armies only while their realm is at war. The audit's first table used an earlier version that counted peace too, so its idle figures differ.

| Measure | Europe, `main` | Europe, branch | Aldmere, `main` | Aldmere, branch |
|---|---|---|---|---|
| Attacks / lost | 66 / 25 | 50 / 26 | 81 / 35 | 20 / 13 |
| Failed attack repeated on the same province within 8 weeks | 11 | **1** | 7 | **0** |
| Idle share (fit army-weeks at war) | 4–5% | 8–10% (reserves count as idle) | 0% | 1–2% |
| Re-targets of unfinished objectives per army-month | 0.31–0.40 | 0.20–0.33 | 1.24–1.37 | **0.21–0.38** |
| Provinces held at the end that the other side held at the start (per seed, both sides) | 1, 1, 1, 2 | 2, 9, 6, 14 | 1, 1, 2, 3 | 2, 2, 1, 5 |
| Men lost, side 0 / side 1 (sum of seeds) | 69k / 95k | 59k / 71k | 81k / 82k | 14k / 34k |
| AI operational planning, ms per week | 29–44 | 42–52 | 8.6–10 | 9.6–10.7 |

The AI now:
- commits to objectives;
- remembers failed attacks;
- routes recovering armies around enemy stacks;
- regroups armies too small to fight;
- keeps reserves by personality and commits them to battles a forecast says they can win.

It attacks less often and much less repetitively, with fewer losses on both sides. In Europe the Polish, Romanian and French side ended holding 31 German or Italian provinces across the four seeds, against 5 on `main`. Germany and Italy held none of theirs at the end, either way.

The **share of attacks lost rose** (Europe 38% → 52%, Aldmere 43% → 65%). The planner now attacks only where it means to stay, and holds back elsewhere, so there are fewer easy attacks in the count. This is reported, not hidden.

Reasons are written to the AI's decision trace, for example:
- "Attack on X failed: not again for a while, and then only stronger";
- "X left alone: an attack failed 3 weeks ago…";
- the target of each army.

The same seed replays the same war (`tests/ai-war.test.ts`).

## Exercises named in the brief

**Coverage key:** "browser" means a production build driven by Playwright. "sim" means the campaign tools above, using the real rules. "test" means `tests/*.test.ts`.

| Exercise | Where | Result |
|---|---|---|
| Ground conquest against resistance; defence against counterattacks | sim (demo); test: `auto-conquest`, "turns to defend our own province", the reserve | East took 10 defended provinces including Warsaw. West held. The conquest switched to defending its own border province, and the reserve was committed to a losing battle. The Caen beachhead was lost twice to counterattacks (see limits). |
| Coordinated air and naval support | sim; test: aircraft and fleets under an operation; browser: tasks after one week | Fighters keep the sky, ground attack supports the main effort, and warships shell the coast where our army fights. In the browser run: 1 support and 2 bombard tasks. |
| Protected transport and an overseas landing | sim (Caen); test: "a landing" (3) | The force gathers, is escorted, sails, lands, takes the beach and continues as a conquest. Missing transports or room are reported. A beach taken by land ends the landing cleanly. |
| Multiple operations competing for forces and capacity | sim (4 operations); test: release / assign | A unit belongs to at most one operation, and assigning moves it. Rebasing uses only airfields with room. Ships are not moved between fleets (see limits). |
| Supply problems, blocked routes, damaged forces, lost bases | test: supply limit, safe routes, wings rest, fleets repair, defend the base | No attack beyond supply when the limit is on (with the decision asked). Marches go around enemy stacks. Wings rest below 35% readiness, and fleets repair below 50% hull. A raid on our land next to the area is answered. |
| Mixed manual and delegated control; immediate override | browser (gestures); sim (demo week 6); test: manual control (4) | Any order to a member takes it under direct command at once. Resume, or "rejoin when done", hands it back. |
| Edit, pause, resume, cancel, complete | browser (gestures); sim; test | Pausing stops new orders. Cancelling hands every member back with its last orders. Completion follows the chosen rule. |
| Peace; save and load of active and paused operations | test: peace, save; sim: week-13 save | Peace ends the conquest, since nothing is left at war. Saves continue identically, with held members still held. |
| Autonomous engagements without per-battle commands | sim | 289 orders from operations against 29 player inputs |
| Splitting and regrouping | test (4); sim | Whole regiments only, at least 2 per detachment, at most 6 detachments, and men and regiment ids conserved. "Keep together" and "no leave to reorganise" are respected. Idle armies merge. Reorganised forces survive a save, and a split by hand stays under direct command. |
| Opposing AI against counterattacks, several fronts, lost supply and combined threats | sim (war-ai); test: ai-war (5) | Covered in the AI section above. Reasons are recorded in the decision trace. |
| Unit-view filters across relations, zoom, peace and loading | browser census; test: unit-view (7) | Covered in the filter section above. The census was taken after loading a save, and peace is covered by a test. |
| Delegated airborne: mandate, missing transport, defended target, delay or cancellation, intervention | test: airborne (5); sim (one drop in East) | No mandate means no drop. "Once" means one drop with the operation's own transports, after which the mandate ends. A target beyond the loss limit is refused with the reason. With no transports in the operation there is no drop, the reason is given, and our other transports are never taken. An order to the paratroopers stops the drop until they are resumed. |
| Province multi-selection and batches through the real controls | browser (audit, gestures) | As tabled above |
| Batch eligibility, per-province versus total, shared pools, mixed ownership, existing queues, partial affordability, changes before confirmation, repeated clicks, touch | test: batch (7); browser | All covered. Repeated clicks are covered by both the double-click test and a repeated request. Touch is covered by the tablet and phone selection runs. |
| Smaller campaigns; map choice, panels, resizing, touch | `verify:web` (97 checks); war-ai on Aldmere; unit tests on the grid | Operations are optional: campaigns without them play as before, and the AI uses the same planner. |

## Performance (`tools/qol-frames.ts`, 15 s at the fastest speed, Europe 1936, regional zoom on the eastern front)

| | `main` | Branch | Branch with 3 operations |
|---|---|---|---|
| Weeks simulated | 13 | 13 | 13 |
| Frame interval p50 / p95 / p99 / max (ms) | 16.7 / 16.8 / 33.3 / 50 | 16.7 / 16.8 / 33.3 / 50 | 16.7 / 16.8 / 33.3 / 50.1 |
| Frames over 50 ms | 0 | 0 | 1 |
| Long tasks (count, max) | 0 | 1, 54 ms | 1, 55 ms |
| Click to next frame, p50 / max (ms) | 5.6 / 12.5 | 3.1 / 10 | 3.6 / 11.7 |

The opposing AI planners were active in all three runs. Operations are planned one per week slice, and a run of 3 large operations before that change produced spikes of up to 83 ms. In the demo, operations planning averaged 6.6 ms a week, with a maximum of 19.7 ms.

`verify:web` performance probe on the final run: 58 fps, map draw averaging 8.5 ms (p95 28.6 ms), and 36 weeks in 6 s (54 fps, 14.3 ms and 35 weeks in the run before; the probe varies from run to run on this machine).

## Saves

- **Format 8.** A format-7 save migrates with no operations and empty AI failure memory, with a notice. `tests/saves-maps.test.ts` covers this, as do the `verify:web` imports of format-1 and format-2 files, both reported as format 8.
- **Operations, members, held members, detachments and planner memory** are all in the state. Saves continue identically in the tests and in the demo.
- **Invariants** check every operation and its membership: no unit in two operations, and no dangling references.

## Checks

`npm run check` passed on the final branch, after the fixes found by the gesture check:
- typecheck;
- **376 tests** in 33 files;
- the production build;
- the release ZIP;
- `verify:web` **97/97**, at the site root, the project subpath, the unpacked ZIP and in an iframe.

The gesture check passes on a fresh production build.

## Limits of this verification

- **Browsers and hardware.** Headless Chromium only, with software rendering. Touch was emulated at tablet and phone sizes. Firefox, Safari, GPUs and real touch devices were not tried.
- **One campaign at scale.** Europe 1936 as Germany, one seed for the demonstration, and four seeds for the AI. No one but me has played the update.
- **Beachheads.** A landed force that took its beach was pushed off it twice by counterattacks. The operation tries again, but it does not bring reinforcements across by itself.
- **Fleets and wings are used as they are grouped.** Operations do not move ships between fleets or wings between groups. Rebasing happens only with leave and only to airfields with room.
- **The AI's lost-attack share rose**, as explained above.
