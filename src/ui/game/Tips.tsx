/**
 * Advisor tip popup (non-modal). Text comes from content TIPS, with built-in fallbacks.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { GameView, TipDef, TipId } from '../../engine/types';
import { TIPS } from '../../content/tips';
import { audio } from '../../audio';
import { Portrait } from '../components/Icon';
import { advisorInfo, useGame } from './context';
import { useHeightVar } from '../hooks';
import { cx } from '../util';

const FALLBACK_TIPS: Record<TipId, TipDef> = {
  welcome: { advisor: 'chief_of_staff', title: 'Welcome, Director', text: 'Each quarter, briefings land on your desk. Decide them, spend your actions, then end the quarter. Reports are evidence — not truth.' },
  inbox: { advisor: 'chief_of_staff', title: 'Your inbox', text: 'Every briefing must be resolved before the quarter can end. Critical ones are marked in red.' },
  labs: { advisor: 'scientist', title: 'The labs', text: 'Companies report their own capabilities. Investigate them to learn what they are hiding.' },
  nation: { advisor: 'economist', title: 'Programs & policies', text: 'Fund programs with your budget — changes are free and immediate, upkeep is charged each quarter. Laws cost an action and political capital.' },
  world: { advisor: 'intelligence', title: 'The world is watching', text: 'Rivals race too. Our estimates of them are rough — intelligence work sharpens them. Diplomacy builds the Global Accord.' },
  threats: { advisor: 'scientist', title: 'Threats', text: 'Detected situations grow each quarter. Investigate to find their cause, then restrict or suspend the source before they escalate.' },
  first_deployment: { advisor: 'scientist', title: 'Deployment requests', text: 'Watch the confidence of our evaluation. “No issues found” at low confidence means very little.' },
  first_demand: { advisor: 'chief_of_staff', title: 'Demands', text: 'The leader expects results. Counter-offers can work — the percentage shown is honest.' },
  first_situation: { advisor: 'scientist', title: 'Something is wrong', text: 'A threat has surfaced. The earlier we act, the cheaper it is.' },
  risk_clock: { advisor: 'scientist', title: 'The Risk Clock', text: 'The hand shows our best estimate of global AI risk; the shaded arc shows how unsure we are. At midnight, the world fails.' },
  capacity: { advisor: 'chief_of_staff', title: 'Actions', text: 'Your department can do only a few things per quarter. Unused actions are lost.' },
  evidence: { advisor: 'intelligence', title: 'Evidence', text: 'Evidence from investigations lets you enforce rules on companies and win arguments with the leader.' },
  end_turn: { advisor: 'chief_of_staff', title: 'End the quarter', text: 'When the desk is clear and your actions are spent, end the quarter to see what changed.' },
  low_confidence: { advisor: 'chief_of_staff', title: 'You are losing them', text: 'Government confidence is low. Brief the leader or deliver on a demand — or you will be replaced.' },
};

export function tipDef(id: TipId): TipDef {
  return (TIPS as Partial<Record<TipId, TipDef>>)[id] ?? FALLBACK_TIPS[id];
}

/** Resolve the few template tokens tip text may use, from the fogged view only. */
export function fillTokens(text: string, view: GameView): string {
  const adv = (id: Parameters<typeof advisorInfo>[1]) => advisorInfo(view, id).name;
  const map: Record<string, string> = {
    country: view.country.name,
    countryShort: view.country.name.split(' ')[0],
    countryAdj: view.country.adjective,
    leader: view.government.leaderName,
    leaderTitle: view.government.leaderTitle || view.country.leaderTitle,
    date: view.dateLabel,
    year: String(view.year),
    quarter: `Q${view.quarter}`,
    scientist: adv('scientist'),
    economist: adv('economist'),
    chiefOfStaff: adv('chief_of_staff'),
    spymaster: adv('intelligence'),
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => map[k] ?? m);
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
    <aside ref={ref} class={cx('tip', open && 'is-open')} role="status" aria-live="polite" aria-label={`Advisor tip: ${tip.title}`} key={id}>
      <Portrait seed={a.portraitSeed} role="advisor" size={38} name={a.name} />
      <div class="tip__body">
        <div class="tip__head">
          <p class="tip__who">
            {a.name} · {a.role}
          </p>
          <button type="button" class="tip__ok" onClick={onDismiss}>
            Got it
          </button>
        </div>
        <h3 class="tip__title">{fillTokens(tip.title, view)}</h3>
        {/* Collapsed to one line so the bubble never hides the desk; tap the text to read it all. */}
        <button type="button" class="tip__text" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {text}
          {!open && <span class="tip__more">More</span>}
        </button>
      </div>
    </aside>
  );
}
