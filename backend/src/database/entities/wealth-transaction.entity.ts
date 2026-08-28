import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TransactionType } from '../../common/enums/domain.enums';

@Entity('transaction')
export class WealthTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'account_id' }) accountId: string;
  @Column({ type: 'uuid', name: 'asset_id', nullable: true }) assetId: string | null;
  @Column({ name: 'transaction_type', type: 'enum', enum: TransactionType }) transactionType: TransactionType;
  @Column({ name: 'transaction_date', type: 'date' }) transactionDate: string;
  @Column({ type: 'numeric', precision: 24, scale: 8, nullable: true }) quantity: number | null;
  @Column({ type: 'numeric', precision: 20, scale: 2 }) amount: number;
  @Column({ name: 'currency_id' }) currencyId: string;
  @Column({ type: 'varchar', nullable: true }) description: string | null;
  @Column({ type: 'varchar', name: 'external_ref', nullable: true }) externalRef: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
