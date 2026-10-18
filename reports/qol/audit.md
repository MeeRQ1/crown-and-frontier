# Quality of life and operational command: audit and plan

Audit of `main` at cd38b4f (after the format 7 military-control update), in the
production build (`npm run build`, Chromium 1366×768) and in the simulation.
Evidence: `reports/qol/before/` (browser census, screenshots, input counts) from
`tools/qol-audit.ts --phase before`, and `reports/qol/war-ai-before.json` from
`tools/war-ai.ts`. The large-force campaign is `tools/qol-scenario.ts`: Europe
1936 as Germany with 13 armies (110 regiments), 3 fleets and 8 wings, at war
with Poland, Romania and France beside Italy, with eight neutral neighbours.

## 1. Commanding a large force today

| Area | How it works now | Burden |
|---|---|---|
| Selection | One army, fleet, wing or province at a time (`App.selectedArmy` …). Army groups 1–9 (`setGroup`) send one march to every army in the group. No box or list selection. | Every army is selected on its own. |
| Ground orders | `move` with a route; `station` standing order; armies stop on arrival. Taking a province ends the order. | Measured: ordering the 13 armies once took **26 inputs** (select + right-click each). Every captured province needs a new order for the army that took it; every lost battle needs a re-plan. |
| Combat and occupation | Battles on contact; sieges by armies standing still in enemy land (2 weeks without a fort, 10 weeks and 2 regiments per fort level). | Nothing marches on after a capture; armies idle in taken land until the player notices. |
| Reorganisation | `split` by regiment counts, `merge` in the same province, max 40 regiments an army. Regiments are indivisible (`Regiment.men` ≤ 1000). | Manual only. |
| Fleets | Standing duties (format 7: patrol, blockade, raid, escort, bombard, port) persist and steer the fleet. | A duty is not re-aimed when its target falls or the front moves; no repair cycle except after a beating. |
| Aircraft | Missions persist; readiness recovers when idle; carriers carry wings. | Support targets do not follow the battles; wings fall out of range as the front moves; no automatic rebasing. |
| Airborne | Select, Airborne drop, click target, confirm, per drop. | Manual per drop. |
| Feedback | Military ledger: fronts, groups, armies by region with "Doing". | No view of a campaign as a whole; idle armies are not called out. |
| Province work | Province card: one click per project or regiment ("Raise three" for three). 5 construction slots for Germany. | Measured: railways in 10 provinces took **15 inputs** and queued **5** (all slots then in use, shown only as disabled buttons); a regiment in each of 10 provinces took **20 inputs**. |

Conflicting orders: a march clears a station order; group orders and single
orders share `move`; nothing else competes because nothing is automated.

## 2. Unit-view filters (reproduced)

Definitions in code (`renderer.ts` `drawArmies` / `drawFleets` / `drawWings`), with
the browser census of markers on screen by relation (`reports/qol/before/audit.json`):

| Mode | Armies | Fleets | Wings | Defect |
|---|---|---|---|---|
| All, near | own 13, hostile 5, allied 1, other 32 | own 3, hostile 2, other 14 | own 3, hostile 2 | — |
| All, regional / far | own 12, hostile 6, allied 2, other 51 | own 3, hostile 3, **other 0** | **own 3 only** | neutral fleets and every foreign wing dropped at low zoom even in All |
| Relevant, near | own 13, hostile 5, allied 1 | own 3, hostile 2, **other 14** | own 3, hostile 2 | **unrelated neutral fleets shown** |
| Relevant, far | own 12, hostile 6 | own 3, hostile 3 | **own 3 only** | enemy wings dropped |
| Mine + enemies, every zoom | **own only (hostile 0)** | own 3, hostile 2–3 | own 3 (hostile 2 near, **0 far**) | **every enemy army hidden**: `if (atWar) return mode !== 'mine'` is inverted; enemy wings dropped at low zoom |

Causes: three hand-written predicates that disagree. Armies hide enemies in
"mine"; fleets apply no relevance rule in "relevant"; wings and fleets add a
zoom rule that drops foreign forces; allies in "relevant" depend on zoom. The
province card's "Armies here" lists everything regardless of mode; the settings
hint ("hides neutral armies at a distance") describes none of them.

## 3. Wartime AI (measured, `tools/war-ai.ts`, 40 weeks, seeds 1–4)

| Scenario | Attacks lost | Repeated lost attacks (same province ≤ 8 wk) | Idle fit army-weeks | Re-targets of unfinished objectives / army-month | Provinces taken by the attacker side |
|---|---|---|---|---|---|
| Europe 1936 (Ger+Ita vs Pol+Rom+Fra) | 25 of 66 (38%) | 11 | 25–48% | 0.09–0.20 | 0 in every seed |
| Aldmere (two strongest neighbours) | 35 of 81 (43%) | 7 | 0% | **1.24–1.37** | 1–3 |

(First version of `tools/war-ai.ts`, which counted idle armies in peace as well. The
before/after comparison in [verification.md](verification.md) re-ran `main` with the final tool.)

Code causes (`ai/operational.ts`): objectives are re-ranked from scratch every
week with only a 1.3× bonus for committed ones (churn); no memory of failed
attacks, so the same province is attacked again at once; no reserve; peace-time
rally merges everything into one or two huge armies (Europe: 113 Soviet
regiments in 2 armies) that then serve one objective while the rest of the
front idles; no detachments in war; armies without an objective only cover
front posts within three marches of the border, else wait at the rally point.

## 4. Plan

One planning core, two callers, all orders through `applyCommand`:

1. **Operations (save format 8).** `state.operations[id]`: kind (conquer,
   advance, hold, sea, landing), area (provinces / sea zones), posture
   (cautious / balanced / aggressive), priority, reserve share, readiness limit,
   supply limit, permissions (reorganise, rebase, airborne off / once / repeat),
   completion rule, status (active / paused / complete / blocked), log, issue.
   Membership lives on the unit (`op`, plus `opHold` for a manual override and
   `keep` to protect a formation), so a unit can never be promised to two
   operations and destroyed units leave no references. Commands: create, edit,
   assign, release, pause, resume, cancel, resume-unit.
2. **Ground planner (`sim/ops/ground.ts`).** Objectives (targets, threats,
   front posts) → task forces: need from opposition × posture margin + fort
   need; nearest fit forces; staging and merging before a defended target;
   forecast gate by posture; failure memory (no repeat into a lost attack for
   8 weeks, then a decision for the player); reserves held back and committed by
   rule; recovery for worn or unsupplied armies; bounded detachments (minimum
   2 regiments, at most 6 extra armies an operation) to occupy undefended
   targets; regrouping of idle compatible armies; hysteresis so an objective is
   kept until done or invalid.
3. **Naval and air execution** under the same operation: fleets get duties
   (escort, patrol, blockade, bombard the siege, port for repair); wings get
   missions over the operation's battles and targets, rest when worn, rebase
   only with permission (airfield room and safety checked); airborne drops only
   inside the mandate and risk limit; landings prepared (troops at the port,
   transports and escort, then `shipArmies`).
4. **Player override:** any player order on a member suspends it (`opHold`),
   shown on the unit and the operation, never taken back unless the player
   resumes it (or set "resume when the order is done").
5. **AI:** `warOps` uses the same planner (failure memory, reserves, detachments,
   commitment, regrouping), with the AI's existing objectives and difficulty.
6. **Filters:** one rule (`ui/map/visibility.ts`) for markers, the province
   card, the selection and the counts; same set at every zoom (grouped, never
   dropped); a count line under the mode switch.
7. **Province batches:** a province selection (Ctrl/Cmd-click, a Select tool for
   touch, box drag in that tool), a summary card, `batchBuild` and
   `batchRecruit` commands with a preview of each province (eligible, skipped
   and why, cost, slots), a disclosed order for partial requests, revalidation
   on confirm.
8. **Verification:** unit tests per rule, the 100-regiment demonstration
   (`tools/qol-demo.ts`), AI before/after (`tools/war-ai.ts`), browser checks
   (`tools/qol-audit.ts --phase after`), timing, save round trips.
