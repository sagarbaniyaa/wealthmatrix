import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('client_note')
export class ClientNoteEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'firm_id' }) firmId: string;
  @Column({ name: 'household_id' }) householdId: string;
  @Column({ name: 'author_id', type: 'uuid', nullable: true }) authorId: string | null;
  @Column({ type: 'text' }) note: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
