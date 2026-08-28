import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('holding')
export class HoldingEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'account_id' }) accountId: string;
  @Column({ name: 'asset_id' }) assetId: string;
  @Column({ name: 'as_of_date', type: 'date' }) asOfDate: string;
  @Column({ type: 'numeric', precision: 24, scale: 8, nullable: true }) quantity: number | null;
  @Column({ name: 'market_value', type: 'numeric', precision: 20, scale: 2 }) marketValue: number;
  @Column({ name: 'currency_id' }) currencyId: string;
  @Column({ type: 'varchar', nullable: true }) source: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
