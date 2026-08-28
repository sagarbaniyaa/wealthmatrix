'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatPct } from '@/lib/format';
import type { PagedFunds } from '@/lib/types';

interface FilterOptions { sectors: string[]; assetClasses: string[] }

const RISK_TONE: Record<number, string> = { 1: 'positive', 2: 'positive', 3: 'positive', 4: 'warning', 5: 'warning', 6: 'breach', 7: 'breach' };

// Saved screens round-trip through JSON (Record<string, unknown> on the
// wire), so initialFilters is typed loosely here and coerced field-by-field
// below rather than trusted as a well-formed ScreenFilters.
type LooseFilters = Record<string, unknown>;

/**
 * The core screen for browsing the fund universe — built to stay fast
 * whether there are 15 demo funds or the real ~3,700: every filter/sort/
 * page change is a fresh server-side query (FundService.findFiltered),
 * never a client-side filter over an already-loaded full table.
 */
export function FundsExplorer({
  initialData, filterOptions, mode = 'browse', onSelectFund, selectedFundIds, endpoint = 'funds', showSaveScreen = false, initialFilters,
}: {
  initialData: PagedFunds;
  filterOptions: FilterOptions;
  mode?: 'browse' | 'select';
  onSelectFund?: (fundId: string) => void;
  selectedFundIds?: string[];
  endpoint?: string; // 'funds' for the plain list, 'funds/screener' for the screener page — identical filtering, different service on the backend
  showSaveScreen?: boolean;
  initialFilters?: LooseFilters; // seeds state from a saved screen — pass a fresh `key` on the parent to force a remount when applying a different one
}) {
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
  const [search, setSearch] = useState(str(initialFilters?.search));
  const [sector, setSector] = useState(str(initialFilters?.sector));
  const [assetClass, setAssetClass] = useState(str(initialFilters?.assetClass));
  const [riskRatingMax, setRiskRatingMax] = useState(str(initialFilters?.riskRatingMax));
  const [ocfMax, setOcfMax] = useState(str(initialFilters?.ocfMax));
  const [yieldMin, setYieldMin] = useState(str(initialFilters?.yieldMin));
  const [volatilityMax, setVolatilityMax] = useState(str(initialFilters?.volatilityMax));
  const [sortBy, setSortBy] = useState(str(initialFilters?.sortBy, 'name'));
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>(initialFilters?.sortDir === 'DESC' ? 'DESC' : 'ASC');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedFunds>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (sector) params.set('sector', sector);
    if (assetClass) params.set('assetClass', assetClass);
    if (riskRatingMax) params.set('riskRatingMax', riskRatingMax);
    if (ocfMax) params.set('ocfMax', ocfMax);
    if (yieldMin) params.set('yieldMin', yieldMin);
    if (volatilityMax) params.set('volatilityMax', volatilityMax);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('page', String(page));
    params.set('pageSize', '25');

    const timer = setTimeout(() => {
      api.get<PagedFunds>(`${endpoint}?${params.toString()}`)
        .then((res) => { if (!cancelled) setData(res); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250); // debounce so typing in search doesn't fire a query per keystroke

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sector, assetClass, riskRatingMax, ocfMax, yieldMin, volatilityMax, sortBy, sortDir, page, endpoint]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const currentFilters = { search, sector, assetClass, riskRatingMax, ocfMax, yieldMin, volatilityMax, sortBy, sortDir };
  const [screenName, setScreenName] = useState('');
  const [savingScreen, setSavingScreen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function saveScreen() {
    if (!screenName.trim()) return;
    setSavingScreen(true);
    setSaveMessage(null);
    try {
      await api.post('funds/screener/save', { name: screenName, filters: currentFilters });
      setSaveMessage(`Saved "${screenName}".`);
      setScreenName('');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Could not save screen.');
    } finally {
      setSavingScreen(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          <TextField label="Search" value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name or ISIN" />
          <SelectField label="Sector" value={sector} onChange={(v) => { setSector(v); setPage(1); }} options={[{ value: '', label: 'All sectors' }, ...filterOptions.sectors.map((s) => ({ value: s, label: s }))]} />
          <SelectField label="Asset class" value={assetClass} onChange={(v) => { setAssetClass(v); setPage(1); }} options={[{ value: '', label: 'All classes' }, ...filterOptions.assetClasses.map((a) => ({ value: a, label: a.replace('_', ' ') }))]} />
          <TextField label="Max risk (1-7)" value={riskRatingMax} onChange={(v) => { setRiskRatingMax(v); setPage(1); }} type="number" placeholder="7" />
          <TextField label="Max OCF" value={ocfMax} onChange={(v) => { setOcfMax(v); setPage(1); }} type="number" placeholder="0.01" />
          <TextField label="Min yield %" value={yieldMin} onChange={(v) => { setYieldMin(v); setPage(1); }} type="number" placeholder="2" />
          <TextField label="Max volatility %" value={volatilityMax} onChange={(v) => { setVolatilityMax(v); setPage(1); }} type="number" placeholder="15" />
        </div>
      </Card>

      {showSaveScreen && (
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <TextField label="Screen name" value={screenName} onChange={setScreenName} placeholder="e.g. Low-cost defensive equity" />
            </div>
            <Button variant="primary" className="px-4 py-2 text-xs" onClick={saveScreen} disabled={savingScreen || !screenName.trim()}>
              {savingScreen ? 'Saving…' : 'Save screen'}
            </Button>
            {saveMessage && <span className="text-xs text-ink-400">{saveMessage}</span>}
          </div>
          <p className="mt-2 text-xs text-ink-500">Saves the filters currently set above so you can re-apply them later from Saved screens.</p>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between text-xs text-ink-400">
          <span>{data.total} fund{data.total === 1 ? '' : 's'} {loading && '· updating…'}</span>
          <div className="flex items-center gap-2">
            <span>Sort</span>
            <SelectField label="" value={sortBy} onChange={setSortBy} options={[
              { value: 'name', label: 'Name' }, { value: 'ocf', label: 'OCF' }, { value: 'yieldPct', label: 'Yield' },
              { value: 'riskRating', label: 'Risk' }, { value: 'volatilityPct', label: 'Volatility' }, { value: 'aum', label: 'AUM' },
            ]} compact />
            <button onClick={() => setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'))} className="rounded-sm border border-hairline px-2 py-1 text-ink-300 hover:text-ink-100">
              {sortDir === 'ASC' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wide text-ink-300">
              {mode === 'select' && <th className="pb-3"></th>}
              <th className="pb-3 font-medium">Fund</th>
              <th className="pb-3 font-medium">Sector</th>
              <th className="pb-3 text-right font-medium">OCF</th>
              <th className="pb-3 text-right font-medium">Yield</th>
              <th className="pb-3 text-right font-medium">Risk</th>
              <th className="pb-3 text-right font-medium">Volatility</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((f) => (
              <tr key={f.id} className="border-b border-hairline/50 last:border-0">
                {mode === 'select' && (
                  <td className="py-3">
                    <input
                      type="checkbox"
                      checked={selectedFundIds?.includes(f.id) ?? false}
                      onChange={() => onSelectFund?.(f.id)}
                    />
                  </td>
                )}
                <td className="py-3">
                  <Link href={`/advisor/research/funds/${f.id}`} className="text-ink-100 hover:text-brass-400">{f.name}</Link>
                  <p className="font-mono text-xs text-ink-500">{f.isin}</p>
                </td>
                <td className="py-3 text-ink-300">{f.sector}</td>
                <td className="py-3 text-right figure">{f.ocf !== null ? formatPct(Number(f.ocf) * 100, 2) : '—'}</td>
                <td className="py-3 text-right figure">{f.yieldPct !== null ? formatPct(Number(f.yieldPct)) : '—'}</td>
                <td className="py-3 text-right">
                  {f.riskRating !== null ? <Badge tone={RISK_TONE[f.riskRating] ?? 'info'}>{f.riskRating}</Badge> : '—'}
                </td>
                <td className="py-3 text-right figure">{f.volatilityPct !== null ? formatPct(Number(f.volatilityPct)) : '—'}</td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr><td colSpan={mode === 'select' ? 7 : 6} className="py-8 text-center text-ink-400">No funds match these filters.</td></tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between text-xs text-ink-400">
          <span>Page {data.page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Prev</Button>
            <Button variant="ghost" className="px-3 py-1 text-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next →</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>
      <input
        type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-hairline bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brass-500"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, compact = false }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; compact?: boolean;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs uppercase tracking-wide text-ink-300">{label}</span>}
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className={`rounded-sm border border-hairline bg-ink-800 text-ink-100 outline-none focus:border-brass-500 ${compact ? 'px-2 py-1 text-xs' : 'w-full px-3 py-2 text-sm'}`}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
