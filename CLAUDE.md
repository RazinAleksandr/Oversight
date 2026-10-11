# Oversight

Strategy thriller about governing the AI transition. It's a static web game: TypeScript, Vite, Preact, with no server code. All text exists in English and Russian.

## Docs

- `docs/GDD.md`: game design, formulas and numbers.
- `docs/TEAM.md`: code ownership and conventions.
- `docs/I18N.md`: localization architecture, Russian glossary and style.
- `docs/DEVELOPMENT.md`: commands and deployment.

`README.md` is player-facing only. Keep developer details out of it.

## Commands

```bash
npm run dev                         # http://localhost:5173  (?lang=ru, ?mock)
npm test                            # Vitest: engine, content, i18n
npm run build                       # tsc + vite build → dist/
npm run sim -- --runs 200           # headless balance simulation (bots × countries)
npx tsx scripts/i18n.ts check       # every string translated, placeholders valid
npx tsx scripts/i18n.ts sync --only <id>   # regenerate a dictionary's keys after changing English text
npx tsx scripts/shot.ts <url> out.png 390 844 --eval="..."   # Playwright screenshot
```

## Architecture

- `src/engine/`: a pure, deterministic simulation.
  - It uses a seeded RNG stored in state, so never use `Math.random` or the DOM there.
  - The UI only sees fogged views through `GameAPI.view()`.
  - Every meter change records a reason.
  - `types.ts` is the shared contract.
- `src/content/`: data-driven events, story arcs, countries, companies, endings and headlines.
  - Templates use `{tokens}`; see `TEMPLATE_TOKENS` in `engine/labels.ts`.
- `src/ui/`: Preact screens. `src/art/` is procedural SVG, `src/fx/` holds effects and `src/audio/` is procedural Web Audio.
- `src/i18n/`: keys are the English strings.
  - Use `t()`/`tp()` in code.
  - Static content and data objects are translated in place at boot by `localizeContent()`.
  - The language is fixed for the page lifetime: switching reloads the page.
  - Russian lives in `src/i18n/ru/`.

## Rules

- **English output must stay byte-identical when you touch i18n plumbing.** Tests and the sim run in English.
- **New or changed player-visible text** needs the following:
  - in code, wrap it in `t()`;
  - in content, it is picked up automatically;
  - then `npx tsx scripts/i18n.ts sync --only <id>`;
  - then a Russian translation following `docs/I18N.md`;
  - then `check` must pass.
- **Never use display strings for logic.** Compare ids instead.
- **Before pushing:** run `npm test && npm run build && npx tsx scripts/i18n.ts check`.

## Deploy

Pushing to `main` deploys to production automatically. A server-side poller (`deploy/`) checks GitHub every minute, then tests, builds and atomically switches the release. CI (`.github/workflows/ci.yml`) only runs tests and the build.
