/**
 * Quarterly headlines: triggered by what happened this quarter, plus era flavor.
 * Situation warning signals are emitted by the situations system and appear alongside these.
 */
import { getGenericHeadlines, getHeadlinesFor, getOutlets } from './content';
import { turnLog } from './log';
import { currentEra, domesticBestC, findCompany, findModel, findRival } from './query';
import { hashString } from './rng';
import { rng } from './rng';
import type { TickCtx } from './systems/tick';
import { fillTemplate, type TemplateCtx } from './template';
import type { CardContext, GameState, HeadlineTrigger, NewsItem, SectorId, Tone } from './types';
import { SECTORS } from './util';

const TONE: Record<HeadlineTrigger, Tone> = {
  rival_breakthrough: 'bad',
  domestic_breakthrough: 'good',
  model_release: 'neutral',
  model_approved: 'good',
  model_rejected: 'mixed',
  economy_up: 'good',
  economy_down: 'bad',
  stability_down: 'bad',
  jobs: 'bad',
  security_down: 'bad',
  adoption: 'neutral',
  accord_progress: 'good',
  accord_signed: 'good',
  tension_high: 'bad',
  election: 'neutral',
  situation_public: 'bad',
  policy_enacted: 'neutral',
  espionage: 'bad',
  calm: 'neutral',
};

const PRIORITY: HeadlineTrigger[] = [
  'accord_signed',
  'situation_public',
  'rival_breakthrough',
  'election',
  'espionage',
  'domestic_breakthrough',
  'policy_enacted',
  'model_approved',
  'model_rejected',
  'tension_high',
  'economy_down',
  'economy_up',
  'stability_down',
  'jobs',
  'security_down',
  'accord_progress',
  'adoption',
  'model_release',
];

function ctxFor(s: GameState, c: CardContext, policy?: string): TemplateCtx {
  const t: TemplateCtx = {};
  const model = findModel(s, c.modelId);
  const company = findCompany(s, c.companyId ?? model?.companyId);
  const rival = findRival(s, c.rivalId);
  const situation = c.situationId ? s.situations.find((x) => x.id === c.situationId) : undefined;
  if (model) t.model = model;
  if (company) t.company = company;
  if (rival) t.rival = rival;
  if (situation) t.situation = situation;
  const sector = c.sector ?? model?.sectors[0] ?? situation?.source.sector;
  if (sector) t.sector = sector;
  if (policy) t.policy = policy;
  return t;
}

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** One-off lines (headline templates, signals) are tracked by hash so a run never repeats them. */
export function lineUsed(s: GameState, line: string): boolean {
  return (s.usedLines ?? []).includes(hashString(line));
}

export function markLineUsed(s: GameState, line: string): void {
  s.usedLines = s.usedLines ?? [];
  const h = hashString(line);
  if (!s.usedLines.includes(h)) s.usedLines.push(h);
}

/** Headline templates for a trigger that fit the context and have not been used yet this run. */
function headlineOptions(s: GameState, trigger: HeadlineTrigger, tctx: TemplateCtx): string[] {
  let options = getHeadlinesFor(trigger).filter((h) => (tctx.sector || !h.includes('{sector}')) && (tctx.situation || !h.includes('{situation}')));
  // Never claim a rival "leads" when it is actually behind our best lab.
  if (trigger === 'rival_breakthrough' && tctx.rival && tctx.rival.capability <= domesticBestC(s)) {
    options = options.filter((h) => !/\b(lead|leads|leading|ahead|overtak\w*|surpass\w*|first place)\b/i.test(h));
  }
  const fresh = options.filter((h) => !lineUsed(s, h));
  return fresh.length ? fresh : [];
}

/** Publishes a triggered headline immediately (e.g. an election before its result). */
export function publishHeadline(s: GameState, trigger: HeadlineTrigger, ctx: CardContext = {}): void {
  const r = rng(s);
  const tctx = ctxFor(s, ctx);
  const tpl = r.pick(headlineOptions(s, trigger, tctx));
  if (!tpl) return;
  markLineUsed(s, tpl);
  s.news.push({ turn: s.turn, outlet: r.pick(getOutlets()) ?? 'Global Wire', text: capitalize(fillTemplate(s, tpl, tctx).trim()), tone: TONE[trigger] });
}

/** Adds this quarter's headlines to `s.news`; returns the items added. */
export function generateNews(s: GameState, tc: TickCtx, turn: number): NewsItem[] {
  const r = rng(s);
  const outlets = getOutlets();
  const recent = new Set(s.news.slice(-40).map((n) => n.text));
  const added: NewsItem[] = [];
  const push = (raw: string, tone: Tone) => {
    let text = raw;
    text = capitalize(text.trim());
    if (!text || recent.has(text)) return false;
    recent.add(text);
    const item: NewsItem = { turn, outlet: r.pick(outlets) ?? 'Global Wire', text, tone };
    s.news.push(item);
    added.push(item);
    return true;
  };

  const log = turnLog(s);
  const triggers: { trigger: HeadlineTrigger; ctx: CardContext; policy?: string }[] = [...log.triggers];
  if (tc.econDelta > 1.2) triggers.push({ trigger: 'economy_up', ctx: {} });
  if (tc.econDelta < -1.2) triggers.push({ trigger: 'economy_down', ctx: {} });
  if (tc.stabDelta < -1.5) triggers.push({ trigger: 'stability_down', ctx: {} });
  if (s.displacement > 30 && tc.adoptionDelta.business > 2) triggers.push({ trigger: 'jobs', ctx: {} });
  if (tc.secDelta < -1.5) triggers.push({ trigger: 'security_down', ctx: {} });
  const bigSector = SECTORS.find((k: SectorId) => tc.adoptionDelta[k] > 6);
  if (bigSector) triggers.push({ trigger: 'adoption', ctx: { sector: bigSector } });

  const seen = new Set<HeadlineTrigger>();
  const ordered = PRIORITY.flatMap((p) => triggers.filter((t) => t.trigger === p));
  for (const t of ordered) {
    if (added.length >= 3) break;
    if (seen.has(t.trigger)) continue;
    seen.add(t.trigger);
    const tctx = ctxFor(s, t.ctx, t.policy);
    const tpl = r.pick(headlineOptions(s, t.trigger, tctx));
    if (tpl && push(fillTemplate(s, tpl, tctx), TONE[t.trigger])) markLineUsed(s, tpl);
  }
  const generic = r.shuffle(getGenericHeadlines(currentEra(s)).filter((g) => !lineUsed(s, g)));
  const target = 3 + (r.chance(0.5) ? 1 : 0);
  for (const g of generic) {
    if (added.length >= target) break;
    if (push(fillTemplate(s, g, {}), 'neutral')) markLineUsed(s, g);
  }
  if (added.length === 0) {
    const calm = r.pick(getHeadlinesFor('calm'));
    if (calm) push(fillTemplate(s, calm, {}), 'neutral');
  }
  // Keep the feed bounded so saves stay small.
  if (s.news.length > 160) s.news = s.news.filter((n, i) => n.signal || i >= s.news.length - 120);
  return added;
}
