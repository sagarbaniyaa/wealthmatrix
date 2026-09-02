import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface DfmInputs {
  riskCategory: string | null;
  objectives: string[];
  timeHorizonYears: number | null;
  timeHorizonSource: string;
  liquidityNeed: 'low' | 'medium' | 'high' | 'not stated';
  prefersPassive: boolean | null;
  prefersActive: boolean | null;
}

export interface FundCategoryWeight {
  category: string;
  weightPct: number;
}

@Entity('dfm_recommendation')
export class DfmRecommendationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;

  @Column({ type: 'jsonb', default: {} }) inputs: DfmInputs;
  @Column() mandate: string;
  @Column({ type: 'text', name: 'risk_alignment', nullable: true }) riskAlignment: string | null;
  @Column({ type: 'jsonb', default: [] }) reasoning: string[];
  @Column({ type: 'text', name: 'indicative_fee_range', nullable: true }) indicativeFeeRange: string | null;
  @Column({ type: 'jsonb', name: 'fund_categories', default: [] }) fundCategories: FundCategoryWeight[];
  @Column({ type: 'jsonb', default: [] }) gaps: string[];

  @Column({ type: 'text', name: 'ai_narrative', nullable: true }) aiNarrative: string | null;
  @Column({ type: 'text', name: 'ai_narrative_error', nullable: true }) aiNarrativeError: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
