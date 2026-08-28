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
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
