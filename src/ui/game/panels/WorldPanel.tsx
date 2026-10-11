/**
 * World: map, race tension gauge, Global Accord, rival powers (fogged estimates vs. ours) and
 * international actions with target pickers.
 */
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { CountryId, RivalView } from '../../../engine/types';
import { Bar, EstimateLine, Gauge, RangeBar } from '../../components/Bars';
import { ActionChip, PageHead, Section, Trait } from '../../components/Common';
import { Icon, Svg, artCached, isPlaceholder } from '../../components/Icon';
import { cx } from '../../util';
import { actionsFor, useGame } from '../context';
import { ATTITUDE_TONE, relTone } from './LabsPanel';

const tensionLabel = (t: number) => (t >= 90 ? 'Brink of war' : t >= 70 ? 'Escalating' : t >= 40 ? 'Rising' : 'Calm');

export function WorldPanel(): JSX.Element {
  const { view, actions, openAction } = useGame();
  const n = view.nation;
  const worldActions = actionsFor(actions, 'world');
  // Untargeted actions first (export controls, recruitment), then targeted ones (open a target picker).
  const ordered = [...worldActions.filter((a) => !a.targets), ...worldActions.filter((a) => a.targets)];
  return (
    <div class="page page--world">
      <PageHead title="World" sub="Three rival powers are racing too. Our picture of them is incomplete." />
      <div class="world-top">
        <WorldMap />
        <div class="world-gauges">
          <div class={cx('panel gaugecard', n.tension >= 70 && 'is-hot')}>
            <h3 class="eyebrow">
              <Icon name="tension" size={13} /> Race tension
            </h3>
            <Gauge value={n.tension} size={150} />
            <p class="gaugecard__v">
              <span class="num">{Math.round(n.tension)}</span>
              <span class={cx('gaugecard__lbl', n.tension >= 70 ? 'is-bad' : n.tension >= 40 ? 'is-warn' : 'is-good')}>{tensionLabel(n.tension)}</span>
            </p>
          </div>
          <div class={cx('panel gaugecard', n.accord.signed && 'is-signed')}>
            <h3 class="eyebrow">
              <Icon name="accord" size={13} /> Global Accord
            </h3>
            <p class="gaugecard__v">
              <span class="num">{n.accord.signed ? 'Signed' : `${Math.round(n.accord.progress)}%`}</span>
            </p>
            <Bar value={n.accord.progress} tone="good" label="Accord progress" />
            <p class="gaugecard__members">
              {n.accord.members.length ? (
                <>
                  <span class="dim">Supporters:</span>
                  {n.accord.members.map((id) => (
                    <Svg key={id} class="mini-emblem" html={artCached.emblem(id, 20)} label={view.rivals.find((r) => r.id === id)?.name ?? id} />
                  ))}
                </>
              ) : (
                <span class="dim">No supporters yet</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <Section title="Rival powers" icon="foreign">
        <div class="cardgrid">
          {view.rivals.map((r) => (
            <RivalCard key={r.id} r={r} />
          ))}
        </div>
      </Section>

      {ordered.length > 0 && (
        <Section title="International actions" icon="diplomacy">
          <div class="actrow actrow--loose">
            {ordered.map((a) => (
              <ActionChip key={a.id} action={a} onOpen={openAction} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function WorldMap(): JSX.Element {
  const { view } = useGame();
  const ref = useRef<HTMLDivElement>(null);
  const player = view.country.id;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const colors: Partial<Record<CountryId, string>> = { [player]: view.country.color };
    for (const r of view.rivals) colors[r.id] = r.color;
    root.querySelectorAll<SVGGElement>('.region').forEach((g) => {
      const id = g.id.replace('region-', '') as CountryId;
      const c = colors[id];
      if (c) {
        g.style.setProperty('--region', c);
        g.style.color = c;
      }
      g.classList.toggle('is-player', id === player);
    });
  });
  const onClick = (e: MouseEvent) => {
    const g = (e.target as Element).closest?.('.region');
    if (!g) return;
    document.getElementById(`rival-${g.id.replace('region-', '')}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const all = [{ id: player, name: view.country.name, color: view.country.color }, ...view.rivals.map((r) => ({ id: r.id, name: r.name, color: r.color }))];
  return (
    <div class="panel worldmap">
      <div class="worldmap__art" ref={ref} onClick={onClick}>
        {!isPlaceholder(artCached.map(player, 640)) ? <Svg html={artCached.map(player, 640)} label="World map" /> : <FallbackMap player={player} colors={all} />}
      </div>
      <ul class="worldmap__legend">
        {all.map((c) => (
          <li key={c.id} class={cx(c.id === player && 'is-player')}>
            <span class="swatch" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
            {c.id === player && <span class="dim"> (you)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Schematic map shown only while the art module is a stub. */
function FallbackMap({ player, colors }: { player: CountryId; colors: { id: CountryId; color: string; name: string }[] }): JSX.Element {
  const pos: Record<CountryId, [number, number, number]> = { atlantic: [120, 110, 70], commonwealth: [300, 80, 52], hanzhou: [470, 120, 66], meridian: [430, 230, 34] };
  return (
    <svg viewBox="0 0 600 300" width="100%" role="img" aria-label="World map">
      <defs>
        <pattern id="fm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgba(63,208,255,.08)" />
        </pattern>
      </defs>
      <rect width="600" height="300" fill="url(#fm-grid)" />
      {colors.map((c) => {
        const [x, y, r] = pos[c.id];
        return (
          <g key={c.id} class={cx('region', c.id === player && 'is-player')} id={`region-${c.id}`} style={{ color: c.color }}>
            <circle cx={x} cy={y} r={r} fill={c.color} fill-opacity={0.22} stroke={c.color} stroke-width={c.id === player ? 3 : 1.5} />
            <text x={x} y={y + 5} text-anchor="middle" fill="#d8e1f0" font-size="14" font-family="Space Grotesk, sans-serif">
              {c.name.split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RivalCard({ r }: { r: RivalView }): JSX.Element {
  const { view, actions, openAction } = useGame();
  const acts = actionsFor(actions, 'world', r.id);
  const ours = view.nation.capability;
  const ahead = r.capability.value - ours.value;
  return (
    <article class="panel rival" id={`rival-${r.id}`} style={{ '--brand': r.color }}>
      <header class="entity__head">
        <Svg class="entity__logo entity__logo--emblem" html={artCached.emblem(r.id, 48)} />
        <div class="entity__id">
          <h3 class="entity__name">{r.name}</h3>
          <p class="entity__sub">
            <span>{r.leaderTitle}-led</span>
            <span>Lead lab: {r.leadLab}</span>
          </p>
        </div>
        <span class={cx('att', `att--${ATTITUDE_TONE[r.attitude]}`)}>{r.attitude}</span>
      </header>

      <div class="kvs">
        <div class="kvs__head">
          <span class="kv__k">Frontier capability</span>
          <EstimateLine est={r.capability} unit="CI" />
        </div>
        <div class="vsbars">
          <span class="vsbars__lbl">{r.adjective}</span>
          <RangeBar est={r.capability} tone="bad" />
          <span class="vsbars__lbl">You</span>
          <RangeBar est={ours} tone="accent" ticks={false} />
        </div>
        <p class={cx('vsline', ahead > 0.3 ? 'is-bad' : ahead < -0.3 ? 'is-good' : '')}>
          {ahead > 0.3 ? `Likely ahead of you by ~${ahead.toFixed(1)}` : ahead < -0.3 ? `Likely behind you by ~${(-ahead).toFixed(1)}` : 'Roughly level with you'}
        </p>
      </div>

      <div class="kvs">
        <div class="kvs__head">
          <span class="kv__k">Safeguards</span>
          <EstimateLine est={r.safeguards} />
        </div>
        <RangeBar est={r.safeguards} tone="good" />
      </div>

      <div class="kv">
        <span class="kv__k">Trust</span>
        <Bar value={r.trust} tone={relTone(r.trust) as 'good'} label={`Trust ${r.trust}`} />
        <span class="kv__v num">{Math.round(r.trust)}</span>
      </div>

      <div class="traits traits--2">
        <Trait name="Aggression" t={r.aggressionLabel} />
        <Trait name="Safety stance" t={r.safetyLabel} />
      </div>

      <p class="entity__intel">
        <span>
          <Icon name="eye" size={13} /> Intel <span class="num">{Math.round(r.intel * 100)}%</span>
        </span>
        {r.accordMember && <span class="badge badge--good">Accord supporter</span>}
        {r.exportControlled && <span class="badge badge--warn">Export controlled</span>}
        {r.partnership && <span class="badge badge--ai">Research partner</span>}
      </p>

      {acts.length > 0 && (
        <div class="actrow">
          {acts.map((a) => (
            <ActionChip key={a.id} action={a} targetId={r.id} onOpen={openAction} />
          ))}
        </div>
      )}
    </article>
  );
}
