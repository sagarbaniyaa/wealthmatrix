import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type CallStatus = 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'no-answer' | 'busy' | 'canceled';

@Entity('client_call_log')
export class ClientCallLogEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ name: 'adviser_id' }) adviserId: string;
  @Column({ name: 'client_person_id' }) clientPersonId: string;

  @Column({ name: 'to_number' }) toNumber: string;
  @Column({ name: 'from_number' }) fromNumber: string;
  @Column({ name: 'adviser_number' }) adviserNumber: string;

  @Column({ type: 'varchar', name: 'twilio_call_sid', nullable: true }) twilioCallSid: string | null;
  @Column({ default: 'initiated' }) status: CallStatus;
  @Column({ type: 'int', name: 'duration_seconds', nullable: true }) durationSeconds: number | null;
  @Column({ type: 'text', name: 'error_message', nullable: true }) errorMessage: string | null;

  @Column({ type: 'uuid', name: 'initiated_by', nullable: true }) initiatedBy: string | null;
  @CreateDateColumn({ name: 'initiated_at' }) initiatedAt: Date;
  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true }) endedAt: Date | null;
}
