/**
 * Briefing card sheet — a paper dossier (typewriter header, stamp, redaction bars, advisor notes)
 * above a dark "decision tray" of large choice buttons with previews, costs and chances.
 * Keys 1–4 pick a choice; tapping the paper skips the typewriter.
 */
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Card, Choice, EvidenceLine } from '../../engine/types';
import { SOURCE_INFO } from '../../engine/labels';
import { getLang, t } from '../../i18n';
import { audio } from '../../audio';
import { fx } from '../../fx';
import { Icon, Portrait } from '../components/Icon';
import { ChanceBadge, ConfBadge, CostChips, PreviewChip, UncertainChip } from '../components/Chips';
import { Kbd, StampMark } from '../components/Common';
import { RiskClock } from '../components/RiskClock';
import { Sheet } from '../components/Sheet';
import { typeCps, useSettings } from '../settings';
import { clamp, cx, hash } from '../util';
import { advisorInfo, useGame } from './context';
import { KIND_LABEL, isAiCard, isCrisisCard } from './Inbox';

/** Reason a choice can't be taken right now (engine-provided, or an affordability check). */
export function choiceBlock(ch: Choice, res: { capacity: number; budget: number; evidence: number }): string | null {
  if (ch.disabled) return ch.disabled;
  const c = ch.cost;
  if (!c) return null;
  if (c.capacity && res.capacity < c.capacity) return t('No actions left this quarter');
  if (c.budget && res.budget < c.budget) return t('Not enough budget');
  if (c.evidence && res.evidence < c.evidence) return t('You hold no evidence');
  return null;
}

/**
 * The Threshold's choices carry "Estimated control: 70–85%." in their hint (no `chance` on purpose).
 * Translated hints keep the shape "<label>: 70–85%." at the end, so non-English text matches any label.
 */
export function parseControl(hint?: string): { low: number; high: number; rest: string } | null {
  if (!hint) return null;
  const m = /Estimated control:\s*(\d+)\s*[–-]\s*(\d+)%\.?/i.exec(hint) ?? (getLang() === 'en' ? null : /[^.!?:]*:\s*(\d+)\s*[–-]\s*(\d+)\s*%\.?\s*$/.exec(hint));
  if (!m) return null;
  return { low: Number(m[1]), high: Number(m[2]), rest: hint.replace(m[0], '').trim() };
}

function ControlMeter({ low, high }: { low: number; high: number }): JSX.Element {
  const mid = (low + high) / 2;
  const tone = mid >= 70 ? 'good' : mid >= 45 ? 'warn' : 'bad';
  return (
    <span class={cx('control', `control--${tone}`)} aria-label={t('Estimated chance of keeping control: {low} to {high} percent', { low, high })}>
      <span class="control__label">{t('Control')}</span>
      <span class="control__track" aria-hidden="true">
        <span class="control__span" style={{ left: `${clamp(low, 0, 100)}%`, width: `${Math.max(2, clamp(high, 0, 100) - clamp(low, 0, 100))}%` }} />
      </span>
      <span class="control__num num">
        {low}–{high}%
      </span>
    </span>
  );
}

export function BriefingSheet({ card, onClose, onChoose }: { card: Card; onClose(): void; onChoose(ch: Choice): void }): JSX.Element {
  const { view } = useGame();
  const { settings } = useSettings();
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const paperRef = useRef<HTMLElement>(null);
  const typer = useRef<{ skip(): void } | null>(null);
  const ai = isAiCard(card);
  const crisis = isCrisisCard(card);
  const finale = card.kind === 'threshold';
  const res = { capacity: view.nation.capacity, budget: view.nation.budget, evidence: view.nation.evidence.length };

  // Entrance: sound, glitch / pulse, typewriter body.
  useEffect(() => {
    audio.play('card_in');
    if (finale) {
      audio.play('critical');
      try {
        fx.vignette('#ff4d5e', 1800);
      } catch {
        /* fx optional */
      }
    }
    const body = bodyRef.current;
    if (ai && titleRef.current) {
      try {
        fx.glitch(titleRef.current, 700);
        audio.play('glitch', { volume: 0.5 });
      } catch {
        /* fx optional */
      }
    }
    if (crisis && paperRef.current) {
      try {
        fx.pulse(paperRef.current, '#ff4d5e');
      } catch {
        /* fx optional */
      }
    }
    if (body) {
      const cps = typeCps(settings);
      if (cps > 0) {
        try {
          // fx throttles onTick (~22/s), so every tick may click.
          typer.current = fx.typewriter(body, card.body, cps, () => audio.play('type', { volume: 0.4 }));
        } catch {
          body.textContent = card.body;
        }
      } else body.textContent = card.body;
    }
    return () => {
      typer.current?.skip();
      typer.current = null;
    };
  }, [card.uid]);

  // Keyboard 1–4.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const i = Number(e.key) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= card.choices.length) return;
      const ch = card.choices[i];
      if (choiceBlock(ch, res)) return;
      e.preventDefault();
      onChoose(ch);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const src = SOURCE_INFO[card.source.type];
  const headStamp = finale ? t('Top secret') : card.urgency === 'critical' ? t('Urgent') : card.kind === 'demand' ? t('Priority') : t('Classified');
  const docNo = `${view.year}-Q${view.quarter}-${String(hash(card.uid) % 900 + 100)}`;

  return (
    <Sheet label={t('Briefing: {title}', { title: card.title })} onClose={onClose} size="full" class="briefing-sheet">
      {/* Any tap inside the briefing completes the typewriter instantly (choices still register). */}
      <div class={cx('briefing', finale && 'briefing--finale')} onPointerDown={() => typer.current?.skip()}>
        {finale && (
          <header class="finale">
            <RiskClock risk={view.risk} size={112} showLabel class="finale__clock" />
            <div class="finale__text">
              <p class="finale__kicker">{t('Final decision · {date}', { date: view.dateLabel })}</p>
              <h2 class="finale__title fx-glitch" data-text={t('The Threshold')}>
                {t('The Threshold')}
              </h2>
              <p class="finale__sub">{t('Everything you did led here. One choice remains.')}</p>
            </div>
          </header>
        )}
        <p class="briefing__count">
          <Icon name="inbox" size={14} /> {t('Briefing {n} of {total}', { n: Math.max(1, view.inbox.findIndex((c) => c.uid === card.uid) + 1), total: view.inbox.length })}
          <span class="briefing__date num">{view.dateLabel}</span>
        </p>
        <article
          ref={paperRef}
          class={cx('dossier', `dossier--${card.urgency}`, ai && !finale && 'dossier--ai', crisis && 'dossier--crisis', finale && 'dossier--threshold')}
        >
          {card.urgency !== 'routine' && <div class="dossier__strip" aria-hidden="true" />}
          <header class="dossier__head">
            <div class="dossier__meta">
              <span>{t('File {no}', { no: docNo })}</span>
            </div>
            <div class="dossier__src" style={card.source.color ? { '--src': card.source.color } : undefined}>
              <Icon name={src.icon} size={15} />
              <span class="dossier__srcname">{card.source.name}</span>
              <span class="dossier__srctype">{src.label}</span>
            </div>
            <h2 class={cx('dossier__title', ai && !finale && 'fx-glitch')} ref={titleRef} data-text={card.title}>
              {card.title}
            </h2>
            <p class="dossier__sub">{card.subtitle ?? KIND_LABEL[card.kind]}</p>
            <StampMark text={headStamp} size="md" class={cx('dossier__stamp', card.urgency === 'critical' && 'stamp--urgent')} />
          </header>

          <p class="dossier__body" ref={bodyRef} />

          {card.evidence && card.evidence.length > 0 && (
            <section class="evidence" aria-label={t('Evidence')}>
              <h3 class="dossier__h">{t('Evidence')}</h3>
              <dl class="evidence__list">
                {card.evidence.map((e, i) => (
                  <EvidenceRow key={i} e={e} seed={hash(card.uid + i)} />
                ))}
              </dl>
            </section>
          )}

          {card.advisors && card.advisors.length > 0 && (
            <section class="advisors" aria-label={t('Advisor notes')}>
              <h3 class="dossier__h">{t('Advisors')}</h3>
              {card.advisors.map((n) => {
                const a = advisorInfo(view, n.advisor);
                return (
                  <figure key={n.advisor} class={cx('advisor', `advisor--${n.advisor}`)}>
                    <Portrait seed={a.portraitSeed} role="advisor" size={44} name={a.name} />
                    <figcaption class="advisor__body">
                      <span class="advisor__who">
                        <strong>{a.name}</strong>
                        <span class="advisor__role">{a.role}</span>
                      </span>
                      <blockquote class="advisor__quote">{t('“{text}”', { text: n.text })}</blockquote>
                    </figcaption>
                  </figure>
                );
              })}
            </section>
          )}
        </article>

        <section class="decision" aria-label={t('Your decision')}>
          <h3 class="decision__title">
            <span>{t('Your decision')}</span>
            <span class="decision__keys">
              <Kbd>1</Kbd>–<Kbd>{card.choices.length}</Kbd>
            </span>
          </h3>
          <ol class="choices">
            {card.choices.map((ch, i) => (
              <ChoiceButton key={ch.id} ch={ch} index={i} blocked={choiceBlock(ch, res)} onPick={() => onChoose(ch)} finale={finale} />
            ))}
          </ol>
        </section>
      </div>
    </Sheet>
  );
}

function EvidenceRow({ e, seed }: { e: EvidenceLine; seed: number }): JSX.Element {
  const redacted = e.confidence === 'redacted';
  return (
    <div class={cx('evidence__row', redacted && 'is-redacted')}>
      <dt class="evidence__label">{e.label}</dt>
      <dd class="evidence__value">
        {redacted ? (
          <span class="redact" aria-label={t('Redacted')}>
            <span class="redact__bar" style={{ width: `${55 + (seed % 35)}%` }} />
            {seed % 3 === 0 && <span class="redact__bar redact__bar--short" style={{ width: `${20 + (seed % 25)}%` }} />}
          </span>
        ) : (
          <span class="evidence__text">{e.value}</span>
        )}
        <ConfBadge c={e.confidence} />
      </dd>
    </div>
  );
}

function ChoiceButton({ ch, index, blocked, onPick, finale }: { ch: Choice; index: number; blocked: string | null; onPick(): void; finale?: boolean }): JSX.Element {
  const control = parseControl(ch.hint);
  const hint = control ? control.rest : ch.hint;
  return (
    <li>
      <button
        type="button"
        data-nosfx
        data-choice={index + 1}
        class={cx('choice', `choice--${ch.tone ?? 'neutral'}`, blocked && 'is-blocked', finale && 'choice--finale')}
        disabled={!!blocked}
        onClick={onPick}
        aria-keyshortcuts={String(index + 1)}
      >
        <span class="choice__key num" aria-hidden="true">
          {index + 1}
        </span>
        <span class="choice__main">
          <span class="choice__top">
            <span class="choice__label">{ch.label}</span>
            {ch.chance !== undefined && <ChanceBadge chance={ch.chance} />}
          </span>
          {hint && <span class="choice__hint">{hint}</span>}
          {control && <ControlMeter low={control.low} high={control.high} />}
          {(ch.preview.length > 0 || ch.uncertain || ch.cost) && (
            <span class="choice__chips">
              {ch.preview.map((p, i) => (
                <PreviewChip key={i} p={p} />
              ))}
              {ch.uncertain && <UncertainChip />}
              <CostChips cost={ch.cost} />
            </span>
          )}
          {blocked && (
            <span class="choice__blocked">
              <Icon name="lock" size={13} /> {blocked}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
