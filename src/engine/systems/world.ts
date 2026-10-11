/**
 * International layer (GDD §7): rival progress, breakthroughs, trust, race tension, the Global Accord,
 * defection, export controls, spillover, cyberattacks and espionage. Cards live in worldCards.ts.
 */
import { changeCapability, changeMeter, changeResource, changeRivalTrust } from '../changes';
import { getCountry } from '../content';
import { SECTOR_INFO } from '../labels';
import { bumpStat, highlight, trigger } from '../log';
import { getMods } from '../modifiers';
import { avgTrust, currentEra, domesticBestC } from '../query';
import { lineUsed, markLineUsed } from '../news';
import { rng } from '../rng';
import type { GameState, Rival, SectorId } from '../types';
import { clamp, round1 } from '../util';
import { spawnSituation } from './situations';
import type { TickCtx } from './tick';

export function rivalGrowth(s: GameState, r: Rival): number {
  const mods = getMods(s);
  const ambition = 50 + r.aggression * 40;
  let g = 0.13 * r.compute * 1.15 * (1 + ambition / 250) * (1 + 0.14 * Math.max(0, r.capability - 3));
  if (r.exportControlled) g *= Math.max(0.4, 1 - 0.15 * (1 + mods.exportControlPower));
  if (r.accordMember && !r.defected) g *= 0.8;
  if (r.partnership) g *= 1.03;
  return g;
}

export function rivalSafeguardsGrowth(s: GameState, r: Rival): number {
  let g = 0.04 + r.safetyStance * 0.16;
  if (r.accordMember && !r.defected && s.accord.signed) g += 0.08;
  if (r.partnership) g += 0.03;
  return g;
}

export function tickWorld(s: GameState, tc: TickCtx): void {
  const r = rng(s);
  for (const rv of s.rivals) {
    changeCapability(s, { rivalId: rv.id }, rivalGrowth(s, rv) * r.range(0.7, 1.3), 'Foreign research');
    rv.safeguards = clamp(rv.safeguards + rivalSafeguardsGrowth(s, rv), 0, 10);
    if (r.chance(0.06)) {
      const gain = r.range(0.4, 0.8);
      changeCapability(s, { rivalId: rv.id }, gain, 'Breakthrough');
      trigger(s, 'rival_breakthrough', { rivalId: rv.id });
      const line = `${rv.name} announces an AI breakthrough at ${rv.leadLab}`;
      highlight(s, lineUsed(s, line) ? `${rv.leadLab} (${rv.name}) reports yet another breakthrough` : line, 'bad', 'capability');
      markLineUsed(s, line);
    }
    // Trust drifts toward its baseline; the accord and export controls pull it around.
    const base = getCountry(rv.id).trust[s.countryId] ?? 50;
    let drift = (base - rv.trust) * 0.05;
    if (rv.accordMember && s.accord.signed) drift += 0.5;
    if (rv.exportControlled) drift -= 1;
    if (s.tension >= 70) drift -= 0.5;
    if (Math.abs(drift) > 0.05) changeRivalTrust(s, rv.id, drift, 'Diplomatic climate');
    const floor = rv.accordMember && s.accord.signed ? 0.5 : 0.25;
    rv.intel = Math.max(floor, rv.intel - 0.05);
  }
  checkOvertakes(s, tc);
  tickTension(s);
  tickAccord(s, tc);
  tickForeignThreats(s, tc);
}

/** A rival passing our best lab is a major moment: a card the first two times, a headline after that. */
function checkOvertakes(s: GameState, tc: TickCtx): void {
  const ours = domesticBestC(s);
  for (const rv of s.rivals) {
    const key = `ahead:${rv.id}`;
    const ahead = rv.capability > ours;
    const before = s.flags[key];
    s.flags[key] = ahead;
    if (before === undefined || before === true || !ahead || s.turn < 2) continue;
    const count = typeof s.flags.overtakeCards === 'number' ? s.flags.overtakeCards : 0;
    if (count < 2) {
      s.flags.overtakeCards = count + 1;
      tc.world.push({ kind: 'rival_overtakes', rivalId: rv.id });
    }
  }
}

function tickTension(s: GameState): void {
  const eraRace = { emergence: 0.6, acceleration: 1.0, superhuman: 1.5, threshold: 2.0 }[currentEra(s)];
  changeResource(s, 'tension', eraRace, 'AI race');
  const posture = s.rivals.reduce((t, r) => t + r.aggression, 0) / Math.max(1, s.rivals.length);
  changeResource(s, 'tension', posture, 'Rival posturing');
  for (const src of [...modSourcesTension(s)]) changeResource(s, 'tension', src.value, src.label);
  if (s.accord.signed) changeResource(s, 'tension', -1.5, 'Accord confidence-building');
  const trust = avgTrust(s);
  if (trust >= 60) changeResource(s, 'tension', -0.5, 'Diplomatic ties');
  else if (trust < 30) changeResource(s, 'tension', 0.5, 'Mutual distrust');
  if (s.exportControls) changeResource(s, 'tension', 0.5, 'Export controls');
  if (s.tension > 30) changeResource(s, 'tension', -(s.tension - 30) * 0.03, 'Cooling off');
  if (s.tension >= 70) trigger(s, 'tension_high');
  const open = s.situations.find((x) => !x.resolved && x.type === 'military_escalation');
  const aggressor = [...s.rivals].sort((a, b) => b.aggression - a.aggression)[0];
  if (s.tension >= 100) {
    // Breaking point: a crisis now, whether or not one is already open.
    if (open) {
      open.severity = Math.min(99, open.severity + 20);
      if (!open.detected) open.detected = true;
    } else {
      spawnSituation(s, 'military_escalation', { severity: 72, detected: true, rivalId: aggressor?.id, origin: 'Race tension boiled over' });
    }
    changeResource(s, 'tension', -15, 'Crisis shock');
    highlight(s, 'Race tension hit the breaking point: a military crisis erupts', 'bad', 'missile');
  } else if (s.tension >= 80) {
    // Near the breaking point something gives every few quarters: an incident at sea or in the air.
    if (rng(s).chance(0.35)) {
      if (open) open.severity = Math.min(99, open.severity + 8);
      else spawnSituation(s, 'military_escalation', { severity: 18, rivalId: aggressor?.id, origin: 'Incidents under high race tension' });
      highlight(s, 'Military incidents multiply as race tension runs high', 'bad', 'missile');
    }
    changeResource(s, 'tension', -1.5, 'Pressure valves');
  }
}

function modSourcesTension(s: GameState): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  const def = s.programs.defense ?? 0;
  if (def > 0) out.push({ label: 'Defense & Cyber AI program', value: def });
  if (s.policies.includes('human_in_loop')) out.push({ label: 'Human Control of Weapons', value: -1 });
  const extra = getMods(s).tensionPerTurn - def + (s.policies.includes('human_in_loop') ? 1 : 0);
  if (Math.abs(extra) > 0.01) out.push({ label: 'Other factors', value: extra });
  return out;
}

function tickAccord(s: GameState, tc: TickCtx): void {
  const r = rng(s);
  if (!s.accord.signed) {
    if (avgTrust(s) >= 55) changeResource(s, 'accord', 1, 'Diplomatic momentum');
    if (s.accord.progress >= 100 && !s.flags.accordCardOut) {
      tc.world.push({ kind: 'accord_ready' });
      s.flags.accordCardOut = true;
    }
    return;
  }
  for (const rv of s.rivals) {
    if (!rv.accordMember) continue;
    if (!rv.defected && rv.aggression > 0.55 && r.chance(0.04)) {
      rv.defected = true;
      s.flags[`defectedTurn:${rv.id}`] = s.turn;
    }
    if (rv.defected && !s.flags[`defectionKnown:${rv.id}`] && r.chance(0.1)) {
      s.flags[`defectionKnown:${rv.id}`] = true;
      tc.world.push({ kind: 'defection_found', rivalId: rv.id });
    }
  }
}

function tickForeignThreats(s: GameState, tc: TickCtx): void {
  const r = rng(s);
  // Spillover from reckless rivals.
  for (const rv of s.rivals) {
    const gap = rv.capability - rv.safeguards;
    if (gap > 1.5 && s.turn >= 3 && !s.situations.some((x) => !x.resolved && x.type === 'foreign_spillover' && x.source.rivalId === rv.id)) {
      if (r.chance(0.1 * (gap - 1))) {
        spawnSituation(s, 'foreign_spillover', { rivalId: rv.id, severity: r.range(8, 14), origin: `Spillover from ${rv.name}` });
        s.news.push({ turn: s.turn, outlet: 'Global Wire', text: `${rv.name} reports an AI incident at ${rv.leadLab}; officials insist it is contained`, tone: 'bad' });
      }
    }
  }
  // Cyberattacks once tensions run high.
  const maxAggr = Math.max(...s.rivals.map((x) => x.aggression));
  if (s.tension >= 45 && s.turn >= 3 && r.chance(((s.tension - 35) / 300) * (0.5 + maxAggr))) {
    const attacker = r.weightedPick(s.rivals, (x) => x.aggression + 0.05);
    if (attacker) {
      const sector: SectorId = r.chance(0.5) ? 'infrastructure' : 'business';
      const damage = round1(2 + attacker.capability * 0.5);
      changeMeter(s, 'security', -damage, `Cyberattack by ${attacker.name}`);
      changeMeter(s, 'economy', -1.5, `Cyberattack on ${SECTOR_INFO[sector].name}`);
      tc.world.push({ kind: 'cyberattack', rivalId: attacker.id, sector, damage });
      bumpStat(s, 'cyberattacks');
    }
  }
  // Foreign espionage against our labs.
  for (const rv of s.rivals) {
    const extra = s.countryId === 'meridian' ? 0.15 : 0;
    if (s.turn >= 2 && r.chance(0.04 * (rv.aggression + extra) * (1 + s.tension / 100))) {
      changeCapability(s, { rivalId: rv.id }, 0.15, 'Stolen research');
      s.flags[`spiedOn:${rv.id}`] = (typeof s.flags[`spiedOn:${rv.id}`] === 'number' ? (s.flags[`spiedOn:${rv.id}`] as number) : 0) + 1;
      if (r.chance(0.5)) {
        tc.world.push({ kind: 'espionage_found', rivalId: rv.id });
        trigger(s, 'espionage', { rivalId: rv.id });
      }
    }
  }
  // Foreign export controls on our chips.
  if (!s.flags.exportControlsOnUs && !s.flags.exportControlsEver) {
    // Meridian fabricates the chips, so it is never on the receiving end of chip export controls.
    const p = s.countryId === 'meridian' ? 0 : s.countryId === 'hanzhou' ? (s.turn >= 3 ? 0.18 : 0) : s.tension >= 65 ? 0.04 : 0;
    if (p > 0 && r.chance(p)) {
      const imposer = [...s.rivals].sort((a, b) => b.compute - a.compute)[0];
      if (imposer) {
        s.flags.exportControlsOnUs = imposer.id;
        s.flags.exportControlsEver = true;
        tc.world.push({ kind: 'export_controls_on_us', rivalId: imposer.id });
      }
    }
  }
  // Unauthorized deployments eventually surface.
  for (const m of s.models) {
    if (m.status !== 'rogue_deployed' || s.flags[`rogueKnown:${m.id}`]) continue;
    if (r.chance(0.3)) {
      s.flags[`rogueKnown:${m.id}`] = true;
      tc.world.push({ kind: 'rogue_found', modelId: m.id });
    }
  }
}
