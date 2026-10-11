/**
 * How to Play — concise, illustrated with the game's own components.
 */
import type { JSX } from 'preact';
import { METER_INFO } from '../../engine/labels';
import type { MeterId } from '../../engine/types';
import { RangeBar, StageStepper } from '../components/Bars';
import { ChanceBadge, ConfBadge, CostChips, PreviewChip, UncertainChip } from '../components/Chips';
import { Trait } from '../components/Common';
import { Icon } from '../components/Icon';
import { RiskClock } from '../components/RiskClock';
import { Sheet } from '../components/Sheet';

const METERS: MeterId[] = ['confidence', 'economy', 'stability', 'security'];

export function HowToPlay({ onClose }: { onClose(): void }): JSX.Element {
  return (
    <Sheet label="How to play" onClose={onClose} size="full" class="howto-sheet">
      <div class="howto">
        <header class="howto__head">
          <p class="eyebrow">Field manual</p>
          <h2>How to play</h2>
          <p class="howto__lede">
            You run your country's government AI department from 2027 to 2030 — sixteen quarters. Keep the nation standing, keep your job, and get the world through the transition before the clock strikes midnight.
          </p>
        </header>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">1</span> The quarterly loop
          </h3>
          <ol class="loop">
            <li class="loop__step">
              <Icon name="inbox" size={22} />
              <b>Decide briefings</b>
              <span>Deployment requests, demands, crises. Every card needs an answer.</span>
            </li>
            <li class="loop__step">
              <Icon name="capacity" size={22} />
              <b>Spend actions</b>
              <span>A few per quarter: investigate, legislate, negotiate. Programs are free to adjust.</span>
            </li>
            <li class="loop__step">
              <Icon name="calendar" size={22} />
              <b>End the quarter</b>
              <span>The world moves. Read the report — consequences arrive with warnings first.</span>
            </li>
          </ol>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">2</span> Four meters — any at zero ends the run
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
          <p class="howto__p">Tap any meter to see exactly why it moved.</p>
        </section>

        <section class="howto__sec howto__sec--split">
          <RiskClock risk={{ estimate: 31, low: 20, high: 44, clock: '23:19' }} size={112} showLabel />
          <div>
            <h3 class="howto__h">
              <span class="howto__n">3</span> The Risk Clock
            </h3>
            <p class="howto__p">
              Global AI risk, as minutes to midnight. The hand is your <b>estimate</b>; the shaded arc is your <b>uncertainty</b>. The true value is hidden. Oversight funding and a Global Accord sharpen the picture.
            </p>
          </div>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">4</span> Reports are evidence, not truth
          </h3>
          <div class="howto__demo paperdemo">
            <div class="paperdemo__row">
              <span>Red-team findings</span>
              <span>
                No issues found <ConfBadge c="low" />
              </span>
            </div>
            <div class="paperdemo__row">
              <span>Internal safety audit</span>
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
              <span class="dim small">Capability estimate</span>
              <RangeBar est={{ value: 3.1, low: 2.3, high: 3.9, confidence: 'low' }} />
            </div>
            <Trait name="Safety" t={{ label: 'Unknown', value: null, verified: false }} />
            <Trait name="Ambition" t={{ label: 'High', value: null, verified: false }} />
          </div>
          <p class="howto__p">Low-confidence “all clear” means little. Investigations turn ranges and question marks into facts — and uncover violations you can use as evidence.</p>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">5</span> Reading a choice
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
            Arrows show direction and size of immediate effects — green is good for you, red is bad. <b>?</b> means it could go either way. Delayed and hidden consequences are never previewed: that is what the “Uncertain” chip warns about. Percentages are honest.
          </p>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">6</span> Threats grow in the dark
          </h3>
          <StageStepper stage={2} />
          <p class="howto__p">
            Flawed deployments, leaks and rivals spawn hidden situations. Before anything becomes a crisis, there are always warning signs — odd headlines, advisor remarks. Detected threats show <b>“Escalation expected next quarter”</b> when time is short. Investigate, then restrict or suspend the source.
          </p>
        </section>

        <section class="howto__sec">
          <h3 class="howto__h">
            <span class="howto__n">7</span> Endings
          </h3>
          <p class="howto__p">
            Fail if a meter hits zero or the clock strikes midnight. Survive to the Threshold — the moment superintelligence arrives — and you are graded on <b>Control, Prosperity, Security and Legitimacy</b>. The debrief reveals every hidden truth and every warning you missed.
          </p>
        </section>

        <div class="sheet__actions">
          <button type="button" class="btn btn--primary btn--wide" onClick={onClose} data-autofocus>
            Understood
          </button>
        </div>
      </div>
    </Sheet>
  );
}
