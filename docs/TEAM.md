# Team conventions (read before writing code)

Project: **Oversight** — browser strategy game. Read `docs/GDD.md` (design) and `src/engine/types.ts` (code contract).
Stack: TypeScript (strict) + Vite 6 + Preact 10 (TSX, `jsxImportSource: preact`), Vitest, Playwright (chromium installed) for screenshots.

## Ownership (only edit files you own)
| Folder / file | Owner |
|---|---|
| `docs/GDD.md`, `docs/TEAM.md`, `src/engine/types.ts` | Director (engine agent may ADD optional fields / new exports to types.ts, never rename/remove) |
| `src/engine/**` (except types.ts), `tests/engine*.test.ts`, `scripts/sim.ts` | Engine programmer |
| `src/content/**` | Narrative designer |
| `src/ui/**`, `src/main.tsx`, `src/styles/main.css`, `src/styles/ui-*.css` | UI/UX designer-developer |
| `src/art/**`, `dev/art.html` | Art director |
| `src/fx/**`, `src/audio/**`, `src/styles/fx.css`, `dev/fx.html` | Animator & sound designer |
Stub files exist for every module so the project compiles from day one. Replace stubs in your area; keep the exported names/types.

## Rules
- Do NOT edit `package.json`, configs, `index.html` (UI agent may edit index.html body markup only if needed). No new npm dependencies.
- Typecheck with `npx tsc --noEmit`. Other agents work in parallel, so errors in files you don't own may appear temporarily — ignore those; your own files must be clean.
- Engine code is pure TS: no DOM, no `Math.random` (use the seeded RNG), deterministic, JSON-serializable state.
- UI reads hidden information ONLY through `game.view()` (fogged). Never show true hidden values (risk, traits, flaws) unless the view exposes them.
- Presentation modules (fx/audio/art) must have zero runtime dependency on the engine (types-only imports are fine).
- Assets: no external files/images/sounds. SVG as strings (art), procedural WebAudio (audio), CSS/canvas (fx). Google Fonts are already linked in `index.html`: Space Grotesk, Inter, JetBrains Mono, Special Elite.
- Design tokens (CSS custom properties on `:root`, defined by UI in `src/styles/main.css`; fx/art may reference them):
  `--bg #070b14, --panel #0d1424, --panel-2 #121b30, --line #1f2b45, --text #d8e1f0, --text-dim #7f8ba3, --accent #3fd0ff, --good #3ee08f, --warn #ffb547, --bad #ff4d5e, --ai #a77bff, --gov #e8c169, --paper #ece6d8, --ink #1b1a17, --stamp #c8312b`
  Fonts: `--font-head: 'Space Grotesk'`, `--font-body: 'Inter'`, `--font-mono: 'JetBrains Mono'`, `--font-type: 'Special Elite'`.
- CSS class prefixes: fx uses `fx-*`; UI uses plain component names (`card`, `meter`, `tabbar`...). Art injects no global CSS.
- Dev servers: UI uses port 5173 (`npx vite --port 5173`), art 5175, fx 5174. Dev-only pages live in `dev/` (not part of the build).
- Screenshots: `npx tsx scripts/shot.ts http://localhost:5173/ /tmp/x.png 390 844` (see script header for clicks/evals). Look at your screenshots with the Read tool.
- Write code like a professional studio: small focused modules, clear names, brief comments where intent isn't obvious.
