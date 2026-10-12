# Oversight: task usability reassessment

Date: 2026-10-12. Research for a new proposal; no game code changes.

## Verdict

The current revision made documents shorter when closed, but made informed play depend on opening them, scrolling, remembering information, leaving the decision, finding a service, and reconstructing the decision afterwards. The interface still follows the database's categories rather than the player's immediate problem. The user is right that expanders do not fix this. The strongest correction is a persistent decision workspace with relevant evidence and contextual actions, retaining the earlier game's identity.

Landscape is a promising primary format for comparing evidence and choices. Simply locking the existing UI to landscape would retain its failures and make some phones worse. A new interaction layout must be tested at both 844 × 390 and 667 × 375 before choosing the orientation policy.

## Checked scope and limitations

- Read the original full mobile playtest report: one Director/Commonwealth, seed 550811725, complete 16-quarter run. Its 31-minute video includes note-taking; it is not a measured typical session time. Reviewed its reported journeys and linked screenshot evidence, not a fresh human test.
- Reviewed current components: Briefing, GameScreen, Nation/Companies/Threats/World panels, DemandForecast, QuarterReport, plus final CSS overrides and the existing UX test scripts.
- Inspected baseline and build-2 screenshots in `artifacts/ux-audit-2026-10-12/` and `artifacts/ux-redesign/`.
- Reproduced current production UI in headless Playwright WebKit, touch emulation, reduced motion, English: 390 × 844, 844 × 390, and 667 × 375. Used saved turn-6 fixture and normal visible buttons. No engine state mutation during the decision/company round trip.
- Fresh reproduction: `artifacts/ux-reassessment/research.mjs`, `research-metrics.json`, and `{390,844,667}-{decision,selected,evidence,company}.png`.
- Root investigator supplied additional company/action-sheet evidence in the same directory: `task-probes.json`, `667-company-top.png`, `844-investigate-open.png`.
- These are browser observations, not physical iPhone touch, safe-area, VoiceOver, or user comprehension measurements. There is no new complete human run and no invented task completion time.
- Distinguish **offscreen inside a functioning scroller** from **unreachable clipping**. The fresh cases below show abrupt cuts, loss of comparison context and repeated scrolling. They do not prove the content is permanently inaccessible. The user's exact physical-device clipping remains an additional case to reproduce.

## What the game must preserve

The GDD makes scarce-action investigation, meaningful policy tradeoffs, warnings and consequences returning 1–6 quarters later central. The original playtest's strongest moments were delaying a model because evaluation confidence was low, discovering its later harm, and finally using a previously enacted off-switch at a real cost. Simplification should bring those relationships into one task; hiding uncertainty, removing policy consequences, or auto-selecting responses would weaken the game.

## Highest-impact findings

| Priority | Class | Reproduced evidence | Player harm | Required correction |
|---|---|---|---|---|
| P1 | Quality defect: comparison breaks during selection | In turn-6 Lingua-3 at 844 × 390, selecting “Staged release with safeguards” scrolls the right decision pane by 183 px. First choice top becomes −79 px; selected choice top −27 px; third choice is cut by the header. Only Reject remains fully visible above the details. `844-selected.png`, metrics. | Selecting an alternative moves the controls required to compare it. The player must scroll up, select another, then reorient after another automatic jump. | Keep choice selector spatially stable and show costs, benefits, uncertainty in a stable adjacent comparison/detail region. Remove selection-triggered travel. |
| P1 | Quality defect: essential evidence is treated as optional reading | All deployment evidence starts closed. At 390 × 844, opening it after selecting expands content to 1,427 px in a 690 px viewport. The first choice moves to y=1,076 while confirmation remains at y=747. At 844 × 390 the left pane has 956 px of evidence in 276 px. `390-evidence.png`, metrics; Briefing.tsx. | The screen encourages commitment with only a request sentence. To make an informed choice, evidence and alternatives must repeatedly be recalled from different positions. | Show the decisive evaluation, confidence, known concern, current adoption and relevant requirement without expansion. Put provenance/full story behind secondary access. Keep choices available while examining detail. |
| P1 | Quality defect: investigate-and-return loses work | Starting inside a selected briefing, close → Nation → Companies → open company → Desk → same briefing is a minimum six navigation taps, excluding scroll and the service itself. Fresh tests at all three sizes return with zero checked choices and closed evidence. Briefing state is local and destroyed on close. | The player loses tentative selection, reading position and inspected context precisely when using the game's central investigation mechanic. The UI turns useful investigation into a detour. | Contextual company/model inspection from the current case, with a clear return and preserved draft selection. Actual engine-changing investigation must refresh evidence and validate the selection before confirmation. |
| P1 | Quality defect: tasks remain scattered across categories | A demand forecast is in its briefing or Government; funding is in Programs; current adoption/orders are in Society or deployment evidence; model actions are under Companies. None of these task-related records link to the needed service. World progress similarly sits above generic actions and separate rival tabs. Source and screenshots. | The player must first learn where each system lives, then mentally join its state to the current objective. Three root tabs merely conceal the former categories behind a second navigation level. | Build task routes: “meet this deadline,” “check this model,” “contain this threat,” “advance this treaty.” Include relevant state and direct authorized actions with a return route. Keep a reference browser for exploration. |
| P1 | Quality defect: landscape is only partially designed | At 667 × 375, width misses the 700/760 px landscape thresholds. HUD remains 130 px and bottom tabs 57 px; Desk has about 120 px of content. A deployment starts with its first option cut at the bottom and no other choices visible. At 844 × 390 it gets two columns but the selection failure above remains. `667-decision.png`, `667-company-top.png`, metrics. | Rotation changes the arrangement without ensuring a usable play surface. Short phones become nearly all navigation and headings. | Use an explicit landscape workspace with compact global chrome and task-focused regions; test the shortest supported phone, not just 844 × 390. Do not ship an orientation lock as the fix. |
| P1 | Quality defect: service actions still live below long records | Company expanded view places relation, capability, three traits, intel and models before company actions. At 390 × 844, HUD + Nation heading + two-row subsection nav occupy through y=338; first company controls are below the initial viewport. At 844 × 390 an investigation action sheet is 366 px tall with 460 px content; Cancel/Authorize are below its initial scroll clip. `en-390-company-detail.png`, root `844-investigate-open.png`, `task-probes.json`. | Access to the actual service requires scrolling past reference material; opening the service repeats the problem with its final action below the fold. | Place currently relevant actions alongside the selected entity/task, and keep the confirmation/cancel area stable while explanatory content scrolls. Reference information should not displace controls. |
| P2 | Quality defect / identity loss: generic flattening removed useful game cues | Baseline dossier has file identifier, source stamp, distinctive paper/type; previous world/company/country views carry maps, emblems and logos. Current override globally changes font roles, hides company entity headers, removes much original framing and moves map behind a disclosure. User explicitly prefers previous identity. | Less distinction between a government request, corporate claim, evidence and story. Atmosphere was one of the original playtest's strengths; flatness alone did not make tasks easier. | Restore selected source/material/typographic cues from baseline while redesigning interaction. Keep readable type and remove effects only when they demonstrably obscure state or waste space. Do not restore the old modal heights or mandatory scrolling. |
| P2 | Quality defect: feedback lacks a next useful action | Reports initially show meter deltas but causes require four separate disclosures; warnings/highlights remain separate from the services that can respond. End Quarter is available only after returning to Desk. The Accord explainer now states 100% → signing card, which improves rule clarity, but the generic action area still leaves route selection to the player. | The player can know a number changed without understanding what matters now or where to act. Finishing a quarter and addressing its consequences require another search. | Prioritize actionable changes and link each to the relevant task, while retaining complete reasons and player freedom. “Treaty ready” should open signing; “deadline at risk” should open its planning context. |

## Concrete task traces

### 1. Decide whether to release Lingua-3

**Current:** open request → optional Evidence → read company claim, evaluation, confidence → optionally open adviser/full briefing → scroll or close evidence → select alternative → interface scrolls to details → remember previous option to compare → confirm.

At 390 px collapsed short example can fit all labels and selected details; this is genuine improvement over baseline. It ceases to work once the player reads the evidence that gives the decision meaning. At 844 px there is sufficient width to keep context and alternative labels together, but current automatic scroll defeats it.

**Needed:** stable request, decisive evidence and cost/benefit comparison; full dossier accessible without replacing the case. Never require a player to open every evidence disclosure mechanically. Do not add an arbitrary “read everything” gate.

### 2. Investigate a company before committing

**Current:** the six-navigation-tap round trip above, plus scroll to the relevant company/model/service; action sheet then result receipt. Closing the briefing discards draft selection. Ordinary engine-changing results also scroll the page to top.

**Needed:** inspect named company/model directly from the request; relevant service can be initiated there. Preserve the case, show what the investigation changed, then return to a refreshed comparison. If the action consumes the last capacity or alters a choice, explain the changed availability.

### 3. Fund a program to meet a demand

**Current:** read demand/deadline/forecast → return to Nation → Programs → identify program → click a level → return Government to verify demand. Program buttons show level and cost, while only the currently selected level's effect description is shown. The player must change a free setting to learn its full description. For adoption promises, raising an adoption target is different from achieved use; society and deployment information remain apart.

**Needed:** objective panel shows current state, deadline forecast and the relevant funding/order lever together. Preview alternative funding effect and net quarterly budget before applying. Forecast remains conditional; do not imply events or uncertainty are guaranteed.

### 4. Contain a detected threat

**Current:** Desk → Threats → scroll long situation card through stage/history/text/severity/source/current response to options → response sheet. A separate escalation briefing may request another response through a different presentation. Late screenshot at 844 px shows only stage and start of source text in initial viewport, no response controls.

**Needed:** one case per detected situation; current response, next-quarter warning and available actions together. Inbox escalation should open that case, not require the player to reconcile two presentations. Do not automatically dismiss repeated threat cards without checking mechanics and the user's approval for pacing changes.

### 5. Build and sign the Accord

**Current:** World overview explains 100% and signature. At 390 px overview has two tall equal-height cards; Race Tension wastes the height needed by Accord prose. First international actions appear only around y=728. Rival knowledge/trust is on another tab; targeted diplomacy requires an action picker. Signing card link exists when ready.

**Needed:** treaty task shows progress, signing condition, relevant rival relationships and diplomacy options together. Existing readiness link is worth keeping. Explain the available action's effects honestly; no invented deterministic promise of support.

### 6. Learn from a quarter and resume

**Current:** end quarter from Desk → report summary → expand causes → continue to Desk → navigate to relevant problem. Saved engine state/pending result is supported, but a selected uncommitted briefing is not a persisted task state.

**Needed:** a concise “what changed / why / what needs attention” report with route back to each case. Resume to a comprehensible task summary, preserving useful uncommitted UI context separately from authoritative engine state. Test interruption after selecting and while inspecting a related entity.

## Portrait versus landscape, specific to this game

| Consideration | Portrait | Landscape |
|---|---|---|
| Read narrative | Longer vertical reading area; natural phone hold. | Shorter page, but wider usable lines; must avoid full-width long text. |
| Compare evidence with decisions | One narrow column encourages memory and repeated travel; compact summary/detail routes are needed. | Can keep case evidence and options simultaneously visible; best fit for the core decision task if controls stay stable. |
| One-handed access / casual interruption | Better fit; less need to rotate on entry. | Usually two-handed and more deliberate; side safe areas reduce usable width. |
| Overview / programs / comparisons | Categories stack into long documents. | Can use row-oriented tables or master/detail without showing every system at once. |
| Short phones / larger text / Russian | Vertical area helps long labels, at cost of more scroll. | Height is the main constraint. 667 × 375 and long Russian choices must drive the design, not be an afterthought. |
| Current implementation | Collapsed appearance improves, informed decision still scrolls heavily. | 844 px split exists but selection moves controls; 667 px falls back to poor portrait structure. |

**Recommendation to planner:** prototype landscape first because simultaneous comparison suits this strategy game. Judge it on full tasks and longest supported text. Do not promise that rotation alone fixes complexity. Preserve a readable portrait fallback or explicitly agree a landscape-only product after the prototype proves usable.

## Why prior checks passed while this failed

`ux-redesign-smoke.mjs` asserts element count, row height ≥44 px, absence of horizontal document overflow, saved-state mutation boundaries and no page errors. It then uses Playwright `.click()` and `scrollIntoViewIfNeeded()`, which automatically bring offscreen controls into reach. It does not assert simultaneous visibility, preservation of choice/evidence on return, stability of option coordinates, or whether a novice can find the appropriate action. `late-states.mjs` repeats the same limitation. Scripted complete runs establish engine progression and save integrity, not convenient play.

## Acceptance evidence for the next prototype

1. At 844 × 390 and 667 × 375, EN and RU, selecting each choice never moves the option selector out of its stable region. Relevant evaluation/confidence and chosen cost remain available together.
2. Deployment → company/model inspection → return preserves case and draft selection; engine-changing inspection refreshes evidence and revalidates availability.
3. From an active demand, the player can open the relevant lever directly and see its updated conditional forecast without searching Government/Programs/Society separately.
4. Threat escalation and the threat record lead to the same response workspace; active response and impending escalation are visible with the controls.
5. Accord progress, the actionable diplomatic step and signing readiness can be explained using one task route.
6. Final action/cancel controls stay reachable in the same location while long explanations scroll. Test visible bounding regions and hit testing; do not rely on Playwright auto-scroll alone.
7. Use one novice physical-phone playtest: ask the player to compare two release choices, investigate then return, address a deadline, and explain one report change. Record wrong turns, missed controls, and explanations; do not substitute our scripted speed for theirs.
8. Verify no information from the fogged view is lost or made falsely certain. Keep current tests as regression checks and add only the task-state/visibility checks that cover these concrete failures.

The highest-value change is making a decision and its related services one continuous task, with evidence and alternatives available together. Cosmetic rollback alone will not achieve that, but recovering the original identity is compatible with it.
