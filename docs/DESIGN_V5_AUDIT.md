# Design V5: independent visual critique

13 October 2026. Build 4 was rejected by the player. This audit treats that as evidence that the previous functional qualification did not establish a compelling game design. It does not infer human usability from automated tests.

## Diagnosis

Build 4 replaced a visually specific but badly clipped interface with a largely uniform administrative interface. Charcoal roster, charcoal detail rectangle, small source mark, amber action: the same grammar now frames a company release, election, emergency, treaty, national funding and international relations. Text changes; the experience barely does. Precision and readable controls were necessary, but were insufficient.

The original should inform identity, not be restored wholesale: `artifacts/ux-audit-2026-10-12/en-844x390-briefing.png` shows a meaningful physical document almost entirely hidden by oversized surrounding chrome. The original World screenshot likewise loses its actual content below header/navigation. Reintroducing this geometry would repeat the initial failure.

### The map regression is real

At `1883243`, `WorldPanel` rendered `WorldMap` immediately inside its default `overview`. Build 4 defaults to an Accord text panel and moves the map after the Accord and three rivals in a scrolling roster. The map is still in source, but is absent from the initial World view. Its art also has a 240px maximum height. Title reduces the map to a cropped background at 16% opacity. This is loss of prominence and discoverability, not deletion of the asset.

## Three hypotheses discussed with the team

1. **Political atlas as working board — selected foundation.** Give the fictional nations visible territory and identity; the map is the default World surface and a prominent Agenda object. Select a nation directly, inspect its fogged intelligence, and undertake diplomacy. Risk: a beautiful but inert background. Acceptance requires real selection and visible state, not decorative geography.
2. **Cabinet narrative theatre — decision grammar.** The source of a request should feel like a person or institution addressing the director. Use authored portraits, emblems, typographic hierarchy and restrained document conventions. Elections, scientific advances, treaties and emergencies need distinct emphasis. Risk: large portraits or theatrical chrome crowd the actual choice; retain stable controls and readable prose.
3. **Causal national planning — management and reporting grammar.** Programs are allocations, government is commitments/deadlines, threats are evolving investigations, society is the consequence of adoption, reports are the story of the quarter. Let each subject determine the composition. Risk: replacing a uniform grid with arbitrary visual novelty. Every visual form must communicate a real engine value, relation or authored event.

The root-approved direction combines these under an ink-blue atlas and ivory official dispatches. Recoloring the same rectangles does not satisfy it.

## Screen-by-screen findings and required change

Evidence is the actual build-4 captures under `artifacts/full-redesign/`, except where stated. `management/` contains development captures: duplicate Companies/Nation tabs visible there were fixed before final delivery and are not claimed as a surviving defect.

| Screen | Observed composition / weakness | V5 artistic acceptance |
|---|---|---|
| Title | `final-en-667-title`: large blank charcoal field; title, gold CTA, faint cropped map. Little sense of the world or stakes. | Campaign world has legible geography; title has a deliberate relationship to map and actions; visual subject survives short landscape. |
| Nation setup | `final-en-667-setup`: resembles a settings list; four emblems and long text, fourth nation below fold. | Nation selection relates to visible geography; selected emblem, leader and defining advantage have clear hierarchy; choice is unmistakable. |
| Agenda | `qa-en-844-management-agenda`: one large generic case, watchlist, tiny meters, dead space. | Atlas and dispatch queue coexist as distinct objects; current nation and immediate responsibility recognizable at a glance. |
| Intro | `qa-en-844-intro-brief`: leader portrait tiny; opening address resembles a routine questionnaire. | Personal appointment/mandate has a visible speaker and welcoming hierarchy. |
| Deployment | `qa-en-844-deployment-brief`: logo small; two technical data lines compete with prose; right half is a choice table. | Company/model identity, evidence uncertainty and release scope are distinct; evaluation evidence is an intentional insert, not another generic card. |
| Demand | `qa-en-844-demand-brief`: current→target comparison starts below fold while choices dominate. | Named political commitment, deadline and actual gap are the visual subject; political source is identifiable. |
| Negotiation | `qa-en-844-negotiation-brief`: large empty response pane for only two answers; rejection feels identical to original demand. | Escalation and counterparty are apparent; two responses compose naturally without pretending there are four. |
| Situation | `qa-en-844-situation-brief`: infrastructure incident has same document shape and player emblem as everything else. | Incident identity, known/unknown cause and present stage carry visual urgency without fabricated certainty. |
| Event | `qa-en-844-event-brief`: cyberattack looks like standard correspondence. | Relevant event/source identity and consequence headline; no decorative alarm that implies unobserved severity. |
| Breakthrough | `qa-en-844-breakthrough-brief`: Atlantic Federation appears beside the player's Commonwealth emblem. | Correct foreign emblem; rival advance visually linked to the race/atlas, with fogged comparison clearly labeled. |
| Treaty | `qa-en-844-treaty-brief`: monumental multilateral event resembles ordinary release form. | Signatory nations/Accord identity and signing act distinguish this document. |
| Election | `qa-en-844-election-brief`: tiny leader image, same grid. | Leader, electorate and stakes establish political event; preserve authored uncertainty of outcome. |
| Last chance | `qa-en-844-last_chance-brief`: resignation ultimatum has no stronger editorial emphasis than an intro. | Personal stakes, responsible leader and last-chance wording lead the composition. |
| Threshold | `qa-en-844-threshold-brief`: civilization-defining event rendered as normal model release. | A visibly exceptional moment; dominant title/source or scene with readable choices. No invented result before commitment. |
| Company | `management/en-844-companies`: name plus four service buttons occupies first view; organization feels like database row. | Distinct institution/logo/CEO and useful capability/safeguard record; services attach to that identity. |
| Programs | `management/en-844-programs`, final funding captures: subscription-tier appearance; same roster/detail frame. | Allocation ledger with current and proposed spending, substantive effect and apply state; no pricing-page imitation. |
| Government | `management/en-844-government`: repeated commitment title in list and pane; leader absent, deadline is small metadata. | Political source + commitment + deadline/status form one clear account; likely outcome is useful visual evidence. |
| Laws | `management/en-844-policies`: generic feature catalog and gold review button. | Enacted/available law status and consequence/tradeoff read like a national statute register. |
| Society | `management/en-844-society`: four nearly identical bars; society itself is abstract. | Sector identity and actual→target adoption remain precise, with economic/social consequences composed together. |
| Threats | `management/en-844-threats`: generic service list; incident and response similar visual weight. | Evolving incident report: stage/cause/response and known evidence separate from available interventions. |
| World | `management/en-844-world`: default is Accord dashboard; map hidden below roster. | All four nations visible on initial map; nation selection works; diplomacy, Accord and race state have geography as context. |
| Action confirmation | `qa-en-844-threat-confirm`: same split as every decision; configuration can leave a large empty column. | Subject/target and specific act lead; cost and authorization stay clear, unused columns collapse intentionally. |
| Company investigation | `qa-en-844-company-investigation`: functional fact/result view but little investigative character. | Evidence provenance and confidence read as a report, with clear return to the unresolved decision. |
| Result | `qa-en-844-deployment-result`: “Decision recorded” generic success; narrative small relative to empty space. | The actual outcome headline and changed subject lead; immediate changes differ visibly from future targets. |
| Quarter | `qa-en-844-report`: “The situation has changed” plus generic instruction leaves narrative column nearly empty. | The quarter's actual defining development leads an editorial report; causes and complete accounting remain accessible. |
| News | Frozen `before/en-844-news` reviewed: generic modal with large introductory chrome; synthetic fixture has no items. Source shows chronological outlet/text list; V5 review uses real generated quarter headlines. | Recognizable media page with outlet/date hierarchy and actionable warning signs; preserve noise/uncertainty. |
| Ending | `qa-en-complete`: strong red city illustration and distinctive title, then large gap and form dropdown; epilogue below fold. | Image, ending premise and opening epilogue share the opening composition; debrief navigation supports the story. |
| Settings | `final-en-667-settings`: legacy generic bottom sheet; unrelated cyan toggle edges mixed with amber. | Quiet consistent secondary surface; controls remain legible and tactile without becoming a showcase. |
| Status/help | Final build-4 captures exist; require inclusion in V5 registry. | Supporting reading surfaces have clear heading/return and coherent typography; no forgotten old visual skin. |

## Reference principles, not styles to copy

- [Suzerain official screenshots](https://www.suzeraingame.com/) use the fictional world as a continuous stage, with identity-bearing portraits and emblems. The inspected Royal Decree screenshot separates decree text, political actors and signature/cost while retaining geographical context. Our inference: official acts should visibly belong to this world and its institutions. Do not import its desktop density or ornate control sizes onto a phone.
- [Democracy 4's official description](https://www.positech.co.uk/democracy4/) explicitly connects icon sizes and policy-area size to finances, influence and values; its dilemmas show outcomes after selection. Our inference: meaningful visual encoding can make management feel like governing a system. Decorative charts that do not encode real state would miss this principle.
- [Papers, Please official site](https://papersplea.se/) and the inspected booth screenshot give different functional objects distinct work areas. Our inference: a document's material/placement can explain its role. The former Oversight paper pile demonstrates why decorative document framing alone is insufficient.

## Design qualification, separate from task regression

For each registry screenshot, a reviewer must answer:

1. What is the dominant subject of this page? Does it represent the game's actual situation?
2. Can this page be distinguished from another subsystem without reading every sentence?
3. Is the art meaningful (actual nation/source/event), correctly attributed and legible at phone size?
4. Is there a deliberate hierarchy from subject → evidence/state → action, rather than equal-weight boxes?
5. Are map regions, primary media and opening narrative genuinely visible, not technically present below a fold?
6. Do ivory/ink contrast, typography and spacing remain coherent in real EN/RU renders?
7. Does richer composition preserve content access, uncertainty, stable choices, exact costs and saved context?

Required capture registry: title, setup, Agenda, all 11 decision briefs and selected states, company, programs preview/applied, government, laws, society, threat, World map/rival/Accord, action/result, report overview/changes/headlines, news, ending/epilogue, settings/status/help. Review 844×390 and 667×375 with iPhone safe areas; portrait fallback must also be sampled. Passing this review is a team design judgment, not evidence that the user will prefer the result. Physical-device comfort remains a distinct check.

## Management implementation and focused qualification

The team accepted the atlas/dispatch direction and delegated the management implementation to this reviewer. Implemented distinct cabinet source/commitment records, connected funding allocations, statutory operative clauses, current→target sector diagrams, institution identity/evidence, incident progression and a newspaper media monitor. Engine rules and public fogged views were retained.

Evidence:

- `artifacts/design-v5/before/registry.json`: frozen build-4 baseline captured through real UI routes.
- `artifacts/design-v5/management-final/`: first candidate management renders in both languages and landscape/portrait. RU390 capture stopped on a horizontally scrolled tab; the capture helper now logs X scrolling explicitly. This was a harness limitation, not an unreachable tab.
- `artifacts/design-v5/national-smoke/results.json`: six focused real-touch cases passed (EN/RU × 844×390, 667×375, 390×844), with 47px landscape side insets and 21px bottom inset. Funding proposal does not spend, cancel restores current, apply matches the deterministic engine oracle, demand updates, investigation matches one exact engine action and returns correctly.
- `national-smoke/ru-667-policies-final.png`: final compact law title, first operative effect and review button visible together.
- `national-smoke/ru-390-programs-final.png`: final portrait heading contrast and coherent full-width funding cost line.

During review, the first candidate hid funding's effect and demand's numerical comparison below decorative structure. Both were moved into the opening view. A compact statute initially devoted the opening view to its title and action; reduced heading scale and a leading operative clause now establish what the act does. All content remains reachable in intentional scroll regions. This focused qualification is not the complete production regression; root owns the final matrix and release evidence.
