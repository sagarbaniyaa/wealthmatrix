import { Module } from '@nestjs/common';
import { ClientNoteService } from './client-note.service';
import { ClientNoteController } from './client-note.controller';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [HouseholdModule],
  providers: [ClientNoteService],
  controllers: [ClientNoteController],
  exports: [ClientNoteService],
})
export class ClientNoteModule {}
