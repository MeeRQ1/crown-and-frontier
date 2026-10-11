# Maps: the shared format, the pipeline and the three new campaigns

This update adds three campaigns: **The World, 1914** (huge, historical), **Europe, 1914**
(large, historical) and **Hesperia, 1890** (large, original). They are built by one
pipeline, `tools/realmap.ts`, which also accepts authored geography. They ship in the same
map package format as the older built-in maps and the maps made in the editor, pass the same
validator and run on the same simulation and renderer. No campaign has its own rules or
drawing code.

## The nine campaigns

Counts are taken from the shipped scenarios (`src/data/maps/*.scenario.json`, and
`src/data/` for Aldmere and the Reach). Sea zones and river borders are listed where the
scenario file records them.

| Map | Setting | Provinces | Realms | Unclaimed provinces | Regions | Sea zones | Straits | River borders |
|---|---|---|---|---|---|---|---|---|
| The Reach | original | 99 | 9 | 12 | 14 | | 10 | 0 |
| The Sundered Isles | original (generated) | 116 | 8 | 24 | 16 | 25 | 17 | 6 |
| The Baltic, 1906 | historical (Natural Earth) | 233 | 5 | 0 | 68 | 42 | 20 | 50 |
| The Kharan Steppe | original (generated) | 263 | 11 | 23 | 37 | 19 | 0 | 41 |
| Aldmere | original | 298 | 14 | 34 | 42 | 30 | 15 | 65 |
| The Middle Sea | original (generated) | 548 | 16 | 42 | 74 | 38 | 0 | 42 |
| **Europe, 1914** | historical (Natural Earth) | **686** | **23** | 0 | 232 | 78 | 12 | 91 |
| **Hesperia, 1890** | original (authored) | **754** | **22** | 35 | 93 | 53 | 5 | 184 |
| **The World, 1914** | historical (Natural Earth) | **1,225** | **57** | 0 | 388 | 165 | 32 | 84 |

The World is 2.2 times the size of the previous largest campaign (the Middle Sea, 548
provinces) and has 3.6 times as many realms.

## Targets, set after profiling

The targets were set after measuring the engine as it stood
([AUDIT.md](AUDIT.md), [`reports/perf/scaling-stress.md`](../../reports/perf/scaling-stress.md)).

- **Budget.** The fastest speed is 6 weeks a second, so a week has about 166 ms on the
  browser's main thread.
- **Before this update:** the Middle Sea (548 provinces, 16 realms) took 15.7 ms a week on
  average, with a p99 of 50 ms.
- **Stress maps:** generated stress maps of 1,093 provinces took 56.7 ms a week with 24
  realms and 90.5 ms with 48 realms. After the first round of scaling work, the 48-realm
  map took 77.7 ms, with a p99 of 170 ms. Cost grows more with realms than with provinces,
  because each AI realm plans every week.
- **Format limits:** the format allowed 32 realms; the limit was raised to 64 so a world map
  could have its real states.

| Map | Target | Why | Achieved |
|---|---|---|---|
| The World | 1,100–1,300 provinces, 50–60 realms | about twice the largest map; the stress maps of that size stayed within the budget on average, and the realm count covers the sovereign states of 1914 that hold a province on this scale | 1,225 provinces, 57 realms |
| Europe | 600–700 provinces, 20–25 realms | denser than the World's Europe, so the European fronts get room; about 1.2 times the Middle Sea | 686 provinces, 23 realms |
| Hesperia | 700–800 provinces, 20–24 realms, with unclaimed frontier | a large original campaign between Europe and the World in scale | 754 provinces, 22 realms, 35 unclaimed provinces in three frontiers |

Europe is denser than the World's Europe. Compare realms that hold no land outside Europe:
Austria-Hungary has 60 provinces on Europe and 31 on the World, Sweden 22 and 6, Romania
13 and 5. The World sizes provinces by land: about 18,000–36,000 km² in Europe and India,
and up to several hundred thousand km² in Siberia, the Sahara and the Australian interior.
It also has more regions where people lived (388 in all). Its scale comes from geography,
not from dividing empty land.

## Scenario framing and identities

| Map | Political setup | Start |
|---|---|---|
| Europe, 1914 | **Historical, approximated.** Borders follow present-day first-level divisions and approximate those of spring 1914 where they differ: partitioned Poland, North Schleswig, Alsace-Lorraine, Galicia, Bosnia, the Balkan borders of 1913, Western Thrace and the Dodecanese. Egypt and Cyprus are held by Britain. Morocco is split between the French and Spanish protectorates. The microstates are drawn with the land around them. | 1914 |
| The World, 1914 | **Historical, approximated.** Realms are the sovereign states and dominions of mid-1914. Colonies, protectorates and dependencies are held by the power that governed them. Realms too small for a province on this scale are drawn with a neighbour: Luxembourg with Germany, Montenegro with Serbia, and the microstates. Mongolia and Tibet, de facto independent, are realms. The full list is at the top of `tools/earth.data.ts`. | 1914 |
| Hesperia, 1890 | **Fictional.** Invented geography, realms and names; no real places. | 1890 |

**The diplomacy of 1914.** Europe and the World start with the treaties of early 1914
in force (`treaties` in the package, signed when the campaign starts) and the claims
of the time on the provinces they concern:

- alliances: Germany with Austria-Hungary, both with Italy (the Triple Alliance),
  France with Russia, Britain with Portugal, Serbia with Greece; on the World also
  Britain with Japan and with its dominions (Canada, South Africa, Australia,
  New Zealand);
- non-aggression pacts standing for the ententes (Britain with France and with Russia,
  France with Italy; on the World also Russia with Japan). A pact lasts five years, so
  the ententes lapse in 1919 unless renewed;
- claims: France on Alsace-Lorraine; Italy on the Trentino and Trieste; Serbia on
  Bosnia; Romania on Transylvania and Bukovina; Bulgaria on Macedonia and Southern
  Dobruja; Denmark on North Schleswig; Greece on Northern Epirus and the Dodecanese;
  the Ottomans on the Aegean islands. A claim lands on the nearest province of the
  claimed land on the map's scale, never on a capital; where the claimed land has no
  province of its own, nothing is claimed. Each map's report lists the treaties and
  every claimed province.

The treaties are where the campaign starts, not a script: the AI decides its own wars,
and in the sessions recorded in [SESSIONS.md](SESSIONS.md) the two alliance blocs did
not go to war with each other in the first four years. The great powers' national
focuses carry names of the period (*Sacro Egoismo*, *Two-Power Standard*,
*Mitteleuropa*); their effects are the shared templates'.

Nothing invented is presented as historical fact. The campaign description says the
historical borders are approximated, and so does each map's report
(`reports/maps/*-map.md`). Historical realms use their names of 1914, their national
colours and simple arms drawn in those colours. The game's heraldry has no eagles or
lions, so the arms are not the real coats of arms. The generic fictional flags in the art
pack are not given to real countries. AI temperaments, traits and starting forces are
game choices, not claims about the powers' real capabilities. The campaign setup shows each
map's size, setting, expected style of play and mechanics (for example *Colonial empires*,
*Oceans that wrap around*, *Unclaimed frontier*).

## Sources and attribution

- **Natural Earth** v5.1.2 (naturalearthdata.com) supplies the World's and Europe's land,
  lakes, rivers, first-level divisions and towns. It is in the public domain.
  - `tools/realmap.ts` downloads the layers into `.cache/naturalearth/`, which is not
    committed, and refuses any file whose SHA-256 does not match the pinned value.
  - The credit appears in the map library, the campaign setup, the in-game menu and
    [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
- **Authored in this project:**
  - for the real maps, in `tools/europe.data.ts` and `tools/earth.data.ts`: which division
    belonged to which realm in 1914, the names of the time, town populations of about 1914,
    mountain walls, passes, straits, seas and arms;
  - all of Hesperia, in `tools/hesperia.data.ts`.

## The shared format

A map is one plain-JSON **map package** (`src/maps/format.ts`, format
`crown-frontier-map`, version 3):

- `id` and `revision`;
- `meta`: name, description, size, difficulty, style, mechanics, origin and attribution;
- `rules`: start year, campaign lengths, victory thresholds and research cost;
- `regions`, `nations` and `provinces`, each province with its explicit neighbours;
- the `straits` and `rivers` lists;
- `seaZones`, with coasts, adjacency and strait control;
- optionally `treaties`: alliances, non-aggression pacts and trade agreements in force at
  the start (format 3 reads it when present; a package without it has the same checksum
  as before);
- `geometry`: every border once as a shared polyline, province centres, impassable areas,
  labels and the drawn sea zones.

Every map uses this format: built-in, generated, edited in the browser or imported from a
file. Each one goes through `validateMapPackage` (`src/maps/validate.ts`), then through
the same conversion to a simulation scenario and to renderer geometry.

- **Checksum.** It covers the gameplay content but not the drawn geometry. Redrawing a coast
  does not invalidate saves; any change a campaign depends on does.
- **Saves** record the map's id, revision and checksum. A save is never read under a
  different map. If its map has gone from the library, the copy embedded in the save is
  validated and used instead: a browser check removes the map, then loads the save.
- **Limits** (`MAP_LIMITS`): 1,500 provinces, 64 realms, 600 regions, 60,000 borders,
  600,000 points, 400 sea zones and 8 MB per file. The World uses 1,225 provinces, 57 realms,
  388 regions, about 31,000 borders and 3.0 MB.
- **Maps load lazily.** The built-in maps' geometry is fetched only when a campaign on that
  map starts, so the World's 3.0 MB does not slow the menu.

## The pipeline

`npm run genreal -- --map europe|earth|hesperia` runs `tools/genreal.ts` with the map's
definition (`RealMapDef`). It writes:

- `src/data/maps/<id>.scenario.json` and `<id>.map.json`;
- a report (`reports/maps/<id>-map.md`) with counts, realms, regions, warnings and every
  province name;
- an SVG preview drawn from the shipped borders (`reports/maps/<id>-preview.svg`).

1. **Source.** Natural Earth layers, or an authored `MapSource`: land and lake polygons,
   river lines, towns, and a function giving the division at any point.
2. **Projection and frame.** Lambert conformal conic for Europe; Equal Earth for the World,
   whose oceans wrap across the seam; a cylindrical projection for Hesperia.
3. **Raster.** Land, lakes and divisions are rasterised on the generator's grid. Inlets
   narrower than a cell are filled so no province is cut in two.
4. **Realms and regions.** Each division gets a realm and a region. Europe and Hesperia
   classify them by hand. The World groups divisions automatically within each colony or
   land, clustered to a target area, and names the clusters from the period's names.
   - Exclaves keep their realm.
   - A detached piece of a region joins a neighbouring region of the same realm.
   - Tiny clusters fold into neighbours.
   - Islands shared by realms are divided among regions.
   - A region with no dominant division that holds a capital is named for the capital's
     own land (Rome's region is Lazio, Vienna's Lower Austria), unless that land is the
     city alone (Washington's region is named for North Carolina and Virginia).
5. **Provinces.** The shared generator (`src/maps/gen/world.ts`) divides each region by its
   population and area.
   - Ridges are kept closed except at passes.
   - Rivers follow province borders from source to mouth. A map may let rivers end in a
     lake, as Hesperia does.
   - A province held on only at a corner is detached and given to a neighbour (opt-in).
   - A region whose province would be split is placed again from a nudged seed.
6. **Routes.** Land borders shorter than the minimum are drawn but are not routes. Straits
   come from the definition and from short sea crossings. Islands with no land route are
   reached by transports through their sea zone.
7. **Towns, deposits and sea zones.** Capitals and the largest towns are named and spaced
   out. Deposits are weighted by authored hints (the Ruhr, Kiruna, Baku…). Sea zones are
   made from the drawn coast.
8. **Diplomacy.** Authored claims are placed on the nearest province of the claimed land
   (within 160 km, 260 on the World), never a capital; authored treaties are kept for the
   realms on the map.
9. **Validation and report.** The package is validated, and the generator's own checks
   follow: one-piece provinces, neighbours, and which provinces each realm can reach.
10. **Research pace.** The generator starts a trial campaign and sets the research cost
   multiplier so that research at the start takes the hand-made maps' pace, 40 months
   per technology (`researchPace` in `src/sim/progression.ts`: the median realm's and the
   strongest quarter's three cheapest available technologies). A late start leaves only
   the costly technologies and research follows development, not province count, so a
   multiplier from provinces per realm made Europe and the World about twice as slow as
   the hand-made maps. The calibrated multipliers are Hesperia ×1.2, Europe ×0.82 and the
   World ×0.57.

The older maps keep their own scripts (`genworld`, `genmap`, `genmaps`, `genbaltic`). Every
change to the shared generator in this update was checked by regenerating all of them byte
for byte.

## Authoring a map

There are three routes. All of them produce the same package.

1. **In the browser.**
   - Map library → *New map* generates a map from a seed, size, realm count, shape and
     climate. Or edit a copy of any built-in map.
   - The editor paints realms, regions, terrain and deposits; edits straits, rivers and
     ports; and merges provinces. Every edit can be undone.
   - The validator lists each problem with its place and cause (see below) and a way to
     reach it.
   - The map is saved to the library, exported as a `.json` file and imported elsewhere.
   - A browser check (`npm run verify:web`, `ONLY=maps`) covers the whole round trip:
     generate, edit, validate, export, import, start a campaign, play five weeks, save,
     remove the map from the library, reload, and load the save on its map.
2. **Authored geography**, as Hesperia is (`tools/hesperia.data.ts`).
   - Draw coastlines, lakes and rivers as control points on a sketch grid; they are
     roughened by deterministic midpoint displacement.
   - Place realms and regions by anchor points, and name capitals and cities.
   - The division function shares each landmass among its anchors, with wandering borders
     that stop at mountain walls.
   - Add the definition to `tools/genreal.ts`.
3. **Real geography**, as Europe and the World are.
   - Write a classifier from Natural Earth's first-level divisions to realms and regions,
     with names, ridges, passes and straits. Europe classifies by hand; the World groups
     divisions automatically.

**Validation** reports errors (the map cannot be played) and warnings, each with a code,
a message naming the place, and a reference the editor can select.

- Error codes: `adjacency`, `capital`, `connectivity`, `duplicate`, `geometry`, `port`,
  `range`, `reference`, `route`, `rules`, `size`, `start`, `value`.
- Warning codes: `coast`, `connectivity`, `geometry`, `hole`, `region`, `route`, `start`,
  `value`.
- What they cover: disconnected provinces, a realm that cannot reach its own provinces by
  land or sea, a missing or foreign capital, a realm without land, one-sided or unknown
  neighbours, straits across land, rivers that are not borders, ports with no sea, broken
  identifiers, out-of-range values, oversized files, and treaties at the start that name
  an unknown realm (`reference`), pair a realm with itself (`value`) or are listed twice
  (`duplicate`).
- Imported text is data only. A map file is parsed as JSON, checked against the limits and
  never executed. Names that contain markup are shown as text, which a browser check tests.

## Validation of the new maps

Each report in `reports/maps/` lists the generator's checks and the validator's warnings.
The validator finds **no errors** on any of the three maps. The remaining warnings are
deliberate:

- Islands with no land route are reached by transports: Cyprus, Crete, Majorca, Gotland
  and Lewis on Europe; Greater and Lesser Skerry, Pell and the Sapphire Isles on Hesperia.
  This is checked: every such landmass has a coast on a sea zone.
- Three Europe straits coincide with a land border: the Bosporus, the Strait of Messina
  and the Øresund. The land border is kept.
- Lesbos and Rhodes have no strait to their owner's land; they are reached by sea.
- The Republic of Sapphira is an island realm with no land frontier.

Unit tests (`tests/campaign-starts.test.ts`) check every built-in map: it validates; each
realm owns and controls its capital, which is a supply source; its forces start at home
and in supply; every resource is found somewhere; the victory thresholds can be met; four
weeks of AI play keep the state's invariants; research at the start takes 30 to 70 months
per technology (40 on the generated maps); and Europe and the World start with the
alliances and claims of 1914, with no claim on a capital. The browser check's map
library step requires every built-in map, the World included, to be listed with a drawn
preview.

## Performance on the large maps

The "before" figures in [AUDIT.md](AUDIT.md) were taken on a 4-core Intel Xeon @ 2.10 GHz.
The final measurements are being retaken with `main` and this branch run one after the
other on one machine, so that both sides share the same declared conditions; until they are
in, this section has no figures. The full reports will be in
[`reports/perf/`](../../reports/perf/).

## Simplifications and known gaps

- **Historical borders** follow present-day first-level divisions where they differ from
  1914, as stated above. Neither real map is a historical atlas.
- **The World**:
  - the Arctic north of 78° N and Antarctica are left off;
  - islands under about 2,500 km² are dropped;
  - the Bering Strait lies on the map's seam and has no crossing.
- **Europe**: the deserts at the frame's southern edge are thinly divided.
- **Hesperia**: the Skerries and Pell have no land neighbours; they are reached only by sea.
- **Editor**: it cannot split a province, draw a coastline by hand or reshape sea zones.
  Opening a copy of the World in the editor takes several seconds (see the performance
  section).
- **Starting forces and AI temperaments** on the historical maps are game choices, not
  claims about 1914 armies.
