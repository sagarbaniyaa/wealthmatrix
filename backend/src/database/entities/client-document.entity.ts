import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ClientDocumentType } from '../../common/enums/domain.enums';

@Entity('client_document')
export class ClientDocumentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ type: 'varchar', name: 'document_type' }) documentType: ClientDocumentType;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'mime_type' }) mimeType: string;
  @Column({ name: 'file_data', type: 'bytea', select: false }) fileData: Buffer;
  @Column({ type: 'varchar', default: 'uploaded' }) source: 'uploaded' | 'generated';
  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true }) uploadedBy: string | null;

  // Document Intake — see migration 010 / DocumentIntakeService.
  @Column({ type: 'text', name: 'extracted_text', nullable: true }) extractedText: string | null;
  @Column({ type: 'jsonb', name: 'parsed_data', default: {} }) parsedData: Record<string, unknown>;
  @Column({ type: 'varchar', name: 'extraction_status', default: 'pending' })
  extractionStatus: 'pending' | 'processing' | 'done' | 'failed' | 'unsupported';
  @Column({ type: 'text', name: 'extraction_error', nullable: true }) extractionError: string | null;
  @Column({ type: 'text', name: 'applied_summary', nullable: true }) appliedSummary: string | null;
  @Column({ type: 'timestamptz', name: 'applied_at', nullable: true }) appliedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
