import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('risk_exposure')
export class RiskExposureEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ name: 'as_of_date', type: 'date' }) asOfDate: string;
  @Column({ name: 'leverage_ratio', type: 'numeric', precision: 7, scale: 4, nullable: true }) leverageRatio: number | null;
  @Column({ name: 'concentration_pct', type: 'numeric', precision: 7, scale: 4, nullable: true }) concentrationPct: number | null;
  @Column({ name: 'liquidity_ratio', type: 'numeric', precision: 7, scale: 4, nullable: true }) liquidityRatio: number | null;
  @Column({ name: 'fx_exposure', type: 'jsonb', default: {} }) fxExposure: Record<string, number>;
  @Column({ name: 'computed_at', type: 'timestamptz' }) computedAt: Date;
}
