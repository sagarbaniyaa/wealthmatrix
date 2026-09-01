import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface RetirementCashflowInputs {
  currentAge: number;
  retirementAge: number;
  planToAge: number;
  currentPotValue: number;
  monthlyContribution: number;
  desiredAnnualIncome: number;
  expectedReturnPct: number;
  returnVolatilityPct: number;
}

export interface RetirementCashflowYear {
  age: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface RetirementCashflowResults {
  successProbabilityPct: number;
  series: RetirementCashflowYear[];
  simulationCount: number;
}

@Entity('retirement_cashflow_scenario')
export class RetirementCashflowScenarioEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ type: 'varchar', nullable: true }) name: string | null;
  @Column({ type: 'jsonb', default: {} }) inputs: RetirementCashflowInputs;
  @Column({ type: 'jsonb', default: {} }) results: RetirementCashflowResults;
  @Column({ type: 'text', name: 'ai_narrative', nullable: true }) aiNarrative: string | null;
  @Column({ type: 'text', name: 'ai_narrative_error', nullable: true }) aiNarrativeError: string | null;
  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
