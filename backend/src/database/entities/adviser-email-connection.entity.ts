import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EmailConnectionStatus = 'pending' | 'connected' | 'error';

@Entity('adviser_email_connection')
export class AdviserEmailConnectionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'adviser_id' }) adviserId: string;

  @Column({ name: 'imap_host' }) imapHost: string;
  @Column({ type: 'int', name: 'imap_port', default: 993 }) imapPort: number;
  @Column({ type: 'boolean', name: 'imap_secure', default: true }) imapSecure: boolean;
  @Column() username: string;
  // select:false — an at-rest-encrypted secret; only the poller needs it.
  @Column({ name: 'encrypted_password', select: false }) encryptedPassword: string;

  @Column({ default: 'pending' }) status: EmailConnectionStatus;
  @Column({ type: 'text', name: 'last_error', nullable: true }) lastError: string | null;
  @Column({ type: 'timestamptz', name: 'last_polled_at', nullable: true }) lastPolledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
