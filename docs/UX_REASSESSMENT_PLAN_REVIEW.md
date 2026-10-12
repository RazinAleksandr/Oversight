# UX reassessment: plan review

12 October 2026. Planner/supervisor contribution. This is a proposed direction for review, not an approved implementation or a claim of human usability validation.

## Recommendation

Build a **landscape-first decision workspace** using the earlier game's dossier, clock, portraits and institutional character. Organize play around a matter the player is handling, with its evidence and available interventions together. Keep a sequential portrait layout for reading, access needs and interruptions; do not hard-lock orientation before the landscape tasks pass on the actual phone.

The important change is the relationship between information and actions. A wider version of the current panels, more expanders, or restored colors alone will not fix the journey. Retain the deterministic engine and current strategic rules for this stage.

## What the previous plan missed in implementation

Sources: `docs/UX_REVIEW_2026-10-12.md`, `docs/UX_REDESIGN_IMPLEMENTATION.md`, the recorded playtest, and the current source. I inspected the current EN landscape decision and RU portrait selection screenshots, plus the previous portrait deployment screenshot. I have not conducted a fresh physical-phone session.

| Intended experience | Current implementation | Task failure / consequence |
| --- | --- | --- |
| See evidence relevant to the decision | `Briefing.tsx` hides evaluation lines, capability versus safeguards, and adoption values inside `Evidence & advice`. The default has a generic uncertainty label. | The first screen makes approval easy before the player sees the actual finding. The core investigation mechanic looks optional. |
| Compare choices | Choice rows show labels; selecting appends detail after the list and calls `scrollIntoView`. | Comparing costs or consequences requires serial selection and remembering previous values; the interface moves while the player is orienting. |
| Investigate the related company without losing the decision | Briefing exposes no contextual company/action link. Selected choice is component-local state. | The player closes the dossier, finds Nation → Companies → the company, acts, then reopens the briefing. The interface does not maintain a decision workspace. |
| A task-oriented Desk | Navigation categories changed to Desk/Nation/World; ordinary guidance tells players to visit those destinations. | Renaming departments has not connected promises, threats and scarce actions. The player must know which subsystem contains the solution. |
| Easier funding and diplomacy | Programs remain a list of steppers; diplomacy is under overview/rival subpanels. | The player must translate a problem into a tool, navigate there, and remember the problem while choosing a setting. |
| Restore a compelling game identity | Broad dossier CSS simplifies portraits, stamps, art, typography and surfaces. | It improves restraint but removes part of the authored atmosphere the earlier playtest praised and the user prefers. |
| Verify comfort | Automated flows check reachability, dimensions and completed runs. | A script can scroll to and click an element that a person cannot discover, compare or comfortably reach. No horizontal page overflow is insufficient. |

The current `en-844-decision.png` also visibly ends the right pane at the start of the instruction below the choices, with a persistent footer. The screenshot alone does not prove the rest is inaccessible. It does show why “all option labels fit” is weaker than “the complete decision task is clear.”

The previous plan already called for contextual links and task-based testing. Those need implementation and evidence, not another statement of intent.

## Player mental model to preserve

The player governs an uncertain transition over quarters. Each quarter they ask:

1. **What changed, and what will fail if I ignore it?** National survival, active threats, government deadlines, the global race.
2. **What do I know, and who claims it?** Evidence quality, company honesty, detection limits, fogged capability.
3. **What can I do with this quarter's cash and actions?** Decide, investigate, contain, regulate, fund or negotiate.
4. **What am I accepting now versus later?** Immediate cost, gradual adoption, future incidents, upkeep and political consequences.
5. **What happened because of my choices?** A causal quarter report and a later debrief.

The GDD's interesting verbs are deciding and investigating. Reading and navigation support them. The UI should neither turn every decision into a form nor choose an optimal strategy for the player.

### Strategic invariants

- Keep full versus limited deployment, evaluation delay, rejection risk, political pressure and scarce action costs distinct.
- Show confidence, estimates and source attribution; never present hidden truth as a helpful summary.
- Preserve safety funding versus oversight funding: one changes safeguards, the other improves detection/knowledge.
- Preserve actual adoption versus target, lag, demand deadlines and uncertainty in forecasts.
- Keep diplomacy progress, support and the signing act distinct.
- Keep all legal interventions available, including actions before mandatory briefings are resolved.
- Preserve 16 quarters, story arcs, delayed consequences, existing odds and save schema initially.
- Do not silently resolve repeated threat cards. Group their presentation only; bypassing a required choice is a separate rule/semantic change.
- Do not judge a run's quality solely by a final grade. Explain the existing outcome; changing finale rules needs separate approval.

## Orientation: the real trade

| | Portrait | Landscape |
| --- | --- | --- |
| Reading a long dossier | More vertical reading space and a familiar narrow column | Less height; long narrative must have a dedicated readable surface |
| Comparing evidence with choices | Usually sequential, with more recall or navigation | Can put evidence beside alternatives; strongest reason to use landscape here |
| Four choices with costs and consequences | Can form a tall, legible list | Requires deliberate density; four elaborate cards will not fit in a short viewport |
| Holding the phone | Easier one-handed use for many people | Normally two-handed; edge controls need reach tests, not assumptions |
| Safe areas | Top/bottom space usually dominates | Side camera cutout and bottom home region constrain usable width/height |
| Larger text / Russian | Long screens scroll naturally | Columns can become too narrow or too short; need a sequential fallback |
| Interruption and quick resume | Convenient for brief checks | Rotation adds friction; preserve task and reading position across changes |
| Implementation cost | Existing foundation, though flawed | Requires changing shell and interaction flow, not merely swapping CSS breakpoints |

**Inference:** landscape is the better primary candidate because this game repeatedly asks people to compare evidence, uncertain predictions and alternatives. It is not automatically more readable: rotating 390×844 into 844×390 changes shape, not pixel area. A hard lock would discard one-handed/readability options before proving the benefit.

At normal text size, prototype 844×390 and 667×375 as primary landscape conditions, with safe areas. Also stress 568×320, long Russian and 200% text. When the content cannot fit two useful columns, switch to a single active reading/decision surface instead of shrinking text. Do not label a device supported solely because the orientation flag is present.

Apple's layout guidance calls for adapting to available space, safe areas, localization and larger text, including in landscape-only games. That supports adaptable workspace geometry; it does not establish that landscape is best for Oversight. [Apple Layout](https://developer.apple.com/design/human-interface-guidelines/layout?changes=lat_3__1_2)

Apple recommends at least 44×44 pt for frequent game controls; physical comfort still needs device observation. [Apple Game controls](https://developer.apple.com/design/human-interface-guidelines/game-controls)

Use 200% text as a stress condition without claiming native Dynamic Type support until it is implemented and checked in the WKWebView. [Apple Larger Text evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria)

## Proposed interaction architecture

### 1. Quarter agenda: matters, not a directory of departments

A compact strip gives date, cash, actions and survival status. The main surface shows required decisions, active deadlines and escalating threats with source and current response. Selecting a matter opens its workspace. A consistent `Manage` route exposes the complete catalog of programs, laws, companies and foreign relations so contextual surfacing never becomes a restriction.

Group by factual urgency: required decisions, deadlines due, active situations. Do not recommend a particular political strategy or silently rank hidden risks. Show an empty section only when it teaches useful state; do not fill the desk with generic tutorial prose.

Quarter completion shows unresolved obligations and unused resources in context. Ending the quarter stays a deliberate action. Avoid adding a mandatory confirmation after every routine step.

### 2. A decision workspace

At suitable landscape size:

```text
Back to agenda       Q1 2027                Cash · Actions
─────────────────────────────────────────────────────────
THE MATTER                       AVAILABLE RESPONSES
Request + political stakes       Approve — gain / risk
Evaluation finding + confidence  Limit — smaller gain / risk
Capability vs safeguards         Evaluate — cost / delay
Relevant deadline/forecast       Reject — political tradeoff

Inspect company / Read dossier   Selected response detail
                                 Confirm named response
```

This is a content hierarchy, not a promise that every line of every card fits without scrolling. Keep essential evaluation facts, cost, uncertainty and disabling reasons in the first useful state. Put full prose, advisor detail and history behind explicit destinations, not nested disclosures inside disclosures.

Show a short consequence/cost summary for **every** alternative before selection. Selection does not move the page or spend resources. On compact height, detailed preview may replace the option list within its pane, with an obvious `Compare options` return restoring position and selection. Never force an automatic jump to content below the alternatives.

Use authored or structured engine fields for summaries. Taking the first paragraph of an arbitrary story is not a reliable statement of stakes. Audit every card family, with full text available.

### 3. Contextual operations with a return path

`Inspect company` opens the relevant record within the active task. Investigation preselects the correct target, shows exact cost/detection uncertainty, then returns to the same decision and refreshes evidence. It must not accidentally choose the pending briefing response.

The same pattern applies to:

- Promise → current/target/forecast/deadline → relevant sector or funding tool → revised forecast.
- Threat → source/stage/current response → allowed containment actions → changed state.
- Safeguard gap → safety/oversight explanation → current/proposed funding and upkeep → updated view.
- Accord → progress/support/signing state → eligible diplomacy action → resulting state.

These links save navigation; they do not guarantee that an intervention can solve the problem. If no known action improves a forecast, say what remains uncertain rather than inventing a remedy.

Global management is a secondary route, not a removal. One complete catalog prevents players from being limited to whatever the current matter happens to surface.

### 4. Quarter report and continuation

Lead with changed state and causes: why a survival meter moved, which promise passed/failed, which threat escalated, what next decision needs attention. Each actionable item opens that matter. The full ledger remains inspectable. Returning from an item does not dismiss unrelated warnings or restart reading.

Routine action feedback attaches to the object acted on; it should not displace a whole screen with a receipt and another Continue. Mandatory authored follow-ups and endings retain explicit progression. Audit pending-result persistence rather than equating all outcomes with the same presentation.

### 5. Learning through the actual task

The first deployment exposes a real low/high-confidence finding, a visible evaluation cost and a plain explanation that absence of detected flaws is not proof of safety. Offer help at that decision; do not require opening a long tutorial. When programs first unlock, explain the consequence of changing the selected program beside its control. Keep politics, capacity and deadlines visible when they first constrain the player.

The goal is informed choice, not making everyone choose evaluation. A player who knowingly accepts risk has understood the game.

## Keep, recover, rebuild

| Keep | Recover from previous design | Rebuild |
| --- | --- | --- |
| Deterministic engine, fogged views, forecasts, exact affordability, save journal, native shell | Dossier/paper identity, authored portraits/emblems, risk clock, distinctive headings and restrained stamps, appropriate ending art | Decision navigation and comparison, contextual operations, agenda, program editing, report-to-action paths, adaptive screen shell |
| Known-cause narrative correction, instantaneous reading option, reduced motion | Atmosphere and meaningful result feedback | Avoid wholesale neutral CSS overrides; use explicit screen components/styles |

Do not restore the earlier cramped modal/HUD layout just to recover its art direction. Git rollback is a safety measure and source of assets, not a requirement to discard correctness fixes.

## Acceptance based on player jobs

These are proposed gates. None is claimed achieved.

| Task | Observable pass condition |
| --- | --- |
| Decide a deployment | Player identifies the request, evaluation finding/confidence, immediate cost and a delayed downside before committing; can inspect all alternatives without a page jump. |
| Investigate then decide | From the open decision, reach the correct investigation in at most two navigation actions; cancel or complete returns to the same card, selection and reading context. No target reselection when unambiguous. |
| Compare two responses | Costs and material tradeoffs can be viewed without reconstructing them from memory; comparison never commits either response. |
| Meet or refuse a promise | Current value, deadline and forecast are available together; the player can explain why a larger target is not immediate adoption. Relevant intervention returns to the same promise. |
| Handle a threat | Player identifies source, stage, current response and one available intervention; identical threat names remain distinguishable. |
| Pursue the Accord | Player can say whether it is building, ready to sign or active, and find the next available step without searching rival pages. |
| Fund a program | Before applying, player sees the affected system, proposed level, upkeep change and resource impact; cancellation has no mutation. |
| Finish a quarter | Player can identify unresolved decisions, deadlines and unused actions and deliberately advance; they can explain a major meter change afterward. |
| Resume / rotate | Same run, current matter and uncommitted selection survive supported orientation changes and background/foreground; no duplicate action. Exact scroll restoration is desirable but must not hide updated evidence. |

Geometry checks must cover **each scroll container**, not only document width: content extents, final reachable rows, safe-area occlusion, hit-target overlap, keyboard/focus order, and footer intersections. Test compact/current phone sizes, both landscape directions, EN/RU, text enlargement, all card kinds and later-game states.

Follow with an observed formative playtest. Ideally four of five unfamiliar players complete the deployment/investigation/promise tasks without coaching and can explain the tradeoff. With only the owner available, record those results as owner feedback, not a five-person result. Record mistakes, backtracking, unnecessary navigation and missed evidence; do not infer human session duration from script timings.

A failed comprehension or reachability task blocks expansion of the design even if all unit tests are green.

## Delivery sequence and review gates

1. **Reviewable disposable prototype:** real deployment, related company operation, funding adjustment and a quarter-return path. Compare old/current/proposed identity and portrait/landscape using the same content. No app replacement.
2. **One complete playable quarter:** shared workspace state and contextual routes; preserve engine/save interfaces. Qualify one investigation and one demand flow before broad panel work.
3. **All matter types and management:** laws, threats, treaty, elections, narrative follow-ups, finale; EN/RU; full catalog remains available.
4. **Reports, onboarding, resume and ending:** causal navigation and deliberate progression.
5. **Physical iPhone qualification:** observe the actual task journey, then release archive/install with fresh save backups. Keep existing Git checkpoints throughout.

The broad earlier 10–16 day estimate cannot validate a new architecture. Re-estimate after the prototype exposes content/state work; do not promise a shorter run or faster development from landscape alone.

Decision needed: approve the **landscape-first task workspace with recovered original identity, portrait reading fallback, and unchanged game rules** after reviewing the prototype. This is the repository's plan gate; the user's earlier approval covered an iteration that has now failed their usability expectation.
