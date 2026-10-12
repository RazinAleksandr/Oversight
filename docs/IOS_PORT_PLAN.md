# Oversight on iPhone — proposed plan

Status: **Approved; iPhone candidate implemented and compiled. Signing and native device acceptance remain blocked.** Prepared 12 October 2026. The user selected **TestFlight first, with a shared web game**, then approved proceeding (“Lets roll”). Their next instruction was to update the required tools before implementation. TestFlight is already installed on their iPhone, and they report an active Apple Developer subscription.

## Recommendation

**Scope update:** The user confirmed an iPhone-first release. Desktop layout refinement and browser-release qualification are deferred. Phone-sized web previews remain development checks for the shared Capacitor interface; simulator and physical iPhone verification remain release requirements.

Improve the existing Preact interface for phone play, preserve the TypeScript simulation, then package the production assets in **Capacitor 8 for iOS**. Keep one engine, content collection, localization system, and gameplay UI for web and iPhone. Add a small platform layer for durable saves, lifecycle, sound recovery, and optional haptics.

The first beta should make decisions easier to read and reach. Preserve all strategic choices, investigation costs, hidden information, delayed consequences, and the current finale probabilities. Treat demand generation and finale fairness as separate balance decisions after targeted evidence. Do not silently rebalance the game during the UI work.

## 1. Diagnosis and evidence

### Sources and limits

- Read the full [prior mobile report](../artifacts/mobile-playtest/report.md), its linked screenshots and interaction evidence. Inspected sampled frames spanning both the [annotated highlights](../artifacts/mobile-playtest/annotated-highlights.mp4) and [full playthrough](../artifacts/mobile-playtest/full-playthrough.mp4), including the late-game states. This was frame inspection, not a real-time viewing of every second or an audio assessment. Contact sheets are in `artifacts/ios-plan/`.
- Manually exercised the real game at **393 × 852**: title, country selection, opening briefings, Safety first, deep evaluation, quarter report, and the returned evaluation. A choice was then made on the stronger report. [Opening dossier](../artifacts/ios-plan/playtest/shots/008.png), [returned evaluation](../artifacts/ios-plan/playtest/shots/017.png).
- Completed an additional **scripted UI run** at 393 × 852: Daily seed **20261012**, Director, Commonwealth, ending at the early Threshold in **Q1 2030, 13 quarters governed**, Loss of Control / F. It used a simple choice policy and funded safety 2, oversight 2, workforce 1, defense 1. It did not investigate warnings or pursue diplomacy. This is navigation and completion evidence, not a skilled playtest or balance measurement. The trace contains 79 captures and no captured console/page errors. [Trace](../artifacts/ios-plan/complete/trace.json).
- That run exercised Nation, program changes, World and deep scrolling, quarter transitions, and reload/Continue. The serialized save before and after Continue was identical. [Continue](../artifacts/ios-plan/complete/008.png), [Nation](../artifacts/ios-plan/complete/009.png), [World](../artifacts/ios-plan/complete/016.png).
- Fresh **320 × 568** English and Russian checks covered title, nation selection, inbox, briefing and keyboard focus. [Measurements](../artifacts/ios-plan/layout/metrics.json), [English](../artifacts/ios-plan/layout/en-briefing.png), [Russian](../artifacts/ios-plan/layout/ru-briefing.png). These were separate random seeds, not a controlled comparison of translation length.
- Read README, CLAUDE, GDD, DEVELOPMENT, TEAM, I18N, skill index, UI/engine contracts, save and boot paths, relevant systems and scripts. Applied design planning, UI quality, game QA, screenshots, mobile layout, and motion guidance to this 2D game.

All new gameplay checks were headless Chrome with touch emulation. A paired physical iPhone is listed by Xcode, but this session has no available phone screenshot/touch automation interface; physical play has **not** been verified. Installed simulators were inventoried, not used to claim device validation. Artifacts are local and gitignored; preserve or attach selected evidence if the plan is shared outside this checkout.

### What must survive

The core hook is deciding whether incomplete evidence warrants sacrificing growth or political support now to avoid a later disaster. The prior run's deep evaluation, returning Warden problems, Kellsbridge follow-up and costly Off-Switch payoff show this well. My manual evaluation check also confirmed that spending an action changes the evidence the player receives next quarter.

Preserve the four survival meters, uncertain risk estimate, scarce investigation actions, company and rival identities, delayed story chains, and 16-quarter maximum. Preserve the paper dossiers against the dark situation room, redactions, meaningful stamps, and the debrief's causal record. Early Thresholds must remain visible as a possibility: the fresh run reached one in quarter 13.

### Findings, classified

| Issue | Evidence and interpretation | Priority |
| --- | --- | --- |
| Decisions below long dossiers | Fresh 393 px opening choice started around viewport y=1,532 after revealing the full text. At 320 px with the sheet reset to its top, first choices started at y≈1,776 EN and y≈2,104 RU. Body text measured 16.5 px. Primarily an information-order and navigation defect. | P0 |
| Russian HUD crowding | 320 px screenshot shows date/progress and Actions labels colliding. Document width still equals viewport width; an overflow test alone misses this. | P0 |
| Modal focus escapes | In both languages, focus Close then Shift+Tab: focus reaches the underlying End Quarter button. `Sheet.tsx` sets initial/restored focus but does not contain it. Accessibility defect. | P0 |
| Misleading affordability | Prior $3B/disabled $3B case is supported by `money()` rounding to an integer while engine validation compares the underlying budget. `NationView` itself rounds to one decimal. Formatting alone must not introduce another boundary mismatch. | P0 |
| Demands lack a deadline forecast | `deploy_sector` asks for baseline +12 (+6 on a softened offer), while the deadline is capped at turn 16. Adoption moves toward a target gradually. This confirms a mechanism for compressed late deadlines, not the frequency of impossible offers across seeds. UX defect plus possible generation/balance defect. | P0 clarity; separate rule review |
| Repeated threats | Prior run has same-title spillovers from different rivals. Fresh run also accumulated multiple threats. Identity and acknowledgment pacing need work; escalation and response costs are deliberate tension. | P1 |
| Deep panels | Fresh Nation buries funding under government, safety gap and society; World shows a large map before rival actions. All these facts are useful, but repeatedly traversing them is not. | P1 |
| Accord route | Code requires 100% progress, a treaty briefing on a world tick, then Sign. Current World shows progress and actual members as “supporters.” High trust at 83% is not a signed treaty. Clarity defect, not evidence of a broken signing rule. | P1 |
| Tutorial timing | Fresh “Your Inbox” tip arrived after the first two briefings were resolved. Prior run reports similar late tips. Language buttons measure 40 × 36; tip text control is only 34 px high. | P1 |
| Negative investigation wording | Prior run reports a negative finding before later secret training was exposed. It could be a missed finding or a later violation. Retain uncertainty and date/scope; do not claim the investigation guaranteed cleanliness. | P1 |
| Finale and grade | `endings.ts` assigns F to global failures. The prior good-looking control range still failed; the fresh scripted run lost after a very poor 2–15% choice. The latter does not establish unfairness. GDD pillar 4 (“never one unlucky roll”) conflicts with its own probabilistic finale specification and current code. Product rule decision, separate from presentation. | P1 explanation; separate rule review |

Baseline verification: **84 tests across 3 files passed; build passed; i18n check passed.** Vite warned about the large Russian language chunk (about 1.02 MB before gzip). This is a startup measurement item, not proof of a runtime performance problem.

## 2. Target experience

A complete run should take **20–25 minutes of active play** for a returning player, with a comfortable stopping point every quarter and reliable continuation after an interruption. Validate this with people; the automated run and prior recorded assessment are not timing evidence. First-time players may read longer.

On opening the desk, the player can identify the next required decision, threatened meter, due promise, and available actions. A briefing immediately exposes its question and evidence confidence. All choices are one tap away, with their costs and known consequences. The full narrative, advisers and evidence remain accessible without losing the decision position. Each quarter closes with the changes that matter and their reasons. The ending explains both the outcome and the record that led there.

Use portrait as the primary iPhone layout, supporting narrow widths, safe areas, larger text, and landscape reflow. Keep desktop keyboard play and the existing wide layout working.

## 3. Simplification proposal

| Current | Proposed | What changes strategically |
| --- | --- | --- |
| Full narrative → evidence → advisers → choices in one long sheet | Compact question/context → decisive evidence and confidence → persistent “Choices (n)” control; full dossier and adviser detail expand in place | Less travel; no evidence or choice is deleted. Uncertainty and adviser bias stay visible. |
| HUD + ticker + tip + end bar remain in competition | Stable two-row compact HUD; static news summary; one contextual tip; one relevant bottom action per surface | Meter/risk alerts remain visible. News signals retain an explicit follow-up route. |
| Long Nation and World stacks | Nation section links: Overview / Promises / Programs / Laws. World: Accord summary / rival selector / chosen rival. Remember scroll position | Same actions and resources, fewer repeated swipes. Keep all rivals reachable and retain comparative estimates. |
| Same-title mandatory threat sheets | Include known source, stage, response and escalation on the inbox item; allow compact acknowledgment for eligible unchanged-response updates | Never merge threat identities or suppress a new stage, new cause, new option, failed response, or crisis. See guard below. |
| Current adoption and target on another panel | On the demand: current / requested / due date / projected by deadline under current orders | Gives usable planning information. It must not predict hidden events or expose future RNG. |
| Rounded money + generic disabled message | Budget and cost at matching useful precision, plus a clear shortfall/block reason supplied from authoritative engine validation | Makes existing affordability understandable; does not change prices or available money. |
| Progress bar and “No supporters yet” | “Negotiating → 100%: treaty briefing → Sign”; distinguish signed members from visible diplomatic prospects | Keeps signing a meaningful decision and preserves hidden rival traits. |
| Generic negative investigation result | “No violations found in this investigation”; date/scope and remaining uncertainty | Preserves the value of intelligence without turning a negative result into certainty. |
| Full quarter report and full debrief stack | Summary first, expandable reasons, section links; persist latest ending | Retains causal evidence and replay value while shortening mandatory reading. |

**Threat acknowledgment guard:** Start with compact, explicit per-item acknowledgment using the existing Monitor choice. An optional batch action may acknowledge only items whose sole currently available choice is Monitor, after other spending decisions are complete. Revalidate immediately, show the included sources, and resolve through the normal API in order. Never auto-spend an action or auto-apply containment. A response named “contained” can have a temporary multiplier; `turnMult` resets after the tick, so the label alone is not proof that no new decision is needed. Preserve warning accounting, logs, queue order and the opportunity to inspect each dossier. If equivalence cannot be demonstrated, ship the compact per-item treatment only.

**Forecast guard:** Add typed optional forecast fields to the fogged view/card contract. Derive known adoption movement with shared pure helpers and current orders, including ramp modifiers, defense funding and infrastructure caps. Label the result conditional on no further changes; mark unsupported forecasts as unavailable. Multi-quarter forecasts assume current orders continue and must show that assumption. Do not run the hidden simulation forward or read `game.state` from UI to compute predictions. Keep target versus actual adoption distinct. Recalculate after a decision or program change.

**Rule/balance boundary:** First beta preserves deadline generation, response strength, finale probabilities and grade computation. Clear warnings can make an infeasible offer an informed political choice. Before changing generation, sample late offers across countries/seeds and compare hard/soft offers to feasible actions. Before changing the finale, compare loss rates and ask players to explain the causal result. Recommendation for this beta: explain that global failure determines the overall F, and keep the four dimension scores visible. A deterministic rescue, extra final turn, altered deadline, or new grade formula needs a separately approved rule proposal and simulation comparison.

## 4. Design direction and screen flows

Keep “Situation Room × Classified Dossier.” Use the existing palette, procedural portraits, map and stamps. Retain Inter for reading, mono for values, and the dossier title treatment with Cyrillic fallbacks. Use 16–17 px body text, comfortable line spacing, a 4 px spacing scale, and at least 44 × 44 CSS px interactive hit areas. Let labels wrap; do not compress Russian into clipped one-line English widths.

These are **low-fidelity layout proposals**, not implemented screens. Values below are illustrative.

### A. Briefing / decision

```text
Q2 2027       2 actions       $12.4B
Confidence 54  Prosperity 55   Risk ↗
───────────────────────────────────
‹ Desk           Briefing 1 of 3
DEPLOYMENT REQUEST · ORBIS
Compass-4: authorize Business use?
Claimed capability 1.8 · LOW
Evaluation: no finding · MEDIUM
Growth benefit; future risk unknown
[Read full dossier] [Advisers (2)]
───────────────────────────────────
[Choices (4)]            safe area
```

Choices expands a single decision surface with each label, cost, preview, confidence/chance and disabled reason. Evidence remains one tap away and retains its scroll position. At 320 px or large text, the decision surface scrolls naturally; only its small header/context is sticky. Never stack the game's End Quarter bar beneath the decision controls. Keep commitment explicit and guard against a double tap carrying into the next card; no default selected choice. Provide a visible “Reveal text” control and an instant-text setting.

### B. Desk overview

```text
Date / progress       Actions / cash
Four meters + risk, each opens why
───────────────────────────────────
Inbox · 2 decisions remaining
! Public services promise · due now
  34 / 46 · projected about 43
! Spillover · Atlantic · Incident
  Current response / next escalation
Deployment request · Compass-4
News: 2 warning signs [Follow up]
───────────────────────────────────
[Open next briefing]
Inbox  Labs  Nation  World  Threats
```

After the inbox clears, replace the primary action with End Quarter and its unused-action count. Do not convert every observation into a mandatory confirmation. Preserve meter explanations and the risk interval behind their existing tap targets. Critical alerts include words/icons, not color alone.

### C. Deep panels

```text
NATION                  Due: 1 promise
Overview  Promises  Programs  Laws
───────────────────────────────────
Treasury 12.4 | Income 14.0 | Upkeep 10
Safety       Off / L1 / L2 / L3
Next upkeep and effect shown together
...

WORLD
Accord 83% · Negotiating
100% → treaty briefing → your signature
[Diplomatic initiative · $3B + 1 action]
Atlantic / Hanzhou / Meridian
Selected rival: estimates, trust, actions
[Map and comparison]
```

Use accessible section links or tabs with persistent selection. Selecting a rival exposes its actions in the same location. Show only diplomatic prospects justified by the fogged view; hidden safety stance must not become an exact supporter forecast.

### D. Quarter report

```text
Q3 2027 begins
Confidence −2 · Prosperity +1 ...
Promise kept / broken and its cause
Threat changed: source, stage, response
Treasury: income − upkeep = new balance
[All reasons] [Headlines]
[To the desk · 3 briefings]
```

Display the most consequential changes first. Reasons and news remain available. Store/reopen the latest report so a background interruption does not erase the explanation. Use short, causal transitions and stable controls; reduced motion shows complete static states immediately.

### E. Ending

```text
LOSS OF CONTROL
Outcome cause and final choice
Overall F · global failure rule explained
Control / Prosperity / Security / Legitimacy
Record  Moments  Truths  Warnings
───────────────────────────────────
Selected section with source/date links
[Replay this seed] [New run]
```

Keep the epilogue and illustration, but make results/navigation immediately discoverable. Explain the leading actor separately from the largest contributor to accumulated global risk. Persist the completed debrief so relaunch can return to it.

Motion uses the existing CSS/fx system: roughly 120–200 ms for input feedback and 180–260 ms for navigation, with no reading-dependent animation blocking a choice. Stop decorative work in the background, pause obscured canvases where appropriate, and preserve independent sound/music/volume settings. Native audio recovery and optional haptics are platform behavior, not simulation behavior.

## 5. Port recommendation and boundaries

### Options

| Approach | Sharing and maintenance | Benefits / costs for this project | Indicative effort |
| --- | --- | --- | --- |
| **Capacitor 8 + current Preact UI** | Share engine, UI, saves and translations; isolate native services | Best fit for this small static game. Bundle offline assets, use native storage/lifecycle. WebKit accessibility and audio still require real-device work. Adds framework/plugins and Xcode project maintenance. | Recommended path below: 12–22 engineering days |
| Custom Swift WKWebView shell | Same gameplay sharing; hand-maintained bridge | Similar UI/performance constraints, fewer framework packages, but storage, lifecycle, import/export and bridge behavior become our responsibility. | Roughly 2–5 extra days for shell/bridge work |
| React Native UI + shared TS engine | Engine/content can largely stay; recreate DOM/CSS/SVG presentation | Native controls and accessibility integration, but substantial screen, art and animation work; maintaining web introduces two presentations. | Roughly 6–10 weeks |
| SwiftUI UI + JS bridge or Swift engine | Separate UI; bridge the TS contract or duplicate simulation | Strong native UI control; highest parity, localization, art and save maintenance burden. A Swift engine also requires deterministic replay parity. | Roughly 8–14 weeks |
| Web/PWA only | Maximum reuse | Useful browser distribution, but does not fulfill the selected TestFlight route. | Not selected |

These are planning ranges for one experienced engineer, including UI work for the recommendation, not bids or measured delivery times. Alternatives are architectural estimates, not benchmark results.

**Framework and toolchain:** Current stable Capacitor documentation identifies v8, WKWebView, iOS 15+ and Xcode 26+. Use a pinned compatible v8 release and matching official plugins after approval; do not select the v9 preview. Recommend an **iOS 16 minimum** for the initial beta, with support through the current shipping iOS; finalize that minimum against testers' devices. Capacitor 8 requires Node 22+, and its environment guide identifies Swift Package Manager as the default. Confirm generated project behavior for the pinned release. [Capacitor iOS](https://capacitorjs.com/docs/ios), [environment setup](https://capacitorjs.com/docs/getting-started/environment-setup).

Toolchain preparation installed **Xcode 26.3 (17C529)** at `/Applications/Xcode-26.3.0.app`, with the bundled **iOS 26.2 SDK**, alongside the existing Xcode 16.2. Archive signature verification passed. The user completed Apple license acceptance and first-launch setup; `xcodebuild -version` now reports 26.3 and `-checkFirstLaunchStatus` passes. The iOS 26.3.1 simulator runtime is now installed alongside 17.2/18.3. **Node 24.21.0 / npm 11.19.0** are installed, and local/CI Node versions are aligned through `.node-version`. Under Node 24, all 84 tests, production build and localization check passed. Apple's upload requirement effective April 28, 2026 is Xcode 26+ with the iOS 26 SDK or later. [Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/).

### Shared code

- Keep `src/engine` pure and deterministic, UI reading only `GameAPI.view()` and action views. Add optional typed fields for public forecasts/availability; no native imports into engine, content or presentation modules.
- Keep shared English/Russian text and rendering. New code strings use `t()`/`tp()`, content follows the existing localization pass, and the scoped sync/check workflow remains mandatory.
- Introduce `src/platform/` for storage, lifecycle, and haptics; use web implementations in the browser. Keep native dependencies out of the normal web startup path where possible.
- Build Vite `dist/` and bundle it inside the app. No dependency on the production server or a live dev URL. Bundle fonts, Cyrillic subsets and licenses; the current `index.html` loads Google Fonts, so the existing build is not visually self-contained offline.
- Procedural SVG and Web Audio stay shared. Use App lifecycle events to suspend/resume presentation and recover audio after interruptions, validating silent switch, headphones, calls and mute on a phone. Existing `visibilitychange` handlers are a useful starting point. [Capacitor App](https://capacitorjs.com/docs/apis/app).

### Saves, offline play and migration

Current saves use version-1 JSON containing seeded RNG and game state, key `ato.save.v1`. Loading rejects a different game version and backfills some optional collections. Settings/language use separate localStorage keys. Autosave follows game mutations, but completed games remove the active save; endings currently live only in UI memory. The parser checks only part of the nested structure, so file import needs stronger validation.

Use a storage adapter: existing localStorage on web; app-private files for complete iOS saves and debriefs; Preferences for small settings. Preferences is documented for lightweight data and warns that mobile localStorage can be cleared, so do not place the full growing game log in Preferences by assumption. [Preferences storage guidance](https://capacitorjs.com/docs/apis/preferences).

Serialize the same engine JSON inside a separate storage envelope with format version, sequence and timestamp. Queue writes in order, write a temporary file, validate it, then replace the current file while retaining a last-known-good backup. Verify crash/termination behavior on device. Save after each committed choice/action/program change, with background flushing as an additional safeguard. Persist the latest outcome/report and final debrief before clearing the active slot. A failed write produces a visible retry/export path; never silently announce “saved.”

Keep v1 engine compatibility for the presentation stages. Import legacy localStorage only if the native slot is empty; retain the source until a validated read-back succeeds. Web browser storage and app storage are separate: Safari saves will **not** automatically appear in the app. Provide explicit JSON save export/import with validation, a summary before replacement, and backup of the existing slot. Preserve RNG exactly. Do not silently replace unsupported versions. Cross-language saves contain rendered strings today; audit loading EN saves in RU and vice versa and refresh presentation from stable IDs where possible, without consuming RNG or changing English behavior.

Bundle both languages, fonts and all gameplay assets. Airplane mode must support a cold launch, a full run, save/resume and debrief. Shared format does not mean cloud synchronization; no account/backend is needed for this beta. App uninstall remains destructive to app-local data, so exported saves are the portable backup.

### Native integration and distribution

Use native lifecycle, durable storage, safe-area/status-bar handling and optional haptics for committed decisions. Do not add permissions unrelated to these needs. Include the privacy manifests required by the selected plugins; Preferences documents its UserDefaults reason. Produce an app icon from the existing identity and a matching launch surface.

Build a signed Release archive, validate it, then upload to the user's App Store Connect app. Start with internal TestFlight, then external testing after Beta App Review. Apple requires beta information and approval for the first external build. Developer team, bundle identifier, signing access and beta contact remain release inputs; they are not needed to start the approved UI stages. No invitations have been sent. [Apple TestFlight](https://developer.apple.com/testflight/).

The replayable offline game, phone interface and reliable lifecycle should form the app's value. A web shell does not itself guarantee review acceptance; Apple's minimum-functionality guidance evaluates the experience and lasting entertainment value. [App Review guidance](https://developer.apple.com/app-store/review/).

## 6. Implementation stages

| Stage | Work and playable result | Dependencies / verification | Estimate |
| --- | --- | --- | --- |
| 1. Phone foundations | Compact responsive HUD, Russian wrapping, modal focus containment/inert background, 44 px targets, one primary bottom action, visible reveal-text control. Existing game remains fully playable. | Approved plan; 320/375/393/430 widths, large text, phone accessibility and external keyboard. Desktop qualification deferred. Capture before/action/after. | 2–3 days |
| 2. Decision clarity | Briefing summary/choice access, authoritative cost/shortfall display, conditional demand forecasts, Accord route, dated negative findings. | Add optional public view fields; deterministic forecast/affordability tests; complete EN/RU text checks. | 3–5 days |
| 3. Navigation and pacing | Nation sections, rival selection, contextual tutorial/help history, compact eligible threat acknowledgments, quarter summary, ending navigation and explanation. | Preserve all strategic choices, threat accounting and log causality; test late-game fixtures and both languages. | 2–4 days |
| 4. Persistence and offline assets | Platform storage abstraction, durable native save implementation, last outcome/debrief retention, import/export validation, bundled fonts. Web saves stay compatible. | Round trips, failed/interrupted writes, v1 loads, language changes; asset licenses. | 2–4 days |
| 5. iOS shell | Capacitor project, pinned plugins, lifecycle/audio recovery, safe areas, optional haptics, icons and manifests. Full offline simulator/device game. | Updated toolchain; stages 1–4; actual device access. | 1–2 days |
| 6. Release candidate | Device usability/accessibility/performance passes, regression fixes, archive validation and TestFlight preparation. | Signing/account inputs; passing gates below. External distribution waits for review. | 2–4 days |

Total **12–22 engineering days**, roughly **3–5 working weeks**, assuming one engineer, ready signing access and timely device/user review. Xcode installation, enrollment/account issues, external review and tester turnaround are additional calendar time. A balance redesign is outside this estimate.

Work in small commits on an isolated implementation branch after approval; pushing `main` automatically deploys the web game. Keep presentation stages reversible. Keep a backup of old saves during migration; do not bump engine save version for layout-only changes. If a future schema change is necessary, add explicit migration before writing it and preserve the old snapshot for rollback. Re-plan if the shared interface cannot pass phone accessibility or if native audio/storage proves unreliable.

### Explicit project-convention exceptions requested

Approval of this plan should authorize these scoped changes to TEAM conventions:

1. Edit `package.json`, lockfile, relevant build configuration and `index.html` for Capacitor commands and local fonts. Add `ios/`, Capacitor config and platform adapters.
2. Add pinned `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`, plus official App, Filesystem, Preferences and Haptics plugins. Add a system/status-bar plugin only if required by the chosen release's safe-area integration. No UI framework or motion library is proposed.
3. Permit licensed bundled font files and native icon/launch assets as exceptions to “no external files.” Preserve procedural gameplay art/audio.
4. Permit coordinated edits across UI, engine public views/types, localization, persistence, fx/audio lifecycle, tests and developer documentation. Maintain the existing contracts and update TEAM to describe the platform boundary.

The approved configuration exception has been used for Node 24/CI, pinned Capacitor 8, the iOS project, native storage and bundled licensed fonts.

## 7. Verification and acceptance criteria

### Automated correctness

- At each relevant stage and before pushing: `npm test`, `npm run build`, and `npx tsx scripts/i18n.ts check`. Preserve byte-identical English behavior when modifying i18n plumbing.
- Deterministic tests for supported forecast cases and exact affordability boundaries, with no RNG consumption and no hidden values exposed. Compare engine acceptance and UI availability immediately before commitment.
- Save round trips retain RNG and gameplay data; asynchronous writes cannot restore an older snapshot over a newer one. Cover corrupt/truncated/unsupported saves, full storage, background termination, backup recovery and EN↔RU resume.
- Preserve costs, effect order, signals, queue behavior and logs for compact threat acknowledgments. If an optional balance stage is later approved, run the 200-run simulation matrix before and after and report distributions by country/difficulty/bot, not just overall win rate.

### Browser and usability

- Real rendered checks at 320 × 568, 375 × 667, 393 × 852 and 430 × 932; desktop 1440 px; portrait/landscape; EN/RU; normal/reduced motion; larger text up to 200% where applicable.
- No horizontal overflow, HUD text overlap, clipped costs, obscured choices or unsafe-area controls. Main touch targets at least 44 × 44 CSS px; use equivalent native sizing for shell controls.
- A player reaches all briefing choices within **one explicit tap**, without first scrolling through the whole dossier. Evidence and advisers remain available in one tap from choices. No accidental double commitment when changing surfaces.
- Modal focus stays inside the active surface; close restores it. Keyboard and VoiceOver names, order and state announcements are usable. Redacted text is never exposed in accessible names. Disabled actions explain why through accessible text.
- Reach Programs, Laws, a chosen rival or debrief section within **two navigation taps**. Preserve panel positions on return. No “read the whole sheet again” requirement.
- In a small moderated test with at least 3 new players, each can explain a deadline forecast, unavailable purchase and Accord signing step. At least 2 of 3 complete the first quarter without help. Track a 20–25 minute median active run among returning players as a target, not a release claim until measured.

### iPhone and release

- Simulator checks on the minimum supported and current iOS when runtimes are available; physical tests on a compact phone and a recent notched/Dynamic Island phone where available. The paired phone can cover one device once interaction/testing is available.
- VoiceOver, larger text, safe areas, rotation, keyboard appearance for import, silent switch, sound/music controls, headphones, interruption and background resume. No involuntary background audio or stuck mute/resume state.
- Cold launch offline, play a complete run, resume after force quit, change language, recover a failed save and reopen a completed ending. Verify update installation retains saves and native/web import yields the same next outcome under identical choices.
- Profile a 30-minute session including deep panels and late threats on device. Track memory, long tasks, frame pacing and thermal state; confirm no sustained growth across repeated open/close cycles and no decorative animation/audio work while backgrounded. Target visible tap feedback within 100 ms on test hardware; investigate stalls over 200 ms. Battery conclusions require device measurement, not browser FPS alone.
- Validate a signed Release archive with bundled assets and complete plugin manifests, install through TestFlight, and repeat cold launch/save/resume on that build. Verify external beta metadata before submitting for review.

**Current limits:** Native Release simulator and signed iPhone archives compile successfully. The signed candidate installed and launched on the paired iPhone 13 (iOS 18.7.8) and created native Preferences. App Store Connect export succeeded, but upload failed because no app record exists for `com.viktor.oversight`. The user has resolved authentication and the Program License Agreement restriction. Interactive Simulator/Xcode/browser Computer Use was not approved. Physical gameplay, VoiceOver, dynamic text, device audio interruptions, thermal/battery profiling, server upload validation and TestFlight installation remain unverified. See `IOS_RELEASE.md` for the release gates.

## 8. Approved scope and remaining release inputs

The user approved stages 1–6 with **Capacitor 8, shared Preact/TypeScript gameplay, TestFlight first, iOS 16 minimum provisionally**, and the scoped TEAM exceptions above. The recommendation keeps game rules stable for this beta while improving explanations and navigation. Demand-generation and finale-rule changes would return as a separate proposal supported by targeted playtests.

Release inputs can be provided during implementation: intended Apple Developer team/bundle ID, internal versus external tester group, and availability of the paired phone plus a compact device. Toolchain installation must be scheduled before native work. Any different minimum iOS requirement should be raised before stage 5.

The agreement gate in [AGENTS.md](../AGENTS.md) and [the port assignment](IOS_PORT_AGENT_INSTRUCTIONS.md) is satisfied. The user authorized continuing the iPhone interface while Xcode components installed, with desktop/browser release support deferred.


## Implementation record — first iPhone interface pass

- Reworked the phone HUD into separate date/progress and resource columns; the Russian opening HUD fits at 320 px without overlap or a split era label.
- Raised language, tip expansion, action-target change and warning follow-up controls to 44 px minimum height; language controls are at least 44 × 44 px.
- The bottom resolve-briefings action opens the next dossier directly. End Quarter remains the primary action when all required briefings are resolved.
- Added a visible, translated full-text reveal control and a complete accessible paragraph independent of the visual typewriter animation.
- Added a persistent Review choices / Read dossier control. This begins stage 2's decision-access work; forecasts, exact cost explanations, and direct evidence/adviser navigation remain outstanding.
- Modal sheets now make the background inert, contain focus, restore the opener on dismissal and prevent Escape/Back dismissing an underlying sheet through a non-dismissable result.
- Phone preview checks: EN/RU at 320 × 568, 375 × 667, 393 × 852, 430 × 932 and 667 × 375; HUD separation, touch targets, choice access, focus wrapping/restoration and inert cleanup. Targeted live flow covers reveal, choice/result/next briefing, quarter report and unchanged save/resume JSON. Evidence is local under `artifacts/ios-foundations/`.
- These are headless Chromium development previews. Native VoiceOver, larger text, simulator WebKit and physical-device acceptance remain pending. This record does not mark the port or all stage-1 acceptance gates complete.


## Implementation record — offline iPhone candidate

- Added pinned Capacitor 8 project for iPhone, iOS 16 minimum, EN/RU metadata,
  privacy reasons, dark launch surface and an icon based on the existing clock.
- Bundled 48 licensed font faces/subsets; removed remote launch/font dependencies.
- Native storage uses two alternating, checksummed, read-back-verified generations.
  This replaces the proposed temporary-file/rename implementation: each write
  overwrites the older slot and preserves the newest verified slot until success.
  Serialized writes and recovery are tested; device force-quit timing still needs QA.
- Preserved active runs, pending choice/action/quarter reports and completed debriefs;
  added validated import with replacement confirmation, export/share and visible
  save retry. Settings failures cannot be hidden by a successful game save.
- Added native lifecycle suspension/resume, including already-suspended audio.
- Added exact cash/shortfall display, one-tap evidence/adviser navigation, conditional
  budget/defense/adoption forecasts, Nation sections, single-rival navigation,
  Accord signing guidance, dated model checks, saved advice history and debrief
  sections with an explanation of the existing grading rules.
- Forecasts share the pure adoption step with settlement, account for current
  defense funding, infrastructure caps and known upkeep-waiver expiry. They do
  not advance RNG or predict hidden events. Unsupported demands say so explicitly.
- Threat inbox rows expose known source, stage and escalation. Compact Monitor
  acknowledgments/batching remain deferred: no equivalence gate has been established
  for new stages/causes/response options. Full choices remain available.
- Cross-language resume retains saved narrative strings; the language control
  explains this existing limitation. Newly generated text uses the chosen language.
- Verification: 107 automated tests; typecheck/build/localization; 10 phone preview
  layouts; full EN/RU production WebKit runs through endings; pending-result/report
  reload; debrief recovery; invalid/cancelled/confirmed import; export round trip;
  EN→RU RNG/cash preservation; WebKit audio suspend/resume; native compilation.
- These results do not certify the physical iPhone or a TestFlight build as stable.
  Signing access and native acceptance gates are the remaining release blockers.


## 10. UX reassessment requested after the iPhone installation

On 12 October 2026, the user reported poor comfort in both orientations, excessive
learning burden, and an unattractive visual style. They requested deep analysis
and proposals for discussion before implementation.

The new review and proposed design stages are in
[UX_REVIEW_2026-10-12.md](UX_REVIEW_2026-10-12.md). It includes current WebKit evidence,
layout measurements, a learning/pacing assessment, feature simplification tradeoffs,
portrait/landscape wireframes, two visual directions and acceptance criteria.

**This redesign proposal is pending agreement.** Earlier port approval does not
constitute approval of a new navigation structure, portrait-only support, tutorial
scenario, threat batching or finale rule changes. The current phase is analysis;
no game or iOS configuration changes were made for this review.
