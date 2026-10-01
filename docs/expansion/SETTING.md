# Setting decision: the Industrial Age (c. 1870–1950)

Status: decided in Stage A. Implementation starts in Stage B. Nothing in this document
is in the game yet.

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

Naval units live in **sea zones**, a new node type in map package v2 (Stage C). Aircraft
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
   deleted. It stays in the save list, marked "made with the 1640 rules (game version
   0.2)", with its reason, and it can still be exported.
3. Unit tests cover every conversion with fixtures from formats 1 and 2. A browser
   check covers the notice.
