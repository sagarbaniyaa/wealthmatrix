'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

// Triggers the rule-based breach scan (leverage > 60%, concentration >
// 50%) across every household in the firm — pure maths, no AI call, so
// it's cheap enough to run on demand rather than waiting for a cron job.
export function ComplianceScanButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function runScan() {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post<{ scanned: number; created: number }>('ai/compliance-scan');
      setResult(
        res.created > 0
          ? `Scanned ${res.scanned} households — ${res.created} new finding${res.created === 1 ? '' : 's'} raised.`
          : `Scanned ${res.scanned} households — no new breaches.`,
      );
      router.refresh();
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && <p className="text-xs text-ink-400">{result}</p>}
      <Button variant="ghost" onClick={runScan} disabled={running}>
        {running ? 'Scanning…' : 'Run compliance scan'}
      </Button>
    </div>
  );
}
