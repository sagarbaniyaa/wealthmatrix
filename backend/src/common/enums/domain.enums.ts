// Mirrors the Postgres enum types 1:1 — keep in sync with the schema.

export enum EntityType {
  COMPANY = 'company',
  SPV = 'spv',
  TRUST = 'trust',
  PARTNERSHIP = 'partnership',
  HOLDING_COMPANY = 'holding_company',
  FOUNDATION = 'foundation',
}

export enum AssetClass {
  CASH = 'cash',
  EQUITY_PUBLIC = 'equity_public',
  EQUITY_PRIVATE = 'equity_private',
  FIXED_INCOME = 'fixed_income',
  PROPERTY = 'property',
  PENSION = 'pension',
  PRIVATE_EQUITY_FUND = 'private_equity_fund',
  DEBT_INSTRUMENT = 'debt_instrument',
  OTHER = 'other',
}

export enum AccountType {
  BANK = 'bank',
  INVESTMENT = 'investment',
  PENSION = 'pension',
  LOAN = 'loan',
  CUSTODY = 'custody',
  OTHER = 'other',
}

export enum TransactionType {
  BUY = 'buy',
  SELL = 'sell',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  DIVIDEND = 'dividend',
  INTEREST = 'interest',
  FEE = 'fee',
  TRANSFER = 'transfer',
  VALUATION_ADJUSTMENT = 'valuation_adjustment',
  DISTRIBUTION = 'distribution',
  // A bonus issue, sub-division (stock split) or consolidation (reverse
  // split) — HMRC treats these as an adjustment to the Section 104 pool's
  // QUANTITY only, never its cost (see section-104.ts). `quantity` is the
  // signed net change in units (positive for a split/bonus issue, negative
  // for a consolidation); `amount` is always 0 — no cash changes hands.
  // A rights issue is deliberately NOT a separate type here: HMRC treats
  // the shares bought through one as an ordinary addition to the pool at
  // the price paid, which a normal BUY transaction already models exactly.
  STOCK_SPLIT = 'stock_split',
}

// CGT & Portfolio Intelligence — see migration 014. Determines whether
// a holding is even in scope for CGT at all before any number is computed.
export enum TaxWrapper {
  ISA = 'ISA',                     // CGT-exempt
  GIA = 'GIA',                     // General Investment Account — CGT applies in full
  SIPP = 'SIPP',                   // CGT-exempt (income-tax treatment on withdrawal instead)
  ONSHORE_BOND = 'ONSHORE_BOND',   // chargeable-event gains, NOT CGT — out of this engine's scope
  OFFSHORE_BOND = 'OFFSHORE_BOND', // chargeable-event gains, NOT CGT — out of this engine's scope
  OTHER = 'OTHER',                 // treated like GIA (CGT applies) unless known otherwise
}

export enum ScenarioEventType {
  BUSINESS_SALE = 'business_sale',
  INHERITANCE = 'inheritance',
  RELOCATION = 'relocation',
  DIVORCE = 'divorce',
  TAX_RESIDENCY_CHANGE = 'tax_residency_change',
  PROPERTY_SALE = 'property_sale',
  LIQUIDITY_EVENT = 'liquidity_event',
  PE_EXIT = 'pe_exit',
  DIVIDEND_RECAP = 'dividend_recap',
  LEVERAGE_CHANGE = 'leverage_change',
  CUSTOM = 'custom',
}

export enum ComplianceSeverity {
  INFO = 'info',
  WARNING = 'warning',
  BREACH = 'breach',
}

// Provider Automation Hub
export enum ClientDocumentType {
  LOA = 'LOA',
  FACT_FIND = 'FACT_FIND',
  KYC = 'KYC',
  ID_PROOF = 'ID_PROOF',
  ADDRESS_PROOF = 'ADDRESS_PROOF',
  BANK_STATEMENT = 'BANK_STATEMENT',
  POLICY_SUMMARY = 'POLICY_SUMMARY',
  ADVISER_DETAILS = 'ADVISER_DETAILS',
  // Document Intake — raw adviser uploads that get OCR/NLP-extracted and
  // auto-applied to the client record, distinct from FACT_FIND above
  // (which is the platform's own GENERATED fact-find PDF, never uploaded).
  FACT_FIND_SOURCE = 'FACT_FIND_SOURCE',
  RISK_PROFILE = 'RISK_PROFILE',
  FILE_NOTE = 'FILE_NOTE',
  PROVIDER_STATEMENT = 'PROVIDER_STATEMENT',
  // Live Client Call — see services/call-session. A call transcript is
  // routed through the exact same extraction path as FACT_FIND_SOURCE
  // (DocumentIntakeService), just labelled distinctly so the Documents
  // page and the client's file show it for what it actually is.
  CALL_TRANSCRIPT = 'CALL_TRANSCRIPT',
}

// Docs the adviser must actually upload themselves — we can't legitimately
// synthesize an ID document or bank statement. FACT_FIND, POLICY_SUMMARY
// and ADVISER_DETAILS are generated on the fly from data already in the
// database instead (see DocumentGeneratorService).
export const UPLOADABLE_DOCUMENT_TYPES = [
  ClientDocumentType.KYC,
  ClientDocumentType.ID_PROOF,
  ClientDocumentType.ADDRESS_PROOF,
  ClientDocumentType.BANK_STATEMENT,
  ClientDocumentType.FACT_FIND_SOURCE,
  ClientDocumentType.RISK_PROFILE,
  ClientDocumentType.FILE_NOTE,
  ClientDocumentType.PROVIDER_STATEMENT,
  ClientDocumentType.CALL_TRANSCRIPT,
] as const;

// The subset that Document Intake actually runs OCR/NLP extraction
// against and tries to auto-apply to the client record. KYC/ID_PROOF/
// ADDRESS_PROOF/BANK_STATEMENT are uploadable (see above) for attaching
// to a provider send pack, but a photo ID or bank statement mostly
// carries identity/financial signal that's either already covered by
// FACT_FIND_SOURCE or too risky to auto-apply without adviser review —
// so BANK_STATEMENT is summarised+noted, not auto-applied to figures.
export const EXTRACTABLE_DOCUMENT_TYPES = [
  ClientDocumentType.FACT_FIND_SOURCE,
  ClientDocumentType.KYC,
  ClientDocumentType.ID_PROOF,
  ClientDocumentType.ADDRESS_PROOF,
  ClientDocumentType.RISK_PROFILE,
  ClientDocumentType.FILE_NOTE,
  ClientDocumentType.BANK_STATEMENT,
  ClientDocumentType.PROVIDER_STATEMENT,
  ClientDocumentType.CALL_TRANSCRIPT,
] as const;

export enum ProviderActionStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  RECEIVED = 'RECEIVED',
  FAILED = 'FAILED',
}
