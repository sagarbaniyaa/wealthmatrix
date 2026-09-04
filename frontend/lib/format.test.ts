import { formatCurrency, formatPct, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats a positive amount as whole-pound GBP by default', () => {
    expect(formatCurrency(1234.56)).toBe('£1,235');
  });

  it('formats a different currency code', () => {
    expect(formatCurrency(1000, 'USD')).toBe('US$1,000');
  });

  it('falls back to GBP when the currency code is empty', () => {
    expect(formatCurrency(500, '')).toBe('£500');
  });

  it('formats zero and negative amounts', () => {
    expect(formatCurrency(0)).toBe('£0');
    expect(formatCurrency(-250)).toBe('-£250');
  });
});

describe('formatPct', () => {
  it('formats to one decimal place by default', () => {
    expect(formatPct(12.345)).toBe('12.3%');
  });

  it('respects a custom decimal count', () => {
    expect(formatPct(12.345, 2)).toBe('12.35%');
    expect(formatPct(12.345, 0)).toBe('12%');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string as UK-style day/month/year', () => {
    expect(formatDate('2024-03-15')).toBe('15 Mar 2024');
  });
});
