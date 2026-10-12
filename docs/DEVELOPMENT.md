# Development

The game is a static site: TypeScript + Vite + Preact, no server code.

## Play locally

Use Node.js 24 LTS. The exact development version is recorded in `.node-version`;
the package engine requirement keeps local and CI builds on the same major.

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
```

## Build a static site

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
```

`dist/` is fully self-contained and uses relative paths (`base: './'`), so it works from any static host or sub-path:

- **Any server:** copy `dist/` and serve it, e.g. `npx serve dist`, nginx `root /path/to/dist;`, or `python3 -m http.server -d dist 8080`.
- **Production server (continuous deploy):** the files in [`deploy/`](../deploy) set up a server that checks GitHub every minute. When `main` moves, it runs the tests, builds the game, switches to the new release atomically and serves it through nginx in Docker.
  - **One-time setup** (as root on the server): `git clone https://github.com/RazinAleksandr/Oversight.git /tmp/ov && bash /tmp/ov/deploy/setup.sh`. `PORT=8080` overrides the default port 80.
  - **Layout:**
    - `/srv/oversight/repo` is the deploy checkout;
    - `releases/<sha>` holds the builds;
    - `current` points to the live release;
    - `deployed` / `failed` record the last good and the last broken commit.
  - **Operations:**
    - deploy log: `journalctl -u oversight-deploy -f`;
    - force a redeploy: `/srv/oversight/repo/deploy/deploy.sh --force`;
    - roll back: `ln -sfn releases/<sha> /srv/oversight/current`.
  - GitHub Actions ([`ci.yml`](../.github/workflows/ci.yml)) only runs the tests and the build.

## iOS toolchain setup

The approved port plan is in [`IOS_PORT_PLAN.md`](IOS_PORT_PLAN.md). Use Xcode
26.3 on this Mac (macOS 15.7.3). It is installed alongside Xcode 16.2 at
`/Applications/Xcode-26.3.0.app` and includes the iOS 26.2 SDK.

Open that exact app, review its license and finish the administrator-authenticated
component installation. In Xcode Settings, add the Apple Account with the paid
developer membership, install the iOS simulator runtime under Components, and
select Xcode 26.3 under Locations → Command Line Tools.

After setup, verify:

```bash
xcodebuild -version
xcodebuild -checkFirstLaunchStatus
xcodebuild -showsdks
xcrun simctl list runtimes
```

If the command-line selection still reports 16.2, select the new installation:

```bash
sudo xcode-select --switch /Applications/Xcode-26.3.0.app/Contents/Developer
```

The iOS project is in `ios/App/App.xcodeproj`; team `PW4Q53FM3J` and bundle ID
`com.viktor.oversight` are configured. See [`IOS_RELEASE.md`](IOS_RELEASE.md) for
build, save recovery, device QA and TestFlight instructions. Before deploying the Node version change to production, update the
server's build runtime to match `.node-version`; the deployment script uses the
host's installed Node.

## Tests and tools

```bash
npm test                    # engine + content tests (Vitest)
npm run sim -- --runs 200   # headless balance simulation: 4 bots × seeds × 4 countries
npm run typecheck
```

Dev-only pages: `/dev/art.html` (art gallery) and `/dev/fx.html` (effects and sound bench). `?mock` in the development URL runs the UI on a mock backend; release builds omit mock code and QA hooks.

| Folder | What it contains |
|---|---|
| `src/engine/` | Pure, deterministic simulation (seeded RNG, JSON state, fogged views). `types.ts` is the shared contract. |
| `src/content/` | 4 countries, 20 companies, 20 leaders, 139 scripted events and 8 story arcs, headlines, 12 endings, tips. |
| `src/ui/` | Shared Preact screens and components. |
| `src/platform/`, `ios/` | Native storage, lifecycle, save sharing and Capacitor iPhone project. |
| `src/art/` | Procedural SVG art: 103 icons, emblems, logos, portraits, ending scenes, world map. |
| `src/fx/`, `src/audio/` | Animation and VFX helpers, adaptive animated background, procedural Web Audio sound effects and generative music. |
| `scripts/` | Balance simulator, screenshot helper, icon generator. |
| `docs/` | [`GDD.md`](GDD.md) (game design document), [`TEAM.md`](TEAM.md) (conventions). The original concept (working title *AI Taking Over*) is in [`concept-draft.md`](../concept-draft.md). |
