import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('entity_ownership')
export class EntityOwnershipEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ type: 'uuid', name: 'owner_person_id', nullable: true }) ownerPersonId: string | null;
  @Column({ type: 'uuid', name: 'owner_entity_id', nullable: true }) ownerEntityId: string | null;
  @Column({ name: 'owned_entity_id' }) ownedEntityId: string;
  @Column({ name: 'ownership_pct', type: 'numeric', precision: 7, scale: 4 }) ownershipPct: number;
  @Column({ type: 'varchar', name: 'ownership_class', nullable: true }) ownershipClass: string | null;
  @Column({ name: 'valid_from', type: 'date' }) validFrom: string;
  @Column({ name: 'valid_to', type: 'date', nullable: true }) validTo: string | null;
  @Column({ type: 'uuid', name: 'structure_version_id', nullable: true }) structureVersionId: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
