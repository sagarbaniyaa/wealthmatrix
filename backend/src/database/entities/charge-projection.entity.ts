import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface ChargeArrangementOld {
  name: string;
  currentValue: number;
  ongoingChargePct: number;
  exitPenaltyPct: number;
}

export interface ChargeArrangementNew {
  name: string;
  ongoingChargePct: number;
  initialChargePct: number;
}

export interface ChargeProjectionAssumptions {
  projectionYears: number;
  grossGrowthRatePct: number;
}

export interface ChargeProjectionYear {
  year: number;
  oldValue: number;
  newValue: number;
}

export interface ChargeProjectionResults {
  series: ChargeProjectionYear[];
  startingNewValue: number;
  finalOldValue: number;
  finalNewValue: number;
  difference: number;     // finalNewValue - finalOldValue
  differencePct: number;  // difference / finalOldValue * 100
}

@Entity('charge_projection')
export class ChargeProjectionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ type: 'varchar', nullable: true }) name: string | null;
  @Column({ name: 'old_arrangement', type: 'jsonb', default: {} }) oldArrangement: ChargeArrangementOld;
  @Column({ name: 'new_arrangement', type: 'jsonb', default: {} }) newArrangement: ChargeArrangementNew;
  @Column({ type: 'jsonb', default: {} }) assumptions: ChargeProjectionAssumptions;
  @Column({ type: 'jsonb', default: {} }) results: ChargeProjectionResults;
  @Column({ type: 'text', name: 'ai_narrative', nullable: true }) aiNarrative: string | null;
  @Column({ type: 'text', name: 'ai_narrative_error', nullable: true }) aiNarrativeError: string | null;
  @Column({ type: 'uuid', name: 'created_by', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
