# Assignment for the next agent: Oversight on iPhone

## Mission and decision gate

Make *Oversight* a comfortable, compelling iPhone game. Improve the phone UI and simplify the experience where it reduces friction, while preserving the game's difficult decisions, uncertainty, political pressure, and delayed consequences. An iOS build is the intended outcome.

**Your first assignment is to analyze, propose, and agree on a plan with the user.** Do not change game code, replace its design, add an iOS wrapper/project, or begin the port until the user approves the plan. Read-only inspection, running the existing game and tests, screenshots, research, and disposable experiments are appropriate before approval. Once approved, implement the agreed stages and verify each one.

## Evidence to review first

1. Read the full [mobile playtest report](../artifacts/mobile-playtest/report.md), including the linked [annotated highlights](../artifacts/mobile-playtest/annotated-highlights.mp4), [full playthrough](../artifacts/mobile-playtest/full-playthrough.mp4), and relevant screenshots. Treat this as one observed run, not proof that every seed or player has the same experience.
2. Run and play the current game yourself on a phone-size viewport. Check at least one narrow iPhone-sized layout and one current-size layout; use a physical iPhone if one is available. Observe the title, onboarding, briefing decisions, Nation and World panels, quarter transitions, save/continue, and ending. Record any findings that confirm or challenge the prior report.
3. Read [README.md](../README.md), [CLAUDE.md](../CLAUDE.md), [docs/GDD.md](GDD.md), [docs/DEVELOPMENT.md](DEVELOPMENT.md), [docs/TEAM.md](TEAM.md), [docs/I18N.md](I18N.md), the UI and engine contracts, and the current build/test scripts. The game is a static Vite/Preact/TypeScript app with a deterministic engine, English and Russian text, local saves, procedural art, and Web Audio.
4. Read the [skill index](../.agents/skills/README.md), then open only the `SKILL.md` files useful for the chosen work. Start with `design-first-ui-prompting`, `no-ai-design-slop`, `test-playable-web-games`, and the mobile and motion skills as applicable. Several imported skills target Three.js or websites; adapt only their relevant guidance to this 2D strategy game.

The playtest artifacts and imported skills are local workspace files. If they are absent in your checkout, ask for them or reproduce the observations before relying on them; do not invent findings from missing evidence.

## Analyze the game before proposing changes

- Explain what makes the current loop interesting and what must survive simplification. Use the GDD pillars and observed play: meaningful tradeoffs, investigations under uncertainty, consequences that return later, recoverable mistakes, and a short complete run.
- Turn the playtest's top issues into concrete design questions: deadline forecasts, rounded cash and disabled actions, repetitive threat cards, long dossier scrolling, deep-panel navigation, unclear Accord path, tutorial timing, and the end-game grade. Confirm which are UX defects, rule defects, pacing problems, or deliberate tension.
- Trace each proposed simplification through its strategic consequences. Show what information, actions, text, or steps would be removed or combined, and how players would still understand cause and effect. Avoid a visually cleaner game that becomes shallow or arbitrary.
- Account for one-handed touch use, small screens and safe areas, readable type, clear decision state, target sizes, motion and sound settings, accessibility, interruptions and resume, battery/performance, and both English and Russian layouts.
- Inspect the current save format and game architecture before choosing the port strategy. Keep the web game working unless the user explicitly chooses otherwise.

## Questions and choices

Ask the user only questions that change the architecture or product direction and cannot be resolved from the repository or playtest. Useful examples are the intended release route (personal device, TestFlight, or App Store), whether the web version must share the same code and saves, available Mac/iPhone/test devices, and whether a native-feeling shell is enough or native UI is a priority. Explain the consequence of each choice and recommend a default. Continue independent analysis while waiting for answers.

Research current Apple and framework requirements from primary sources before recommending a stack. Compare realistic options for this codebase, such as a web-based iOS shell versus a native UI rewrite, and recommend one with explicit tradeoffs for time, maintainability, offline play, save migration, audio, accessibility, performance, and distribution. Do not assume the existing `docs/TEAM.md` restrictions on dependencies and config files can support an iOS port; identify any exceptions the plan needs and ask the user to approve them as part of the plan.

## Plan to present for agreement

Write a reviewable plan in `docs/IOS_PORT_PLAN.md` and summarize it in the conversation. Include:

1. **Diagnosis:** evidence from the prior playthrough and your own inspection, with the largest mobile pain points and strongest game hooks.
2. **Target experience:** a short description of a complete iPhone run, target session length, and the parts of the current game that stay central.
3. **Simplification proposal:** a before/after map of the core loop, navigation, information density, decisions, and ending. Mark rule or balance changes separately from presentation changes.
4. **Design direction:** key screen flows and low-fidelity wireframes or annotated screenshots for briefing/decision, overview, deep panels, quarter report, and ending. Show how decisions remain legible without repeated long scrolling.
5. **Port recommendation:** chosen iOS approach, alternatives considered, code-sharing boundaries, save/offline strategy, native integration needs, build tools, and distribution path.
6. **Implementation stages:** ordered, small milestones with dependencies, what becomes playable at each stage, and rollback or migration considerations. Include any necessary updates to project conventions.
7. **Verification:** automated engine and localization checks, browser regression, iPhone simulator and real-device playtests where available, accessibility checks, performance and battery checks, save/continue and interruption tests, and release-build validation. State what cannot be verified in the current environment.
8. **Acceptance criteria and decisions needed:** measurable success criteria, open risks, estimates as ranges with assumptions, and the specific decisions the user must approve before work begins.

Present one clear recommendation. Invite the user's changes to the plan and wait for explicit agreement. Do not treat silence as approval. After agreement, begin implementation according to the approved milestones, report progress with screenshots or recordings of real gameplay, and re-plan with the user if a major assumption fails.
