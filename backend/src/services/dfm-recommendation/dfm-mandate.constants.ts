import { RiskCategory } from '../fact-find/risk-questionnaire.constants';
import { FundCategoryWeight } from '../../database/entities';

/**
 * Deterministic mandate + starting fund-category allocation per ATR risk
 * band — the same 5-band scale Fact Find already scores against. No real
 * DFM firm is named (see migration 011): these are mandate TYPES, the
 * category-level equivalent of "cautious/balanced/adventurous" a firm
 * would use to brief an actual DFM once selected. Weights always sum to
 * 100; DfmRecommendationService applies liquidity/style adjustments on
 * top of these base weights.
 */
export const RISK_MANDATES: Record<RiskCategory, { mandate: string; feeRange: string; baseCategories: FundCategoryWeight[] }> = {
  risk_averse: {
    mandate: 'Capital Preservation Mandate',
    feeRange: '0.15%–0.35% p.a. (predominantly cash/bond mandates)',
    baseCategories: [
      { category: 'Cash', weightPct: 25 },
      { category: 'Short-Duration Bonds', weightPct: 30 },
      { category: 'Corporate Bond', weightPct: 25 },
      { category: 'Multi-Asset', weightPct: 15 },
      { category: 'Global Equity', weightPct: 5 },
    ],
  },
  conservative: {
    mandate: 'Cautious Managed Mandate',
    feeRange: '0.20%–0.40% p.a.',
    baseCategories: [
      { category: 'Cash', weightPct: 10 },
      { category: 'Short-Duration Bonds', weightPct: 20 },
      { category: 'Corporate Bond', weightPct: 25 },
      { category: 'Multi-Asset', weightPct: 25 },
      { category: 'Global Equity', weightPct: 15 },
      { category: 'Diversified Growth', weightPct: 5 },
    ],
  },
  balanced: {
    mandate: 'Balanced Growth Mandate',
    feeRange: '0.25%–0.55% p.a.',
    baseCategories: [
      { category: 'Cash', weightPct: 5 },
      { category: 'Corporate Bond', weightPct: 15 },
      { category: 'Multi-Asset', weightPct: 25 },
      { category: 'Global Equity', weightPct: 35 },
      { category: 'Diversified Growth', weightPct: 10 },
      { category: 'Index Funds', weightPct: 10 },
    ],
  },
  adventurous: {
    mandate: 'Adventurous Growth Mandate',
    feeRange: '0.30%–0.65% p.a.',
    baseCategories: [
      { category: 'Global Equity', weightPct: 50 },
      { category: 'Index Funds', weightPct: 15 },
      { category: 'Multi-Asset', weightPct: 15 },
      { category: 'Diversified Growth', weightPct: 10 },
      { category: 'Alternatives', weightPct: 5 },
      { category: 'Corporate Bond', weightPct: 5 },
    ],
  },
  aggressive: {
    mandate: 'Maximum Growth Mandate',
    feeRange: '0.35%–0.75% p.a. (higher active/alternatives content)',
    baseCategories: [
      { category: 'Global Equity', weightPct: 60 },
      { category: 'Index Funds', weightPct: 15 },
      { category: 'Alternatives', weightPct: 10 },
      { category: 'Diversified Growth', weightPct: 10 },
      { category: 'Multi-Asset', weightPct: 5 },
    ],
  },
};

// Categories treated as "growth/equity-like" for the liquidity-need
// shift (money gets pulled OUT of these, into cash/short-duration, when
// liquidity need is high) and for the passive/active style shift.
export const GROWTH_CATEGORIES = ['Global Equity', 'Index Funds', 'Diversified Growth', 'Alternatives'];
export const DEFENSIVE_CATEGORIES = ['Cash', 'Short-Duration Bonds'];
