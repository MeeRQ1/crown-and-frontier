# Screen inventory: after the atlas update

This lists every player-facing surface found in `src/ui/**` and by navigating the build. For
each surface it gives:

- its **pattern**: the composition chosen for its task;
- its **assets**;
- the **states** captured in screenshots;
- the **interactions** checked in a real browser.

The surfaces and entry points are those of the audit table in [AUDIT.md](AUDIT.md).

**Screenshots** are in `docs/screenshots/atlas/before/` (main at `99e0322`) and `after/`.
`tools/shots-atlas.ts` makes both sets with the same steps, so each shot can be compared by
name. Prefixes:

- `w-` is 1366×800, `n-` is a 390×844 phone;
- `z03`–`z09` and `m11` exist only in the after set: they show the three new maps.

```
npm run build && npx tsx tools/shots-atlas.ts after
```

**Verified interactions** name checks of `npm run verify:web` (`tools/verify-web.ts`); their
latest results are in [`reports/web-verification.md`](../../reports/web-verification.md).
Where a surface has no browser check, the table says so.

## The shared visual system

- **Opaque ivory registers** hold everything a player reads. **Warm slate furniture** holds
  navigation, the top bar and the controls. Nothing a player reads is translucent, so map
  labels never show through a panel.
- **Type:** Barlow Condensed for headings and figures' labels; Source Sans 3 for text. Both
  are bundled locally.
- **Colours** are tokens from the pack (`--cf-*` in `src/ui/style.css`). There is one focus
  ring, and hover, pressed, selected and disabled states are styled throughout.
- **One navigation model:** the left rail, with keys B I M T P D W V L H. The duplicated
  row of ledger tabs is gone. Local tabs appear only where a task really divides, such as the
  Chronicle's filters.
- **The map never takes input under a panel:** the pointer, hover card and clicks stop at a
  panel's edge. A tooltip left over from the map is hidden when a ledger opens.
- **Pack assets:**
  - menu emblems: one per ledger header (`src/ui/emblems.ts`);
  - resource art: Industry & Trade, the province inspector and the commodity register
    (`src/ui/resource-art.ts`);
  - counters, markers, terrain motifs, textures and decorations: the map
    (`src/ui/map/sprites.ts`);
  - landmark illustrations: real buildings at local zoom;
  - interface icons: everywhere (`src/ui/atlas-icons.gen.ts`).
  - The pack's fictional flags are not used; realms keep their own heraldry.

## Menus and utility screens

| Surface | Pattern | Assets | States in screenshots | Verified interactions |
|---|---|---|---|---|
| Main menu | Slate title column beside a live, slowly drifting atlas of the standard map; one primary action, then secondary actions with a line of explanation each | menu icons; the live map | `w-m01`, `n-m01` | *Site root / Project subpath: loads, starts a campaign and draws the map* |
| New campaign (setup) | Three columns: map cards with true previews, the selected map drawn large, and the selected realm's briefing (strength, constraint, starting position: neighbours, passes, rivers, claims, and on the historical maps its allies and pacts). Scale, setting and style come from the map package; the map's attribution sits under the preview. "Begin campaign" shows *Preparing the map…* until the campaign opens. | realm heraldry; map previews drawn from the real geometry | `w-m02`, `w-m03` (Middle Sea), `w-m11` (the World), `n-m02` | *Campaign setup starts the chosen map and realm (the Reach, Fenward)* |
| Load or import | A save register: realm, map, date, time saved and slot, with Load, export and delete; the save a manual save replaced is listed as "Slot N (the save it replaced)"; an explained empty state; errors in a dialog that leaves the screen unchanged | save and file icons | `w-m04` (empty), `w-m10` (with a save), `w-m05` (malformed file), `w-d02` (delete confirmation) | *Save to a slot and load it back*; *Export to file and import it again*; *A damaged save is rejected and the campaign is kept*; *A format-1 / format-2 save is converted on import, with a notice*; *A save that cannot be converted stays listed, is refused with a reason and can be exported*; *On the menu screens, deleting a save asks first; Cancel keeps it* |
| Map library | A catalogue: a preview, size, difficulty, sea zones, start year, style and mechanics for each map; your own maps first, with an explained empty state | map previews | `w-m06` | *Map library lists every built-in map with a drawn preview*; *delete and re-import a map; a broken file is refused with a reason; map text is never run*; *edit a copy of a built-in map and save it* |
| Map editor | A tool rail, the map with zoom buttons (+, −, Fit; keys +, −, 0 and arrows), and an inspector with the validation list (every error outlined on the map while Check is open) and the treaties in force at the start; a generator dialog for a new map | tool icons | `w-m07` (generator dialog) | *New map generates a playable map (in a worker)*; *select and rename a province, paint terrain, undo*; *a realm left without land is reported with a way to find it, and undo repairs it*; *zoom buttons and keys, fit, and a selected sea zone outlined on the map*; *a treaty in force at the start is added and listed*; *saves to the library and exports a file that passes the validator*; *an unfinished map exported with errors opens again from its file, shows where the errors are, and is saved once fixed*; *an unfinished map is refused, with the editor offered to fix it*; *Map round trip: export → import → setup → play → save → reload…* |
| Settings | One column of grouped rows: label, explanation and control, with segmented controls for choices | — | `w-m08` | No dedicated check. The settings it changes (legend, autopause) are exercised by the tutorial and the speed checks. |
| How to Play (screen) | A field-manual page with sections; it names all eleven maps | — | `w-m09` | No dedicated check. The in-game Help covers the same manual, with its own check. |
| Game menu | A compact dialog: campaign identity line, three save slots saying what each holds, files and options, then Resume and Save-and-quit | save, file and settings icons | `w-d01`, `n-d01` | *Save to a slot and load it back* and *Export to file and import it again*, both through this menu |
| Confirmations | A dialog naming exactly what will be lost or paid, with the destructive action spelled out | — | `w-d02` | *On the menu screens, deleting a save asks first; Cancel keeps it*; ending a trade contract early opens the same kind of dialog (no browser check) |
| Converted-save notice | A dialog listing what the conversion changed | — | (not captured in the screenshot set) | *A format-1 save is converted on import, with a notice* |
| End of campaign | Verdict and date, a reign summary in four tiles, final standings | realm heraldry | `w-d04` | No dedicated check (continuing after the result is a logged command, tested in `tests/saves-maps.test.ts`) |
| Loading | The setup's Begin button says *Preparing the map…* and is disabled until the campaign opens. There is no separate loading screen. | — | not captured | covered by the campaign-start checks |

## The play surface

| Surface | Pattern | Assets | States in screenshots | Verified interactions |
|---|---|---|---|---|
| Top bar (HUD) | Slate bar: realm, five resource cells (figure, change per month, what drives it), research, war state, alert chips and the date with speed. A crowded bar drops its least important words in a fixed order instead of overlapping. | icons, heraldry | `w-g02` (calm), `w-w01` (at war: decision, war-score chips and the war cell), `n-g02` (phone: two rows) | *Layout 1024×768 … 1920×1080*; *Phone layout has no horizontal page scroll* |
| Left rail | Ten ledger destinations with badges, one style at every width; on phones a bottom bar with *More* | icons | every `w-g*`/`w-l*` shot; `n-g02` | *Keyboard: D opens Diplomacy, Esc closes*; *Focus: the rail marks the Focus ledger while no focus is under way* |
| Map, minimap and zoom | Ivory land, blue-grey water, muted realm washes, inked borders and coasts in screen pixels; counters with live state; landmarks at local zoom; one collision registry for every label and marker; realm names at world zoom (moved aside, shrunk or skipped when crowded) | terrain motifs, markers, counters, textures, landmarks | `w-z01`–`w-z09` (Middle Sea, World, Europe, Hesperia at world and regional zoom; a late-game front on the World) | *Keyboard: F fits the whole map*; *Map clicks reach the map beside the legend, the mode bar and the minimap*; *iframe: zooming the map does not scroll the host page*; *Touch: tapping a province selects it* |
| Hover card | Identity, owner, terrain and development; it follows the map when the map moves under a still pointer | heraldry | in most map shots | no dedicated check (the fix for a stale card is in `cdb2f66`) |
| Map modes and legend | A mode bar (Shift+1–9) and a legend that says what the active mode shows, with real values only | mode icons | `w-x01`–`w-x08` | *Keyboard: Shift+2 shows the Terrain map*; *Map modes: Shift+8 shows Resources and Shift+9 Sea control, each with a legend*; *Diplomacy map mode: the legend covers spheres, guarantees and trade blocs*; *Closing Diplomacy restores the map mode it replaced* |
| Province inspector | Identity strip, then actions, then a stat grid, then ground, supply and frontier integration | resource art, heraldry | `w-g03` (own capital), `w-g04` (foreign), `w-z04`/`w-z06` (capitals on the World and Europe) | no check names it; the tutorial check's steps act through it, and the touch check opens it by tapping a province |
| Army inspector | Identity and order status with a reason (*Marching to … · 2 weeks*, pinned, interdicted, no route), Move, a stat grid, army group and standing order, then *Readiness here* (frontage, flanking, terrain, morale) and supply. When Ship by sea is unavailable, a line under the orders says why and what is needed (*18 regiments need 9 transports*). | counters, heraldry | `w-g05` (own), `w-n04` (enemy), `w-z09` (a front in the Andes) | *Naval invasion: Ship by sea, click the beach, the troops sail and land*; *Air: … the attack forecast shows the enemy holding the sky* |
| Fleet, sea zone and air wing inspectors | The same order: identity, state, actions, explanation | ship and plane symbols | `w-n01`, `w-n02`, `w-n03` | *Blockade: clicking the sea shows the blockaded coast, the fleet card says Blockading…*; *Air: a wing flies ground support chosen on the map…* |
| Decision dock and cards | A card per decision: what happened, where (a map link), the default and its deadline, and two choices with their effects | heraldry | `w-d03` (event), `w-w03` (settlement offered) | *Settlement offered to us: striking a demand sends a counter-offer, which the other side judges*; *A finished national focus pauses the game for the next choice* |
| Toasts | A short line, coloured by outcome | — | `w-z09`, `w-w04` (*Loaded…*) | seen in every flow; no dedicated check |
| Tutorial | Coach marks beside the panel they explain, never over an open ledger; 15 steps completed by doing them | — | `w-g01` | *Tutorial: steps for industry, sea and air, national focus and settlements, each completed by doing it*; *the tutorial never covers an open ledger* |

## Ledgers

Each ledger is an ivory register in a slate frame. A header carries its emblem and title, a
summary strip gives the four or five figures that matter, then comes a composition built for
its task.

| Ledger | Pattern | States in screenshots | Verified interactions |
|---|---|---|---|
| Realm & Budget | A financial statement: crowns last month against this month projected, then food, manpower and administration beside it, then research funding as four priced choices | `w-l01`, `n-l01` | no dedicated check; its figures are tested in `tests/economy.test.ts` |
| Industry & Trade | A commodity register (stock with reserved share, output, use, bought, sold, under way, six-month outlook), then a trade workspace for the chosen good: forecast chart, contracts in force, partners' positions with Buy/Sell, and an offer form with the other side's view | `w-l02` (no trade), `w-w05` (with a partner) | *Industry & Trade: a purchase from a partner's spare stock is drafted with its forecast, sent, accepted and listed in force* |
| Military | Armies grouped by region (where, mix, men, morale, what each is doing); a navy-and-air strip with fleets, upkeep, wings and blockades; when aircraft arrive (by technology and horizon year); regiments in training; regiment types | `w-l03`, `w-n05` | *Blockade … the Military ledger counts it* |
| Research | Era and branch plan with dependency connectors; locked, available, active and researched states drawn distinctly; an inspector for the selected technology (horizon year, cost, time at the current rate, effects, what it leads to) | `w-l04`, `n-l04` | *Research: T opens the plan with dependency connectors; a node inspects, arrow keys move between nodes, scroll survives a re-render, and choosing starts research* |
| National Focus | An authored branching plan (national, industry, army, diplomacy, sea), with links between foci and exclusions dashed; an inspector separating effect from flavour | `w-l05` | *Focus: P opens the focus plan; selecting a national focus inspects it, and choosing it makes it the realm's focus* |
| Diplomacy | A compact realm index (at war, allies and partners, neighbours, farther realms), a briefing for the selected realm (opinion, alarm, trust, strength, each with its meaning), *Why they feel this way*, then envoys, treaties, guarantees, loans and blocs with *Why?* on proposals | `w-l06`, `w-l12`, `w-w04`, `n-l06` | *Diplomacy: guaranteeing a realm's independence…*; *a loan to a realm in debt is accepted and repaid with interest*; *founding a trade bloc with a trade partner* |
| Wars & Peace | A campaign briefing for each war (sides, goal with map link, war score by component, with the war goal's monthly tick and what it is doing now, exhaustion, forced-peace clock), then the peace conference: dictate or offer, contributions and fair shares, demands | `w-l07` (peace), `w-w01` (at war), `w-w02` (conference) | *Peace conference: suggested terms share the spoils with an ally, and the settlement ends the war* |
| Victory | Three routes stated alike: conditions as measure against threshold, the timer and what next month does to it, standings, and *Our next constraint* | `w-l08`, `w-w06` | *Victory: three routes stated alike, with every condition as a measure against its threshold and what next month does to the timer* |
| Chronicle | Entries grouped by month, with kind filters and counts, battle reports, an explained empty state, and Export bug report | `w-l09` (empty) | *Chronicle: entries grouped by month with kind filters; battle reports or an explained empty state* |
| Help | A field manual with a contents index and short articles | `w-l10`, `w-l11` (with the pointer over the map behind it) | *How to Play: a field manual with a contents index; choosing "Trade contracts" opens that article* |

## Representative states

| State | Where it is shown |
|---|---|
| **Empty** | `w-m04` (no saves), `w-m06` (no maps of your own), `w-l09` (nothing recorded), research and focus with nothing chosen (`w-l04`, `w-l05`) |
| **Crowded or long labels** | `w-w01` (a top bar at war at 1366 px); `w-z03` (57 realms at world zoom); `w-z09` (a late-game front on the World); `w-m11` (a realm with 23 neighbours listed in setup) |
| **Unavailable** | locked research and focus nodes (dashed); Buy/Sell disabled with the reason as their title; actions in the province inspector with their requirements |
| **Error and recovery** | `w-m05` (malformed save: the dialog says why, and the screen behind is unchanged); browser checks for a refused map file and a save that cannot be converted |
| **Narrow** | `n-*`: the phone layout with a bottom bar and the ledger over the map; checks for no horizontal scroll and touch selection |

## Gaps that remain

- **Browsers.** The interface is verified in headless Chromium only. Firefox, Safari, real
  Chromebooks and real touch devices are untested.
- **Unchecked screens.** Settings, the converted-save notice and the end-of-campaign screen
  have no browser check of their own; they are reached in the flows above or by unit tests.
- **Small overlaps.** On a 1366×800 screen with the legend open, a decision card can overlap
  the legend's right edge by a few pixels (`w-d03`).
- **Truncated summary cells.** Summary strips cut a long cell short with an ellipsis, for
  example the Military ledger's "16k · reserve …" at 1366 px; the full figure is in the
  Realm ledger.
