# Player-style sessions (Stage F)

These sessions were played in the browser build, not through the simulation API: every
order went through the interface (clicks, right-clicks, keys, the ledgers and the dock),
in headless Chromium 141 at 1366×800 with software rendering, driven one action at a time
from a script that kept one page open and took a screenshot after each step. Each finding
below was seen on screen; the fixes were checked in the same session and are covered by
`npm run verify:web` where noted. No one but the author has played these builds, and no
real device, other browser or touch screen was used.

## Session 1 — the Sundered Isles as the Clans of Dunach (1885–1899)

Dunach is a small island realm (11 provinces, "Maritime trader") with no neighbour by land.

**What was played.** The tutorial, step by step (the capital, a railway, the Resources
overlay, a regiment, a march, the Supply and Frontier overlays, Sea control, Diplomacy, a
national focus, Wars, Victory). Then fourteen years:
- the national focus branch in order (Dunachish Bulwark, Develop Dunar Isles, Navy League,
  Coal Concessions) and later generic focuses, research of Steel Warships and Magazine
  Rifles, research funding raised to Generous;
- settling the frontier islet of Wendhaven across a strait;
- trade agreements with four realms, envoys to Sandland and Kalda, the Dunachish Customs
  Union founded with Kalda, non-aggression pacts with Kalda and Sandland (an alliance was
  refused: "too far away to help", "we already have enough allies");
- transports, a cruiser and a torpedo boat from the capital's yards; regiments raised;
- a claim fabricated across the water on Inveramore's Dunnaarrow, then a war to press it.
  Inveramore and its ally Drentland answered with 19 regiments at Wendhaven and a landing
  on Dunach's southern island; two battles were lost, and the war was ended by our own
  offer in the peace conference ("We offer terms": cede Wendhaven, which Inveramore
  accepted at +2);
- six more years of peace, answering events, to Wk 1, Apr 1899 (7th of 8 on score).
- The campaign was saved to a slot, reloaded in newer builds, and a save from the earlier
  build (map revision 1) was imported into revision 2.

**Findings and what was done.**

| # | Finding | Outcome |
|---|---|---|
| 1 | The welcome and setup text called an island realm's position "0 neighbouring realms". | Fixed in the generator ("no neighbours by land"); the Isles are revision 2. |
| 2 | Clicks and right-click move orders on the map beside the legend, and above the minimap, did nothing: the transparent boxes holding the legend and mode bar, and the zoom buttons and minimap, took the pointer. | Fixed (only their visible parts take the pointer); browser check, which fails on the old layout. |
| 3 | With a ledger open, the tutorial card covered the ledger's tabs. | Fixed: it sits beside the ledger; browser check. |
| 4 | Switching from Diplomacy straight to another ledger left the Diplomacy map on. | Fixed; browser check. |
| 5 | A waiting decision card covered the middle of the map-mode bar. | Fixed: the dock sits above the bar. |
| 6 | A finished focus or technology only showed a toast; at speed 4 the realm went eight months without a focus. | Fixed: a pause setting "When research or a national focus finishes" (on by default) and a Focus badge on the rail; browser check. |
| 7 | Sea control: a zone washed in a brown realm colour read as land. | Lighter wash with a dashed edge in the realm's colour. |
| 8 | Messages said "1 regiment(s) in training" and the like. | Proper singular and plural throughout. |
| 9 | An island realm with no land or strait border could neither fabricate a claim nor declare any war: fabrication needed a bordering province. | New rule: a claim can be fabricated on a coast within one sea zone of one of our ports; unit test. The AI's own war planning still looks only at realms it borders (known limitation). |
| 10 | The war button said "Their allies may join: Drentland, Kalda, Sandland", but Kalda and Sandland had pacts with us and did not join. | Fixed: it names only allies that can join, those bound to us by a treaty, and guarantors who will be called. |
| 11 | With a ledger and a card both open, the legend ran under the zoom buttons. | Fixed: legend and mode bar fit between the panels; browser check, which fails on the old layout. |
| 12 | A small realm piles up crowns it cannot spend (4,900 by 1899 at +45 a month): three construction slots, three slipways and a small manpower pool cap spending. | Known limitation (a late-game sink for crowns). |
| 13 | The tutorial's "Invest in the realm" step suggested a railway while its text explained development. | Fixed: the text explains the project it suggests. |
| — | A revision-1 save from the earlier build loaded into revision 2 with the "saved on revision 1 … continues on the current map" notice and played on. | Works as designed. |

**A note on method.** In one run the session script answered every card automatically and
accepted Inveramore's settlement (Wendhaven and a renunciation of claims) before the
author saw it. That run was discarded: the campaign was reloaded from the autosave taken
before the landing, and the war was then ended by hand through the peace conference. The
script was changed to stop at any war, peace or settlement decision.

**Screenshots** (`docs/screenshots/stage-f/`): `session-01-welcome.png` (the tutorial's
first step), `session-02-revision-notice.png`, `session-03-alliance-reasons.png` (why Kalda
refuses an alliance), `session-04-declare-war.png`, `session-05-offer-terms.png` (the peace
conference offering terms while losing), `session-06-legend-between-panels.png`.
