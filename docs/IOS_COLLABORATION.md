# Developing Oversight together on iPhone

Start here when a coding agent is asked to run or fix the game on a new developer's
Mac/iPhone. Read `CLAUDE.md` and `docs/TEAM.md` as well. This is an existing
Preact/TypeScript game packaged with Capacitor; do not create a second app or port.
Most game/UI fixes belong in `src/`, not Swift. Shared phone development starts
from `codex/responsive-onboarding-v6`.

## What is shared and what is local

| Shared in Git | Local to each developer |
| --- | --- |
| Game source, localization, tests, iOS project, package lock | Apple account login, certificates/private keys, device trust, developer Team ID and phone identifier |
| Release identity: `com.viktor.oversight`, team `PW4Q53FM3J` | Personal development identity, e.g. `com.alexrazzzin.oversight.dev` |

Viktor has an Individual Apple Developer membership. An App Store Connect invite
does not give Alex access to Viktor's Xcode signing team. Alex can sign local
development builds using his own Apple account's Personal Team. Free provisioning
expires after seven days; rebuild/reinstall when it expires. Shared TestFlight
releases continue through Viktor's paid account.

Use the command-line overrides below. Do not commit a different release team or
bundle ID into `project.pbxproj` or `capacitor.config.ts`. The native bundle ID
override gives a personal build its own app container and saves. It will not
automatically share saves with the TestFlight app. The bundled Capacitor config
keeps the shared app ID; the signed native bundle ID is the installation identity.

## 1. First-time setup

The developer needs a Mac, Xcode with an iOS SDK supporting the connected phone,
and Node matching `.node-version` (24.21.0 when this guide was written).
The existing port was qualified with Xcode 26.3; do not assume its installation
path is identical on another Mac.

For a fresh clone:

```bash
git clone --branch codex/responsive-onboarding-v6 https://github.com/RazinAleksandr/Oversight.git
cd Oversight
git switch -c alex/my-task
npm ci
```

In an existing clone, inspect `git status`, fetch `origin`, and create a task branch
from the shared branch without discarding local work.

Check the tools:

```bash
node --version
xcode-select -p
xcodebuild -version
xcodebuild -checkFirstLaunchStatus
xcodebuild -showsdks
```

If needed, the developer opens Xcode and completes its license/component setup.
Use Xcode Settings → Locations → Command Line Tools to select the intended Xcode.
`DEVELOPER_DIR` can select an installed Xcode for one terminal session; use the
actual discovered path, not a hardcoded path copied from Viktor's Mac.

Human setup on Alex's devices:

1. Xcode → Settings → Apple Accounts: sign in with Alex's own Apple account.
2. Connect his unlocked iPhone by cable; accept Trust on the phone and Mac.
3. In Xcode → Window → Devices and Simulators, wait for device preparation.
4. Enable Settings → Privacy & Security → Developer Mode on the iPhone when
   prompted, restart it, and confirm. Complete any developer trust prompt iOS shows.

The agent may ask for a Team ID or device identifier. Never ask for the Apple
password, verification code or exported signing private key. Account login, trust
and Developer Mode prompts need the device owner's interaction.

## 2. Discover the local signing team and phone

Use the Team ID for Alex's Personal Team shown by his local Xcode/account, not
`PW4Q53FM3J`. If the ID is not exposed in account settings, Xcode can create a
throwaway iOS project **outside this repository** with Alex's Personal Team
selected; read its `DEVELOPMENT_TEAM` setting. This also exposes account/signing
setup errors without altering Oversight's release project.

```bash
xcrun xctrace list devices
xcrun devicectl list devices
```

`xcodebuild` expects the iPhone hardware UDID shown by Xcode's Devices and Simulators
or `xctrace`, not the different CoreDevice UUID printed as Identifier by `devicectl`.
`devicectl --device` also accepts the hardware UDID, so the same value works below.
If multiple phones are connected, confirm which one belongs to the developer.

Set the following in the terminal, replacing both placeholders with actual values:

```bash
export IOS_DEV_TEAM='YOUR_10_CHARACTER_TEAM_ID'
export IOS_DEV_DEVICE='YOUR_IPHONE_HARDWARE_UDID'
export IOS_DEV_BUNDLE_ID='com.alexrazzzin.oversight.dev'
```

Keep these values local. If the suggested bundle ID is unavailable, choose another
unique development ID once and keep it stable. No other developer's phone IDs,
account state, build artifacts, or save files are needed.

## 3. Build, install and launch on the phone

From the repository root, after every change to gameplay/UI:

```bash
npm run ios:sync

xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -destination "id=$IOS_DEV_DEVICE" \
  -derivedDataPath artifacts/ios-personal \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$IOS_DEV_TEAM" \
  PRODUCT_BUNDLE_IDENTIFIER="$IOS_DEV_BUNDLE_ID" \
  CODE_SIGN_STYLE=Automatic build
```

Proceed only if the build succeeds. Verify the actual output's identity:

```bash
/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' \
  artifacts/ios-personal/Build/Products/Debug-iphoneos/App.app/Info.plist
codesign --verify --deep --strict \
  artifacts/ios-personal/Build/Products/Debug-iphoneos/App.app
```

The identifier must match `IOS_DEV_BUNDLE_ID`. Then install and launch:

```bash
xcrun devicectl device install app --device "$IOS_DEV_DEVICE" \
  artifacts/ios-personal/Build/Products/Debug-iphoneos/App.app --timeout 60
xcrun devicectl device process launch --device "$IOS_DEV_DEVICE" \
  "$IOS_DEV_BUNDLE_ID" --timeout 15
```

This installs Alex's current source changes directly; it does not need TestFlight
or a release from Viktor. Re-running it updates the same personal app. Do not
uninstall the app to fix a signing/launch issue without first exporting its saves.

If launch times out, stop retrying blindly. Unlock the phone and open the app
manually. Report installation success and launch status separately. After launch,
check the changed screen, one real decision, rotation and save/continue. An agent
must not claim physical gameplay verification from a build log or simulator image.

## 4. Debugging and simulator alternative

`npm run dev` provides quick browser iteration. It does not update the installed
iPhone app; `npm run ios:sync` and a native rebuild are required for bundled changes.

For an iPhone simulator, signing is unnecessary:

```bash
npm run ios:build
npm run ios:open
```

In Xcode choose an installed iPhone simulator as the destination and run scheme
`App`. Install a simulator runtime in Xcode Settings if none exists. The native
project is `ios/App/App.xcodeproj` (Swift Package Manager, no CocoaPods workspace).
For a locally signed device app, the CLI steps above preserve release settings;
pressing Xcode Run with the shared project's default team does not apply those
CLI overrides. A native debugger can attach to the running personal app using
Xcode Debug → Attach to Process.

If a command reports missing signing credentials, an unavailable app identifier,
or an unregistered device, resolve that specific problem with the local account.
Do not try Viktor's team, share account credentials, disable signing for a physical
install, or replace the official app identity as a shortcut.

## 5. Sharing fixes and releases

Work on separate task branches and review pull requests into the shared iPhone
branch. Run the repository gates before pushing:

```bash
npm test
npm run build
npx tsx scripts/i18n.ts check
git diff --check
git status --short
```

Stage source changes intentionally; `artifacts/` stays local. Do not push `main`
as part of routine phone work: it deploys the public web game. TestFlight uploads
are a separate release step documented in `IOS_RELEASE.md`. Build 6 was installed
directly on Viktor's phone; that is not evidence of a TestFlight upload. Historical
release notes and local artifacts do not establish Alex's device/account state.

This guide can be followed from a fresh clone without Viktor's untracked skills,
screenshots, accounts or absolute filesystem paths. New design/port proposals use
the separate planning instructions; routine setup of this existing app does not
restart that process.

## Verification and sources

The development bundle-ID override is checked with an unsigned device build on
Viktor's Mac. Alex's signing and installation must be verified on his own Mac and
phone; his account has not been used here.

Apple references, checked 13 October 2026:

- [Running on simulators and physical devices](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices)
- [Personal Teams, free provisioning and its seven-day expiry](https://developer.apple.com/help/account/basics/about-your-developer-account/)
- [Individual versus organization membership access](https://developer.apple.com/help/app-store-connect/manage-your-team/overview-of-accounts-and-roles/)
