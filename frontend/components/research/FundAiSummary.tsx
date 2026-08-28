'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function FundAiSummary({ fundId }: { fundId: string }) {
  const [data, setData] = useState<{ summary: string | null; error: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.post<{ summary: string | null; error: string | null }>(`ai/fund-summary/${fundId}`)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData({ summary: null, error: 'Could not reach the AI summary service.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fundId]);

  if (loading) return <p className="text-sm text-ink-300">Generating summary…</p>;
  if (data?.summary) return <p className="text-sm leading-relaxed text-ink-300">{data.summary}</p>;
  return <p className="text-xs text-ink-500">AI summary unavailable — {data?.error ?? 'unknown error.'}</p>;
}
