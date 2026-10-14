# Military control, national scale and AI: audit of `main` (b479032) and plan

This audit traces what the code did before this update, checked in play. The rules that
resulted are in [`DESIGN.md`](../../DESIGN.md). The evidence is in
[`control-verification.md`](control-verification.md).

## How it was checked

- **Code.** I read the simulation code (`air.ts`, `naval.ts`, `combat.ts`, `military.ts`,
  `economy.ts`, `game.ts`, `war.ts`, `diplomacy.ts`, `settlement.ts`, `ai/*.ts`) and the
  interface code (`ui/app.ts`, `ui/panels/*.ts`, `ui/map/renderer.ts`).
- **Browser.** `tools/audit-control.ts` played the workflows on the production build of
  `main`, from the prepared Serrata–Aurelian war in `tools/sea-air-save.ts`. It recorded
  each input and what the screen showed. Screenshots and the step table are in
  [`docs/screenshots/control/before/`](../../docs/screenshots/control/before/).
- **Economy.** `.scratch` scripts (summarised here) read every realm of the World 1936 at
  the start, and followed six of them through three years of AI play.
- **AI.** `tools/ai-behaviour.ts` ran six years of AI-only play from seed 2 on the World
  1936 and Europe 1936. It counted how wars ended, who offered peace and why, and the
  treaties proposed.

## Inventory (unchanged from the naval and air update)

- **Ships:** transport, torpedo boat (screen), cruiser, battleship, submarine and carrier.
- **Aircraft:** reconnaissance, fighter, ground attack and bomber.
- **Missions:** superiority, ground support, interdiction, bombing, naval strike and
  reconnaissance.
- **Upgrades:** Steel Warships, Pre-Dreadnoughts, Dreadnoughts, Oil-Fired Boilers, Naval
  Bases, Amphibious Warfare, Convoys, Sonar, Naval Aviation and Fleet Carriers;
  All-Metal Monoplanes, Air Defence and Radar.

The roles and rules of each type are in [`naval-air-audit.md`](naval-air-audit.md) and
DESIGN. There are no paratroopers, no transport aircraft and no anti-aircraft defences
beyond ships' AA and the research modifiers.

## Workflows before this update (production build, recorded)

| Workflow | Steps on `main` | Problem |
|---|---|---|
| Produce and deploy aircraft | Build an airfield in a province card (2 inputs, then weeks). Select the province again, then "Raise … wing" (2). The wing appears idle at the airfield. | The wing is only reachable from that province card or the Military ledger. **Clicking its marker on the map selects nothing.** |
| Rebase, then support a battle | Select the airfield's province (1). Click the wing in its list (1). Scroll to "Change base" and choose a base by name (1–2). Choose "Fly ground support…" (1). Click a province (1): 5–6 inputs. | Rebasing has no map preview of the bases; a base is a name in a list. Rebase and mission are mixed in one long card. Several wings at a base need the whole sequence each. |
| Move a fleet and assign an operation | Click the fleet (1), right-click a sea zone (1). | There are **no operation orders**. The card offers Sail, Merge and "Pay off the fleet". Blockade, raiding, escort and bombardment happen implicitly to whatever lies still. There is no return-to-port, patrol or escort order, and no way to tell a fleet to stop raiding or shelling. |
| Assign and operate carrier aircraft | Select the carrier group (1). "Fly … aboard" per wing within ferry range (1 each). Then the wing card for each mission (3+ each). | The deck works, but missions are given one wing at a time from a different card. |
| Transport an army overseas | Select the army (1). "Ship by sea" (1). Click the beach (1). | Works when a fleet with room already lies off the army's coast; otherwise disabled, with the reason. The fleet card does not show which armies it could carry or the route's exposure. |

## National scale (World 1936 at the start, seed 1)

- **Population is too small.** It is stored per province in thousands: Germany 1.2 million,
  Britain 4.7 million, Albania 36,000 people.
- **Albania has no manpower.** The reserve is 40 men per thousand people × (0.2 + 0.8 ×
  integration), so Albania's is 2,304 men. Every realm starts with at least five
  regiments of 1,000 men (`game.ts`: `regs = max(5, …)`), so 5,000 serve. The pool is
  reserve minus serving, clamped at 0. **19 of 69 realms** start with a pool and a cap of 0:
  Albania, the Baltic states, Central America, Paraguay, Afghanistan and others.
- **Small realms start bankrupt-bound.** Albania earns 7.24 crowns a month and pays 12.2:
  army 5.9, a home fleet 3.7 (every coastal realm gets a cruiser, a transport and two
  torpedo boats), forts 2, research 0.6. 19 realms start with a deficit.
- **Commerce is a flat payment per agreement.** Each trade agreement pays 1 crown a month
  to each partner, whatever their size (`economy.ts`). So every realm signs with every
  other. After two years Albania holds 67 trade agreements and earns 73 crowns of
  "commerce" against 7 of taxes. Latvia earns 88 against 10. In six years of AI play the
  World 1936 sees **2,253 trade-agreement proposals**, and 2,224 agreements stand at the
  end. Income no longer reflects national size or production, and the flat envoy cost
  (1.5 a month each) is paid out of this windfall.
- **Casualties barely deplete the reserve.** A man killed is taken from the population, so
  the reserve falls by only 4% of the dead (the reserve share). He no longer counts as
  serving, so the pool's cap rises by 96% of him and refills at 1/40 of the reserve a
  month. Long wars cost little manpower beyond the moment.

## AI before this update (six years, seed 2)

| | World 1936 | Europe 1936 |
|---|---|---|
| Wars; ended | 37; 33 | 18; 18 |
| Wars ended by a winner's settlement | 30 | 18 |
| White peace agreed (losing or tired) | 4 | 0 |
| Losing realms' offers judged refused (white peace each time) | 18 | 26 |
| **Concessions offered by a losing realm** | **0** | **0** |
| Treaty proposals: trade; non-aggression; alliance | 2,253; 114; 40 | 455; 45; 16 |

- **The reported white-peace case.** In `considerPeace` (`ai/strategic.ts`), a realm at
  war score −25 or worse tries white peace first. To a human that offer is always "sent",
  so the function returns before reaching the concession branch (score −35 and below).
  With a 3-month cooldown it offers white peace again and again, however much of its land
  is occupied. Against another AI, the white offer is refused and the concession branch
  is reached only at −35. In 12 years of campaigns no losing realm ever conceded.
- **One number decides.** Peace uses a single war score (occupation share, battles and
  the goal) with fixed thresholds: exhaustion 45, 36 months, −25, −35. Remaining field
  strength, reserves, the economy, whether the occupied land can be retaken, and the
  enemy's own position are not weighed.
- **Winning realms.** A winning war leader proposes a settlement. A winning ally never
  offers anything. No offer is remembered; the same terms come back every 3 months
  whatever the answer was.
- **Diplomacy.**
  - Alliance and non-aggression proposals exist, for AI and player alike, at most one a
    month.
  - The reasons are narrow: a shared threat, or a stronger bordering neighbour for a pact.
  - The proposal carries no stated reason.
  - A rejection is remembered only as a 6- or 18-month timer.
  - Trade agreements dominate because commerce is free money.
- **National management.**
  - The budget sets an army target from the income share, 75% of the reserve and food.
  - Research and focus follow fixed scores.
  - Envoys are paid whatever the income (Albania: 6 crowns a month).

## Plan

1. **Economy and manpower** (`economy.ts`, `game.ts`, `naval.ts`, `config.ts`, migration to
   format 7):
   - **Population.** A population unit is 10,000 people, and every figure shows people.
   - **Reserve.** 5% of people are fit for service, scaled by integration. War losses
     deplete it and recover over about ten years. The pool refills at 1/60 of the reserve
     a month.
   - **Starting forces scale with means.** The army costs at most about a third of
     income; the home fleet only what the realm can afford.
   - **Commerce scales with the partners' economies** and is capped at a share of the
     realm's own taxes.
   - **Flat costs follow income.** Envoys and forts are among them.
   - **Interface.** A revenue and expense breakdown that matches the ledger.
2. **AI** (`ai/strategic.ts`, `war.ts`, `diplomacy.ts`):
   - **War assessment.** Occupation both ways, capitals, field strength near the fronts,
     reserves, finances, allies and whether lost land can be retaken. A prospect replaces
     the single score.
   - **Offers.** Candidate terms are compared and the best one the other side would
     plausibly accept is offered. Winning realms offer as well, including to the player.
     Offers are remembered, with cooldowns and leverage-change exceptions.
   - **Treaties.** Alliances and non-aggression pacts are proposed for stated reasons and
     judged by the recipient's interests.
   - **Personality.** Risk tolerance and patience come from the personality.
   - **Traces.** Decisions are logged with their reasons and the alternatives rejected.
3. **Control** (`ui/app.ts`, `ui/panels/sea.ts`, `ui/map/renderer.ts`, `naval.ts`):
   - Wings are selectable on the map.
   - A selected wing shows its bases and coverage. Clicking a base rebases the wing;
     clicking a battle, fleet or area offers the missions that fit, with reasons.
   - Several wings at a base can take one order.
   - Fleets take explicit orders: hold, patrol, blockade, raid, escort a fleet, shell a
     coast, return to port. Each shows its target and route, and can be cancelled.
4. **Paratroopers and anti-air:**
   - an airborne regiment;
   - a transport wing;
   - an airborne operation: prepare, review, launch, land or abort;
   - provincial anti-aircraft batteries;
   - mobile anti-aircraft for armies with anti-air guns.

   Resolution runs through the air phase and combat.
5. **Combined warfare:**
   - airfields and ports captured or bombed change what depends on them;
   - coastal forts threaten ships that blockade or shell their coast;
   - support and threats are shown in battles, forces, bases and routes.
6. **Verification:** scenario tests for each relationship and each AI situation, AI
   campaigns, browser workflows, saves and profiles.
