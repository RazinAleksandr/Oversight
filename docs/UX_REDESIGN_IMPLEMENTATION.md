# iPhone UX redesign — 12 October 2026

The user approved the recommendation in [the UX review](UX_REVIEW_2026-10-12.md)
and requested Git rollback protection. The implementation follows the portrait-first
dossier direction and retains landscape support.

## What changed

- Decisions occupy the entire phone screen. Landscape gives context and choices
  separate scroll columns. Selection previews consequences; a second, explicitly
  labelled button commits the choice. Blocked choices explain their reason.
- Deployment reviews begin with a short request and compact option labels. Evidence,
  advisor notes and the original briefing remain available. Known model concerns
  stay visible before opening the evidence. Capability, national safeguards and actual
  versus target adoption can be compared in the same document, using fogged views.
- Primary navigation is Desk / Nation / World. Engine unlocks still apply. Companies
  live under Nation; threats and news are accessible from Desk. Existing actions,
  programs, laws, model controls and diplomacy remain available.
- Ordinary outcomes are persistent inline receipts. Mandatory narrative follow-ups
  and game-ending results retain an explicit continuation. Pending results still
  survive reload. No choices are automatically acknowledged or resolved.
- Reports show the four changes compactly, with every provided reason expandable.
  Continuation stays visible. Headlines are expandable; warnings and highlights remain.
- Companies and laws use expandable rows. Diplomacy progress appears before an optional
  world map. Debrief navigation uses one selector and epilogue paragraphs appear immediately.
- Setup suggests Commonwealth / Analyst for ordinary new games. All nations and
  difficulties remain selectable; Daily Run stays Director. First-quarter guidance
  explains the loop. Tips appear in the relevant section, in document flow.
- The visual system uses a matte desk, clean paper, restrained colors and a typographic
  wordmark. Removed the animated network background, floating result numbers and
  decorative result shake. This also removes one continuous canvas workload.
- Investigated threats use authored descriptions for known causes, replacing a
  language-dependent sentence filter. No RNG, costs, odds or campaign rules changed.

## Git and data protection

- Implementation branch: `codex/iphone-ux-redesign`.
- Baseline branch: `backup/iphone-before-ux-2026-10-12`, commit `1883243`.
- First implementation checkpoint: `11367f0`.
- Threat-description correction and regressions: `592ce55`.
- Subsequent polish and release verification are separate commits on the same branch.
- No branch has been pushed by this work; `main` has not been updated.
- Preexisting `.gitignore` edits and untracked user files were preserved and excluded
  from the implementation commits. Additional backups are in
  `artifacts/ux-redesign/preexisting-changes.patch` and `preexisting-files.tar.gz`.
- Engine save schema remains version 1. Native persistence and its two-slot journal
  were not changed. iPhone preferences and both save slots were copied before updating
  the app: `iphone-pre-ux.plist` and `iphone-documents-before/` in the artifact folder.

### Switch back to the baseline code

After saving or committing any later work:

```sh
git switch backup/iphone-before-ux-2026-10-12
```

Return to this implementation with:

```sh
git switch codex/iphone-ux-redesign
```

These commands retain both histories. The old signed 1.0 (1) application remains at
`artifacts/ios-release/Oversight.xcarchive/Products/Applications/App.app`; the new
1.0 (2) archive is `artifacts/ios-release/Oversight-UX.xcarchive`. Reinstalling the
old app is a separate native rollback step. Keep a fresh save backup before doing so;
rollback installation itself has not been exercised on the user's phone.

## Verification

Results and screenshots live in `artifacts/ux-redesign/`.

- 110 tests pass, including three known-cause narrative regressions that verify views
  do not mutate serialized state or RNG.
- Production TypeScript/Vite build and full localization check pass.
- Production WebKit complete runs in EN and RU reach endings, restoring both a saved
  result and a saved quarter report after reload. No page errors. These scripted runs
  do not establish game balance or human learning time.
- `scripts/ux-redesign-smoke.mjs` covers EN/RU at 320×568, 390×844 and 844×390:
  setup, Desk, choice inspection without a save mutation, explicit confirmation,
  non-modal receipts, evidence, reports, companies, laws and programs. Choice rows
  are at least 44 pixels high. No document horizontal overflow or page errors.
- Additional later-game fixture checks cover three-destination navigation, threats,
  World, disabled choices, all final-decision options and emulated safe-area geometry.
  Their local harness and results are `late-states.mjs` and `late-results.json`.
- The landscape main scroller measures 294.5 pixels high at 844×390 (75.5% of viewport),
  compared with 85 pixels in the late-game baseline audit. Its action button is now
  in document flow, so it does not cover the reading area. Safe-area emulation is a
  geometry check, not native OS testing.
- Xcode Release archive with Apple development signing succeeds. The build emits
  the existing Vite large-language-chunk advisory and the harmless Xcode metadata
  extraction notice for an app without App Intents.

### Reproduce the primary checks

```sh
npm test
npm run build
npx tsx scripts/i18n.ts check
npm run preview -- --host 127.0.0.1 --port 5176 --strictPort
# In another terminal:
node scripts/ux-redesign-smoke.mjs
npm run ios:smoke
```

## Limits and next playtest

Headless WebKit screenshots demonstrate rendered layouts, not physical touch comfort.
VoiceOver, larger system text, long-session heat/battery, and an uninterrupted human
playthrough still need a real-device check. Long warnings, evidence, or option labels
can require scrolling on narrow screens; preserving their meaning takes priority over
forcing every state into one viewport. The final-decision odds and 16-quarter pacing
were deliberately left as approved game rules.

TestFlight publishing remains separate from this UI iteration; the existing App Store
Connect app-record blocker is described in the iOS release documentation.
