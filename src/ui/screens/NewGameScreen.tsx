/**
 * New game: country select (four dossier-like cards) + difficulty + start.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { CountryId, Difficulty } from '../../engine/types';
import { COUNTRY_ORDER } from '../../content/countries';
import { Icon, Svg, artCached } from '../components/Icon';
import { countryCard } from '../countries';
import { cx, dailySeed } from '../util';
import { useHeightVar } from '../hooks';

const DIFFICULTIES: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'analyst', name: 'Analyst', desc: 'Clearer signals, gentler politics, slower risk.' },
  { id: 'director', name: 'Director', desc: 'The intended experience. Hard but fair.' },
  { id: 'doomer', name: 'Doomer', desc: 'Noisy evidence, relentless demands, faster risk.' },
];

const ORDER: CountryId[] = COUNTRY_ORDER.length ? COUNTRY_ORDER : ['atlantic', 'hanzhou', 'commonwealth', 'meridian'];

const START_LABEL = { confidence: 'Conf', economy: 'Pros', stability: 'Stab', security: 'Sec' } as const;

export function NewGameScreen({ daily, onBack, onStart }: { daily: boolean; onBack(): void; onStart(c: CountryId, d: Difficulty): void }): JSX.Element {
  const [country, setCountry] = useState<CountryId | null>(null);
  const [diff, setDiff] = useState<Difficulty>('director');
  const chosen = country ? countryCard(country) : null;
  const dockRef = useHeightVar<HTMLDivElement>('--dock-h');
  const diffDesc = DIFFICULTIES.find((d) => d.id === (daily ? 'director' : diff))?.desc;
  return (
    <div class="screen newgame">
      <header class="screen-head">
        <button type="button" class="iconbtn" onClick={onBack} aria-label="Back to title">
          <Icon name="back" size={20} />
        </button>
        <div>
          <p class="eyebrow">{daily ? `Daily Run · seed #${dailySeed()}` : 'New run'}</p>
          <h1 class="screen-head__title">Choose your nation</h1>
        </div>
      </header>

      <div class="countries" role="radiogroup" aria-label="Country">
        {ORDER.map((id) => {
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
                  <span class="country__leader">Led by the {c.leaderTitle}</span>
                </span>
                <span class="country__check" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
              </span>
              <span class="country__tagline">{c.tagline}</span>
              <span class="country__traits">
                <span class="ctrait ctrait--plus">
                  <b>+ {c.traitPlus.name}</b>
                  <span>{c.traitPlus.text}</span>
                </span>
                <span class="ctrait ctrait--minus">
                  <b>− {c.traitMinus.name}</b>
                  <span>{c.traitMinus.text}</span>
                </span>
              </span>
              <span class="country__more">
                <span class="country__lists">
                  <span class="clist clist--pros">
                    <span class="eyebrow">Strengths</span>
                    {c.strengths.slice(0, 4).map((s) => (
                      <span key={s} class="clist__item">
                        {s}
                      </span>
                    ))}
                  </span>
                  <span class="clist clist--cons">
                    <span class="eyebrow">Weaknesses</span>
                    {c.weaknesses.slice(0, 4).map((s) => (
                      <span key={s} class="clist__item">
                        {s}
                      </span>
                    ))}
                  </span>
                </span>
                <span class="country__start">
                  {(Object.keys(START_LABEL) as (keyof typeof START_LABEL)[]).map((k) => (
                    <span key={k} class="cstart">
                      <span class="cstart__k">{START_LABEL[k]}</span>
                      <span class="cstart__v num">{c.start[k]}</span>
                      <span class="cstart__bar">
                        <i style={{ width: `${c.start[k]}%` }} />
                      </span>
                    </span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div class="newgame__dock" ref={dockRef}>
      <section class="difficulty" aria-label="Difficulty">
        <h2 class="eyebrow">Difficulty</h2>
        <div class="seg seg--diff" role="radiogroup" aria-label="Difficulty">
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
          <p class="difficulty__daily">Daily runs are always played on Director, so everyone faces the same world.</p>
        ) : (
          <p class="difficulty__desc">{diffDesc}</p>
        )}
      </section>

      <div class="newgame__start">
        <button type="button" class="btn btn--primary btn--xl btn--wide" disabled={!country} onClick={() => country && onStart(country, daily ? 'director' : diff)}>
          {chosen ? `Take office — ${chosen.shortName ?? chosen.name}` : 'Select a nation'}
          <Icon name="chevron_right" size={20} />
        </button>
      </div>
      </div>
    </div>
  );
}
