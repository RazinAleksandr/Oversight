/**
 * Section navigation: bottom tab bar on phones, left rail on desktop (same component, CSS decides).
 * Only unlocked tabs are shown; a freshly unlocked tab glows until visited.
 */
import type { JSX } from 'preact';
import type { TabId } from '../../engine/types';
import { Icon, Portrait, Svg, artCached } from '../components/Icon';
import { t, tp } from '../../i18n';
import { DIFF_LABEL, cx, hueOf } from '../util';
import { useGame } from './context';

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'inbox', label: t('Inbox'), icon: 'inbox' },
  { id: 'labs', label: t('Labs'), icon: 'labs' },
  { id: 'nation', label: t('Nation'), icon: 'nation' },
  { id: 'world', label: t('World'), icon: 'world' },
  { id: 'threats', label: t('Threats'), icon: 'threats' },
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
    <nav class="tabbar" aria-label={t('Sections')}>
      <div class="tabbar__list" role="tablist">
        {TABS.filter((x) => view.unlockedTabs.includes(x.id)).map((x) => {
          const b = badge(x.id);
          const isFresh = fresh.includes(x.id);
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={tab === x.id}
              aria-controls="main"
              data-tab={x.id}
              data-nosfx
              class={cx('tab', tab === x.id && 'is-active', isFresh && 'tab--fresh')}
              onClick={() => onTab(x.id)}
            >
              <span class="tab__icon">
                <Icon name={x.icon} size={22} />
                {b && (
                  <span class={cx('tab__badge num', `tab__badge--${b.tone}`)} aria-label={tp(Number(b.n), '{n} item', '{n} items')}>
                    {b.n}
                  </span>
                )}
              </span>
              <span class="tab__label">{x.label}</span>
              {isFresh && <span class="tab__new">{t('New')}</span>}
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
                {DIFF_LABEL[view.difficulty] ?? view.difficulty} · #{view.seed}
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
