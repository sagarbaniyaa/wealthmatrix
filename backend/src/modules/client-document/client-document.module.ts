import { Module } from '@nestjs/common';
import { ClientDocumentService } from './client-document.service';
import { ClientDocumentController } from './client-document.controller';
import { HouseholdModule } from '../household/household.module';
import { FactFindModule } from '../fact-find/fact-find.module';
import { ClientNoteModule } from '../client-note/client-note.module';
import { ComplianceLogModule } from '../compliance-log/compliance-log.module';
import { ClaudeClientService } from '../../services/wealth-analyst/claude-client.service';
import { DocumentTextExtractorService } from '../../services/report-builder/document-text-extractor.service';
import { IdentityExtractorService } from '../../services/document-intake/identity-extractor.service';
import { DocumentSummarizerService } from '../../services/document-intake/document-summarizer.service';
import { DocumentIntakeService } from '../../services/document-intake/document-intake.service';

@Module({
  imports: [HouseholdModule, FactFindModule, ClientNoteModule, ComplianceLogModule],
  providers: [
    ClientDocumentService,
    ClaudeClientService,
    DocumentTextExtractorService,
    IdentityExtractorService,
    DocumentSummarizerService,
    DocumentIntakeService,
  ],
  controllers: [ClientDocumentController],
  exports: [ClientDocumentService],
})
export class ClientDocumentModule {}
