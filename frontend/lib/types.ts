// Mirrors the backend's DTOs / entity shapes relevant to the UI.

export type Role = 'admin' | 'adviser' | 'client';

export interface SessionUser {
  userId: string;
  firmId: string;
  role: Role;
  email: string;
  personId: string | null;
}

export interface Household {
  id: string;
  name: string;
  primaryAdviserId: string | null;
  createdAt: string;
}

export interface HouseholdNetWorth {
  householdId: string;
  asOfDate: string;
  baseCurrencyCode: string;
  personalNetWorth: number;
  entityAttributedNetWorth: number;
  totalNetWorth: number;
  entityBreakdown: Array<{
    entityId: string;
    entityName: string;
    effectiveOwnershipPct: number;
    entityNetAssetValue: number;
    attributedValue: number;
  }>;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'person' | 'entity';
  entityType?: string;
}
export interface GraphEdge {
  from: string;
  to: string;
  ownershipPct: number;
  ownershipClass: string | null;
  validFrom: string;
  validTo: string | null;
}
export interface OwnershipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type ScenarioEventType =
  | 'business_sale' | 'inheritance' | 'relocation' | 'divorce'
  | 'tax_residency_change' | 'property_sale' | 'liquidity_event'
  | 'pe_exit' | 'dividend_recap' | 'leverage_change' | 'custom';

export interface Scenario {
  id: string;
  householdId: string;
  name: string;
  eventType: ScenarioEventType;
  eventDate: string;
  parameters: Record<string, unknown>;
  status: 'draft' | 'running' | 'complete' | 'failed';
  result: {
    baselineNetWorth: number;
    projectedNetWorth: number;
    delta: number;
    narrative: string;
  } | null;
  createdAt: string;
}

export type ComplianceSeverity = 'info' | 'warning' | 'breach';

export interface ComplianceLogEntry {
  id: string;
  householdId: string | null;
  entityId: string | null;
  severity: ComplianceSeverity;
  ruleCode: string;
  message: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface RiskExposure {
  householdId: string;
  asOfDate: string;
  leverageRatio: number | null;
  concentrationPct: number | null;
  liquidityRatio: number | null;
  fxExposure: Record<string, number>;
}

// Client 360 / CRM profile
export interface Person {
  id: string;
  firmId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  taxResidency: string | null;
  domicile: string | null;
  isActive: boolean;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  riskTolerance: string | null;
  kycStatus: string;
  kycVerifiedAt: string | null;
  sourceOfWealth: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  personId: string;
  relationship: string | null;
  createdAt: string;
}

export interface Income {
  id: string;
  personId: string;
  incomeType: string;
  description: string | null;
  amount: number;
  currencyId: string;
  frequency: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ClientNote {
  id: string;
  householdId: string;
  authorId: string | null;
  note: string;
  createdAt: string;
}

export interface Account {
  id: string;
  ownerPersonId: string | null;
  ownerEntityId: string | null;
  accountType: string;
  provider: string | null;
  currencyId: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  assetClass: string;
  identifier: string | null;
  currencyId: string;
  isLiability: boolean;
  sourceOfFunds: string | null;
}

export interface Holding {
  id: string;
  accountId: string;
  assetId: string;
  asOfDate: string;
  quantity: number | null;
  marketValue: number;
  currencyId: string;
  source: string | null;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

export interface Firm {
  id: string;
  name: string;
  baseCurrencyId: string;
  fcaReference: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  firmId: string;
  tableName: string;
  rowId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changedBy: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  changedAt: string;
}

// Fund research module.
// NOTE: ocf/yieldPct/volatilityPct/maxDrawdownPct/managerTenureYears/
// esgScore/aum are Postgres NUMERIC columns — the pg driver returns these
// as strings, not numbers (see README). Always Number(...) them before
// arithmetic or .toFixed(); typed as `number` here only for convenience.
export interface Fund {
  id: string;
  name: string;
  isin: string;
  sedol: string | null;
  sector: string;
  assetClass: string;
  ocf: number | null;
  yieldPct: number | null;
  riskRating: number | null;
  volatilityPct: number | null;
  maxDrawdownPct: number | null;
  manager: string | null;
  managerTenureYears: number | null;
  esgScore: number | null;
  currencyId: string | null;
  inceptionDate: string | null;
  aum: number | null;
  description: string | null;
  dataSource: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FundPerformance {
  id: string;
  fundId: string;
  period: 'YTD' | '1Y' | '3Y' | '5Y';
  returnPct: number;
  asOfDate: string;
}

export interface FundHolding {
  id: string;
  fundId: string;
  holdingName: string;
  holdingWeightPct: number;
  asOfDate: string;
}

export interface FundAllocation {
  id: string;
  fundId: string;
  category: 'equity' | 'fixed_income' | 'cash' | 'alternatives';
  weightPct: number;
  asOfDate: string;
}

export interface FundScreen {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface PagedFunds {
  items: Fund[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FundComparisonResult {
  funds: Fund[];
  performanceByFund: Record<string, FundPerformance[]>;
  allocationByFund: Record<string, FundAllocation[]>;
}

export interface FundSuitabilityResult {
  householdId: string;
  riskTolerance: string | null;
  riskRatingBand: [number, number] | null;
  matchingFunds: PagedFunds;
}

export interface FundSwitchImpact {
  householdId: string;
  switchAmount: number;
  fundA: { id: string; name: string; isin: string; ocf: number | null; riskRating: number | null; volatilityPct: number | null; assetClass: string };
  fundB: { id: string; name: string; isin: string; ocf: number | null; riskRating: number | null; volatilityPct: number | null; assetClass: string };
  ocfDeltaPct: number | null;
  annualCostDelta: number | null;
  riskRatingDelta: number | null;
  volatilityDeltaPct: number | null;
  liquidityChange: 'improved' | 'reduced' | 'unchanged';
  liquidityNote: string;
}

// Provider Automation Hub

export interface Provider {
  id: string;
  providerName: string;
  providerEmail: string;
  servicingEmail: string | null;
  newBusinessEmail: string | null;
  emailVerified: boolean;
  requiredDocuments: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoaTemplate {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  fieldMap: Record<string, string> | null;
  version: number;
  isActive: boolean;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UploadableDocumentType = 'KYC' | 'ID_PROOF' | 'ADDRESS_PROOF' | 'BANK_STATEMENT';
export type ClientDocumentType = UploadableDocumentType | 'LOA' | 'FACT_FIND' | 'POLICY_SUMMARY' | 'ADVISER_DETAILS';

export interface ClientDocument {
  id: string;
  householdId: string;
  documentType: ClientDocumentType;
  fileName: string;
  mimeType: string;
  source: 'uploaded' | 'generated';
  uploadedBy: string | null;
  createdAt: string;
}

export interface PackManifestEntry { documentType: string; fileName: string; included: boolean }

export type ProviderActionStatus = 'PENDING' | 'SENT' | 'RECEIVED' | 'FAILED';

// Fact Find + Attitude-to-Risk

export interface RiskQuestionOption { key: 'A' | 'B' | 'C' | 'D' | 'E'; label: string; weight: number }
export interface RiskQuestion { key: string; prompt: string; options: RiskQuestionOption[] }

export interface FactFind {
  id: string;
  householdId: string;
  status: 'draft' | 'completed';
  reviewPurposes: Record<string, any>;
  personalCircumstances: Record<string, any>;
  incomeExpenditure: Record<string, any>;
  assets: Record<string, any>;
  liabilities: Record<string, any>;
  insurance: Record<string, any>;
  investmentQuestions: Record<string, any>;
  retirementQuestions: Record<string, any>;
  riskCapacity: Record<string, any>;
  riskQuestionnaire: { questionKey: string; selectedOption: string }[];
  riskScore: number | null;
  riskCategory: string | null;
  declaration: Record<string, any>;
  completedOn: string | null;
  signedOn: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Report Template Builder

export interface ReportTemplate {
  id: string;
  name: string;
  reportType: string;
  fileName: string;
  mimeType: string;
  version: number;
  isActive: boolean;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCaseDetails {
  summary: string;
  facts: { label: string; value: string }[];
}

export interface ReportCase {
  id: string;
  householdId: string;
  reportTemplateId: string;
  reportTemplateVersion: number | null;
  reportType: string;
  caseDetails: ReportCaseDetails;
  content: string | null;
  status: 'draft' | 'final';
  generationError: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuitabilityReportContext {
  household: { id: string; name: string };
  factFind: FactFind | null;
  netWorth: HouseholdNetWorth | null;
  riskMetrics: Record<string, any> | null;
  suitableFunds: FundSuitabilityResult | null;
}

export interface SuitabilityReportResult {
  context: SuitabilityReportContext;
  narrative: string | null;
  narrativeError: string | null;
}

export interface ComplianceProviderAction {
  id: string;
  householdId: string;
  providerId: string;
  adviserId: string;
  loaTemplateId: string | null;
  loaVersion: number | null;
  documentsSent: { documentType: string; fileName: string }[];
  emailStatus: ProviderActionStatus;
  emailError: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}
