import { NotFoundException } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { tenantALS } from '../../common/database/tenant-context';
import { Role } from '../../common/enums/role.enum';
import { ComplianceSeverity, ProviderActionStatus } from '../../common/enums/domain.enums';
import { AdviserEmailConnectionEntity, ComplianceProviderActionEntity, FirmEntity } from '../../database/entities';
import { EmailIngestionService } from './email-ingestion.service';

jest.mock('imapflow', () => ({ ImapFlow: jest.fn() }));
jest.mock('mailparser', () => ({ simpleParser: jest.fn() }));

/**
 * Unit tests for the Email Sync pipeline — real IMAP/network calls
 * mocked out entirely (ImapFlow, mailparser), TenantContext run over a
 * fake EntityManager the same way as DocumentIntakeService's tests.
 * Covers what was previously only verified by hand: reply-to-case
 * matching via the embedded reference code, per-attachment Document
 * Intake handoff, and the resilience behaviour (one bad mailbox/firm
 * never stops the rest of the poll).
 */

function fakeMailboxLock() {
  return { release: jest.fn() };
}

function asyncIterableFromBuffers(buffers: Buffer[]) {
  return { async *[Symbol.asyncIterator]() { for (const b of buffers) yield b; } };
}

function makeMockManager(opts: { connections?: Partial<AdviserEmailConnectionEntity>[]; actions?: Partial<ComplianceProviderActionEntity>[] } = {}) {
  const savedActions: any[] = [];
  const actionRepo = {
    find: jest.fn().mockResolvedValue(opts.actions ?? []),
    save: jest.fn((a: any) => { savedActions.push({ ...a }); return Promise.resolve(a); }),
  };
  const connRepo = {
    createQueryBuilder: jest.fn(() => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(opts.connections ?? []),
    })),
  };
  const manager = {
    getRepository: jest.fn((entity: any) => {
      if (entity === ComplianceProviderActionEntity) return actionRepo;
      if (entity === AdviserEmailConnectionEntity) return connRepo;
      throw new Error(`Unexpected repository requested: ${entity}`);
    }),
  };
  return { manager, actionRepo, connRepo, savedActions };
}

function runInFakeTenant<T>(manager: any, fn: () => Promise<T>): Promise<T> {
  return tenantALS.run({ firmId: 'firm-1', userId: 'system', role: Role.ADMIN, manager }, fn);
}

describe('EmailIngestionService', () => {
  let cipher: { encrypt: jest.Mock; decrypt: jest.Mock };
  let clientDocuments: { saveUploaded: jest.Mock };
  let documentIntake: { ingest: jest.Mock };
  let complianceLog: { create: jest.Mock };
  let dataSource: any;
  let service: EmailIngestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    cipher = { encrypt: jest.fn((p: string) => `enc(${p})`), decrypt: jest.fn((p: string) => p.replace(/^enc\(|\)$/g, '')) };
    clientDocuments = { saveUploaded: jest.fn().mockResolvedValue({ id: 'doc-1' }) };
    documentIntake = { ingest: jest.fn().mockResolvedValue({ id: 'doc-1', extractionStatus: 'done' }) };
    complianceLog = { create: jest.fn().mockResolvedValue({ id: 'log-1' }) };
    dataSource = { getRepository: jest.fn(), createQueryRunner: jest.fn() };
    service = new EmailIngestionService(dataSource, cipher as any, clientDocuments as any, documentIntake as any, complianceLog as any);
  });

  describe('connect', () => {
    it('creates a new connection row and encrypts the password before storing it', async () => {
      const { manager, connRepo } = makeMockManager();
      (connRepo as any).findOne = jest.fn().mockResolvedValue(null);
      (connRepo as any).create = jest.fn((f: any) => f);
      (connRepo as any).save = jest.fn((f: any) => Promise.resolve({ id: 'conn-1', ...f }));
      (ImapFlow as unknown as jest.Mock).mockImplementation(() => ({ connect: jest.fn().mockResolvedValue(undefined), logout: jest.fn().mockResolvedValue(undefined) }));

      const result = await runInFakeTenant(manager, () =>
        service.connect('adviser-1', { imapHost: 'imap.gmail.com', imapPort: 993, imapSecure: true, username: 'a@b.com', password: 'secret123' }),
      );

      expect(cipher.encrypt).toHaveBeenCalledWith('secret123');
      expect((connRepo as any).save).toHaveBeenCalledWith(expect.objectContaining({ encryptedPassword: 'enc(secret123)', status: 'connected' }));
      expect(result.connected).toBe(true);
    });

    it('throws a friendly ConflictException (not a raw IMAP error) when the test login fails', async () => {
      const { manager } = makeMockManager();
      (ImapFlow as unknown as jest.Mock).mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
        logout: jest.fn().mockResolvedValue(undefined),
      }));

      await expect(
        runInFakeTenant(manager, () =>
          service.connect('adviser-1', { imapHost: 'imap.gmail.com', imapPort: 993, imapSecure: true, username: 'a@b.com', password: 'wrong' }),
        ),
      ).rejects.toThrow('Could not connect to imap.gmail.com: Invalid credentials');
    });
  });

  describe('getStatus / disconnect', () => {
    it('reports not connected when no row exists', async () => {
      const { manager, connRepo } = makeMockManager();
      (connRepo as any).findOne = jest.fn().mockResolvedValue(null);

      const result = await runInFakeTenant(manager, () => service.getStatus('adviser-1'));
      expect(result).toEqual({ connected: false, imapHost: null, username: null, status: null, lastError: null, lastPolledAt: null });
    });

    it('is a no-op (not an error) disconnecting when there is nothing to disconnect', async () => {
      const { manager, connRepo } = makeMockManager();
      (connRepo as any).findOne = jest.fn().mockResolvedValue(null);
      (connRepo as any).remove = jest.fn();

      await runInFakeTenant(manager, () => service.disconnect('adviser-1'));
      expect((connRepo as any).remove).not.toHaveBeenCalled();
    });
  });

  describe('pollNow', () => {
    it('throws NotFoundException when the adviser has no email connection configured', async () => {
      const { manager, connRepo } = makeMockManager();
      connRepo.createQueryBuilder = jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null),
      }));

      await expect(runInFakeTenant(manager, () => service.pollNow('adviser-1'))).rejects.toThrow(NotFoundException);
    });
  });

  describe('pollConnection (via pollNow)', () => {
    function connectionRow(overrides: Partial<AdviserEmailConnectionEntity> = {}): AdviserEmailConnectionEntity {
      return {
        id: 'conn-1', firmId: 'firm-1', adviserId: 'adviser-1', imapHost: 'imap.gmail.com', imapPort: 993, imapSecure: true,
        username: 'a@b.com', encryptedPassword: 'enc(secret)', status: 'connected', lastError: null, lastPolledAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      } as AdviserEmailConnectionEntity;
    }

    function setupConnRepoForPollNow(connRepo: any, row: AdviserEmailConnectionEntity, saveSpy = jest.fn()) {
      connRepo.createQueryBuilder = jest.fn(() => ({
        addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(row),
      }));
      connRepo.save = saveSpy.mockImplementation((r: any) => Promise.resolve(r));
      return connRepo;
    }

    it('marks the connection "error" without throwing when the stored password cannot be decrypted', async () => {
      const fixture = makeMockManager();
      cipher.decrypt.mockImplementation(() => { throw new Error('bad auth tag'); });
      const saveSpy = jest.fn();
      setupConnRepoForPollNow(fixture.connRepo, connectionRow(), saveSpy);

      const result = await runInFakeTenant(fixture.manager, () => service.pollNow('adviser-1'));

      expect(result.error).toBe('Could not decrypt the stored password — reconnect this mailbox.');
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
      expect(ImapFlow).not.toHaveBeenCalled(); // never even attempts to connect with an undecryptable password
    });

    it('scans unread messages, matches one via its reference code, and leaves an unmatched one uncounted as a match', async () => {
      const fixture = makeMockManager({
        actions: [{ id: 'a1b2c3d4-1111-2222-3333-444455556666', householdId: 'household-1', adviserId: 'adviser-1', emailStatus: ProviderActionStatus.SENT }],
      });
      setupConnRepoForPollNow(fixture.connRepo, connectionRow());

      const fakeClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        getMailboxLock: jest.fn().mockResolvedValue(fakeMailboxLock()),
        search: jest.fn().mockResolvedValue([1, 2]),
        download: jest.fn().mockResolvedValue({ content: asyncIterableFromBuffers([Buffer.from('raw email')]) }),
        logout: jest.fn().mockResolvedValue(undefined),
      };
      (ImapFlow as unknown as jest.Mock).mockImplementation(() => fakeClient);

      (simpleParser as unknown as jest.Mock)
        .mockResolvedValueOnce({ subject: 'RE: Your LOA — Ref: a1b2c3d4', text: '', attachments: [{ filename: 'statement.pdf', contentType: 'application/pdf', content: Buffer.from('pdf'), size: 10 }] })
        .mockResolvedValueOnce({ subject: 'Out of office', text: 'no reference here', attachments: [] });

      const result = await runInFakeTenant(fixture.manager, () => service.pollNow('adviser-1'));

      expect(result.messagesScanned).toBe(2);
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0]).toEqual({ actionId: 'a1b2c3d4-1111-2222-3333-444455556666', householdId: 'household-1', documentsAdded: 1 });
      expect(result.unmatched).toBe(1);

      expect(clientDocuments.saveUploaded).toHaveBeenCalledWith(expect.objectContaining({
        householdId: 'household-1', fileName: 'statement.pdf', uploadedBy: 'adviser-1',
      }));
      expect(documentIntake.ingest).toHaveBeenCalledWith('doc-1', 'adviser-1');
      expect(fixture.actionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ emailStatus: ProviderActionStatus.RECEIVED }));
      expect(complianceLog.create).toHaveBeenCalledWith(expect.objectContaining({ severity: ComplianceSeverity.INFO, ruleCode: 'PROVIDER_REPLY_RECEIVED' }));
    });

    it('is case-insensitive and accepts "reference" as well as "ref" in the subject/body', async () => {
      const fixture = makeMockManager({
        actions: [{ id: 'deadbeef-1111-2222-3333-444455556666', householdId: 'household-2', adviserId: 'adviser-1', emailStatus: ProviderActionStatus.SENT }],
      });
      setupConnRepoForPollNow(fixture.connRepo, connectionRow());
      const fakeClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        getMailboxLock: jest.fn().mockResolvedValue(fakeMailboxLock()),
        search: jest.fn().mockResolvedValue([1]),
        download: jest.fn().mockResolvedValue({ content: asyncIterableFromBuffers([Buffer.from('x')]) }),
        logout: jest.fn().mockResolvedValue(undefined),
      };
      (ImapFlow as unknown as jest.Mock).mockImplementation(() => fakeClient);
      (simpleParser as unknown as jest.Mock).mockResolvedValueOnce({ subject: 'Documents attached', text: 'REFERENCE DEADBEEF as discussed', attachments: [] });

      const result = await runInFakeTenant(fixture.manager, () => service.pollNow('adviser-1'));
      expect(result.matched[0].actionId).toBe('deadbeef-1111-2222-3333-444455556666');
    });

    it('never fails the whole poll when Document Intake throws on one attachment', async () => {
      const fixture = makeMockManager({
        actions: [{ id: 'a1b2c3d4-1111-2222-3333-444455556666', householdId: 'household-1', adviserId: 'adviser-1', emailStatus: ProviderActionStatus.SENT }],
      });
      setupConnRepoForPollNow(fixture.connRepo, connectionRow());
      documentIntake.ingest.mockRejectedValue(new Error('OCR crashed'));
      const fakeClient = {
        connect: jest.fn().mockResolvedValue(undefined),
        getMailboxLock: jest.fn().mockResolvedValue(fakeMailboxLock()),
        search: jest.fn().mockResolvedValue([1]),
        download: jest.fn().mockResolvedValue({ content: asyncIterableFromBuffers([Buffer.from('x')]) }),
        logout: jest.fn().mockResolvedValue(undefined),
      };
      (ImapFlow as unknown as jest.Mock).mockImplementation(() => fakeClient);
      (simpleParser as unknown as jest.Mock).mockResolvedValueOnce({
        subject: 'Ref: a1b2c3d4', text: '', attachments: [{ filename: 'x.pdf', contentType: 'application/pdf', content: Buffer.from('x'), size: 5 }],
      });

      const result = await runInFakeTenant(fixture.manager, () => service.pollNow('adviser-1'));

      // The reply is still recorded as matched/received even though intake on its attachment failed.
      expect(result.matched).toHaveLength(1);
      expect(fixture.actionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ emailStatus: ProviderActionStatus.RECEIVED }));
    });

    it('marks the connection "error" (not thrown) when the IMAP connection itself fails mid-poll', async () => {
      const fixture = makeMockManager();
      const saveSpy = jest.fn();
      setupConnRepoForPollNow(fixture.connRepo, connectionRow(), saveSpy);
      (ImapFlow as unknown as jest.Mock).mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
        logout: jest.fn().mockResolvedValue(undefined),
      }));

      const result = await runInFakeTenant(fixture.manager, () => service.pollNow('adviser-1'));

      expect(result.error).toBe('ETIMEDOUT');
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', lastError: 'ETIMEDOUT' }));
    });
  });

  describe('pollAll (the scheduled cron)', () => {
    it('polls every firm independently — one firm erroring never stops the rest', async () => {
      (dataSource.getRepository as jest.Mock).mockReturnValue({ find: jest.fn().mockResolvedValue([{ id: 'firm-broken' }, { id: 'firm-ok' }] as FirmEntity[]) });

      // The connection is acquired but starting the transaction fails —
      // exactly the case runInTenantContext previously leaked (connect()/
      // startTransaction() sat outside the try/finally, so release()
      // never ran when either one threw).
      const brokenQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockRejectedValue(new Error('could not start transaction')),
        query: jest.fn(), commitTransaction: jest.fn(), rollbackTransaction: jest.fn(),
        release: jest.fn().mockResolvedValue(undefined), manager: {},
      };
      const { manager: okManager } = makeMockManager({ connections: [] });
      const okQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined), startTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue(undefined), commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined), release: jest.fn().mockResolvedValue(undefined),
        manager: okManager,
      };
      (dataSource.createQueryRunner as jest.Mock)
        .mockReturnValueOnce(brokenQueryRunner)
        .mockReturnValueOnce(okQueryRunner);

      await expect(service.pollAll()).resolves.toBeUndefined();

      // The broken firm's connection is still released back to the pool
      // even though it never got as far as a transaction.
      expect(brokenQueryRunner.release).toHaveBeenCalled();
      expect(brokenQueryRunner.rollbackTransaction).not.toHaveBeenCalled(); // nothing to roll back — no transaction ever started
      // The second firm is completely unaffected by the first one's failure.
      expect(okQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(okQueryRunner.release).toHaveBeenCalled();
    });
  });
});
