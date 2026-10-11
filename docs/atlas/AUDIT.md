# Atlas & Strategy Refinement: audit, baseline and plan

Written before any change, on `main` at `99e0322` (the merged Stage F build), with the handoff
pack `Crown-Frontier-Update-Handoff.zip` extracted to a staging folder outside the source
tree and checked against its manifest (165 SVG, 4 landmark PNG, 6 font files; every SHA-256
matched). The pack's nine screenshots of the old interface are evidence only and are not
shipped. Measurements were taken on a 4-core Intel Xeon @ 2.10 GHz with 15 GB of memory,
Node 22.22.2 and headless Chromium 141 with software rendering; the same machine type as the
Stage E figures.

## Baseline

**What works.** Every Stage A–F system is connected and used by the AI: the industrial
economy (crowns, food, coal, iron, oil, rubber, nitrates, factories and materiel), trade
agreements, trade blocs, loans, guarantees, influence and spheres, peace settlements with
graded demands, national focus trees, research, land warfare with supply, sieges and
entrenchment, a navy with sea zones, blockades and transports, air wings, four victory
paths, the map library, the editor, six maps and save format 4 with migration from
formats 1–3. 184 unit tests and the 61-step browser check (`npm run verify:web`) pass.

**Placeholder or thin.**

- **Trade** has no terms. A trade agreement moves every partner's surplus above 40% of
  its cap to the other's need below 40%, automatically, at a fixed price, every month.
  Nothing is reserved, there are no orders, no quantities, no duration, no delivery time
  and no forecast. "Dependence" exists only as an AI estimate of an agreement's value.
  Coal is the only resource that is ever short in AI batches (10–19% of realm-months);
  iron, oil, rubber and nitrates never are, because only coal and fuels count as a monthly
  need. Iron is spent when a building or regiment starts.
- **Order feedback.** An army pinned by an enemy in its province, or slowed by air
  interdiction, still says "Moving to …". Only a route that closes is reported.
- **AI war planning** looks only at realms it borders by land or strait, so island AIs
  rarely start wars. AI treasuries pile up with nothing to spend on (STATUS.md).

**Disconnected.** Nothing found. Fictional flags exist only in the pack; the game's realms
use procedural heraldry, which stays.

**Largest map.** The Middle Sea: 548 provinces, 16 realms. A 900-province generated map
(`.scratch/stress-900.map.json`) is used only for stress tests.

**Defects found in the audit.**

| # | Defect | Evidence |
|---|---|---|
| 1 | Importing a malformed save from the Load screen before any campaign has started shows the error **under** the screen (`.modal-layer` z-index 60 below `.screen` 70): nothing appears to happen. | `before/w-m05-import-malformed.png` |
| 2 | Ledgers repeat the left rail as a second row of tabs that is clipped ("Diploma"). | every `before/w-l*.png`; pack `01`–`09` |
| 3 | Ledgers and cards are translucent: map labels show through them. | `before/w-l01…l12`; pack `02` |
| 4 | A map hover tooltip can stay visible over a ledger (seen over How to Play in the pack's screenshot `09`). It was not reproduced by moving the pointer over the ledger; the tooltip is left over when a ledger opens by key while the pointer is on the map. | pack `09` |
| 5 | A pinned army reports "Moving to …" with no reason. | code: `movement.ts` `hostilePinned` |
| 6 | The Chronicle has no empty state: a new campaign shows filters over a blank area. | `before/w-l09-ledger-log.png` |
| 7 | The phone layout (390×844) wraps the resource bar and the ledger fills the screen with the duplicated tab row. | `before/n-*.png` |

## Measured performance (before)

Simulation, AI-only, 30 years, seeds 1–2 (`reports/perf/atlas-before-*.md`):

| Map | Week avg | p50 | p95 | p99 | Max | Creation | Heap at y30 |
|---|---|---|---|---|---|---|---|
| Middle Sea (548 / 16) | 15.7 / 15.2 ms | 12.2 / 13.2 | 31.7 / 29.0 | 50.2 / 35.6 | 78.8 / 53.0 | 13.8 + 20.1 ms | 20.5 MB |
| Aldmere (298 / 14) | 9.9 / 9.1 ms | 8.5 / 7.7 | 19.3 / 18.9 | 26.0 / 24.2 | 57.7 / 34.8 | 5.2 + 10.5 ms | see report |

Browser, production build (`reports/perf/web-atlas-before.md`):

| Map | Load to menu | New campaign to first frame | Pan, medium zoom (draw avg / p95) | Fastest speed, 6 s | Heap at y10 |
|---|---|---|---|---|---|
| Middle Sea | 184 ms | 1,593 ms | 4.2 / 9.9 ms | 36 of 36 weeks, frame p95 47.7 ms | 40.2 MB |
| stress-900 (900 / 24) | 178 ms | 1,566 ms | 7.5 / 16.9 ms | 36 of 36 weeks, frame p95 66.0 ms | 22.9 MB |

The fastest speed is 6 weeks a second, so a simulation week has a budget of about 166 ms
on the main thread. Save and load times were not measured before; they are added to
`tools/bench.ts` in this update and measured on both builds.

## Screen inventory

Every player-facing surface found in the code (`src/ui/**`) and by navigating the build.
"Before" names the screenshot (`.jpg`) in `docs/screenshots/atlas/before/` (`w-` 1366×800, `n-`
390×844). The design pattern, asset mapping, states and verified interactions are filled in
by the redesign and kept up to date in [`SCREENS.md`](SCREENS.md).

| Surface | Entry point | Nested screens and dialogs | Before |
|---|---|---|---|
| Main menu | page load; Game menu → Save and quit | — | `w-m01`, `n-m01` |
| New campaign (setup) | Main menu → New campaign; library → Play | map list, realm list, campaign options, tutorial switch, Watch AI only | `w-m02`, `w-m03`, `n-m02` |
| Load or import | Main menu; Game menu → Load | save list, delete confirmation, import error, file too large | `w-m04`, `w-m10`, `w-d02`, `w-m05` |
| Map library | Main menu → Map library | map cards, import map, refused map dialog, export | `w-m06` |
| Map editor | Library → New map / Edit a copy | generator dialog, tools rail, inspector, validation list, save/export | `w-m07` |
| Settings | Main menu; Game menu | — | `w-m08` |
| How to play (screen) | Main menu; Game menu | — | `w-m09` |
| Loading | new campaign or load (map geometry) | — | not captured (under 2 s) |
| HUD | in game | resource bar, date and speed, notifications, decisions button, menu button | `w-g02`, `n-g02` |
| Left rail | in game | ten ledger destinations with badges | `w-g02` |
| Map and minimap | in game | zoom buttons, minimap, hover tooltip | `w-g02`, `w-z01`, `w-z02` |
| Map modes and legend | in game, mode bar or Shift+1–9 | nine modes, each with a legend | `w-x01`…`w-x08` |
| Province inspector | click a province | build actions, recruit, focus on map, relations | `w-g03`, `w-g04` |
| Army inspector | click an army | orders, army groups, battle section, attack/defend estimates | `w-g05`, `w-n04` |
| Fleet inspector | click a fleet | missions, transport, ships | `w-n01` |
| Sea zone inspector | click a sea zone | control, fleets | `w-n02` |
| Air wing inspector | click a wing | missions | `w-n03` |
| Realm & Budget | rail; key R | — | `w-l01`, `n-l01` |
| Industry & Trade | rail; key I | — | `w-l02`, `w-w05` |
| Military | rail; key M | regiment types, training, navy and air | `w-l03`, `w-n05` |
| Research | rail; key T | technology cards | `w-l04`, `n-l04` |
| National Focus | rail; key P | focus cards by branch | `w-l05` |
| Diplomacy | rail; key D | realm list, briefing, actions with "Why?" | `w-l06`, `w-l12`, `w-w04`, `n-l06` |
| Wars & Peace | rail; key W | peace conference, demands | `w-l07`, `w-w01`, `w-w02` |
| Victory | rail; key V | — | `w-l08`, `w-w06` |
| Chronicle | rail; key L | filters, export bug report | `w-l09` |
| Help (in game) | rail; key H / F1 | — | `w-l10`, `w-l11` |
| Tutorial | new campaign with the tutorial on | coach marks beside ledgers | `w-g01` |
| Decision dock and cards | events, proposals, settlements | event card, proposal card, settlement counter-offer | `w-d03`, `w-w03` |
| Toasts | after commands | — | in `w-d03` |
| Game menu | Esc; menu button | save slots, export, import, settings, how to play, quit | `w-d01`, `n-d01` |
| Confirmations | delete save, disband, cancel treaty, declare war | — | `w-d02` |
| Converted-save notice | loading an older save | — | (Stage F `session-02`) |
| End of campaign | victory, defeat, time limit | Keep playing, export | `w-d04` |

## System-refinement matrix

| System | Now | Refinement in this update | Evidence planned |
|---|---|---|---|
| **Trade** | Automatic surplus flows under agreements; no terms | Contracts with price, quantity and duration; reserved stock; goods in transit with a delivery time by land or sea; interruption by blockade or war; failed delivery and cancellation rules; dependence; forecasts from the economy code with stated assumptions; the AI signs contracts through the same commands | unit tests for accounting invariants and exploits; AI batches before and after; browser check of a contract |
| **Economy** | Shortages only for coal | Shortages and reserves shown per resource with their cause; projects waiting on stock named | ledger and tests |
| **Warfare** | Battles, supply, entrenchment; little explanation | Order status with a reason (pinned, interdicted, no route, waiting for transport); composition, terrain, supply and readiness trade-offs in the army inspector; battle explanations from what the player can see | unit tests; screenshots |
| **Peace** | Graded settlements | Check across map sizes; fix runaway conquest only with a stated rule | AI batches on every map, including the new ones |
| **Diplomacy** | Opinion, trust, alarm, "Why?" on proposals | Economic dependence as a stated reason; contracts and dependence in the briefing | tests of acceptance reasons |
| **Research and focus** | Card grids | Dependency views with connectors and a project inspector; no filler nodes added | browser checks |
| **AI** | Three layers; diagnostics | Same contract commands as the player; overseas war planning; reproducible diagnostics for idle armies, pointless wars and idle treasuries; fixed-seed comparisons across maps and difficulties | `reports/atlas/` batches |
| **Maps** | Six maps, largest 548 provinces | Huge Earth (Natural Earth), large Europe, large fictional world; validation of coasts, adjacency, crossings, capitals, resources and supply | generator reports with target and achieved counts |
| **Editor** | Generate, paint, validate, export, import | Proven export → import → setup → play → save → reload round trip; precise messages | browser check |
| **Saves** | Format 4 with migration | Format 5 (contracts and shipments) with migration, backups and explicit errors; never under the wrong map | unit tests |
| **Presentation** | Dark glass shell, serif headings | Ivory atlas inside slate furniture per the pack's tokens and map rules; one label registry; truthful legends | before/after screenshots |
| **Performance** | Measured above | Profile Earth under late-game stress; a worker only if the numbers call for it | `reports/perf/atlas-*` |

## Plan

1. **Visual foundation.** Self-host Barlow Condensed and Source Sans 3 from the pack (OFL
   notices kept); remove Alegreya. Tokens as CSS custom properties. Pack assets copied
   to `src/assets/atlas/` and imported through Vite, so every URL resolves under any
   deployment subpath; landmark PNGs load lazily.
2. **Shell.** One navigation model (the rail; the duplicated tab row goes); opaque ivory
   registers inside slate frames; the map stops taking hover and clicks under any panel;
   all interaction states styled; keyboard, touch and reduced motion kept.
3. **Map.** Ivory land, blue-grey water, muted political washes, borders and coasts per
   `map-rendering.json` in screen pixels, terrain motifs from real terrain, markers,
   counters with live layers, landmarks at local zoom at real locations, one collision
   registry for labels and markers, legends that describe the active mode.
4. **Trade and economy** (save format 5), then warfare explanations, diplomacy dependence,
   research and focus views, AI diagnostics and fixes.
5. **Every screen redesigned** around the systems above, then the screen inventory filled
   in with states and verified interactions.
6. **Maps.** Earth, Europe and the fictional world through the shared map format; editor
   round trip; LOD and performance on Earth.
7. **Verification.** Tests, browser checks, AI batches, human-style play, before/after
   screenshots, measured performance, documentation and one draft pull request, left
   unmerged and unpublished.
