import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AssetClass } from '../../common/enums/domain.enums';

@Entity('asset')
export class AssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column() name: string;
  @Column({ name: 'asset_class', type: 'enum', enum: AssetClass }) assetClass: AssetClass;
  @Column({ type: 'varchar', nullable: true }) identifier: string | null;
  @Column({ name: 'currency_id' }) currencyId: string;
  @Column({ name: 'is_liability', default: false }) isLiability: boolean;
  @Column({ name: 'source_of_funds', type: 'varchar', nullable: true }) sourceOfFunds: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
