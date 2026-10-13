# Naval and air warfare: verification

The evidence for the naval, air and combined warfare update. What was wrong before is in
[`naval-air-audit.md`](naval-air-audit.md). The rules are in [`DESIGN.md`](../../DESIGN.md),
in the sections "The navy", "Air power", "Combined warfare" and "AI".

All figures below were measured on this branch. They come from:

- the scenario tests, `tests/naval-air-scenarios.test.ts`. Run with
  `NAVAL_AIR_EVIDENCE=<file> npx vitest run tests/naval-air-scenarios.test.ts`, each scenario
  writes what it measured to [`naval-air-evidence.json`](naval-air-evidence.json);
- AI-only campaigns, `tools/naval-air-usage.ts`;
- the fleet matrix, `tools/matrix.ts`;
- the browser checks, `tools/verify-web.ts`;
- the profiles, `reports/perf/naval-air-*.md`.

## Scenarios through the weekly tick

Each scenario runs the real weekly tick from controlled starting conditions, without the AI,
on the small sea map of the tests (`tests/helpers.ts`). Each one checks that an effect
resolves, and that it stops when its conditions go away.

| Scenario | Without | With | Counterplay or condition shown |
|---|---|---|---|
| **Land battle, with and without air.** 6 infantry attack 6 dug-in infantry; two ground-attack wings on call over the battle | defender loses 276 men in round 1 | 384 men (+39%). The battle names it: "Attacker: Air support +40% from 2 wings (air superiority)" | One wing joins one battle a week: with two battles in its area, it supports only one, the one at its target. Cancelled, the support is gone the next round. Ordered beyond its range, the order is refused: "C1 is out of range: 4 steps from A1; the range is 3." |
| **Contested air and interception.** A bomber raids B1, where two enemy fighter wings patrol | alone, the enemy holds the sky; after 3 weeks the bomber is at 66.9% strength | escorted by two fighter wings, the sky is contested; the bomber is at 82.8% | The interceptors' card says what they did: "Fought for the sky over B1: shot down 5% of an enemy wing; we hold it." What the bombing achieves follows the sky: the target keeps 2.1 industry under the enemy's sky and 1.3 under a contested one |
| **Logistics strikes.** Interdiction over an enemy army; two bombers over a port with a ship on the slipway and a fighter on its airfield | army supply 100% | 60%; "Interdicted 1 enemy army around B1." Port: the shipyard holds at 10 weeks left for two weeks of bombing, and the fighter is grounded (readiness 25%) | "Bombed B1: factories −60%; shipyard halted, repairs halved; 1 enemy wing grounded on the airfield." When the bombing stops, the shipyard resumes the next week (9 weeks left) |
| **Coastal battle, with and without shore bombardment.** A battleship and a cruiser lie off the battle's coast | defender loses 276 men | 342 men; "Attacker: Naval gunfire +23% from A First Squadron offshore" | Ships in another zone, or under way, fire nothing (0 gunfire lines each). Coastal forts at level 2 fire back: 200 → 194 hull, "the coastal forts (level 2) hit back for 6 hull damage". Four wings plus the squadron together are capped: "Fire support capped at +50% (63% committed)" |
| **Raiding and blockade, with counterplay.** Two submarines on the sea route between b and c | trade open 100% | the subs take 40% of the trade passing their zone (83.8% of the trade still gets through) | Three screens in the zone cut the raid to 16.2%. A reconnaissance patrol over the zone lets two screens find three submarines: their hull falls to 148.2 in a week, against 198.8 without it |
| **Sea transport, protected and exposed.** 4 infantry cross the Middle Water, watched by two enemy strike wings and a reconnaissance patrol | two unescorted transports: all 4 regiments lost at sea within 3 weeks | with two screens, a cruiser and two fighter wings over the zone, all 4 regiments land | Troops wait offshore while enemy warships hold the beach waters. The fleet says why ("enemy warships outgun ours"), and no army is ever left half-landed. Invariants hold in all three runs |
| **Carrier beyond land-based cover.** An island battle 4 steps from our airfield, a carrier group offshore | the land-based wing is grounded: "Out of range: C1 is 4 steps from A1; the range is 3." | the wing aboard supports the battle: "Air support +34% from A Ground-attack wing 2" | Decks: "Bomber wings are too heavy for a carrier deck."; "decks are full (2 wings)"; flying aboard costs 30 readiness. An empty carrier gives no support. Below 40% hull: "Flight decks out of action … Repair them in port." Sailing out of range grounds a fixed target with the reason ("Q5 is 6 steps from the carriers of …"), and sailing back resumes it |
| **Carrier strike at sea.** A ground-attack wing and a reconnaissance wing aboard, two enemy cruisers one zone away | — | the cruisers fall from 200 to 136.2 hull in a week, with no surface battle | The targets' anti-aircraft fire blunts each strike; fighters over their zone contest the sky; gun ships that catch the carrier group in its own zone beat it (matrix below) |
| **A prepared war across the sea: Albania, the World 1914.** Albania does not border the Ottoman Empire | before this update, "No war goal" | war of conquest on Aydın and Karesi is allowed. The assessment: "Overland: no route…"; "By sea: Aydın is 1 sea zone from our port of Durazzo. Our transports afloat carry 2 regiments (we have 5)."; warning: "Our transports carry only 2 regiments: a landing that small is easily thrown back." | Prepared: two more transports (10 weeks) lift 6 regiments. The 5 regiments land 1 week after the declaration and take Aydın 2 weeks after it. The beach is then supplied by sea while the fleet holds the water |

### Cancellation, lost bases, ownership, movement, sinking, peace and saves

- **Cancellation.** Support stops the next round when the order is cancelled (above).
- **Destroyed bases.** A wing whose airfield falls flies to an airfield within twice its range,
  or is lost (`tests/air.test.ts`, "a wing whose airfield falls rebases or is lost").
- **Sinking carriers.** The air group flies ashore within reach, or is lost; none keeps flying
  from the sunk ship. Invariants check that no wing is aboard a fleet without decks, or
  beyond deck capacity.
- **Splits, merges and paying off.** Splitting and merging a carrier fleet keeps each air
  group with its decks. A fleet with wings aboard cannot be paid off until they fly ashore.
- **Fleet movement.** Range is counted from where the carrier lies that week. Troops at sea
  are in no province and out of every land phase (`naval.test.ts`).
- **Eliminated targets and ownership changes.**
  - A bombing target no longer held by an enemy ends the order: "no longer held by an
    enemy". Other orders are kept but do nothing, and say why.
  - A support wing with no battle in its area stands by. It does not fly, wear or risk
    anything.
- **Peace.** Peace ends a bombing campaign. The order falls idle with a note, and the
  factories recover the next month.
- **Save and load.**
  - A campaign with wings on missions, a carrier group, a convoy and submarines is saved
    mid-war, reloaded, and played 6 more weeks beside the original. Both reach exactly the
    same state.
  - A format-5 save converts with a notice: "This save was made before the naval and air
    update (save format 5) and was converted to format 6. Its 1 air wing keeps its mission
    and starts fully ready. …"
  - The older fixtures (formats 1–4) still convert (`saves-maps.test.ts`).
- **Determinism.** The same campaign and orders give the same war, week by week.

## Uses and counters for each type

| Type | Use, shown in | Its counter, shown in |
|---|---|---|
| Transport | carries 2 regiments a ship: the Albanian landing | strike aircraft and raiders on the route: the exposed convoy |
| Torpedo boat (screen) | turns raiders away (40% → 16.2%); with recon, sinks submarines | gun ships: in the matrix, battleships and cruisers beat screens of the same cost |
| Cruiser | raids at 1.5, escorts at 1.5, bombards at about 7% | escorts and battleships; strike aircraft |
| Battleship | the surface fight; bombardment of about 16% | submarines (`naval.test.ts`); air strikes (hit twice as often); coastal forts |
| Submarine | trade raiding (40% of a zone's passing trade) | screens, and a reconnaissance patrol that strips their cover |
| Carrier | air support and strikes beyond land-based reach | gun ships that catch it in its own zone (matrix); flight decks out below 40% hull; empty decks |
| Reconnaissance | strikes always find their target; submarines exposed; support and interdiction +20% | fighters (vulnerability 1) |
| Fighter | holds the sky; intercepts; covers fleets and convoys | more fighters; it adds little to ground fire |
| Ground attack | support committed to one battle; interdiction; naval strike | fighters over the target, ground fire, ships' AA |
| Bomber | factories, shipyards, airfields; long-range naval strike | fighters (vulnerability 1.2) and forts; cannot use carriers |

## Fleet matrix

`tools/matrix.ts` (`tests/matrix.test.ts`) fights equal-cost fleets, each pairing both ways
with several seeds:

- no fleet composition wins every pairing, and every type wins at least one;
- a carrier group (two ground-attack wings and a fighter aboard, priced in its budget)
  loses when gun ships catch it in its own zone;
- standing off two zones away, its aircraft strike everything but submarines.

The current table is [`reports/stage-c/combat-matrix.md`](../stage-c/combat-matrix.md).

## The AI, in AI-only campaigns

`npx tsx tools/naval-air-usage.ts <map> 6 2`: six years from seed 2, sampled every week, with
the AI playing every realm by the same rules and commands as the player. The results are in
[`naval-air-usage-earth-1936.json`](naval-air-usage-earth-1936.json) and
[`naval-air-usage-europe-1936.json`](naval-air-usage-europe-1936.json).

| | World 1936 | Europe 1936 |
|---|---|---|
| Weeks with a war somewhere (of 288) | 216 | 171 |
| Wing-weeks: all; of realms at war | 50,488; 8,784 | 23,853; 5,426 |
| Idle while their realm was at war | 838 (9.5%) | 569 (10.5%) |
| Flying, by mission | superiority 3,721; naval strike 1,741; recon 844; interdiction 398; bombing 367; support 42 (plus 681 weeks on call) | superiority 2,063; naval strike 917; recon 551; interdiction 490; bombing 124; support 59 (plus 605 on call) |
| Wing-weeks aboard carriers | 11,866 | 4,586 |
| Land battles; with a support-capable wing of either side in range; with air support | 21; 19; **13** | 33; 26; **22** |
| Land battles with naval gunfire | 7 | 2 |
| Enemy aircraft shot down (wing equivalents) | 88.7 | 36.0 |
| Naval strike hits (hull) | 141.4 | 79.5 |
| Shore bombardment weeks; raiding weeks | 9; 296 | 6; 34 |
| Amphibious landings | 24 | 4 |
| Wars on realms the attacker does not border | 5 | 0 |
| Mission orders changed per 100 wing-weeks | 4.5 | 5.6 |
| Realm-months in debt | 0 of 4,968 | 0 of 2,304 |
| Invariant failures | none | none |

### Before and after the AI changes

At peace, every wing now rests. Before, AI fighters patrolled the capital and the border at
peace: 29,552 of the World's wing-weeks were flown, almost all of them at peace, wearing
down readiness and burning full oil for a sky with no enemy in it.

Ground support is now put on call before a battle begins. Most land battles are fought out
in one week, so an order given after a battle starts arrived too late. Support now waits:

- where an army is about to march onto enemy troops;
- where an army stands next to enemy troops;
- on the beach troops at sea will land on.

On call, support costs nothing until the battle starts. Before this change, 5 of the 23
Europe battles in air reach had air support, and 1 of the 23 World battles; now 22 of 26
and 13 of 19.

In the baseline (the audit), 95% of support wing-weeks were spent over provinces with no
battle at all, and every wing near a battle added to it at once.

## Browser checks

`npm run verify:web`, headless Chromium 141 (software rendering), on the production build, at
the site root, under the project subpath, from the unpacked release ZIP and inside an iframe.
The naval and air checks:

- **Blockade.** Clicking the sea shows the blockaded coast, the fleet card says Blockading,
  and the Military ledger counts it.
- **Air support forecast.** A ground-attack wing's mission is chosen on the map. The attack
  forecast shows the support on call: +14% while the enemy holds the sky, +36% once three of
  our fighter wings hold it.
- **Naval invasion.** Ship by sea, click the beach; the troops sail and land.
- **Carrier.** An empty deck says why it cannot strike. A fighter flies aboard from the
  fleet card, and the air group shows "Decks 1 of 2 wings".
- **Naval strike.** Chosen by clicking a sea zone. The hover names the zone and the steps
  from the base ("2 steps from Serenna (range 3)").
- **Grounded wing.** Its card gives the reason ("Not ready: readiness 10% (flies again at
  25%)"), and Esc cancels choosing a target.
- **Air operations table.** In the Military ledger: each wing, where it flies from (an
  airfield or "aboard Carrier Group"), its mission, its state and its readiness.
- **Albania.** It may declare war on the Ottoman Empire; Diplomacy shows the reach by sea,
  the confirmation repeats it, and the war begins.

The full run's results are in [`reports/web-verification.md`](../web-verification.md).

## Not verified

- **Browsers and hardware.** Only headless Chromium 141 on Linux with software rendering, on
  a 4-core Xeon. Firefox, Safari, mobile browsers, GPUs and real phones were not tried. The
  phone layout and touch checks use Chromium's device emulation.
- **People.** No one but me has played this update.
- **Balance over whole campaigns.** The AI-only campaigns above are one seed per map for six
  years.
