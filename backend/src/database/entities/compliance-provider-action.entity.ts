import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProviderActionStatus } from '../../common/enums/domain.enums';

@Entity('compliance_provider_actions')
export class ComplianceProviderActionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ name: 'provider_id' }) providerId: string;
  @Column({ name: 'adviser_id' }) adviserId: string;
  @Column({ type: 'uuid', name: 'loa_template_id', nullable: true }) loaTemplateId: string | null;
  @Column({ type: 'int', name: 'loa_version', nullable: true }) loaVersion: number | null;
  @Column({ name: 'documents_sent', type: 'jsonb' }) documentsSent: { documentType: string; fileName: string }[];
  // Plain TEXT column (not a Postgres enum type) — same "open-ended
  // categorical" convention as fund.sector etc.: app-level validation via
  // @IsIn(), no schema migration needed if the status list ever changes.
  @Column({ type: 'varchar', name: 'email_status' }) emailStatus: ProviderActionStatus;
  @Column({ name: 'email_error', type: 'text', nullable: true }) emailError: string | null;
  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true }) sentAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
