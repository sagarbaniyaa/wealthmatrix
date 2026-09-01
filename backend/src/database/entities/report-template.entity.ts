import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('report_template')
export class ReportTemplateEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column() name: string;
  @Column({ type: 'varchar', name: 'report_type' }) reportType: string;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'mime_type' }) mimeType: string;
  // select:false — can be a multi-MB blob; only the download endpoint needs it.
  @Column({ name: 'file_data', type: 'bytea', select: false }) fileData: Buffer;
  // select:false too — a full report's worth of text, only needed when actually generating.
  @Column({ name: 'extracted_text', type: 'text', select: false }) extractedText: string;
  @Column({ default: 1 }) version: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true }) uploadedBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
