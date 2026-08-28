// WealthMatrix's own 8-question attitude-to-risk questionnaire and
// scoring model — NOT a reproduction of any third-party proprietary risk
// tool. The dimensions covered (loss reaction, growth expectation,
// investment priority, loss tolerance, capital-preservation priority,
// horizon stability, market knowledge, general risk appetite) are the
// same standard set every UK retail-advice risk questionnaire covers;
// the wording and scoring here are original.
//
// IMPORTANT: this file must stay in sync with
// frontend/lib/risk-questionnaire.ts (question keys and option order) —
// there's no shared package between the two apps, so the frontend
// renders questions from its own copy of this data and only sends back
// `{ questionKey, selectedOption }` pairs for the backend to score.

export interface RiskQuestionOption {
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
  weight: number; // 1 (most cautious) .. 5 (most risk-tolerant), already resolved for reverse-scored questions
}

export interface RiskQuestion {
  key: string;
  prompt: string;
  options: RiskQuestionOption[];
}

function standardOptions(labels: [string, string, string, string, string]): RiskQuestionOption[] {
  const keys: RiskQuestionOption['key'][] = ['A', 'B', 'C', 'D', 'E'];
  return labels.map((label, i) => ({ key: keys[i], label, weight: i + 1 }));
}

function reversedOptions(labels: [string, string, string, string, string]): RiskQuestionOption[] {
  const keys: RiskQuestionOption['key'][] = ['A', 'B', 'C', 'D', 'E'];
  return labels.map((label, i) => ({ key: keys[i], label, weight: 5 - i }));
}

export const RISK_QUESTIONNAIRE: RiskQuestion[] = [
  {
    key: 'general_risk_appetite',
    prompt: 'How would you rate the level of risk you are willing to take with your investments?',
    options: standardOptions([
      'Extremely low — I want to avoid any negative fluctuation in value, even if it limits growth.',
      'Low — I can tolerate a small degree of fluctuation for modest growth potential.',
      'Medium — I can tolerate a moderate degree of fluctuation for moderate growth potential.',
      'High — I can tolerate a high degree of fluctuation for higher growth potential.',
      'Very high — I can tolerate large, possibly prolonged fluctuations for the highest growth potential.',
    ]),
  },
  {
    key: 'market_knowledge',
    prompt: 'How would you describe your knowledge and experience of investing?',
    options: standardOptions([
      'Very low — little to no experience or understanding of investments.',
      'Low — little experience, but I understand the basic relationship between risk and reward.',
      'Medium — moderate experience; I would benefit from guidance on decisions.',
      'High — above-average experience and market knowledge.',
      'Very high — extensive experience; I consider myself a sophisticated investor.',
    ]),
  },
  {
    key: 'accept_losses_for_returns',
    prompt: 'I am willing to accept the possibility of losses in order to potentially achieve a higher rate of return.',
    options: standardOptions(['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']),
  },
  {
    key: 'prioritise_preservation',
    prompt: 'I tend to prioritise capital preservation over maximising returns.',
    // Reverse-scored: agreeing with a preservation-first attitude signals LOWER risk tolerance.
    options: reversedOptions(['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']),
  },
  {
    key: 'horizon_stability',
    prompt: 'My investment time horizon is unlikely to change unexpectedly (e.g. due to ill health or a change in circumstances).',
    options: standardOptions(['Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree']),
  },
  {
    key: 'income_growth_expectation',
    prompt: 'Over the next several years, how do you expect your annual income to change?',
    options: standardOptions(['Decrease substantially', 'Decrease moderately', 'Stay about the same', 'Grow moderately', 'Grow substantially']),
  },
  {
    key: 'loss_reaction',
    prompt: 'If your portfolio lost 15% or more of its value over 3 months and the market outlook was still negative, what would you do?',
    options: standardOptions([
      'Sell everything and move to cash.',
      'Sell part of the portfolio and move to less volatile investments.',
      'Feel concerned but hold and wait to see what happens.',
      'Sit tight, expecting recovery — possibly keep contributing.',
      'See it as an opportunity and invest more at the lower price.',
    ]),
  },
  {
    key: 'investment_priority',
    prompt: 'What is most important to you in relation to your investments?',
    options: standardOptions([
      'Preservation of capital',
      'Providing an income, with preservation of capital',
      'Providing an income',
      'Capital growth and income',
      'Capital growth',
    ]),
  },
];

export type RiskCategory = 'risk_averse' | 'conservative' | 'balanced' | 'adventurous' | 'aggressive';

const CATEGORY_BANDS: { max: number; category: RiskCategory }[] = [
  { max: 20, category: 'risk_averse' },
  { max: 40, category: 'conservative' },
  { max: 60, category: 'balanced' },
  { max: 80, category: 'adventurous' },
  { max: Infinity, category: 'aggressive' },
];

/** Maps our 5-band ATR category onto the simpler 3-band scale FundSuitabilityService already uses for person.riskTolerance. */
export const RISK_CATEGORY_TO_TOLERANCE: Record<RiskCategory, 'conservative' | 'moderate' | 'aggressive'> = {
  risk_averse: 'conservative',
  conservative: 'conservative',
  balanced: 'moderate',
  adventurous: 'aggressive',
  aggressive: 'aggressive',
};

export function scoreRiskQuestionnaire(answers: { questionKey: string; selectedOption: string }[]): { score: number; category: RiskCategory } | null {
  const weights: number[] = [];
  for (const question of RISK_QUESTIONNAIRE) {
    const answer = answers.find((a) => a.questionKey === question.key);
    if (!answer) continue; // partial questionnaires just score on what's answered; caller decides if that's enough to mark "completed"
    const option = question.options.find((o) => o.key === answer.selectedOption);
    if (option) weights.push(option.weight);
  }
  if (weights.length === 0) return null;

  const average = weights.reduce((sum, w) => sum + w, 0) / weights.length; // 1..5
  const score = Math.round((((average - 1) / 4) * 100) * 100) / 100; // 0..100, 2dp
  const category = CATEGORY_BANDS.find((b) => score <= b.max)!.category;
  return { score, category };
}
