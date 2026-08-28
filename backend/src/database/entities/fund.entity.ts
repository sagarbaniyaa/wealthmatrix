import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('fund')
export class FundEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column() name: string;
  @Column() isin: string;
  @Column({ type: 'varchar', nullable: true }) sedol: string | null;
  @Column() sector: string;
  @Column({ name: 'asset_class' }) assetClass: string;
  @Column({ type: 'numeric', nullable: true }) ocf: number | null;
  @Column({ name: 'yield_pct', type: 'numeric', nullable: true }) yieldPct: number | null;
  @Column({ name: 'risk_rating', type: 'smallint', nullable: true }) riskRating: number | null;
  @Column({ name: 'volatility_pct', type: 'numeric', nullable: true }) volatilityPct: number | null;
  @Column({ name: 'max_drawdown_pct', type: 'numeric', nullable: true }) maxDrawdownPct: number | null;
  @Column({ type: 'varchar', nullable: true }) manager: string | null;
  @Column({ name: 'manager_tenure_years', type: 'numeric', nullable: true }) managerTenureYears: number | null;
  @Column({ name: 'esg_score', type: 'numeric', nullable: true }) esgScore: number | null;
  @Column({ name: 'currency_id', type: 'uuid', nullable: true }) currencyId: string | null;
  @Column({ name: 'inception_date', type: 'date', nullable: true }) inceptionDate: string | null;
  @Column({ type: 'numeric', nullable: true }) aum: number | null;
  @Column({ type: 'varchar', nullable: true }) description: string | null;
  @Column({ name: 'data_source', type: 'varchar', nullable: true }) dataSource: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
