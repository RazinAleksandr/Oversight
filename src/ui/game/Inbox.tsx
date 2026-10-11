/**
 * Inbox: briefing list (paper slips on the desk), desk summary, End Quarter controls,
 * and the compact inbox stack used in the desktop side column.
 */
import type { JSX } from 'preact';
import type { Card, CardKind, Urgency } from '../../engine/types';
import { SOURCE_INFO } from '../../engine/labels';
import { Icon } from '../components/Icon';
import { Bar } from '../components/Bars';
import { EmptyState, Kbd, PageHead, Section } from '../components/Common';
import { cx } from '../util';
import { followableSignals, useGame } from './context';

export const KIND_LABEL: Record<CardKind, string> = {
  deployment: 'Deployment Request',
  demand: 'Government Demand',
  negotiation: 'Negotiation',
  situation: 'Situation Report',
  event: 'Briefing',
  election: 'Election',
  breakthrough: 'Breakthrough',
  treaty: 'Treaty',
  last_chance: 'Last Chance',
  threshold: 'The Threshold',
  intro: 'Welcome Briefing',
};

export const URGENCY_LABEL: Record<Urgency, string> = { routine: 'Routine', priority: 'Priority', critical: 'Critical' };

/** Demand titles may embed their deadline ("… by Q3 2028"); the UI shows the deadline separately. */
export const stripDeadline = (title: string) => title.replace(/\s*[,—–-]?\s*(by|before|until|due)\s+Q[1-4]\s+\d{4}\.?\s*$/i, '').trim() || title;

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
        aria-label={`${URGENCY_LABEL[card.urgency]} briefing from ${card.source.name}: ${card.title}`}
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
          <span class="btn--end__main">
            Resolve {n} briefing{n === 1 ? '' : 's'}
          </span>
          <span class="btn--end__sub">to end the quarter</span>
        </span>
      </button>
    );
  }
  return (
    <button type="button" data-nosfx class={cx('btn btn--primary btn--end', wide && 'btn--wide')} onClick={endQuarter}>
      <span class="btn--end__text">
        <span class="btn--end__main">End Quarter</span>
        <span class="btn--end__sub">{unused > 0 ? `${unused} action${unused === 1 ? '' : 's'} unused` : 'All actions spent'}</span>
      </span>
      <Kbd>Space</Kbd>
      <Icon name="chevron_right" size={20} />
    </button>
  );
}

export function InboxPanel(): JSX.Element {
  const { view, openCard } = useGame();
  return (
    <div class="page page--inbox">
      {view.finale ? (
        <PageHead title="The Threshold" sub="The transition has reached its decisive moment. One decision remains." />
      ) : (
        <PageHead title="Inbox" sub={`${view.dateLabel} · ${view.inbox.length ? `${view.inbox.length} briefing${view.inbox.length === 1 ? '' : 's'} awaiting decision` : 'desk clear'}`} />
      )}
      {view.warnings.length > 0 && (
        <ul class="warnings" aria-label="Warnings">
          {[...new Set(view.warnings.map(cleanWarning))].map((w) => (
            <li key={w} class={cx('warning', /critical|escalat|catastroph|crisis/i.test(w) ? 'warning--bad' : 'warning--warn')}>
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
        <EmptyState icon="check" title="Desk clear" text="Every briefing is resolved. Spend your remaining actions in Labs, Nation or World — then end the quarter." />
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
  return (
    <Section title="This quarter" icon="calendar" class="desk">
      <div class="desk__grid">
        <button type="button" class="desk__tile" onClick={() => goTab(view.unlockedTabs.includes('nation') ? 'nation' : 'labs')}>
          <span class="eyebrow">Actions left</span>
          <span class="desk__big num">
            {n.capacity}
            <small>/{n.capacityMax}</small>
          </span>
          <span class="desk__hint">Investigate, legislate, negotiate</span>
        </button>
        <button type="button" class="desk__tile" onClick={() => view.unlockedTabs.includes('threats') && goTab('threats')}>
          <span class="eyebrow">Detected threats</span>
          <span class={cx('desk__big num', threats.some((t) => t.escalationWarning) && 'is-bad')}>{threats.length}</span>
          <span class="desk__hint">{threats.filter((t) => t.escalationWarning).length ? `${threats.filter((t) => t.escalationWarning).length} escalating` : 'None escalating'}</span>
        </button>
        <div class="desk__tile">
          <span class="eyebrow">Evidence</span>
          <span class="desk__big num">{n.evidence.length}</span>
          <span class="desk__hint">Files for enforcement &amp; negotiation</span>
        </div>
      </div>
      {signals.length > 0 && (
        <button type="button" class="desk__signals" onClick={() => (view.unlockedTabs.includes('threats') ? goTab('threats') : openNews())}>
          <span class="desk__sigdot" aria-hidden="true">
            ◉
          </span>
          <span class="desk__sigtext">
            <strong>
              {signals.length} warning sign{signals.length === 1 ? '' : 's'} you can follow up
            </strong>
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
    <section class="side__inbox" aria-label="Inbox">
      <h2 class="side__title">
        <Icon name="inbox" size={16} /> Inbox <span class="num dim">{view.inbox.length}</span>
      </h2>
      {view.inbox.length ? (
        <ul class="slips slips--compact">
          {view.inbox.map((c, i) => (
            <InboxItem key={c.uid} card={c} index={i} compact onOpen={() => openCard(c.uid)} />
          ))}
        </ul>
      ) : (
        <p class="side__empty">
          <Icon name="check" size={15} /> Desk clear
        </p>
      )}
    </section>
  );
}
