/** One decision language for every authored card: read, compare, investigate, commit. */
import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Card, Choice, EffectPreview, ModelView, TabId } from '../../engine/types';
import { FLAW_FLAVOR } from '../../content/situations';
import { PREVIEW_INFO, SOURCE_INFO } from '../../engine/labels';
import { t, tp } from '../../i18n';
import { Sheet } from '../components/Sheet';
import { ChanceBadge, ConfBadge, CostChips, PreviewChip, UncertainChip } from '../components/Chips';
import { Icon, Portrait, Svg, artCached } from '../components/Icon';
import { changeText, cx, hash, money, one } from '../util';
import { advisorInfo, useGame } from './context';
import { choiceBlock, parseControl } from './Briefing';
import { DemandForecast } from './DemandForecast';
import type { WorkspaceReading } from './taskDraft';

export interface DecisionWorkspaceProps {
  card: Card;
  selectedId: string | null;
  onSelect(id: string): void;
  onClose(): void;
  onChoose(choice: Choice): void;
  onInspect(companyId: string): void;
  reading: WorkspaceReading;
  onReadingChange(next: WorkspaceReading): void;
  onManage?(tab: TabId, section?: string, target?: string): void;
}

function findingText(model: ModelView): string {
  if (model.flaw === 'unknown') return model.lastCheck ? t('No confirmed flaw') : t('Not independently evaluated');
  if (model.flaw === 'none_found') return t('No issues found in the last check');
  if (model.flaw === 'suspected') return t('Suspected flaw');
  return FLAW_FLAVOR[model.flaw]?.name ?? t('Known finding');
}
function comparisonEffect(p: EffectPreview): string {
  const label = p.key === 'adoption' ? t('Adoption target') : p.key === 'confidence' ? t('Confidence') : p.key === 'company' ? t('Relations') : p.label ?? PREVIEW_INFO[p.key].label;
  return `${label} ${p.dir === 0 ? '?' : p.amount !== undefined ? changeText(p.key, p.amount) : p.dir > 0 ? '↑' : '↓'}`;
}

/** Export name retained for saved task routing; the workspace now renders all Card kinds. */
export function DeploymentWorkspace({ card, selectedId, onSelect, onClose, onChoose, onInspect, reading, onReadingChange, onManage }: DecisionWorkspaceProps): JSX.Element {
  const { view } = useGame();
  const model = view.models.find(m => m.id === card.ctx.modelId);
  const company = view.companies.find(c => c.id === (card.ctx.companyId ?? model?.companyId));
  const selected = card.choices.find(c => c.id === selectedId);
  const resources = { capacity: view.nation.capacity, budget: view.nation.budget, evidence: view.nation.evidence.length };
  const blocked = selected ? choiceBlock(selected, resources) : null;
  const forecast = view.government.demands.find(d => d.id === card.ctx.demandId)?.forecast;
  const readerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const currentReading = useRef(reading); currentReading.current = reading;
  const section = reading.section === 'effects' && selected ? 'effects' : 'brief';
  const scrollKey = section === 'effects' ? 'effects' : reading.section === 'evidence' ? 'evidence' : 'brief';
  const knownConcern = !!model && !['unknown', 'none_found'].includes(model.flaw);
  const control = parseControl(selected?.hint);
  const cardTitle = card.kind === 'deployment' && model ? model.name : card.title;
  const evidence = [...(card.evidence?.filter(e => e.confidence === 'verified') ?? []), ...(card.evidence?.filter(e => e.confidence !== 'verified') ?? [])];
  const canInspect = !!company && card.kind === 'deployment';
  const contexts: { label: string; tab: TabId; section?: string; target?: string }[] = [];
  if (onManage) {
    if (card.ctx.demandId || card.kind === 'demand') contexts.push({ label: t('Government'), tab: 'nation', section: 'government', target: card.ctx.demandId });
    else if (card.ctx.situationId) contexts.push({ label: t('Threat response'), tab: 'threats', target: card.ctx.situationId });
    else if (card.ctx.rivalId || ['treaty', 'negotiation'].includes(card.kind)) contexts.push({ label: t('Diplomacy'), tab: 'world', section: card.ctx.rivalId ?? 'overview', target: card.ctx.rivalId });
    else if (!canInspect && card.ctx.companyId) contexts.push({ label: t('Company record'), tab: 'labs', target: card.ctx.companyId });
  }
  const saveScroll = (name: keyof WorkspaceReading['scroll'], value: number) => {
    const latest = currentReading.current;
    if (Math.abs(latest.scroll[name] - value) >= 1) onReadingChange({ ...latest, scroll: { ...latest.scroll, [name]: value } });
  };
  const read = (next: 'brief' | 'effects') => {
    const latest = currentReading.current;
    onReadingChange({ ...latest, section: next, pane: 'brief', scroll: { ...latest.scroll, [scrollKey]: readerRef.current?.scrollTop ?? latest.scroll[scrollKey] } });
  };
  const pick = (id: string) => {
    const latest = currentReading.current;
    onSelect(id);
    onReadingChange({ ...latest, section: 'effects', scroll: { ...latest.scroll, [scrollKey]: readerRef.current?.scrollTop ?? latest.scroll[scrollKey], effects: 0 } });
    if (readerRef.current) readerRef.current.scrollTop = 0;
  };
  useLayoutEffect(() => { if (readerRef.current) readerRef.current.scrollTop = reading.scroll[scrollKey]; }, [scrollKey, reading.pane]);
  useLayoutEffect(() => { if (optionsRef.current) optionsRef.current.scrollTop = reading.scroll.options; }, [reading.pane]);
  const sourceArt = company
    ? <Svg html={artCached.logo(hash(company.id), company.color, company.archetype, 64)} label={company.name} />
    : card.source.type === 'government' ? <Portrait seed={view.government.portraitSeed} role="leader" size={64} name={view.government.leaderName} />
      : <Svg html={artCached.emblem(view.country.id, 64)} label={view.country.name} />;
  return <Sheet size="page" class="deployment-workspace decision-v4" label={t('Briefing: {title}', { title: card.title })} closeButton={false} onClose={onClose}>
    <div class="dv4-shell" data-workspace data-uid={card.uid} data-pane={reading.pane} data-kind={card.kind}>
      <header class="dv4-command">
        <button type="button" class="dv4-back" onClick={onClose}><Icon name="back" size={18} />{t('Desk')}</button>
        <nav class="dv4-modes" aria-label={t('Reading view')}>
          <button type="button" data-workspace-mode="brief" data-workspace-reader="brief" class={cx(section === 'brief' && reading.pane === 'brief' && 'is-active')} aria-pressed={section === 'brief' && reading.pane === 'brief'} onClick={() => read('brief')}>{t('Briefing')}</button>
          <button type="button" data-workspace-reader="effects" class={cx(section === 'effects' && reading.pane === 'brief' && 'is-active')} aria-pressed={section === 'effects' && reading.pane === 'brief'} disabled={!selected} onClick={() => read('effects')}>{t('Selected effects')}</button>
          <button type="button" data-workspace-mode="options" class={cx('dv4-options-mode', reading.pane === 'options' && 'is-active')} aria-pressed={reading.pane === 'options'} onClick={() => onReadingChange({ ...currentReading.current, pane: 'options' })}>{t('Responses')} <span>{card.choices.length}</span></button>
        </nav>
        <div class="dv4-context-actions">
          {canInspect && <button type="button" data-inspect-company data-workspace-inspect onClick={() => onInspect(company!.id)}><Icon name="investigate" size={18} />{t('Company record')}</button>}
          {contexts.map(c => <button key={`${c.tab}-${c.section}`} type="button" data-open-management={c.tab} onClick={() => onManage?.(c.tab, c.section, c.target)}>{c.label}<Icon name="chevron_right" size={17} /></button>)}
        </div>
      </header>
      <main class="dv4-board">
        <section class="dv4-reader" aria-label={t('Briefing')}>
          <div class="dv4-reader-scroll workspace-reader-scroll" ref={readerRef} onScroll={e => saveScroll(scrollKey, e.currentTarget.scrollTop)}>
            {section === 'brief' ? <>
              <header class="dv4-source"><div class="dv4-source-art">{sourceArt}</div><div><span>{SOURCE_INFO[card.source.type].label}</span><strong>{card.source.name}</strong><small>{view.dateLabel}{card.urgency === 'critical' ? ` · ${t('Urgent')}` : ''}</small></div></header>
              <h1 class="dv4-title">{cardTitle}</h1>
              {model && <section class={cx('dv4-intelligence workspace-finding', knownConcern && 'has-concern')} aria-label={t('Evaluation record')}>
                <p><Icon name={knownConcern ? 'warning' : 'eye'} size={16} /><strong>{findingText(model)}</strong>{model.lastCheck?.confidence && <ConfBadge c={model.lastCheck.confidence} />}</p>
                <div class="dv4-baseline"><span>{t('Capability')} <b>{one(model.capability.low)}–{one(model.capability.high)}</b> <ConfBadge c={model.capability.confidence} /></span><span>{t('Safeguards')} <b>{one(view.nation.safeguards)}</b></span></div>
                {!knownConcern && <p class="dv4-caution">{t('A negative result is not proof of safety.')}</p>}
              </section>}
              <div class="dv4-story">{card.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>
              {forecast && <DemandForecast forecast={forecast} />}
              {!!evidence.length && <section class="dv4-record"><h2>{t('Evidence')}</h2><dl>{evidence.map((e, i) => <div key={i}><dt>{e.label}<ConfBadge c={e.confidence} /></dt><dd>{e.confidence === 'redacted' ? t('Redacted') : e.value}</dd></div>)}</dl></section>}
              {!!card.advisors?.length && <section class="dv4-advice"><h2>{t('Advisors')}</h2>{card.advisors.map(note => { const a = advisorInfo(view, note.advisor); return <figure key={note.advisor}><Portrait seed={a.portraitSeed} role="advisor" size={44} name={a.name} /><figcaption>{a.role}</figcaption><blockquote>{note.text}</blockquote></figure>; })}</section>}
              {card.kind === 'deployment' && <p class="dv4-note">{t('Approval raises an adoption target. Actual use grows over later quarters. Investigating costs time and resources, but can reveal missed problems.')}</p>}
              {card.kind === 'threshold' && <p class="dv4-note">{t('Control is uncertain even after strong preparation. The range is an estimate; this decision can end the run.')}</p>}
              {company?.investigatedTurn !== null && company?.investigatedTurn !== undefined && <p class="dv4-note">{t('Company intelligence updated. The evaluation record below is unchanged.')}</p>}
            </> : selected && <section class="dv4-effects" aria-live="polite">
              <p class="dv4-section-label">{t('Selected effects')}</p>
              <h1 class="dv4-title">{selected.label}</h1>
              {model && <p class={cx('dv4-evaluation-reminder workspace-finding', knownConcern && 'has-concern')}><Icon name={knownConcern ? 'warning' : 'eye'} size={16} />{findingText(model)}{model.lastCheck?.confidence && <ConfBadge c={model.lastCheck.confidence} />}</p>}
              {(control?.rest ?? selected.hint) && <p>{control?.rest ?? selected.hint}</p>}
              {control && <div class="dv4-control"><span>{t('Control')}</span><strong>{control.low}–{control.high}%</strong></div>}
              {selected.chance !== undefined && <ChanceBadge chance={selected.chance} />}
              <div class="dv4-effect-list">{selected.preview.map((p, i) => <PreviewChip key={i} p={p} adoptionTarget={card.kind === 'deployment'} />)}</div>
              {selected.uncertain && <UncertainChip />}
              {selected.preview.some(p => p.key === 'adoption') && card.kind === 'deployment' && <p class="dv4-note">{t('Adoption changes over later quarters, not immediately.')}</p>}
              <div class="dv4-cost-detail"><strong>{t('Resource cost')}</strong>{selected.cost ? <CostChips cost={selected.cost} /> : <span>{money(0)} · {tp(0, '{n} action', '{n} actions')}</span>}</div>
              {blocked && <p class="dv4-blocked" role="status">{blocked}</p>}
              <button type="button" class="dv4-reading-return" onClick={() => read('brief')}><Icon name="back" size={17} />{t('Return to briefing')}</button>
            </section>}
          </div>
        </section>
        <section class="dv4-options" aria-label={t('Your decision')}>
          <div class="dv4-options-caption"><span>{t('Your decision')}</span><span>{card.choices.length} · {t('Scroll to compare all responses')}</span></div>
          <div class="dv4-choice-list workspace-choice-list" ref={optionsRef} role="radiogroup" aria-label={t('Your decision')} onScroll={e => saveScroll('options', e.currentTarget.scrollTop)} onKeyDown={e => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault(); const i = card.choices.findIndex(c => c.id === selectedId);
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? card.choices.length - 1 : (i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + card.choices.length) % card.choices.length;
            pick(card.choices[next].id); e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-choice]')[next]?.focus({ preventScroll: true });
          }}>
            {card.choices.map((choice, i) => {
              const reason = choiceBlock(choice, resources);
              const previews = [...choice.preview.filter(p => p.key === 'adoption'), ...choice.preview.filter(p => p.key === 'confidence'), ...choice.preview.filter(p => p.key !== 'adoption' && p.key !== 'confidence')].slice(0, 2);
              return <button key={choice.id} type="button" class={cx('dv4-choice', selectedId === choice.id && 'is-selected', !!reason && 'is-blocked')} role="radio" aria-checked={selectedId === choice.id} aria-label={reason ? `${choice.label}: ${reason}` : choice.label} data-choice={i + 1} data-blocked={!!reason} tabIndex={selectedId ? selectedId === choice.id ? 0 : -1 : i === 0 ? 0 : -1} onClick={() => pick(choice.id)}>
                <span class="dv4-choice-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><strong class="dv4-choice-label">{choice.label}</strong>
                <span class="dv4-choice-summary">{previews.length ? previews.map(comparisonEffect).join(' · ') : choice.hint}</span>
                <span class="dv4-choice-cost">{choice.cost ? <CostChips cost={choice.cost} /> : <>{money(0)} · {tp(0, '{n} action', '{n} actions')}</>}{reason && <Icon name="lock" size={15} />}</span>
              </button>;
            })}
          </div>
        </section>
      </main>
      <footer class="dv4-dock">
        <div class="dv4-resources workspace-resources"><span>{t('Available')}</span><strong>{money(resources.budget)}</strong><span>{tp(resources.capacity, '{n} action', '{n} actions')}</span></div>
        <button type="button" class="dv4-confirm" data-confirm-choice disabled={!selected || !!blocked} aria-label={selected ? t('Confirm: {choice}', { choice: selected.label }) : t('Your decision')} onClick={() => selected && !blocked && onChoose(selected)}>{blocked ? t('Unavailable') : t('Confirm')}<Icon name="chevron_right" size={18} /></button>
      </footer>
    </div>
  </Sheet>;
}
