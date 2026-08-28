import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('loa_template')
export class LoaTemplateEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column() name: string;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'mime_type' }) mimeType: string;
  // select: false — this can be a multi-MB blob; only load it on the one
  // endpoint that actually needs the bytes (the autofill/download path).
  @Column({ name: 'file_data', type: 'bytea', select: false }) fileData: Buffer;
  @Column({ name: 'field_map', type: 'jsonb', nullable: true }) fieldMap: Record<string, string> | null;
  @Column({ default: 1 }) version: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true }) uploadedBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
