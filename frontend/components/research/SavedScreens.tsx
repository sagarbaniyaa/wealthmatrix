'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { FundScreen } from '@/lib/types';

/**
 * Lists screens saved via FundsExplorer's "Save screen" panel. Applying one
 * hands its stored filters back up to the parent, which remounts
 * FundsExplorer (via a fresh `key`) seeded with those filters — the explorer
 * itself has no notion of "saved screens", it just takes initialFilters.
 */
export function SavedScreens({
  initialScreens, onApply,
}: {
  initialScreens: FundScreen[];
  onApply: (filters: Record<string, unknown>) => void;
}) {
  const [screens, setScreens] = useState(initialScreens);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteScreen(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`funds/screener/saved/${id}`);
      setScreens((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (screens.length === 0) {
    return (
      <Card>
        <p className="text-xs uppercase tracking-wide text-ink-300">Saved screens</p>
        <p className="mt-2 text-sm text-ink-400">No screens saved yet — set your filters below and use "Save screen".</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="mb-3 text-xs uppercase tracking-wide text-ink-300">Saved screens</p>
      <ul className="divide-y divide-hairline/50">
        {screens.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <p className="text-sm text-ink-100">{s.name}</p>
              <p className="text-xs text-ink-500">Saved {formatDate(s.createdAt)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => onApply(s.filters)}>Apply</Button>
              <Button variant="ghost" className="px-3 py-1 text-xs text-rust-400" onClick={() => deleteScreen(s.id)} disabled={deletingId === s.id}>
                {deletingId === s.id ? 'Removing…' : 'Delete'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
