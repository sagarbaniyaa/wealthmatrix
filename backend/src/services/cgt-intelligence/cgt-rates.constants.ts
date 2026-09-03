/**
 * UK CGT constants — these change almost every tax year (the annual
 * exempt amount alone went £12,300 → £6,000 → £3,000 across three
 * consecutive years), so they live here as one clearly-labelled place
 * to update, not scattered through the calculation logic. Current as
 * of the 2024/25 tax year (post the 30 Oct 2024 Budget, which aligned
 * the general-asset CGT rates with the residential-property rates) —
 * verify against the live HMRC rates before relying on this for real
 * advice, exactly as every other UK-tax-rule constant in this codebase
 * (ATR bands, charge-projection assumptions) asks the same of itself.
 */
export const CGT_ANNUAL_EXEMPT_AMOUNT = 3000; // £, per individual, per tax year

// Rates for assets OTHER than residential property (shares, funds, etc.)
// — this engine only ever looks at GIA/OTHER-wrapper investment holdings,
// never property, so these are the only rates it needs.
export const CGT_BASIC_RATE = 0.18;
export const CGT_HIGHER_RATE = 0.24;

// Rough basic/higher-rate split — NOT a full income-tax computation
// (no allowance for pension contributions, Gift Aid, personal allowance
// taper, etc.). Used only to pick which of the two rates above to
// highlight as "likely" for a person; both are always shown regardless,
// so this heuristic being wrong understates precision, never accuracy.
export const HIGHER_RATE_THRESHOLD_ANNUAL_INCOME = 50270; // £, 2024/25 basic-rate band ceiling
