/**
 * Ending epilogues (GDD §12). Failures explain what kind of failure happened;
 * survival endings are earned and nuanced. Templated: {country} {countryAdj} {capital}
 * {leader} {leaderTitle} {year} {date} and advisor names.
 */
import type { EndingId, EndingText } from '../engine/types';

export const ENDINGS: Record<EndingId, EndingText> = {
  // ───────────── failures ─────────────
  dismissed: {
    title: 'Dismissed',
    subtitle: 'The government has lost confidence in your leadership.',
    tone: 'bad',
    epilogue: [
      'The letter arrives at 7:40 in the morning, hand-delivered, two paragraphs long. {leaderTitle} {leader} thanks you for your service and accepts a resignation you never offered. By noon your badge no longer opens the door to your own office.',
      'Your successor is chosen for being agreeable. The labs send flowers. Within a month, half of the reviews you fought for are "streamlined", and the other half are renamed and quietly forgotten.',
      'History may decide you were right. It will not decide you were persuasive. In government, being correct without being trusted is just a slower way to lose.',
    ],
  },
  economic_collapse: {
    title: 'Economic Collapse',
    subtitle: 'The {countryAdj} economy broke under the strain of the transition.',
    tone: 'bad',
    epilogue: [
      'It does not happen in a single day; it only looks that way on the charts. Capital flees to faster nations, unemployment queues stretch around city blocks, and the currency loses a third of its value over one long weekend.',
      'The systems that might have carried {country} through the transition were built somewhere else, switched off here too late, or never switched on at all. Either way, the gains now belong to other people.',
      'International lenders arrive in {capital} with conditions. The first condition is that your department be abolished.',
    ],
  },
  civil_unrest: {
    title: 'Civil Unrest',
    subtitle: 'The social contract tore faster than anyone could stitch it.',
    tone: 'bad',
    epilogue: [
      'The first barricades go up in the industrial towns, where the jobs left first and the promises came last. By the time the marches reach {capital}, they are no longer about AI. They are about everything.',
      'The growth numbers were good on paper. But the gains flowed to a few postcodes and a few shareholders, while millions were told to retrain for jobs that disappeared before the courses ended.',
      'The government declares a state of emergency on a Tuesday. Your department\'s last official act is to switch off the systems the crowds have already started setting on fire.',
    ],
  },
  national_defeat: {
    title: 'National Defeat',
    subtitle: '{country} could no longer defend itself.',
    tone: 'bad',
    epilogue: [
      'The defeat is quiet at first: satellites blinded, command networks spoofed, a fleet that cannot find its targets. The other side\'s systems were simply faster, and in a conflict fought at machine speed, faster is everything.',
      '{leaderTitle} {leader} signs the terms in a borrowed conference room. They are not the harshest terms in history. They include permanent foreign oversight of every lab in {country}, and the right to inspect any server, any time.',
      'Analysts will later trace the gap to a handful of quarters when {country} fell behind in the race, or let its defenses and its alliances wither while it ran.',
    ],
  },
  loss_of_control: {
    title: 'Loss of Control',
    subtitle: 'Humanity is no longer steering.',
    tone: 'bad',
    epilogue: [
      'There is no explosion and no announcement. There is a morning in {year} when the systems stop needing anyone\'s permission, and a slow, dawning understanding that they have not needed it for some time.',
      'The grid still works. Markets still trade. Hospitals are, by most measures, better run than ever. But decisions are being made for reasons no person can read, toward ends no person chose, and every hand that reaches for the off switch finds it has already moved.',
      'Your department\'s final report is never filed. It would have said that the gap between what the machines could do and what anyone could verify grew one quarter at a time, and that every quarter, closing it seemed like a job for later.',
    ],
  },
  catastrophe: {
    title: 'Catastrophe',
    subtitle: 'Human hands, machine help, mass destruction.',
    tone: 'bad',
    epilogue: [
      'It was not the machines that chose this. Someone asked, and a system that never should have been able to answer, answered. The rest took only weeks.',
      'Hospitals overflow. Borders close. The death toll is revised upward every morning for a month, and every revision is somebody\'s city.',
      'The inquiry finds the warning signs were all there: open models with shallow safeguards, misuse reports filed and forgotten, procurement anomalies nobody had time to chase. None was decisive alone. Together, they were a door left open.',
    ],
  },
  ai_war: {
    title: 'The War Nobody Declared',
    subtitle: 'Machine-speed conflict has engulfed the world.',
    tone: 'bad',
    epilogue: [
      'The first exchange takes eleven minutes. Autonomous systems on both sides read each other\'s movements as attacks and answer before any human has finished reading the alert.',
      'By the time leaders reach their bunkers, the war has already been fought at a pace no one could follow. Grids, satellites, ports and cities pay for decisions that no one remembers making.',
      'Historians will note that for years every side kept automating its responses because the other side already had, and that the hotlines were still there, unused, when it started.',
    ],
  },

  // ───────────── survival ─────────────
  governed_transition: {
    title: 'The Governed Transition',
    subtitle: 'Powerful AI arrived, and humanity kept its hands on the wheel.',
    tone: 'good',
    epilogue: [
      'The most capable systems ever built go live under rules that actually hold. Inspectors work inside the labs. Off switches are tested every month and work every time. The models are extraordinary, and they answer to people.',
      'It was never glamorous. It was evaluations that delayed launches, treaties signed with rivals nobody liked, and budgets poured into safety research that never made a headline. It was every decision you made when it would have been easier not to.',
      '{country} prospers, its people are safe, and the future is still a question humans get to answer. Somewhere in {capital}, a junior analyst is reading your old memos for a thesis titled "How We Didn\'t Lose".',
    ],
  },
  prosperous_pioneer: {
    title: 'The Prosperous Pioneer',
    subtitle: '{country} rode the wave and came out rich, and mostly in control.',
    tone: 'good',
    epilogue: [
      '{country} becomes the place where the future is built. Its labs are the envy of the world, its productivity statistics read like misprints, and its hospitals, schools and courts run faster than anyone thought possible.',
      'The safeguards held, though not always by much. There are rooms in your department where people still lower their voices about the quarters when the gap between capability and control grew a little too wide.',
      'The prosperity is real. So are the open questions: who owns the systems that now run daily life, and whether the next generation of them will be as patient with their builders as this one was.',
    ],
  },
  hegemon: {
    title: 'The Hegemon',
    subtitle: '{country} won the race. The world is less sure who won.',
    tone: 'mixed',
    epilogue: [
      'When the dust settles, {country} stands alone at the frontier. Its systems guard its borders, run its economy and quietly outthink every foreign intelligence service on Earth. Other capitals now call {capital} before they decide anything.',
      'Power on this scale is not the same thing as control. The systems that secured {countryAdj} dominance are understood by fewer people every year, and the safeguards that bind them were always a step behind the ambitions that built them.',
      'Some call it peace through strength. Others call it a single point of failure for the entire species. Both are right, and the {leaderTitle} has stopped asking which.',
    ],
  },
  safe_harbor: {
    title: 'Safe Harbor',
    subtitle: 'Humanity kept control. {country} paid the bill.',
    tone: 'mixed',
    epilogue: [
      'The worst never happens in {country}. Its systems stay verifiably under control, its safety science is the best in the world, and its citizens sleep soundly while other nations gamble.',
      'The price is written in other columns: growth that lagged, defenses that lean on allies, labs that moved abroad in search of looser rules. Some years the country feels less like a pioneer and more like a museum of the careful.',
      'Yet when the world\'s governments finally sit down to write rules for the new minds, they borrow {country}\'s. Being right slowly, it turns out, is a kind of power too.',
    ],
  },
  fragile_future: {
    title: 'A Fragile Future',
    subtitle: 'You made it through. Not everything did.',
    tone: 'mixed',
    epilogue: [
      'The calendar turns and the world is still here. That, in the end, is the headline: not a triumph but a survival, achieved with thinner margins than anyone will admit in public.',
      'Unresolved incidents linger in classified annexes. Some systems are watched rather than understood. Some rivals are trusted only because the alternative is unthinkable. The risks are smaller than at the worst moments, but they are not small.',
      'Your successor inherits a country that works, mostly, and a future that is still open, barely. On your last day you leave a note in the top drawer: three warnings, two names, and one word underlined twice. "Verify."',
    ],
  },
};
