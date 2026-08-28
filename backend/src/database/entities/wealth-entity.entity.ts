import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EntityType } from '../../common/enums/domain.enums';

@Entity('entity')
export class WealthEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column() name: string;
  @Column({ name: 'entity_type', type: 'enum', enum: EntityType }) entityType: EntityType;
  @Column({ type: 'varchar', nullable: true }) jurisdiction: string | null;
  @Column({ type: 'varchar', name: 'registration_number', nullable: true }) registrationNumber: string | null;
  @Column({ name: 'base_currency_id' }) baseCurrencyId: string;
  @Column({ type: 'uuid', name: 'household_id', nullable: true }) householdId: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
