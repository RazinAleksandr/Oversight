/**
 * Ending / Debrief: illustration, title, sequential epilogue, rating & dimension grades,
 * decisive moments, hidden truths, warning signs, missed opportunities, stats, seed & replay.
 */
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { EndingReport } from '../../engine/types';
import { audio } from '../../audio';
import { fx } from '../../fx';
import { t } from '../../i18n';
import { Bar } from '../components/Bars';
import { Section } from '../components/Common';
import { Icon, Svg, artCached, isPlaceholder } from '../components/Icon';
import { countryCard } from '../countries';
import { DIFF_LABEL, cx, toneClass } from '../util';

const SCORE_LABEL = { control: t('Control'), prosperity: t('Prosperity'), security: t('Security'), legitimacy: t('Legitimacy') };
const SCORE_ICON = { control: 'safeguards', prosperity: 'economy', security: 'security', legitimacy: 'confidence' } as const;
const TRUTH_LABEL = { company: t('Companies'), model: t('Models'), rival: t('Rivals'), violation: t('Violations') };

const gradeTone = (g: string) => (/^[SA]/.test(g) ? 'good' : /^B/.test(g) ? 'accent' : /^C/.test(g) ? 'warn' : 'bad');

export function EndingScreen({ ending, onReplay, onNew, onTitle }: { ending: EndingReport; onReplay(): void; onNew(): void; onTitle(): void }): JSX.Element {
  const good = ending.category === 'survival' && ending.tone !== 'bad';
  const [shown, setShown] = useState(ending.epilogue.length);
  const [section, setSection] = useState('epilogue');
  const navigationRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [navigated, setNavigated] = useState(false);
  useLayoutEffect(() => {
    if (navigated) {
      contentRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
      contentRef.current?.focus({ preventScroll: true });
    }
  }, [section, navigated]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // setMood plays its own stinger.
    audio.setMood(good ? 'ending_good' : 'ending_bad');
    try {
      if (good) fx.burst(window.innerWidth / 2, window.innerHeight * 0.28, { color: '#e8c169', count: 60, spread: 1.4 });
      else fx.vignette('#ff4d5e', 1600);
    } catch {
      /* optional */
    }
    window.scrollTo({ top: 0 });
  }, []);

  // Reveal epilogue paragraphs one by one.
  useEffect(() => {
    if (shown >= ending.epilogue.length) return;
    const timer = window.setTimeout(() => setShown((n) => n + 1), 2200);
    return () => window.clearTimeout(timer);
  }, [shown]);

  const country = countryCard(ending.countryId);
  const truths = (Object.keys(TRUTH_LABEL) as (keyof typeof TRUTH_LABEL)[]).map((k) => ({ k, items: ending.hiddenTruths.filter((h) => h.category === k) })).filter((g) => g.items.length);
  const acted = ending.warningSigns.filter((w) => w.actedOn).length;

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(ending.seed));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div class={cx('screen ending', good ? 'ending--good' : 'ending--bad')}>
      <div class="ending__sky" aria-hidden="true" />
      <article class="ending__inner">
        <header class="ending__hero">
          <div class="ending__art">{!isPlaceholder(artCached.ending(ending.tone, 720)) ? <Svg html={artCached.ending(ending.tone, 720)} label={ending.title} /> : <div class="ending__artfallback" aria-hidden="true" />}</div>
          <p class={cx('ending__cat', good ? 'is-good' : 'is-bad')}>
            {ending.category === 'survival' ? t('Survival') : t('Failure')} · {ending.dateLabel} · {country.name}
          </p>
          <h1 class="ending__title">{ending.title}</h1>
          <p class="ending__subtitle">{ending.subtitle}</p>
        </header>

        <nav ref={navigationRef} tabIndex={-1} class="panel-sections ending__nav" aria-label={t('Debrief sections')}>
          <label for="debrief-section">{t('Debrief sections')}</label>
          <select id="debrief-section" value={section} onChange={e => { setNavigated(true); setSection(e.currentTarget.value); }}>
          {[
            ['epilogue', t('Epilogue')], ['rating', t('Rating')],
            ...(ending.decisiveMoments.length ? [['moments', t('Decisive moments')]] : []),
            ...(truths.length ? [['truths', t('Hidden truths')]] : []),
            ...(ending.warningSigns.length ? [['warnings', t('Warning signs')]] : []),
            ...(ending.missed.length ? [['missed', t('Missed opportunities')]] : []),
            ...(ending.stats.length ? [['stats', t('By the numbers')]] : []),
          ].map(([id, label]) => <option value={id}>{label}</option>)}
          </select>
        </nav>

        <div ref={contentRef} tabIndex={-1} class="ending__section">
        {navigated && <button type="button" class="btn btn--small" onClick={() => { navigationRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); navigationRef.current?.focus({ preventScroll: true }); }}>{t('Debrief sections')}</button>}
        {section === 'epilogue' && <section class="epilogue" aria-label={t('Epilogue')} onClick={() => setShown(ending.epilogue.length)}>
          {ending.epilogue.slice(0, shown).map((p, i) => (
            <p key={i} class="epilogue__p">
              {p}
            </p>
          ))}
          {shown < ending.epilogue.length && (
            <button type="button" class="linkbtn epilogue__more" onClick={() => setShown(ending.epilogue.length)}>
              {t('Reveal all')}
            </button>
          )}
        </section>}

        {section === 'rating' && <><p class="ending__rating-note">{ending.category === 'failure'
          ? t('The overall grade reflects how the run ended. Global failures receive F; other failures receive D after 12 quarters, otherwise F. The four scores describe individual outcomes and are not averaged for a failed run.')
          : t('The overall grade uses the average of the four scores. A governed transition with an average of at least 80 earns S. Other grades: A at 70, B at 58, C at 46, otherwise D.')}</p><section class="scorecard" aria-label={t('Rating')}>
          <div class={cx('rating', `rating--${gradeTone(ending.rating)}`)}>
            <span class="eyebrow">{t('Overall')}</span>
            <span class="rating__letter">{ending.rating}</span>
            <span class="rating__sub">{DIFF_LABEL[ending.difficulty]}</span>
          </div>
          <ul class="scores">
            {(Object.keys(SCORE_LABEL) as (keyof typeof SCORE_LABEL)[]).map((k) => {
              const s = ending.scores[k];
              const tone = gradeTone(s.grade);
              return (
                <li key={k} class="score">
                  <span class="score__k">
                    <Icon name={SCORE_ICON[k]} size={15} /> {SCORE_LABEL[k]}
                  </span>
                  <Bar value={s.value} tone={tone as 'good'} label={`${SCORE_LABEL[k]} ${s.value}`} />
                  <span class="score__v num">{Math.round(s.value)}</span>
                  <span class={cx('score__grade', `is-${tone}`)}>{s.grade}</span>
                </li>
              );
            })}
          </ul>
        </section></>}

        {section === 'moments' && ending.decisiveMoments.length > 0 && (
          <Section title={t('Decisive moments')} icon="flag">
            <ol class="timeline">
              {ending.decisiveMoments.map((m, i) => (
                <li key={i} class={cx('timeline__item', `timeline__item--${toneClass(m.tone)}`)}>
                  <span class="timeline__date num">{m.dateLabel}</span>
                  <span class="timeline__dot" aria-hidden="true" />
                  <div class="timeline__body">
                    <h3 class="timeline__title">{m.title}</h3>
                    <p class="timeline__detail">{m.detail}</p>
                    {m.consequence && (
                      <p class="timeline__cons">
                        <Icon name="chevron_right" size={13} /> {m.consequence}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {section === 'truths' && truths.length > 0 && (
          <Section title={t('Hidden truths')} icon="eye" aside={<span class="dim small">{t('What was really going on')}</span>}>
            <div class="truths">
              {truths.map((g) => (
                <div key={g.k} class="truths__group">
                  <h3 class="eyebrow">{TRUTH_LABEL[g.k]}</h3>
                  <ul>
                    {g.items.map((truth, i) => (
                      <li key={i} class={cx('truth', truth.known ? 'truth--known' : 'truth--new')}>
                        <span class="truth__title">{truth.title}</span>
                        <span class="truth__detail">{truth.detail}</span>
                        <span class="truth__tag">{truth.known ? <><Icon name="check" size={12} /> {t('You knew')}</> : <><Icon name="eye" size={12} /> {t('Revealed')}</>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

        {section === 'warnings' && ending.warningSigns.length > 0 && (
          <Section title={t('Warning signs')} icon="warning" aside={<span class="dim small num">{t('{acted}/{total} acted on', { acted, total: ending.warningSigns.length })}</span>}>
            <ul class="signs">
              {ending.warningSigns.map((w, i) => (
                <li key={i} class={cx('sign', w.actedOn ? 'sign--acted' : 'sign--ignored')}>
                  <span class="sign__mark" aria-label={w.actedOn ? t('Acted on') : t('Ignored')}>
                    <Icon name={w.actedOn ? 'check' : 'cross'} size={14} />
                  </span>
                  <span class="sign__date num">{w.dateLabel}</span>
                  <span class="sign__text">{w.text}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {section === 'missed' && ending.missed.length > 0 && (
          <Section title={t('Missed opportunities')} icon="target">
            <ul class="missed">
              {ending.missed.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Section>
        )}

        {section === 'stats' && ending.stats.length > 0 && (
          <Section title={t('By the numbers')} icon="report">
            <dl class="stats">
              {ending.stats.map((s) => (
                <div key={s.label} class="stats__item">
                  <dt>{s.label}</dt>
                  <dd class="num">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        </div>
        <footer class="ending__foot">
          <button type="button" class="seed" onClick={copySeed} aria-label={t('Seed {seed}. Copy', { seed: ending.seed })}>
            <span class="eyebrow">{t('Seed')}</span>
            <span class="num">#{ending.seed}</span>
            <span class="seed__copy">{copied ? t('Copied') : t('Copy')}</span>
          </button>
          <div class="ending__buttons">
            <button type="button" class="btn btn--primary btn--xl" onClick={onReplay}>
              <Icon name="refresh" size={18} /> {t('Replay this seed')}
            </button>
            <button type="button" class="btn btn--xl" onClick={onNew}>
              <Icon name="flag" size={18} /> {t('New run')}
            </button>
            <button type="button" class="btn btn--ghost" onClick={onTitle}>
              {t('Title screen')}
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}
