import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { ComplianceProviderActionEntity } from '../../database/entities';
import { ProviderActionStatus } from '../../common/enums/domain.enums';
import { ProviderService } from '../../modules/provider/provider.service';
import { ProviderPackService, BuiltPack } from './provider-pack.service';
import { ProviderMailerService } from './provider-mailer.service';

export interface SendResult {
  action: ComplianceProviderActionEntity;
  manifest: BuiltPack['manifest'];
  missingRequired: string[];
}

@Injectable()
export class ProviderSendService {
  constructor(
    private readonly providers: ProviderService,
    private readonly pack: ProviderPackService,
    private readonly mailer: ProviderMailerService,
  ) {}

  private get actionsRepo() {
    return TenantContext.getManager().getRepository(ComplianceProviderActionEntity);
  }

  async listActions(householdId?: string): Promise<ComplianceProviderActionEntity[]> {
    return this.actionsRepo.find({
      where: (householdId ? { householdId } : {}) as any,
      order: { createdAt: 'DESC' } as any,
    });
  }

  async findOneOrFail(actionId: string): Promise<ComplianceProviderActionEntity> {
    const action = await this.actionsRepo.findOne({ where: { id: actionId } as any });
    if (!action) throw new NotFoundException(`Provider action ${actionId} not found`);
    return action;
  }

  async updateStatus(actionId: string, status: ProviderActionStatus): Promise<ComplianceProviderActionEntity> {
    const action = await this.findOneOrFail(actionId);
    action.emailStatus = status;
    return this.actionsRepo.save(action);
  }

  /**
   * Generate the pack and return it without sending or logging anything —
   * "Auto-generate a full provider pack" (spec part 3) is a standalone
   * action distinct from "Send to Provider" (part 4/5).
   */
  async generate(params: { householdId: string; providerId: string; loaTemplateId?: string; adviserId: string }): Promise<BuiltPack> {
    return this.pack.buildPack(params);
  }

  /**
   * The one-click "Send to Provider" flow: build the pack, email it, and
   * log the outcome either way. Never silently pretends a send happened —
   * if SMTP isn't configured or the send fails, the logged status is
   * FAILED with the real error, not SENT.
   */
  async send(params: {
    householdId: string; providerId: string; loaTemplateId?: string; adviserId: string; overrideUnverifiedEmail?: boolean;
  }): Promise<SendResult> {
    const provider = await this.providers.findOneOrFail(params.providerId);
    if (!provider.emailVerified && !params.overrideUnverifiedEmail) {
      throw new BadRequestException(
        `${provider.providerName}'s contact email (${provider.providerEmail}) hasn't been verified yet — it's a placeholder guess, ` +
          'and this pack contains client PII (NI number, bank statements, ID). Confirm the real address in the provider directory first, ' +
          'or resend with overrideUnverifiedEmail if you have already checked it another way.',
      );
    }

    const built = await this.pack.buildPack(params);

    const documentsSent = built.manifest.filter((m) => m.included).map((m) => ({ documentType: m.documentType, fileName: m.fileName }));

    let emailStatus: ProviderActionStatus = ProviderActionStatus.PENDING;
    let emailError: string | null = null;
    let sentAt: Date | null = null;

    try {
      await this.mailer.send({
        to: provider.providerEmail,
        subject: `LOA + Client Pack – Household ${params.householdId} – WealthMatrix`,
        body: buildEmailBody(provider.providerName),
        attachments: [{ filename: 'provider_pack.zip', content: built.zip, contentType: 'application/zip' }],
      });
      emailStatus = ProviderActionStatus.SENT;
      sentAt = new Date();
    } catch (err) {
      emailStatus = ProviderActionStatus.FAILED;
      emailError = err instanceof Error ? err.message : 'Unknown email error';
    }

    const action = this.actionsRepo.create({
      firmId: TenantContext.getFirmId(),
      householdId: params.householdId,
      providerId: params.providerId,
      adviserId: params.adviserId,
      loaTemplateId: built.loaTemplateId,
      loaVersion: built.loaVersion,
      documentsSent,
      emailStatus,
      emailError,
      sentAt,
    });
    const saved = await this.actionsRepo.save(action);

    return { action: saved, manifest: built.manifest, missingRequired: built.missingRequired };
  }
}

function buildEmailBody(providerName: string): string {
  // Adviser name/FCA number aren't threaded through here as literally as
  // the spec's template — they're already on the adviser_details.pdf and
  // LOA inside the attached pack; keeping the email body itself generic
  // avoids duplicating (and risking staleness against) that same data.
  return [
    `Dear ${providerName},`,
    '',
    'Please find attached the LOA and full client information pack.',
    '',
    'Adviser and client details are included in the attached documents (adviser_details.pdf, fact_find.pdf, LOA).',
    '',
    'Kindly confirm receipt.',
    '',
    'Regards,',
    'WealthMatrix Enterprise',
  ].join('\n');
}
