# UX reassessment: implementation feasibility

2026-10-12. Source baseline `1883243`; reviewed build `842c316`. Disposable study only; no production game source changes.

## Why the previous implementation cannot be repaired with more expanders

1. `Briefing.tsx` keeps `selected` inside the mounted sheet, appends effects after every choice, then calls `scrollIntoView` whenever selection changes. Selecting an option physically displaces the alternatives. Costs, risk and previews are not present in the comparison list. This trades long cards for memory work.
2. Closing the card sets the overlay to null in `GameScreen.tsx`; reopening creates a new `BriefingSheet`. A player who visits company/program services loses selection and reading position. A smaller modal does not solve that lifecycle problem.
3. `ui-dossier.css:122` applies the split layout only at widths of at least 700px. A 667×375 phone in landscape therefore gets the portrait-style document inside a short viewport. Orientation alone does not select a coherent interaction mode.
4. The split layout uses two independent `overflow-y:auto` panes. Long evidence, long option effects and a growing confirmation footer change the visible window; a document-wide overflow check cannot detect this loss of context.
5. Company, law, evidence, adviser and report disclosures reduce initial height by hiding actions and reasoning. They do not create a route from a question to its relevant service and back.
6. The last stylesheet overrides fonts, paper, panels, buttons, country emblems, result stamps, title identity and ending art globally. This changed the game's personality independently of the navigation problems. The original visual language can be recovered without returning its cramped old layout.

## Proposed implementation boundary

Use a task route owned by the game screen: current card UID, selected choice ID, reader section, contextual entity, return route and scroll positions. `GameAPI.view()` supplies all displayed information. Contextual services use existing action APIs and re-fetch their current availability after mutation. Never store stale `Choice` objects or infer affordability from displayed strings.

Separate three layers:

- **Task shell:** compact persistent resources, meaningful return, safe-area layout and current task.
- **Decision workbench:** critical findings and confidence visible by default; comparable option summaries include immediate resource cost, political effect and adoption target; detailed effects can be inspected without moving the comparison list.
- **Contextual inspector:** relevant company, funding, demand or agreement already selected. Explicit confirmation, visible result, then return to the retained decision. Use normal route transitions rather than overlay-on-overlay nesting.

At wider landscape widths, use a reader and comparison pane. Below a tested minimum width, use named Brief / Options task pages with selection retained. That is an explicit small-screen tradeoff: more page switching, readable content. Do not shrink the whole board to satisfy a numerical "everything fits" criterion.

Restore original paper, typewriter headings, situation-room navy, selective cyan controls and meaningful stamps. Do not restore oversized fixed chrome, slow mandatory reveals or the old 85px landscape play area.

## Disposable study

`artifacts/ux-reassessment/prototype/index.html` exercises a real fogged opening fixture in English/Russian. It demonstrates:

- essential finding summary and capability confidence before choosing;
- option summaries and explicit confirmation;
- selected effects while the alternative list stays in place on wider landscape;
- a contextual company investigation with exact action cost, explicit confirmation, an engine-generated staged result, and return preserving the selected choice;
- staged safety funding and retained selection;
- a recorded decision result and a **placeholder** quarter transition.

The company and funding entry points remain in the top bar. A selected decision retains the verified finding and uncertain capability range beside confirmation. The 667×375 study uses a two-column option grid to keep four comparable actions visible, while its reading pane uses a single scroll region.

### Limits deliberately left visible

This is a proposal to evaluate, not a second finished redesign. The 14px reading text and 11–12px resource summaries are exploratory density, not accessibility approval. Long evidence remains scrollable. Full program affordability forecasts, save/resume integration, gamepad/keyboard route focus, screen reader announcements, larger text, safe-area device testing, and rotation reading-position preservation are not implemented. The quarter screen is a flow sketch. Funding is UI simulation and does not recalculate the engine outcome. Company investigation and decision outcomes are staged, independently generated engine results.

Do not use this prototype to claim that the whole game is now playable. Accept the architecture only after physical touch trials of the actual task sequence.

## Production stages after approval

1. Recover visual tokens/assets from `1883243` into explicitly scoped new components. Retain narrative correctness and save fixes. No wholesale reset.
2. Build one vertical slice: deployment → company investigation → return → compare → commit → outcome. Persist decision context separately from engine state, with stale-card validation.
3. Add program/demand and threat/containment routes; then Accord preparation and quarter wrap. Keep engine rules and all strategic options.
4. Verify real task completion in EN/RU at 844×390, 667×375, 390×844, safe areas and large text. Check clipping against scroll ancestors and actual hit targets, not just DOM existence.
5. Install only after that slice passes device feedback; expand the migration in reversible commits.

The main dependency is task-oriented UI state, not a new framework or a native rewrite. Existing Preact, engine actions, localization and Capacitor can support it.
