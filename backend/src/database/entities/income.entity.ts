import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('income')
export class IncomeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'person_id' }) personId: string;
  @Column({ name: 'income_type' }) incomeType: string; // employment | self_employment | rental | dividend | pension | other
  @Column({ type: 'varchar', nullable: true }) description: string | null;
  @Column({ type: 'numeric', precision: 20, scale: 2 }) amount: number;
  @Column({ name: 'currency_id' }) currencyId: string;
  @Column({ type: 'varchar', default: 'annual' }) frequency: string; // annual | monthly | quarterly | one_off
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate: string | null;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate: string | null;
  @Column({ type: 'varchar', nullable: true }) notes: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
