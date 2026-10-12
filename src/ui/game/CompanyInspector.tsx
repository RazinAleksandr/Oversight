/** Contextual investigation: one target, live fogged facts, explicit cost and return. */
import type { JSX } from 'preact';
import type { ActionResult, Card, ChoiceResult, TraitView } from '../../engine/types';
import { t, tp } from '../../i18n';
import { dateLabel } from '../../engine/labels';
import { Icon, Svg, artCached } from '../components/Icon';
import { ResolutionPage } from './Results';
import { Sheet } from '../components/Sheet';
import { ConfBadge, CostChips, PreviewChip } from '../components/Chips';
import { hash, money, one } from '../util';
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
  const company = view.companies.find(c => c.id === (card.ctx.companyId ?? model?.companyId));
  const action = actions.find(a => a.id === 'investigate_company');
  const target = action?.targets?.find(t => t.id === company?.id);
  const deepEvaluation = card.choices.find(c => c.id === 'deep_eval' && !choiceBlock(c, { capacity: view.nation.capacity, budget: view.nation.budget, evidence: view.nation.evidence.length }));
  const blocked = action?.disabled ?? target?.disabled ?? (!action || !target ? t('That action is not available right now.') : null);
  return <Sheet size="page" closeButton={false} label={t('Company investigation')} onClose={onReturn} class="pilot-inspector inspector-v4 casefile-v5">
    <header class="pilot-inspector__bar" data-company-inspector>
      <button type="button" data-return-decision onClick={onReturn}>← {t('Return to decision')}</button>
      <span>{model?.name}</span>
      <span class="pilot-inspector__resources">{money(view.nation.budget)} · {tp(view.nation.capacity, '{n} action', '{n} actions')}</span>
    </header>
    <main class="pilot-inspector__body">
      <section class="pilot-inspector__record">
        <header class="iv4-company-identity">{company && <Svg html={artCached.logo(hash(company.id), company.color, company.archetype, 72)} label={company.name} />}<div><span>{t('Company record')}</span><h1>{company?.name ?? card.source.name}</h1>{company && <p>{company.ceo}</p>}</div></header>
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
        <p class="casefile-order">{t('Company investigation')}</p>
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
  return <ResolutionPage result={result} investigation={investigation} pilot
    label={investigation ? t('Investigation complete') : t('Decision recorded')}
    primary={result.gameOver ? t('See what happened') : investigation ? t('Return to decision') : 'nextCardUid' in result && result.nextCardUid ? t('Continue') : remaining > 0 ? t('Next briefing ({n})', { n: remaining }) : t('Back to desk')}
    onNext={onNext} onDesk={!investigation && !result.gameOver && remaining > 0 && !('nextCardUid' in result && result.nextCardUid) ? onDesk : undefined} />;
}
