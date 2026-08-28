export function formatCurrency(amount: number, currencyCode = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode || 'GBP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPct(pct: number, decimals = 1): string {
  return `${pct.toFixed(decimals)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
