import type { JSX } from 'preact';
import type { DemandView } from '../../engine/types';
import { t } from '../../i18n';
import { money } from '../util';

export function DemandForecast({ forecast: f }: { forecast: NonNullable<DemandView['forecast']> }): JSX.Element {
  const format = (value: number) => f.metric === 'budget' ? money(value) : f.metric === 'adoption' ? `${value.toFixed(1)}%` : t('L{n}', { n: value });
  return <div class="demand__forecast">
    <strong>{t('At the deadline')}</strong>
    <p>{t('Now {current} · target {target}', { current: format(f.current), target: format(f.target) })}</p>
    {f.currentOrder !== undefined && <p>{t('Current adoption order: {value}', { value: format(f.currentOrder) })}</p>}
    <p>{f.projected === null
      ? t('Current funding runs short before the deadline. Programs may be cut automatically.')
      : t('Projected {value} after {n} quarter-end checks.', { value: format(f.projected), n: f.quarters })}</p>
    {f.projected !== null && <p>{f.projected >= f.target ? t('On course to meet this target under these assumptions.') : t('Below target under these assumptions. Further action is needed.')}</p>}
    <p class="dim small">{t('Assumes unchanged income and funding. Known upkeep waivers expire on schedule. Spending, events and policy changes can alter the result.')}</p>
  </div>;
}
