import { computeCgtRateSplit } from './cgt-rate-banding';

describe('computeCgtRateSplit', () => {
  it('returns all-zero, band "basic", when there is no taxable gain', () => {
    expect(computeCgtRateSplit(45_000, 0)).toEqual({
      amountAtBasicRate: 0, amountAtHigherRate: 0, estimatedTax: 0, basicRateBandRemaining: null, band: 'basic',
    });
    expect(computeCgtRateSplit(45_000, -500)).toEqual({
      amountAtBasicRate: 0, amountAtHigherRate: 0, estimatedTax: 0, basicRateBandRemaining: null, band: 'basic',
    });
  });

  it('returns band "unknown" when income is not on record, rather than guessing basic rate', () => {
    expect(computeCgtRateSplit(null, 5000)).toEqual({
      amountAtBasicRate: 0, amountAtHigherRate: 0, estimatedTax: 0, basicRateBandRemaining: null, band: 'unknown',
    });
  });

  it('taxes a whole gain at basic rate when it fits inside the remaining basic-rate band', () => {
    // income £20,000: personal allowance £12,570 -> taxable income £7,430.
    // Basic-rate band remaining: £37,700 - £7,430 = £30,270. A £5,000 gain fits entirely within it.
    const result = computeCgtRateSplit(20_000, 5000);
    expect(result.band).toBe('basic');
    expect(result.amountAtBasicRate).toBe(5000);
    expect(result.amountAtHigherRate).toBe(0);
    expect(result.basicRateBandRemaining).toBeCloseTo(30_270);
    expect(result.estimatedTax).toBeCloseTo(5000 * 0.18);
  });

  it('taxes a whole gain at higher rate once the basic-rate band is already used up by income', () => {
    // income £80,000 is already well past the £50,270 combined threshold.
    const result = computeCgtRateSplit(80_000, 10_000);
    expect(result.band).toBe('higher');
    expect(result.amountAtBasicRate).toBe(0);
    expect(result.amountAtHigherRate).toBe(10_000);
    expect(result.basicRateBandRemaining).toBe(0);
    expect(result.estimatedTax).toBeCloseTo(10_000 * 0.24);
  });

  it('splits a gain across both rates when it straddles the remaining basic-rate band', () => {
    // income £45,000: personal allowance £12,570 -> taxable income £32,430.
    // Basic-rate band remaining: £37,700 - £32,430 = £5,270.
    const result = computeCgtRateSplit(45_000, 10_000);
    expect(result.band).toBe('split');
    expect(result.basicRateBandRemaining).toBeCloseTo(5270);
    expect(result.amountAtBasicRate).toBeCloseTo(5270);
    expect(result.amountAtHigherRate).toBeCloseTo(4730);
    expect(result.estimatedTax).toBeCloseTo(5270 * 0.18 + 4730 * 0.24);
  });

  it('tapers the personal allowance by £1 per £2 of income over £100,000', () => {
    // income £110,000: reduction = floor((110,000-100,000)/2) = 5,000 -> allowance £7,570.
    const result = computeCgtRateSplit(110_000, 1000);
    // Taxable income already £102,430, far past the £37,700 basic-rate band -> all higher rate regardless.
    expect(result.band).toBe('higher');
    expect(result.basicRateBandRemaining).toBe(0);
  });

  it('removes the personal allowance entirely at or above £125,140', () => {
    const result = computeCgtRateSplit(130_000, 1000);
    expect(result.band).toBe('higher');
    expect(result.basicRateBandRemaining).toBe(0);
  });

  it('leaves the personal allowance untouched at exactly the £100,000 taper start', () => {
    // income £100,000 exactly: personal allowance still the full £12,570 -> taxable income £87,430.
    const result = computeCgtRateSplit(100_000, 1000);
    expect(result.basicRateBandRemaining).toBe(0); // 87,430 already exceeds the £37,700 band
    expect(result.band).toBe('higher');
  });
});
