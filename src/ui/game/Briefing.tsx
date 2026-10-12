import { DeploymentWorkspace } from './DeploymentWorkspace';
import { newReading, type WorkspaceReading } from './taskDraft';
/** A focused decision: inspect the evidence, compare options, then commit explicitly. */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Card, Choice, TabId } from '../../engine/types';
import { getLang, t } from '../../i18n';
import { money } from '../util';
import { useGame } from './context';

/** Reason a choice can't be taken right now (engine-provided, or an affordability check). */
export function choiceBlock(ch: Choice, res: { capacity: number; budget: number; evidence: number }): string | null {
  const c = ch.cost;
  if (!c) return ch.disabled ?? null;
  if (c.capacity && res.capacity < c.capacity) return t('No actions left this quarter');
  if (c.budget && res.budget < c.budget) return t('Need {cost}; available {available}; shortfall {shortfall}.', {
    cost: money(c.budget), available: money(res.budget), shortfall: money(Math.ceil((c.budget - res.budget) * 100) / 100),
  });
  if (c.evidence && res.evidence < c.evidence) return t('You hold no evidence');
  return ch.disabled ?? null;
}

/**
 * The Threshold's choices carry "Estimated control: 70–85%." in their hint (no `chance` on purpose).
 * Translated hints keep the shape "<label>: 70–85%." at the end, so non-English text matches any label.
 */
export function parseControl(hint?: string): { low: number; high: number; rest: string } | null {
  if (!hint) return null;
  const m = /Estimated control:\s*(\d+)\s*[–-]\s*(\d+)%\.?/i.exec(hint) ?? (getLang() === 'en' ? null : /[^.!?:]*:\s*(\d+)\s*[–-]\s*(\d+)\s*%\.?\s*$/.exec(hint));
  if (!m) return null;
  return { low: Number(m[1]), high: Number(m[2]), rest: hint.replace(m[0], '').trim() };
}

export function BriefingSheet({ card, onClose, onChoose, selectedId, onSelect, onManage }: {
  card: Card; onClose(): void; onChoose(ch: Choice): void;
  selectedId?: string | null; onSelect?(id: string): void;
  onManage?(tab: TabId, section?: string, target?: string): void;
}): JSX.Element {
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [reading, setReading] = useState<WorkspaceReading>(newReading);
  const { goTab, selectSection } = useGame();
  const manage = (tab: TabId, section?: string, target?: string) => {
    if (onManage) { onManage(tab, section, target); return; }
    onClose(); if (section) selectSection(tab, section); goTab(tab);
  };
  return <DeploymentWorkspace card={card} selectedId={selectedId === undefined ? localSelected : selectedId}
    onSelect={onSelect ?? setLocalSelected} onClose={onClose} onChoose={onChoose}
    onInspect={id => manage('labs', undefined, id)} onManage={manage}
    reading={reading} onReadingChange={setReading} />;
}
