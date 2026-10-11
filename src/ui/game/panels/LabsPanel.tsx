/**
 * Labs: domestic AI companies — fogged capability estimates, traits, violations, models and company actions.
 */
import type { JSX } from 'preact';
import type { ActionTarget, AIModel, CompanyView, FlawType, ModelView } from '../../../engine/types';
import { ARCHETYPE_INFO, SECTOR_INFO, dateLabel } from '../../../engine/labels';
import { FLAW_FLAVOR } from '../../../content/situations';
import { Bar, EstimateLine, RangeBar } from '../../components/Bars';
import { ActionChip, PageHead, Trait } from '../../components/Common';
import { Icon, Svg, artCached } from '../../components/Icon';
import { cx, hash, one } from '../../util';
import { actionsFor, useGame } from '../context';

const STATUS_LABEL: Record<AIModel['status'], string> = {
  pending: 'Pending review',
  evaluating: 'Under evaluation',
  deployed: 'Deployed',
  limited: 'Sandboxed',
  restricted: 'Restricted',
  suspended: 'Suspended',
  rejected: 'Rejected',
  internal: 'Internal only',
  rogue_deployed: 'Unauthorized',
};

const STATUS_TONE: Record<AIModel['status'], string> = {
  pending: 'accent', evaluating: 'accent', deployed: 'good', limited: 'good', restricted: 'warn', suspended: 'bad', rejected: 'dim', internal: 'dim', rogue_deployed: 'bad',
};

const FLAW_FALLBACK: Record<FlawType, string> = {
  scope_creep: 'Scope creep', deceptive: 'Deceptive', brittle: 'Brittle', manipulative: 'Manipulative', jailbreakable: 'Jailbreakable', power_seeking: 'Power-seeking',
};

function flawName(f: FlawType): string {
  return (FLAW_FLAVOR as Partial<Record<FlawType, { name: string }>>)[f]?.name ?? FLAW_FALLBACK[f];
}

export const ATTITUDE_TONE: Record<string, string> = {
  Cooperative: 'good', Friendly: 'good', Ally: 'good', Neutral: 'neutral', Wary: 'warn', Distrustful: 'warn', Hostile: 'bad',
};

export const relTone = (v: number) => (v >= 60 ? 'good' : v >= 35 ? 'warn' : 'bad');

export function LabsPanel(): JSX.Element {
  const { view } = useGame();
  return (
    <div class="page page--labs">
      <PageHead title="Labs" sub="Domestic AI companies — what they report, and what you actually know." />
      <div class="cardgrid">
        {view.companies.map((c) => (
          <CompanyCard key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

function CompanyCard({ c }: { c: CompanyView }): JSX.Element {
  const { actions, openAction } = useGame();
  const acts = actionsFor(actions, 'labs', c.id).filter((a) => a.id !== 'audit_model');
  const audit = actions.find((a) => a.id === 'audit_model');
  const revoke = actions.find((a) => a.id === 'revoke_model');
  return (
    <article class="panel company" style={{ '--brand': c.color }}>
      <header class="entity__head">
        <Svg class="entity__logo" html={artCached.logo(hash(c.id), c.color, c.archetype, 48)} />
        <div class="entity__id">
          <h3 class="entity__name">{c.name}</h3>
          <p class="entity__sub">
            <span>
              <Icon name={ARCHETYPE_INFO[c.archetype].icon} size={13} /> {ARCHETYPE_INFO[c.archetype].name}
            </span>
            <span>CEO {c.ceo}</span>
          </p>
        </div>
        <span class={cx('att', `att--${ATTITUDE_TONE[c.attitude]}`)}>{c.attitude}</span>
      </header>
      <p class="entity__tag">“{c.tagline}”</p>
      {c.status !== 'active' && (
        <p class="badge badge--bad">
          <Icon name="warning" size={13} /> {c.status === 'sanctioned' ? 'Under sanctions' : 'Suspended'}
        </p>
      )}

      <div class="kv">
        <span class="kv__k">Relation</span>
        <Bar value={c.relation} tone={relTone(c.relation) as 'good'} label={`Relation ${c.relation}`} />
        <span class="kv__v num">{Math.round(c.relation)}</span>
      </div>

      <div class="kvs">
        <div class="kvs__head">
          <span class="kv__k">Capability</span>
          <EstimateLine est={c.capability} unit="CI" />
        </div>
        <RangeBar est={c.capability} />
      </div>

      <div class="traits">
        <Trait name="Safety" t={c.safety} />
        <Trait name="Transparency" t={c.transparency} />
        <Trait name="Ambition" t={c.ambition} />
      </div>

      <p class="entity__intel">
        <span>
          <Icon name="eye" size={13} /> Intel <span class="num">{Math.round(c.intel * 100)}%</span>
        </span>
        <span>{c.investigatedTurn !== null ? `Investigated ${c.investigatedTurn > 0 ? dateLabel(c.investigatedTurn) : 'before term'}` : 'Never investigated'}</span>
        <span>
          <Icon name="evidence" size={13} /> <span class="num">{c.evidenceCount}</span> evidence
        </span>
      </p>

      {c.knownViolations.length > 0 && (
        <ul class="violations" aria-label="Known violations">
          {c.knownViolations.map((v) => (
            <li key={v.id} class="violation">
              <Icon name="warning" size={14} />
              <span>
                <strong>Violation:</strong> {v.description}
              </span>
            </li>
          ))}
        </ul>
      )}

      {c.models.length > 0 && (
        <div class="models">
          <h4 class="eyebrow">Models</h4>
          <ul class="models__list">
            {c.models.map((m) => (
              <ModelRow
                key={m.id}
                m={m}
                canAudit={!!audit && !audit.disabled && !!audit.targets?.some((t) => t.id === m.id && !t.disabled)}
                onAudit={() => audit && openAction('audit_model', m.id)}
                revoke={revoke?.targets?.find((t) => t.id === m.id && !t.disabled) ?? null}
                onRevoke={() => openAction('revoke_model', m.id, m.status === 'restricted' ? 'suspend' : undefined)}
              />
            ))}
          </ul>
        </div>
      )}

      {acts.length > 0 && (
        <div class="actrow">
          {acts.map((a) => (
            <ActionChip key={a.id} action={a} targetId={c.id} onOpen={openAction} />
          ))}
        </div>
      )}
    </article>
  );
}

function ModelRow({
  m,
  canAudit,
  onAudit,
  revoke,
  onRevoke,
}: {
  m: ModelView;
  canAudit: boolean;
  onAudit(): void;
  revoke: ActionTarget | null;
  onRevoke(): void;
}): JSX.Element {
  const { goTab } = useGame();
  let flawText: string;
  let flawTone: string;
  let flawIcon: string;
  if (m.flaw === 'unknown') [flawText, flawTone, flawIcon] = ['Not audited', 'dim', 'question'];
  else if (m.flaw === 'none_found') [flawText, flawTone, flawIcon] = ['No issues found', 'good', 'check'];
  else if (m.flaw === 'suspected') [flawText, flawTone, flawIcon] = ['Flaw suspected', 'warn', 'warning'];
  else [flawText, flawTone, flawIcon] = [`Flaw: ${flawName(m.flaw)}`, 'bad', 'warning'];
  return (
    <li class="model">
      <div class="model__top">
        <span class="model__name">{m.name}</span>
        <span class={cx('mstatus', `mstatus--${STATUS_TONE[m.status]}`)}>{STATUS_LABEL[m.status]}</span>
        {m.openWeights && <span class="mstatus mstatus--ai">Open weights</span>}
        <span class="model__ci num">CI {one(m.capability.value)}</span>
      </div>
      <div class="model__meta">
        {m.sectors.map((s) => (
          <span key={s} class="sector">
            <Icon name={SECTOR_INFO[s].icon} size={12} /> {SECTOR_INFO[s].name}
          </span>
        ))}
      </div>
      <div class="model__bottom">
        <span class={cx('flaw', `flaw--${flawTone}`)}>
          <Icon name={flawIcon} size={13} /> {flawText}
        </span>
        {m.situationId && (
          <button type="button" class="linkbtn" onClick={() => goTab('threats')}>
            Linked threat <Icon name="chevron_right" size={13} />
          </button>
        )}
        {(canAudit || revoke) && (
          <span class="model__actions">
            {canAudit && (
              <button type="button" class="linkbtn linkbtn--action" onClick={onAudit}>
                <Icon name="audit" size={13} /> Audit · 1◆
              </button>
            )}
            {revoke && (
              <button
                type="button"
                class={cx('linkbtn linkbtn--action linkbtn--danger', revoke.disabled && 'is-blocked')}
                onClick={onRevoke}
                aria-label={`${m.status === 'restricted' ? 'Suspend' : 'Restrict or suspend'} ${m.name}${revoke.disabled ? ', unavailable: ' + revoke.disabled : ''}`}
              >
                <Icon name="respond" size={13} /> {m.status === 'restricted' ? 'Suspend' : 'Restrict / Suspend'}
              </button>
            )}
          </span>
        )}
      </div>
    </li>
  );
}
