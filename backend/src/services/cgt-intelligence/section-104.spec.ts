import { computeSection104Pool, Section104Transaction } from './section-104';

describe('computeSection104Pool', () => {
  it('pools multiple buys at a running weighted-average cost', () => {
    const txns: Section104Transaction[] = [
      { type: 'buy', date: '2020-01-01', quantity: 100, amountBase: 1000 }, // £10/unit
      { type: 'buy', date: '2021-01-01', quantity: 50, amountBase: 750 },   // £15/unit
    ];
    const result = computeSection104Pool(txns);
    expect(result.poolQuantity).toBeCloseTo(150);
    expect(result.poolCost).toBeCloseTo(1750);
    expect(result.matches).toHaveLength(0);
  });

  it('a plain sell (no same-day/30-day repurchase) draws down the Section 104 pool at average cost', () => {
    const txns: Section104Transaction[] = [
      { type: 'buy', date: '2020-01-01', quantity: 100, amountBase: 1000 },
      { type: 'buy', date: '2021-01-01', quantity: 50, amountBase: 750 },
      { type: 'sell', date: '2022-06-01', quantity: 50, amountBase: 900 },
    ];
    const result = computeSection104Pool(txns);
    // Pool before sale: 150 units / £1750 = £11.6667/unit average.
    // Selling 50 removes 50 * 11.6667 = £583.33, leaving 100 units / £1166.67.
    expect(result.poolQuantity).toBeCloseTo(100);
    expect(result.poolCost).toBeCloseTo(1166.6667, 2);
    expect(result.matches).toEqual([{ saleDate: '2022-06-01', quantity: 50, rule: 'section-104' }]);
  });

  it('matches a same-day buy and sell first, before touching the pool', () => {
    const txns: Section104Transaction[] = [
      { type: 'buy', date: '2020-01-01', quantity: 100, amountBase: 1000 }, // pool: £10/unit
      { type: 'buy', date: '2023-03-10', quantity: 20, amountBase: 400 },   // same-day buy: £20/unit
      { type: 'sell', date: '2023-03-10', quantity: 20, amountBase: 500 }, // matched same-day, not against the pool
    ];
    const result = computeSection104Pool(txns);
    // The same-day buy+sell should net out entirely against each other —
    // the original 100-unit/£1000 pool must be untouched.
    expect(result.poolQuantity).toBeCloseTo(100);
    expect(result.poolCost).toBeCloseTo(1000);
    expect(result.matches).toEqual([{ saleDate: '2023-03-10', quantity: 20, rule: 'same-day' }]);
  });

  it('applies the 30-day "bed and breakfast" rule to a sale followed by a repurchase within 30 days', () => {
    const txns: Section104Transaction[] = [
      { type: 'buy', date: '2020-01-01', quantity: 100, amountBase: 1000 }, // long-held pool: £10/unit
      { type: 'sell', date: '2023-06-01', quantity: 40, amountBase: 2000 }, // sells 40 for £50/unit
      { type: 'buy', date: '2023-06-20', quantity: 40, amountBase: 2400 },  // buys 40 back 19 days later at £60/unit
    ];
    const result = computeSection104Pool(txns);
    // The sale must be matched against the 6/20 repurchase (bed-and-
    // breakfast), NOT against the original £10/unit pool — so the
    // original 100 units at £1000 stay completely untouched.
    expect(result.poolQuantity).toBeCloseTo(100);
    expect(result.poolCost).toBeCloseTo(1000);
    expect(result.matches).toEqual([{ saleDate: '2023-06-01', quantity: 40, rule: '30-day' }]);
  });

  it('does NOT apply the 30-day rule once the repurchase is more than 30 days after the sale', () => {
    const txns: Section104Transaction[] = [
      { type: 'buy', date: '2020-01-01', quantity: 100, amountBase: 1000 }, // £10/unit
      { type: 'sell', date: '2023-06-01', quantity: 40, amountBase: 2000 },
      { type: 'buy', date: '2023-07-15', quantity: 40, amountBase: 2400 }, // 44 days later — outside the window
    ];
    const result = computeSection104Pool(txns);
    // This sale must fall through to the Section 104 pool instead.
    expect(result.matches).toEqual([{ saleDate: '2023-06-01', quantity: 40, rule: 'section-104' }]);
    // Pool: started 100/£1000 (£10/unit); sold 40 at £10 = £400 removed -> 60 units / £600.
    // Then the 7/15 buy adds back 40 units / £2400 -> 100 units / £3000.
    expect(result.poolQuantity).toBeCloseTo(100);
    expect(result.poolCost).toBeCloseTo(3000);
  });

  it('never lets the pool quantity or cost go negative when a sale exceeds recorded holdings', () => {
    const txns: Section104Transaction[] = [
      { type: 'buy', date: '2020-01-01', quantity: 10, amountBase: 100 },
      { type: 'sell', date: '2021-01-01', quantity: 999, amountBase: 5000 }, // more than was ever bought
    ];
    const result = computeSection104Pool(txns);
    expect(result.poolQuantity).toBeGreaterThanOrEqual(0);
    expect(result.poolCost).toBeGreaterThanOrEqual(0);
  });

  it('is order-independent for input array ordering (sorts by date internally)', () => {
    const chronological: Section104Transaction[] = [
      { type: 'buy', date: '2020-01-01', quantity: 100, amountBase: 1000 },
      { type: 'sell', date: '2022-01-01', quantity: 50, amountBase: 900 },
    ];
    const shuffled = [chronological[1], chronological[0]];
    expect(computeSection104Pool(shuffled)).toEqual(computeSection104Pool(chronological));
  });
});
