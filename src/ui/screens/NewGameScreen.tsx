/**
 * New game: country select (four dossier-like cards) + difficulty + start.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { CountryId, Difficulty } from '../../engine/types';
import { COUNTRY_ORDER } from '../../content/countries';
import { t } from '../../i18n';
import { Icon, Svg, artCached } from '../components/Icon';
import { countryCard } from '../countries';
import { DIFF_LABEL, cx, dailySeed } from '../util';

const DIFFICULTIES: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'analyst', name: DIFF_LABEL.analyst, desc: t('Clearer signals, gentler politics, slower risk.') },
  { id: 'director', name: DIFF_LABEL.director, desc: t('The intended experience. Hard but fair.') },
  { id: 'doomer', name: DIFF_LABEL.doomer, desc: t('Noisy evidence, relentless demands, faster risk.') },
];

const ORDER: CountryId[] = COUNTRY_ORDER.length ? COUNTRY_ORDER : ['atlantic', 'hanzhou', 'commonwealth', 'meridian'];

const START_LABEL = { confidence: t('Conf'), economy: t('Pros'), stability: t('Stab'), security: t('Sec') };

export function NewGameScreen({ daily, onBack, onStart }: { daily: boolean; onBack(): void; onStart(c: CountryId, d: Difficulty): void }): JSX.Element {
  const [country, setCountry] = useState<CountryId | null>('commonwealth');
  const [diff, setDiff] = useState<Difficulty>(daily ? 'director' : 'analyst');
  const chosen = country ? countryCard(country) : null;
  const diffDesc = DIFFICULTIES.find((d) => d.id === (daily ? 'director' : diff))?.desc;
  return (
    <div class="screen newgame">
      <header class="screen-head">
        <button type="button" class="iconbtn" onClick={onBack} aria-label={t('Back to title')}>
          <Icon name="back" size={20} />
        </button>
        <div>
          <p class="eyebrow">{daily ? t('Daily Run · seed #{seed}', { seed: dailySeed() }) : t('New run')}</p>
          <h1 class="screen-head__title">{t('Choose your nation')}</h1>
        </div>
      </header>

      {!daily && <p class="newgame__guidance">{t('First run? Commonwealth on Analyst gives you more room to learn. You can change either below.')}</p>}
      <div class="countries" role="radiogroup" aria-label={t('Country')}>
        {[...ORDER].sort((a,b) => Number(b === 'commonwealth') - Number(a === 'commonwealth')).map((id) => {
          const c = countryCard(id);
          const sel = id === country;
          return (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={sel}
              class={cx('country', sel && 'is-selected', country && !sel && 'is-dimmed')}
              style={{ '--c1': c.color, '--c2': c.color2 }}
              onClick={() => setCountry(id)}
              data-country={id}
            >
              <span class="country__band" aria-hidden="true" />
              <span class="country__head">
                <Svg class="country__emblem" html={artCached.emblem(id, 56)} />
                <span class="country__id">
                  <span class="country__name">{c.name}</span>
                  <span class="country__leader">{t('Led by the {title}', { title: c.leaderTitle })}</span>
                </span>
                <span class="country__check" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
              </span>
              <span class="country__tagline">{c.tagline}</span>

            </button>
          );
        })}
      </div>

      {chosen && <details class="country-detail"><summary>{t('Nation details')} · {chosen.shortName ?? chosen.name}</summary>
        <p><strong>{chosen.traitPlus.name}</strong> — {chosen.traitPlus.text}</p>
        <p><strong>{chosen.traitMinus.name}</strong> — {chosen.traitMinus.text}</p>
        <h3>{t('Strengths')}</h3><ul>{chosen.strengths.map(x => <li key={x}>{x}</li>)}</ul>
        <h3>{t('Weaknesses')}</h3><ul>{chosen.weaknesses.map(x => <li key={x}>{x}</li>)}</ul>
        <div class="country__start">{(Object.keys(START_LABEL) as (keyof typeof START_LABEL)[]).map(k => <span key={k}>{START_LABEL[k]} {chosen.start[k]}</span>)}</div>
      </details>}
      <div class="newgame__dock">
      <section class="difficulty" aria-label={t('Difficulty')}>
        <h2 class="eyebrow">{t('Difficulty')}</h2>
        <div class="seg seg--diff" role="radiogroup" aria-label={t('Difficulty')}>
          {DIFFICULTIES.map((d) => (
            <button
              type="button"
              key={d.id}
              role="radio"
              aria-checked={d.id === diff}
              class={cx('seg__opt', d.id === diff && 'is-on', `seg__opt--${d.id}`)}
              disabled={daily && d.id !== 'director'}
              onClick={() => setDiff(d.id)}
            >
              <span class="seg__label">{d.name}</span>
              <span class="seg__desc">{d.desc}</span>
            </button>
          ))}
        </div>
        {daily ? (
          <p class="difficulty__daily">{t('Daily runs are always played on Director, so everyone faces the same world.')}</p>
        ) : (
          <p class="difficulty__desc">{diffDesc}</p>
        )}
      </section>

      <div class="newgame__start">
        <button type="button" class="btn btn--primary btn--xl btn--wide" disabled={!country} onClick={() => country && onStart(country, daily ? 'director' : diff)}>
          {chosen ? t('Take office — {country}', { country: chosen.shortName ?? chosen.name }) : t('Select a nation')}
          <Icon name="chevron_right" size={20} />
        </button>
      </div>
      </div>
    </div>
  );
}
