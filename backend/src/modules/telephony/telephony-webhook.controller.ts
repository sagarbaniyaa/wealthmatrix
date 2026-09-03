import { Body, Controller, ForbiddenException, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { validateRequest } from 'twilio';
import { DataSource } from 'typeorm';
import { runInTenantContext } from '../../common/database/run-in-tenant-context';
import { Role } from '../../common/enums/role.enum';
import { TelephonyService } from '../../services/telephony/telephony.service';

/**
 * Twilio calls this directly (no JWT — Twilio doesn't have one), so
 * authenticity is verified via Twilio's own request-signature scheme
 * instead: HMAC-SHA1 of the exact public URL + sorted POST params,
 * keyed by TWILIO_AUTH_TOKEN. An unsigned or wrongly-signed request is
 * rejected outright — this endpoint updates a household's call record,
 * so it cannot be left open to anyone who finds the URL.
 *
 * firmId travels in the query string (see TelephonyService.placeCall)
 * because client_call_log is RLS-protected and this request has no
 * other way to establish which tenant it belongs to before reading it.
 */
@Controller('telephony')
export class TelephonyWebhookController {
  constructor(
    private readonly telephony: TelephonyService,
    private readonly dataSource: DataSource,
  ) {}

  @Post('status-callback')
  @HttpCode(204)
  async statusCallback(
    @Req() req: Request,
    @Query('callLogId') callLogId: string,
    @Query('firmId') firmId: string,
    @Headers('x-twilio-signature') signature: string,
    @Body() body: Record<string, string>,
  ): Promise<void> {
    const authToken = this.telephony.authToken;
    if (!authToken) throw new ForbiddenException('Telephony not configured.');

    const publicUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = validateRequest(authToken, signature ?? '', publicUrl, body ?? {});
    if (!valid) throw new ForbiddenException('Invalid Twilio signature.');

    if (!callLogId || !firmId) return;

    await runInTenantContext(this.dataSource, { firmId, userId: 'system-telephony-webhook', role: Role.ADMIN }, async () => {
      await this.telephony.applyStatusCallback(callLogId, body.CallStatus, body.CallDuration);
    });
  }
}
