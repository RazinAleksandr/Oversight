/**
 * News: phone ticker strip (tap → full feed sheet) and the desktop side-column feed.
 * Signal items (possible warning signs) are subtly marked with a "signal" glyph.
 */
import type { JSX } from 'preact';
import type { NewsItem } from '../../engine/types';
import { dateLabel } from '../../engine/labels';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { costInline } from '../components/Common';
import { cx } from '../util';
import { followTarget, useGame } from './context';

export function NewsTicker({ news, onOpen }: { news: NewsItem[]; onOpen(): void }): JSX.Element | null {
  const { actions } = useGame();
  const items = news.slice(0, 6);
  if (!items.length) return null;
  const canFollow = (n: NewsItem) => {
    const f = followTarget(actions, n);
    return !!f && !f.target.disabled;
  };
  const followable = items.filter(canFollow).length;
  const line = (
    <>
      {items.map((n, i) => (
        <span key={i} class={cx('ticker__item', n.signal && 'is-signal')}>
          {n.signal && <span class="ticker__sig" aria-hidden="true">◉</span>}
          <span class="ticker__outlet">{n.outlet}</span> {n.text}
          {canFollow(n) && <span class="ticker__follow">Follow up ›</span>}
        </span>
      ))}
    </>
  );
  return (
    <button
      type="button"
      class={cx('ticker', followable > 0 && 'ticker--follow')}
      onClick={onOpen}
      aria-label={`News: ${items[0].text}.${followable ? ` ${followable} warning sign${followable === 1 ? '' : 's'} can be followed up.` : ''} Open news feed`}
    >
      <span class="ticker__tag">
        <Icon name="news" size={13} /> Live
      </span>
      <span class="ticker__viewport" aria-hidden="true">
        <span class="ticker__track" style={{ animationDuration: `${Math.max(28, items.length * 9)}s` }}>
          {line}
          {line}
        </span>
      </span>
    </button>
  );
}

/** "Follow up" control for a signal headline (follow_signal action), or the reason it is unavailable. */
export function FollowUp({ n, compact }: { n: NewsItem; compact?: boolean }): JSX.Element | null {
  const { actions, openAction } = useGame();
  const f = followTarget(actions, n);
  if (!f) return null;
  const blocked = f.target.disabled || f.action.disabled || null;
  if (blocked && /already/i.test(blocked))
    return (
      <span class="followup-done">
        <Icon name="check" size={12} /> {blocked}
      </span>
    );
  return (
    <button
      type="button"
      class={cx('followup', blocked && 'is-blocked', compact && 'followup--compact')}
      onClick={() => openAction('follow_signal', n.id)}
      aria-label={`Follow up this warning sign${blocked ? ', unavailable: ' + blocked : ', costs ' + costInline(f.action.cost)}`}
    >
      <Icon name="investigate" size={14} />
      <span>Follow up</span>
      <span class="followup__cost num">{costInline(f.action.cost)}</span>
    </button>
  );
}

export function NewsList({ news, limit }: { news: NewsItem[]; limit?: number }): JSX.Element {
  const items = limit ? news.slice(0, limit) : news;
  let lastTurn = -1;
  return (
    <ul class="newslist">
      {items.map((n, i) => {
        const head = n.turn !== lastTurn;
        lastTurn = n.turn;
        return (
          <li key={i} class={cx('newsitem', n.signal && 'newsitem--signal', `newsitem--${n.tone}`)}>
            {head && <span class="newsitem__date num">{n.turn > 0 ? dateLabel(n.turn) : 'Before you took office'}</span>}
            <span class="newsitem__outlet">
              {n.signal && (
                <span class="newsitem__sig" title="Possible warning sign">
                  ◉ signal
                </span>
              )}
              {n.outlet}
            </span>
            <span class="newsitem__text">{n.text}</span>
            {n.signal && <FollowUp n={n} />}
          </li>
        );
      })}
    </ul>
  );
}

export function NewsSheet({ news, onClose }: { news: NewsItem[]; onClose(): void }): JSX.Element {
  return (
    <Sheet label="News feed" onClose={onClose} class="news-sheet">
      <header class="detail__head">
        <span class="detail__icon is-accent">
          <Icon name="news" size={24} />
        </span>
        <div class="detail__title">
          <p class="eyebrow">Media monitor</p>
          <h2>News feed</h2>
        </div>
      </header>
      <p class="dim small">
        Items marked <span class="sigmark">◉ signal</span> may be early warning signs. Most are noise. Some are not — following one up costs an action and may expose a threat early.
      </p>
      <NewsList news={news} />
    </Sheet>
  );
}
