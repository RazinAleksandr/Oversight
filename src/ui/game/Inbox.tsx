/**
 * Inbox: briefing list (paper slips on the desk), desk summary, End Quarter controls,
 * and the compact inbox stack used in the desktop side column.
 */
import type { JSX } from 'preact';
import type { Card, CardKind, Urgency } from '../../engine/types';
import { SOURCE_INFO } from '../../engine/labels';
import { t, tp } from '../../i18n';
import { Icon } from '../components/Icon';
import { Bar } from '../components/Bars';
import { EmptyState, Kbd, PageHead, Section } from '../components/Common';
import { cx } from '../util';
import { followableSignals, useGame } from './context';

export const KIND_LABEL: Record<CardKind, string> = {
  deployment: t('Deployment Request'),
  demand: t('Government Demand'),
  negotiation: t('Negotiation'),
  situation: t('Situation Report'),
  event: t('Briefing'),
  election: t('Election'),
  breakthrough: t('Breakthrough'),
  treaty: t('Treaty'),
  last_chance: t('Last Chance'),
  threshold: t('The Threshold'),
  intro: t('Welcome Briefing'),
};

export const URGENCY_LABEL: Record<Urgency, string> = { routine: t('Routine'), priority: t('Priority'), critical: t('Critical') };

/**
 * Demand titles may embed their deadline ("… by Q3 2028", ru «… к 3 кв. 2028»); the UI shows the
 * deadline separately. Styling only — the title itself is engine text.
 */
export const stripDeadline = (title: string) =>
  title
    .replace(/\s*[,—–-]?\s*(by|before|until|due)\s+Q[1-4]\s+\d{4}\.?\s*$/i, '')
    .replace(/\s*[,—–-]?\s*(к|до|не позднее)\s+[1-4]\s*кв\.\s*\d{4}\s*(г\.)?\.?\s*$/i, '')
    .trim() || title;

/** Engine warnings that read as alarms (styling only; engine text in either language). */
export const isAlarmWarning = (w: string) => /critical|escalat|catastroph|crisis|критич|эскалац|катастроф|кризис/i.test(w);

/** Engine warnings may carry their own glyph; the UI renders an icon instead. */
export const cleanWarning = (w: string) => w.replace(/^[\u26a0\ufe0f!\s]+/u, '');

export const isAiCard = (c: Card) => !!c.tags?.includes('ai') || c.source.type === 'ai';
export const isCrisisCard = (c: Card) => !!c.tags?.includes('crisis') || c.urgency === 'critical';

export function InboxItem({ card, index, compact, onOpen }: { card: Card; index: number; compact?: boolean; onOpen(): void }): JSX.Element {
  const src = SOURCE_INFO[card.source.type];
  return (
    <li class="slip-wrap" style={{ '--tilt': `${index % 2 ? 0.35 : -0.3}deg` }}>
      <button
        type="button"
        data-nosfx
        data-card={card.uid}
        class={cx('slip', `slip--${card.urgency}`, compact && 'slip--compact', isAiCard(card) && card.kind !== 'threshold' && 'slip--ai', isCrisisCard(card) && 'slip--crisis', card.kind === 'threshold' && 'slip--threshold')}
        onClick={onOpen}
        aria-label={t('{urgency} briefing from {source}: {title}', { urgency: URGENCY_LABEL[card.urgency], source: card.source.name, title: card.title })}
      >
        <span class="slip__strip" aria-hidden="true" />
        <span class="slip__top">
          <span class="slip__src">
            <Icon name={src.icon} size={14} />
            <span class="slip__srcname">{card.source.name}</span>
          </span>
          <span class={cx('slip__urg', `slip__urg--${card.urgency}`)}>{URGENCY_LABEL[card.urgency]}</span>
        </span>
        <span class="slip__title">{card.title}</span>
        <span class="slip__sub">{card.subtitle ?? KIND_LABEL[card.kind]}</span>
        <span class="slip__go" aria-hidden="true">
          <Icon name="chevron_right" size={18} />
        </span>
      </button>
    </li>
  );
}

export function EndQuarterButton({ wide }: { wide?: boolean }): JSX.Element {
  const { view, endQuarter, goTab } = useGame();
  const n = view.inbox.length;
  const unused = view.nation.capacity;
  if (view.gameOver) return <></>;
  if (!view.canEndTurn) {
    return (
      <button type="button" class={cx('btn btn--end is-blocked', wide && 'btn--wide')} aria-disabled="true" onClick={() => goTab('inbox')}>
        <Icon name="inbox" size={18} />
        <span class="btn--end__text">
          <span class="btn--end__main">{tp(n, 'Resolve {n} briefing', 'Resolve {n} briefings')}</span>
          <span class="btn--end__sub">{t('to end the quarter')}</span>
        </span>
      </button>
    );
  }
  return (
    <button type="button" data-nosfx class={cx('btn btn--primary btn--end', wide && 'btn--wide')} onClick={endQuarter}>
      <span class="btn--end__text">
        <span class="btn--end__main">{t('End Quarter')}</span>
        <span class="btn--end__sub">{unused > 0 ? tp(unused, '{n} action unused', '{n} actions unused') : t('All actions spent')}</span>
      </span>
      <Kbd>{t('Space')}</Kbd>
      <Icon name="chevron_right" size={20} />
    </button>
  );
}

export function InboxPanel(): JSX.Element {
  const { view, openCard } = useGame();
  return (
    <div class="page page--inbox">
      {view.finale ? (
        <PageHead title={t('The Threshold')} sub={t('The transition has reached its decisive moment. One decision remains.')} />
      ) : (
        <PageHead
          title={t('Inbox')}
          sub={`${view.dateLabel} · ${view.inbox.length ? tp(view.inbox.length, '{n} briefing awaiting decision', '{n} briefings awaiting decision') : t('desk clear')}`}
        />
      )}
      {view.warnings.length > 0 && (
        <ul class="warnings" aria-label={t('Warnings')}>
          {[...new Set(view.warnings.map(cleanWarning))].map((w) => (
            <li key={w} class={cx('warning', isAlarmWarning(w) ? 'warning--bad' : 'warning--warn')}>
              <Icon name="warning" size={15} />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
      {view.inbox.length ? (
        <ul class="slips">
          {view.inbox.map((c, i) => (
            <InboxItem key={c.uid} card={c} index={i} onOpen={() => openCard(c.uid)} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="check" title={t('Desk clear')} text={t('Every briefing is resolved. Spend your remaining actions in Labs, Nation or World — then end the quarter.')} />
      )}
      <DeskSummary />
    </div>
  );
}

/** "This quarter" overview — actions left, demands, threats — so the inbox doubles as a status desk. */
function DeskSummary(): JSX.Element {
  const { view, actions, goTab, openNews } = useGame();
  const signals = followableSignals(view, actions);
  const n = view.nation;
  const demands = view.government.demands.filter((d) => d.status === 'active');
  const threats = view.situations.filter((s) => !s.resolved);
  const escalating = threats.filter((x) => x.escalationWarning).length;
  return (
    <Section title={t('This quarter')} icon="calendar" class="desk">
      <div class="desk__grid">
        <button type="button" class="desk__tile" onClick={() => goTab(view.unlockedTabs.includes('nation') ? 'nation' : 'labs')}>
          <span class="eyebrow">{t('Actions left')}</span>
          <span class="desk__big num">
            {n.capacity}
            <small>/{n.capacityMax}</small>
          </span>
          <span class="desk__hint">{t('Investigate, legislate, negotiate')}</span>
        </button>
        <button type="button" class="desk__tile" onClick={() => view.unlockedTabs.includes('threats') && goTab('threats')}>
          <span class="eyebrow">{t('Detected threats')}</span>
          <span class={cx('desk__big num', threats.some((t) => t.escalationWarning) && 'is-bad')}>{threats.length}</span>
          <span class="desk__hint">{escalating ? tp(escalating, '{n} escalating', '{n} escalating') : t('None escalating')}</span>
        </button>
        <div class="desk__tile">
          <span class="eyebrow">{t('Evidence')}</span>
          <span class="desk__big num">{n.evidence.length}</span>
          <span class="desk__hint">{t('Files for enforcement & negotiation')}</span>
        </div>
      </div>
      {signals.length > 0 && (
        <button type="button" class="desk__signals" onClick={() => (view.unlockedTabs.includes('threats') ? goTab('threats') : openNews())}>
          <span class="desk__sigdot" aria-hidden="true">
            ◉
          </span>
          <span class="desk__sigtext">
            <strong>{tp(signals.length, '{n} warning sign you can follow up', '{n} warning signs you can follow up')}</strong>
            <span>“{signals[0].text}”</span>
          </span>
          <Icon name="chevron_right" size={18} />
        </button>
      )}
      {demands.length > 0 && (
        <ul class="desk__demands">
          {demands.map((d) => (
            <li key={d.id} class="desk__demand">
              <div class="desk__demandtop">
                <span class="desk__demandtitle">
                  <Icon name="government" size={14} /> {stripDeadline(d.title)}
                </span>
                <span class="num dim desk__due">{d.deadlineLabel}</span>
              </div>
              <Bar value={d.progress * 100} tone="gov" thin label={d.progressLabel} />
              <span class="desk__demandlbl num">{d.progressLabel}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Desktop side column: compact stack of pending briefings. */
export function InboxStack(): JSX.Element {
  const { view, openCard } = useGame();
  return (
    <section class="side__inbox" aria-label={t('Inbox')}>
      <h2 class="side__title">
        <Icon name="inbox" size={16} /> {t('Inbox')} <span class="num dim">{view.inbox.length}</span>
      </h2>
      {view.inbox.length ? (
        <ul class="slips slips--compact">
          {view.inbox.map((c, i) => (
            <InboxItem key={c.uid} card={c} index={i} compact onOpen={() => openCard(c.uid)} />
          ))}
        </ul>
      ) : (
        <p class="side__empty">
          <Icon name="check" size={15} /> {t('Desk clear')}
        </p>
      )}
    </section>
  );
}
