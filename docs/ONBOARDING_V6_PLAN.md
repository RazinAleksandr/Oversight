# V6 onboarding — learn by running the first quarter

13 October 2026. Initial hypotheses and implementation contract. See [the build 6 report](RESPONSIVE_ONBOARDING_V6.md) for the shipped scope and verification.

Implementation contract for the root agent. User authorization covers implementation after internal review. No new user approval is required. This is a source audit and proposed contract, not a claim that the guide has been implemented or tested.

## Goal and diagnosis

Teach a new player **what to press, what that action does, and how to interpret the actual result**, using the running game. The guide highlights the next real control and advances when the real interaction succeeds. It must not become a slideshow or a second instruction manual.

Current source has useful ingredients but no joined learning path:

- `HowToPlay.tsx` is a long seven-section reference page with demonstration values, not an interactive introduction.
- `GameScreen.tsx` exposes `AdvisorHelp` only for the first pending tip relevant to the current tab. The welcome tip can remain pending indefinitely; the engine does not release another tip while one is pending.
- The current intro card teaches national identity and asks an opening priority. It does not teach the decision workspace, tentative selection, confirmation, or consequences.
- `taskDraft.ts` preserves the current card's reading, response and contextual return state. It deliberately expires when the card or turn changes, so it cannot own the whole tutorial.
- A single new guided path must own instructional focus. Do not revive the old floating `TipPopup` on top of it.

Local design-first and mobile-game skills apply: design around the actual next action, preserve safe areas and readable controls, and keep the guide stable across rotation/backgrounding. No Three.js-specific asset work is needed.

## Engine facts the guide must respect

| Fact | Source / implication |
| --- | --- |
| Q1 contains `sys:intro` and a teaching deployment | `startFirstTurn` in `engine/turn.ts`; bind to actual card IDs, never guessed names or a fixed company. |
| Only Agenda and Companies start unlocked | Nation unlocks at turn 2, World at 3, Threats at 4. Funding, diplomacy and threat work cannot be required in the first quarter. |
| End Quarter requires an empty inbox | `Game.canEndTurn`; unused actions do **not** prevent ending the quarter. |
| Choice costs vary | Opening priorities cost no action; deep evaluation currently costs an action and budget. Always display current `Choice`/`ActionView` costs and availability. |
| Deep evaluation answers the current request | It returns next quarter with further evaluation. The guide must accept this branch without waiting for an approval/rejection or prescribing another response. |
| Company investigation and model evaluation differ | Investigating a company changes its live intelligence; it does not rewrite the existing model evaluation record. |
| Adoption changes may be targets | Teach the existing immediate/target distinction from the actual result. Do not promise immediate realized adoption. |
| Risk is not a real-time countdown | The player may read at their own pace. Do not add a timer or imply that slow reading loses the run. |

Correct contradictory reference copy during this work: the current capacity tip says all briefings cost one action, and a fallback end-turn tip implies actions must be spent. The long manual also overgeneralizes immediate previews and guarantees warnings. New guide copy must use the actual rules above; updating these explanatory strings does not change balance.

## One guided story, six milestones

Each milestone can contain short interaction phases. The visible count remains six; it is not a new page per sentence. Instructions use a concise action title and one sentence about what happens next. Names, costs, counts, deadlines and effects come from the live fogged view.

| Milestone | Real target / instruction | Advances when | What is taught |
| --- | --- | --- | --- |
| **1. Open your first briefing** | Highlight the actual `sys:intro` Agenda button. “Open your welcome briefing. Your first job is to choose the department's priority.” A small goal line says keep four national meters above zero and risk away from midnight; no need to memorise all systems. | `openCard` opens the bound card. | The Agenda contains decisions the player must answer. |
| **2. Read, then compare** | Highlight `data-review-responses`. Explain that this opens responses without committing to one. Keep the actual national/leader story visible and scrollable. | The workspace changes to its response pane. | Briefing and responses are two views of the same case. |
| **3. Issue your first order** | Initially highlight the available response **group**, not a preferred strategic answer. “Select any priority to preview it.” After selection, highlight the actual `data-confirm-choice`: “Review the selected effects. Issue order makes this decision final.” | Only a successful `resolveChoice`; then the guide moves to the actual result. Highlight the real changed-effects area and `data-result-continue`; explain that this receipt shows recorded changes. Continue advances to milestone 4. | Selecting is tentative; issuing is the mutation; outcomes belong to the chosen branch. |
| **4. Judge the model request** | On the actual first deployment, highlight the evaluation/confidence evidence in the briefing. Then highlight `data-review-responses`. Explain the tradeoff: the evaluation is uncertain; the response determines release/evaluation/rejection. A deliberate optional “Inspect the company” route highlights the real inspector control and current investigation cost. Returning restores the case and selection. | Any successful response to that deployment, including deep evaluation; then actual result continuation. | Claims, evidence and confidence differ; extra information has a cost; no answer is forced. |
| **5. Advance the world** | If cases remain, highlight the next unresolved case and repeat the already-learned decision controls without repeating the whole lesson. Once `view.canEndTurn`, highlight the real End Quarter control. Explain that unused actions expire, but spending every action is optional; budget upkeep and world changes happen on quarter advance. | Actual successful `endTurn`, not the click or a disabled-control attempt. | Answer required briefings, optionally act, then explicitly advance the quarter. |
| **6. Read what followed** | On the real quarter report, point to the actual causal changes/report view and then `data-report-continue`. “This is what changed over the quarter. Continue to the next agenda.” Name a real report change only if one exists; otherwise use the neutral explanation. | Report continuation; persist core completion. | Delayed consequences, causes, replenished actions, and the next loop. |

The guide never clicks for the player, spends resources, preselects a response, changes difficulty, chooses a nation, auto-advances a quarter, or manufactures a practice result. A failed engine operation leaves the guide on the relevant phase and exposes the real error. Zero-cost and no-change results still progress correctly.

### Optional investigation branch

Offer the company inspection route while the deployment is unresolved; make it visibly optional. Opening the record itself does not spend resources. On its confirmation control, show the current cost and the distinction between company intelligence and the evaluation record. The player may investigate, return without spending, or continue with the existing evidence. If resources are insufficient, show the engine reason and offer Return to briefing. Never make a paid investigation a completion condition.

### Later help

After the first report, the core guide is complete. Offer brief opt-in tasks when the player visits a newly unlocked system: preview a program level before Apply, inspect a rival before diplomacy, inspect a threat's known cause and response. These are replayable contextual lessons, not prerequisites that hold up the campaign. Never put a spotlight on a locked navigation control. The reference manual remains available separately for full rules and terminology.

## Actual highlighting and layout

- Add an explicit guide target registry or stable `data-guide` IDs to semantic components. Do not infer controls from translated text, CSS color, array position, or brittle document-wide selectors.
- Targets include the bound Agenda card, review responses, visible response buttons/group, selected effects, issue order, result changes/continue, evaluation evidence, optional inspector, End Quarter, report changes/continue.
- Measure the live target rectangle after layout. Update it through ResizeObserver, viewport resize/orientation, and relevant scroll events. The outline is a presentation layer with `pointer-events:none`; the highlighted real control remains the click target.
- For “choose any response,” outline the available visible option group or multiple visible choices. Do not single out a strategic answer. Preserve scrolling to other valid choices.
- Put the guide instruction in a **reserved layout band**, not a floating block that covers story, costs, choices, News, or fixed confirmation/navigation controls. Short title + approximately 12–20 words of explanation; Skip/close is always reachable. On compact landscape this normally needs roughly 56–84px, but measure actual EN/RU content.
- Do not solve overflow with smaller body text, clipped guide copy, incomplete button targets, or a huge spotlight over another sheet. If the guide band and target cannot both fit, collapse the instruction to an accessible short prompt with an explicit expand control; expanded explanation is deliberately dismissed before returning to the real target.
- If the target is outside a bounded scroller, expose a “Show me” operation that reveals it in that scroller. It does not count as completing the lesson and does not mutate the game. Never scroll the whole application underneath a fixed overlay to fake target visibility.
- When Settings, News, another modal, or a contextual task obscures the anchor, suspend the outline and preserve progress. Resume when the eligible route returns. No competing guide, adviser, and menu layers.
- Target accessibility name and role remain native; guide explanation is available through `aria-describedby`/a polite status region. Do not move focus on every resize. Keyboard/VoiceOver users can use a direct “Focus next control” action without triggering that control.

## State and save integration

Use a separate presentation preference, e.g. `ato.onboarding.v1`, with a validated schema:

```ts
{ schema: 1, guideVersion: 1, preference: 'offer' | 'off',
  run: { seed, countryId, introUid?, deploymentUid?, lastObservedTurn,
         status: 'active' | 'paused' | 'skipped' | 'complete',
         milestone, phase, completed: string[] } | null }
```

- Add the key to `platform/storage.ts`'s `smallKeys`; otherwise Capacitor writes will succeed but a cold native boot will not hydrate the guide. Use the existing preference queue and lifecycle flush.
- `App.start()` explicitly creates/reset the guide's run record for the new run, even when replaying the same seed/country. Do not use seed/country alone to decide that a newly started daily run is the old run.
- Continue validates binding against the current view and reconciles completed mutations/card existence. Old saves with no guide record continue normally and offer “Guide this run” in Help; they do not unexpectedly open the Q1 tutorial over a pending result.
- Imports/restarts invalidate stale run binding. If the current save is older than `lastObservedTurn`, suspend and offer to restart the guide from current context rather than inventing missing decisions.
- `taskDraft` continues owning the current case's tentative response, reader position and contextual return. The guide observes those states; it does not create another copy or reset them.
- Pending choice/action/report overlays take precedence on load. Reconcile to their corresponding explanation phase. Never reopen an already resolved card or call an engine mutation during reconciliation.
- Persist immediately after successful semantic transitions. Record events from the component/controller callbacks (`openCard`, reading-pane change, selection, successful choice/action, actual end-turn, result/report continuation), not generic click capture.
- Completion means an observed control was used, not that reading or understanding was proved. Avoid claims that the player has “mastered” a system.

## Start, skip, replay, and advice

- New Game exposes **Guide my first quarter**, on by default for a first guided run. Taking office enters the real Agenda with milestone 1. A player can turn it off.
- Title **How to Play** offers “Start a guided game” through the normal new-game flow; if an active save exists, also offer “Continue with guidance.” Keep “Rules reference” separate. Never overwrite a save simply to replay help.
- In-game Help is always available, rather than conditional on one pending engine tip. It offers Resume/Replay guidance and Rules reference.
- Skip stops instructional overlays immediately and preserves engine state, the unresolved choice draft, and guide progress. Resume returns to the earliest still-relevant phase.
- Replay basics in an existing campaign uses the next unresolved real case and current report. Already-missing intro/deployment steps are explained as unavailable in this run and bypassed. A complete opening replay requires explicitly starting a new run through the normal flow.
- During active guidance, suppress automatic/adviser duplication. Keep authored tips available as reference topics. Do not mark every engine tip seen just to clear the queue, and do not use that queue as the guide state machine.

## EN/RU and responsive acceptance

All new strings use `t()`/`tp()` and a complete UI dictionary sync/translation. Dynamic values use placeholders and current localized data. Russian instructions should name the same actual controls and fit by layout, not by cryptic abbreviation. Corrected static tip text also requires syncing/translating its own content dictionary.

Required task checks:

1. New guided run in each nation; each intro priority remains valid, and no selection is made by the guide.
2. First deployment: approve/limit/reject/deep-evaluate branches; optional company investigation and insufficient-resource cancellation. Guide neither loops nor requires a specific answer.
3. Skip/resume at reading, selected response, optional inspection, result, and report. Engine save is unchanged by guide-only operations.
4. Reload/background/rotation at those same points, including native preference cold-start hydration.
5. Existing midrun save, same-seed New Game, imported earlier save, and a completed run: no stale card spotlight or silent save replacement.
6. EN/RU at 844×390 and 667×375 with safe areas, portrait 390×844, narrow 320px, and enlarged text. The full highlighted target and all costs/confirm/back controls remain accessible. Inspect screenshots as well as geometry.
7. Open News or Settings while guidance is active; no outline through an unrelated sheet, no stranded guide state, and the feed keeps its own usable scroller. Root's separate responsive repair must cover News directly.
8. Existing deterministic engine tests, full i18n check, TypeScript/build, and one actual guided first-quarter journey per locale. Automated completion is interaction evidence; physical thumb reach, reading comfort, and understanding remain human review.

## Accepted core implementation model

For the first implementation, the root selected a smaller derived state model rather than storing every milestone/phase. `src/ui/game/playGuide.ts` now supplies:

- `GUIDE_KEY = 'ato.guide.v1'` (this supersedes the illustrative `ato.onboarding.v1` name above).
- `GuideProgress`: schema, seed/country, `startedTurn`, `welcomed`, `completed`, and `lastDecisionKind`.
- `startGuide(view)`, `readGuide(view)`, `writeGuide(progress | null)`, `shouldOfferGuide()`.
- `deriveGuide({view, guide, route, card?, selectedId?, suspended?})` returns `{id, title, body, target, ack?, cardUid?}`. A null target is intentional for the welcome/completion acknowledgement. `route` comes from the actual overlay and task draft.
- The stored envelope retains `completedOnce` and `skippedOnce` separately from the current run, so an explicit replay does not re-enable automatic offers. Null is Skip; replay starts guidance from the current run/quarter without changing that run.
- Actual result/report routes take precedence over welcome/completion. Off-task exploration and covered controls suspend guidance. Missing/consumed cards cannot produce a stale confirmation prompt. Any valid selected response is accepted; affordability/engine-disabled state prevents targeting authorization for a blocked choice.

The core module and its tests do not implement the coach rendering, target measurement, App integration or native hydration; the root owns those. The optional investigation route currently pauses the core guide and resumes on return. A dedicated investigation coach remains an optional enhancement, not a claimed completed feature of this module.

Focused model verification: 14 tests passed, including all four first-deployment responses (approve, limited, reject, deep evaluation), optional unused actions before ending, resource/engine-blocked selection, pending result/report precedence, stale identity and future-start rejection, current-run replay, global skip/completion history, and engine-save invariance for guide-only operations. TypeScript passed. These are model checks, not proof that a spotlight fits the screen or that a player understands the lesson.
