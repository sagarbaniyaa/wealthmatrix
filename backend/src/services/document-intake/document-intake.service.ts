import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { ClientDocumentType, ComplianceSeverity, EXTRACTABLE_DOCUMENT_TYPES } from '../../common/enums/domain.enums';
import { ClientDocumentEntity, HouseholdMemberEntity, PersonEntity } from '../../database/entities';
import { DocumentTextExtractorService } from '../report-builder/document-text-extractor.service';
import { IdentityExtractorService, ExtractedIdentity } from './identity-extractor.service';
import { DocumentSummarizerService } from './document-summarizer.service';
import { FactFindParserService } from '../fact-find/fact-find-parser.service';
import { FactFindService } from '../fact-find/fact-find.service';
import { ClientNoteService } from '../../modules/client-note/client-note.service';
import { ComplianceLogService } from '../../modules/compliance-log/compliance-log.service';

const IDENTITY_FIELD_LABELS: Record<keyof ExtractedIdentity, string> = {
  firstName: 'first name', lastName: 'last name', dateOfBirth: 'date of birth', email: 'email',
  phone: 'phone', niNumber: 'NI number', addressLine1: 'address', addressLine2: 'address line 2',
  city: 'city', postalCode: 'postcode', country: 'country',
};

/**
 * The Document Intake pipeline: OCR/text-extract an uploaded document,
 * then route it to whichever automated handling is safe for that
 * document type. Runs synchronously right after upload (see
 * ClientDocumentController) — "minimal manual work" means the adviser
 * sees the result immediately, not a background job they have to check
 * back on.
 *
 * Deliberately tiered by how safe auto-application is:
 *  - FACT_FIND_SOURCE: fills identity fields on the client's Person
 *    record AND creates a draft Fact Find from the document — the
 *    highest-value, lowest-risk case, since a fact find IS meant to
 *    become exactly that data.
 *  - KYC / ID_PROOF / ADDRESS_PROOF: identity fields only, same
 *    fill-if-empty rule (never overwrites an already-verified value).
 *  - RISK_PROFILE / BANK_STATEMENT / PROVIDER_STATEMENT / FILE_NOTE:
 *    summarised into a client note instead of auto-writing structured
 *    fields — a stated risk category or account figure from a random
 *    uploaded document isn't safe to silently merge into fields with
 *    their own specific provenance (WealthMatrix's own ATR score,
 *    adviser-verified financials). The adviser sees the summary and
 *    applies anything relevant themselves.
 *
 * A failure at any stage (unreadable file, Claude unavailable) never
 * fails the upload itself — the document is always saved; only its
 * extraction_status reflects what happened, same graceful-degradation
 * discipline as every other AI feature in this codebase.
 */
@Injectable()
export class DocumentIntakeService {
  private readonly logger = new Logger(DocumentIntakeService.name);

  constructor(
    private readonly textExtractor: DocumentTextExtractorService,
    private readonly identityExtractor: IdentityExtractorService,
    private readonly summarizer: DocumentSummarizerService,
    private readonly factFindParser: FactFindParserService,
    private readonly factFindService: FactFindService,
    private readonly clientNotes: ClientNoteService,
    private readonly complianceLog: ComplianceLogService,
  ) {}

  async ingest(documentId: string, uploadedBy: string): Promise<ClientDocumentEntity> {
    const manager = TenantContext.getManager();
    const docRepo = manager.getRepository(ClientDocumentEntity);
    const doc = await docRepo.createQueryBuilder('d').addSelect('d.fileData').where('d.id = :id', { id: documentId }).getOne();
    if (!doc) throw new NotFoundException(`Document ${documentId} not found`);

    if (!(EXTRACTABLE_DOCUMENT_TYPES as readonly ClientDocumentType[]).includes(doc.documentType)) {
      return doc; // nothing automated to do for this type (e.g. LOA, generated docs)
    }

    doc.extractionStatus = 'processing';
    await docRepo.save(doc);

    let text: string;
    try {
      text = await this.textExtractor.extractText(doc.mimeType, doc.fileData);
    } catch (err) {
      const message = (err as Error).message;
      doc.extractionStatus = /Unsupported file type/.test(message) ? 'unsupported' : 'failed';
      doc.extractionError = message;
      await docRepo.save(doc);
      await this.logCompliance(doc, ComplianceSeverity.WARNING, `Could not read "${doc.fileName}": ${message}`);
      return doc;
    }

    doc.extractedText = text;

    try {
      switch (doc.documentType) {
        case ClientDocumentType.FACT_FIND_SOURCE:
        case ClientDocumentType.CALL_TRANSCRIPT:
          await this.applyFactFindSource(doc, text, uploadedBy);
          break;
        case ClientDocumentType.KYC:
        case ClientDocumentType.ID_PROOF:
        case ClientDocumentType.ADDRESS_PROOF:
          await this.applyIdentityOnly(doc, text);
          break;
        default:
          await this.applySummaryNote(doc, text, uploadedBy);
      }
      doc.extractionStatus = 'done';
      doc.appliedAt = new Date();
      await this.logCompliance(doc, ComplianceSeverity.INFO, doc.appliedSummary ?? `Processed "${doc.fileName}".`);
    } catch (err) {
      doc.extractionStatus = 'failed';
      doc.extractionError = (err as Error).message;
      await this.logCompliance(doc, ComplianceSeverity.WARNING, `Extracted text from "${doc.fileName}" but applying it failed: ${doc.extractionError}`);
    }

    return docRepo.save(doc);
  }

  private async applyFactFindSource(doc: ClientDocumentEntity, text: string, uploadedBy: string): Promise<void> {
    const [identityResult, factFindResult] = await Promise.all([
      this.identityExtractor.extract(text),
      this.factFindParser.parse(text),
    ]);

    const appliedParts: string[] = [];

    if (identityResult.parsed) {
      const filled = await this.applyIdentityToPerson(doc.householdId, identityResult.parsed);
      if (filled.length) appliedParts.push(`Client record: filled ${filled.join(', ')}.`);
    }

    if (factFindResult.parsed) {
      const { gaps, lifeEvents, taxConcerns, riskBehaviourNotes, ...factFindFields } = factFindResult.parsed;
      // lifeEvents/taxConcerns/riskBehaviourNotes have no dedicated fact_find
      // column — folded into personalCircumstances (JSONB, no fixed shape)
      // rather than adding narrow columns for three call-derived fields.
      const personalCircumstances = {
        ...(factFindFields.personalCircumstances as Record<string, unknown> ?? {}),
        ...(lifeEvents?.length ? { lifeEvents } : {}),
        ...(taxConcerns ? { taxConcerns } : {}),
        ...(riskBehaviourNotes ? { riskBehaviourNotes } : {}),
      };
      const created = await this.factFindService.create(
        doc.householdId,
        { status: 'draft', ...factFindFields, ...(Object.keys(personalCircumstances).length ? { personalCircumstances } : {}) },
        uploadedBy,
      );
      appliedParts.push(`Created a draft Fact Find from this document (open it under Fact Finds to review and complete the risk questionnaire + declaration).`);
      if (gaps?.length) {
        appliedParts.push(`Not covered in the document — needs following up: ${gaps.slice(0, 4).join('; ')}${gaps.length > 4 ? '…' : ''}`);
      }
      void created; // id not surfaced directly; the household's Fact Find list already sorts newest-first
    }

    doc.parsedData = { identity: identityResult.parsed ?? null, factFind: factFindResult.parsed ?? null };
    doc.appliedSummary = appliedParts.length
      ? appliedParts.join(' ')
      : 'Could not extract usable Fact Find data from this document.';
  }

  private async applyIdentityOnly(doc: ClientDocumentEntity, text: string): Promise<void> {
    const { parsed } = await this.identityExtractor.extract(text);
    doc.parsedData = { identity: parsed ?? null };
    if (!parsed) {
      doc.appliedSummary = 'Could not extract identity fields from this document.';
      return;
    }
    const filled = await this.applyIdentityToPerson(doc.householdId, parsed);
    doc.appliedSummary = filled.length
      ? `Client record: filled ${filled.join(', ')}.`
      : 'No new identity fields to fill (already on file, or none stated in this document).';
  }

  private async applySummaryNote(doc: ClientDocumentEntity, text: string, uploadedBy: string): Promise<void> {
    const { parsed } = await this.summarizer.summarize(doc.documentType, text);
    doc.parsedData = { summary: parsed ?? null };
    if (!parsed) {
      doc.appliedSummary = 'Could not summarise this document.';
      return;
    }
    const label = doc.documentType.replace(/_/g, ' ').toLowerCase();
    const noteBody = `[Auto-extracted from ${label}: ${doc.fileName}]\n${parsed.summary}` +
      (parsed.keyFacts?.length ? `\nKey facts: ${parsed.keyFacts.join('; ')}` : '');
    await this.clientNotes.create({ householdId: doc.householdId, authorId: uploadedBy, note: noteBody } as any);
    doc.appliedSummary = 'Added a summary to the client\'s notes for adviser review.';
  }

  /** Fill-if-empty only — never overwrites an already-populated field with an OCR guess. */
  private async applyIdentityToPerson(householdId: string, identity: ExtractedIdentity): Promise<string[]> {
    const manager = TenantContext.getManager();
    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    if (!primaryMember) return [];

    const person = await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any });
    if (!person) return [];

    const updates: Partial<PersonEntity> = {};
    const filledLabels: string[] = [];
    (Object.keys(identity) as (keyof ExtractedIdentity)[]).forEach((key) => {
      const value = identity[key];
      if (!value) return;
      const current = (person as any)[key];
      if (current === null || current === undefined || current === '') {
        (updates as any)[key] = value;
        filledLabels.push(IDENTITY_FIELD_LABELS[key]);
      }
    });

    if (Object.keys(updates).length === 0) return [];
    await manager.getRepository(PersonEntity).update(person.id, updates);
    return filledLabels;
  }

  private async logCompliance(doc: ClientDocumentEntity, severity: ComplianceSeverity, message: string): Promise<void> {
    try {
      await this.complianceLog.create({
        householdId: doc.householdId,
        entityId: null,
        severity,
        ruleCode: 'DOCUMENT_INTAKE',
        message,
        detectedAt: new Date(),
        metadata: { documentId: doc.id, documentType: doc.documentType, fileName: doc.fileName },
      } as any);
    } catch (err) {
      this.logger.warn(`Could not write compliance log entry: ${(err as Error).message}`);
    }
  }
}
