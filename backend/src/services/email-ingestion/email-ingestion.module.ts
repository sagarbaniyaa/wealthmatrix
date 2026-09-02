import { Module } from '@nestjs/common';
import { ClientDocumentModule } from '../../modules/client-document/client-document.module';
import { CredentialCipherService } from '../../common/security/credential-cipher.service';
import { DocumentIntakeService } from '../document-intake/document-intake.service';
import { DocumentTextExtractorService } from '../report-builder/document-text-extractor.service';
import { IdentityExtractorService } from '../document-intake/identity-extractor.service';
import { DocumentSummarizerService } from '../document-intake/document-summarizer.service';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { FactFindModule } from '../../modules/fact-find/fact-find.module';
import { ClientNoteModule } from '../../modules/client-note/client-note.module';
import { ComplianceLogModule } from '../../modules/compliance-log/compliance-log.module';
import { EmailIngestionService } from './email-ingestion.service';
import { EmailIngestionController } from '../../modules/email-ingestion/email-ingestion.controller';

@Module({
  // ClientDocumentModule is imported for ClientDocumentService only —
  // DocumentIntakeService is re-provided fresh here (same reasoning as
  // ReportBuilderModule re-providing ClaudeClientService) rather than
  // importing it from ClientDocumentModule, since that module doesn't
  // export it (Document Intake there is wired directly into its own
  // controller, not meant as a public service of that module).
  imports: [ClientDocumentModule, FactFindModule, ClientNoteModule, ComplianceLogModule],
  providers: [
    EmailIngestionService, CredentialCipherService,
    DocumentIntakeService, DocumentTextExtractorService, IdentityExtractorService, DocumentSummarizerService, ClaudeClientService,
  ],
  controllers: [EmailIngestionController],
  exports: [EmailIngestionService],
})
export class EmailIngestionModule {}
