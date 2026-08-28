import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('firm')
export class FirmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'uuid', name: 'base_currency_id', nullable: true }) baseCurrencyId: string | null;
  @Column({ type: 'varchar', name: 'fca_reference', nullable: true }) fcaReference: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
