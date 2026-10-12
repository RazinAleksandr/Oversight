/**
 * Advisor tip popup (non-modal). Text comes from content TIPS, with built-in fallbacks.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { GameView, TipDef, TipId } from '../../engine/types';
import { TIPS } from '../../content/tips';
import { audio } from '../../audio';
import { type CaseForm, formOf, t } from '../../i18n';
import { countryCard } from '../countries';
import { Portrait } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { advisorInfo, useGame } from './context';
import { useHeightVar } from '../hooks';
import { cx } from '../util';

/** Used only when content lacks a tip; built lazily so the strings are translated on first use. */
let fallbackTips: Record<TipId, TipDef> | null = null;
const FALLBACK_TIPS = (): Record<TipId, TipDef> =>
  (fallbackTips ??= {
    welcome: { advisor: 'chief_of_staff', title: t('Welcome, Director'), text: t('Each quarter, briefings land on your desk. Decide them, spend your actions, then end the quarter. Reports are evidence — not truth.') },
    inbox: { advisor: 'chief_of_staff', title: t('Your inbox'), text: t('Every briefing must be resolved before the quarter can end. Critical ones are marked in red.') },
    labs: { advisor: 'scientist', title: t('The labs'), text: t('Companies report their own capabilities. Investigate them to learn what they are hiding.') },
    nation: { advisor: 'economist', title: t('Programs & policies'), text: t('Fund programs with your budget — changes are free and immediate, upkeep is charged each quarter. Laws cost an action and political capital.') },
    world: { advisor: 'intelligence', title: t('The world is watching'), text: t('Rivals race too. Our estimates of them are rough — intelligence work sharpens them. Diplomacy builds the Global Accord.') },
    threats: { advisor: 'scientist', title: t('Threats'), text: t('Detected situations grow each quarter. Investigate to find their cause, then restrict or suspend the source before they escalate.') },
    first_deployment: { advisor: 'scientist', title: t('Deployment requests'), text: t('Watch the confidence of our evaluation. “No issues found” at low confidence means very little.') },
    first_demand: { advisor: 'chief_of_staff', title: t('Demands'), text: t('The leader expects results. Counter-offers can work — the percentage shown is honest.') },
    first_situation: { advisor: 'scientist', title: t('Something is wrong'), text: t('A threat has surfaced. The earlier we act, the cheaper it is.') },
    risk_clock: { advisor: 'scientist', title: t('The Risk Clock'), text: t('The hand shows our best estimate of global AI risk; the shaded arc shows how unsure we are. At midnight, the world fails.') },
    capacity: { advisor: 'chief_of_staff', title: t('Actions'), text: t('Your department can do only a few things per quarter. Unused actions are lost.') },
    evidence: { advisor: 'intelligence', title: t('Evidence'), text: t('Evidence from investigations lets you enforce rules on companies and win arguments with the leader.') },
    end_turn: { advisor: 'chief_of_staff', title: t('End the quarter'), text: t('When the desk is clear and your actions are spent, end the quarter to see what changed.') },
    low_confidence: { advisor: 'chief_of_staff', title: t('You are losing them'), text: t('Government confidence is low. Brief the leader or deliver on a demand — or you will be replaced.') },
  });

export function tipDef(id: TipId): TipDef {
  return (TIPS as Partial<Record<TipId, TipDef>>)[id] ?? FALLBACK_TIPS()[id];
}

/**
 * Resolve the few template tokens tip text may use, from the fogged view only.
 * Supports `{token:form}` (Russian case forms, docs/I18N.md §3); English ignores the form.
 */
export function fillTokens(text: string, view: GameView): string {
  const adv = (id: Parameters<typeof advisorInfo>[1]) => advisorInfo(view, id).name;
  const map: Record<string, string> = {
    country: view.country.name,
    countryShort: countryCard(view.country.id).shortName ?? view.country.name.split(' ')[0],
    countryAdj: view.country.adjective,
    leader: view.government.leaderName,
    leaderTitle: view.government.leaderTitle || view.country.leaderTitle,
    date: view.dateLabel,
    year: String(view.year),
    quarter: t('Q{q}', { q: view.quarter }),
    scientist: adv('scientist'),
    economist: adv('economist'),
    chiefOfStaff: adv('chief_of_staff'),
    spymaster: adv('intelligence'),
  };
  return text.replace(/\{(\w+)(?::(\w+))?\}/g, (m, k: string, form?: string) => {
    const v = map[k];
    if (v === undefined) return m;
    return form ? formOf(v, form as CaseForm) : v;
  });
}

/** Available when relevant, opened deliberately so advice never covers the playing surface. */
export function AdvisorHelp({id,onClose,onDismiss}:{id:TipId;onClose():void;onDismiss():void}):JSX.Element {
  const {view}=useGame();
  const tip=tipDef(id),advisor=advisorInfo(view,tip.advisor);
  return <Sheet size="page" class="advisor-help" label={t('Advisor advice')} onClose={onClose}>
    <header><Portrait seed={advisor.portraitSeed} role="advisor" size={64} name={advisor.name}/><div><h1>{fillTokens(tip.title,view)}</h1><p>{advisor.name} · {advisor.role}</p></div></header>
    <main><p>{fillTokens(tip.text,view)}</p></main><footer><button type="button" class="btn btn--primary" onClick={onDismiss}>{t('Got it')}</button></footer>
  </Sheet>;
}

/**
 * Compact advisor bubble docked above the tab bar. Text is clamped to two lines (tap "More" to
 * expand); GameScreen pads the main scroller by --tip-h so the bubble never hides content.
 */
export function TipPopup({ id, onDismiss }: { id: TipId; onDismiss(): void }): JSX.Element {
  const { view } = useGame();
  const tip = tipDef(id);
  const a = advisorInfo(view, tip.advisor);
  const [open, setOpen] = useState(false);
  const ref = useHeightVar<HTMLElement>('--tip-h');
  const text = fillTokens(tip.text, view);
  useEffect(() => {
    audio.play('open', { volume: 0.6 });
    setOpen(false);
  }, [id]);
  return (
    <aside ref={ref} class={cx('tip', open && 'is-open')} role="status" aria-live="polite" aria-label={t('Advisor tip: {title}', { title: fillTokens(tip.title, view) })} key={id}>
      <Portrait seed={a.portraitSeed} role="advisor" size={38} name={a.name} />
      <div class="tip__body">
        <div class="tip__head">
          <p class="tip__who">
            {a.name} · {a.role}
          </p>
          <button type="button" class="tip__ok" onClick={onDismiss}>
            {t('Got it')}
          </button>
        </div>
        <h3 class="tip__title">{fillTokens(tip.title, view)}</h3>
        {/* Collapsed to one line so the bubble never hides the desk; tap the text to read it all. */}
        <button type="button" class="tip__text" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {text}
          {!open && <span class="tip__more">{t('More')}</span>}
        </button>
      </div>
    </aside>
  );
}
