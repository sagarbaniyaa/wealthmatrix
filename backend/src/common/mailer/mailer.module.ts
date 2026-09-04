import { Module } from '@nestjs/common';
import { ProviderMailerService } from '../../services/provider-hub/provider-mailer.service';

// Generic SMTP-send — despite the class living under services/provider-hub
// (that's where it was first built, for "Send to Provider"), the send
// logic itself has nothing provider-specific in it. Pulled into its own
// module so anything needing to send an email (ProviderHub, now
// AuthModule's password-reset flow) shares ONE instance/transporter
// instead of each declaring the provider directly and re-reading the
// same SMTP_* config separately.
@Module({
  providers: [ProviderMailerService],
  exports: [ProviderMailerService],
})
export class MailerModule {}
