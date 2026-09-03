import {
  BASIC_RATE_BAND,
  CGT_BASIC_RATE,
  CGT_HIGHER_RATE,
  PERSONAL_ALLOWANCE,
  PERSONAL_ALLOWANCE_TAPER_END,
  PERSONAL_ALLOWANCE_TAPER_START,
} from './cgt-rates.constants';

export interface CgtRateSplit {
  /** Portion of the taxable gain that falls within the person's remaining basic-rate band. */
  amountAtBasicRate: number;
  /** Whatever's left, taxed at the higher rate. */
  amountAtHigherRate: number;
  /** amountAtBasicRate * CGT_BASIC_RATE + amountAtHigherRate * CGT_HIGHER_RATE — the actual best-estimate CGT bill. */
  estimatedTax: number;
  /** How much of the basic-rate band was left BEFORE this gain — null when income is unknown. */
  basicRateBandRemaining: number | null;
  band: 'basic' | 'higher' | 'split' | 'unknown';
}

/**
 * The real UK rule this engine previously only approximated: a capital
 * gain isn't taxed at a single flat rate per person — it stacks on top
 * of income, filling whatever's left of the basic-rate band at 18%
 * before the remainder is taxed at 24%. Someone with income just under
 * the higher-rate threshold and a large gain is very often a SPLIT
 * case, not a clean "basic" or "higher" taxpayer, and the previous
 * likelyBand: 'basic' | 'higher' guess couldn't represent that at all.
 *
 * Deliberately still an estimate, not a computation, for the same
 * reasons documented on cgt-rates.constants.ts and CgtIntelligenceService:
 * no allowance for pension contributions, Gift Aid, other income-tax
 * reliefs, or gains/losses from OTHER tax years' carry-forward. Passing
 * annualIncome === null (no income on record for this person) returns
 * 'unknown' rather than silently assuming basic rate.
 */
export function computeCgtRateSplit(annualIncome: number | null, taxableGain: number): CgtRateSplit {
  if (taxableGain <= 0) {
    return { amountAtBasicRate: 0, amountAtHigherRate: 0, estimatedTax: 0, basicRateBandRemaining: null, band: 'basic' };
  }

  if (annualIncome === null) {
    return { amountAtBasicRate: 0, amountAtHigherRate: 0, estimatedTax: 0, basicRateBandRemaining: null, band: 'unknown' };
  }

  const personalAllowance = taperedPersonalAllowance(annualIncome);
  const taxableIncome = Math.max(0, annualIncome - personalAllowance);
  const basicRateBandRemaining = Math.max(0, BASIC_RATE_BAND - taxableIncome);

  const amountAtBasicRate = Math.min(taxableGain, basicRateBandRemaining);
  const amountAtHigherRate = taxableGain - amountAtBasicRate;
  const estimatedTax = amountAtBasicRate * CGT_BASIC_RATE + amountAtHigherRate * CGT_HIGHER_RATE;
  const band: CgtRateSplit['band'] = amountAtHigherRate === 0 ? 'basic' : amountAtBasicRate === 0 ? 'higher' : 'split';

  return { amountAtBasicRate, amountAtHigherRate, estimatedTax, basicRateBandRemaining, band };
}

function taperedPersonalAllowance(grossIncome: number): number {
  if (grossIncome <= PERSONAL_ALLOWANCE_TAPER_START) return PERSONAL_ALLOWANCE;
  if (grossIncome >= PERSONAL_ALLOWANCE_TAPER_END) return 0;
  const reduction = Math.floor((grossIncome - PERSONAL_ALLOWANCE_TAPER_START) / 2);
  return Math.max(0, PERSONAL_ALLOWANCE - reduction);
}
