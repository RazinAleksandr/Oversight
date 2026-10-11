/** Resolves `{token}` placeholders in content text (see TEMPLATE_TOKENS in labels.ts). */
import { type CaseForm, formOf, getLang, t, tr } from '../i18n';
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

/**
 * Interpolates already-translated text: `{token}` inserts the value, `{token:form}` its grammatical
 * form (formOf). English only: "a {x}" takes "an" before a vowel sound and "{x}'s" becomes a proper
 * possessive ("Prometheus Labs'"). Unknown tokens are left as they are.
 */
export function fmt(text: string, values: Record<string, string | number | undefined>): string {
  let out = text;
  if (getLang() === 'en') {
    // "a {rivalAdj}" → "an Atlantic" when the inserted word starts with a vowel sound.
    out = out.replace(/\b([Aa]) \{(\w+)\}/g, (whole, art: string, key: string) => {
      const v = values[key];
      if (v === undefined) return whole;
      return `${takesAn(String(v)) ? (art === 'A' ? 'An' : 'an') : art} ${v}`;
    });
    // "{company}'s" → "Halcyon Labs'" for names ending in s.
    out = out.replace(/\{(\w+)\}['’]s\b/g, (whole, key: string) => {
      const v = values[key];
      return v === undefined ? whole : possessive(String(v));
    });
  }
  const capitalize = getLang() !== 'en';
  return out.replace(/\{(\w+)(?::(\w+))?\}/g, (whole, key: string, form: string | undefined, offset: number, src: string) => {
    const v = values[key];
    if (v === undefined) return whole;
    const value = form ? formOf(String(v), form as CaseForm) : String(v);
    return capitalize && startsSentence(src, offset) ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  });
}

/**
 * True when position `offset` of `text` starts a sentence: at the start, after . ! ? … or a newline
 * (ignoring spaces and opening quotes), or after a dialogue dash at the start of a line. Translated
 * token values may start in lowercase («д-р Аника Рао»), so they are capitalized there.
 */
function startsSentence(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  if (/(^|\n)[ \t ]*—[ \t ]*$/.test(before)) return true;
  const p = before.replace(/[ \t «„"“(]+$/, '');
  return p === '' || /[.!?…\n]$/.test(p);
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
    company: company?.name ?? t('a domestic lab'),
    ceo: company?.ceo ?? t("the company's chief executive"),
    model: ctx.model?.name ?? t('the new model'),
    rival: ctx.rival?.name ?? t('a rival power'),
    rivalAdj: ctx.rival?.adjective ?? t('rival'),
    rivalLeaderTitle: ctx.rival?.leaderTitle ?? t('foreign leader'),
    rivalLab: ctx.rival?.leadLab ?? t('a foreign lab'),
    sector: ctx.sector ? SECTOR_INFO[ctx.sector].name : ctx.situation?.source.sector ? SECTOR_INFO[ctx.situation.source.sector].name : t('the economy'),
    situation: ctx.situation ? situationDisplayName(ctx.situation) : t('the situation'),
    year: String(year),
    quarter: t('Q{q}', { q: quarter }),
    date: dateLabel(Math.min(s.turn, s.maxTurns)),
    scientist: getAdvisor('scientist').name,
    economist: getAdvisor('economist').name,
    chiefOfStaff: getAdvisor('chief_of_staff').name,
    spymaster: getAdvisor('intelligence').name,
    policy: ctx.policy ?? t('the new AI law'),
    leaderShort: s.government.leaderName.split(' ').slice(-1)[0],
  };
  return fmt(tr(template), values);
}
