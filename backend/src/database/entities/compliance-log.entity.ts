import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ComplianceSeverity } from '../../common/enums/domain.enums';

@Entity('compliance_log')
export class ComplianceLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ type: 'uuid', name: 'household_id', nullable: true }) householdId: string | null;
  @Column({ type: 'uuid', name: 'entity_id', nullable: true }) entityId: string | null;
  @Column({ type: 'enum', enum: ComplianceSeverity }) severity: ComplianceSeverity;
  @Column({ name: 'rule_code' }) ruleCode: string;
  @Column() message: string;
  @Column({ name: 'detected_at', type: 'timestamptz' }) detectedAt: Date;
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @Column({ type: 'uuid', name: 'resolved_by', nullable: true }) resolvedBy: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
}
