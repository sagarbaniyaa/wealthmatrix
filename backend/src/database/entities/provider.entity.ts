import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('provider')
export class ProviderEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'provider_name' }) providerName: string;
  @Column({ name: 'provider_email' }) providerEmail: string;
  @Column({ type: 'varchar', name: 'servicing_email', nullable: true }) servicingEmail: string | null;
  @Column({ type: 'varchar', name: 'new_business_email', nullable: true }) newBusinessEmail: string | null;
  // Placeholder emails are guesses until a human confirms them — the
  // send flow requires an explicit override to email an unverified
  // address, since the attachment can contain NI numbers/bank statements.
  @Column({ name: 'email_verified', default: false }) emailVerified: boolean;
  @Column({ name: 'required_documents', type: 'jsonb' }) requiredDocuments: string[];
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
