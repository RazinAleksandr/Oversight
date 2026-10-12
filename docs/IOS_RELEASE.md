# iPhone release

Status on 12 October 2026: **signed candidate installed and launched on the paired iPhone; TestFlight upload awaits an App Store Connect app record.**
Branch: `codex/ios-port`. Desktop/browser release qualification is deferred.

## Configuration

- App: Oversight; bundle ID `com.viktor.oversight` (external registration is not confirmed).
- Team: `PW4Q53FM3J`, supplied by the user; active membership confirmed by the user.
- Xcode 26.3 at `/Applications/Xcode-26.3.0.app`; iOS 26.2 SDK.
- iPhone only, minimum iOS 16.0; portrait and landscape; EN/RU.
- Node 24.21.0; pinned Capacitor 8.5.3 core/iOS/CLI.
- iOS 26.3.1 simulator installed. Existing 17.2/18.3 runtimes also available.

## Build and checks

```bash
npm ci
npm test
npm run ios:sync
npm run ios:preflight
npx tsx scripts/i18n.ts check
npm run ios:build                  # unsigned Release simulator build
```

The preflight checks bundled game assets, local fonts, Russian pack, missing remote
launch dependencies, mock exclusion and required privacy reasons. Fonts and their
licenses live in `public/fonts/`.

For a repeatable production-interface journey:

```bash
npx playwright install webkit
npm run preview -- --host 127.0.0.1 --port 5176
# In another terminal:
npm run ios:smoke
```

`IOS_PREVIEW_URL` can override the preview address. The smoke run uses real UI
controls in headless WebKit, runs both languages through an ending, checks pending
choice/report recovery and saved debrief reopening, and verifies that release QA
hooks are absent. Evidence is written to `artifacts/ios-smoke/`. This is not a
physical-device test, nor a skilled playthrough or balance measurement.

## Signing and TestFlight

The user refreshed Xcode authentication and accepted the updated Program License
Agreement. Automatic signing now succeeds for team `PW4Q53FM3J`.

```bash
npm run ios:archive
```

The signed Release archive is `artifacts/ios-release/Oversight.xcarchive`.
Its code signature verifies, and the asset/privacy preflight passes against the
actual app bundle. The development-signed app installed and launched on the paired
iPhone 13 running iOS 18.7.8; its native Preferences file was created. This confirms
installation and initialization, not a complete physical playthrough.

App Store Connect export succeeded at
`artifacts/ios-release/testflight/App.ipa` (version 1.0, build 1), using automatic
distribution signing and `testFlightInternalTestingOnly=true`. This candidate is
restricted to internal testing. Export is not server upload validation.

Upload was attempted but stopped at `IDEDistributionFetchAppRecordStep` with
`DistributionAppRecordProviderError.missingApp(bundleId: "com.viktor.oversight")`.
Create the matching app in App Store Connect → Apps → + → New App:

- Platform: iOS
- Name: Oversight (availability still unconfirmed)
- Primary language: English (U.S.)
- Bundle ID: `com.viktor.oversight`
- SKU: `oversight-ios`

If the bundle ID is absent from the menu, register it as an explicit App ID under
Certificates, Identifiers & Profiles first. The development archive used an
Xcode-managed wildcard profile; that alone does not establish an App Store record.
Browser and Xcode Computer Use were denied, so the user must perform this account
step or enable suitable access. No tester invitations or external submission
have occurred, and no build has reached TestFlight.

After the app record exists, retry:

```bash
xcodebuild -exportArchive \
  -archivePath artifacts/ios-release/Oversight.xcarchive \
  -exportPath artifacts/ios-release/upload \
  -exportOptionsPlist artifacts/ios-release/UploadOptions.plist \
  -allowProvisioningUpdates
```

Evidence: `artifacts/ios-release/signing-retry.log`, `export.log`, `upload.log`,
`device-install.json`, `device-launch.json`, and `device-preferences-list.json`.
The local export/upload option plists contain the team and internal-testing mode;
they contain no credentials. Physical-device acceptance and TestFlight processing
remain release gates below.

## Saves and recovery

The engine format stays v1. On iPhone, app-private Data contains
`oversight-save-0.json` and `oversight-save-1.json`. Each envelope contains active
run, latest completed run and pending outcome, sequence, timestamp and checksum.
Writes are serialized into the older slot and verified by reading them back.
Startup chooses the newest valid generation, falling back to its predecessor.
If both existing generations are corrupt, startup stops and retains both files.
Never delete them to make a load error disappear.

Small settings/language values use native Preferences. Legacy localStorage is
migrated only when native storage is empty and its source is retained. Safari's
storage is separate: use Export save and Import save to transfer a run. Import
validates the file and asks before replacing the current run. Save failure blocks
normal interaction with a retry/export surface. Quit and language reload wait for
writes. Uninstalling the app removes app-local data; exported JSON is the portable
backup. No cloud sync, analytics, accounts or server are required by the game.

Saved narrative text retains its original language after changing language;
newly generated text uses the new language. RNG/gameplay data is preserved.

## Verification recorded

- 107 automated tests, including forecast/RNG invariance, cash boundaries, v1
  round trip, invalid imports, interrupted writes, backup recovery, verified writes
  and preference-failure retry.
- Production build, TypeScript and complete Russian localization checks pass.
- EN/RU phone previews at 320, 375, 393, 430 and landscape 667 CSS pixels.
- Production WebKit complete runs: EN through Loss of Control (Q1 2030); RU
  through Loss of Control (Q2 2030). Different UI choice policies were used; these
  outcomes are not a language-parity or balance comparison.
- Invalid/cancelled/confirmed import, exported JSON equality, pending choice/report
  restoration, retained debrief and EN→RU RNG/cash preservation pass.
- WebKit audio context suspension, suppressed background SFX, normal resume and
  already-suspended resume pass in a controlled lifecycle test.
- Release simulator build and unsigned generic-iPhone archive pass. A fresh iOS
  26.3.1 installation launched and wrote native Preferences, confirming native
  storage initialization. Interactive simulator gameplay remains unverified.
- Production npm audit reports zero known vulnerabilities. Three moderate entries
  remain in the development-only Capacitor CLI → xcode → uuid chain. The suggested
  automatic fix downgrades Capacitor CLI; no forced downgrade was applied.

Supporting local evidence/logs are in `artifacts/ios-foundations/`,
`artifacts/ios-release/` and `artifacts/ios-smoke/`; artifacts are gitignored.

## Gates before calling the iPhone build stable

Computer Use access to Simulator and Xcode was not approved in this session.
The signed candidate is installed on the paired physical iPhone, but interactive
verification has not been completed. Complete these gates on the signed build:

- Cold launch in airplane mode; complete a run; force quit after choices and quarter
  reports; resume; reopen the final debrief; install an update without losing saves.
- Native share sheet and Files import; cancellation, unsupported file and recovery.
- Safe areas, rotation, compact/notched screens, larger text, VoiceOver reading order,
  focus containment, redaction accessibility and 44-point touch targets.
- Mute/music controls, silent switch, headphones, lock/unlock, background resume and
  phone/audio interruptions. No background audio or stalled music after return.
- A 30-minute Release device profile for frame pacing, memory growth, hangs, thermal
  state and battery. Browser/simulator observations cannot certify device battery.
- Signed archive validation, internal TestFlight installation and repeat save/resume.

Optional pacing refinement still open: compact Monitor acknowledgments for proven
eligible threat updates. Full dossiers and every strategic choice remain present.
Do not batch or suppress new stages, causes, responses or crises without equivalence
coverage. No balance changes were authorized or introduced.
