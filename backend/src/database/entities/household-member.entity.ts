import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('household_member')
export class HouseholdMemberEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ name: 'person_id' }) personId: string;
  @Column({ type: 'varchar', nullable: true }) relationship: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
