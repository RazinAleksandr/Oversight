# V5 decision and action design hypothesis

13 October 2026. Reviewed by the task-design agent before implementation. The user rejected build 4 and authorized a substantial new design with internal review and independent implementation. This document is a proposal to the supervising agent; no game source has changed for V5 yet.

## Evidence, not a taste score

Reviewed build-4 screenshots `artifacts/full-redesign/qa-en-844-deployment-brief.png`, `qa-en-844-report.png`, `qa-en-844-funded.png`, the implemented universal workspace/action/result components and management/report styles. Compared `artifacts/ux-reassessment/844-decision.png`, the reassessment research and original art sources. Applied design-first-ui-prompting, the no-ai-design-slop article and the mobile game skill.

Build 4 corrected several real task failures: separate tentative choice and execution, stable target positions, direct investigation, persisted task context, cost/resource availability, exact engine outcomes. Those are retained. But its visual composition failed:

- On 844×390 the source, model title, generic intelligence summary and dividers consume most of the left pane. Only about three lines of the actual request are visible. The verified finding is further down. A large total scroll area is not the same as a useful first view.
- Four numbered choices in a narrow two-column grid resemble a spreadsheet. Their numerical summaries dominate the authored dilemma before the player has understood the request.
- A company request, treaty negotiation, incident, result and quarter report all use nearly the same dark rectangle, heading, divided columns and typography. Source identity is a small icon; political power and uncertainty have little visual presence.
- Program funding is a roster, four identical cells and a button; a national intervention looks like a settings form.
- The quarter report has a largely empty summary column and another column of metrics. It does not give a strong visual sense of the world advancing.
- Removing paper, stamps and map prominence removed the original game's language of official records without replacing it with an equally specific language.

## Recommended thesis

**Govern from a strategic atlas. Read an official record. Issue an order. See the world answer.**

The atlas is the persistent world, not a decorative background added to every panel. Countries and real known relationships are interactive map content. Opening a task places an official document over that world. Documents are light; active command controls are deep blue; warning ink and seals carry actual status. A consequence returns a signed order with its recorded effects. The world view changes only when engine state changes.

Suggested material roles, subject to root's shared tokens:

- Deep navy atlas/command frame with muted cartographic land.
- Warm, clean ivory reading surfaces; dark blue ink. No grain over reading text, worn edges, fake fingerprints or repeated dossier ID badges.
- Cobalt selection/order controls. Crimson only for actual danger, denial or failed execution. Muted green for verified favorable change. Evidence confidence remains explicit text.
- One readable sans body at 16px. A restrained editorial serif for authored document titles or quotations, with the established sans for controls. Document titles normally 24–28px on phone; no giant sentence headlines.
- Company marks, leader portraits and country seals are subject identity. They occupy one meaningful document header or record identity region, not a repeated icon tile on every row.
- Maps use actual country IDs and fogged view data. No invented company headquarters, influence radius, incident location or precise capability heatmap.

## Distinct task compositions

### A. Briefing: understand the request before reviewing responses

Phone landscape has two explicit, persistent stages: **Briefing** and **Your decision**. These are stages of the same saved task, not another navigation hierarchy. A direct Company record / relevant service action remains available. The first view spends its width on understanding.

At 844×390, after safe areas:

- A 44px command line contains Back to atlas, document stage and direct contextual service.
- An ivory document uses about 60% width for the authored request. Source name/mark belongs in a compact header. The first paragraph appears before redundant model statistics. All authored narrative remains in normal flow, not hidden in a disclosure.
- A roughly 40% evidence margin holds **actual authored evaluation finding and confidence**, capability range versus safeguards, and government stake when present. Its independent scroll is explicit. Do not infer evaluation type from a translated label. If evidence lacks typed roles, render all authored evidence in original order and avoid pretending that a generic flaw name is the full finding.
- The lower command edge shows available resources and **Review N responses**. It is a navigational step, not a spend. Do not force the user to read every line.

At compact landscape or portrait, the same document becomes one deliberate reading scroller with source, request and decisive evidence before long background/advisers. Review remains fixed. This gives text a useful measure rather than squeezing two 200px columns.

**Tradeoff:** one explicit stage switch replaces simultaneous story and choices. It reduces first-view choice clutter and increases request legibility, while retaining a single-tap route back to the same reading position. This is a hypothesis to inspect against real long RU content, not a claim of measured comprehension.

### B. Decision review: alternatives form an order register

This stage has a stable vertical register of authored options on the left and a proposed order on the right. It is not the build-4 two-by-two grid.

- Each choice is one full-width row with its full label and exact resource cost; its selected state is a strong ink mark and shape, not a number added for decoration. Avoid duplicating two arbitrary metric summaries in every row.
- Four ordinary options should fit the 844 phone when possible at honest type size. Five choices or enlarged text use a bounded, clearly scrollable register; never shrink or overlap children.
- The proposed order shows the selected hint, all structured preview effects, odds/uncertainty, complete cost and any blocked reason. Existing threshold control estimate is retained.
- A compact evaluation reminder stays with the order. The full original briefing is one command away with reading position intact.
- **Issue order** executes exactly once. Selecting a row remains free. No default selected political strategy. No swipe-only confirmation, hold gesture, signature drawing or animation gate.
- In portrait, choice register is the main pane and the selected order has a named full-page review route; cost/selection remain legible in the footer. Avoid expanding content between rows.

### C. Company investigation: a subject dossier plus a real commission

The company record should be identifiable at a glance: company mark, CEO and organizational character, followed by known capability and trait estimates. Reading a record does not imply that a fresh investigation ran.

The right commission is an official order to investigate this named company. It contains the engine-authored purpose, exact cost and what the action can reveal. Its first view does useful work rather than repeating an enormous magnifier and 'Ready to authorize'. The fixed bottom authorization and return route remain. After execution, newly revealed facts are presented as the returned investigation record, with the original deployment evaluation clearly separate.

No invented before/after values if the result supplies only the new observation. No certainty from absence of findings. No claim that investigation rewrites existing card choices or evaluation findings.

### D. Other actions: an operation sheet

The visual sequence is **subject → instruction → expected effects → authorization**. Preselected subject is a clear heading with Change only when multiple targets are actually valid. Target or option selectors use an order register, not nested cards. Exact previews appear only when engine data supplies them; an empty preview is not evidence of zero effects.

Short actions use a complete single operation sheet rather than a duplicate empty right column. Actions with meaningful choices have a working configuration area. This composition varies with the task's actual data rather than forcing every action through one two-column template.

### E. Consequences: the issued order and its receipt

The result starts with a real status seal derived from `stamp`/success and the actual outcome narrative. Seal placement occupies the margin or compact header; it must not push all content below the fold. The receipt shows recorded causal changes with their reasons, not only a list of metric names.

- Immediate resources/meters are grouped together.
- Adoption target changes are separate and explicitly take effect through later uptake.
- Revealed investigation findings read as findings, with room for complete text.
- The primary onward control says where the player will go: linked briefing, return to the case, or atlas.
- A short map transition may explain the return to the world, but static/reduced-motion rendering is complete and no action waits on animation.

### F. Quarter report and management handoff to root/planner

Quarter report should be an **advance of the atlas plus a dated dispatch**, with one meaningful change highlighted by recorded cause. Full ledger and press remain deliberate views. Do not celebrate a generic 'situation changed' empty column. A sparse quarter needs a concise quiet report, not padded emptiness.

Government is a mandate/deadline document; Programs is an intervention budget with current versus proposed commitment; Threats is an incident case and response; World is the actual atlas/negotiation layer. They share controls and type, but each composition expresses the player's job. These suggestions require coordination with the root and management agent before implementation.

## Data and implementation boundaries

- Keep `DeploymentWorkspace` export/props for routing compatibility; internally it can become a family of semantic document pieces. Every engine card kind and choice remains present.
- Existing `WorkspaceReading.pane/section/scroll` can represent briefing and response-review stages. Migration must preserve valid saved selections. Root owns task routing.
- Add role metadata only if needed and agreed. Do not classify evidence using translated visible text or hidden engine state.
- All UI data comes from fogged view, authored card or explicit result. No new assets representing nonexistent facts.
- All strings through t()/tp(), planner owns RU changes.
- Retain existing data selectors or coordinate changed tests with researcher. Tests must follow intentional navigation, not assume both old columns are visible.

## Internal design gates before native release

1. Root agrees the thesis and stage tradeoff, then reviews one real EN/RU844 briefing and decision pair before broad rollout.
2. Compare first-view visible request/evaluation content to build 4. A new palette alone does not pass.
3. Inspect 667 safe areas, portrait, long five-choice and enlarged text. A scroll boundary is allowed; accidental cuts, text escaping its row and hidden controls are not.
4. Verify selecting two alternatives leaves their target positions stable; briefing/service return keeps selected choice and reading state.
5. Verify expected effects, actual result, adoption timing and fogged uncertainty remain truthful.
6. Show a screen mosaic: map, deployment, government demand, investigation, consequence and quarter dispatch must read as related but distinct compositions.
7. Run established exact-engine task QA after visual acceptance. Browser proof does not establish physical touch comfort or novice comprehension.

## Implemented candidate for root visual review

The root approved the atlas/dispatch direction and the staged decision tradeoff. The first candidate is in `DeploymentWorkspace.tsx`, `ActionSheet.tsx`, `CompanyInspector.tsx`, `Results.tsx` and `ui-dispatch-v5.css`. The routing API and test hooks remain; `data-review-responses` is the additional stage-entry hook.

- Briefing uses a broad ivory narrative and evidence margin, then a separate dark vertical response register with an ivory proposed order. Portrait has explicit response/effects modes.
- The root added optional typed evidence roles at card construction. New deployment cards prioritize the actual evaluation and government position; old roleless saves retain all authored lines without translated-string inference. Nothing hidden by a missing role is discarded.
- Source identity resolves an actual source company/country/adviser when its ID is supplied. Missing IDs use the truthful institution-type symbol. An affected company is not automatically presented as the source.
- The result shows an actual recorded stamp and meter reasons. Adoption target remains separate from immediate meters. No invented causal linkage or before/after observation was added.
- Operation pages use real target marks and omit empty configuration columns; company investigation uses a company record and a distinct commission.

Viewed first-render evidence: `artifacts/design-v5/dispatch/en-844-brief.png`, `en-844-effects.png`, `ru-667-brief.png`, `ru-390-brief.png`, `ru-844-inspector.png`, `ru-844-result.png`, and the election/treaty/threshold/breakthrough/situation family screenshots. These are live engine fixtures in WebKit, with landscape side/bottom safe areas. They are review evidence, not final physical-device acceptance. The newly added UI strings are awaiting root's localization sync at this point. Typecheck passed before this note.
