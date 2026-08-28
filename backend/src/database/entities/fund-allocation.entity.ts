import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fund_allocation')
export class FundAllocationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'fund_id' }) fundId: string;
  @Column() category: string; // 'equity' | 'fixed_income' | 'cash' | 'alternatives'
  @Column({ name: 'weight_pct', type: 'numeric' }) weightPct: number;
  @Column({ name: 'as_of_date', type: 'date' }) asOfDate: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
