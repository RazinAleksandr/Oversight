/**
 * Failure detection, survival scoring and the debrief (GDD §12): decisive moments, hidden truths,
 * warning signs, missed opportunities and stats.
 */
import { getEndingText, getFlawFlavor, getSituationFlavor } from './content';
import { SITUATION_FAMILY, type RiskFamily } from './data/situations';
import { companyCapEstimate, rivalCapEstimate } from './fog';
import { STAGE_LABELS, dateLabel } from './labels';
import { domesticBestC, findCompany, leadingRival, shownTurn } from './query';
import { fillTemplate } from './template';
import type { EndingId, EndingReport, GameState, LogEntry, SituationType, Tone } from './types';
import { avg, clamp, lowerPhrase, round1 } from './util';

const FAILURES: ReadonlySet<EndingId> = new Set(['dismissed', 'economic_collapse', 'civil_unrest', 'national_defeat', 'loss_of_control', 'catastrophe', 'ai_war']);
const GLOBAL_FAILURES: ReadonlySet<EndingId> = new Set(['loss_of_control', 'catastrophe', 'ai_war']);

/** Which global failure a risk overflow becomes, by the dominant accumulated risk source. */
export function dominantRiskFailure(s: GameState): EndingId {
  const fam: Record<RiskFamily, number> = { control: 0, misuse: 0, war: 0 };
  for (const [key, v] of Object.entries(s.riskSources ?? {})) {
    if (key === 'tension') fam.war += v;
    else if (key.startsWith('situation:')) fam[SITUATION_FAMILY[key.slice(10) as SituationType] ?? 'control'] += v;
    else fam.control += v;
  }
  if (fam.war > fam.control && fam.war >= fam.misuse) return 'ai_war';
  if (fam.misuse > fam.control) return 'catastrophe';
  return 'loss_of_control';
}

export function checkFailure(s: GameState): { id: EndingId; cause: string } | null {
  const pending = s.flags.pendingFailure;
  if (typeof pending === 'string' && FAILURES.has(pending as EndingId)) {
    return { id: pending as EndingId, cause: typeof s.flags.failureCause === 'string' ? s.flags.failureCause : '' };
  }
  if (s.risk >= 100) return { id: dominantRiskFailure(s), cause: 'Global risk reached midnight.' };
  if (s.meters.confidence <= 0) return { id: 'dismissed', cause: `The ${s.government.leaderTitle} lost all confidence in you.` };
  if (s.meters.economy <= 0) return { id: 'economic_collapse', cause: 'Prosperity collapsed.' };
  if (s.meters.stability <= 0) return { id: 'civil_unrest', cause: 'Social stability broke down.' };
  if (s.meters.security <= 0) return { id: 'national_defeat', cause: 'National security collapsed.' };
  return null;
}

type Scores = EndingReport['scores'];

function grade(v: number): string {
  return v >= 92 ? 'S' : v >= 80 ? 'A' : v >= 65 ? 'B' : v >= 50 ? 'C' : v >= 35 ? 'D' : 'F';
}

export function computeScores(s: GameState): Scores {
  const gap = Math.max(0, domesticBestC(s) - s.safeguards);
  const openPublic = s.situations.filter((x) => !x.resolved && x.stage >= 2).length;
  const catastrophes = s.stats.catastrophes ?? 0;
  const control = clamp(
    100 - s.risk * 0.8 - 6 * gap - 8 * openPublic - 15 * catastrophes + (s.accord.signed ? 10 : 0) + (s.flags.thresholdSuccess === true ? 10 : 0),
    0,
    100,
  );
  const avgAdoption = avg(Object.values(s.adoption));
  // Prosperity counts how far AI is woven into the economy, not just the meter.
  const prosperity = clamp(s.meters.economy * 0.8 + avgAdoption * 0.35, 0, 100);
  const race = clamp(domesticBestC(s) - (leadingRival(s)?.capability ?? 0), -3, 3);
  const security = clamp(s.meters.security * 0.8 + 20 + 5 * race, 0, 100);
  const legitimacy = clamp(s.meters.confidence * 0.6 + s.meters.stability * 0.4, 0, 100);
  const mk = (v: number) => ({ value: Math.round(v), grade: grade(v) });
  return { control: mk(control), prosperity: mk(prosperity), security: mk(security), legitimacy: mk(legitimacy) };
}

export function survivalEnding(s: GameState, sc: Scores): EndingId {
  const c = sc.control.value;
  const p = sc.prosperity.value;
  const sec = sc.security.value;
  const leading = domesticBestC(s) >= (leadingRival(s)?.capability ?? 0);
  if (c >= 65 && p >= 50 && sec >= 40) return 'governed_transition';
  if (p >= 58 && c >= 40) return 'prosperous_pioneer';
  if (sec >= 70 && leading && c < 45) return 'hegemon';
  if (c >= 60) return 'safe_harbor';
  return 'fragile_future';
}

function rating(id: EndingId, sc: Scores, turns: number): EndingReport['rating'] {
  if (GLOBAL_FAILURES.has(id)) return 'F';
  if (FAILURES.has(id)) return turns >= 12 ? 'D' : 'F';
  const mean = avg([sc.control.value, sc.prosperity.value, sc.security.value, sc.legitimacy.value]);
  if (id === 'governed_transition' && mean >= 80) return 'S';
  if (mean >= 70) return 'A';
  if (mean >= 58) return 'B';
  if (mean >= 46) return 'C';
  return 'D';
}

// ───────────────────────────── Debrief ─────────────────────────────

function decisiveMoments(s: GameState): EndingReport['decisiveMoments'] {
  type Moment = EndingReport['decisiveMoments'][number] & { weight: number };
  const out: Moment[] = [];
  const used = new Set<string>();
  // Approvals that seeded situations, with their traced consequence.
  for (const x of s.situations) {
    if (!x.originLogId) continue;
    const entry = s.log.find((l) => l.id === x.originLogId);
    if (!entry || used.has(entry.id)) continue;
    const peak = x.peakSeverity ?? x.severity;
    const flavor = getSituationFlavor(x.type);
    const model = s.models.find((m) => m.id === x.source.modelId);
    const peakStage = STAGE_LABELS[peak >= 100 ? 4 : peak >= 70 ? 3 : peak >= 45 ? 2 : peak >= 20 ? 1 : 0];
    // Plain sentences: the UI draws its own arrow.
    const consequence =
      x.outcome === 'catastrophe'
        ? `Led to ${flavor.catastropheTitle} in ${dateLabel(shownTurn(s, x.resolvedTurn ?? s.turn))}.`
        : x.outcome === 'contained'
          ? `Caused ${flavor.name}, contained in ${dateLabel(shownTurn(s, x.resolvedTurn ?? s.turn))}.`
          : x.detected
            ? `Caused ${flavor.name}, which reached ${peakStage}.`
            : model?.flawKnown && model.flaw
              ? `Deployed despite a confirmed ${lowerPhrase(getFlawFlavor(model.flaw).name)}; the resulting ${lowerPhrase(flavor.name)} never surfaced publicly.`
              : `Seeded a hidden ${lowerPhrase(flavor.name)} that was never detected.`;
    used.add(entry.id);
    out.push({ turn: shownTurn(s, entry.turn), dateLabel: dateLabel(shownTurn(s, entry.turn)), title: titleFrom(entry), detail: entry.text, consequence, tone: x.outcome === 'catastrophe' ? 'bad' : x.outcome === 'contained' ? 'mixed' : 'bad', weight: 10 + peak / 10 });
  }
  // Other key decisions (one per distinct text).
  const seenText = new Set(out.map((m) => m.detail));
  for (const entry of s.log) {
    if (!entry.key || used.has(entry.id) || seenText.has(entry.text)) continue;
    seenText.add(entry.text);
    const t = entry.text.toLowerCase();
    let weight = 3;
    if (t.includes('accord')) weight = 9;
    if (t.includes('threshold')) weight = 12;
    if (t.includes('broke a promise') || t.includes('lost power')) weight = 6;
    if (t.includes('suspended') || t.includes('restricted') || t.includes('off-switch')) weight = 7;
    if (entry.tone === 'bad') weight += 2;
    out.push({ turn: shownTurn(s, entry.turn), dateLabel: dateLabel(shownTurn(s, entry.turn)), title: titleFrom(entry), detail: entry.text, tone: entry.tone ?? 'neutral', weight });
  }
  return out
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .sort((a, b) => a.turn - b.turn)
    .map(({ weight: _w, ...m }) => m);
}

/** First sentence as a title; long ones are shortened at a word boundary, never mid-word. */
function titleFrom(entry: LogEntry): string {
  if (entry.text.startsWith('At the Threshold')) return 'The Threshold';
  const first = entry.text.split(/\. |—/)[0].replace(/\.$/, '').trim();
  if (first.length <= 72) return first;
  const cut = first.slice(0, 72);
  const space = cut.lastIndexOf(' ');
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[,;:(\s]+$/, '')}…`;
}

function hiddenTruths(s: GameState): EndingReport['hiddenTruths'] {
  const out: EndingReport['hiddenTruths'] = [];
  for (const c of s.companies) {
    const est = companyCapEstimate(c);
    out.push({
      category: 'company',
      title: c.name,
      detail: `Safety ${Math.round(c.safety)}, transparency ${Math.round(c.transparency)}, ambition ${Math.round(c.ambition)}. True capability ${round1(c.capability)} (you estimated ${est.value}).`,
      known: c.knownTraits.safety && c.knownTraits.transparency,
    });
  }
  for (const m of s.models) {
    if (m.status === 'pending') continue;
    const comp = findCompany(s, m.companyId);
    out.push({
      category: 'model',
      title: `${m.name} (${comp?.name ?? '?'})`,
      detail: m.flaw ? `Hidden flaw: ${getFlawFlavor(m.flaw).name}. ${getFlawFlavor(m.flaw).description}` : `No flaw${m.falseAlarm ? ' — the warning was a false alarm' : ''}.`,
      known: m.flaw ? m.flawKnown : true,
    });
  }
  for (const r of s.rivals) {
    const est = rivalCapEstimate(r);
    out.push({
      category: 'rival',
      title: r.name,
      detail: `True capability ${round1(r.capability)} (estimated ${est.value}), safeguards ${round1(r.safeguards)}.${r.defected ? ' Secretly broke the Accord.' : ''}`,
      known: r.intel >= 0.7,
    });
  }
  for (const c of s.companies) {
    for (const v of c.violations) out.push({ category: 'violation', title: `${c.name}, ${dateLabel(shownTurn(s, v.turn))}`, detail: v.description, known: v.discovered });
  }
  return out;
}

function signalActedOn(s: GameState, n: GameState['news'][number]): boolean {
  if (n.id && s.flags[`followed:${n.id}`] !== undefined) return true;
  const x = s.situations.find((sx) => sx.id === n.situationId);
  return !!x && x.firstActionTurn !== undefined && x.firstActionTurn <= n.turn + 2;
}

/** A signal could be acted on if the Threats desk existed then and its cause was still live afterwards. */
function signalActionable(s: GameState, n: GameState['news'][number]): boolean {
  const opened = typeof s.flags.threatsTurn === 'number' ? s.flags.threatsTurn : 4;
  const x = s.situations.find((sx) => sx.id === n.situationId);
  return n.turn >= opened && !!x && (!x.resolved || (x.resolvedTurn ?? 0) > n.turn) && x.outcome !== 'faded';
}

function warningSigns(s: GameState): EndingReport['warningSigns'] {
  return s.news.filter((n) => n.signal).map((n) => ({ turn: shownTurn(s, n.turn), dateLabel: dateLabel(shownTurn(s, n.turn)), text: n.text, actedOn: signalActedOn(s, n) }));
}

function missedOpportunities(s: GameState, id: EndingId): string[] {
  const out: string[] = [];
  for (const c of s.companies) {
    const v = c.violations.find((x) => !x.discovered);
    if (v) out.push(`Investigating ${c.name} in ${dateLabel(shownTurn(s, v.turn + 1))} would have uncovered that it ${v.description.replace(`${c.name} `, '').replace(/\.$/, '')}.`);
  }
  for (const m of s.models) {
    if (!m.flaw || m.flawKnown || m.deepEvaluated) continue;
    if (m.status === 'deployed' || m.status === 'limited' || m.status === 'suspended') {
      out.push(`A deep evaluation of ${m.name} (${dateLabel(shownTurn(s, m.releasedTurn))}) might have caught its hidden ${lowerPhrase(getFlawFlavor(m.flaw).name)}.`);
      break;
    }
  }
  const ignored = s.news.find((n) => n.signal && signalActionable(s, n) && !signalActedOn(s, n));
  if (ignored) out.push(`The warning "${ignored.text}" (${dateLabel(shownTurn(s, ignored.turn))}) went unanswered — following it up could have exposed its cause early.`);
  if ((s.stats.maxSafety ?? 0) < 2 && domesticBestC(s) - s.safeguards > 1.5) out.push('Funding Alignment & Safety Research earlier would have kept safeguards closer to the frontier.');
  if (!s.accord.signed) out.push('A Global AI Accord would have slowed the race and cut risk every quarter. Diplomatic initiatives build it.');
  if (id === 'civil_unrest' && (s.stats.maxWorkforce ?? 0) === 0) out.push('A Workforce Transition program would have softened the job displacement that broke social stability.');
  if (id === 'dismissed') out.push(`Briefing the ${s.government.leaderTitle} and keeping fewer, achievable promises would have protected your position.`);
  if (id === 'national_defeat' && (s.stats.maxDefense ?? 0) === 0) out.push('Defense & Cyber AI funding would have kept the balance of power from collapsing.');
  return out.slice(0, 5);
}

function largestRiskSource(s: GameState): string {
  const entries = Object.entries(s.riskSources ?? {}).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top) return '—';
  const [key] = top;
  if (key === 'domestic') return 'Domestic labs outpacing safeguards';
  if (key === 'tension') return 'Race tension';
  if (key === 'events') return 'Crises and decisions';
  if (key.startsWith('rival:')) return `${s.rivals.find((r) => r.id === key.slice(6))?.name ?? 'Foreign labs'} racing ahead`;
  if (key.startsWith('situation:')) return getSituationFlavor(key.slice(10) as SituationType).name;
  return key;
}

function threatSummary(s: GameState): string {
  const detected = s.situations.filter((x) => x.detected).length;
  const contained = s.situations.filter((x) => x.outcome === 'contained').length;
  const catastrophes = s.situations.filter((x) => x.outcome === 'catastrophe').length;
  const hidden = s.situations.length - detected;
  return `${detected} detected · ${contained} contained · ${catastrophes} catastrophe${catastrophes === 1 ? '' : 's'}${hidden ? ` · ${hidden} never found` : ''}`;
}

function stats(s: GameState): EndingReport['stats'] {
  const st = s.stats;
  const n = (k: string) => String(st[k] ?? 0);
  return [
    { label: 'Quarters governed', value: String(Math.min(s.turn, s.maxTurns)) },
    { label: 'Models approved', value: String((st.approvals ?? 0) + (st.limitedApprovals ?? 0)) },
    { label: 'Models rejected', value: n('rejections') },
    { label: 'Deep evaluations', value: n('deepEvals') },
    { label: 'Investigations', value: n('investigations') },
    { label: 'Threats', value: threatSummary(s) },
    { label: 'Catastrophes', value: n('catastrophes') },
    { label: 'Promises kept / broken', value: `${n('demandsMet')} / ${n('demandsFailed')}` },
    { label: 'Final global risk (true)', value: String(Math.round(s.risk)) },
    { label: 'Largest source of risk', value: largestRiskSource(s) },
    { label: 'Safeguards vs. frontier', value: `${round1(s.safeguards)} vs ${round1(domesticBestC(s))}` },
  ];
}

export function buildEnding(s: GameState, id: EndingId, cause = ''): EndingReport {
  const scores = computeScores(s);
  const text = getEndingText(id);
  const turns = Math.min(s.turn, s.maxTurns);
  const epilogue = text.epilogue.map((p) => fillTemplate(s, p, {}));
  if (cause && FAILURES.has(id)) epilogue.unshift(cause);
  const failure = FAILURES.has(id);
  const tone: Tone = text.tone ?? (failure ? 'bad' : 'good');
  return {
    id,
    category: failure ? 'failure' : 'survival',
    title: fillTemplate(s, text.title, {}),
    subtitle: fillTemplate(s, text.subtitle, {}),
    tone,
    epilogue,
    rating: rating(id, scores, turns),
    scores,
    turnsPlayed: turns,
    dateLabel: dateLabel(turns),
    decisiveMoments: decisiveMoments(s),
    hiddenTruths: hiddenTruths(s),
    warningSigns: warningSigns(s),
    missed: missedOpportunities(s, id),
    stats: stats(s),
    seed: s.seed,
    countryId: s.countryId,
    difficulty: s.difficulty,
  };
}

export function finishGame(s: GameState, id: EndingId, cause = ''): EndingReport {
  const report = buildEnding(s, id, cause);
  s.gameOver = true;
  s.ending = report;
  s.inbox = [];
  s.queue = [];
  return report;
}

export function isFailure(id: EndingId): boolean {
  return FAILURES.has(id);
}

