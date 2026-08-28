import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fund_holdings')
export class FundHoldingEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'fund_id' }) fundId: string;
  @Column({ name: 'holding_name' }) holdingName: string;
  @Column({ name: 'holding_weight_pct', type: 'numeric' }) holdingWeightPct: number;
  @Column({ name: 'as_of_date', type: 'date' }) asOfDate: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
