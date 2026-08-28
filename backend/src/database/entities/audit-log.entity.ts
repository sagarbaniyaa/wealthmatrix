import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', name: 'firm_id', nullable: true }) firmId: string | null;
  @Column({ name: 'table_name' }) tableName: string;
  @Column({ name: 'row_id' }) rowId: string;
  @Column() action: 'INSERT' | 'UPDATE' | 'DELETE';
  @Column({ type: 'uuid', name: 'changed_by', nullable: true }) changedBy: string | null;
  @Column({ name: 'before_data', type: 'jsonb', nullable: true }) beforeData: Record<string, unknown> | null;
  @Column({ name: 'after_data', type: 'jsonb', nullable: true }) afterData: Record<string, unknown> | null;
  @Column({ name: 'changed_at', type: 'timestamptz' }) changedAt: Date;
}
