# Redesign plan: the living atlas

This plan was written after the current build (v0.1, `main` at `c29aea6`) had been inspected in
Chromium at 1366×768 and 390×844. The baseline screenshots are in `docs/screenshots/before/`
and come from `e2e/capture.mjs`: seed 7, Calder, normal difficulty, 30 weeks in.

## What is wrong now

### Map
- Realms are flat, saturated poster colours with heavy black borders. The terrain is only a few
  tiny glyphs, so the map reads as a chart and not as a place.
- Impassable mountains are grey blobs, and the coast is a single line. There are no rivers,
  valleys, named seas or landmarks, so the world has little geographic structure.
- Realm names are drawn huge and cropped under the panels. Province labels are plain sans-serif
  with white outlines, and at the default zoom they collide with armies and capitals.
- There is no zoom-dependent detail. Every label and marker appears at every zoom level.

### Layout
- The map is boxed in. A left column of nine ledger buttons, a 360 px context panel that is
  always open, a toast bar at the top and an overlay strip at the bottom together cover about
  40% of a laptop screen.
- The context panel shows a long realm overview even when nothing is selected. The actions for
  a selected province or army sit far down a long scroll.

### HUD
- The resource bar shows current values and net change, but not what is already committed
  (upkeep, projects, training) or why a value is a problem. On a phone it wraps and clips.

### Screens
- The menu is a title, a paragraph and four identical buttons. It says nothing about the world.
- Campaign setup is a grid of nine near-identical text cards. There is no map, and no way to see
  where a realm starts or who its neighbours are.
- Ledgers are centred modals over the map. Diplomacy can't show the map it is about, and the
  tables use small type.

### Notifications and feedback
- Events and proposals interrupt with modal dialogs. Toasts stack in the middle of the map.
- Disabled actions do explain themselves (a strength worth keeping), but the explanation text
  is small and sits far from the button.

### World size
- 99 provinces and 9 realms, 15 provinces across. A campaign fights over the same one or two
  borders, and there is only one real mountain barrier.

## Direction

**A living political atlas.** The map is a cartographer's atlas brought to life: parchment land
with printed relief, ink-blue seas with coastal water lines, and realms laid on as translucent
watercolour washes. Printed terrain shows through the wash, borders are inked ribbons, and
labels are lettered in a literary serif. The interface around it is quiet dark ink: compact,
legible and consistent. A single vermilion seal colour is reserved for primary actions and
urgency. Heraldry is restrained: each realm has a procedurally drawn shield with one tincture,
one ordinary and one charge. The shield is used for identity everywhere, never as decoration.

- **Type:** Alegreya (literary serif, for map lettering and display) with Alegreya SC for realm
  names, and Source Sans 3 for the interface, with tabular numerals. All three are bundled
  locally under the SIL OFL.
- **Colour:**
  - Parchment `#ece3cc` and ink `#1d2730` as the two poles.
  - 16 muted realm hues tuned to work as washes over parchment.
  - Vermilion `#c8452c` for primary actions and urgency; brass only for small highlights.
  - Semantic green/amber/red for good, warning and bad.
- **Layout:** the map fills the screen. There is a slim top bar, a collapsible icon rail, and a
  context card that appears only when something is selected. Ledgers open as a docked drawer
  that leaves the map visible; Diplomacy switches the map to the relations mode. Map modes and
  navigation sit in two small clusters at the bottom corners.
- **Motion:**
  - Short eased camera flights to targets.
  - Armies glide along their route; battles pulse.
  - Drawers slide.
  - All of it is disabled by the reduced-motion setting and by the system preference.

## Expanded world target

| | Quick map: The Reach (kept) | Standard map (new) |
|---|---|---|
| Provinces | 99 | about 300 (3×) |
| Realms | 9 | 16 |
| Regions | 14 | about 36 |
| Unclaimed frontier | 12 | about 40 |
| Span in provinces | 15 | about 28 |
| Average province size | 22.5k units² | kept, so move times per province stay the same |

The standard map is a new continent with several fronts:

- a central river basin;
- a long mountain spine crossed only at a few passes;
- an inner sea with islands linked by fords and straits;
- an open steppe frontier;
- a marshy delta;
- a defensible peninsula.

Starting situations are deliberately varied: compact defensive states, exposed frontier powers,
wealthy central realms with many neighbours, and large states with long borders. Rivers run
along province borders and carry a real combat rule (attacking across a river). Every island is
reachable by a strait or ford. Old saves keep their scenario id, so they load on their original
map.

## As built

The plan held. These are the places where the build differs from it, and why.

### World

| | The Reach (quick) | Aldmere (standard) |
|---|---|---|
| Provinces | 99 | 298 (3.0×) |
| Realms | 9 | 14 |
| Regions | 14 | 42 |
| Unclaimed frontier | 12 | 34 |
| Span (graph diameter, in provinces) | 15 | 26 |
| Median province area | 23.0k units² | 18.7k units² |
| Mountain passes | 3 | 6, across 4 ranges |
| River borders | 0 | 65 (6 rivers) |
| Straits | 10 | 15 |

- **14 realms, not 16.** The nine realms of the Reach return, scaled up, and five new ones join
  them: Carrow, Hrafnmark, Solmarre, Lessia and the Ashmark. Each of the five has its own
  trait, heraldry and kind of start. Sixteen would have meant two realms that only repeated
  an existing identity.
- **No fords.** Only straits link land across water. The plan's "fords" had no rule behind
  them, and the brief allows no geographic feature without one.
- **No inner sea.** The central lake republic (Calder around Mirrormere) and four deep gulfs
  (Aurelian, Serene, Sunward and Ember) do that job, and they read better at world zoom.
- **Rivers run along province borders**, so crossing one is a precise, visible event. The
  rule: attackers who all cross a river to open a battle face defenders +20%. It is shown in
  forecasts, in battle factors, in the province card, and in the Terrain legend.
- **Islands:** every owned island is linked to its owner's own coast, and each island also
  gets a sea lane to the nearest coast held by someone else. Hrafnmark's longships cross
  straits at no extra cost.

### Interface

- **Names never overlap at rest.** Each frame places names against one collision list, in this
  order of precedence:
  1. markers;
  2. capital names;
  3. seas, ranges and lakes;
  4. realm names, each with up to four frames to try (level or steeper, in different parts of
     the realm);
  5. province names.

  Realm names fade out between about 78 and 100 px per province, as province names take over.
  The first version let realm names run through province names at the default zoom.
- The menu's atlas backdrop is painted once and drifted by a CSS transform. Redrawing it every
  frame cost 50–100 ms per frame in software rendering.
- Diplomacy keeps the map on **our** relations and outlines the chosen realm; one button
  switches to theirs. The first version switched the map to the other realm's point of view
  on every click, which was disorienting.
- Army groups (1–9) and a station order were added to the army card, the map markers and
  the Military ledger. The Military ledger is organised by front, by group and by region,
  because on 298 provinces a flat army list stopped being useful.

## Order of work

1. Design system (tokens, fonts, components) and the new map renderer: tile-cached geography,
   washes, ink borders, zoom-dependent labels, markers and routes.
2. HUD, context panels, notifications, map-mode selector with legends, navigation.
3. Standard world: authored world spec, generator, nations, rivers, straits; scenario selection;
   scaled victory thresholds; save migration.
4. Simulation and AI at scale: profiling, bounded work, multiple fronts; AI batches on both maps.
5. Menu, campaign setup, ledgers, dialogs, settings.
6. Browser verification on both maps, before/after screenshots, documentation.
