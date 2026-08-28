import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('adviser_household_assignment')
export class AdviserHouseholdAssignmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'adviser_id' }) adviserId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
