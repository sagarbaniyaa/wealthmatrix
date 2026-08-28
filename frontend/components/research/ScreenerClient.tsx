'use client';

import { useState } from 'react';
import { FundsExplorer } from '@/components/research/FundsExplorer';
import { SavedScreens } from '@/components/research/SavedScreens';
import type { PagedFunds, FundScreen } from '@/lib/types';

interface FilterOptions { sectors: string[]; assetClasses: string[] }

/**
 * Owns the "apply a saved screen" wiring: FundsExplorer has no concept of
 * saved screens, it just accepts initialFilters. Applying a screen bumps
 * `key`, which remounts FundsExplorer fresh with that screen's filters
 * (a plain prop change wouldn't reset the explorer's own filter state).
 */
export function ScreenerClient({
  initialData, filterOptions, initialScreens,
}: {
  initialData: PagedFunds;
  filterOptions: FilterOptions;
  initialScreens: FundScreen[];
}) {
  const [key, setKey] = useState(0);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>();

  function applyScreen(filters: Record<string, unknown>) {
    setAppliedFilters(filters);
    setKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <SavedScreens initialScreens={initialScreens} onApply={applyScreen} />
      <FundsExplorer
        key={key}
        initialData={initialData}
        filterOptions={filterOptions}
        endpoint="funds/screener"
        showSaveScreen
        initialFilters={appliedFilters}
      />
    </div>
  );
}
