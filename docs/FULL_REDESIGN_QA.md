# Full iPhone redesign: research and acceptance

Date: 2026-10-13. User authorized the full implementation. This is the QA contract, not another approval gate.

## Design thesis

The complete game needs a consistent command interface organized around the player's current job. A compact landscape shell should expose an actionable agenda, then give each decision or management service a substantial workspace. Relevant state, costs, consequences, and the next action belong together. Going away to investigate must preserve the original decision and reading position.

The agreed visual direction is charcoal, ivory, and amber with existing portraits, emblems, and company marks carrying source identity. The redesigned game should have one coherent hierarchy across agenda, decisions, services, results, and reports. Decorative document borders and repeated nested panels must not consume the interaction surface.

### Primary references, inspected and interpreted

- [Suzerain official game page](https://www.suzeraingame.com/), Royal Decree screenshot: a central decree brings policy explanation, resource cost, adviser stance, and signature together while retaining the national setting. **Inference for Oversight:** connect a briefing to its consequence and committing action in one workspace. Do not copy desktop text density or its ornament.
- [Papers, Please official site](https://papersplea.se/), booth screenshot: the document is an object being worked on, and the surrounding work areas have distinct roles. The publisher also describes its phone/tablet edition as touch optimized. **Inference:** use source identity and stable working areas to make interaction meaningful; a landscape desktop composition alone is not mobile adaptation. No usability claim is inferred from a screenshot.
- [Into the Breach, official Subset Games description](https://subsetgames.com/itb.html): enemy attacks are telegraphed before the player counters them. **Inference:** Oversight should make known costs and predictable near-term consequences inspectable before commitment. Its uncertainty is part of the game and must remain explicit; hidden risks must not be converted into false certainty.

Research images are local reference evidence only: `artifacts/full-redesign/references/`. They are not game assets.

## Fresh build 3 baseline

Captured with production headless WebKit at 844×390 and 667×375, without emulated safe areas. Files: `artifacts/full-redesign/before/en-{844,667}-{agenda,deployment,programs,world}.png`.

Visually inspected agenda/deployment/programs at 844 and World at 667:

- Agenda shows one complete briefing and part of the next; the status shell, secondary tabs, and repeated heading consume the upper half.
- Programs shows the financial summary and first program heading, with no funding control visible at the fold. The program action is separated from its purpose by shell and section chrome.
- At 667×375, World retains a 130px HUD and 56px bottom navigation. The first actual strategy panels are clipped at the fold.
- The deployment pilot uses nearly the whole screen and offers a real comparison surface, but its presentation differs markedly from the surrounding game. Fixing that one workflow does not fix the rest.

These are observable geometry and navigation defects. No human task time or preference measurement is claimed.

## Acceptance matrix

Primary matrix: English and genuinely generated Russian content at **844×390 and 667×375**, with **47px left/right and 21px bottom** emulated safe areas. Portrait 390×844 remains a fallback check. WebKit geometry does not establish UIKit safe-area behavior or physical thumb comfort.

| Task | Required evidence |
| --- | --- |
| Agenda | Find an outstanding briefing; open it; understand remaining work; all five main destinations are reachable; no decorative header pushes every real task below the fold. |
| All 11 decision families | Actual localized intro, deployment, demand, negotiation, situation, event, election, breakthrough, treaty, last chance, and threshold cards. Read the briefing; compare options; select without spending; cost/uncertainty remain available; confirm once; inspect result. |
| Management round trip | A relevant service opens from the case, acts on the correct entity, and returns to the original selected case with live resources and preserved context. |
| Demand → funding | Active demand/forecast visible alongside the relevant program route; change level; updated upkeep and forecast; exact serialized program change. |
| Threat | Identify detected threat and escalation; investigate or respond to the correct threat; exact costs and once-only result; return to the threat context. |
| World / diplomacy | Select a rival, inspect current relationship and Accord context, authorize a visible action with accurate target and cost, see the result and updated state. |
| Quarter report | Resolve work, end quarter, inspect causes/outcomes and next action, reload pending report without advancing twice, proceed to new agenda. |
| Complete runs | Real UI sessions in both languages finish a run and open saved debrief. This checks integration, not difficulty balance. |
| Interruption | Selected decision survives reload/rotation; pending action/result/report does not repeat spending. |
| Layout/access | Coordinate hit tests before taps; target and child text containment; intentional scrolling recorded; no auto-scroll masking inaccessible controls; no console exceptions; source identity preserved. |

## Test methodology

`full-redesign-fixtures.ts` generates isolated synthetic states using production card constructors separately per locale. It also resolves the intended choice through a cloned engine as an exact state oracle. No fixture comes from the phone or user's saves. Serialized English cards under Russian chrome are not accepted as Russian tests.

The browser tests used real DOM and touch events against the integrated production build. Engine oracles only verify outcomes; they do not replace UI interaction. Assertions measure containment and reachable controls, rather than brittle absolute coordinates. Screenshots are inspected in addition to assertions because the pilot's first QA version missed text spilling outside correctly sized button boxes.

## Results and qualification

The first production run executed **54 scenarios: 52 matrix cases and two complete sessions**. It passed 53; the sole failure was a Russian 667×375 funding level button whose bottom was covered by the fixed footer (95.36px total height, 72.44px visible). The compact funding layout was corrected without reducing text size or making the funding targets smaller than 44px.

After the final source freeze, **all eight affected demand/management cases passed again**: EN/RU × 844×390/667×375. These reruns cover the corrected funding target, exact costs and entities, funding forecast change, decision→management→reload→return, company navigation, and diplomatic confirmation. No console exceptions occurred. This is the scoped qualification of the final build; the full 54-case sequence was not repeated after those narrow shell, label, and funding changes.

| Evidence | Result |
| --- | --- |
| `artifacts/full-redesign/qa-production-results.json` and `qa-production.log` | Original 54-scenario production run; first failure preserved. |
| `artifacts/full-redesign/qa-final-targeted-results.json` and `qa-final-targeted.log` | Final eight affected cases: 8/8 pass. |
| `qa-dev-en844-results.json`, `qa-dev-en844.log`, `qa-dev-deployment-recheck.log` | Development evidence, including the missing PreviewChip import crash and successful correction. |
| `qa-en-complete.png` | 35 UI decisions, 15 quarter reports; Loss of Control at Q3 2030. Last decision turn 15. |
| `qa-ru-complete.png` | 33 UI decisions, 14 quarter reports; threshold decision on turn 15, then “Война, которую никто не объявлял” at Q3 2030. |

Both complete sessions successfully reopened the saved debrief. They are completed **loss runs**, not demonstrations of 16-quarter survival or game balance. All individual decision families, including threshold, were also exercised independently with real localized card constructors and exact engine state oracles.

### Visual review

Inspected production screenshots include EN844 introduction/deployment selections and outcomes; EN/RU funding, forecast, threat confirmation, diplomatic confirmation, reports; RU667 deployment and company investigation; both ending screens. Final corrected screenshots inspected specifically:

- `qa-ru-667-funded.png`: all four funding targets and Apply/Cancel visible, with compact upkeep disclosure.
- `qa-ru-667-demand-updated.png`: updated defense funding commitment and direct return to funding.
- `qa-ru-667-diplomacy-confirm.png`: correct target and cost; no false zero-effects assertion.
- `qa-ru-844-funded.png`: full-size program editor after the shared navigation change.
- `qa-en-844-management-agenda.png`: focused agenda, threat/demand watchlist, contained quarter control.

Narrative, report, and compact Russian option panes intentionally use bounded scrolling. This qualification does **not** mean every line or every alternative's cost is simultaneously above the fold. Tests record intentional scrolling used to reach controls and verify complete interactive target visibility before coordinate taps; selection itself must not move the chosen target or spend resources. Text must stay inside its own choice button even when that button is outside the visible scroll area.

### Issues corrected during review

- Company inspector crashed because PreviewChip was not imported.
- Compact Russian funding level targets were covered by the fixed footer.
- Deployment outcomes labelled adoption-target changes as immediate actual adoption. Results now separate the target and state that uptake occurs later.
- An empty action preview was rendered as “No immediate visible effects,” which was false for diplomacy. The interface now omits that unsupported claim.
- Entry/setup, national status, generic sheets, and their safe areas were qualified separately; that evidence belongs to the release report.

### Reproduction

Use Node 24 and a production preview server:

```sh
IOS_PREVIEW_URL=http://127.0.0.1:5177 FULL_QA_COMPLETE=1 node scripts/full-redesign-qa.mjs
```

The scoped final rerun was:

```sh
IOS_PREVIEW_URL=http://127.0.0.1:5177 FULL_QA_TASKS=demand,management node scripts/full-redesign-qa.mjs
```

The script generates its own synthetic fixtures and localized state oracles. `qa-results.json` is the most recent invocation, so the two preserved result files above must be used to understand the complete verification history.

Remaining human/native evaluation: perceived readability, touch comfort, comprehension of uncertainty and forecasts, VoiceOver, system Dynamic Type, and real UIKit safe areas. These are not established by headless screenshots.
