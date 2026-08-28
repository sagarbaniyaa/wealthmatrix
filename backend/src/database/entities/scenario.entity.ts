import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ScenarioEventType } from '../../common/enums/domain.enums';

@Entity('scenario')
export class ScenarioEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column() name: string;
  @Column({ name: 'event_type', type: 'enum', enum: ScenarioEventType }) eventType: ScenarioEventType;
  @Column({ name: 'event_date', type: 'date' }) eventDate: string;
  @Column({ type: 'jsonb', default: {} }) parameters: Record<string, unknown>;
  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'jsonb', nullable: true }) result: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
