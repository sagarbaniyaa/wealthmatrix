import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AccountType } from '../../common/enums/domain.enums';

@Entity('account')
export class AccountEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ type: 'uuid', name: 'owner_person_id', nullable: true }) ownerPersonId: string | null;
  @Column({ type: 'uuid', name: 'owner_entity_id', nullable: true }) ownerEntityId: string | null;
  @Column({ name: 'account_type', type: 'enum', enum: AccountType }) accountType: AccountType;
  @Column({ type: 'varchar', nullable: true }) provider: string | null;
  // Provider Automation Hub — LOA autofill token {{policy_number}}.
  @Column({ name: 'policy_number', type: 'varchar', nullable: true }) policyNumber: string | null;
  @Column({ name: 'currency_id' }) currencyId: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
