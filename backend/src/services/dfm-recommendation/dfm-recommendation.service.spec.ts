import { shiftWeight, normalizeWeights } from './dfm-recommendation.service';
import { RISK_MANDATES } from './dfm-mandate.constants';
import { RiskCategory } from '../fact-find/risk-questionnaire.constants';

describe('RISK_MANDATES base weights', () => {
  it.each(Object.keys(RISK_MANDATES) as RiskCategory[])('%s: base category weights sum to exactly 100', (category) => {
    const total = RISK_MANDATES[category].baseCategories.reduce((sum, c) => sum + c.weightPct, 0);
    expect(total).toBe(100);
  });

  it('every mandate has a non-empty, unique mandate name', () => {
    const names = (Object.keys(RISK_MANDATES) as RiskCategory[]).map((k) => RISK_MANDATES[k].mandate);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((n) => expect(n.length).toBeGreaterThan(0));
  });
});

describe('shiftWeight', () => {
  const base = [
    { category: 'Global Equity', weightPct: 50 },
    { category: 'Corporate Bond', weightPct: 30 },
    { category: 'Cash', weightPct: 20 },
  ];

  it('moves the requested amount from "from" categories into "to" categories, preserving the total', () => {
    const shifted = shiftWeight(base, ['Global Equity'], ['Cash'], 15);
    const total = shifted.reduce((sum, c) => sum + c.weightPct, 0);
    expect(total).toBeCloseTo(100);
    expect(shifted.find((c) => c.category === 'Global Equity')!.weightPct).toBeCloseTo(35);
    expect(shifted.find((c) => c.category === 'Cash')!.weightPct).toBeCloseTo(35);
  });

  it('never shifts more than the "from" categories actually hold', () => {
    const shifted = shiftWeight(base, ['Cash'], ['Global Equity'], 999);
    const total = shifted.reduce((sum, c) => sum + c.weightPct, 0);
    expect(total).toBeCloseTo(100);
    expect(shifted.find((c) => c.category === 'Cash')).toBeUndefined(); // fully drained, filtered out
  });

  it('creates a "to" category at 0 first if it is not already present', () => {
    const shifted = shiftWeight(base, ['Cash'], ['Alternatives'], 10);
    const alt = shifted.find((c) => c.category === 'Alternatives');
    expect(alt).toBeDefined();
    expect(alt!.weightPct).toBeCloseTo(10);
  });

  it('is a no-op (returns an equivalent set) if the "from" categories are already at zero', () => {
    const zeroed = [{ category: 'Global Equity', weightPct: 0 }, { category: 'Cash', weightPct: 100 }];
    const shifted = shiftWeight(zeroed, ['Global Equity'], ['Cash'], 20);
    expect(shifted).toEqual(zeroed);
  });
});

describe('normalizeWeights', () => {
  it('rounds every weight to the nearest whole percent', () => {
    const result = normalizeWeights([{ category: 'A', weightPct: 33.3 }, { category: 'B', weightPct: 66.7 }]);
    result.forEach((r) => expect(Number.isInteger(r.weightPct)).toBe(true));
  });

  it('corrects rounding drift so the total is always exactly 100', () => {
    // 33.33 x 3 rounds to 33 x 3 = 99, one short — drift must land on the largest bucket.
    const result = normalizeWeights([
      { category: 'A', weightPct: 33.33 },
      { category: 'B', weightPct: 33.33 },
      { category: 'C', weightPct: 33.34 },
    ]);
    const total = result.reduce((sum, r) => sum + r.weightPct, 0);
    expect(total).toBe(100);
  });

  it('drops any category that rounds to zero', () => {
    const result = normalizeWeights([{ category: 'A', weightPct: 99.6 }, { category: 'B', weightPct: 0.4 }]);
    expect(result.find((r) => r.category === 'B')).toBeUndefined();
  });

  it('sorts largest weight first', () => {
    const result = normalizeWeights([{ category: 'Small', weightPct: 10 }, { category: 'Big', weightPct: 90 }]);
    expect(result[0].category).toBe('Big');
  });
});
