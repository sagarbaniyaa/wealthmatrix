import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('currency')
export class CurrencyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'char', length: 3, unique: true }) code: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) symbol: string | null;
}
