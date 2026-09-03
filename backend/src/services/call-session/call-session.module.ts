import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { ClientDocumentModule } from '../../modules/client-document/client-document.module';
import { FactFindModule } from '../../modules/fact-find/fact-find.module';
import { ClientNoteModule } from '../../modules/client-note/client-note.module';
import { ComplianceLogModule } from '../../modules/compliance-log/compliance-log.module';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { DocumentTextExtractorService } from '../report-builder/document-text-extractor.service';
import { IdentityExtractorService } from '../document-intake/identity-extractor.service';
import { DocumentSummarizerService } from '../document-intake/document-summarizer.service';
import { DocumentIntakeService } from '../document-intake/document-intake.service';
import { CallSessionService } from './call-session.service';
import { CallSessionController } from '../../modules/call-session/call-session.controller';

@Module({
  // Same "re-provide DocumentIntakeService fresh" reasoning as
  // EmailIngestionModule — ClientDocumentModule doesn't export it (it's
  // wired directly into that module's own controller), so any other
  // module that needs the same pipeline provides its own instance.
  imports: [HouseholdModule, ClientDocumentModule, FactFindModule, ClientNoteModule, ComplianceLogModule],
  providers: [
    CallSessionService, ClaudeClientService,
    DocumentTextExtractorService, IdentityExtractorService, DocumentSummarizerService, DocumentIntakeService,
  ],
  controllers: [CallSessionController],
  exports: [CallSessionService],
})
export class CallSessionModule {}
