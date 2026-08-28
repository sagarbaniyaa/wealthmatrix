import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('person')
export class PersonEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'first_name' }) firstName: string;
  @Column({ name: 'last_name' }) lastName: string;
  @Column({ name: 'date_of_birth', type: 'date', nullable: true }) dateOfBirth: string | null;
  @Column({ type: 'varchar', name: 'tax_residency', nullable: true }) taxResidency: string | null;
  @Column({ type: 'varchar', nullable: true }) domicile: string | null;
  @Column({ name: 'is_active', default: true }) isActive: boolean;

  // Contact info
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ type: 'varchar', nullable: true }) email: string | null;
  @Column({ name: 'address_line1', type: 'varchar', nullable: true }) addressLine1: string | null;
  @Column({ name: 'address_line2', type: 'varchar', nullable: true }) addressLine2: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ name: 'postal_code', type: 'varchar', nullable: true }) postalCode: string | null;
  @Column({ type: 'varchar', nullable: true }) country: string | null;

  // KYC / risk profile
  @Column({ name: 'risk_tolerance', type: 'varchar', nullable: true }) riskTolerance: string | null;
  @Column({ name: 'kyc_status', type: 'varchar', default: 'pending' }) kycStatus: string;
  @Column({ name: 'kyc_verified_at', type: 'date', nullable: true }) kycVerifiedAt: string | null;
  @Column({ name: 'source_of_wealth', type: 'varchar', nullable: true }) sourceOfWealth: string | null;

  // Provider Automation Hub — LOA autofill token {{client_NI}}.
  @Column({ name: 'ni_number', type: 'varchar', nullable: true }) niNumber: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
