import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exchange_rate')
export class ExchangeRateEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'from_currency_id' }) fromCurrencyId: string;
  @Column({ name: 'to_currency_id' }) toCurrencyId: string;
  @Column({ name: 'rate_date', type: 'date' }) rateDate: string;
  @Column({ type: 'numeric', precision: 20, scale: 10 }) rate: number;
  @Column({ type: 'varchar', nullable: true }) source: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
