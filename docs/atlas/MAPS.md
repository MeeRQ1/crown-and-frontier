# Maps: the shared format, the pipeline and the three new campaigns

This update adds three campaigns: **The World, 1914** (huge, historical), **Europe, 1914**
(large, historical) and **Hesperia, 1890** (large, original). They are built by one
pipeline, `tools/realmap.ts`, which also accepts authored geography. They ship in the same
map package format as the older built-in maps and the maps made in the editor, pass the same
validator and run on the same simulation and renderer. No campaign has its own rules or
drawing code.

## The campaigns

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
| **Europe, 1936** | historical (Natural Earth) | **689** | **32** | 0 | 249 | 78 | 11 | 98 |
| **The World, 1936** | historical (Natural Earth) | **1,231** | **69** | 0 | 397 | 167 | 33 | 83 |

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

## The 1936 campaigns

**Europe, 1936** and **The World, 1936** start on 1 January 1936. They were added by the
performance and stability update, after the performance work was verified.

### What they reuse and what they change

**One geographic foundation.** Each 1936 map reuses its 1914 counterpart's geography
unchanged (`tools/europe1936.data.ts`, `tools/earth1936.data.ts`):
- the frame, projection and province density;
- climate zones, mountain walls and passes;
- straits, lakes, rivers, seas and deposit hints.

Only what 1936 changed is authored:
- realms and their colours and arms;
- the realm and region of each present-day first-level division;
- the names in use in 1936;
- town populations of about 1936 (the World);
- the treaties and claims of the day.

The refactor that lets the World 1936 share the 1914 tables (exports, and a region namer
parameterised by period names) leaves the 1914 maps byte-identical when regenerated.

**Density, chosen deliberately.** The province density is the same as on the 1914 maps:
- Europe: 12,500 km² per province before a region's sparseness;
- the World: 90,000 km².

Two reasons:
- the measured performance of the 1914 maps carries over;
- a player moving between 1914 and 1936 meets the same scale.

The counts follow from the borders: 689 provinces against 686 for Europe, and 1,231
against 1,225 for the World.

**Realm count.** The realm count grows with the successor states: 32 against 23 on Europe,
69 against 57 on the World. Two limits were raised for it:
- the world generator's cell labels now take up to 126 realms;
- imported maps may have up to 96 realms.

### Realms and borders

**Europe** has these realms:
- the United Kingdom (with Malta, Cyprus and the mandates of Palestine and Transjordan);
- the Irish Free State;
- France (with North Africa and the mandates of Syria and Lebanon, Alexandretta included);
- the German Reich (with the Saar, since March 1935);
- Italy (with Venezia Giulia, Fiume, Libya and the Dodecanese);
- the Soviet Union;
- Poland, Czechoslovakia, Austria, Hungary, Romania, Yugoslavia, Bulgaria, Greece, Albania;
- Turkey;
- Spain and Portugal;
- the Low Countries and Luxembourg, Switzerland;
- the Scandinavian kingdoms, Finland, Estonia, Latvia and Lithuania;
- Egypt, Iraq and Iran.

Yugoslavia is divided into its nine banovinas of 1929.

**The World** adds:
- Saudi Arabia, Yemen and Oman;
- Afghanistan and Nepal;
- Nationalist China, Manchukuo (with Jehol), Tibet and the Mongolian People's Republic;
- Japan (with Korea, Formosa, Karafuto and the South Seas mandate) and Siam;
- Ethiopia and Liberia;
- the dominions;
- the American republics.

The German colonies are League mandates:
- Tanganyika, the British Cameroons and British Togoland to Britain;
- Cameroun and Togo to France;
- Ruanda-Urundi to Belgium;
- South West Africa to South Africa;
- New Guinea and Nauru to Australia;
- Western Samoa to New Zealand;
- the South Seas to Japan.

Other changes on the World:
- Jubaland is Italian;
- Tacna is Peruvian again (1929) and Leticia Colombian (1934);
- Ifni (occupied in 1934) is Spanish;
- Svalbard is Norwegian.

### Frontiers approximated

Borders follow present-day first-level divisions where they match those of 1936. Where they
do not, they are approximated with longitude and latitude lines inside a division. These
are approximations at the scale of a cell (about 10 km on Europe), not surveyed lines:
- **The Polish Corridor and the Free City of Danzig:** the Pomeranian voivodeship split
  between German Pomerania, Danzig, Polish Pomorze and East Prussia's right bank of the
  lower Vistula.
- **East Upper Silesia:** Katowice Polish; Gleiwitz, Hindenburg and Ratibor German.
- **The Grenzmark**, and Soldau and the Lubawa land.
- **The Riga line** through the Minsk and Vitebsk oblasts.
- **The Vilnius region:** Vilniaus county, with southern Alytus and eastern Utena.
- **The Karelian Isthmus, Ladoga Karelia and Petsamo.**
- **Petseri and Abrene.**
- **The Budjak**, west of the Dniester estuary.
- **Transnistria:** the Moldavian ASSR, Soviet.
- **The Slovenian Littoral and the Karst**, Italian.
- **Fiume, Abbazia, Cherso and Lussino.**
- **Hatay**, in French Syria.
- **Jehol and the eastern Mongol banners**, in Manchukuo.

### Simplifications

- **The Free City of Danzig** is a Polish region of its own, claimed by Germany. Poland held
  its customs and foreign relations; on this scale it is one province.
- **The Italo-Ethiopian war** (from October 1935) cannot be a starting war. Ethiopia is
  independent and Italy claims it.
- **China's warlord provinces and the Communist base** are drawn as Nationalist China.
- **Folded into a neighbour:**
  - Tannu Tuva into the Soviet Union;
  - Iceland, in personal union, into Denmark;
  - Newfoundland, under a commission from London, into Britain;
  - on the World, Luxembourg, in economic union, into Belgium.
- **Left off Europe:** northern Arabia and Kuwait, whose capitals lie beyond the frame, as
  Kuwait was in 1914.
- **The Rhineland** is German (remilitarised only in March 1936). The game has no
  demilitarised zones.

### Treaties and claims of the day

**Alliances:**
- France with Poland, Czechoslovakia and Belgium;
- the Little Entente;
- the Polish-Romanian alliance;
- the Balkan Pact (Greece, Romania, Turkey, Yugoslavia);
- the Soviet-Czechoslovak pact;
- Britain with Portugal and Iraq;
- Italy with Albania;
- Estonia with Latvia;
- on the World also: Britain with the dominions, Japan with Manchukuo, the Soviet Union
  with Mongolia.

**Non-aggression pacts:**
- Locarno;
- the German-Polish declaration;
- the Soviet pacts with its neighbours and France;
- the Treaty of Berlin;
- the Italo-Soviet pact;
- on the World also: the treaty of Taif.

**Trade agreements:**
- the Rome Protocols;
- the Oslo states;
- the Belgian-Luxembourg union;
- Germany's clearing agreements with Hungary and Yugoslavia.

**Left out**, because they come later in 1936:
- the Franco-Soviet mutual assistance treaty (in force from March 1936);
- the Anglo-Egyptian treaty;
- the Axis;
- the Anti-Comintern Pact.

**Claims:**
- Germany on Danzig, the Corridor, East Upper Silesia and Memel;
- Hungary on southern Slovakia and Ruthenia, Transylvania and the Bačka;
- Bulgaria on Southern Dobruja, Vardar Macedonia and Western Thrace;
- Lithuania on Vilnius;
- Poland on Zaolzie;
- the Soviet Union on Bessarabia;
- Greece on the Dodecanese;
- Ireland on Northern Ireland;
- Turkey on the Sanjak of Alexandretta;
- on the World also: Italy on Ethiopia, China on Manchuria and Jehol, Bolivia on the Chaco
  Boreal, Argentina on the Falklands.

On the World's scale a claim lands on the province that holds the claimed land. That
province may be named after a larger town nearby (the Bessarabia claim falls on the province
named Iași). Lithuania there is a single province, its capital, so Germany's claim on
Memel has no province to fall on.

### Sources

- The frontiers come from:
  - the peace treaties of 1919–23 (Versailles, Saint-Germain, Trianon, Neuilly, Lausanne);
  - the later frontier treaties (Tartu and Riga, Kars, the Memel Convention);
  - the Saar plebiscite of 1935;
  - as summarised in standard historical atlases (the Times Atlas of European History,
    Magocsi's Historical Atlas of Central Europe).
- The alliances and pacts come from the League of Nations Treaty Series.
- Town populations come from the censuses of the early 1930s for the larger cities. Smaller
  towns grow from their 1914 figure by their country's urban growth.
- Nothing invented is presented as fact: the description and the map report
  (`reports/maps/*-1936-map.md`) say the borders are approximated, and arms are simplified,
  in national colours, with no political emblems.

### Validation

- The validator finds no errors on either map. The warnings are those of the 1914 maps:
  islands reached by transports, straits that coincide with a land border.
- Each map's report lists:
  - every realm's provinces, development and capital;
  - every region;
  - the treaties;
  - every claimed province.
- `tests/campaign-starts.test.ts` checks both maps on top of the checks every built-in map
  passes (capitals owned, controlled and supplied, forces at home and in supply, every
  resource present, victory reachable, four weeks of AI play keeping the invariants, research
  at the calibrated pace):
  - the treaties of 1 January 1936, and none of the later ones;
  - the claims;
  - the realms of 1936 and none of 1914's;
  - for Europe, fifteen towns whose frontier moved since 1914, each in the realm that held
    it (Danzig, Wilno and Lwów Polish, Klaipėda Lithuanian, Cluj and Chișinău Romanian,
    Trieste Italian, Alexandretta French, Kars Turkish, Enso and Kolosjoki Finnish…);
  - for the World, the mandates (Windhoek South African, Madang Australian) and Manchukuo.
- **AI batches** (`reports/ai/1936-*.md`): AI-only campaigns of ten years from fixed seeds
  (`npm run sim -- --scenario <map> --seeds 1-4 --years 10`):

| Map | Seeds | Winners | Wars per campaign | Battles per campaign | Realms eliminated | Invariant failures | ms per week (Node, average / worst) |
|---|---|---|---|---|---|---|---|
| Europe, 1936 | 1–4 | Soviet Union ×4, on score | 24.3 | 150 | 0 | 0 | 43 / 123 |
| The World, 1936 | 1–3 | Britain ×3, on score | 44.7 | 189 | 0 | 0 | 161 / 410 |

  The largest starting realm leads on score, as on the 1914 maps. Every realm built
  factories, ships where coastal, and air wings. Realms finished about 97% of the research
  tree within the ten years, since a 1936 start leaves six technologies.

### Performance

`reports/perf/profile-1936.md` compares the 1936 maps with the World, 1914, on this
branch's production build:
- same machine, same workloads;
- each map after five years of AI play from seed 1;
- run with nothing else busy.

| Workload | The World, 1914 | Europe, 1936 | The World, 1936 |
|---|---|---|---|
| Drag at regional zoom: frame p95, drag acknowledged p50 | 16.8 ms, 17.3 ms | 16.8 ms, 17.0 ms | 16.8 ms, 17.9 ms |
| Drag at the medium tier: frames over 33 ms | 16 of 944 | 27 of 897 | 20 of 890 |
| Twelve wheel steps: frame p95, worst | 66.7, 150 ms | 50, 117 ms | 50, 167 ms |
| Ledgers: worst input | 200 ms | 152 ms | 168 ms |
| Fastest speed: weeks a second (of 6), frame p95 | 5.8, 33.4 ms | 5.9, 16.8 ms | 4.6, 33.4 ms |
| Fastest speed while dragging: frames over 33 ms, drag p50 | 4 of 1000, 40 ms | 3 of 915, 28 ms | 17 of 995, 37 ms |

Both maps meet the targets the World, 1914 meets: drags acknowledged within about
a frame at regional zoom, no long freezes. Two costs remain:
- **The World, 1936's clock** reaches 4.6 of 6 weeks a second at the fastest speed, against
  5.8 on the World, 1914, because twelve more AI realms plan every week.
- **Right after loading**, both World maps settle for a second or two while base tiles are
  rasterised in software.

## Sources and attribution

- **Natural Earth** v5.1.2 (naturalearthdata.com) supplies the World's and Europe's land,
  lakes, rivers, first-level divisions and towns. It is in the public domain.
  - `tools/realmap.ts` downloads the layers into `.cache/naturalearth/`, which is not
    committed, and refuses any file whose SHA-256 does not match the pinned value.
  - The credit appears in the map library, the campaign setup, the in-game menu and
    [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
- **Authored in this project:**
  - for the real maps, in `tools/europe.data.ts` and `tools/earth.data.ts` (and for 1936 in
    `tools/europe1936.data.ts` and `tools/earth1936.data.ts`): which division
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

`main` (99e0322) and this branch (6153e86, the final simulation code) were measured one
after the other on one machine with nothing else running: a 4-core Intel Xeon @ 2.80 GHz,
Node 22.22, headless Chromium 141 with software rendering at 1366 × 768. The "before"
figures in [AUDIT.md](AUDIT.md) came from a different machine (2.10 GHz) and are not
compared here. The full reports are in [`reports/perf/`](../../reports/perf/)
(`atlas-final-*`, `web-atlas-final-*`).

**Simulation**, AI only, milliseconds per week (seed 1 / seed 2). The budget at the
fastest speed is 166 ms a week. Europe, Hesperia and the World are not on `main`.

| Map | Years | main: average | main: p99 | branch: average | branch: p99 | branch: slowest week | branch: save / load at the end |
|---|---|---|---|---|---|---|---|
| The Reach | 30 | 3.83 / 4.02 | 10.3 / 11.8 | 3.60 / 3.46 | 10.8 / 9.0 | 26.8 | 2.2 / 7.7 ms, 208 KB |
| Aldmere | 30 | 10.14 / 9.37 | 29.0 / 23.5 | 8.60 / 7.65 | 21.7 / 16.4 | 44.4 | 5.4 / 14.7 ms, 347 KB |
| The Middle Sea | 30 | 16.39 / 16.69 | 53.7 / 42.5 | 12.38 / 11.99 | 32.8 / 27.7 | 77.6 | 4.6 / 16.7 ms, 457 KB |
| Europe, 1914 | 10 | — | — | 39.6 / 36.6 | 91.3 / 79.2 | 234.3 | 6.3 / 25.1 ms, 572 KB |
| Hesperia, 1890 | 10 | — | — | 25.0 / 23.1 | 62.1 / 49.7 | 79.1 | 6.0 / 23.9 ms, 548 KB |
| The World, 1914 | 10 | — | — | 137.9 / 139.2 | 272 / 297 | 378.1 | 12.9 / 50.9 ms, 1.1 MB |

The hand-made maps got faster despite the new systems (the Middle Sea by about a
quarter): the access and supply searches were made cheaper for the World, and the AI
works from distance fields and weekly memos. On `main`, Aldmere's second seed ended in
a victory after 996 weeks, so its average covers a shorter campaign.

On the World the average week fits the budget in its first ten years, but one week in a
hundred takes 270–300 ms. In a world war it is heavier (below).

**In the browser** (milliseconds; the first frame includes loading the map's geometry):

| Map | Build | Page load to menu | First frame of a campaign | Draw at medium zoom, avg / p95 | Fastest speed: weeks in 6 s (target 36), frame p95 | Heap after 10 years |
|---|---|---|---|---|---|---|
| The Reach | main | 222 | 519 | 3.4 / 4.7 | 36, 24.6 | 32 MB |
| The Reach | branch | 401 | 1,071 | 5.1 / 19.2 | 36, 25.5 | 35 MB |
| Aldmere | main | 284 | 735 | 6.0 / 19.1 | 36, 40.3 | 38 MB |
| Aldmere | branch | 440 | 747 | 7.4 / 22.3 | 36, 39.2 | 23 MB |
| Europe | branch | 444 | 2,897 | 10.3 / 30.5 | 36, 56.9 | 36 MB |
| Hesperia | branch | 596 | 2,449 | 13.2 / 31.2 | 36, 59.0 | 58 MB |
| The World | branch | 499 | 3,827 | 11.8 / 26.7 | **28**, 91.2 | 114 MB |

- **The atlas costs some drawing time.** Page load rises by about 150–180 ms (the two
  fonts and the art), and map modes with washes and motifs draw more slowly at the 95th
  percentile (Aldmere's terrain mode 5.1 → 17.9 ms). Frames at the fastest speed are
  unchanged on the Reach and Aldmere.
- **The World at the fastest speed** works out 28 of the 36 weeks a 6-second run should
  give: the clock runs at about three quarters of the setting in peacetime.
- **A world war on the World** (seed 1 at week 280: 3 wars, 205 armies): working out a
  whole week per frame, as before this update, gave frames of 499 ms on average and
  704 ms at worst (2.0 weeks a second). Worked out in slices of 24 ms between frames,
  frames average 104 ms, with a p95 of 275 ms and a worst of 382 ms (1.5 weeks a
  second): the map and controls keep responding, but a single unit of AI work can still
  take a few hundred milliseconds, and the clock runs at a quarter of the setting.
- **Far zoom** uses the level of detail on every map; on Europe and the World the frame
  average at far zoom falls from 95 to 45 ms and from 174 to 59 ms with it.

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
  Opening a copy of the World in the editor takes about 0.7 s in software rendering
  (`reports/perf/lag-diagnosis.md`).
- **The 1936 maps** start late in the research tree: six technologies remain, and AI realms
  finish nearly all of it within ten years. There are no technologies, units or rules
  beyond 1936.
- **Starting forces and AI temperaments** on the historical maps are game choices, not
  claims about 1914 armies.
