import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface ReportCaseDetails {
  summary: string;
  facts: { label: string; value: string }[];
}

@Entity('report_case')
export class ReportCaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ name: 'report_template_id' }) reportTemplateId: string;
  @Column({ type: 'int', name: 'report_template_version', nullable: true }) reportTemplateVersion: number | null;
  @Column({ type: 'varchar', name: 'report_type' }) reportType: string;
  @Column({ name: 'case_details', type: 'jsonb', default: {} }) caseDetails: ReportCaseDetails;
  @Column({ type: 'text', nullable: true }) content: string | null;
  @Column({ type: 'varchar', default: 'draft' }) status: 'draft' | 'final';
  @Column({ type: 'text', name: 'generation_error', nullable: true }) generationError: string | null;
  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
