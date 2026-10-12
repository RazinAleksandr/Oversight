/**
 * How to Play — concise, illustrated with the game's own components.
 */
import type { JSX } from 'preact';
import { t } from '../../i18n';
import { METER_INFO } from '../../engine/labels';
import type { GameView, MeterId } from '../../engine/types';
import { RangeBar, StageStepper } from '../components/Bars';
import { ChanceBadge, ConfBadge, CostChips, PreviewChip, UncertainChip } from '../components/Chips';
import { Trait, rich } from '../components/Common';
import { Icon } from '../components/Icon';
import { RiskClock } from '../components/RiskClock';
import { tipDef, fillTokens } from '../game/Tips';
import { Sheet } from '../components/Sheet';

const METERS: MeterId[] = ['confidence', 'economy', 'stability', 'security'];

export function HowToPlay({ onClose, view }: { onClose(): void; view?: GameView }): JSX.Element {
  return (
    <Sheet label={t('How to play')} onClose={onClose} size="full" class="howto-sheet">
      <div class="howto">
        <header class="howto__head">
          <p class="eyebrow">{t('Field manual')}</p>
          <h2>{t('How to play')}</h2>
          <p class="howto__lede">
            {t("You run your country's government AI department from 2027 to 2030 — sixteen quarters. Keep the nation standing, keep your job, and get the world through the transition before the clock strikes midnight.")}
          </p>
        </header>

        {view?.tipsShown?.length ? <section class="howto__sec">
          <h3 class="howto__h">{t('Advice received')}</h3>
          {view.tipsShown.map(id => { const tip = tipDef(id); return <details class="howto__tip" key={id}><summary>{tip.title}</summary><p>{fillTokens(tip.text, view)}</p></details>; })}
        </section> : null}
        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">1</span> {t('The quarterly loop')}
          </h3>
          <ol class="loop">
            <li class="loop__step">
              <Icon name="inbox" size={22} />
              <b>{t('Decide briefings')}</b>
              <span>{t('Deployment requests, demands, crises. Every card needs an answer.')}</span>
            </li>
            <li class="loop__step">
              <Icon name="capacity" size={22} />
              <b>{t('Spend actions')}</b>
              <span>{t('A few per quarter: investigate, legislate, negotiate. Programs are free to adjust.')}</span>
            </li>
            <li class="loop__step">
              <Icon name="calendar" size={22} />
              <b>{t('End the quarter')}</b>
              <span>{t('The world moves. Read the report — consequences arrive with warnings first.')}</span>
            </li>
          </ol>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">2</span> {t('Four meters — any at zero ends the run')}
          </h3>
          <ul class="howto__meters">
            {METERS.map((id) => (
              <li key={id}>
                <Icon name={METER_INFO[id].icon} size={18} />
                <b>{METER_INFO[id].name}</b>
                <span>{METER_INFO[id].failText}</span>
              </li>
            ))}
          </ul>
          <p class="howto__p">{t('Tap any meter to see exactly why it moved.')}</p>
        </section>

        <section class="howto__sec howto__sec--split">
          <RiskClock risk={{ estimate: 31, low: 20, high: 44, clock: '23:19' }} size={112} showLabel />
          <div>
            <h3 class="howto__h">
              <span class="howto__n">3</span> {t('The Risk Clock')}
            </h3>
            <p class="howto__p">
              {rich(t('Global AI risk, as minutes to midnight. The hand is your **estimate**; the shaded arc is your **uncertainty**. The true value is hidden. Oversight funding and a Global Accord sharpen the picture.'))}
            </p>
          </div>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">4</span> {t('Reports are evidence, not truth')}
          </h3>
          <div class="howto__demo paperdemo">
            <div class="paperdemo__row">
              <span>{t('Red-team findings')}</span>
              <span>
                {t('No issues found')} <ConfBadge c="low" />
              </span>
            </div>
            <div class="paperdemo__row">
              <span>{t('Internal safety audit')}</span>
              <span>
                <span class="redact">
                  <span class="redact__bar" style={{ width: '70%' }} />
                </span>
                <ConfBadge c="redacted" />
              </span>
            </div>
          </div>
          <div class="howto__demo howto__demo--row">
            <div class="howto__range">
              <span class="dim small">{t('Capability estimate')}</span>
              <RangeBar est={{ value: 3.1, low: 2.3, high: 3.9, confidence: 'low' }} />
            </div>
            <Trait name={t('Safety')} t={{ label: 'Unknown', value: null, verified: false }} />
            <Trait name={t('Ambition')} t={{ label: 'High', value: null, verified: false }} />
          </div>
          <p class="howto__p">{t('Low-confidence “all clear” means little. Investigations turn ranges and question marks into facts — and uncover violations you can use as evidence.')}</p>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">5</span> {t('Reading a choice')}
          </h3>
          <div class="howto__demo howto__chips">
            <PreviewChip p={{ key: 'economy', dir: 1, magnitude: 2 }} />
            <PreviewChip p={{ key: 'risk', dir: 1, magnitude: 1 }} />
            <PreviewChip p={{ key: 'company', dir: -1, magnitude: 1, label: 'Prometheus' }} />
            <PreviewChip p={{ key: 'confidence', dir: 0, magnitude: 1 }} />
            <UncertainChip />
            <CostChips cost={{ capacity: 1, budget: 2 }} />
            <ChanceBadge chance={0.62} />
          </div>
          <p class="howto__p">
            {rich(t('Arrows show direction and size of immediate effects — green is good for you, red is bad. **?** means it could go either way. Delayed and hidden consequences are never previewed: that is what the “Uncertain” chip warns about. Percentages are honest.'))}
          </p>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">6</span> {t('Threats grow in the dark')}
          </h3>
          <StageStepper stage={2} />
          <p class="howto__p">
            {rich(t('Flawed deployments, leaks and rivals spawn hidden situations. Before anything becomes a crisis, there are always warning signs — odd headlines, advisor remarks. Detected threats show **“Escalation expected next quarter”** when time is short. Investigate, then restrict or suspend the source.'))}
          </p>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">7</span> {t('Endings')}
          </h3>
          <p class="howto__p">
            {rich(t('Fail if a meter hits zero or the clock strikes midnight. Survive to the Threshold — the moment superintelligence arrives — and you are graded on **Control, Prosperity, Security and Legitimacy**. The debrief reveals every hidden truth and every warning you missed.'))}
          </p>
        </section>

        <div class="sheet__actions">
          <button type="button" class="btn btn--primary btn--wide" onClick={onClose} data-autofocus>
            {t('Understood')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
