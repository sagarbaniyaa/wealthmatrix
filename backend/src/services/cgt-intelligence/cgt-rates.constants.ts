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

// Income-tax banding, used to work out how much of a person's basic-rate
// band a capital gain actually falls into (see cgt-rate-banding.ts) —
// UK personal allowance and basic-rate band for 2024/25, plus the
// £100,000–£125,140 taper (£1 of personal allowance lost per £2 of
// income above £100,000, gone entirely by £125,140).
export const PERSONAL_ALLOWANCE = 12_570; // £
export const PERSONAL_ALLOWANCE_TAPER_START = 100_000; // £
export const PERSONAL_ALLOWANCE_TAPER_END = 125_140; // £ — personal allowance is £0 from here
export const BASIC_RATE_BAND = 37_700; // £ of taxable income (after personal allowance) taxed at basic rate

// PERSONAL_ALLOWANCE + BASIC_RATE_BAND — the gross-income point above
// which someone with no other allowances is a higher-rate taxpayer.
// Kept as its own constant because it's the number worth eyeballing
// when the tax year's figures change, even though computeCgtRateSplit
// no longer uses it directly (it derives the same boundary from the
// two constants above, correctly accounting for the personal allowance
// taper for incomes over £100,000, which a flat threshold cannot).
export const HIGHER_RATE_THRESHOLD_ANNUAL_INCOME = 50_270; // £, 2024/25
