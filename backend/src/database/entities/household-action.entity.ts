import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('household_action')
export class HouseholdActionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ name: 'action_type' }) actionType: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'uuid', name: 'selected_by', nullable: true }) selectedBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
