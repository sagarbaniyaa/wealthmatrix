import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface OutgoingAttachment { filename: string; content: Buffer; contentType: string }

/**
 * Real SMTP send — same graceful-degradation shape as ClaudeClientService:
 * if SMTP isn't configured, callers get a clear ServiceUnavailableException
 * rather than a silent no-op or a fake "sent" result. Nothing in this repo
 * fabricates a successful send; ProviderSendService logs exactly what
 * happened (including failure) to compliance_provider_actions.
 */
@Injectable()
export class ProviderMailerService {
  private readonly logger = new Logger(ProviderMailerService.name);
  private readonly configured: boolean;
  private readonly from: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from = this.config.get<string>('SMTP_FROM', 'no-reply@wealthmatrix.local');
    this.configured = !!host;

    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
          : undefined,
      });
    }
  }

  async send(params: { to: string; subject: string; body: string; attachments: OutgoingAttachment[] }): Promise<{ messageId: string }> {
    if (!this.configured || !this.transporter) {
      throw new ServiceUnavailableException(
        'Email is not configured on this backend — set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM as needed) in .env and restart the server.',
      );
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: params.to,
        subject: params.subject,
        text: params.body,
        attachments: params.attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      return { messageId: info.messageId };
    } catch (err) {
      this.logger.error(`SMTP send failed: ${err}`);
      throw new ServiceUnavailableException(`Could not send email — ${err instanceof Error ? err.message : 'unknown SMTP error'}.`);
    }
  }
}
