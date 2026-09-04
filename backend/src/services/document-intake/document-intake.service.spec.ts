import { tenantALS } from '../../common/database/tenant-context';
import { Role } from '../../common/enums/role.enum';
import { ClientDocumentType, ComplianceSeverity } from '../../common/enums/domain.enums';
import { ClientDocumentEntity, HouseholdMemberEntity, PersonEntity } from '../../database/entities';
import { DocumentIntakeService } from './document-intake.service';

/**
 * Unit tests for the Document Intake orchestrator — the pipeline
 * previously verified only by hand (see the platform's own "Could not
 * extract usable Fact Find data" bug, hit on a real upload and fixed
 * live). No DB, no OCR, no Claude: every injected service is a plain
 * jest mock, and TenantContext runs over a fake EntityManager via
 * tenantALS.run — the same AsyncLocalStorage TenantTransactionInterceptor
 * uses for a real request, just fed fake data instead of a real
 * transaction.
 */

function makeMockManager(opts: { doc: Partial<ClientDocumentEntity>; members?: Partial<HouseholdMemberEntity>[]; person?: Partial<PersonEntity> | null }) {
  const savedDocs: any[] = [];
  const docRepo = {
    createQueryBuilder: jest.fn(() => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ ...opts.doc }),
    })),
    save: jest.fn((d: any) => { savedDocs.push({ ...d }); return Promise.resolve(d); }),
  };
  const memberRepo = { find: jest.fn().mockResolvedValue(opts.members ?? []) };
  const personUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const personRepo = { findOne: jest.fn().mockResolvedValue(opts.person ?? null), update: personUpdate };

  const manager = {
    getRepository: jest.fn((entity: any) => {
      if (entity === ClientDocumentEntity) return docRepo;
      if (entity === HouseholdMemberEntity) return memberRepo;
      if (entity === PersonEntity) return personRepo;
      throw new Error(`Unexpected repository requested: ${entity}`);
    }),
  };

  return { manager, docRepo, memberRepo, personRepo, personUpdate, savedDocs };
}

function runInFakeTenant<T>(manager: any, fn: () => Promise<T>): Promise<T> {
  return tenantALS.run({ firmId: 'firm-1', userId: 'adviser-1', role: Role.ADVISER, manager }, fn);
}

function baseDoc(overrides: Partial<ClientDocumentEntity> = {}): Partial<ClientDocumentEntity> {
  return {
    id: 'doc-1', firmId: 'firm-1', householdId: 'household-1', fileName: 'upload.pdf',
    mimeType: 'application/pdf', extractionStatus: 'pending', ...overrides,
  };
}

describe('DocumentIntakeService', () => {
  let textExtractor: { extractText: jest.Mock };
  let identityExtractor: { extract: jest.Mock };
  let summarizer: { summarize: jest.Mock };
  let factFindParser: { parse: jest.Mock };
  let factFindService: { create: jest.Mock };
  let clientNotes: { create: jest.Mock };
  let complianceLog: { create: jest.Mock };
  let service: DocumentIntakeService;

  beforeEach(() => {
    textExtractor = { extractText: jest.fn() };
    identityExtractor = { extract: jest.fn() };
    summarizer = { summarize: jest.fn() };
    factFindParser = { parse: jest.fn() };
    factFindService = { create: jest.fn().mockResolvedValue({ id: 'ff-1' }) };
    clientNotes = { create: jest.fn().mockResolvedValue({ id: 'note-1' }) };
    complianceLog = { create: jest.fn().mockResolvedValue({ id: 'log-1' }) };
    service = new DocumentIntakeService(
      textExtractor as any, identityExtractor as any, summarizer as any,
      factFindParser as any, factFindService as any, clientNotes as any, complianceLog as any,
    );
  });

  it('does nothing for a non-extractable document type (e.g. a generated LOA)', async () => {
    const { manager } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.LOA }) });
    const result = await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

    expect(textExtractor.extractText).not.toHaveBeenCalled();
    expect(result.documentType).toBe(ClientDocumentType.LOA);
  });

  it('marks extraction "unsupported" (not "failed") for an unsupported file type, and logs a compliance warning', async () => {
    const { manager, docRepo } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.KYC }) });
    textExtractor.extractText.mockRejectedValue(new Error('Unsupported file type: image/heic'));

    await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

    const finalSave = docRepo.save.mock.calls.at(-1)[0];
    expect(finalSave.extractionStatus).toBe('unsupported');
    expect(finalSave.extractionError).toBe('Unsupported file type: image/heic');
    expect(complianceLog.create).toHaveBeenCalledWith(expect.objectContaining({ severity: ComplianceSeverity.WARNING }));
  });

  it('marks extraction "failed" for any other text-extraction error', async () => {
    const { manager, docRepo } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.KYC }) });
    textExtractor.extractText.mockRejectedValue(new Error('Corrupt PDF stream'));

    await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

    expect(docRepo.save.mock.calls.at(-1)[0].extractionStatus).toBe('failed');
  });

  describe('FACT_FIND_SOURCE', () => {
    it('combines a successful identity extraction and fact find parse into one appliedSummary', async () => {
      const { manager, docRepo, personUpdate } = makeMockManager({
        doc: baseDoc({ documentType: ClientDocumentType.FACT_FIND_SOURCE }),
        members: [{ personId: 'person-1', relationship: 'head' }],
        person: { id: 'person-1', firstName: null as any, lastName: 'Smith' },
      });
      textExtractor.extractText.mockResolvedValue('some meeting notes text');
      identityExtractor.extract.mockResolvedValue({ parsed: { firstName: 'Jane' }, error: null });
      factFindParser.parse.mockResolvedValue({
        parsed: { personalCircumstances: {}, gaps: ['No mention of dependants'] }, error: null,
      });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      const final = docRepo.save.mock.calls.at(-1)[0];
      expect(personUpdate).toHaveBeenCalledWith('person-1', { firstName: 'Jane' });
      expect(final.appliedSummary).toContain('Client record: filled first name.');
      expect(final.appliedSummary).toContain('Created a draft Fact Find');
      expect(final.appliedSummary).toContain('No mention of dependants');
      expect(final.extractionStatus).toBe('done');
    });

    it('reports "Could not extract usable Fact Find data" when NEITHER identity nor fact find parses — the exact bug hit on a real upload', async () => {
      const { manager, docRepo } = makeMockManager({
        doc: baseDoc({ documentType: ClientDocumentType.FACT_FIND_SOURCE }),
        members: [],
      });
      textExtractor.extractText.mockResolvedValue('unreadable garbage text');
      identityExtractor.extract.mockResolvedValue({ parsed: null, error: 'Claude returned no JSON' });
      factFindParser.parse.mockResolvedValue({ parsed: null, error: 'Claude returned no JSON' });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      const final = docRepo.save.mock.calls.at(-1)[0];
      expect(final.appliedSummary).toBe('Could not extract usable Fact Find data from this document.');
      expect(final.extractionStatus).toBe('done'); // extraction itself succeeded — there's just nothing usable in it
      expect(factFindService.create).not.toHaveBeenCalled();
    });

    it('folds lifeEvents/taxConcerns/riskBehaviourNotes into personalCircumstances (no dedicated fact_find column for them)', async () => {
      const { manager } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.FACT_FIND_SOURCE }), members: [] });
      textExtractor.extractText.mockResolvedValue('notes');
      identityExtractor.extract.mockResolvedValue({ parsed: null, error: null });
      factFindParser.parse.mockResolvedValue({
        parsed: {
          personalCircumstances: { maritalStatus: 'married' },
          lifeEvents: ['Getting married next year'],
          taxConcerns: 'Worried about CGT on a share sale',
          riskBehaviourNotes: 'Client got nervous discussing 2022 losses',
          gaps: [],
        },
        error: null,
      });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      expect(factFindService.create).toHaveBeenCalledWith(
        'household-1',
        expect.objectContaining({
          status: 'draft',
          personalCircumstances: {
            maritalStatus: 'married',
            lifeEvents: ['Getting married next year'],
            taxConcerns: 'Worried about CGT on a share sale',
            riskBehaviourNotes: 'Client got nervous discussing 2022 losses',
          },
        }),
        'adviser-1',
      );
    });

    it('truncates a long gaps list to 4 items with an ellipsis, rather than dumping the whole list', async () => {
      const { manager, docRepo } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.FACT_FIND_SOURCE }), members: [] });
      textExtractor.extractText.mockResolvedValue('notes');
      identityExtractor.extract.mockResolvedValue({ parsed: null, error: null });
      factFindParser.parse.mockResolvedValue({
        parsed: { personalCircumstances: {}, gaps: ['gap1', 'gap2', 'gap3', 'gap4', 'gap5', 'gap6'] },
        error: null,
      });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      const final = docRepo.save.mock.calls.at(-1)[0];
      expect(final.appliedSummary).toContain('gap1; gap2; gap3; gap4…');
      expect(final.appliedSummary).not.toContain('gap5');
    });
  });

  describe('identity-only document types (KYC/ID_PROOF/ADDRESS_PROOF)', () => {
    it('fills an empty field but never overwrites an already-populated one', async () => {
      const { manager, personUpdate } = makeMockManager({
        doc: baseDoc({ documentType: ClientDocumentType.ID_PROOF }),
        members: [{ personId: 'person-1', relationship: 'head' }],
        person: { id: 'person-1', firstName: 'Existing', lastName: null as any },
      });
      textExtractor.extractText.mockResolvedValue('ID document text');
      identityExtractor.extract.mockResolvedValue({
        parsed: { firstName: 'Overwritten', lastName: 'Smith' }, error: null,
      });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      // Only lastName (previously empty) should be written — firstName already had a value.
      expect(personUpdate).toHaveBeenCalledWith('person-1', { lastName: 'Smith' });
    });

    it('prefers the "head" household member when multiple members exist', async () => {
      const { manager, personRepo } = makeMockManager({
        doc: baseDoc({ documentType: ClientDocumentType.ID_PROOF }),
        members: [{ personId: 'person-spouse', relationship: 'spouse' }, { personId: 'person-head', relationship: 'head' }],
        person: { id: 'person-head', firstName: null as any },
      });
      textExtractor.extractText.mockResolvedValue('text');
      identityExtractor.extract.mockResolvedValue({ parsed: { firstName: 'Jane' }, error: null });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      expect(personRepo.findOne).toHaveBeenCalledWith({ where: { id: 'person-head' } });
    });

    it('reports "Could not extract identity fields" when extraction returns nothing', async () => {
      const { manager, docRepo } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.ADDRESS_PROOF }), members: [] });
      textExtractor.extractText.mockResolvedValue('unreadable');
      identityExtractor.extract.mockResolvedValue({ parsed: null, error: 'no JSON' });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      expect(docRepo.save.mock.calls.at(-1)[0].appliedSummary).toBe('Could not extract identity fields from this document.');
    });
  });

  describe('other document types (RISK_PROFILE, BANK_STATEMENT, etc.)', () => {
    it('summarises the document into a client note rather than auto-writing any field', async () => {
      const { manager } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.RISK_PROFILE }) });
      textExtractor.extractText.mockResolvedValue('risk questionnaire text');
      summarizer.summarize.mockResolvedValue({
        parsed: { summary: 'Client scored as balanced risk.', keyFacts: ['ATR score: 62/100'] }, error: null,
      });

      await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      expect(clientNotes.create).toHaveBeenCalledWith(expect.objectContaining({
        householdId: 'household-1', authorId: 'adviser-1',
        note: expect.stringContaining('Client scored as balanced risk.'),
      }));
      expect(clientNotes.create.mock.calls[0][0].note).toContain('ATR score: 62/100');
    });

    it('reports "Could not summarise" without creating a note when summarisation fails', async () => {
      const { manager } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.BANK_STATEMENT }) });
      textExtractor.extractText.mockResolvedValue('bank statement text');
      summarizer.summarize.mockResolvedValue({ parsed: null, error: 'Claude unavailable' });

      const result = await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

      expect(clientNotes.create).not.toHaveBeenCalled();
      expect(result.appliedSummary).toBe('Could not summarise this document.');
    });
  });

  it('marks extraction "failed" (not a thrown/unhandled error) when applying the extracted text throws', async () => {
    const { manager, docRepo, savedDocs } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.FACT_FIND_SOURCE }), members: [] });
    textExtractor.extractText.mockResolvedValue('notes');
    identityExtractor.extract.mockResolvedValue({ parsed: null, error: null });
    factFindParser.parse.mockResolvedValue({ parsed: { personalCircumstances: {}, gaps: [] }, error: null });
    factFindService.create.mockRejectedValue(new Error('DB constraint violation'));

    const result = await runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'));

    expect(result.extractionStatus).toBe('failed');
    expect(result.extractionError).toBe('DB constraint violation');
    // Saved once as "processing" before extraction, once more as "failed" at the end.
    expect(docRepo.save).toHaveBeenCalledTimes(2);
    expect(savedDocs[0].extractionStatus).toBe('processing');
    expect(savedDocs[1].extractionStatus).toBe('failed');
  });

  it('never lets a broken compliance log write break the main flow (its own errors are swallowed)', async () => {
    const { manager } = makeMockManager({ doc: baseDoc({ documentType: ClientDocumentType.RISK_PROFILE }) });
    textExtractor.extractText.mockResolvedValue('text');
    summarizer.summarize.mockResolvedValue({ parsed: { summary: 'ok', keyFacts: [] }, error: null });
    complianceLog.create.mockRejectedValue(new Error('compliance_log insert failed'));

    await expect(runInFakeTenant(manager, () => service.ingest('doc-1', 'adviser-1'))).resolves.toBeDefined();
  });
});
