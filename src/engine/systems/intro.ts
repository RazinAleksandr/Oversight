/** Turn-1 intro card: country briefing, the leader, and an opening priority choice. */
import { t } from '../../i18n';
import { makeCard } from '../cards';
import { changeAdoptionTarget, changeMeter, changeResource } from '../changes';
import { getCountry, getStanceText } from '../content';
import { addLog } from '../log';
import { pv, pvConf, pvDir } from '../preview';
import { fillTemplate } from '../template';
import { SECTOR_INFO } from '../labels';
import type { Card, GameState } from '../types';

export const INTRO_CARD = 'sys:intro';

function stanceBonus(s: GameState, liked: GameState['government']['stance'], disliked?: GameState['government']['stance']): number {
  const st = s.government.stance;
  return st === liked ? 3 : st === disliked ? -2 : 1;
}

export function introCard(s: GameState): Card {
  const country = getCountry(s.countryId);
  const g = s.government;
  const stance = getStanceText(g.stance);
  const paragraphs = country.intro.map((p) => fillTemplate(s, p, {}));
  const p = { leaderTitle: g.leaderTitle, leader: g.leaderName, bio: g.leaderBio, agenda: stance.label, agendaText: stance.text };
  paragraphs.push(g.leaderBio ? t('{leaderTitle} {leader} — {bio} Their agenda: {agenda}. {agendaText}', p) : t('{leaderTitle} {leader} Their agenda: {agenda}. {agendaText}', p));
  const safetyHas = (s.programs.safety ?? 0) >= 1;
  return makeCard(s, {
    kind: 'intro',
    templateId: INTRO_CARD,
    title: t('Welcome, Director'),
    subtitle: t('{country} · {leaderTitle} {leader}', { country: country.name, leaderTitle: g.leaderTitle, leader: g.leaderName }),
    body: paragraphs.join('\n\n'),
    source: { type: 'government', name: t('Office of the {leaderTitle}', { leaderTitle: g.leaderTitle }) },
    urgency: 'priority',
    evidence: [
      { label: g.leaderTitle, value: `${g.leaderName} (${stance.label})`, confidence: 'verified' },
      { label: country.traitPlus.name, value: country.traitPlus.text, confidence: 'verified' },
      { label: country.traitMinus.name, value: country.traitMinus.text, confidence: 'verified' },
    ],
    choices: [
      {
        id: 'safety',
        label: t('Safety first'),
        hint: safetyHas ? t('Accelerate safety research from day one.') : t('Fund Alignment & Safety Research — free for two quarters.'),
        preview: [pvDir('safeguards', 1), pvConf(s, stanceBonus(s, 'cautious', 'accelerationist'))],
        stamp: 'signed',
        tone: 'safe',
      },
      {
        id: 'growth',
        label: t('Growth first'),
        hint: t('Promise the economy an AI dividend: budget and business adoption up.'),
        preview: [pv('budget', 4), pv('adoption', 3, SECTOR_INFO.business.name), pvConf(s, stanceBonus(s, 'accelerationist', 'cautious'))],
        stamp: 'signed',
        tone: 'neutral',
      },
      {
        id: 'security',
        label: t('Security first'),
        hint: t('Put defense and cyber resilience at the top of the agenda.'),
        preview: [pv('security', 4), pv('adoption', 4, SECTOR_INFO.defense.name), pv('tension', 3), pvConf(s, stanceBonus(s, 'hawk', 'populist'))],
        stamp: 'signed',
        tone: 'aggressive',
      },
    ],
    ctx: {},
    tags: ['politics'],
  });
}

export function resolveIntroCard(s: GameState, choiceId: string): { ok: boolean; error?: string; text: string } {
  const reason = t('Opening priority');
  switch (choiceId) {
    case 'safety':
      if ((s.programs.safety ?? 0) < 1) s.programs.safety = 1;
      s.flags.freeSafetyUntil = 2;
      changeResource(s, 'safeguards', 0.2, reason);
      changeMeter(s, 'confidence', stanceBonus(s, 'cautious', 'accelerationist'), reason);
      addLog(s, t('Opened your tenure with a safety-first agenda.'), true, 'good');
      return { ok: true, text: t('Safety research gets its first real budget. The labs take note.') };
    case 'growth':
      changeResource(s, 'budget', 4, reason);
      changeAdoptionTarget(s, 'business', 3, reason);
      changeMeter(s, 'confidence', stanceBonus(s, 'accelerationist', 'cautious'), reason);
      addLog(s, t('Opened your tenure with a growth-first agenda.'), true, 'neutral');
      return { ok: true, text: t('Industry cheers. Investors circle the date of your first approvals.') };
    case 'security':
      changeMeter(s, 'security', 4, reason);
      changeAdoptionTarget(s, 'defense', 4, reason);
      changeResource(s, 'tension', 3, reason);
      changeMeter(s, 'confidence', stanceBonus(s, 'hawk', 'populist'), reason);
      addLog(s, t('Opened your tenure with a security-first agenda.'), true, 'neutral');
      return { ok: true, text: t('The generals are delighted. Foreign capitals notice.') };
  }
  return { ok: false, error: t('Unknown choice'), text: '' };
}
