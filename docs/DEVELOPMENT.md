# Development

The game is a static site: TypeScript + Vite + Preact, no server code.

## Play locally

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
- **GitHub Pages (automatic):**

  ```bash
  git push origin main
  ```

  Then, in the repository, open **Settings → Pages → Build and deployment** and set Source to **GitHub Actions**. The workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) tests, builds and publishes on every push to `main`. The game appears at `https://<user>.github.io/<repo>/`.

## Tests and tools

```bash
npm test                    # engine + content tests (Vitest)
npm run sim -- --runs 200   # headless balance simulation: 4 bots × seeds × 4 countries
npm run typecheck
```

Dev-only pages: `/dev/art.html` (art gallery) and `/dev/fx.html` (effects and sound bench). `?mock` in the URL runs the UI on a mock backend.

| Folder | What it contains |
|---|---|
| `src/engine/` | Pure, deterministic simulation (seeded RNG, JSON state, fogged views). `types.ts` is the shared contract. |
| `src/content/` | 4 countries, 20 companies, 20 leaders, 139 scripted events and 8 story arcs, headlines, 12 endings, tips. |
| `src/ui/` | Preact screens and components. |
| `src/art/` | Procedural SVG art: 103 icons, emblems, logos, portraits, ending scenes, world map. |
| `src/fx/`, `src/audio/` | Animation and VFX helpers, adaptive animated background, procedural Web Audio sound effects and generative music. |
| `scripts/` | Balance simulator, screenshot helper, icon generator. |
| `docs/` | [`GDD.md`](GDD.md) (game design document), [`TEAM.md`](TEAM.md) (conventions). The original concept (working title *AI Taking Over*) is in [`concept-draft.md`](../concept-draft.md). |
