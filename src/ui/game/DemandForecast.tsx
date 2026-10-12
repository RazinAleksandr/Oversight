import type { JSX } from 'preact';
import type { DemandView } from '../../engine/types';
import { locale, t } from '../../i18n';
import { money } from '../util';

export function DemandForecast({ forecast: f }: { forecast: NonNullable<DemandView['forecast']> }): JSX.Element {
  const format = (value: number) => f.metric === 'budget' ? money(value) : f.metric === 'adoption' ? `${value.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1})}%` : t('L{n}', { n: value });
  return <section class="demand__forecast forecast-v4" aria-label={t('At the deadline')}>
    <dl class="forecast-v4__values"><div><dt>{t('Current')}</dt><dd>{format(f.current)}</dd></div><div><dt>{t('Target')}</dt><dd>{format(f.target)}</dd></div><div class={f.projected!==null&&f.projected>=f.target?'is-good':'is-warn'}><dt>{t('At the deadline')}</dt><dd>{f.projected===null?'—':format(f.projected)}</dd></div></dl>
    <p class="forecast-v4__verdict">{f.projected===null?t('Current funding runs short before the deadline. Programs may be cut automatically.'):f.projected>=f.target?t('On course to meet this target under these assumptions.'):t('Below target under these assumptions. Further action is needed.')}</p>
    {f.currentOrder !== undefined && <p>{t('Current adoption order: {value}', { value: format(f.currentOrder) })}</p>}
    {f.projected!==null && <p>{t('Projected {value} after {n} quarter-end checks.',{value:format(f.projected),n:f.quarters})}</p>}
    <details class="forecast-v4__assumptions"><summary>{t('Forecast assumptions')}</summary><p>{t('Assumes unchanged income and funding. Known upkeep waivers expire on schedule. Spending, events and policy changes can alter the result.')}</p></details>
  </section>;
}
