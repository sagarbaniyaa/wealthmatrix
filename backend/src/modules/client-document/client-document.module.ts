import { Module } from '@nestjs/common';
import { ClientDocumentService } from './client-document.service';
import { ClientDocumentController } from './client-document.controller';
import { HouseholdModule } from '../household/household.module';

@Module({
  imports: [HouseholdModule],
  providers: [ClientDocumentService],
  controllers: [ClientDocumentController],
  exports: [ClientDocumentService],
})
export class ClientDocumentModule {}
