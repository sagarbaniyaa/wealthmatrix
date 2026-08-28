import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('structure_version')
export class StructureVersionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column() label: string;
  @Column({ name: 'effective_date', type: 'date' }) effectiveDate: string;
  @Column({ type: 'uuid', name: 'approved_by', nullable: true }) approvedBy: string | null;
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true }) approvedAt: Date | null;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
