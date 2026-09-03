import { ChargeProjectionService } from './charge-projection.service';

// compute() touches neither the DB nor Claude, so a stub is enough —
// this is testing pure arithmetic, not the AI-narrative side path.
const service = new ChargeProjectionService({} as any);

describe('ChargeProjectionService.compute', () => {
  it('applies the exit penalty and initial charge only once, at the start', () => {
    const result = service.compute(
      { name: 'Old', currentValue: 100000, ongoingChargePct: 1, exitPenaltyPct: 5 },
      { name: 'New', ongoingChargePct: 0.5, initialChargePct: 2 },
      { projectionYears: 1, grossGrowthRatePct: 5 },
    );
    // £100,000 less 5% exit penalty = £95,000, less 2% initial charge = £93,100.
    expect(result.startingNewValue).toBeCloseTo(93100);
  });

  it('the entire outcome gap is attributable to the charge difference alone (equal gross growth assumption)', () => {
    const result = service.compute(
      { name: 'Old', currentValue: 100000, ongoingChargePct: 1, exitPenaltyPct: 0 },
      { name: 'New', ongoingChargePct: 1, initialChargePct: 0 }, // IDENTICAL charges, no penalty either side
      { projectionYears: 10, grossGrowthRatePct: 5 },
    );
    // With identical charges and no penalty/initial charge, the two curves must be identical.
    expect(result.finalNewValue).toBeCloseTo(result.finalOldValue);
    expect(result.difference).toBeCloseTo(0);
  });

  it('a lower ongoing charge compounds into a materially better outcome over a long horizon', () => {
    const result = service.compute(
      { name: 'Old', currentValue: 100000, ongoingChargePct: 1.5, exitPenaltyPct: 0 },
      { name: 'New', ongoingChargePct: 0.3, initialChargePct: 0 },
      { projectionYears: 20, grossGrowthRatePct: 5 },
    );
    expect(result.finalNewValue).toBeGreaterThan(result.finalOldValue);
    expect(result.differencePct).toBeGreaterThan(0);
  });

  it('produces exactly projectionYears + 1 data points (year 0 through year N)', () => {
    const result = service.compute(
      { name: 'Old', currentValue: 10000, ongoingChargePct: 1, exitPenaltyPct: 0 },
      { name: 'New', ongoingChargePct: 1, initialChargePct: 0 },
      { projectionYears: 15, grossGrowthRatePct: 4 },
    );
    expect(result.series).toHaveLength(16);
    expect(result.series[0].year).toBe(0);
    expect(result.series[15].year).toBe(15);
  });

  it('a higher new-arrangement charge than the old one shows a negative difference (the new deal is worse)', () => {
    const result = service.compute(
      { name: 'Old', currentValue: 50000, ongoingChargePct: 0.3, exitPenaltyPct: 0 },
      { name: 'New', ongoingChargePct: 1.5, initialChargePct: 0 },
      { projectionYears: 10, grossGrowthRatePct: 5 },
    );
    expect(result.difference).toBeLessThan(0);
  });
});
