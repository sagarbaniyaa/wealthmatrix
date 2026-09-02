import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ConsumerDutyOutcomeStatus = 'met' | 'concern' | 'not_assessed';

@Entity('consumer_duty_review')
export class ConsumerDutyReviewEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ type: 'uuid', name: 'reviewed_by', nullable: true }) reviewedBy: string | null;
  @Column({ type: 'date', name: 'review_date' }) reviewDate: string;

  @Column({ name: 'price_value_outcome', default: 'not_assessed' }) priceValueOutcome: ConsumerDutyOutcomeStatus;
  @Column({ type: 'text', name: 'price_value_notes', nullable: true }) priceValueNotes: string | null;
  @Column({ name: 'products_services_outcome', default: 'not_assessed' }) productsServicesOutcome: ConsumerDutyOutcomeStatus;
  @Column({ type: 'text', name: 'products_services_notes', nullable: true }) productsServicesNotes: string | null;
  @Column({ name: 'understanding_outcome', default: 'not_assessed' }) understandingOutcome: ConsumerDutyOutcomeStatus;
  @Column({ type: 'text', name: 'understanding_notes', nullable: true }) understandingNotes: string | null;
  @Column({ name: 'support_outcome', default: 'not_assessed' }) supportOutcome: ConsumerDutyOutcomeStatus;
  @Column({ type: 'text', name: 'support_notes', nullable: true }) supportNotes: string | null;

  @Column({ type: 'text', name: 'overall_notes', nullable: true }) overallNotes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
