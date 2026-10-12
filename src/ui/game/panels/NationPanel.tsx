/**
 * Nation: government (leader, priorities, demands, reviews), safety gap, programs (budget levels),
 * policies (laws) and society (adoption by sector, dependence, displacement).
 */
import { LabsPanel } from './LabsPanel';
import type { JSX } from 'preact';
import type { DemandView, PolicyView, ProgramView, SectorId } from '../../../engine/types';
import { SECTOR_INFO, dateLabel } from '../../../engine/labels';
import { Bar, EstimateLine, RangeBar } from '../../components/Bars';
import { ActionChip, PageHead, Section } from '../../components/Common';
import { Icon, Portrait } from '../../components/Icon';
import { cx, hueOf, money, one } from '../../util';
import { actionsFor, useGame } from '../context';
import { DemandForecast } from '../DemandForecast';
import { stripDeadline } from '../Inbox';
import { t, tp } from '../../../i18n';

const SECTORS: SectorId[] = ['business', 'public', 'infrastructure', 'defense'];

const MOOD_TONE = { Supportive: 'good', Satisfied: 'good', Impatient: 'warn', Hostile: 'bad' } as const;

/** GovernmentView `mood` is an English id; this is its display text. */
const MOOD_TEXT: Record<string, string> = { Supportive: t('Mood: Supportive'), Satisfied: t('Mood: Satisfied'), Impatient: t('Mood: Impatient'), Hostile: t('Mood: Hostile') };

const SUPPORT_TEXT: Record<string, string> = { '-2': t('Strongly opposes'), '-1': t('Opposes'), '0': t('Indifferent'), '1': t('Supports'), '2': t('Champions') };

export function NationPanel({ companies = false }: { companies?: boolean }): JSX.Element {
  const { view, sections, selectSection, goTab } = useGame();
  const section = companies ? 'companies' : sections.nation ?? 'government';
  return (
    <div class="page page--nation">
      <PageHead title={t('Nation')} sub={t('{country} — your levers at home.', { country: view.country.name })} />
      <nav class="panel-sections" aria-label={t('Nation sections')}>
        {[...(view.unlockedTabs.includes('nation') ? [['government', t('Government')], ['programs', t('Programs')], ['policies', t('Laws')], ['society', t('Society')]] : []), ...(view.unlockedTabs.includes('labs') ? [['companies', t('Companies')]] : [])].map(([id, label]) =>
          <button type="button" class={cx('btn', section === id && 'btn--accent')} aria-pressed={section === id} data-section={id} onClick={() => { if (id === 'companies') goTab('labs'); else { selectSection('nation', id); goTab('nation'); } }}>{label}</button>)}
      </nav>
      <div class="nation">
        <div class="nation__col">
          {section === 'companies' && <LabsPanel embedded />}
          {section === 'government' && <GovernmentPanel />}
          {section === 'programs' && <><Programs /><SafetyGap /></>}
          {section === 'policies' && <Policies />}
          {section === 'society' && <Society />}
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
    <Section title={t('Government')} icon="government" class="gov">
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
          <span class={cx('pill', `pill--${MOOD_TONE[g.mood]}`)}>{MOOD_TEXT[g.mood] ?? t('Mood: {mood}', { mood: g.mood })}</span>
        </div>
        <p class="gov__stance">{g.stanceText}</p>
        <div class="gov__prio">
          <h4 class="eyebrow">{t('Priorities')}</h4>
          {g.priorities.map((p) => (
            <div key={p.key} class="prio">
              <span class="prio__k">{p.label}</span>
              <Bar value={p.weight} max={1} tone="gov" thin label={t('{label} weight {n}', { label: p.label, n: p.weight })} />
            </div>
          ))}
        </div>
        <div class="gov__demands">
          <h4 class="eyebrow">{t('Demands')}</h4>
          {g.demands.length ? g.demands.map((d) => <Demand key={d.id} d={d} />) : <p class="dim small">{t('No active demands. Enjoy it while it lasts.')}</p>}
        </div>
        {g.nextReview && (
          <p class="gov__review">
            <Icon name="calendar" size={15} />
            <span>
              {g.nextReview.label}
              <span class="dim"> — {tp(Math.max(0, g.nextReview.turn - view.turn), 'in {n} quarter', 'in {n} quarters')}</span>
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
          {st === 'active'
            ? d.deadlineLabel === dateLabel(d.deadlineTurn)
              ? t('Due {date}', { date: d.deadlineLabel })
              : d.deadlineLabel
            : st === 'offered'
              ? t('Offered')
              : st === 'met'
                ? t('Met')
                : st === 'failed'
                  ? t('Failed')
                  : t('Refused')}
        </span>
      </div>
      <p class="demand__text">{d.text}</p>
      {d.forecast && <DemandForecast forecast={d.forecast} />}
      {!d.forecast && (st === 'active' || st === 'offered') && <p class="dim small">{t('No numeric projection is available for this demand. Review its current progress and conditions.')}</p>}
      <Bar value={d.progress * 100} tone={d.progress >= 1 ? 'good' : 'gov'} label={d.progressLabel} />
      <div class="demand__foot num">
        <span>{d.progressLabel}</span>
        <span>
          <span class="is-good">+{d.reward}</span> / <span class="is-bad">−{d.penalty}</span> {t('conf.')}
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
    <Section title={t('Safety gap')} icon="safeguards">
      <div class="panel gap">
        <div class="kvs">
          <div class="kvs__head">
            <span class="kv__k">{t('Domestic frontier · {company}', { company: n.frontierLeader })}</span>
            <EstimateLine est={n.capability} unit={t('CI')} />
          </div>
          <RangeBar est={n.capability} tone="warn" />
        </div>
        <div class="kvs">
          <div class="kvs__head">
            <span class="kv__k">{t('National safeguards')}</span>
            <span class="num">{one(n.safeguards)}</span>
          </div>
          <RangeBar est={{ value: n.safeguards, low: n.safeguards, high: n.safeguards, confidence: 'verified' }} tone="good" />
        </div>
        <p class={cx('gap__verdict', `is-${tone}`)}>
          <span class="gap__num num">{gap > 0 ? '+' : ''}{one(gap)}</span>
          <span>
            {gap <= 0
              ? t('Safeguards are ahead of capability. Keep it that way.')
              : gap <= 1.5
                ? t('Capability is outrunning your ability to control it.')
                : t('Dangerous gap. Every deployment now carries serious hidden risk.')}
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
    <Section title={t('Programs')} icon="budget" aside={<span class="dim small">{t('Free to change · upkeep each quarter')}</span>}>
      <div class="budgetstrip">
        <div>
          <span class="eyebrow">{t('Treasury')}</span>
          <span class="num budgetstrip__v">{money(n.budget)}</span>
        </div>
        <div>
          <span class="eyebrow">{t('Income')}</span>
          <span class="num budgetstrip__v is-good">{money(n.income, true)}</span>
        </div>
        <div>
          <span class="eyebrow">{t('Upkeep')}</span>
          <span class="num budgetstrip__v is-bad">{money(-n.upkeep)}</span>
        </div>
        <div>
          <span class="eyebrow">{t('Net / q')}</span>
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
        <span class="program__cost num">{p.costs[p.level] ? t('{amount}/q', { amount: money(-p.costs[p.level]) }) : t('Free')}</span>
      </div>
      <div class="stepper" role="radiogroup" aria-label={t('{program} funding level', { program: p.name })}>
        {[0, 1, 2, 3].map((l) => (
          <button
            type="button"
            key={l}
            role="radio"
            aria-checked={l === p.level}
            aria-label={t('Level {n}: {text}, upkeep {cost} billion', { n: l, text: p.levelText[l], cost: p.costs[l] })}
            class={cx('stepper__btn', l <= p.level && l > 0 && 'is-filled', l === p.level && 'is-current')}
            onClick={() => l !== p.level && setProgram(p.id, l)}
          >
            <span class="stepper__lvl">{l === 0 ? t('Off') : t('L{n}', { n: l })}</span>
            <span class="stepper__cost num">{money(p.costs[l])}</span>
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
    <Section title={t('Policies')} icon="policy" aside={<span class="dim small">{t('{n} in force', { n: active.length })}</span>}>
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
    <details class={cx('law', p.active && 'law--active')}>
      <summary class="law__head">
        <span class="law__icon">
          <Icon name={p.icon} size={18} />
        </span>
        <h3 class="law__name">{p.name}</h3>
        {p.active && <span class="law__inforce">{t('In force')}</span>}
      </summary>
      <p class="law__desc">{p.description}</p>
      <ul class="law__fx">
        {p.effectsText.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <footer class="law__foot">
        <span class={cx('law__support', `is-${supportTone}`)}>
          <Icon name="government" size={13} /> {SUPPORT_TEXT[String(p.leaderSupport)] ?? t('Indifferent')}
        </span>
        <span class={cx('law__cost num', cost > 0 ? 'is-bad' : cost < 0 ? 'is-good' : '')}>
          {cost > 0 ? t('−{n} conf.', { n: cost }) : cost < 0 ? t('+{n} conf.', { n: -cost }) : t('No political cost')}
        </span>
        <button
          type="button"
          class={cx('btn btn--small', p.active ? 'btn--ghost' : 'btn--accent', blocked && 'is-blocked')}
          onClick={() => openAction(p.active ? 'repeal_policy' : 'enact_policy', p.id)}
        >
          {p.active ? t('Repeal') : t('Enact')} · 1◆
        </button>
      </footer>
    </details>
  );
}

function Society(): JSX.Element {
  const { view } = useGame();
  const n = view.nation;
  return (
    <Section title={t('Society & economy')} icon="adoption">
      <div class="panel society">
        <h4 class="eyebrow">{t('AI adoption by sector')}</h4>
        <ul class="sectors">
          {SECTORS.map((s) => {
            const v = n.adoption[s];
            const tgt = n.adoptionTarget[s];
            return (
              <li key={s} class="sectorrow">
                <span class="sectorrow__name">
                  <Icon name={SECTOR_INFO[s].icon} size={15} /> {SECTOR_INFO[s].name}
                </span>
                <Bar value={v} ghost={tgt} tone="accent" label={t('{sector} adoption {n} percent, heading to {target}', { sector: SECTOR_INFO[s].name, n: Math.round(v), target: Math.round(tgt) })} />
                <span class="sectorrow__v num">
                  {Math.round(v)}%{Math.round(tgt) !== Math.round(v) && <span class="dim"> → {Math.round(tgt)}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p class="dim small legend">
          <span class="legend__ghost" aria-hidden="true" /> {t('target the sector is moving toward')}
        </p>
        <div class="society__tiles">
          <div class="stat">
            <span class="eyebrow">{t('Dependence')}</span>
            <span class="stat__v num">{Math.round(n.dependence)}</span>
            <Bar value={n.dependence} tone={n.dependence > 60 ? 'warn' : 'accent'} thin label={t('Dependence')} />
            <span class="stat__hint">{t('Suspending models hurts more as this grows')}</span>
          </div>
          <div class="stat">
            <span class="eyebrow">{t('Job displacement')}</span>
            <span class={cx('stat__v num', n.displacement > 40 && 'is-bad')}>{Math.round(n.displacement)}</span>
            <Bar value={n.displacement} tone={n.displacement > 40 ? 'bad' : n.displacement > 20 ? 'warn' : 'good'} thin label={t('Displacement')} />
            <span class="stat__hint">{t('Erodes stability unless workers are supported')}</span>
          </div>
        </div>
      </div>
    </Section>
  );
}
