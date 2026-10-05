# Setting decision: the Industrial Age (c. 1870–1950)

Status: decided in Stage A. **Stage B implemented** the calendar, the six resources,
industry, trade, the research eras for land, industry and society, the land roster and
save format 3. **Stage C implemented** sea zones (map format 3), ports, fleets, naval
combat, blockades and landings, airfields and air wings, and the naval and air
technologies. The decisions taken while implementing are listed at the end.

## The decision

The expansion moves Crown & Frontier from 1640 to **the industrial age**. Campaigns start
between 1870 and 1895 and end between 1910 and 1955, depending on the map and the
campaign length. The realms are fictional crowns, republics and compacts, as they are now.
The game keeps its identity: you still rule a crown, integrate a frontier and hold what you
take. The tools change around it: railways, steel, coal, oil, navies, and in the second
half of a campaign, aircraft.

### Why this era

| Requirement | 1640 (current) | Napoleonic | **Industrial age, 1870–1950** | 1936–1945 only |
|---|---|---|---|---|
| Land warfare with depth | yes | yes | yes: rifles to armour, rail logistics, trench lines | yes |
| Navy | sail only | sail only | ironclads to carriers, with submarines and blockades | yes |
| Air warfare | no | no | **yes, arriving mid-campaign** | yes, from the start |
| Progression arc in one campaign | weak (18 techs end the tree) | weak | **strong: five eras with new arms** | flat: most arms exist from the start |
| Economy with 5–7 resources | forced | forced | **natural: coal, iron, oil, rubber, nitrates, food** | natural |
| "Frontier" and integration still fit | yes | partly | yes: settler frontiers, colonies, rail-linked hinterlands | weak |
| Avoids real-world atrocity framing | yes | yes | yes, with fictional realms | hard |

Only the industrial age gives all three arms of war, a five-era progression and a natural
resource economy inside one campaign. It also keeps the existing frontier and integration
systems meaningful.

## Calendar and campaign length

Larger maps start earlier. A long campaign then spans more eras, and quick maps still
reach aircraft.

| Map size | Start | Short | Standard | Long |
|---|---|---|---|---|
| Small (quick, < 150 provinces) | 1895 | 25 years → 1920 | 40 → 1935 | 60 → 1955 |
| Standard (150–450) | 1880 | 40 → 1920 | 60 → 1940 | 70 → 1950 |
| Large (450+) | 1870 | 40 → 1910 | 60 → 1930 | 80 → 1950 |

Each map's own package sets its start year and campaign lengths in `rules`. The table is
the default for new maps.

## Eras and the research horizon

Technology is grouped into five eras. Each technology has a **horizon year**. Researching
a technology before its horizon year costs 15% more per year early, and it cannot finish
more than 10 years early. This keeps aircraft out of 1875, while a realm that commits to
research can still lead by a few years.

| Era | Horizon | Land | Sea | Air | Industry and state |
|---|---|---|---|---|---|
| I · Rifle & Rail | 1870 | Breech-loading infantry, cavalry, field guns, railway logistics | Ironclads, torpedo boats, transports | — | Coal and iron, railways, telegraph |
| II · Steel & Breech | 1885 | Magazine rifles, quick-firing artillery, fortress belts | Steel cruisers, pre-dreadnoughts, coastal batteries | — | Steel, chemical industry (nitrates), conscription |
| III · Dreadnought & Engine | 1900 | Machine guns, heavy artillery, motor transport | Dreadnoughts, submarines | First reconnaissance aircraft (~1908) | Oil, electricity, mass production |
| IV · Total War | 1915 | Trench systems, early tanks, storm infantry | Battlecruisers, convoys, early carriers (late in the era) | Fighters, ground attack, first bombers | War economy, rubber, rationing |
| V · Mechanised | 1925 | Armour divisions, motorised infantry, combined arms | Carriers, fleet aviation | Monoplane fighters, strategic bombers, air defence | Synthetic fuels and rubber, radio |

The current tree has 18 technologies, and AI realms complete almost all of it (17.9 of
18 by the end of a 60-year Aldmere campaign; see AUDIT.md). The new tree is planned at
60–80 technologies across five eras, plus national focus trees (Stage E). It should still
leave real choices at the end of a long campaign.

## Unit roles

The roles stay few and readable. Each era improves a role instead of adding a new
unit for every model.

- **Land:** infantry, cavalry (fades after era III), artillery, armour (era IV), and
  engineers for forts and rail.
- **Sea:** transports (needed to carry armies by sea), screens (torpedo boats and
  destroyers), cruisers, capital ships, submarines (era III) and carriers (era IV/V).
- **Air:** reconnaissance (era III), fighters, ground attack, strategic bombers (era IV).

Naval units live in **sea zones**, a new node type in map package v3 (Stage C; v2 added the deposits in Stage B). Aircraft
fly from **airfields** in provinces, with a range in map distance.

## Resources

Crowns (money), manpower and the existing supply stockpile remain. Provinces produce
six strategic resources.

| Resource | Comes from | Needed for |
|---|---|---|
| Food | Plains, river valleys; replaces "grain" | Population growth, manpower recovery, supplies |
| Coal | Hills, mountains | Industry, railways, early steam fleets |
| Iron | Hills, mountains; replaces "iron" | Steel: artillery, ships, armour, forts |
| Oil | Rare deposits, some coasts and steppe | Fleets after era III, armour, aircraft |
| Rubber | Few southern and frontier provinces | Motor transport, aircraft, armour (era III+) |
| Nitrates | Deserts, coasts and chemical industry (era II+) | Ammunition and artillery, fertiliser |

Shortages are visible and explained. A shortage lowers output of the goods that need the
resource, and it never blocks the game. Trade agreements become exchanges of real resource
flows. That replaces today's flat income bonus, which gives about half of every realm's
income (AUDIT.md, "Dominant strategies").

## What stays

These systems carry over, adapted to the new era: frontier integration and
administrative capacity, unrest and revolts, supply lines, sieges and forts, war score and
war goals, coalitions and alarm, treaties, the three victory paths and campaign score,
difficulty levels, the command boundary and AI layers, determinism, and save versioning.

## Saves from the 1640 game

Stage B introduces save format 3 for the new rules. The conversion is explicit and
always explained to the player:

1. **Format 1 or 2 saves convert where it is feasible.** Provinces, owners, control,
   integration, unrest, treaties, wars and treasury carry over. Foot becomes infantry,
   horse becomes cavalry, and guns become artillery. Researched technologies map to their
   nearest era-I equivalents. The calendar is rebased to the map's new start year plus
   the elapsed time. A notice lists what was converted and what was approximated.
2. **If a conversion is not possible** (for example, an unknown map), the save is never
   deleted. It stays in the save list, marked "made by an earlier version (save format
   N)", and loading it shows the reason. It can still be exported from the save list.
3. Unit tests cover every conversion with fixtures from formats 1 and 2. A browser
   check covers the notice.

## Decisions taken in Stage B

- **Materiel** is the one industrial output. Factories turn coal into materiel; regiments
  cost materiel and resources besides crowns, and replacing losses costs materiel. A
  separate production line per unit type was rejected: it would add a screen of
  bookkeeping without a new decision.
- **Food** is the existing supply stockpile, renamed. Food deposits replace grain.
- **Coal never stops the game.** A factory without coal keeps 30% of its capacity (water
  power, short shifts). Missing iron or rubber does block building the units that need
  them, and the recruit buttons say so; nothing else stops.
- **The tree has 54 technologies after Stage B** (land 19, industry 18, society 17 across
  the five eras). Stage C adds the naval and air branches, which brings it to the planned
  60–80. Every realm starts with the technologies whose horizon is five or more years
  before the start (7 on Aldmere, 20 on the Reach).
- **Land roster:** infantry, cavalry, artillery, engineers (Engineering Corps, 1885) and
  armour (Tanks, 1916). Cavalry fades through machine guns, which cut its fire, rather than
  by removal.
- **Resource placement on existing maps** is converted deterministically from each
  province's old resource, terrain and id (`src/maps/deposits.ts`), so the maps keep their
  character: grain becomes food; iron becomes iron or coal; the horse steppes hold oil or
  food; old trading wealth becomes coal or nitrates; and some provinces without a resource
  gain coal (hills, mountains), oil and rubber (marsh, forest) or nitrates (steppe, plains).
  Oil and rubber stay rare.
- **Trade** moves surplus above 40% of a stockpile to a partner below 40%, at fixed prices,
  plus 1 crown of commerce per agreement. The flat income bonus is gone; in AI batches trade
  is about 10–12% of income at year 25 (it was about half).

## Decisions taken in Stage C

- **Sea zones are generated, then stored.** Zones come from the drawn coastline by a
  deterministic method (`src/maps/seazones.ts`), so every existing map, including
  imported format 1 and 2 packages, gets a navy without hand authoring. Map format 3
  stores them, so an author can change them later (Stage D's editor).
- **Ports are a province project** (levels 1–3), like forts; the built-in maps start with
  ports at the realms' main harbours. One slipway per level.
- **Fleets fight in zones, armies on land.** Troops at sea take no part in land battles
  and cannot be ordered; they land on the coast they were sent to and fight at 75% that
  week. A full amphibious-assault model (beaches, naval gunfire) was rejected as more
  bookkeeping than decisions.
- **Sea control has two effects only:** straits (closed while enemy warships outgun ours in
  the commanding zone) and blockades (a quarter of a coast's crowns and its share of sea
  trade). Convoy raiding as a separate mission was rejected: submarines already blockade.
- **Aircraft are wings, not individual planes**, based at airfields (two per level) and
  flying one mission each over a province and its neighbours. Range is counted in province
  hops, so it means the same on every map.
- **Carriers strike before the guns close.** Without that, carrier groups lost every
  equal-cost pairing in the combat matrix; with it, each fleet type beats at least one other
  and none beats all (`reports/stage-c/combat-matrix.md`).
- **The tree has 73 technologies** (land 19, industry 18, society 17, naval 12, air 7).
  Every realm starts with those five or more years before the start (7 on Aldmere, 23 on
  the Reach).
- **Saves stay at format 3.** Fleets, ports and wings were added to format 3 with defaults
  and a notice, instead of a format 4: no Stage C release was published between them.

