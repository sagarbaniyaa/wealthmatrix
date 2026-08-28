import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('fact_find')
export class FactFindEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ type: 'varchar', default: 'draft' }) status: 'draft' | 'completed';

  @Column({ name: 'review_purposes', type: 'jsonb', default: {} }) reviewPurposes: Record<string, unknown>;
  @Column({ name: 'personal_circumstances', type: 'jsonb', default: {} }) personalCircumstances: Record<string, unknown>;
  @Column({ name: 'income_expenditure', type: 'jsonb', default: {} }) incomeExpenditure: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) assets: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) liabilities: Record<string, unknown>;
  @Column({ type: 'jsonb', default: {} }) insurance: Record<string, unknown>;
  @Column({ name: 'investment_questions', type: 'jsonb', default: {} }) investmentQuestions: Record<string, unknown>;
  @Column({ name: 'retirement_questions', type: 'jsonb', default: {} }) retirementQuestions: Record<string, unknown>;
  @Column({ name: 'risk_capacity', type: 'jsonb', default: {} }) riskCapacity: Record<string, unknown>;
  @Column({ name: 'risk_questionnaire', type: 'jsonb', default: [] }) riskQuestionnaire: { questionKey: string; selectedOption: string }[];
  @Column({ name: 'risk_score', type: 'numeric', precision: 5, scale: 2, nullable: true }) riskScore: number | null;
  @Column({ type: 'varchar', name: 'risk_category', nullable: true }) riskCategory: string | null;
  @Column({ type: 'jsonb', default: {} }) declaration: Record<string, unknown>;

  @Column({ type: 'date', name: 'completed_on', nullable: true }) completedOn: string | null;
  @Column({ type: 'date', name: 'signed_on', nullable: true }) signedOn: string | null;
  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
