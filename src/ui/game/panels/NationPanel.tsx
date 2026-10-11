/**
 * Nation: government (leader, priorities, demands, reviews), safety gap, programs (budget levels),
 * policies (laws) and society (adoption by sector, dependence, displacement).
 */
import type { JSX } from 'preact';
import type { DemandView, PolicyView, ProgramView, SectorId } from '../../../engine/types';
import { SECTOR_INFO } from '../../../engine/labels';
import { Bar, EstimateLine, RangeBar } from '../../components/Bars';
import { ActionChip, PageHead, Section } from '../../components/Common';
import { Icon, Portrait } from '../../components/Icon';
import { cx, hueOf, money, one } from '../../util';
import { actionsFor, useGame } from '../context';
import { stripDeadline } from '../Inbox';

const SECTORS: SectorId[] = ['business', 'public', 'infrastructure', 'defense'];

const MOOD_TONE = { Supportive: 'good', Satisfied: 'good', Impatient: 'warn', Hostile: 'bad' } as const;

const SUPPORT_TEXT: Record<string, string> = { '-2': 'Strongly opposes', '-1': 'Opposes', '0': 'Indifferent', '1': 'Supports', '2': 'Champions' };

export function NationPanel(): JSX.Element {
  const { view, desktop } = useGame();
  return (
    <div class="page page--nation">
      <PageHead title="Nation" sub={`${view.country.name} — your levers at home.`} />
      <div class={cx('nation', desktop && 'nation--wide')}>
        <div class="nation__col">
          <GovernmentPanel />
          <SafetyGap />
          <Society />
        </div>
        <div class="nation__col">
          <Programs />
          <Policies />
        </div>
      </div>
    </div>
  );
}

function GovernmentPanel(): JSX.Element {
  const { view, actions, openAction } = useGame();
  const g = view.government;
  const politics = actionsFor(actions, 'politics');
  return (
    <Section title="Government" icon="government" class="gov">
      <div class="panel gov__card">
        <header class="gov__head">
          <Portrait seed={g.portraitSeed} role="leader" size={68} name={g.leaderName} hue={hueOf(view.country.color)} />
          <div class="gov__id">
            <p class="eyebrow eyebrow--gov">{g.leaderTitle}</p>
            <h3 class="gov__name">{g.leaderName}</h3>
            <p class="gov__bio">{g.leaderBio}</p>
          </div>
        </header>
        <div class="gov__tags">
          <span class="pill pill--gov">{g.stanceLabel}</span>
          <span class={cx('pill', `pill--${MOOD_TONE[g.mood]}`)}>Mood: {g.mood}</span>
        </div>
        <p class="gov__stance">{g.stanceText}</p>
        <div class="gov__prio">
          <h4 class="eyebrow">Priorities</h4>
          {g.priorities.map((p) => (
            <div key={p.key} class="prio">
              <span class="prio__k">{p.label}</span>
              <Bar value={p.weight} max={1} tone="gov" thin label={`${p.label} weight ${p.weight}`} />
            </div>
          ))}
        </div>
        <div class="gov__demands">
          <h4 class="eyebrow">Demands</h4>
          {g.demands.length ? g.demands.map((d) => <Demand key={d.id} d={d} />) : <p class="dim small">No active demands. Enjoy it while it lasts.</p>}
        </div>
        {g.nextReview && (
          <p class="gov__review">
            <Icon name="calendar" size={15} />
            <span>
              {g.nextReview.label}
              <span class="dim"> — in {Math.max(0, g.nextReview.turn - view.turn)} quarter{g.nextReview.turn - view.turn === 1 ? '' : 's'}</span>
            </span>
          </p>
        )}
        {politics.length > 0 && (
          <div class="actrow">
            {politics.map((a) => (
              <ActionChip key={a.id} action={a} onOpen={openAction} />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

function Demand({ d }: { d: DemandView }): JSX.Element {
  const st = d.status;
  return (
    <div class={cx('demand', `demand--${st}`)}>
      <div class="demand__top">
        <span class="demand__title">{stripDeadline(d.title)}</span>
        <span class={cx('demand__status', st === 'met' ? 'is-good' : st === 'failed' || st === 'refused' ? 'is-bad' : '')}>
          {st === 'active' ? (/^due/i.test(d.deadlineLabel) ? d.deadlineLabel : `Due ${d.deadlineLabel}`) : st === 'offered' ? 'Offered' : st === 'met' ? 'Met' : st === 'failed' ? 'Failed' : 'Refused'}
        </span>
      </div>
      <p class="demand__text">{d.text}</p>
      <Bar value={d.progress * 100} tone={d.progress >= 1 ? 'good' : 'gov'} label={d.progressLabel} />
      <div class="demand__foot num">
        <span>{d.progressLabel}</span>
        <span>
          <span class="is-good">+{d.reward}</span> / <span class="is-bad">−{d.penalty}</span> conf.
        </span>
      </div>
    </div>
  );
}

function SafetyGap(): JSX.Element {
  const { view } = useGame();
  const n = view.nation;
  const gap = n.capability.value - n.safeguards;
  const tone = gap <= 0.5 ? 'good' : gap <= 1.5 ? 'warn' : 'bad';
  return (
    <Section title="Safety gap" icon="safeguards">
      <div class="panel gap">
        <div class="kvs">
          <div class="kvs__head">
            <span class="kv__k">Domestic frontier · {n.frontierLeader}</span>
            <EstimateLine est={n.capability} unit="CI" />
          </div>
          <RangeBar est={n.capability} tone="warn" />
        </div>
        <div class="kvs">
          <div class="kvs__head">
            <span class="kv__k">National safeguards</span>
            <span class="num">{one(n.safeguards)}</span>
          </div>
          <RangeBar est={{ value: n.safeguards, low: n.safeguards, high: n.safeguards, confidence: 'verified' }} tone="good" />
        </div>
        <p class={cx('gap__verdict', `is-${tone}`)}>
          <span class="gap__num num">{gap > 0 ? '+' : ''}{one(gap)}</span>
          <span>
            {gap <= 0
              ? 'Safeguards are ahead of capability. Keep it that way.'
              : gap <= 1.5
                ? 'Capability is outrunning your ability to control it.'
                : 'Dangerous gap. Every deployment now carries serious hidden risk.'}
          </span>
        </p>
      </div>
    </Section>
  );
}

function Programs(): JSX.Element {
  const { view } = useGame();
  const n = view.nation;
  const net = n.income - n.upkeep;
  return (
    <Section title="Programs" icon="budget" aside={<span class="dim small">Free to change · upkeep each quarter</span>}>
      <div class="budgetstrip">
        <div>
          <span class="eyebrow">Treasury</span>
          <span class="num budgetstrip__v">{money(n.budget)}</span>
        </div>
        <div>
          <span class="eyebrow">Income</span>
          <span class="num budgetstrip__v is-good">{money(n.income, true)}</span>
        </div>
        <div>
          <span class="eyebrow">Upkeep</span>
          <span class="num budgetstrip__v is-bad">{money(-n.upkeep)}</span>
        </div>
        <div>
          <span class="eyebrow">Net / q</span>
          <span class={cx('num budgetstrip__v', net >= 0 ? 'is-good' : 'is-bad')}>{money(net, true)}</span>
        </div>
      </div>
      <ul class="programs">
        {n.programs.map((p) => (
          <ProgramRow key={p.id} p={p} />
        ))}
      </ul>
    </Section>
  );
}

function ProgramRow({ p }: { p: ProgramView }): JSX.Element {
  const { setProgram } = useGame();
  return (
    <li class={cx('program', p.level > 0 && 'is-funded')}>
      <div class="program__head">
        <span class="program__icon">
          <Icon name={p.icon} size={20} />
        </span>
        <div class="program__text">
          <h3 class="program__name">{p.name}</h3>
          <p class="program__lvl">{p.levelText[p.level]}</p>
        </div>
        <span class="program__cost num">{p.costs[p.level] ? `${money(-p.costs[p.level])}/q` : 'Free'}</span>
      </div>
      <div class="stepper" role="radiogroup" aria-label={`${p.name} funding level`}>
        {[0, 1, 2, 3].map((l) => (
          <button
            type="button"
            key={l}
            role="radio"
            aria-checked={l === p.level}
            aria-label={`Level ${l}: ${p.levelText[l]}, upkeep ${p.costs[l]} billion`}
            class={cx('stepper__btn', l <= p.level && l > 0 && 'is-filled', l === p.level && 'is-current')}
            onClick={() => l !== p.level && setProgram(p.id, l)}
          >
            <span class="stepper__lvl">{l === 0 ? 'Off' : `L${l}`}</span>
            <span class="stepper__cost num">${p.costs[l]}B</span>
          </button>
        ))}
      </div>
    </li>
  );
}

function Policies(): JSX.Element {
  const { view } = useGame();
  const active = view.nation.policies.filter((p) => p.active);
  const avail = view.nation.policies.filter((p) => !p.active);
  return (
    <Section title="Policies" icon="policy" aside={<span class="dim small">{active.length} in force</span>}>
      <div class="laws">
        {[...active, ...avail].map((p) => (
          <Law key={p.id} p={p} />
        ))}
      </div>
    </Section>
  );
}

function Law({ p }: { p: PolicyView }): JSX.Element {
  const { actions, openAction } = useGame();
  const act = actions.find((a) => a.id === (p.active ? 'repeal_policy' : 'enact_policy'));
  const blocked = act?.disabled ?? act?.targets?.find((t) => t.id === p.id)?.disabled ?? null;
  const supportTone = p.leaderSupport > 0 ? 'good' : p.leaderSupport < 0 ? 'bad' : 'neutral';
  const cost = p.active ? Math.ceil(p.politicalCost / 2) : p.politicalCost;
  return (
    <article class={cx('law', p.active && 'law--active')}>
      <header class="law__head">
        <span class="law__icon">
          <Icon name={p.icon} size={18} />
        </span>
        <h3 class="law__name">{p.name}</h3>
        {p.active && <span class="law__inforce">In force</span>}
      </header>
      <p class="law__desc">{p.description}</p>
      <ul class="law__fx">
        {p.effectsText.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <footer class="law__foot">
        <span class={cx('law__support', `is-${supportTone}`)}>
          <Icon name="government" size={13} /> {SUPPORT_TEXT[String(p.leaderSupport)] ?? 'Indifferent'}
        </span>
        <span class={cx('law__cost num', cost > 0 ? 'is-bad' : cost < 0 ? 'is-good' : '')}>
          {cost > 0 ? `−${cost} conf.` : cost < 0 ? `+${-cost} conf.` : 'No political cost'}
        </span>
        <button
          type="button"
          class={cx('btn btn--small', p.active ? 'btn--ghost' : 'btn--accent', blocked && 'is-blocked')}
          onClick={() => openAction(p.active ? 'repeal_policy' : 'enact_policy', p.id)}
        >
          {p.active ? 'Repeal' : 'Enact'} · 1◆
        </button>
      </footer>
    </article>
  );
}

function Society(): JSX.Element {
  const { view } = useGame();
  const n = view.nation;
  return (
    <Section title="Society & economy" icon="adoption">
      <div class="panel society">
        <h4 class="eyebrow">AI adoption by sector</h4>
        <ul class="sectors">
          {SECTORS.map((s) => {
            const v = n.adoption[s];
            const t = n.adoptionTarget[s];
            return (
              <li key={s} class="sectorrow">
                <span class="sectorrow__name">
                  <Icon name={SECTOR_INFO[s].icon} size={15} /> {SECTOR_INFO[s].name}
                </span>
                <Bar value={v} ghost={t} tone="accent" label={`${SECTOR_INFO[s].name} adoption ${Math.round(v)} percent, heading to ${Math.round(t)}`} />
                <span class="sectorrow__v num">
                  {Math.round(v)}%{Math.round(t) !== Math.round(v) && <span class="dim"> → {Math.round(t)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p class="dim small legend">
          <span class="legend__ghost" aria-hidden="true" /> target the sector is moving toward
        </p>
        <div class="society__tiles">
          <div class="stat">
            <span class="eyebrow">Dependence</span>
            <span class="stat__v num">{Math.round(n.dependence)}</span>
            <Bar value={n.dependence} tone={n.dependence > 60 ? 'warn' : 'accent'} thin label="Dependence" />
            <span class="stat__hint">Suspending models hurts more as this grows</span>
          </div>
          <div class="stat">
            <span class="eyebrow">Job displacement</span>
            <span class={cx('stat__v num', n.displacement > 40 && 'is-bad')}>{Math.round(n.displacement)}</span>
            <Bar value={n.displacement} tone={n.displacement > 40 ? 'bad' : n.displacement > 20 ? 'warn' : 'good'} thin label="Displacement" />
            <span class="stat__hint">Erodes stability unless workers are supported</span>
          </div>
        </div>
      </div>
    </Section>
  );
}
