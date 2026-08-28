import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { serverApiGet } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import type { ClientNote } from '@/lib/types';

// Read-only — the backend scopes this to the caller's own household
// regardless of any query param a client role might pass (see
// ClientNoteController.findAll). No create/delete for clients.
export default async function ClientNotesPage() {
  const notes = await serverApiGet<ClientNote[]>('client-notes');

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Notes & activity" title="Updates from your adviser" />
      <Card>
        <div className="space-y-4">
          {notes.length === 0 && <p className="text-sm text-ink-300">No updates yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="border-b border-hairline/50 pb-4 last:border-0">
              <p className="text-sm text-ink-100">{n.note}</p>
              <p className="mt-1 text-xs text-ink-500">{formatDate(n.createdAt)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
