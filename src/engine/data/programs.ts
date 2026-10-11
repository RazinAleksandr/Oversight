/** Program mechanics (GDD §9.1). Upkeep is charged at End Quarter; level changes are free and immediate. */
import type { ProgramDef, ProgramId } from '../types';

export const PROGRAM_ORDER: ProgramId[] = ['safety', 'oversight', 'compute', 'workforce', 'defense'];

/** Safeguards growth contributed by the safety program per level (GDD §3). */
export const SAFETY_PROGRAM_GROWTH = [0, 0.12, 0.22, 0.34] as const;

export const PROGRAMS: Record<ProgramId, ProgramDef> = {
  safety: {
    id: 'safety',
    name: 'Alignment & Safety Research',
    short: 'Safety',
    description: 'Funds national alignment and control science. Raises Safeguards — the only lasting way to close the safety gap.',
    icon: 'safety',
    costs: [0, 2, 4, 8],
    levels: [{}, {}, { companySafety: 1 }, { companySafety: 1 }],
    levelText: [
      'Unfunded. Safeguards creep forward on industry effort alone.',
      'Safeguards +0.12/quarter.',
      'Safeguards +0.22/quarter; labs adopt better safety culture (+1/quarter).',
      'Safeguards +0.34/quarter; labs adopt better safety culture (+1/quarter).',
    ],
  },
  oversight: {
    id: 'oversight',
    name: 'Evaluation & Oversight',
    short: 'Oversight',
    description: 'Red teams, auditors and monitoring. Better evaluations, earlier warnings, a sharper Risk Clock, more capacity.',
    icon: 'oversight',
    costs: [0, 2, 4, 8],
    levels: [
      {},
      { detection: 0.12, earlyWarning: 0.08, riskUncertainty: -4 },
      { detection: 0.24, earlyWarning: 0.16, riskUncertainty: -8, capacity: 1 },
      { detection: 0.36, earlyWarning: 0.24, riskUncertainty: -12, capacity: 2 },
    ],
    levelText: [
      'Unfunded. Evaluations are thin; the Risk Clock is a guess.',
      'Detection +12%, earlier warnings, risk uncertainty −4.',
      'Detection +24%, earlier warnings, risk uncertainty −8, +1 capacity.',
      'Detection +36%, earlier warnings, risk uncertainty −12, +2 capacity.',
    ],
  },
  compute: {
    id: 'compute',
    name: 'National Compute & Grants',
    short: 'Compute',
    description: 'Public compute and research grants. Faster domestic progress and a modest economic lift. Race-minded leaders love it.',
    icon: 'compute',
    costs: [0, 2, 4, 8],
    levels: [
      {},
      { capabilityGrowth: 0.1, economyPerTurn: 0.3 },
      { capabilityGrowth: 0.2, economyPerTurn: 0.6 },
      { capabilityGrowth: 0.32, economyPerTurn: 0.9 },
    ],
    levelText: [
      'Unfunded. Labs rely on private compute.',
      'Domestic capability growth +10%, prosperity +0.3/quarter.',
      'Domestic capability growth +20%, prosperity +0.6/quarter.',
      'Domestic capability growth +32%, prosperity +0.9/quarter.',
    ],
  },
  workforce: {
    id: 'workforce',
    name: 'Workforce Transition',
    short: 'Workforce',
    description: 'Retraining, wage insurance and job matching. Softens the social cost of automation.',
    icon: 'workforce',
    costs: [0, 2, 4, 8],
    levels: [
      {},
      { displacementMitigation: 0.25 },
      { displacementMitigation: 0.45 },
      { displacementMitigation: 0.65 },
    ],
    levelText: [
      'Unfunded. Displaced workers are on their own.',
      'Mitigates 25% of displacement unrest; displacement fades 2× faster.',
      'Mitigates 45% of displacement unrest; displacement fades 3× faster.',
      'Mitigates 65% of displacement unrest; displacement fades 4× faster.',
    ],
  },
  defense: {
    id: 'defense',
    name: 'Defense & Cyber AI',
    short: 'Defense',
    description: 'Military and cyber AI programs. Raises security and defense adoption, but rivals notice.',
    icon: 'defense',
    costs: [0, 2, 4, 8],
    levels: [
      {},
      { securityPerTurn: 0.4, tensionPerTurn: 1 },
      { securityPerTurn: 0.8, tensionPerTurn: 2 },
      { securityPerTurn: 1.2, tensionPerTurn: 3 },
    ],
    levelText: [
      'Unfunded.',
      'Security +0.4/quarter, defense adoption +4/quarter, race tension +1/quarter.',
      'Security +0.8/quarter, defense adoption +8/quarter, race tension +2/quarter.',
      'Security +1.2/quarter, defense adoption +12/quarter, race tension +3/quarter.',
    ],
  },
};
