# V5 art direction — political atlas and dispatches

13 October 2026. Art proposal for team review before implementation. The user has rejected build 4 and authorized a substantial redesign of all screens with autonomous team decisions. This document records a design hypothesis; it does not claim that the new version has been built or player-tested.

## Diagnosis from the actual build

Reviewed build 4 Agenda and deployment screenshots, the earlier World screenshots, and the existing procedural map, emblems, company marks, portraits, and ending scenes.

- The Agenda gives the world a tiny emblem while a mostly empty text layout occupies the screen. A global political thriller should visibly contain countries and a changing world.
- World makes the map a submenu below a list. This is the specific reason that an existing asset feels removed.
- Briefings, management, reports, and the Agenda share nearly the same charcoal rectangles, small sans headings, border divisions, and amber buttons. Their different jobs have little visual expression.
- Small source marks survive, but the artwork rarely determines composition. The player sees a form containing game text rather than a game with an interface.
- The earlier visual identity had stronger national/technological character, but excessive chrome, tiny type, and a large fixed footer obstructed play. Its clutter is not a useful template.
- The old map has a useful four-power geography and deterministic vector provenance. Tiny SVG labels, dot-only land, a decorative packet on every link, and undifferentiated connections do not communicate the actual current political state.

This diagnosis applies the local design-first, hybrid-assets, and no-ai-design-slop skills. The remedy is a new spatial and informational composition, not another palette replacement.

## Recommended visual thesis

**A political atlas that opens into illustrated dispatches.**

Two surfaces carry distinct work:

1. **Operational board:** a substantial colored world map, visible national identities, spatial selection, and compact state summaries. This is where the player locates the next problem and sees international relationships.
2. **Dispatch:** a bright reading surface with dark ink, clear source identity, deliberately typeset prose, and a separate decision area. This is where the player considers uncertainty and authorizes a choice.

A transition between them means “inspect this case,” not “visit another generic dashboard.” Keep the static end states complete; a short optional crossfade may explain the transition, but no animation is required to use the game.

### Material and color roles

- Map sea: deep blue ink (`#102838` candidate), visibly distinct from build 4 charcoal.
- Uninvolved land: muted slate/mineral (`#667e83` candidate), with fine coast outlines and a restrained second relief contour.
- National territory and markers: existing Atlantic blue, Hanzhou vermilion, Commonwealth ochre, Meridian jade. Use these for identity, not for success/danger judgements.
- Dispatch: neutral warm white (`#f3f0e7` candidate), ink (`#172b35`), quiet ruled separators. No parchment texture, fake folds, rubber stamps, or typewriter effect.
- Confirmed warning: a separate clear red/coral, paired with label/icon.
- Selection: a strong outlined national marker plus a stable filled label; never color alone.
- Primary action: dark ink on light dispatch; contrasting light control on dark operational board. National colors may mark source identity but should not create a different button system in each country.

The final implementation should verify contrast at rendered sizes rather than treating candidate colors as approved accessible values.

### Typography and image hierarchy

- Navigation, action labels, data, and costs: existing readable sans family, 14–16px for useful labels and body. No forced monospace or tracked uppercase metadata.
- Dispatch title: one existing display family with a larger 22–26px hierarchy where the title is short; long titles wrap naturally without taking over the first fold.
- Source: 48–64px leader/CEO portrait when that person is the source; company emblem for company requests; national crest for state proposals. Do not assign a random human portrait to a nonhuman event.
- Operational map labels: HTML controls at actual screen size. Do not scale meaningful text down inside the SVG viewBox.
- Ending art: existing deterministic scene receives a substantial composition region; the text and outcome remain independent and readable.

## Spatial contracts

Dimensions below include conservative 47px left/right and 21px bottom insets. These are layout hypotheses for the headless fixture, not a statement about every physical iPhone.

### 844 × 390 landscape

Safe width: 750px. Allocate 44px top status and 52px bottom navigation. Approximately 273px remains for the main surface.

**World / operational board:**

- Map region approximately 482 × 273px, selected subject region approximately 256 × 273px, with a 12px divider/gutter if the shell does not already provide it. Avoid accumulating extra outer padding.
- Map artwork is composed around a 2.2–2.35 aspect ratio and includes the full four-power silhouette; selected country targets sit on the map as HTML buttons, minimum 44px high.
- Country names use authored short names; four positions are spaced to avoid overlapping labels. A complete accessible nation list is available in the same surface, not a hidden hover menu.
- Selected subject region begins with emblem/name, known relationship or player identity, then one direct contextual action. Full intelligence is an explicit route below or beside this overview.
- Treaty progress and race tension have one compact, stable summary each. A treaty action appears when the actual engine exposes it. The map is never replaced by a long explanation on initial World entry.

**Agenda:**

- Use the same map as the dominant spatial anchor, with a narrow case strip for outstanding decisions and the end-quarter control.
- Pending national cases can be counted at the player's nation marker. The case strip must show their actual titles and type/source, and allow direct selection.
- If a seed has many cases, scroll the case strip deliberately. Keep map and end-quarter access stable; do not shrink every case to fit.

**Dispatch:**

- Light reading field approximately 390px, decision region approximately 348px, one quiet separating boundary.
- Source identity, title, and known warning have a clear hierarchy in the reading field.
- Decision options are intentional response rows with their costs and tradeoffs. Reading prose and response labels do not share an undifferentiated grid of equal text blocks.
- Fixed confirmation region belongs to this task, with the chosen response named. It must not cover reading or option targets.

### 667 × 375 landscape

Safe width: 573px. With the same 44px top and 52px bottom allocation, approximately 258px remains.

**World:**

- The map owns the full 573px width on arrival. Artwork uses approximately 220px height; a compact state/legend line uses the remaining area.
- Selecting a nation opens a deliberate subject detail route using the full safe width. A visible Back to map control restores that selection. Do not divide this width into a 150px roster plus a squeezed form.
- A selected marker remains recognizable when returning. A Map control is direct and persistent within the World flow.
- All four nation targets remain at least 44px high, with no SVG-scaled microtype.

**Agenda:**

- Map still occupies the principal visual area. One compact current-case control overlays an intentionally reserved lower map band or occupies a stable row; it must not obscure any national hit target.
- Opening the case list is explicit and full width when more than one case cannot be usefully represented. A badge reports remaining cases; it does not imply a nonexistent geographic incident.

**Dispatch and management:**

- Use separate full-width reading / response / subject routes where two panes cannot both hold useful content. Retain visible step/navigation state and selected response.
- A complete 44px target is the unit of acceptance, not a visible text label inside an offscreen button.
- Each task should initially expose either meaningful facts or a usable operation. A fixed title, level selector, and footer consuming the whole viewport is a failed layout even when scrolling technically works.

### Portrait and enlarged text

Portrait is an alternate composition, not compressed landscape. Map remains a real block at a useful width; subject details follow or open as a full screen. Navigation and back controls remain reachable. At enlarged text, allow a clearly bounded list/detail scroll or a separate route; do not preserve an attractive split by clipping content or reducing text size.

## Asset and data contract

### Strategic map

Create a new Preact strategic map component using a separately authored SVG cartographic base. Keep the existing fictional regions and national identity. Refine coastlines and shape contrast so each territory reads as a solid region at phone size; avoid reducing the whole world to anonymous dots.

- HTML nation markers, accessible names, keyboard focus, and direct onSelect callbacks.
- Player and selected state are distinct: player identity is persistent; selection is an outline and label treatment.
- Membership links are rendered only from actual Accord member data. A selected diplomatic target may have a clearly labeled prospective link; do not draw every power connected as if a treaty already existed.
- Fogged capability estimates stay ranges with confidence in the inspector. Do not turn estimates into precise geopolitical heat maps.
- Known domestic threat counts can be placed at the player's territory as an aggregate. No fabricated city coordinates, attack paths, model locations, or coverage zones.
- Do not put unseen engine data into color, radius, glow, topology, or animation.
- Static map geometry and labels need no canvas animation or external framework. Memoize stable SVG where appropriate.

### National and company assets

Retain established emblems and company marks as recognition anchors. Use them at a useful size in nation selection, map targets, company mastheads, dispatch source blocks, and results. Remove redundant rounded tiles around already framed art where they create a nested icon box.

Existing portraits are deterministic, role-based vector illustrations. Their strongest use is a human source block with a name and role. Use one consistent crop and scale. A portrait must not replace the facts or consume all reading room at 667px.

### Provenance and runtime limits

All proposed runtime graphics are repository-authored procedural SVG/HTML/CSS. No downloaded asset, generated bitmap, dependency, or licensing claim is required. Existing SVG generators remain the source for emblems/portraits/company marks; the new map base is an authored extension, not an image-to-3D reconstruction. No always-running animation, heavy blur, or decorative particle field is proposed.

## Screen-by-screen expression

| Surface | Dominant visual object | Core task |
| --- | --- | --- |
| Title | Substantial map/title composition with national emblems | Start or continue |
| Nation selection | Geographic choice and selected national identity | Understand starting identity and choose |
| Agenda | Strategic map plus a readable case strip | Locate the next decision |
| World | Interactive political atlas | Select a power, inspect, act |
| Nation | National crest/leader masthead and focused policy/funding work | Change a program or meet a promise |
| Companies | Strong company mark, leadership, model register | Inspect a company/model and act |
| Threats | Known incident identity, stage, current response, direct operations | Understand and respond |
| Briefing | Bright source-led dispatch | Read uncertainty and compare responses |
| Authorization | Chosen action, target, cost, consequence | Confirm once |
| Result | Visually distinct outcome and causal changes | Understand what actually changed |
| Quarter report | A changed world with a short causal summary | Review consequences and continue |
| Ending | Large authored scene and readable outcome | Understand the run |

## Hypotheses and evidence required

1. A substantial map plus direct spatial selection will restore the sense of a global strategy game. Verify initial Agenda/World screenshots and tap every nation at 844/667 in EN/RU.
2. Contrasting operational and dispatch surfaces will make orientation immediate. Verify a screenshot sequence across Agenda → briefing → action/result → World; the surfaces must remain recognizably related without being identical.
3. Existing source art at useful size will make decisions feel authored and attributable. Verify all card families, including nonhuman events and long Russian names.
4. A full-width route on compact phones will outperform a squeezed universal master/detail layout. Verify the actual player task, the complete targets, reading area, and return state—not only the outer container rectangle.

The team must review one map/Agenda composition and one dispatch composition at both landscape widths before broad implementation. User authorization already exists; this is an internal quality check, not a new approval request. Code changes begin after the root reconciles this proposal with interaction and QA hypotheses.

## Accepted implementation contract

The root accepted the atlas/dispatch direction and assigned map and World implementation.

`StrategicMap` accepts optional `player`, `selected`, `onSelect`, `compact`, and `label` properties. `countries` is an optional array of `{ id, name?, shortName?, color?, trust?, accordMember?, attention? }`. Static names/colors come from localized `COUNTRIES`; only caller-supplied fogged values may populate live overlays. A missing `player` supports title/setup without falsely identifying the player's nation. A missing callback produces a noninteractive illustration rather than dead buttons.

Interactive markers expose `data-country-select` and, for nonplayer countries, `data-rival-select`. World exposes `data-world-map`, `data-world-accord`, and `data-world-actions`; targeted diplomacy keeps `data-diplomacy-target`. The new World entry is the map. Selecting a rival opens its full intelligence reading route; the player's country opens Nation. Map return is explicit. Legacy `overview` state remains the Accord route for task-state compatibility.

Runtime assets are authored in `src/art/map.ts`; the reusable component is `src/ui/components/StrategicMap.tsx`, scoped styles are `src/styles/ui-atlas-v5.css`, and World composition is in `src/ui/game/panels/WorldPanel.tsx`.

## Candidate art review and focused verification

The root accepted the refined art candidate after screenshot review. The final cartography removes the first pass's scaled inset contours (which read as bevels) and uses fine coast coves, fixed mountain spines, and fixed rivers. These are authored fictional geography, never measurements of the current simulation. Full World markers have transparent hit areas with narrow readable name strips. Compact Agenda/setup maps use 44px crest tokens with accessible country names; the surrounding selected-country label or roster supplies visible identity. The decorative title uses unframed crest/name labels.

`accordSigned?: boolean` was added to the map API, defaulting false. Only a signed Accord draws links among supplied member nations. Supporter diamonds can still identify known supporters before signing. This prevents negotiation support from visually implying that a treaty is already active.

Focused current-source WebKit checks passed in EN and RU at 844×390, 667×375 (47px side/21px bottom fixture insets), and 390×844:

- all four World nation controls meet the 44px minimum and their rectangles do not overlap;
- each of the three rival controls opens the correct intelligence record, and World map returns;
- the player marker opens Nation;
- Accord opens; a targeted Atlantic initiative opens the action with the correct fixed target; Cancel and World map return without authorizing an action.

The first portrait check exposed Commonwealth/Hanzhou hit-area overlap. A portrait-only marker placement correction fixed it, and all six cases passed on the rerun. The review script is disposable evidence at `artifacts/design-v5/map-tasks.mjs`. Screenshots and other composition captures are under `artifacts/design-v5/`. TypeScript passed after the art/component work. No physical comfort, VoiceOver, engine balance, final release, or full-game qualification is claimed by this focused check.
