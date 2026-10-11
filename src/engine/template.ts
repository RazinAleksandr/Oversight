/** Resolves `{token}` placeholders in content text (see TEMPLATE_TOKENS in labels.ts). */
import { getAdvisor, getCountry, getSituationFlavor } from './content';
import { SECTOR_INFO, dateLabel, turnYearQuarter } from './labels';
import type { AIModel, Company, Demand, GameState, Rival, SectorId, Situation } from './types';
import { possessive, takesAn } from './util';

export interface TemplateCtx {
  company?: Company;
  rival?: Rival;
  model?: AIModel;
  situation?: Situation;
  sector?: SectorId;
  demand?: Demand;
  policy?: string;
}

/** Player-facing name of a situation, respecting fog of war. */
export function situationDisplayName(x: Situation): string {
  const f = getSituationFlavor(x.type);
  return x.causeKnown || x.stage >= 2 ? f.name : f.unknownName;
}

export function fillTemplate(s: GameState, template: string | undefined, ctx: TemplateCtx = {}): string {
  if (!template) return '';
  const country = getCountry(s.countryId);
  const { year, quarter } = turnYearQuarter(Math.min(s.turn, s.maxTurns));
  const company = ctx.company ?? (ctx.model ? s.companies.find((c) => c.id === ctx.model?.companyId) : undefined);
  const values: Record<string, string | undefined> = {
    country: country.name,
    countryShort: country.shortName,
    countryAdj: country.adjective,
    capital: country.capital,
    leader: s.government.leaderName,
    leaderTitle: s.government.leaderTitle,
    company: company?.name ?? 'a domestic lab',
    ceo: company?.ceo ?? 'the company\'s chief executive',
    model: ctx.model?.name ?? 'the new model',
    rival: ctx.rival?.name ?? 'a rival power',
    rivalAdj: ctx.rival?.adjective ?? 'rival',
    rivalLeaderTitle: ctx.rival?.leaderTitle ?? 'foreign leader',
    rivalLab: ctx.rival?.leadLab ?? 'a foreign lab',
    sector: ctx.sector ? SECTOR_INFO[ctx.sector].name : ctx.situation?.source.sector ? SECTOR_INFO[ctx.situation.source.sector].name : 'the economy',
    situation: ctx.situation ? situationDisplayName(ctx.situation) : 'the situation',
    year: String(year),
    quarter: `Q${quarter}`,
    date: dateLabel(Math.min(s.turn, s.maxTurns)),
    scientist: getAdvisor('scientist').name,
    economist: getAdvisor('economist').name,
    chiefOfStaff: getAdvisor('chief_of_staff').name,
    spymaster: getAdvisor('intelligence').name,
    policy: ctx.policy ?? 'the new AI law',
    leaderShort: s.government.leaderName.split(' ').slice(-1)[0],
  };
  // "a {rivalAdj}" → "an Atlantic" when the inserted word starts with a vowel sound.
  const withArticles = template.replace(/\b([Aa]) \{(\w+)\}/g, (whole, art: string, key: string) => {
    const v = values[key];
    if (v === undefined) return whole;
    return `${takesAn(v) ? (art === 'A' ? 'An' : 'an') : art} ${v}`;
  });
  // "{company}'s" → "Halcyon Labs'" for names ending in s.
  const withPossessives = withArticles.replace(/\{(\w+)\}['’]s\b/g, (whole, key: string) => {
    const v = values[key];
    return v === undefined ? whole : possessive(v);
  });
  return withPossessives.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = values[key];
    return v === undefined ? whole : v;
  });
}
