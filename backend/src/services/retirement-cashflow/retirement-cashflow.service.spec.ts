import { RetirementCashflowService } from './retirement-cashflow.service';
import { RetirementCashflowInputs } from '../../database/entities';

// simulate() is pure (no DB, no Claude) — a stub constructor arg is enough.
const service = new RetirementCashflowService({} as any);

const BASE_INPUTS: RetirementCashflowInputs = {
  currentAge: 55, retirementAge: 65, planToAge: 95,
  currentPotValue: 500_000, monthlyContribution: 500, desiredAnnualIncome: 30_000,
  expectedReturnPct: 4, returnVolatilityPct: 12,
};

describe('RetirementCashflowService.simulate', () => {
  it('produces one series point per year from now to planToAge', () => {
    const result = service.simulate(BASE_INPUTS);
    expect(result.series).toHaveLength(BASE_INPUTS.planToAge - BASE_INPUTS.currentAge + 1);
    expect(result.series[0].age).toBe(BASE_INPUTS.currentAge);
    expect(result.series[result.series.length - 1].age).toBe(BASE_INPUTS.planToAge);
  });

  it('success probability is a genuine probability (0-100 inclusive)', () => {
    const result = service.simulate(BASE_INPUTS);
    expect(result.successProbabilityPct).toBeGreaterThanOrEqual(0);
    expect(result.successProbabilityPct).toBeLessThanOrEqual(100);
  });

  it('percentiles are ordered: p10 <= p50 <= p90 at every year', () => {
    const result = service.simulate(BASE_INPUTS);
    result.series.forEach((year) => {
      expect(year.p10).toBeLessThanOrEqual(year.p50 + 0.01); // small float tolerance
      expect(year.p50).toBeLessThanOrEqual(year.p90 + 0.01);
    });
  });

  it('a materially larger starting pot with everything else equal cannot lower the success probability', () => {
    const poor = service.simulate({ ...BASE_INPUTS, currentPotValue: 50_000 });
    const rich = service.simulate({ ...BASE_INPUTS, currentPotValue: 5_000_000 });
    expect(rich.successProbabilityPct).toBeGreaterThanOrEqual(poor.successProbabilityPct);
  });

  it('a much higher desired income with everything else equal cannot raise the success probability', () => {
    const modest = service.simulate({ ...BASE_INPUTS, desiredAnnualIncome: 10_000 });
    const greedy = service.simulate({ ...BASE_INPUTS, desiredAnnualIncome: 200_000 });
    expect(greedy.successProbabilityPct).toBeLessThanOrEqual(modest.successProbabilityPct);
  });

  it('never produces a negative pot value (a failed path floors at zero, it does not go negative)', () => {
    const result = service.simulate({ ...BASE_INPUTS, desiredAnnualIncome: 500_000, currentPotValue: 10_000 });
    result.series.forEach((year) => {
      expect(year.p10).toBeGreaterThanOrEqual(0);
    });
  });
});
