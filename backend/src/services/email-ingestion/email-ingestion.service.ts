import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { TenantContext } from '../../common/database/tenant-context';
import { runInTenantContext } from '../../common/database/run-in-tenant-context';
import { CredentialCipherService } from '../../common/security/credential-cipher.service';
import { Role } from '../../common/enums/role.enum';
import { ClientDocumentType, ComplianceSeverity, ProviderActionStatus } from '../../common/enums/domain.enums';
import { AdviserEmailConnectionEntity, ComplianceProviderActionEntity, FirmEntity } from '../../database/entities';
import { ClientDocumentService } from '../../modules/client-document/client-document.service';
import { DocumentIntakeService } from '../document-intake/document-intake.service';
import { ComplianceLogService } from '../../modules/compliance-log/compliance-log.service';

export interface EmailConnectionStatusView {
  connected: boolean;
  imapHost: string | null;
  username: string | null;
  status: string | null;
  lastError: string | null;
  lastPolledAt: Date | null;
}

export interface PollResult {
  messagesScanned: number;
  matched: { actionId: string; householdId: string; documentsAdded: number }[];
  unmatched: number;
  error: string | null;
}

// Matches "Ref: a1b2c3d4" (or "ref a1b2c3d4", case-insensitive) anywhere
// in the subject or body — the 8-hex-char prefix of the
// compliance_provider_actions row's own id, put there by
// ProviderSendService when the pack was originally sent.
const REFERENCE_PATTERN = /ref(?:erence)?[:\s]+([a-f0-9]{8})/i;

/**
 * Reads provider replies from an adviser's own mailbox via IMAP + an
 * app-specific password — not full OAuth (Gmail API / Microsoft Graph),
 * which would require registering a developer app in Google Cloud
 * Console or Azure first. An app password connects immediately with no
 * developer registration step, at the cost of periodic polling instead
 * of instant push notifications — an acceptable trade for something
 * providers reply to on their own schedule anyway (see migration 013).
 *
 * Reply -> case matching is done via the reference code embedded in the
 * original outbound subject/body (see ProviderSendService), not by
 * trusting the provider to preserve email threading headers.
 *
 * Every attachment found on a matched reply goes through the exact same
 * Document Intake pipeline as a manually uploaded document (migration
 * 010) — this is deliberately NOT a separate/duplicate extraction path.
 * A matched reply flips the compliance_provider_actions row to RECEIVED
 * and writes a compliance_log entry either way (matched or not).
 */
@Injectable()
export class EmailIngestionService {
  private readonly logger = new Logger(EmailIngestionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly cipher: CredentialCipherService,
    private readonly clientDocuments: ClientDocumentService,
    private readonly documentIntake: DocumentIntakeService,
    private readonly complianceLog: ComplianceLogService,
  ) {}

  private get repo() {
    return TenantContext.getManager().getRepository(AdviserEmailConnectionEntity);
  }

  async connect(adviserId: string, params: { imapHost: string; imapPort: number; imapSecure: boolean; username: string; password: string }): Promise<EmailConnectionStatusView> {
    await this.testLogin(params);

    const existing = await this.repo.findOne({ where: { adviserId } as any });
    const encryptedPassword = this.cipher.encrypt(params.password);
    const fields = {
      imapHost: params.imapHost, imapPort: params.imapPort, imapSecure: params.imapSecure,
      username: params.username, encryptedPassword, status: 'connected' as const, lastError: null,
    };

    const saved = existing
      ? await this.repo.save(Object.assign(existing, fields))
      : await this.repo.save(this.repo.create({ firmId: TenantContext.getFirmId(), adviserId, ...fields }));

    return this.toStatusView(saved);
  }

  async getStatus(adviserId: string): Promise<EmailConnectionStatusView> {
    const row = await this.repo.findOne({ where: { adviserId } as any });
    if (!row) return { connected: false, imapHost: null, username: null, status: null, lastError: null, lastPolledAt: null };
    return this.toStatusView(row);
  }

  async disconnect(adviserId: string): Promise<void> {
    const row = await this.repo.findOne({ where: { adviserId } as any });
    if (row) await this.repo.remove(row);
  }

  async pollNow(adviserId: string): Promise<PollResult> {
    const row = await this.repo.createQueryBuilder('c').addSelect('c.encryptedPassword').where('c.adviser_id = :adviserId', { adviserId }).getOne();
    if (!row) throw new NotFoundException('No email connection configured for this adviser.');
    return this.pollConnection(row);
  }

  /** Every 10 minutes, poll every connected adviser mailbox across every firm — see runInTenantContext for why this can't just use TenantContext directly (there's no HTTP request behind a cron tick). */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollAll(): Promise<void> {
    const firms = await this.dataSource.getRepository(FirmEntity).find();
    for (const firm of firms) {
      try {
        await runInTenantContext(this.dataSource, { firmId: firm.id, userId: 'system-email-poller', role: Role.ADMIN }, async () => {
          const connections = await TenantContext.getManager()
            .getRepository(AdviserEmailConnectionEntity)
            .createQueryBuilder('c').addSelect('c.encryptedPassword').getMany();
          for (const connection of connections) {
            await this.pollConnection(connection).catch((err) => {
              this.logger.warn(`Poll failed for adviser ${connection.adviserId}: ${err?.message ?? err}`);
            });
          }
        });
      } catch (err) {
        this.logger.warn(`Poll failed for firm ${firm.id}: ${(err as Error).message}`);
      }
    }
  }

  private toStatusView(row: AdviserEmailConnectionEntity): EmailConnectionStatusView {
    return {
      connected: row.status === 'connected', imapHost: row.imapHost, username: row.username,
      status: row.status, lastError: row.lastError, lastPolledAt: row.lastPolledAt,
    };
  }

  private async testLogin(params: { imapHost: string; imapPort: number; imapSecure: boolean; username: string; password: string }): Promise<void> {
    const client = new ImapFlow({
      host: params.imapHost, port: params.imapPort, secure: params.imapSecure,
      auth: { user: params.username, pass: params.password }, logger: false,
    });
    try {
      await client.connect();
    } catch (err) {
      throw new ConflictException(`Could not connect to ${params.imapHost}: ${err instanceof Error ? err.message : 'unknown IMAP error'}`);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  private async pollConnection(row: AdviserEmailConnectionEntity): Promise<PollResult> {
    const manager = TenantContext.getManager();
    const connRepo = manager.getRepository(AdviserEmailConnectionEntity);
    const result: PollResult = { messagesScanned: 0, matched: [], unmatched: 0, error: null };

    let password: string;
    try {
      password = this.cipher.decrypt(row.encryptedPassword);
    } catch {
      row.status = 'error';
      row.lastError = 'Could not decrypt the stored password — reconnect this mailbox.';
      await connRepo.save(row);
      result.error = row.lastError;
      return result;
    }

    const client = new ImapFlow({
      host: row.imapHost, port: row.imapPort, secure: row.imapSecure,
      auth: { user: row.username, pass: password }, logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Unread messages since the last poll (or the last 3 days for a
        // brand-new connection) — a provider's reply, not the adviser's
        // entire mailbox history.
        const since = row.lastPolledAt ?? new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const uids = await client.search({ seen: false, since }, { uid: true });
        for (const uid of uids || []) {
          result.messagesScanned += 1;
          const matched = await this.processMessage(client, uid).catch((err) => {
            this.logger.warn(`Could not process message uid ${uid}: ${err?.message ?? err}`);
            return null;
          });
          if (matched) result.matched.push(matched);
          else result.unmatched += 1;
        }
      } finally {
        lock.release();
      }
      row.status = 'connected';
      row.lastError = null;
    } catch (err) {
      row.status = 'error';
      row.lastError = err instanceof Error ? err.message : 'Unknown IMAP error';
      result.error = row.lastError;
    } finally {
      await client.logout().catch(() => undefined);
      row.lastPolledAt = new Date();
      await connRepo.save(row);
    }

    return result;
  }

  private async processMessage(client: ImapFlow, uid: number): Promise<{ actionId: string; householdId: string; documentsAdded: number } | null> {
    const manager = TenantContext.getManager();
    const download = await client.download(String(uid), undefined, { uid: true });
    const chunks: Buffer[] = [];
    for await (const chunk of download.content) chunks.push(chunk as Buffer);
    const parsed = await simpleParser(Buffer.concat(chunks));

    const haystack = `${parsed.subject ?? ''} ${parsed.text ?? ''}`;
    const refMatch = haystack.match(REFERENCE_PATTERN);
    if (!refMatch) return null;

    const referenceCode = refMatch[1].toLowerCase();
    const candidates = await manager.getRepository(ComplianceProviderActionEntity).find({ where: { emailStatus: ProviderActionStatus.SENT } as any });
    const action = candidates.find((a) => a.id.startsWith(referenceCode));
    if (!action) return null;

    let documentsAdded = 0;
    for (const attachment of parsed.attachments ?? []) {
      if (!attachment.content || attachment.size === 0) continue;
      const saved = await this.clientDocuments.saveUploaded({
        householdId: action.householdId,
        documentType: ClientDocumentType.PROVIDER_STATEMENT,
        fileName: attachment.filename || `provider-reply-${uid}`,
        mimeType: attachment.contentType || 'application/octet-stream',
        fileData: attachment.content,
        uploadedBy: action.adviserId,
      });
      await this.documentIntake.ingest(saved.id, action.adviserId).catch((err) => {
        this.logger.warn(`Document Intake failed on provider reply attachment: ${err?.message ?? err}`);
      });
      documentsAdded += 1;
    }

    action.emailStatus = ProviderActionStatus.RECEIVED;
    await manager.getRepository(ComplianceProviderActionEntity).save(action);

    await this.complianceLog.create({
      householdId: action.householdId,
      entityId: null,
      severity: ComplianceSeverity.INFO,
      ruleCode: 'PROVIDER_REPLY_RECEIVED',
      message: `Provider reply received (ref ${referenceCode}) — ${documentsAdded} attachment(s) processed via Document Intake.`,
      detectedAt: new Date(),
      metadata: { actionId: action.id, householdId: action.householdId, subject: parsed.subject ?? null },
    } as any);

    return { actionId: action.id, householdId: action.householdId, documentsAdded };
  }
}
