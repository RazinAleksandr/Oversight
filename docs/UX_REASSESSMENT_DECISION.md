# iPhone UX reassessment — decision brief

12 October 2026 · Approved for the integrated deployment/investigation pilot. The user asked to proceed and notify them when ready.

## Recommendation

Build a **landscape-first decision workspace**, restore the earlier classified-dossier identity, and organize interactions around the current problem. Keep a usable sequential portrait/large-text route. Do not hard-lock orientation at this stage.

The rejected iteration changed presentation more than the work of playing. The next iteration must prove that a player can understand a situation, compare responses, investigate or adjust a relevant program, and return without losing their place. A smaller-looking screen is not sufficient.

### What the evidence establishes

- At 844 × 390, selecting the second deployment option scrolls the option column so the selected option and alternatives leave the visible area. The persistent confirm button remains. Comparing effects now requires recall and reverse scrolling.
- Essential evaluation evidence is initially collapsed. Expanded evidence and selected effects are not reliably available together; in portrait, opening evidence moves choices much farther down the document.
- Closing a decision to inspect a company and reopening it clears the tentative selection and disclosure state. The task crosses several navigation layers because there is no contextual company action from the decision.
- At 667 × 375, width-based breakpoints leave the portrait-style HUD and bottom navigation in landscape. Very little task space remains. Rotation alone cannot fix this layout.
- Investigation confirmation at 844 × 390 opens a 366 px-high scrollable sheet with 460 px of content; its action buttons begin below the fold. This is scroll clipping, not evidence that they are unreachable. The player must navigate a second long surface to perform a supporting action.
- The visual reset removed useful identity: typewriter headings, dossier source treatment, company marks, portraits and stamps. The earlier playtest specifically identified this atmosphere as a strength; the user now prefers the earlier design.

See [task research](UX_REASSESSMENT_RESEARCH.md), [planner review](UX_REASSESSMENT_PLAN_REVIEW.md), and [implementation feasibility](UX_REASSESSMENT_FEASIBILITY.md) for measurements, source references and limits. New measurements are headless WebKit observations of real saved game fixtures. They are not physical touch or human comprehension results.

### Why prior verification missed this

The earlier scripts checked completion, DOM presence, target height, save integrity and document overflow. Playwright could scroll controls into view automatically. Those checks did not establish that the necessary facts and alternatives stayed visible together, that users could discover supporting actions, or that decision state survived a detour. Passing them was insufficient evidence of mobile usability.

## Orientation decision

| Consideration | Portrait | Landscape |
| --- | --- | --- |
| Reading one document | Long comfortable reading column; more vertical space | Shorter column, so copy hierarchy and controlled scrolling matter more |
| Comparing evidence and responses | Usually sequential; needs explicit switches and preserved position | Can show both side by side on an iPhone 13-sized viewport |
| Holding and reaching | Better for one hand and quick interruptions | Usually two hands; controls need safe thumb zones away from notch/home gesture |
| Small devices / larger text | More room vertically; labels can wrap naturally | A forced two-column layout can become illegible or leave only a few lines |
| Fit for this game | Viable reading fallback | Recommended primary mode for deliberate strategic decisions |

**Decision:** design and test the core flow in landscape first; allow portrait as a sequential reader. On compact landscape or enlarged text, use the same explicit Brief / Options route as portrait instead of shrinking text or introducing more nested scrollers. Determine transitions from available content space, not a device-name list. Preserve the selected issue, choice and reading position across rotation.

Landscape is a product hypothesis supported by the comparison task. It remains subject to a physical iPhone playtest. Supporting portrait does not mean doing a separate browser release or duplicating the simulation.

## The new play loop

1. **Quarter agenda:** required decisions, active threats and due promises in priority order; resources and survival warnings visible. Optional preparation remains possible before choosing a briefing.
2. **Open an issue:** the question, key finding and confidence, relevant baseline and alternatives are available immediately.
3. **Compare:** every option exposes its label, main tradeoff and cost. Selecting an option changes its detail area without moving the alternatives. Nothing commits until explicit confirmation.
4. **Act in context:** open the relevant model/company, funding, law or diplomatic task directly. Its target is already selected. Return to the same issue and refresh its evidence/resources after the action.
5. **See the consequence:** a result explains what changed and any follow-up. Move to the next unresolved issue or return to the agenda with one action.
6. **Close the quarter:** review outstanding promises, projected upkeep and unused actions. Advance explicitly. The report leads with consequences, warnings and links to the next relevant tasks.

### Before → after, with strategic effects

| Task | Current friction | Proposed interaction | Strategic preservation |
| --- | --- | --- | --- |
| Authorize a deployment | Evidence hidden; alternatives leave view after selection | Dossier beside stable choice comparison; default evaluation + confidence and capability vs safeguards | All approvals/rejections/evaluation choices and uncertainty remain |
| Investigate before deciding | Close sheet, navigate categories, expand company, find action, navigate back; selection lost | Contextual inspection route with target preselected and explicit Return to decision | Same action/budget costs and imperfect findings; no free intelligence |
| Meet a demand | Forecast, adoption, programs and related deployments distributed across panels | Promise workspace: current/required/deadline/conditional forecast and relevant routes | Forecast exposes only known orders; it is not a hidden-event prediction |
| Respond to a threat | Separate alert, source/model facts and response actions | One incident workspace: known source, stage, response, escalation and available options | Separate threat identities and all response costs remain |
| Pursue the Accord | Progress explanation remote from next action | Named next step, prerequisites and targeted diplomacy; visible path to treaty and signature | Progress does not count as signed; no hidden supporter forecasts |
| Understand quarter changes | General report with reasons behind repeated disclosures | Lead with consequential changes and cause; detail/history accessible by explicit navigation | Preserve every reason and warning; no suppression of strategic evidence |
| Learn the system | Several categories and secondary concepts presented early | Teach one relevant concept at the first task that uses it, with a reference route for later | Keep expert access and existing unlock timing; no forced tutorial actions |

### Information hierarchy

**Always on the decision:** question/subject, known critical finding, confidence/uncertainty, relevant baseline, option labels and costs, current resources, selected state, explicit confirm.

**One direct route away:** full authored narrative, advisers' competing priorities, source history, secondary estimates and related action detail. These are named destinations with a reliable return, not nested disclosure chains.

**Do not compress away:** bad news, a low-confidence negative result, a deadline, an unavailable action's reason, an outcome range, or a company's/rival's identity.

Shorten connective and repeated instructional text before narrative substance. Preserve the voices that make a briefing a political problem. No campaign shortening, automatic choices, altered probabilities or new balance rules in this proposal. Recurring Monitor acknowledgments and finale fairness remain separate design questions.

## Visual recovery and rollback

Restore the established dark situation-room frame, warm paper, distinctive dossier headings, semantic stamps, redactions, company marks and restrained cyan actions. Keep readable body text and use texture lightly enough that small text remains clear. Portraits/map/ending art return where they identify the actor or establish a story beat; they do not occupy the decision's comparison area.

Recover these parts selectively from `1883243` rather than resetting the entire repository. Preserve current exact-affordability handling, conditional demand forecasts, save durability, modal focus containment and the authored known-cause threat fix (`592ce55`). Earlier cramped sheets and tall fixed chrome are not part of the visual recovery.

Git safeguards:

- Earlier design: `backup/iphone-before-ux-2026-10-12` → `1883243`.
- Installed build 2: tag `iphone-ux-build-2` → `842c316`.
- This analysis/prototype: `codex/iphone-ux-reassessment`.
- Production game and native bundle remain unchanged during this review.
- Implementation uses small commits for visual recovery, task routing, decision workspace and each secondary flow. No destructive reset or save rewrite. Any native installation first backs up both Documents save slots.

## Implementation sequence after agreement

### 1. One complete task with real engine data

Restore the chosen identity in the new workspace; implement deployment → compare → company/model inspection → action/result → return → decision. Add a typed task route and UI draft state keyed by card UID. Revalidate availability after every mutation. If a supporting action resolves/removes the issue, explain that result and return to the agenda; never restore a stale actionable card.

Keep full engine/save compatibility. UI state may be stored separately with a versioned schema; a missing/invalid draft must fall back safely without changing engine state. Confirm still calls the existing engine API once. Add no framework dependency.

**Gate:** review this integrated slice on the physical iPhone before expanding the pattern across every screen. Device installation alone is not this gate.

### 2. Complete the quarter loop

Apply the same task routes to demand/program planning, threat/source response and Accord/diplomacy. Build the agenda and consequence-first quarter review. Preserve all existing optional actions, including routes for expert players who are not following a briefing.

### 3. Finish the experience

Restore title/setup/debrief personality; improve contextual teaching and references; implement consistent back/focus/scroll behavior, rotation and interruption recovery. Translate new UI text through the existing English/Russian pipeline. No hard orientation lock unless later playtests justify it and the user agrees.

### 4. Qualify the iPhone candidate

Engine/type/build/i18n checks, production WebKit task regressions, then native lifecycle, physical touch/readability/VoiceOver and full-run checks. Reuse the existing Capacitor/signing setup and TestFlight route; no port rewrite is needed. Keep the current working build available while the slice is evaluated.

**Planning estimate:** roughly 1–2 working days for the integrated decision slice, another 2–4 for the remaining workflows and localization, and 1–2 for device findings/release qualification. These are effort ranges, not elapsed delivery promises; device access and the first slice's playtest can change scope. Do not implement all stages before discovering whether the task model works.

## Acceptance: task success, not just a clean screenshot

| Scenario | Required evidence |
| --- | --- |
| Compare all responses | On standard landscape, option labels/main costs remain visible while selection changes; no forced auto-scroll to offscreen detail. On compact/large-text route, Brief and Options remain one explicit step apart and keep selection/position. |
| Evaluate a deployment | A first-time player can identify the finding, its confidence, relevant safety baseline and chosen tradeoff without opening a disclosure. Test both a known concern and a low-confidence negative finding. |
| Investigate and return | At most one navigation step to the relevant inspector and one to return, excluding inspection/confirmation actions; same issue/selection restored, new evidence and resources shown. |
| Fund a promise | Player can find the relevant program, see ongoing cost and conditional deadline forecast, change funding and explain whether it appears sufficient under current orders. |
| Respond to a threat | Player distinguishes two same-type threats, identifies known source/current response, and finds legal responses without searching unrelated panels. |
| Advance the Accord | Player identifies the next available step and correctly distinguishes negotiation progress from treaty signature. |
| Finish a quarter | Player sees due promises, spending/upkeep and unused actions, advances once, then explains the most consequential change from the report. |
| Interrupt / rotate | Exact engine state, pending result/report and current task survive background/resume; UI draft restores safely. Rotation preserves context and introduces no accidental commitment. |
| Layout/accessibility | EN/RU at 844×390, 667×375, 390×844, 320×568; native safe areas on both landscape sides; enlarged text route; 44×44 minimum targets; no inaccessible controls, overlap or clipped focus. Long narrative has one intentional reading scroller per active pane. |
| Mechanical correctness | Selection/navigation do not mutate game state; confirmations spend/resolve once; blocked reasons match engine validation; deterministic regression and localization pass. |

For a formative usability check, observe the user and at least one unfamiliar player performing deployment, promise and quarter tasks without coaching. Record success, wrong turns, lost context, missed controls and their explanation of cause/effect. Do not set or claim human completion-time improvements using automated scripts. A full 16-quarter run remains a pacing test, separate from basic task usability.

## Review prototype and checks completed

Open the [interactive study](http://127.0.0.1:5179/artifacts/ux-reassessment/prototype/) while the local server is running. Reopening instructions and limitations are in the [prototype README](../artifacts/ux-reassessment/prototype/README.md).

Try selecting a response, opening Orbis Group from the top bar, confirming the staged investigation, and returning. The selected response remains and the staged available actions decrease. English and Russian fixtures come from fogged views. The earlier paper/type/navy/cyan treatment is represented; this is an interaction study rather than final visual art direction.

Fresh headless WebKit checks at 844×390, 667×375 and 390×844 in both languages verified that all four option controls are within their clipping ancestors, their centers hit-test to the intended control, and their coordinates stay stable after selecting the second response. Company/funding return preserves selection. These checks directly target two reproduced failures in build 2; they do not establish human comprehension or physical usability.

The 667×375 study uses a compact 2×2 option grid and a separate reading page. This remains subject to longer card content and enlarged-text testing. The prototype's small secondary type, untested native safe areas, reading-position loss on resize, placeholder quarter page and simulated funding are explicit limitations. Investigation and choice results are independently staged engine outputs; they are not a live integrated game session. The next stage must implement and test the connected sequence against actual current game state.

Production source, the native project, the installed build and saves were not changed for this review. Only documentation and the disposable study are checkpointed.

## Approved pilot scope

The user approved **landscape-first task workspace + selective recovery of the earlier visual identity + usable sequential portrait fallback**, starting with the single integrated deployment/investigation slice. The disposable prototype is for testing this interaction model; it is not an installed candidate or proof that the complete game is comfortable.

The renewed agreement required by `AGENTS.md` and `docs/IOS_PORT_AGENT_INSTRUCTIONS.md` was given: “Do what is needed. Ping me when the pilot is ready.”
