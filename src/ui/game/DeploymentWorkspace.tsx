/** A task-oriented deployment decision. Only fogged views and authored choice previews are rendered. */
import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Card, Choice, EffectPreview, ModelView } from '../../engine/types';
import { FLAW_FLAVOR } from '../../content/situations';
import { PREVIEW_INFO, SECTOR_INFO } from '../../engine/labels';
import { listJoinL, t, tp } from '../../i18n';
import { Sheet } from '../components/Sheet';
import { ChanceBadge, ConfBadge, CostChips, PreviewChip, UncertainChip } from '../components/Chips';
import { changeText, cx, money, one } from '../util';
import { advisorInfo, useGame } from './context';
import { choiceBlock } from './Briefing';
import type { WorkspaceReading } from './taskDraft';

interface Props {
  card: Card;
  selectedId: string | null;
  onSelect(id: string): void;
  onClose(): void;
  onChoose(choice: Choice): void;
  onInspect(companyId: string): void;
  reading: WorkspaceReading;
  onReadingChange(next: WorkspaceReading): void;
}

/** The engine deliberately exposes these states; never infer a hidden flaw from narrative text. */
function findingText(model: ModelView | undefined): string {
  if (!model || model.flaw === 'unknown') return model?.lastCheck ? t('No confirmed flaw') : t('Not independently evaluated');
  if (model.flaw === 'none_found') return t('No issues found in the last check');
  if (model.flaw === 'suspected') return t('Suspected flaw');
  return FLAW_FLAVOR[model.flaw]?.name ?? t('Known finding');
}

function comparisonEffect(p: EffectPreview): string {
  const label = p.key === 'adoption' ? t('Adoption target') : p.key === 'confidence' ? t('Confidence') : p.key === 'company' ? t('Relations') : p.label ?? PREVIEW_INFO[p.key].label;
  const value = p.dir === 0 ? '?' : p.amount !== undefined ? changeText(p.key, p.amount) : p.dir > 0 ? '↑' : '↓';
  return `${label} ${value}`;
}

export function DeploymentWorkspace({ card, selectedId, onSelect, onClose, onChoose, onInspect, reading, onReadingChange }: Props): JSX.Element {
  const { view } = useGame();
  const model = view.models.find(m => m.id === card.ctx.modelId);
  const company = view.companies.find(c => c.id === card.ctx.companyId);
  const selected = card.choices.find(c => c.id === selectedId);
  const resources = { capacity: view.nation.capacity, budget: view.nation.budget, evidence: view.nation.evidence.length };
  const blocked = selected ? choiceBlock(selected, resources) : null;
  const readerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const currentReading = useRef(reading);
  currentReading.current = reading;
  const section = reading.section === 'effects' && !selected ? 'brief' : reading.section;
  const knownConcern = model && !['unknown', 'none_found'].includes(model.flaw);
  const evaluationConfidence = model?.lastCheck?.confidence;
  const finding = findingText(model);
  const verifiedFindings = card.evidence?.filter(e => e.confidence === 'verified') ?? [];
  const initialEvidence = [...verifiedFindings, ...(card.evidence?.filter(e => e.confidence !== 'verified') ?? [])];
  const summary = model?.openWeights
    ? t('{company} asks to release {model} openly. Anyone could run or modify it.', { company: model.companyName, model: model.name })
    : model ? t('{company} asks to deploy {model} in {sectors}.', { company: model.companyName, model: model.name, sectors: listJoinL(model.sectors.map(s => SECTOR_INFO[s].name)) }) : card.body;
  const saveScroll = (name: keyof WorkspaceReading['scroll'], value: number) => {
    const latest = currentReading.current;
    if (Math.abs(latest.scroll[name] - value) < 1) return;
    onReadingChange({ ...latest, scroll: { ...latest.scroll, [name]: value } });
  };
  const setSection = (next: WorkspaceReading['section']) => {
    const latest = currentReading.current;
    const scroll = { ...latest.scroll, [section]: readerRef.current?.scrollTop ?? latest.scroll[section] };
    onReadingChange({ ...latest, section: next, scroll });
  };
  const setPane = (pane: WorkspaceReading['pane']) => onReadingChange({ ...currentReading.current, pane });
  useLayoutEffect(() => {
    if (readerRef.current) readerRef.current.scrollTop = reading.scroll[section];
  }, [section, reading.pane]);
  useLayoutEffect(() => {
    if (optionsRef.current) optionsRef.current.scrollTop = reading.scroll.options;
  }, [reading.pane]);
  const pick = (id: string) => {
    onSelect(id);
    const latest = currentReading.current;
    onReadingChange({ ...latest, section: 'effects', scroll: { ...latest.scroll, [section]: readerRef.current?.scrollTop ?? latest.scroll[section], effects: 0 } });
    if (readerRef.current) readerRef.current.scrollTop = 0;
  };
  return <Sheet size="page" class="deployment-workspace" label={t('Briefing: {title}', { title: card.title })} closeButton={false} onClose={onClose}>
    <div class="workspace-layout" data-workspace data-pane={reading.pane}>
      <header class="workspace-bar">
        <button class="workspace-back" type="button" onClick={onClose}>{t('Desk')}</button>
        <strong class="workspace-subject">{model?.name ?? card.title}</strong>
        <button class="workspace-inspect" type="button" data-inspect-company data-workspace-inspect onClick={() => onInspect(card.ctx.companyId ?? model?.companyId ?? '')} disabled={!card.ctx.companyId && !model?.companyId} aria-label={t('Company: {company}', { company: company?.name ?? card.source.name })}>{company?.name ?? card.source.name}<span aria-hidden="true"> ↗</span></button>
        <div class="workspace-resources" aria-label={t('Available')}><span>{money(resources.budget)}</span><span>{tp(resources.capacity, '{n} action', '{n} actions')}</span></div>
      </header>
      <nav class="workspace-modes" aria-label={t('Reading view')}>
        <button type="button" data-workspace-mode="brief" class={cx(reading.pane === 'brief' && 'is-active')} aria-pressed={reading.pane === 'brief'} onClick={() => setPane('brief')}>{section === 'effects' && selected ? t('Selected effects') : t('Brief')}</button>
        <button type="button" data-workspace-mode="options" class={cx(reading.pane === 'options' && 'is-active')} aria-pressed={reading.pane === 'options'} onClick={() => setPane('options')}>{t('Compare options')} <span class="workspace-choice-count">({card.choices.length})</span></button>
      </nav>
      <main class="workspace-board">
        <section class="workspace-reader" aria-label={t('Brief')}>
          <div class={cx('workspace-finding', knownConcern && 'has-concern')}>
            <p><strong>{finding}</strong>{evaluationConfidence && <ConfBadge c={evaluationConfidence} />}</p>
            {(model?.flaw === 'none_found' || (model?.flaw === 'unknown' && model.lastCheck)) && <p class="workspace-caution">{t('A negative result is not proof of safety.')}</p>}
            {model && <div class="workspace-baseline"><span>{t('Capability')} <b>{one(model.capability.low)}–{one(model.capability.high)}</b> <ConfBadge c={model.capability.confidence} /></span><span>{t('Safeguards')} <b>{one(view.nation.safeguards)}</b></span></div>}
          </div>
          <nav class="workspace-reader-tabs" aria-label={t('Briefing: {title}', { title: card.title })}>
            {([['brief', t('Brief')], ['evidence', t('Evidence')], ...(selected ? [['effects', t('Selected effects')]] : [])] as [WorkspaceReading['section'], string][]).map(([id, label]) => <button key={id} type="button" data-workspace-reader={id} aria-pressed={section === id} class={cx(section === id && 'is-active')} onClick={() => setSection(id)}>{label}</button>)}
          </nav>
          <div class="workspace-reader-scroll" ref={readerRef} onScroll={e => saveScroll(section, e.currentTarget.scrollTop)}>
            {section === 'brief' && <>
              <p class="workspace-request">{summary}</p>
              <dl class="workspace-evidence">{initialEvidence.map((e, i) => <div key={i}><dt>{e.label} <ConfBadge c={e.confidence} /></dt><dd>{e.confidence === 'redacted' ? t('Redacted') : e.value}</dd></div>)}</dl>
              {card.body.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
              {company?.investigatedTurn !== null && company?.investigatedTurn !== undefined && <p class="workspace-record-note">{t('Company intelligence updated. The evaluation record below is unchanged.')}</p>}
              <button class="workspace-text-link" type="button" onClick={() => setSection('evidence')}>{t('Evidence & advice')} →</button>
            </>}
            {section === 'evidence' && <>
              <h2>{t('Evaluation record')}</h2>
              <dl class="workspace-evidence">{card.evidence?.map((e, i) => <div key={i}><dt>{e.label} <ConfBadge c={e.confidence} /></dt><dd>{e.confidence === 'redacted' ? t('Redacted') : e.value}</dd></div>)}</dl>
              {!!card.advisors?.length && <section class="workspace-advice"><h2>{t('Advisors')}</h2>{card.advisors.map(a => <figure key={a.advisor}><figcaption>{advisorInfo(view, a.advisor).role}</figcaption><blockquote>{a.text}</blockquote></figure>)}</section>}
              <p>{t('Approval raises an adoption target. Actual use grows over later quarters. Investigating costs time and resources, but can reveal missed problems.')}</p>
            </>}
            {section === 'effects' && selected && <section class="workspace-effects" aria-live="polite">
              <h2>{selected.label}</h2>
              {selected.hint && <p>{selected.hint}</p>}
              {selected.uncertain && <UncertainChip />}
              {selected.chance !== undefined && <ChanceBadge chance={selected.chance} />}
              <div class="workspace-effect-list">{selected.preview.map((p, i) => <PreviewChip key={i} p={p} adoptionTarget />)}</div>
              {selected.preview.some(p => p.key === 'adoption') && <p class="workspace-record-note">{t('Adoption changes over later quarters, not immediately.')}</p>}
              <div class="workspace-cost-detail"><strong>{t('Resource cost')}</strong><CostChips cost={selected.cost} />{!selected.cost && <span>{money(0)} · {tp(0, '{n} action', '{n} actions')}</span>}</div>
              {blocked && <p class="workspace-blocked">{blocked}</p>}
            </section>}
          </div>
        </section>
        <section class="workspace-options" aria-label={t('Your decision')}>
          <div class="workspace-options-head"><h2>{t('Your decision')} · {card.choices.length}<small>{t('Scroll to compare all responses')}</small></h2><button type="button" class="workspace-compact-effects" disabled={!selected} onClick={() => onReadingChange({ ...currentReading.current, pane: 'brief', section: 'effects' })}>{t('Selected effects')} →</button></div>
          <div class="workspace-choice-list" ref={optionsRef} role="radiogroup" aria-label={t('Your decision')} onScroll={e => saveScroll('options', e.currentTarget.scrollTop)} onKeyDown={e => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault(); const i = card.choices.findIndex(c => c.id === selectedId);
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? card.choices.length - 1 : (i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + card.choices.length) % card.choices.length;
            pick(card.choices[next].id); e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-choice]')[next]?.focus({ preventScroll: true });
          }}>
            {card.choices.map((choice, i) => {
              const reason = choiceBlock(choice, resources);
              const previews = [...choice.preview.filter(p => p.key === 'adoption'), ...choice.preview.filter(p => p.key === 'confidence'), ...choice.preview.filter(p => p.key !== 'adoption' && p.key !== 'confidence')].slice(0, 2);
              return <button key={choice.id} type="button" class={cx('workspace-choice', selectedId === choice.id && 'is-selected', !!reason && 'is-blocked')} role="radio" aria-checked={selectedId === choice.id} aria-label={reason ? `${choice.label}: ${reason}` : choice.label} data-choice={i + 1} data-blocked={!!reason} tabIndex={selectedId ? selectedId === choice.id ? 0 : -1 : i === 0 ? 0 : -1} onClick={() => pick(choice.id)}>
                <span class="workspace-choice-mark" aria-hidden="true" /><span class="workspace-choice-label">{choice.label}</span>
                <span class="workspace-choice-summary">{previews.length ? previews.map(comparisonEffect).join(' · ') : choice.hint}</span>
                <span class="workspace-choice-cost">{choice.cost ? <CostChips cost={choice.cost} /> : <>{money(0)} · {tp(0, '{n} action', '{n} actions')}</>}{reason && <span class="workspace-lock" aria-hidden="true"> ⊘</span>}</span>
              </button>;
            })}
          </div>
        </section>
      </main>
      <footer class="workspace-footer">
        <p class={cx('workspace-footer-note', !!blocked && 'workspace-blocked')}>{blocked ? <><span class="workspace-blocked-full">{blocked}</span><span class="workspace-blocked-short">{t('Unavailable')}</span></> : (selected ? <>{knownConcern ? finding : t('No confirmed flaw')}<span class="workspace-footer-uncertainty"> · {selected.uncertain ? t('Uncertain consequences') : t('Selected effects')}</span></> : t('Your decision'))}</p>
        <button type="button" class="workspace-confirm" data-confirm-choice disabled={!selected || !!blocked} onClick={() => selected && !blocked && onChoose(selected)}><span>{selected ? t('Confirm: {choice}', { choice: selected.label }) : t('Your decision')}</span>{card.choices.map(choice => <span key={choice.id} class="workspace-confirm-reserve" aria-hidden="true">{t('Confirm: {choice}', { choice: choice.label })}</span>)}</button>
      </footer>
    </div>
  </Sheet>;
}
