import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '../../common/enums/role.enum';

@Entity('app_user')
export class AppUserEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column() email: string;
  @Column({ type: 'enum', enum: Role }) role: Role;
  @Column({ type: 'uuid', name: 'person_id', nullable: true }) personId: string | null;
  // Schema addendum — see auth.service.ts note. Not in the base DDL because
  // real deployments typically delegate to an external IdP.
  @Column({ type: 'varchar', name: 'password_hash', nullable: true, select: false }) passwordHash: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;

  // Provider Automation Hub — LOA autofill {{adviser_*}} tokens.
  @Column({ name: 'display_name', type: 'varchar', nullable: true }) displayName: string | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ name: 'address_line1', type: 'varchar', nullable: true }) addressLine1: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ name: 'postal_code', type: 'varchar', nullable: true }) postalCode: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
