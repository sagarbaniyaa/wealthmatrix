export interface EntityRiskProfile {
  entityId: string;
  entityName: string;
  entityType: string;
  effectiveOwnershipPct: number;
  grossAssets: number;
  grossLiabilities: number;
  leverageRatio: number;
  concentrationPct: number;
  currencyExposure: Record<string, number>;
}

export interface HouseholdRiskContext {
  householdId: string;
  asOfDate: string;
  totalNetWorth: number;
  entities: EntityRiskProfile[];
  unresolvedComplianceCount: number;
}

export interface QueryFilterSpec {
  ownershipPctMin?: number;
  ownershipPctMax?: number;
  leverageRatioMin?: number;
  leverageRatioMax?: number;
  concentrationPctMin?: number;
  concentrationPctMax?: number;
  currency?: string;
}

export interface WeightedPosition {
  value: number; // already weighted by effective ownership %
  assetClass: string;
  isLiability: boolean;
  currencyCode: string;
}

export type RiskColor = 'green' | 'yellow' | 'red' | 'neutral';

export interface RiskMetric {
  value: number | null; // percentage (0-100), null when undefined (e.g. no assets, no risk tolerance set)
  color: RiskColor;
  label: string;
  note: string | null; // AI-generated, null if Claude call failed/unavailable
}

export interface HouseholdRiskMetrics {
  householdId: string;
  asOfDate: string;
  totalGrossAssets: number;
  totalGrossLiabilities: number;
  leverage: RiskMetric;
  concentration: RiskMetric;
  liquidity: RiskMetric;
  currencyExposure: RiskMetric;
  suitabilityDrift: RiskMetric;
  aiError: string | null; // set when the narrative notes couldn't be generated (e.g. billing)
}