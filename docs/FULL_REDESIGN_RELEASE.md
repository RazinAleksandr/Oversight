# Full iPhone redesign — build 4

13 October 2026. Branch: `codex/iphone-full-redesign`. Implementation checkpoint: `230e406`.

## What changed

The earlier deployment pilot is now a complete presentation and interaction redesign.
The charcoal command-room direction uses warm ivory type, amber decisions, source
portraits/emblems and a compact landscape navigation rail. The agenda brings live
commitments and threats beside outstanding decisions. Status and advice open on
request rather than occupying the working area or interrupting controls.

Every briefing family uses the same decision workspace. Reading, comparing,
investigating and confirming have distinct controls. Short landscape screens use
Briefing/Responses navigation; wider screens show reading and choices together.
Selection is tentative, and one explicit confirmation spends resources. Company
investigation and contextual management return to the selected decision; the UI
draft survives reload and rotation independently of the engine save.

Management now has subject selection and a focused working detail: programs stage
funding with Apply/Cancel, commitments expose conditional forecasts and relevant
routes, company actions sit near the subject, threats prioritize available responses,
and international affairs expose targeted diplomacy and treaty readiness. Full
catalogs and intelligence remain available through deliberate content scrolling.

The opening menu, nation selection, authorization and consequence pages, and
quarter report share the new hierarchy. Reports expose causes and follow-up routes.
Adoption target changes are explicitly separated from immediate consequences.
English and Russian share the same layout and complete localized copy.

## Preserved

No engine rules, balance, RNG, campaign length, authored choices or hidden-data
boundaries changed. Native save journal and engine save format remain compatible.
Existing build 2/build 3 Git checkpoints and archives remain available. No main
push, browser deployment or TestFlight upload is part of this delivery.

## Verification and delivery

See [the QA report](FULL_REDESIGN_QA.md) for scenario results and limits.
Release artifacts and local screenshots are under `artifacts/full-redesign/`.
The signed archive is `artifacts/ios-release/Oversight-Redesign.xcarchive`.

Physical reading comfort, thumb reach, VoiceOver, Dynamic Type, real UIKit safe
areas and prolonged play remain user/device evaluation. Headless WebKit checks
establish layout and interaction evidence, not those human qualities.

Automated verification: 115 unit tests passed, TypeScript/Vite build and the full
translation check passed. Four production entry/setup/status/settings/advice smoke
journeys passed in EN/RU at 667×375 with safe areas and at 390×844. The full task
matrix and corrected-case reruns are recorded in the QA report. Both production
playthroughs reached loss endings and reopened their completed debriefs; this does
not claim 16-quarter survival or balance qualification.

The signed build 4 archive passes strict signature verification and offline asset /
privacy preflight. All 71 files from the tested production `dist` are byte-identical
inside the app bundle. Device save backups precede installation.

Installed on the connected iPhone 13 (Lul) as Oversight 1.0, bundle version 4.
`devicectl` confirmed the installed version. Both native Documents journal files
(29,372 bytes total) were byte-identical before and after installation. Backup,
installation and preservation evidence is under `artifacts/full-redesign/`.

The remote launch attempt timed out after 20 seconds while the phone was locked;
a successful physical launch and play session are not claimed. Open Oversight on
the phone and rotate to landscape for review. Prior rollback tags remain
`iphone-ux-pilot-build-3` and `iphone-ux-build-2`.
