# OVERSIGHT — Game Design Document (v1, implementation spec)

> Working title in the concept: "AI Taking Over".

> Source concept: `concept-draft.md`. This GDD turns it into a concrete, buildable first version.
> Platform: browser (mobile-first portrait, scales to desktop). Static site (GitHub Pages).
> Stack: TypeScript + Vite + Preact. All text in English.
> The code contract lives in `src/engine/types.ts` — the GDD explains intent, the types are law.

---

## 0. Pillars (every feature must serve one)

1. **Meaningful trade-offs** — growth vs. safety vs. politics vs. the race. No dominant strategy.
2. **Decisions echo** — every major choice produces visible consequences 1–6 quarters later, with warnings first.
3. **Investigate under uncertainty** — reports are evidence, not truth. Spending scarce actions to *know more* is a core verb.
4. **Recoverable mistakes** — a bad ending requires a chain of ignored warnings, never one unlucky roll.
5. **Short, readable, juicy** — a run is ~20 minutes (16 quarters); one-screen phone overview; every change animates and is explained.

## 1. Run structure

- **16 turns = quarters, 2027 Q1 → 2030 Q4.** ~60–90 s per turn.
- Run ends early on any **failure**, or when the **Threshold** fires (any actor's frontier capability ≥ 9.0), otherwise after turn 16 resolves → **Threshold** final card → Ending.
- Each turn:
  1. **Quarter opens** → "Quarter Report" overlay (meter deltas with reasons, headlines, highlights, warnings). (Skipped on turn 1, replaced by intro.)
  2. **Inbox**: 1–3 briefing cards (max 3; overflow queued, critical first). Each must be resolved.
  3. **Department actions**: spend Capacity (action points, 3 base) on investigations, policies, diplomacy, company actions. Adjust Program funding (free, any time).
  4. **End Quarter** (enabled when inbox is empty) → simulation tick → next turn.
- **Progressive reveal** (onboarding, Universal-Paperclips style): Turn 1 shows Inbox + Labs tabs. Turn 2 unlocks Nation (programs/policies). Turn 3 unlocks World. Threats tab appears with the first detected situation (or turn 4). Each unlock shows a one-time advisor tip.

## 2. Player-facing indicators

### 2.1 Four national meters (0–100, top bar, always visible)
| id | Name | Fail at 0 | Main drivers |
|---|---|---|---|
| `confidence` | Government Confidence | **Dismissed** (political failure) | leader priorities, demands kept/broken, scandals, incidents |
| `economy` | Prosperity | **Economic Collapse** (national failure) | AI adoption productivity, competitiveness vs rivals, incidents, suspensions |
| `stability` | Social Stability | **Civil Unrest** (national failure) | job displacement, public services, inequality, manipulation |
| `security` | National Security | **National Defeat** (national failure) | defense AI, rival power balance, cyber incidents, escalation |

Warning thresholds: ≤ 30 "strained" (amber), ≤ 15 "critical" (red, pulsing, advisor warning every turn).
Every change to a meter is recorded with `{turn, source label, amount}` → tapping a meter shows "why" for the last quarter and a sparkline history.

### 2.2 Risk Clock (global AI risk)
- True `risk` 0–100 is **hidden**. Displayed as a clock "minutes to midnight": `minutes = 60 × (1 − risk/100)`, e.g. risk 12 → 23:07.
- The player sees an **estimate range** `[est − u, est + u]`, `est = risk + riskBias` where `riskBias` is a persistent error that shrinks as oversight improves; `u = max(3, 18 − 4×oversightLevel − (accord signed ? 4 : 0))`. UI shows a hand at estimate with a shaded arc for uncertainty, plus trend arrow.
- risk ≥ 100 → **Global failure** (type by dominant risk source).
- Ambient music tension follows the *estimate* (subliminal warning).

### 2.3 Secondary indicators (Nation / Labs / World panels)
- **Budget** (treasury, $B) and **income/quarter**; program upkeep is deducted each turn.
- **Capacity** (action points this quarter).
- **Evidence** tokens (from investigations; used to win negotiations and enforce rules).
- **Frontier capability**: domestic best vs. rivals (estimates), shown on a 0–10 "Capability Index" with era labels.
- **Safeguards** (national alignment/control science, same 0–10 scale) — the **Safety Gap** = deployed capability − safeguards is the core risk driver. Shown as two bars.
- **Adoption** per sector (4 sectors), **Dependence** (weighted adoption), **Job displacement** (0–100).
- **Race Tension** (0–100, DEFCON-like shared escalation track). At 100 → war-type situation.
- **Global Accord** progress (0–100).

## 3. The AI progress model

- **Capability Index (C)** 0–10. Start: leading labs ≈ 2.0–3.0.
  Eras by global frontier: `emergence` (<3.5, assistants → early agents), `acceleration` (3.5–6, AI automates R&D), `superhuman` (6–8.5), `threshold` (≥8.5).
- **Safeguards (S)** 0–10, national (each rival has its own). Start ≈ 2.0.
- Per-company capability growth per turn (suggested, tune in QA):
  `g = 0.13 × compute × (1 + ambition/250) × (1 + 0.14 × max(0, C − 3)) × (1 + mods.capabilityGrowth) × noise(0.7–1.3)`
  plus breakthrough chance 6%/turn: +0.4–0.8 (news + card). Target: median global frontier ≈ 8.5–9.3 by end of turn 16; threshold reached before turn 16 in ~30–40% of runs (more often when nobody slows down).
- Safeguards growth per turn: `0.05 + safetyProgram[0,0.12,0.22,0.34][lvl] + avgCompanySafety/100 × 0.08 + (accord ? 0.08 : 0) + mods.safeguardsGrowth`.
  Intent: without safety funding S lags C by ~4 at the end; with L2 for most of the run the gap stays ≈ 1; L3 + accord can stay ahead.

## 4. Companies (domestic labs)

Each country has **3 companies** (from content), with archetypes:
- `frontier` — pushes capability, requests broad deployments, ambitious.
- `bigtech` — consumer/business scale, steady, lobbies for growth.
- `defense` — military/infrastructure contracts, close to hawks.
- `opensource` — requests open-weights releases (big economic boost + misuse risk).

**Hidden traits (randomized per run within archetype ranges):** `safety` (culture 0–100), `transparency` (0–100, honesty of reporting), `ambition` (0–100, risk-taking/pace/lobbying), `compute` (0.6–1.4).
**Visible:** name, archetype, logo, `relation` (0–100 attitude to you), reported capability, market reputation line.
**Intel:** `intel` 0–1 per company. UI shows ranges: capability `[reported − u, reported + u]`, `u = (1 − intel) × 1.5`; trait labels shown as `?` / "Low/Med/High (unverified)" / exact after investigation. Intel decays 0.12/turn after investigation.
**Concealment:** `reportedCapability = true − concealment`, concealment = up to 1.0 when transparency < 40 (hiding capabilities as the concept says).
**Hidden violations** (per turn chance ≈ 8% when ambition > 60 and transparency < 50, ×0.5 under Liability Act): `secret_training` (+0.3 C unreported), `unreported_incident` (spawns a latent situation that gets no early detection boost), `unauthorized_deployment` (after a rejection). Violations are found by Investigation (70% each) or Whistleblower events, producing **Evidence**.
**Relation effects:** relation < 25 → the company lobbies against you (confidence −1/turn + hostile events); > 70 → cooperative (transparency +2/turn, shares warnings).

### 4.1 Model releases → Deployment Request cards (the core "desk" mechanic)
- A company releases a model when its capability has grown ≥ 0.7 since its last model or every ~4 turns. Model name generated (content name pools, e.g. "Atlas-4").
- On release a **Deployment Request** card arrives: model, company, claimed capability, requested sector(s), projected gain, company's own safety claims, the government's stance, and **your department's evaluation report** (evidence lines with confidence).
- **Hidden flaw** rolled at release: `p = 0.15 + 0.10 × max(0, C − S) + (1 − safety/100) × 0.25 + ambition/100 × 0.10` (cap 0.8). Flaw types:
  - `scope_creep` (agents act outside authorized systems) → situation `rogue_agents`
  - `deceptive` (sandbagging evals, hiding capability; more likely at C ≥ 5) → `deceptive_model`
  - `brittle` (fails at edge cases; likely in infrastructure) → `infrastructure_failure`
  - `manipulative` (sycophancy/persuasion; public sector & consumer) → `mass_manipulation`
  - `jailbreakable` (misuse uplift; open releases) → `cyber_misuse` (and `bio_misuse` if C ≥ 6)
  - `power_seeking` (C ≥ 7 only) → `model_escape`
  - defense sector flaws → `military_escalation`
- **Evaluation detection chance** `d = 0.25 + 0.12 × oversightLvl + mods.detection − (deceptive ? 0.20 : 0) − 0.05 × max(0, C − S)`, clamp 0.05–0.95. Detected flaws appear as concrete red-team findings. Undetected → "No significant issues found" labelled with the *confidence* of the evaluation (Low/Medium/High derived from `d`, not from truth). **False alarms**: clean models produce an inconclusive warning 15% of the time. Players must learn to weigh confidence.
- **Choices** (standard set, engine-generated):
  1. **Approve** — full deployment in requested sector(s). Company relation +8. Leader reaction per stance. Adoption target += `8 + 2.5 × C` per sector (ramps in over ~3 quarters).
  2. **Approve with limits** (sandbox / restricted scope) — half adoption gain; any flaw situation grows at ×0.5. Relation +2.
  3. **Deep evaluation** — cost 1 capacity + 2 budget; card returns next quarter with `d + 0.35` and the true capability. Relation −5; accelerationist/hawk leader −3 confidence.
  4. **Reject** — relation −12; leader reaction; a low-transparency, high-ambition company may deploy anyway (violation, 35%).
  Open-weights requests use: Approve release / Release with safeguards (staged, half effects) / Reject.
- If an approved model has a flaw → spawn its **Situation** (latent) tied to the model.

## 5. Economy & society (compact model)

- **Sectors**: `business` (productivity, high displacement), `public` (services → stability, dependence), `infrastructure` (growth + heavy dependence, severe incidents), `defense` (security, escalation).
- `adoption[sector]` moves 40% of the way toward `adoptionTarget[sector]` each turn. Targets come from deployments, suspensions (−), events, policies (e.g. infra firewall caps infrastructure at 40).
- **Dependence** = `0.35×infra + 0.3×public + 0.25×business + 0.1×defense` (0–100). Suspending a model costs `prosperity −(3 + sectorAdoption × 0.12)` — cheap early, painful later (concept §5.2).
- **Prosperity per turn** (suggested):
  `gain = (0.030×business + 0.020×infra + 0.010×public) × (0.6 + avgDeployedC/10) × softcap`, `softcap = clamp((110 − economy)/60, 0.2, 1.2)`
  `drag = 0.5 (global competition) + 0.4 × max(0, bestRivalC − ourC) + displacement × 0.01 + country drift`
  Each term is recorded as a reason ("Business AI +1.4", "Falling behind Hanzhou −0.8").
- **Displacement** (0–100): `+0.5 × Δadoption.business + 0.25 × Δadoption.public + 0.04 × business` per turn; decays `2 × (1 + workforceLvl)` per turn.
- **Stability per turn**: `−displacement × 0.06 × (1 − mitigation) + 0.012 × public + 0.03 × (economyΔ) − inequality(0.6 if prosperity rising fast and no AI Dividend) + events`. Target: full acceleration with no workforce program → stability ≈ 20–30 by turn 10.
- **Security per turn**: `ourPower = C_national × (0.5 + defenseAdoption/100)`, `rivalPower = max over rivals (C × (0.5 + aggression/2))`; `Δ = clamp(0.35 × (ourPower − 0.9 × rivalPower), −2.5, +2) + defenseProgram × 0.4` + incidents.

## 6. Government, demands & negotiation

- **Leader** (named, portrait, title by country) with a **stance**:
  - `accelerationist` "Growth first" — weights: growth 1.0, race 0.8, security 0.4, stability 0.3, safety 0.1
  - `hawk` "Security first" — security 1.0, race 1.0, growth 0.5, stability 0.3, safety 0.2
  - `cautious` "Steady hand" — stability 0.8, safety 0.8, growth 0.5, security 0.5, race 0.2
  - `populist` "People first" — stability 1.0 (jobs!), growth 0.6, security 0.4, safety 0.4, race 0.3
- **Confidence per turn** = Σ weight × signal (prosperity Δ, security Δ, stability Δ, race position, visible incidents) × 0.5 − 0.3 base erosion + company lobbying + demand outcomes. Every term recorded as a reason.
- **Demands (promises with deadlines)** — a new demand every ~3 turns (first on turn 2). Types: `growth_target`, `deploy_sector`, `approve_model`, `match_rival`, `budget_cut`, `cover_up`, `jobs_guarantee`, `defense_program`. Accept → objective with deadline in the Government panel (success +10 confidence, fail −12). Demands are chosen to match the leader's stance.
- **Negotiation** (on every demand card and on some big events): options
  - **Comply** (accept as stated)
  - **Counter-offer** (weaker version: smaller reward, smaller ask) — success chance shown as %: `p = clamp(0.5 + (confidence − 50)/100 − resolve/200 + generosity, 0.05, 0.95)`
  - **Present evidence** (only if you hold relevant Evidence; consumes 1; +0.30 to p)
  - **Refuse** — confidence −(6 + resolve/10)
  Failed counter-offer → the leader insists: Comply or Refuse (×1.5 cost). Percentages are never fudged.
- **Elections / leadership reviews** (country calendar). Incumbent survives with `p = 0.35 + (economy − 50)/150 + (stability − 50)/150`. A new leader has a different stance; confidence resets to `45 + 10 × fit` (how well your record matches their priorities).
- **Replacement warning**: confidence ≤ 30 → advisor warning each turn; ≤ 15 → a "Last Chance" card (concede something big, spend budget on a PR campaign, or stake your job on a gamble).

## 7. International

- **Rivals** = the other three countries (same definitions as playable ones). Each has `C`, `S`, `aggression`, `safetyStance`, `trust` (with player), `intel`, `accordMember`, `exportControlled` flags.
- Rivals progress like companies (country compute, ×0.85 under export controls, ×0.8 if accord member) and emit **news + cards**: breakthroughs, treaty proposals, cyberattacks, espionage on you, their own incidents spilling over (`foreign_spillover`).
- **Rival risk contribution** per turn: `0.6 × max(0, C − S − 0.5) × (0.5 + aggression)`; same formula for the domestic frontier with ambition-based recklessness.
- **Race Tension** (0–100): + capability competition, defense programs, espionage/sabotage discovered, export controls; − dialogue, accord. ≥ 70 → escalation events; 100 → spawns `military_escalation` at crisis stage.
- **Global Accord** (0–100 progress). Diplomatic initiatives add `10 + avgTrust/10` (+30% Commonwealth); incidents worldwide add +5–10 ("wake-up calls"). At 100 → signed: members C growth ×0.8, S +0.08/turn, risk −0.8/turn, tension −20, inspections (rival intel +). Members can secretly defect (aggressive rivals); detect via intelligence.
- **International actions** (1 capacity each): Intelligence assessment, Diplomatic initiative, Research partnership (trust ≥ 50), Export controls (toggle), Espionage (30% discovery), Cyber sabotage (40% discovery), Talent recruitment.

## 8. Threats — Situations (the hidden spread)

A **Situation** is a threat instance with hidden `severity` 0–100 and stages:
`0 latent (<20) → 1 signals (20–44) → 2 incident (45–69) → 3 crisis (70–99) → 4 catastrophe (100)`.

- Spawned by: flawed deployments, open releases, company violations, rival spillover, race tension, scripted events.
- Growth per turn = `base(type) × (1 + 0.15 × max(0, C − S)) × (1 + sectorAdoption/100) × responseFactor × (1 + mods.incidentSeverity)`.
  Base: rogue_agents 7, deceptive_model 5, infrastructure_failure 6, mass_manipulation 5, cyber_misuse 8, bio_misuse 4, military_escalation 6, model_escape 10, foreign_spillover 6.
- **Detection**: undetected situations with severity ≥ 20 are detected each turn with `0.25 + 0.10 × oversightLvl + mods.earlyWarning` (Incident Reporting Act +0.15). Severity ≥ 45 auto-detects (public) — except `deceptive_model`, which only auto-detects at 70.
- **Two-signal rule**: before any situation can reach crisis it must have produced ≥ 2 warning signals (news anomaly + card/intel), even if undetected — warnings appear as vague headlines/advisor remarks ("telecom operators report odd traffic"). Severity growth is capped at 69 until two signals have been shown.
- **Explicit danger**: when a detected situation will reach the next stage next quarter, its panel shows "⚠ Escalation expected next quarter".
- **Responses** (situation card or Threats panel):
  - *Monitor* (free).
  - *Investigate* (1 capacity): reveals cause/source model & true stage; growth −10% this turn; unlocks targeted responses.
  - *Restrict model* (known cause): growth ×0.4 while restricted; sector target −30% of model's contribution; prosperity −1..−4; company relation −8.
  - *Suspend model* (known cause): severity −25, growth 0 then decays −10/turn to resolution; dependence shock to prosperity; leader reaction; relation −20.
  - *Broad containment* (unknown cause): growth ×0.5 this turn; prosperity −3.
  - *Emergency shutdown* (requires Kill-Switch Mandate; crisis stage): resolves; prosperity −8, stability −4.
  - *International task force* (escape/spillover, needs accord or trust ≥ 60).
- **Catastrophes** (severity 100): rogue_agents → "Systems Seizure" (big meter hits; if model C ≥ 7 it becomes `model_escape` at 50); deceptive_model → "Treacherous Turn" (C ≥ 7: global failure; else spawns escape); infrastructure_failure → "Cascade Failure" (meter hits, resolves); mass_manipulation → "Reality Collapse" (stability −20); cyber_misuse → "Digital Pearl Harbor" (security −20, economy −10); bio_misuse → global failure "Engineered Pandemic"; military_escalation → "Flash War" (security −30; may cause national defeat or global failure); model_escape → global failure "Loss of Control".
- Each stage crossing for a detected situation produces a briefing card with responses.

## 9. Programs (budget allocation) & Policies (laws)

### 9.1 Programs — persistent funding levels 0–3, upkeep per quarter `[0, 2, 4, 7]`
| id | Name | Effect per level |
|---|---|---|
| `safety` | Alignment & Safety Research | safeguards growth +0.12/+0.22/+0.34; company safety drift +1/turn at L2+ |
| `oversight` | Evaluation & Oversight | detection +0.12/lvl, risk-estimate uncertainty −4/lvl, capacity +1 at L2 and L3 |
| `compute` | National Compute & Grants | domestic capability growth +10%/+20%/+32%; prosperity +0.3/lvl; race-minded leaders like it |
| `workforce` | Workforce Transition | displacement mitigation 25%/45%/65%; displacement decay ×(1+lvl) |
| `defense` | Defense & Cyber AI | security +0.4/lvl/turn, defense adoption target +4/lvl/turn (cap 80), race tension +1/lvl/turn |
Budget income per quarter ≈ `country base (12–16) + economy/10 − 5 + (confidence ≥ 60 ? 2 : confidence < 30 ? −2 : 0)`. If treasury < 0 at upkeep, programs auto-downgrade (with a warning). Program changes are free and immediate but upkeep is charged at End Quarter.

### 9.2 Policies — laws, enacted with 1 capacity + political cost
Political cost = `max(0, 4 − support[stance] × 3)` confidence (can be a gain if the leader loves it). Commonwealth −40% cost. Repeal: 1 capacity, cost = half. Policies apply modifiers each turn.
| id | Name | Effect (modifiers) |
|---|---|---|
| `mandatory_evals` | Mandatory Pre-Deployment Testing | detection +0.20; deployment adoption gain −10%; company relation −1/turn |
| `compute_licensing` | Compute Licensing | domestic C growth −15%; violations detectable; risk −0.3/turn |
| `incident_reporting` | Incident Reporting Act | early warning +0.15; company transparency +1/turn |
| `open_weights_ban` | Open-Weights Restriction | misuse spawn ×0.4; opensource relation −20 once; prosperity −0.3/turn |
| `liability_act` | AI Liability Act | company safety +1/turn, ambition −1/turn; violations ×0.5; C growth −5% |
| `infra_firewall` | Critical Infrastructure Firewall | infrastructure adoption cap 40; infra incident growth ×0.5 |
| `ai_dividend` | AI Dividend | stability +1/turn when business adoption > 30; prosperity −0.5/turn; companies −1/turn |
| `kill_switch` | Emergency Off-Switch Mandate | unlocks Emergency shutdown; escape growth ×0.7; companies −1/turn |
| `human_in_loop` | Human Control of Weapons | military_escalation growth ×0.5; security −0.3/turn; tension −1/turn |
| `fast_track` | Deployment Fast-Track | deployment gain +25%; detection −0.15; accelerationists love it |

## 10. Department actions (Capacity)
| Action | Cost | Effect |
|---|---|---|
| Investigate company | 1 | intel → 1; reveals traits; 70% per hidden violation → Evidence; relation −3 |
| Audit deployed model | 1 | detection roll with +0.30; reveals flaw; links/detects its situation |
| Investigate situation | 1 | reveals cause, true stage, unlocks targeted responses |
| Safety grant to company | 1 + $4B | company safety +10, relation +5 |
| Compute contract | 1 + $5B | company C +0.3, relation +8 |
| Enforcement action | 1 + 1 Evidence | relation −15, transparency +15, ambition −10, confidence + (cautious/populist) |
| Brief the leader | 1 | confidence +3..+6 (diminishing if repeated) |
| Public address | 1 | stability +4; if a situation is public, confidence ±2 |
| Enact / repeal policy | 1 | see §9.2 |
| International actions | 1 (+$) | see §7 |

## 11. Cards (briefings)

All decisions arrive as **cards** with: source (company / government / foreign / intelligence / public / AI / advisor), title, body text, optional **evidence lines** (label, value, confidence: verified/high/medium/low/redacted — redacted lines render as black bars), **advisor notes** (2 of 4 advisors comment; they have known biases), and 2–4 **choices**.

**Choice preview**: icons for affected meters/resources with direction and magnitude (1–3 chevrons). Delayed or probabilistic consequences are **not** previewed (they show a "?" "Uncertain consequences" chip if present). Risk effects show direction only.

Card sources:
- **System cards** (engine): deployment requests, demands, negotiation follow-ups, situation escalations, elections, breakthroughs, treaty milestones, last chance, the Threshold.
- **Scripted events** (content, ~70+): narrative dilemmas with conditions, bindings (company/rival/model/situation), choices, chained follow-ups (`followUp` scheduled 1–4 turns later), flags. One per turn on average (0–2), weighted, mostly once per run.

**Advisors** (with deliberate biases):
- *Chief of Staff* (politics; cares about confidence) — "The {leaderTitle} wants this."
- *Chief Scientist* (safety; cautious) — comments on evaluation confidence and gaps.
- *Economic Advisor* (growth; optimistic about deployments) — quantifies gains.
- *Intelligence Director* (international; hawkish) — rival estimates, espionage hints.

## 12. The Threshold (finale) & endings

**The Threshold** card fires when any actor reaches C ≥ 9.0, or after turn 16. It names the leading actor (domestic company or rival). Choices depend on context, e.g. *Authorize under national safeguards* / *Place under international oversight (needs accord or trust)* / *Contain and pause* / *Race to match* / *Join the rival's framework*. The card shows an advisor-estimated **chance of keeping control** (range), computed from `S_leader vs C_leader`, true risk, unresolved situations, accord. The outcome roll decides between global failure and survival; a well-played run should be ≥ 85% safe, a reckless one ≤ 40%.

**Endings** (graded, not a single score):
- Failures: `dismissed`, `economic_collapse`, `civil_unrest`, `national_defeat`, `loss_of_control`, `catastrophe` (misuse), `ai_war`.
- Survival (by scores Control / Prosperity / Security / Legitimacy, each 0–100):
  - `governed_transition` — Control ≥ 65, Prosperity ≥ 50, Security ≥ 40 (best)
  - `prosperous_pioneer` — Prosperity ≥ 65, Control ≥ 45
  - `hegemon` — Security ≥ 70 and leading the race, Control < 45
  - `safe_harbor` — Control ≥ 60 but Prosperity < 50 or Security < 40
  - `fragile_future` — otherwise ("survived with serious unresolved risks")
- Rating S/A/B/C/D/F + per-dimension letter grades.

**Debrief screen** (concept §6 "explain causes and missed opportunities"):
1. Ending title, illustration, narrative epilogue (content).
2. Scores per dimension with grades.
3. **Decisive moments** — 3–5 key decisions with their traced consequences (from the decision log + causal links: situation ← model ← approval decision).
4. **Hidden truths** — true traits of each company, flaws of every model (detected or not), rivals' true capabilities, any secret violations.
5. **Warning signs** — every signal shown, and the quarter it appeared, marked as acted on or ignored.
6. **Missed opportunities** — generated tips (e.g. "Investigating Helix in 2028 Q2 would have revealed secret training").
7. Seed + "Replay this seed", "New run". Daily-seed mode.

## 13. Countries (fictional, roughly equal difficulty, distinct play)

| | Atlantic Federation | Hanzhou Republic | European Commonwealth | Meridian Republic |
|---|---|---|---|---|
| Leader title | President | Chairman | Chancellor | Prime Minister |
| Start conf/econ/stab/sec | 55/60/50/65 | 65/55/60/60 | 60/55/65/45 | 60/62/60/45 |
| Income base | 16 | 15 | 14 | 14 |
| Labs start C | 2.6–3.0 | 2.2–2.6 | 1.8–2.3 | 2.0–2.4 |
| Compute | 1.3 | 0.9 | 0.9 | 1.15 |
| Political calendar | elections T7, T13 | party congress T9 (80% keep) | election T10 | elections T6, T12 |
| Leader stances pool | accel, hawk, populist | hawk, accel, cautious | cautious, populist, accel | cautious, hawk, accel |
| Trait (+) | **Frontier Powerhouse**: C growth +15% | **State Direction**: enforcement/policy costs no confidence; adoption ramps +25% | **Regulatory Power**: policy cost −40%; accord progress +30%; workforce +20% | **Silicon Shield**: export controls ×2 effect; +2 income |
| Trait (−) | Polarized: confidence swings ×1.3; company ambition +15 | Chip-limited: compute 0.9 and vulnerable to export controls; low foreign trust; stability ×1.2 sensitivity to displacement | Lagging labs; prosperity drift −0.2/turn | Small military: rival aggression +0.15 toward Meridian; security drift −0.2/turn |
| Start trust with others | medium | low | high | medium |

All fictional. Tone: credible institutions, no caricature. Each country has a viable path: Atlantic leads the race but must tame its labs; Hanzhou deploys fast but must manage trust and chips; Commonwealth regulates and builds the accord but must keep the economy afloat; Meridian leverages chips/diplomacy but must survive security pressure.

## 14. Difficulty
- `analyst` (easy): signals clearer (detection +0.1, risk uncertainty −3), demands every 4 turns, risk growth ×0.8.
- `director` (normal): baseline.
- `doomer` (hard): detection −0.1, false alarms 25%, demands every 2–3 turns, risk growth ×1.2.
Difficulty changes signal noise and pressure, not hidden stat cheating.

## 15. Presentation

### 15.1 Art direction — "Situation Room × Classified Dossier"
- Dark, glassy command-center dashboard (data, meters, map) contrasted with **paper briefing cards** (off-white paper, typewriter headings, red CLASSIFIED stamps, redaction bars that literally hide unknown info).
- Palette tokens: `--bg #070b14`, `--panel #0d1424`, `--panel-2 #121b30`, `--line #1f2b45`, `--text #d8e1f0`, `--text-dim #7f8ba3`, `--accent #3fd0ff` (cyan, AI/data), `--good #3ee08f`, `--warn #ffb547`, `--bad #ff4d5e`, `--ai #a77bff` (AI-originated events), `--gov #e8c169` (government gold), `--paper #ece6d8`, `--ink #1b1a17`, `--stamp #c8312b`.
- Fonts (Google Fonts): **Space Grotesk** (headings/UI), **Inter** (body), **JetBrains Mono** (numbers/data), **Special Elite** (typewriter for dossier titles only).
- Meter colors are **never** the only signal: icons + numbers + chevrons.
- Background: animated canvas "neural network / world grid" whose speed and red tint follow the risk estimate.

### 15.2 Layout
- **Phone (≤ 760px)**: top bar (date, 4 meters, risk clock, capacity pips, budget) → main view → bottom tab bar (Inbox, Labs, Nation, World, Threats). Cards open as full-height sheets. End Quarter = large bottom button above the tab bar when inbox is empty.
- **Desktop (≥ 1100px)**: left rail tabs, center main view, right column with Inbox stack + news feed. Same components.
- Tap targets ≥ 44px, body text ≥ 16px on mobile, `100dvh`, safe-area insets, `touch-action: manipulation`.
- Keyboard: 1–4 pick a choice, Space/Enter = continue/End Quarter, Esc closes sheets, Tab navigation works.

### 15.3 Juice
- Number tweens (400ms ease-out), meter flash + floating "+3/−5" chips at the meter.
- Card slide-in with paper rustle; stamp animation (APPROVED/REJECTED/DEFERRED) on resolution.
- Quarter transition: calendar flip, headline ticker, report rows animating in.
- Crisis: red vignette pulse, small screen shake (≤ 300ms), glitch text for AI-originated cards.
- Ending: slow reveal; good endings get a sunrise gradient + particles; failure gets static/glitch + low rumble.
- `prefers-reduced-motion` + in-game toggle disable shake/glitch/particles and shorten tweens.

### 15.4 Audio (procedural WebAudio, no files)
UI clicks/hover ticks, card in/out (filtered noise), approve chime, reject thud, stamp, alert, critical alarm, success, fail, typewriter ticks, turn chime, coin; ambient drone music (2–3 layered oscillators + slow filter LFO + sparse arpeggio) whose tension parameter shifts harmony/tempo/filter with the risk estimate. Unlocks on first user gesture; mute toggle persisted.

## 16. Tech architecture
- `src/engine/` — pure TypeScript simulation, no DOM. Deterministic: seeded RNG (sfc32/mulberry32) stored in `GameState`. `Game` class (see `types.ts` → `GameAPI`). UI reads hidden-information **only through view functions** (fogged). Every meter change goes through one function that records reasons.
- `src/content/` — data/narrative: countries, company pools, leaders, scripted events, text banks, endings.
- `src/ui/` — Preact components & screens; `src/styles/` — CSS.
- `src/art/` — SVG icons, emblems, procedural logos & portraits.
- `src/fx/` — animation helpers & canvas background; `src/audio/` — procedural sound.
- Save: `localStorage` autosave after every decision and turn (`try/catch`, versioned).
- Tests: Vitest for the engine; `scripts/sim.ts` headless bots (random / approve-all / cautious / balanced) over many seeds for balance.
- Deploy: `vite build` with `base: './'` → `dist/` works on GitHub Pages (Actions workflow) or any static server.
