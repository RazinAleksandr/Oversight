/**
 * Section navigation: bottom tab bar on phones, left rail on desktop (same component, CSS decides).
 * Only unlocked tabs are shown; a freshly unlocked tab glows until visited.
 */
import type { JSX } from 'preact';
import type { TabId } from '../../engine/types';
import { Icon, Portrait, Svg, artCached } from '../components/Icon';
import { cx, hueOf } from '../util';
import { useGame } from './context';

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: 'inbox' },
  { id: 'labs', label: 'Labs', icon: 'labs' },
  { id: 'nation', label: 'Nation', icon: 'nation' },
  { id: 'world', label: 'World', icon: 'world' },
  { id: 'threats', label: 'Threats', icon: 'threats' },
];

export function TabBar({ tab, onTab, fresh }: { tab: TabId; onTab(t: TabId): void; fresh: TabId[] }): JSX.Element {
  const { view, desktop } = useGame();
  const active = view.situations.filter((s) => !s.resolved);
  const escalating = active.some((s) => s.escalationWarning || s.stage >= 3);
  const badge = (id: TabId): { n: number | string; tone: string } | null => {
    if (id === 'inbox' && view.inbox.length) {
      const crit = view.inbox.some((c) => c.urgency === 'critical');
      return { n: view.inbox.length, tone: crit ? 'bad' : 'accent' };
    }
    if (id === 'threats' && active.length) return { n: active.length, tone: escalating ? 'bad' : 'warn' };
    return null;
  };
  return (
    <nav class="tabbar" aria-label="Sections">
      <div class="tabbar__list" role="tablist">
        {TABS.filter((t) => view.unlockedTabs.includes(t.id)).map((t) => {
          const b = badge(t.id);
          const isFresh = fresh.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="main"
              data-tab={t.id}
              data-nosfx
              class={cx('tab', tab === t.id && 'is-active', isFresh && 'tab--fresh')}
              onClick={() => onTab(t.id)}
            >
              <span class="tab__icon">
                <Icon name={t.icon} size={22} />
                {b && (
                  <span class={cx('tab__badge num', `tab__badge--${b.tone}`)} aria-label={`${b.n} items`}>
                    {b.n}
                  </span>
                )}
              </span>
              <span class="tab__label">{t.label}</span>
              {isFresh && <span class="tab__new">New</span>}
            </button>
          );
        })}
      </div>
      {desktop && (
        <div class="rail__foot">
          <div class="rail__country">
            <Svg class="rail__emblem" html={artCached.emblem(view.country.id, 40)} />
            <div>
              <div class="rail__cname">{view.country.name}</div>
              <div class="rail__seed num">
                {view.difficulty} · #{view.seed}
              </div>
            </div>
          </div>
          <div class="rail__leader">
            <Portrait seed={view.government.portraitSeed} role="leader" size={34} name={view.government.leaderName} hue={hueOf(view.country.color)} />
            <div>
              <div class="rail__lname">{view.government.leaderName}</div>
              <div class="rail__ltitle">
                {view.government.leaderTitle} · {view.government.stanceLabel}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
