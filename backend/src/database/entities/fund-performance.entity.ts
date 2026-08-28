import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fund_performance')
export class FundPerformanceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'fund_id' }) fundId: string;
  @Column() period: string; // 'YTD' | '1Y' | '3Y' | '5Y'
  @Column({ name: 'return_pct', type: 'numeric' }) returnPct: number;
  @Column({ name: 'as_of_date', type: 'date' }) asOfDate: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
