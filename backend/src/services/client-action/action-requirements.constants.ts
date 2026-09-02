import { ClientDocumentType } from '../../common/enums/domain.enums';

export const ACTION_TYPES = [
  'pension_transfer', 'investment_review', 'new_investment', 'dfm_recommendation',
  'isa_gia_setup', 'retirement_planning', 'consolidation', 'protection_review',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export type ComplianceCheckKey =
  | 'fact_find_completed' | 'risk_profile_recorded' | 'charges_compared' | 'consumer_duty_assessed';

export interface ActionRequirements {
  label: string;
  requiredDocuments: { type: ClientDocumentType; label: string }[];
  complianceChecks: { key: ComplianceCheckKey; label: string }[];
  suitabilitySectionLabel: string; // fuzzy-matched against report_template.report_type
  requiresProvider: boolean;
  relevantToDfm: boolean;
}

const CHECK_LABELS: Record<ComplianceCheckKey, string> = {
  fact_find_completed: 'Fact Find completed',
  risk_profile_recorded: 'Risk profile / attitude to risk recorded',
  charges_compared: 'Old vs. new charges compared (Projections)',
  consumer_duty_assessed: 'Consumer Duty outcomes assessed',
};

function checks(...keys: ComplianceCheckKey[]) {
  return keys.map((key) => ({ key, label: CHECK_LABELS[key] }));
}

function docs(...entries: { type: ClientDocumentType; label: string }[]) {
  return entries;
}

const D = ClientDocumentType;

/**
 * What each client action needs — a fixed rules table, not adviser-
 * editable data (same reasoning as the ATR question bank / DFM mandate
 * table). ClientActionService cross-references this against every other
 * module's REAL data to build a live checklist; nothing here is itself
 * a source of truth for whether something is actually done.
 *
 * Scoped to checks the platform can genuinely verify — no fabricated
 * "compliance passed" signal for something with no real underlying
 * data (e.g. there's no automated read of whether vulnerability was
 * *considered*, only whether a Fact Find — which has that section —
 * was completed at all).
 */
export const ACTION_REQUIREMENTS: Record<ActionType, ActionRequirements> = {
  pension_transfer: {
    label: 'Pension Transfer',
    requiredDocuments: docs(
      { type: D.ID_PROOF, label: 'ID' }, { type: D.ADDRESS_PROOF, label: 'Address Proof' },
      { type: D.BANK_STATEMENT, label: 'Bank Statement' }, { type: D.PROVIDER_STATEMENT, label: 'Provider Statement' },
    ),
    complianceChecks: checks('fact_find_completed', 'risk_profile_recorded', 'charges_compared', 'consumer_duty_assessed'),
    suitabilitySectionLabel: 'Pension Transfer',
    requiresProvider: true,
    relevantToDfm: true,
  },
  investment_review: {
    label: 'Investment Review',
    requiredDocuments: docs({ type: D.PROVIDER_STATEMENT, label: 'Provider Statement' }, { type: D.BANK_STATEMENT, label: 'Bank Statement' }),
    complianceChecks: checks('fact_find_completed', 'risk_profile_recorded', 'consumer_duty_assessed'),
    suitabilitySectionLabel: 'Investment Review',
    requiresProvider: false,
    relevantToDfm: true,
  },
  new_investment: {
    label: 'New Investment',
    requiredDocuments: docs(
      { type: D.KYC, label: 'KYC' }, { type: D.ID_PROOF, label: 'ID' },
      { type: D.ADDRESS_PROOF, label: 'Address Proof' }, { type: D.BANK_STATEMENT, label: 'Bank Statement' },
    ),
    complianceChecks: checks('fact_find_completed', 'risk_profile_recorded', 'consumer_duty_assessed'),
    suitabilitySectionLabel: 'New Investment',
    requiresProvider: true,
    relevantToDfm: true,
  },
  dfm_recommendation: {
    label: 'DFM Recommendation',
    requiredDocuments: docs({ type: D.BANK_STATEMENT, label: 'Bank Statement' }, { type: D.PROVIDER_STATEMENT, label: 'Provider Statement' }),
    complianceChecks: checks('fact_find_completed', 'risk_profile_recorded'),
    suitabilitySectionLabel: 'DFM Recommendation',
    requiresProvider: false,
    relevantToDfm: true,
  },
  isa_gia_setup: {
    label: 'ISA/GIA Setup',
    requiredDocuments: docs(
      { type: D.KYC, label: 'KYC' }, { type: D.ID_PROOF, label: 'ID' },
      { type: D.ADDRESS_PROOF, label: 'Address Proof' }, { type: D.BANK_STATEMENT, label: 'Bank Statement' },
    ),
    complianceChecks: checks('fact_find_completed', 'risk_profile_recorded', 'consumer_duty_assessed'),
    suitabilitySectionLabel: 'ISA/GIA Setup',
    requiresProvider: true,
    relevantToDfm: false,
  },
  retirement_planning: {
    label: 'Retirement Planning',
    requiredDocuments: docs({ type: D.FACT_FIND_SOURCE, label: 'Fact Find' }, { type: D.PROVIDER_STATEMENT, label: 'Provider Statement' }),
    complianceChecks: checks('fact_find_completed', 'risk_profile_recorded', 'consumer_duty_assessed'),
    suitabilitySectionLabel: 'Retirement Planning',
    requiresProvider: false,
    relevantToDfm: true,
  },
  consolidation: {
    label: 'Consolidation',
    requiredDocuments: docs(
      { type: D.PROVIDER_STATEMENT, label: 'Provider Statement' }, { type: D.ID_PROOF, label: 'ID' }, { type: D.ADDRESS_PROOF, label: 'Address Proof' },
    ),
    complianceChecks: checks('fact_find_completed', 'risk_profile_recorded', 'charges_compared', 'consumer_duty_assessed'),
    suitabilitySectionLabel: 'Consolidation',
    requiresProvider: true,
    relevantToDfm: true,
  },
  protection_review: {
    label: 'Protection Review',
    requiredDocuments: docs({ type: D.FILE_NOTE, label: 'File Note' }, { type: D.ID_PROOF, label: 'ID' }),
    complianceChecks: checks('fact_find_completed', 'consumer_duty_assessed'),
    suitabilitySectionLabel: 'Protection Review',
    requiresProvider: false,
    relevantToDfm: false,
  },
};
