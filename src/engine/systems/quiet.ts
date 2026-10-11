/** Fallback brief for a quarter that would otherwise open with an empty inbox (GDD §1: 1–3 cards). */
import { listJoinL, t, tr } from '../../i18n';
import { makeCard } from '../cards';
import { changeMeter, changeResource } from '../changes';
import { getAdvisor } from '../content';
import { pv, pvConf, pvUnits } from '../preview';
import { fmt } from '../template';
import type { Card, GameState } from '../types';

export const QUIET_CARD = 'sys:quiet';

export function quietCard(s: GameState): Card {
  const spy = getAdvisor('intelligence');
  return makeCard(s, {
    kind: 'event',
    templateId: QUIET_CARD,
    title: t('A quiet quarter'),
    // fmt: a translated advisor name may start in lowercase and is capitalized at a sentence start.
    body: fmt(tr('Nothing on your desk demands a signature this quarter. {spymaster} suggests using the lull before the next storm — the labs never stop moving, even when the headlines do.'), {
      spymaster: spy.name,
    }),
    subtitle: t('Intelligence · Briefing'),
    source: { type: 'intelligence', name: spy.role, id: 'intelligence' },
    urgency: 'routine',
    choices: [
      { id: 'review', label: t("Review the labs' filings"), hint: t('Sharper estimates of the two labs you know least.'), preview: [], uncertain: true, stamp: 'classified', tone: 'safe' },
      {
        id: 'outlook',
        label: t('Publish a quarterly AI outlook'),
        hint: t('Calm the public and show the government is on top of things.'),
        preview: [pv('stability', 2), pvConf(s, 1)],
        stamp: 'noted',
        tone: 'neutral',
      },
      { id: 'retreat', label: t('Hold a planning retreat'), hint: t('One extra action this quarter.'), preview: [pvUnits('capacity', 1)], stamp: 'noted', tone: 'neutral' },
    ],
    ctx: {},
    tags: ['politics'],
  });
}

export function resolveQuietCard(s: GameState, choiceId: string): { ok: boolean; error?: string; text: string } {
  switch (choiceId) {
    case 'review': {
      const targets = [...s.companies].sort((a, b) => a.intel - b.intel).slice(0, 2);
      for (const c of targets) {
        c.intel = Math.min(1, c.intel + 0.2);
        c.lastInvestigatedTurn = c.lastInvestigatedTurn ?? s.turn;
      }
      return { ok: true, text: t('Analysts comb through filings from {companies}. Your estimates sharpen.', { companies: listJoinL(targets.map((c) => c.name)) }) };
    }
    case 'outlook':
      changeMeter(s, 'stability', 2, t('Quarterly AI outlook'));
      changeMeter(s, 'confidence', 1, t('Quarterly AI outlook'));
      return { ok: true, text: t('The outlook is widely read and, for once, widely believed.') };
    case 'retreat':
      changeResource(s, 'capacity', 1, t('Planning retreat'));
      return { ok: true, text: t('Two days away from the inbox. The department comes back with a plan — and time to act on it.') };
  }
  return { ok: false, error: t('Unknown choice'), text: '' };
}
