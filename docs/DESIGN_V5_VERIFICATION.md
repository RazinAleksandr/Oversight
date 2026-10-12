# Atlas and dispatches — build 5 verification

13 October 2026. Branch `codex/iphone-art-direction-v5`.

## What changed

Build 4's uniform dark roster/detail treatment is replaced by a political atlas,
ivory institutional dispatches, and distinct task compositions. The world map
is visible on the title, nation selection, Agenda and default World view. Nations
are selectable; their records and diplomacy retain a clear map return.

Briefings prioritize the source, request and evaluation before the response stage.
Programs show a connected allocation scale and staged funding. Government shows
leader, commitment, deadline and forecast. Laws expose the operative effect;
Society compares actual adoption with targets; incidents show their progression.
Company records, press, quarter reports and endings have separate compositions.

Three existing agents handled visual research/management, atlas art/World, and
dispatches/operations. The director reviewed their hypotheses and actual renders.
Relevant local skills included the design-slop audit, design-first UI prompting,
mobile game controls/testing, hybrid procedural assets and progress screenshots.
No additional agents or dependencies were introduced.

## Compatibility

No balance, RNG, costs or outcomes changed. Optional `EvidenceLine.role` metadata
supports presentation order; old saved cards without it remain valid. The UI
continues to consume fogged views. All UI strings are localized; English/Russian
checks pass. Native version is 1.0, build 5.

## Evidence and limits

- `artifacts/design-v5/qa/`: decision-family, management and report checks.
- `artifacts/design-v5/treaty-retest/`: regression for a long Russian treaty tile.
- `artifacts/design-v5/final-playthrough/`: complete campaigns and reload checks.
- `artifacts/design-v5/national-smoke/`: staged funding/cancel/apply, demand update,
  and incident investigation against exact engine outcomes.
- `artifacts/design-v5/*-world-verified.png`: all four nation controls and routes.
- `artifacts/design-v5/final-entry/`, `final-controls/`, `dispatch/`,
  `management-final/`, `overlay-review/`: inspected render evidence.

The WebKit checks use synthetic saves, touch events, EN/RU, 844×390 and 667×375
landscape with 47px side/21px bottom safe areas, plus 390×844 portrait checks.
Intentional reading/list scrolls are recorded. They do not constitute physical
thumb-reach testing or user acceptance of the new art direction.

Concrete review fixes included overlapping portrait map targets, an oversized
Russian law title, a long treaty tile, weak portrait heading contrast, legacy
paper noise, and secondary pages that ignored safe areas or overlaid controls.

## Final checks

- 115 unit tests passed; TypeScript and production build passed.
- Localization check: all translated.
- 52/52 scenario checks passed after one focused Russian treaty retest.
- Two full campaigns completed, including ending and completed-save reload.
- Six management touch flows and six map/Agenda/watchlist flows passed in EN/RU
  at all three sizes; four new-game/status/settings/help entry flows passed.
- All ending record sections were inspected after their paper contrast fix.
- Signed Xcode archive succeeded; codesign and release preflight passed. All 71
  production files match the signed archive byte-for-byte.
- Device installation succeeded on the connected iPhone 13. Device metadata
  confirms `com.viktor.oversight`, version 1.0, build 5.
- Both native Documents save journals were backed up and preserved byte-for-byte:
  two files, 29,372 bytes. Backups are local under `artifacts/design-v5/`.

Remote launch timed out after 15 seconds; app launch on the phone was not verified.
Open Oversight manually for the physical review.

Native archive: `artifacts/ios-release/Oversight-Atlas.xcarchive`.
Rollback release: Git tag `iphone-full-redesign-build-4`. The new implementation
is isolated on `codex/iphone-art-direction-v5`; no browser deployment or push.

Physical-device visual playtesting is still a human review step. Automated renders
and successful installation do not establish subjective comfort or final design
acceptance.
