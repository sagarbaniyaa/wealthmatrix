'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { ClientCallLog, CallStatus } from '@/lib/types';

const STATUS_TONE: Record<CallStatus, string> = {
  initiated: 'draft', ringing: 'running', 'in-progress': 'positive', completed: 'positive',
  failed: 'breach', 'no-answer': 'warning', busy: 'warning', canceled: 'draft',
};
const ACTIVE_STATUSES: CallStatus[] = ['initiated', 'ringing', 'in-progress'];

export function TelephonyClient({ householdId, initialCalls }: { householdId: string; initialCalls: ClientCallLog[] }) {
  const [calls, setCalls] = useState(initialCalls);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeCall = calls.find((c) => ACTIVE_STATUSES.includes(c.status));

  useEffect(() => {
    if (activeCall && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const refreshed = await api.get<ClientCallLog[]>(`households/${householdId}/telephony/calls`);
        setCalls(refreshed);
        if (!refreshed.some((c) => ACTIVE_STATUSES.includes(c.status)) && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 4000);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeCall, householdId]);

  async function call() {
    setCalling(true);
    setError(null);
    try {
      const saved = await api.post<ClientCallLog>(`households/${householdId}/telephony/call`);
      setCalls((prev) => [saved, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place this call.');
    } finally {
      setCalling(false);
    }
  }

  return (
    <Card>
      <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Call client</p>
      <p className="mb-3 text-xs text-ink-400">
        Rings your own phone first — once you answer, it bridges you to the client automatically. Have this page
        open (or the transcript running below) once you&apos;re connected.
      </p>
      <Button onClick={call} disabled={calling || !!activeCall} className="px-4 py-2 text-xs">
        {calling ? 'Calling…' : activeCall ? 'Call in progress…' : 'Call Client'}
      </Button>
      {error && <p className="mt-2 text-xs text-rust-400">{error}</p>}

      {calls.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-hairline pt-4">
          {calls.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs">
              <div>
                <span className="text-ink-100">{c.toNumber}</span>
                <span className="ml-2 text-ink-500">{formatDate(c.initiatedAt)}</span>
                {c.errorMessage && <p className="mt-0.5 text-rust-400">{c.errorMessage}</p>}
              </div>
              <div className="flex items-center gap-2">
                {c.durationSeconds !== null && <span className="text-ink-400">{Math.round(c.durationSeconds / 60)} min</span>}
                <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
