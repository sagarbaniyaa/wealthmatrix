import { PageHeader } from '@/components/ui/PageHeader';
import { EmailSyncClient } from '@/components/email-sync/EmailSyncClient';
import { serverApiGet } from '@/lib/server-api';
import type { EmailConnectionStatus } from '@/lib/types';

export default async function EmailSyncPage() {
  const status = await serverApiGet<EmailConnectionStatus>('email-connection');

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Settings" title="Email Sync" />
      <p className="text-sm text-ink-400">
        When a provider replies to an LOA send, the platform reads it automatically: the reference code in the
        original email matches the reply back to the right client, attachments go through Document Intake the same
        way an upload would, and the provider action status flips to RECEIVED — no manual download/upload needed.
      </p>
      <EmailSyncClient initialStatus={status} />
    </div>
  );
}
