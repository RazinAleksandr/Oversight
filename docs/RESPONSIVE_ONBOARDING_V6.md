# Responsive layouts and guided play — build 6

13 October 2026. Branch `codex/responsive-onboarding-v6`.

## Diagnosis and changes

The previous layout treated orientation as the main sizing rule. Available
reading space and hardware insets were not consistently accounted for.

| Observed defect | Correction |
| --- | --- |
| News heading/close under portrait cutout; body against screen edge | Explicit safe frame in every orientation, fixed 44px close, independent reading area and width-based article columns |
| Russian 320px funding reader collapsed to about 3px | Compact native subject picker, program title inside the content scroller, fixed commit controls; usable reader now about 281px |
| Small header wrapped to 88px | Compact quarter/year and action count, with full accessible labels and 44px status/risk/menu controls |
| Narrow portrait opened on map before the required decisions | Dispatch queue first; complete interactive atlas remains below |
| Russian incident title overlapped stage | Separate heading and stage rows |
| Tablet portrait map was flattened | Proportional atlas and side-by-side management at wider portrait sizes |

The map and strategic systems remain present. No engine rules, balance, costs,
RNG, fog-of-war or engine save schema changed. No dependencies were added.

## Interactive onboarding

The guide follows actual gameplay: open a briefing, read it, review responses,
select any available response, issue the order, inspect the recorded outcome,
resolve the remaining requests, end the quarter and read its report. Highlighted
controls are real controls; the guide never performs a game action for the player.

- First new run offers guidance automatically. Welcome can be skipped.
- **Hide hint** frees the reading area without ending guidance. New steps expand.
- **Skip guide** ends guidance without changing the game or tentative choice.
- Existing campaigns can start it through **Menu → Guided walkthrough**. This
  begins at the current quarter and does not reset the campaign.
- Matching unfinished guidance resumes with the saved task after reopening.
- Guide state uses a separate native-hydrated preference, `ato.guide.v1`.
- Company inspection or unrelated sheets pause guidance until the player returns.
- Deep evaluation is accepted as a complete answer to the current request.
- English and Russian copy explain that actions need not all be spent, adoption
  targets do not equal immediate uptake, and warning signs are not guaranteed.

`ONBOARDING_V6_PLAN.md` records the initial hypotheses and model contract. The
implemented entry points and skip behavior described here supersede its proposed
title-screen choices, milestone count and resume UI. Optional investigation has
no separate coach sequence in this version.

## Verification

Evidence is local under `artifacts/responsive-v6/` and `artifacts/guide-v6/`.

- 132 unit tests pass, including 17 guide model tests for branches, affordability,
  stale-run rejection, skip/replay, report precedence and game-state invariance.
- TypeScript/production build and complete English/Russian localization pass.
- 18 viewport/language routes, 162 screenshots, zero page errors. Dimensions:
  320×568, 375×667, 390×844, 430×932, 568×320, 667×375, 844×390,
  932×430 and 768×1024. Hardware insets are simulated per profile.
- Eight focused management flows pass: real subject selection, tentative funding,
  cancel, exact engine apply, investigation outcome, and News scroll/close.

- Eight production first-quarter walkthroughs pass: EN/RU ×844×390,390×844,
  320×568,568×320. Each checks real touch targets, coach/target separation,
  hide/show, saved tentative choices, rotation, reopening the report, finishing,
  replaying, skipping and returning through the title. Game actions match an
  exact engine oracle; guide-only operations leave the engine state unchanged.
  Both568 cases choose deep evaluation. Evidence:128 step captures and the
  two `artifacts/guide-v6/{en,ru}/results.json` files.
- Focused follow-up flows pass after final review: EN844 same-run import and
  fresh-run replacement clear active guidance while keeping history; RU568
  remains usable after reserving the top and bottom game navigation for hints.
  Evidence: `artifacts/guide-v6/replacement-en/` and `chrome-ru/`.
- Four production entry/status/settings/help flows pass (EN/RU at667×375 and
  390×844). Older task fixtures explicitly skip the new guide; its own tests
  qualify the guide independently.
- 26 production scenarios pass across all11 decision families, management and
  quarter reports in EN/RU landscape.
- Signed Xcode archive succeeds; codesign and bundled release preflight pass.
  All71 production files match the archived app byte-for-byte. Version1.0/build6.

Initial test failures were resolved: asynchronous browser preference writes raced
first guide mount; a replay request counter could restart a skipped guide on a
same-page Continue; welcome placement needed to reserve the game navigation;
explicit new/imported runs needed to clear active guidance
while preserving skip/completion history; an exact-oracle assertion needed the same JSON normalization
as a serialized save. The passing guided suite includes those regression cases.
One development-server scenario scan was interrupted by live edits; final release
scenario checks use an unchanged production preview.

## Device delivery

Final signed build6 was installed on the connected iPhone13 (Lul). Both native
Documents save journals match the pre-install backup byte-for-byte: two files,
29,372 bytes. Backups and installation receipt are under `artifacts/responsive-v6/`.
The archive is `artifacts/ios-release/Oversight-Guided.xcarchive`.

Remote launch timed out after15seconds. Installation is confirmed; foreground
launch and physical gameplay are not confirmed. Open Oversight manually. Existing
campaigns can invoke Menu → Guided walkthrough; they are not reset or forced into
a new tutorial. Task-owned preview servers were stopped after verification.

## Limits and rollback

WebKit viewport checks are not physical thumb-reach, VoiceOver, Dynamic Type or
human comprehension tests. Long records and small landscape screens intentionally
scroll. Visual inspection is separate from button geometry and engine checks.

Build 5 is preserved at Git tag `iphone-atlas-build-5`. Build 6 stays on its own
branch; no push to `main` or browser deployment is part of this release.
