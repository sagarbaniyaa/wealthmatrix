import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { TenantContext } from '../../common/database/tenant-context';
import { ComplianceSeverity } from '../../common/enums/domain.enums';
import { ClientCallLogEntity, AppUserEntity, PersonEntity, HouseholdMemberEntity } from '../../database/entities';
import { ComplianceLogService } from '../../modules/compliance-log/compliance-log.service';

/**
 * Real outbound PSTN calling via Twilio — the platform actually dials
 * out, unlike the transcription-only "Client Call" screen (which just
 * listens to whatever call the adviser already placed some other way).
 *
 * Deliberately the "click-to-call bridge" pattern, not a browser
 * softphone/WebRTC dialer: Twilio rings the ADVISER's own phone first
 * (a normal call, no app needed), and once they pick up, bridges them
 * to the client's number. This is the standard, well-documented Twilio
 * pattern and the only one verifiable from the server side without
 * needing a live browser session mid-call — a genuine constraint on
 * how confidently this could be tested during development.
 *
 * Never fabricates a successful call: if Twilio isn't configured, or
 * either party's number is missing, this throws a clear error rather
 * than silently doing nothing — same discipline as ProviderMailerService.
 */
@Injectable()
export class TelephonyService {
  private readonly logger = new Logger(TelephonyService.name);
  private readonly client: Twilio | null;
  private readonly fromNumber: string | undefined;
  private readonly statusCallbackBaseUrl: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly complianceLog: ComplianceLogService,
  ) {
    const accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.config.get<string>('TWILIO_PHONE_NUMBER');
    this.statusCallbackBaseUrl = this.config.get<string>('BACKEND_PUBLIC_URL');
    this.client = accountSid && authToken ? new Twilio(accountSid, authToken) : null;
  }

  get authToken(): string | undefined {
    return this.config.get<string>('TWILIO_AUTH_TOKEN');
  }

  private get repo() {
    return TenantContext.getManager().getRepository(ClientCallLogEntity);
  }

  async listForHousehold(householdId: string): Promise<ClientCallLogEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { initiatedAt: 'DESC' } as any });
  }

  async placeCall(householdId: string, adviserId: string): Promise<ClientCallLogEntity> {
    if (!this.client || !this.fromNumber) {
      throw new ServiceUnavailableException(
        'Telephony is not configured on this backend — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER ' +
          '(and BACKEND_PUBLIC_URL, so Twilio can reach this server for call-status updates) in .env and restart.',
      );
    }

    const manager = TenantContext.getManager();
    const adviser = await manager.getRepository(AppUserEntity).findOne({ where: { id: adviserId } as any });
    if (!adviser?.phone) {
      throw new BadRequestException('Your adviser profile has no phone number on file — the platform rings you first, then bridges the client in.');
    }

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    if (!primaryMember) throw new BadRequestException('This household has no members recorded.');
    const client = await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any });
    if (!client?.phone) {
      throw new BadRequestException(`${client ? `${client.firstName} ${client.lastName}` : 'This client'} has no phone number on file.`);
    }

    const row = this.repo.create({
      firmId: TenantContext.getFirmId(),
      householdId,
      adviserId,
      clientPersonId: client.id,
      toNumber: client.phone,
      fromNumber: this.fromNumber,
      adviserNumber: adviser.phone,
      status: 'initiated',
      initiatedBy: adviserId,
    });
    const saved = await this.repo.save(row);

    const twiml =
      `<Response><Say>Connecting you to ${escapeXml(`${client.firstName} ${client.lastName}`)} now.</Say>` +
      `<Dial callerId="${escapeXml(this.fromNumber)}">${escapeXml(client.phone)}</Dial></Response>`;

    try {
      const call = await this.client.calls.create({
        to: adviser.phone,
        from: this.fromNumber,
        twiml,
        ...(this.statusCallbackBaseUrl
          ? {
              // firmId is embedded here (not sensitive — Twilio calls this
              // server-to-server) because the webhook has no JWT/tenant
              // context of its own to resolve it from, and client_call_log
              // is RLS-protected — see TelephonyWebhookController.
              statusCallback: `${this.statusCallbackBaseUrl}/telephony/status-callback?callLogId=${saved.id}&firmId=${TenantContext.getFirmId()}`,
              statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
              statusCallbackMethod: 'POST' as const,
            }
          : {}),
      });
      saved.twilioCallSid = call.sid;
      saved.status = 'ringing';
    } catch (err: any) {
      saved.status = 'failed';
      saved.errorMessage = err?.message ?? 'Unknown Twilio error';
      saved.endedAt = new Date();
      this.logger.error(`Twilio call failed for household ${householdId}: ${saved.errorMessage}`);
    }

    const finalRow = await this.repo.save(saved);

    await this.complianceLog.create({
      householdId,
      entityId: null,
      severity: finalRow.status === 'failed' ? ComplianceSeverity.WARNING : ComplianceSeverity.INFO,
      ruleCode: 'CLIENT_CALL_PLACED',
      message: finalRow.status === 'failed'
        ? `Outbound call to ${finalRow.toNumber} failed: ${finalRow.errorMessage}`
        : `Outbound call placed to ${finalRow.toNumber} (adviser rung first at ${finalRow.adviserNumber}).`,
      detectedAt: new Date(),
      metadata: { callLogId: finalRow.id, twilioCallSid: finalRow.twilioCallSid },
    } as any).catch(() => undefined);

    return finalRow;
  }

  /** Called from the (Twilio-signature-verified, not JWT-guarded) webhook controller. */
  async applyStatusCallback(callLogId: string, status: string, callDuration: string | undefined): Promise<void> {
    const row = await this.repo.findOne({ where: { id: callLogId } as any });
    if (!row) return;
    row.status = status as any;
    if (callDuration) row.durationSeconds = parseInt(callDuration, 10);
    if (['completed', 'failed', 'no-answer', 'busy', 'canceled'].includes(status)) row.endedAt = new Date();
    await this.repo.save(row);
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
