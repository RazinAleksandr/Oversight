/**
 * Heads of government (5 per country), the four advisors, and stance flavour text.
 * Leaders with a `stance` are locked to it; the rest draw from the country's stance pool.
 */
import type { AdvisorDef, AdvisorId, CountryId, LeaderTemplate, Stance } from '../engine/types';

export const LEADERS: Record<CountryId, LeaderTemplate[]> = {
  atlantic: [
    {
      name: 'Diane Calloway',
      stance: 'accelerationist',
      bio: 'Two-term governor of the tech corridor who promised voters "a raise from the robots".',
    },
    {
      name: 'Raymond Holt',
      stance: 'hawk',
      bio: 'Retired admiral who ran Federal Cyber Command and still keeps a threat map behind his desk.',
    },
    {
      name: 'Luis Navarro',
      stance: 'populist',
      bio: 'Former steelworkers\' organizer elected on a pledge that no machine takes a job without paying for it.',
    },
    {
      name: 'Catherine Ashby-Moore',
      bio: 'Thirty-year veteran of the Federal Assembly; nobody knows what she believes, which is how she keeps winning.',
    },
    {
      name: 'Marcus Delaney',
      bio: 'Former governor and talk-show regular who reads the overnight polls before the intelligence briefing.',
    },
  ],

  hanzhou: [
    {
      name: 'Wei Zhaolin',
      stance: 'hawk',
      bio: 'Rose through the defense-industry ministries; believes this century belongs to whoever commands its machines.',
    },
    {
      name: 'Song Meixiu',
      stance: 'accelerationist',
      bio: 'Architect of the coastal digital-economy zones who measures every year in growth points and factory output.',
    },
    {
      name: 'Lu Haoran',
      stance: 'cautious',
      bio: 'Former provincial governor known for patience, very long memos and a deep dislike of surprises.',
    },
    {
      name: 'Gao Wenjing',
      bio: 'Party theorist who speaks of "harmonious intelligence" and rarely shows her hand before the vote.',
    },
    {
      name: 'Feng Yichen',
      bio: 'Planning-commission technocrat with a doctorate in control systems and little patience for speeches.',
    },
  ],

  commonwealth: [
    {
      name: 'Margarethe Lindqvist',
      stance: 'cautious',
      bio: 'Former president of the Constitutional Court who has never once been accused of rushing anything.',
    },
    {
      name: 'Étienne Marchetti',
      stance: 'populist',
      bio: 'Charismatic ex-mayor of a shipyard city who campaigns on "dignity before efficiency".',
    },
    {
      name: 'Saskia Verhoeven',
      stance: 'accelerationist',
      bio: 'Ex-finance minister determined to close the gap with the Atlantic labs before it becomes permanent.',
    },
    {
      name: 'Pavel Novák',
      bio: 'Coalition-builder from the eastern member states who will back whatever keeps the coalition alive.',
    },
    {
      name: 'Inés Albarrán',
      bio: 'Former Commissioner for Digital Affairs, fluent in five languages and every committee procedure.',
    },
  ],

  meridian: [
    {
      name: 'Teresa Halim',
      stance: 'cautious',
      bio: 'Former central-bank governor who decides the way she set interest rates: slowly, then all at once.',
    },
    {
      name: 'Rafael Lim',
      stance: 'hawk',
      bio: 'Navy veteran who commanded strait patrols and believes deterrence now starts in the server room.',
    },
    {
      name: 'Ana Soriano',
      stance: 'accelerationist',
      bio: 'Chip executive turned politician who wants Meridian to be the world\'s brain, not just its foundry.',
    },
    {
      name: 'Kenji Arroyo',
      bio: 'Pragmatic coalition leader from the southern islands who trades favours like a second currency.',
    },
    {
      name: 'Ravi Kumaran',
      bio: 'Career diplomat who spent twenty years keeping three great powers from noticing each other\'s ships.',
    },
  ],
};

export const ADVISORS: Record<AdvisorId, AdvisorDef> = {
  chief_of_staff: {
    id: 'chief_of_staff',
    name: 'Mara Quill',
    role: 'Chief of Staff',
    bias: 'Political survival first. Knows what the leader wants before the leader does.',
    portraitSeed: 1101,
  },
  scientist: {
    id: 'scientist',
    name: 'Dr. Anika Rao',
    role: 'Chief Scientist',
    bias: 'Cautious by training. Trusts evaluation data over promises, and sometimes sees risk in everything.',
    portraitSeed: 2207,
  },
  economist: {
    id: 'economist',
    name: 'Felix Ostrander',
    role: 'Economic Advisor',
    bias: 'Deployment optimist. Prices every gain to the decimal and discounts whatever cannot be priced.',
    portraitSeed: 3313,
  },
  intelligence: {
    id: 'intelligence',
    name: 'Viktor Hale',
    role: 'Intelligence Director',
    bias: 'Hawkish. Sees a rival behind every incident, and is right just often enough.',
    portraitSeed: 4421,
  },
};

export const STANCE_TEXT: Record<Stance, { label: string; motto: string; text: string }> = {
  accelerationist: {
    label: 'Growth First',
    motto: 'Whoever builds it first writes the rules.',
    text: 'Wants fast deployment, visible growth and a winning position in the race. Tolerates risk as long as the numbers go up.',
  },
  hawk: {
    label: 'Security First',
    motto: 'Deterrence is the only safety that has ever worked.',
    text: 'Prioritizes national security and keeping pace with rivals. Backs defense AI and distrusts any treaty it cannot verify.',
  },
  cautious: {
    label: 'Steady Hand',
    motto: 'Measure twice. There is no cutting once.',
    text: 'Values stability and safety over speed. Will back oversight, but still expects the economy not to stall on your watch.',
  },
  populist: {
    label: 'People First',
    motto: 'No machine gets a job until a person gets a future.',
    text: 'Cares about jobs, wages and public anger. Supports protection for workers and punishes visible disruption.',
  },
};
