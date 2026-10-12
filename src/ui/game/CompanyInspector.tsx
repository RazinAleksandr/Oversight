/** Contextual investigation: one target, live fogged facts, explicit cost and return. */
import type { JSX } from 'preact';
import type { ActionResult, Card, ChoiceResult, TraitView } from '../../engine/types';
import { t, tp } from '../../i18n';
import { dateLabel } from '../../engine/labels';
import { Sheet } from '../components/Sheet';
import { ChangeChip, ConfBadge, CostChips, PreviewChip, mergeChanges } from '../components/Chips';
import { money, one } from '../util';
import { choiceBlock } from './Briefing';
import { useGame } from './context';

function traitLabel(trait: TraitView): string {
  const labels: Record<TraitView['label'], string> = { Low: t('Low'), Medium: t('Medium'), High: t('High'), Unknown: t('Unknown') };
  return `${labels[trait.label]}${trait.value === null ? '' : ` · ${Math.round(trait.value)}`}`;
}

export function CompanyInspector({ card, onReturn, onInvestigate, error }: {
  card: Card; onReturn(): void; onInvestigate(companyId: string): void; error?: string | null;
}): JSX.Element {
  const { view, actions } = useGame();
  const model = view.models.find(m => m.id === card.ctx.modelId);
  const company = view.companies.find(c => c.id === model?.companyId);
  const action = actions.find(a => a.id === 'investigate_company');
  const target = action?.targets?.find(t => t.id === company?.id);
  const deepEvaluation = card.choices.find(c => c.id === 'deep_eval' && !choiceBlock(c, { capacity: view.nation.capacity, budget: view.nation.budget, evidence: view.nation.evidence.length }));
  const blocked = action?.disabled ?? target?.disabled ?? (!action || !target ? t('That action is not available right now.') : null);
  return <Sheet size="page" closeButton={false} label={t('Company investigation')} onClose={onReturn} class="pilot-inspector">
    <header class="pilot-inspector__bar" data-company-inspector>
      <button type="button" data-return-decision onClick={onReturn}>← {t('Return to decision')}</button>
      <span>{model?.name}</span>
      <span class="pilot-inspector__resources">{money(view.nation.budget)} · {tp(view.nation.capacity, '{n} action', '{n} actions')}</span>
    </header>
    <main class="pilot-inspector__body">
      <section class="pilot-inspector__record">
        <p class="pilot-inspector__eyebrow">{t('Company record')}</p>
        <h1>{company?.name ?? card.source.name}</h1>
        {company && <>
          <dl class="pilot-inspector__facts">
            <div><dt>{t('Capability estimate')}</dt><dd>{one(company.capability.low)}–{one(company.capability.high)} <ConfBadge c={company.capability.confidence} /></dd></div>
            <div><dt>{t('Relation')}</dt><dd>{Math.round(company.relation)}</dd></div>
            <div><dt>{t('Safety culture')}</dt><dd>{traitLabel(company.safety)}</dd></div>
            <div><dt>{t('Transparency')}</dt><dd>{traitLabel(company.transparency)}</dd></div>
            <div><dt>{t('Ambition')}</dt><dd>{traitLabel(company.ambition)}</dd></div>
          </dl>
          <p class="pilot-inspector__note">{company.investigatedTurn === null ? t('Never investigated') : t('Investigated {date}', { date: company.investigatedTurn > 0 ? dateLabel(company.investigatedTurn) : t('Before term') })}</p>
          {company.knownViolations.length > 0 && <section><h2>{t('Known violations')}</h2><ul>{company.knownViolations.map(v => <li key={v.id}>{v.description}</li>)}</ul></section>}
          <p>{company.description}</p>
        </>}
      </section>
      <section class="pilot-inspector__purpose">
        <h2>{t('What this investigation tells you')}</h2>
        <p>{action?.description}</p>
        <p>{t('This checks the company. It does not repeat the model evaluation or guarantee that the model is safe.')}</p>
        {deepEvaluation && <p>{t('To test this model further, return to the decision and order a deep evaluation.')}</p>}
      </section>
    </main>
    <footer class="pilot-inspector__footer">
      <div class="pilot-inspector__cost">
        <span>{t('Investigation cost')}</span>
        <CostChips cost={action?.cost} />
        {target?.preview?.map((p, i) => <PreviewChip key={i} p={p} />)}
        {(error || blocked) && <p role="status" class="pilot-inspector__blocked">{error || blocked}</p>}
      </div>
      <button type="button" data-confirm-investigation class="pilot-inspector__confirm" disabled={!!blocked} onClick={() => company && onInvestigate(company.id)}>{t('Investigate company')}</button>
    </footer>
  </Sheet>;
}

export function PilotOutcome({ result, investigation = false, onNext, onDesk, remaining = 0 }: {
  result: ActionResult | ChoiceResult; investigation?: boolean; onNext(): void; onDesk?(): void; remaining?: number;
}): JSX.Element {
  const { view } = useGame();
  const revealed = 'revealed' in result ? result.revealed ?? [] : [];
  const changes = mergeChanges(result.changes);
  return <Sheet size="page" closeButton={false} label={investigation ? t('Investigation complete') : t('Decision recorded')} class="pilot-inspector pilot-outcome">
    <header class="pilot-inspector__bar" data-inspection-result={investigation || undefined} data-pilot-result={!investigation || undefined}>
      <span>{view.dateLabel}</span>
      <strong>{investigation ? t('Company investigation') : t('Decision recorded')}</strong>
      <span class="pilot-inspector__resources">{money(view.nation.budget)} · {tp(view.nation.capacity, '{n} action', '{n} actions')}</span>
    </header>
    <main class="pilot-inspector__body pilot-outcome__body">
      <section>
        <p class="pilot-outcome__stamp">{investigation ? t('File updated') : t('Decision recorded')}</p>
        <h1>{result.title}</h1>
        <p>{result.text}</p>
        {result.success !== undefined && <p><strong>{result.success ? t('It worked') : t('It failed')}</strong></p>}
        {changes.length > 0 && <ul class="pilot-outcome__changes">{changes.map((c, i) => <li key={i}><ChangeChip c={c} /></li>)}</ul>}
        {!!revealed.length && <><h2>{t('Investigation findings')}</h2><ul class="pilot-outcome__findings">{revealed.map((line, i) => <li key={i}>{line}</li>)}</ul></>}
        {investigation && <p class="pilot-inspector__note">{t('These findings update the company record. The original model evaluation remains a separate report. A negative investigation is not proof of safety.')}</p>}
      </section>
    </main>
    <footer class="pilot-inspector__footer result__actions">
      {!investigation && onDesk && !result.gameOver && remaining > 0 && !('nextCardUid' in result && result.nextCardUid) && <button type="button" onClick={onDesk}>{t('Back to desk')}</button>}
      <button type="button" data-return-decision={investigation || undefined} class="pilot-inspector__confirm btn--primary" onClick={onNext}>
        {result.gameOver ? t('See what happened') : investigation ? t('Return to decision') : 'nextCardUid' in result && result.nextCardUid ? t('Continue') : remaining > 0 ? t('Next briefing ({n})', { n: remaining }) : t('Back to desk')}
      </button>
    </footer>
  </Sheet>;
}
