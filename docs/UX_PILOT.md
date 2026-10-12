# iPhone task workspace pilot

12 October 2026. Implements the approved first pilot from
[the UX reassessment](UX_REASSESSMENT_DECISION.md): a deployment decision,
company investigation, and return to the same decision.

## Scope

Deployment requests use a dedicated workspace. Wider landscape shows the reading
surface beside the choices; compact landscape and portrait use explicit reading
and comparison views. The earlier dark frame, paper, institutional type and
signal colors inform this surface. Other game panels retain the previous build's
layout; this is not a completed redesign of Nation, World, promises or reports.

The player can compare response summaries, inspect full effects, open the related
company directly, investigate it, read the findings, and return to their selected
response. Selecting a response never commits it. Confirmation names the chosen
response, and the engine validates its current availability.

## Information and strategy

- Authored evaluation evidence remains available, including confidence and source
  labels. Default reading includes every evidence line; verified lines appear first.
- Known model concerns, the current fogged capability estimate and national
  safeguards remain in the reading surface when inspecting effects. A clean check
  is not presented as proof of safety.
- Company investigation updates the live company record and capability estimates.
  It does **not** repeat the model evaluation. The original evaluation is labelled
  as a separate record. The investigation result explains this distinction.
- Costs, political/company effects, uncertain consequences, choice hints and any
  supplied probabilities remain inspectable. Adoption previews are labelled as
  target changes; actual uptake occurs over later quarters.
- Investigation binds the existing engine action to the relevant company. Its
  company-specific relation preview is exposed through an optional view field;
  the action's costs, RNG and rules are unchanged.
- All authored deployment choices remain available, including evidence-backed
  rejection where the engine supplies it. Returning evaluations can have fewer
  choices. The UI does not invent new responses after an investigation.

## Context and persistence

A separate optional UI draft stores the current card, uncommitted response,
reading section, scroll positions and company route. It is validated against the
run's seed, country, quarter and unresolved card. New runs and imported saves clear
it. This draft is not authoritative game state and does not change the engine save
schema.

The existing pending-action record retains its result and return-to-card link.
Reloading during an investigation result must display that result before returning
to the decision. Action/choice guards prevent repeated taps from spending twice.
Draft scroll writes are debounced, with lifecycle flushes; task changes update
immediately. These mechanisms require the verification below rather than implying
that every native interruption timing is already covered.

## Verification status

The automated engine/storage suite passes **114 tests**. TypeScript checking,
production build and localization pass; the Russian UI dictionary contains **630
translated keys**. All new player-visible strings use the existing localization
system. Complete scripted production runs reach endings in English (12 quarters)
and Russian (14 quarters), including restoration of pending results and quarter
reports. These run lengths describe the tested seeds, not an expected human session
length or game-balance claim.

The final frozen production WebKit run passes **14 of 14 scenarios** with no
reported page errors. Results: `artifacts/ux-pilot/qa-results.json`; reproducible
harness: `scripts/ux-pilot-smoke.mjs`.

Coverage includes the deployment/investigation/return task in EN/RU at 844×390,
667×375, 390×844 and 320×568, plus six targeted states: last-action affordability,
low cash, five choices, returning evaluations with three choices, 125% Russian
text, and reload during an inspection or pending investigation result.

The task checks include no mutation on selection, a correctly bound investigation
charged once, preserved selection/reading after a detour, reload/rotation,
safe-area geometry and duplicate-confirm protection. Fixture generation uses fresh
Russian content rather than merely placing English saved cards inside a Russian UI.

Initial checks exposed a 13-pixel Russian mode-label shift and cost text extending
outside option rows. Visual inspection caught child-content overflow that button
rectangles alone missed; the harness now checks child containment too. Those
corrections and the final wide-landscape safe-area correction pass the rerun.
The initial results remain in `qa-production-first-results.json` for comparison.

Final screenshots were inspected for English selection/return and Russian safe
areas at 844, 667 and 320 pixels, five choices and 125% text. Ordinary four-choice
requests fit together at 844×390 with the tested safe areas. Compact layouts and
enlarged text use a bounded option scroller; the tests establish that each response
and its contents can be reached, not that all choices fit simultaneously.

I inspected the frozen Russian 844×390 selected-decision screenshot. Authored hint
text renders correctly and choices stay visible. Its reading pane is approximately
100 pixels high beneath the persistent evidence summary and tabs; longer hints and
effects require scrolling. This remains a specific physical-playtest comfort risk.

## Native delivery

A signed build 3 archive was rebuilt after the final layout correction. Root
verification confirmed that its 71 bundled web files match the production build
and that the app loads local offline assets. A fresh phone save backup completed at 19:36 before the install attempt.
Installation then failed with CoreDevice error 4000 because the paired iPhone was
no longer reachable; the device list reports it unavailable. Build 3 is prepared
but **not installed**. The previously installed build was build 2, and the failed
attempt stopped before transfer; the current installed version cannot be rechecked
while the phone is disconnected. Reconnect and unlock the phone to complete native
delivery and verify the saved run afterward.

## Review boundary

This pilot must be played on the actual iPhone before its interaction pattern is
expanded to funding, demands, threats and diplomacy. Browser geometry and scripted
completion do not establish touch comfort or player understanding. The enlarged-text
check is 125% text only; 200% text, native Dynamic Type, VoiceOver, physical touch
reach and uninterrupted human play remain unverified. Longer content
uses explicit bounded scrolling; the pilot does not promise every choice's full
prose fits simultaneously on a small screen.
