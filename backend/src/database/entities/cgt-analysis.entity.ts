import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface CgtHoldingDetail {
  accountId: string;
  accountProvider: string | null;
  assetId: string;
  assetName: string;
  taxWrapper: string | null;
  marketValue: number;
  costBasis: number | null;
  gain: number | null;
  dataQualityNote: string | null;
}

export interface PerPersonCgtPosition {
  personId: string;
  personName: string;
  annualExemptAmount: number;
  totalGains: number;
  totalLosses: number;
  netGain: number;
  remainingAllowance: number;
  estimatedTaxIfRealisedNow: { basicRate: number; higherRate: number };
  likelyBand: 'basic' | 'higher' | 'unknown';
  holdings: CgtHoldingDetail[];
}

export interface CgtRecommendation {
  category: 'best_to_sell' | 'zero_cgt' | 'low_cgt' | 'avoid_selling' | 'withdrawal_strategy';
  personId: string;
  title: string;
  detail: string;
  accountId?: string;
  assetId?: string;
}

@Entity('cgt_analysis')
export class CgtAnalysisEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;

  @Column({ type: 'date', name: 'as_of_date' }) asOfDate: string;
  @Column({ type: 'jsonb', name: 'per_person', default: [] }) perPerson: PerPersonCgtPosition[];
  @Column({ type: 'jsonb', default: [] }) recommendations: CgtRecommendation[];
  @Column({ type: 'jsonb', default: [] }) gaps: string[];

  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
