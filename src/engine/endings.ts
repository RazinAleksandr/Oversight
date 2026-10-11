/**
 * Failure detection, survival scoring and the debrief (GDD §12): decisive moments, hidden truths,
 * warning signs, missed opportunities and stats.
 */
import { getLang, t, tp } from '../i18n';
import { getEndingText, getFlawFlavor, getSituationFlavor } from './content';
import { SITUATION_FAMILY, type RiskFamily } from './data/situations';
import { companyCapEstimate, rivalCapEstimate } from './fog';
import { STAGE_LABELS, dateLabel } from './labels';
import { debriefWeight } from './log';
import { domesticBestC, findCompany, leadingRival, shownTurn } from './query';
import { violationAct } from './systems/companies';
import { fillTemplate } from './template';
import type { EndingId, EndingReport, GameState, LogEntry, SituationType, Tone } from './types';
import { avg, clamp, midPhrase, round1 } from './util';

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
  if (s.risk >= 100) return { id: dominantRiskFailure(s), cause: t('Global risk reached midnight.') };
  if (s.meters.confidence <= 0) return { id: 'dismissed', cause: t('The {leaderTitle} lost all confidence in you.', { leaderTitle: s.government.leaderTitle }) };
  if (s.meters.economy <= 0) return { id: 'economic_collapse', cause: t('Prosperity collapsed.') };
  if (s.meters.stability <= 0) return { id: 'civil_unrest', cause: t('Social stability broke down.') };
  if (s.meters.security <= 0) return { id: 'national_defeat', cause: t('National security collapsed.') };
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
    const date = dateLabel(shownTurn(s, x.resolvedTurn ?? s.turn));
    const consequence =
      x.outcome === 'catastrophe'
        ? t('Led to {catastrophe} in {date}.', { catastrophe: flavor.catastropheTitle, date })
        : x.outcome === 'contained'
          ? t('Caused {situation}, contained in {date}.', { situation: flavor.name, date })
          : x.detected
            ? t('Caused {situation}, which reached {stage}.', { situation: flavor.name, stage: peakStage })
            : model?.flawKnown && model.flaw
              ? t('Deployed despite a confirmed {flaw}; the resulting {situation} never surfaced publicly.', { flaw: midPhrase(getFlawFlavor(model.flaw).name), situation: midPhrase(flavor.name) })
              : t('Seeded a hidden {situation} that was never detected.', { situation: midPhrase(flavor.name) });
    used.add(entry.id);
    out.push({ turn: shownTurn(s, entry.turn), dateLabel: dateLabel(shownTurn(s, entry.turn)), title: titleFrom(entry), detail: entry.text, consequence, tone: x.outcome === 'catastrophe' ? 'bad' : x.outcome === 'contained' ? 'mixed' : 'bad', weight: 10 + peak / 10 });
  }
  // Other key decisions (one per distinct text).
  const seenText = new Set(out.map((m) => m.detail));
  for (const entry of s.log) {
    if (!entry.key || used.has(entry.id) || seenText.has(entry.text)) continue;
    seenText.add(entry.text);
    // Keywords are matched in English; translated entries carry their English weight in `w`.
    let weight = entry.w ?? debriefWeight(entry.text);
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
  if (entry.title) return entry.title;
  if (entry.text.startsWith('At the Threshold')) return t('The Threshold');
  const first = firstSentence(entry.text).replace(/\.$/, '').trim();
  if (first.length <= 72) return first;
  const cut = first.slice(0, 72);
  const space = cut.lastIndexOf(' ');
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[,;:(\s]+$/, '')}…`;
}

/**
 * Text up to the first sentence break (". ") or dash. Russian text also uses ". " inside
 * abbreviations ("3 кв. 2028", "ген. Ли", "т. е."), which must not end the title.
 */
function firstSentence(text: string): string {
  if (getLang() === 'en') return text.split(/\. |—/)[0];
  const parts = text.split(/(?<!(?:^|[\s(«„"])(?:кв|ген|адм|полк|проф|акад|св|им|т|д|е|г|гг|в|вв|см|ср|напр|млн|млрд|тыс|ок|др|пр|ул|стр|рис|гл))\. |—/iu);
  return parts.find((p) => p.trim()) ?? text;
}

function hiddenTruths(s: GameState): EndingReport['hiddenTruths'] {
  const out: EndingReport['hiddenTruths'] = [];
  for (const c of s.companies) {
    const est = companyCapEstimate(c);
    out.push({
      category: 'company',
      title: c.name,
      detail: t('Safety {safety}, transparency {transparency}, ambition {ambition}. True capability {capability} (you estimated {estimate}).', {
        safety: Math.round(c.safety),
        transparency: Math.round(c.transparency),
        ambition: Math.round(c.ambition),
        capability: round1(c.capability),
        estimate: est.value,
      }),
      known: c.knownTraits.safety && c.knownTraits.transparency,
    });
  }
  for (const m of s.models) {
    if (m.status === 'pending') continue;
    const comp = findCompany(s, m.companyId);
    out.push({
      category: 'model',
      title: `${m.name} (${comp?.name ?? '?'})`,
      detail: m.flaw
        ? t('Hidden flaw: {flaw}. {description}', { flaw: getFlawFlavor(m.flaw).name, description: getFlawFlavor(m.flaw).description })
        : m.falseAlarm
          ? t('No flaw — the warning was a false alarm.')
          : t('No flaw.'),
      known: m.flaw ? m.flawKnown : true,
    });
  }
  for (const r of s.rivals) {
    const est = rivalCapEstimate(r);
    out.push({
      category: 'rival',
      title: r.name,
      detail: r.defected
        ? t('True capability {capability} (estimated {estimate}), safeguards {safeguards}. Secretly broke the Accord.', { capability: round1(r.capability), estimate: est.value, safeguards: round1(r.safeguards) })
        : t('True capability {capability} (estimated {estimate}), safeguards {safeguards}.', { capability: round1(r.capability), estimate: est.value, safeguards: round1(r.safeguards) }),
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
    if (!v) continue;
    const model = v.modelId ? s.models.find((m) => m.id === v.modelId) : undefined;
    out.push(
      t('Investigating {company} in {date} would have uncovered that it {act} ({when}).', {
        company: c.name,
        date: dateLabel(shownTurn(s, v.turn + 1)),
        act: violationAct(v.kind, model?.name),
        when: dateLabel(shownTurn(s, v.turn)),
      }),
    );
  }
  for (const m of s.models) {
    if (!m.flaw || m.flawKnown || m.deepEvaluated) continue;
    if (m.status === 'deployed' || m.status === 'limited' || m.status === 'suspended') {
      out.push(
        t('A deep evaluation of {model} ({date}) might have caught its hidden {flaw}.', { model: m.name, date: dateLabel(shownTurn(s, m.releasedTurn)), flaw: midPhrase(getFlawFlavor(m.flaw).name) }),
      );
      break;
    }
  }
  const ignored = s.news.find((n) => n.signal && signalActionable(s, n) && !signalActedOn(s, n));
  if (ignored) {
    out.push(t('The warning "{warning}" ({date}) went unanswered — following it up could have exposed its cause early.', { warning: ignored.text, date: dateLabel(shownTurn(s, ignored.turn)) }));
  }
  if ((s.stats.maxSafety ?? 0) < 2 && domesticBestC(s) - s.safeguards > 1.5) out.push(t('Funding Alignment & Safety Research earlier would have kept safeguards closer to the frontier.'));
  if (!s.accord.signed) out.push(t('A Global AI Accord would have slowed the race and cut risk every quarter. Diplomatic initiatives build it.'));
  if (id === 'civil_unrest' && (s.stats.maxWorkforce ?? 0) === 0) out.push(t('A Workforce Transition program would have softened the job displacement that broke social stability.'));
  if (id === 'dismissed') out.push(t('Briefing the {leaderTitle} and keeping fewer, achievable promises would have protected your position.', { leaderTitle: s.government.leaderTitle }));
  if (id === 'national_defeat' && (s.stats.maxDefense ?? 0) === 0) out.push(t('Defense & Cyber AI funding would have kept the balance of power from collapsing.'));
  return out.slice(0, 5);
}

function largestRiskSource(s: GameState): string {
  const entries = Object.entries(s.riskSources ?? {}).sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  if (!top) return '—';
  const [key] = top;
  if (key === 'domestic') return t('Domestic labs outpacing safeguards');
  if (key === 'tension') return t('Race tension');
  if (key === 'events') return t('Crises and decisions');
  if (key.startsWith('rival:')) {
    const rival = s.rivals.find((r) => r.id === key.slice(6));
    return rival ? t('{rival} racing ahead', { rival: rival.name }) : t('Foreign labs racing ahead');
  }
  if (key.startsWith('situation:')) return getSituationFlavor(key.slice(10) as SituationType).name;
  return key;
}

function threatSummary(s: GameState): string {
  const detected = s.situations.filter((x) => x.detected).length;
  const contained = s.situations.filter((x) => x.outcome === 'contained').length;
  const catastrophes = s.situations.filter((x) => x.outcome === 'catastrophe').length;
  const hidden = s.situations.length - detected;
  const parts = [t('{n} detected', { n: detected }), t('{n} contained', { n: contained }), tp(catastrophes, '{n} catastrophe', '{n} catastrophes')];
  if (hidden) parts.push(t('{n} never found', { n: hidden }));
  return parts.join(' · ');
}

function stats(s: GameState): EndingReport['stats'] {
  const st = s.stats;
  const n = (k: string) => String(st[k] ?? 0);
  return [
    { label: t('Quarters governed'), value: String(Math.min(s.turn, s.maxTurns)) },
    { label: t('Models approved'), value: String((st.approvals ?? 0) + (st.limitedApprovals ?? 0)) },
    { label: t('Models rejected'), value: n('rejections') },
    { label: t('Deep evaluations'), value: n('deepEvals') },
    { label: t('Investigations'), value: n('investigations') },
    { label: t('Threats'), value: threatSummary(s) },
    { label: t('Catastrophes'), value: n('catastrophes') },
    { label: t('Promises kept / broken'), value: `${n('demandsMet')} / ${n('demandsFailed')}` },
    { label: t('Final global risk (true)'), value: String(Math.round(s.risk)) },
    { label: t('Largest source of risk'), value: largestRiskSource(s) },
    { label: t('Safeguards vs. frontier'), value: t('{safeguards} vs {frontier}', { safeguards: round1(s.safeguards), frontier: round1(domesticBestC(s)) }) },
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

