import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { NetWorthBreakdown } from '@/components/netwealth/NetWorthBreakdown';
import { serverApiGet, serverApiPost } from '@/lib/server-api';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import type { Household, HouseholdNetWorth } from '@/lib/types';

interface GrossFigures { totalGrossAssets: number; totalGrossLiabilities: number }

// Client portal shows exactly one household — the one tied to this
// person's record, resolved server-side from the JWT's personId via
// GET /households/me (the client role can't call the adviser/admin-only
// list endpoint, so this dedicated lookup is what makes RLS scoping
// actually reachable for a client).
export default async function ClientDashboardPage() {
  const household = await serverApiGet<Household | null>('households/me');

  if (!household) {
    return (
      <div>
        <PageHeader eyebrow="Welcome" title="Your portfolio" />
        <p className="text-sm text-ink-300">No household is linked to your account yet — contact your adviser.</p>
      </div>
    );
  }

  const [netWorth, gross] = await Promise.all([
    serverApiGet<HouseholdNetWorth>(`households/${household.id}/net-worth`),
    serverApiPost<GrossFigures>(`ai/risk-metrics/${household.id}`).catch(() => null),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={household.name} title="Your dashboard" />

      {/* NetWorthBreakdown below already shows net worth (total/personal/attributed) —
          these two tiles add the gross assets/liabilities view without repeating it. */}
      <div className="grid grid-cols-2 gap-6">
        <Card><StatTile label="Total assets" value={gross ? formatCurrency(gross.totalGrossAssets) : '—'} tone="positive" /></Card>
        <Card><StatTile label="Total liabilities" value={gross ? formatCurrency(gross.totalGrossLiabilities) : '—'} tone={gross && gross.totalGrossLiabilities > 0 ? 'negative' : 'neutral'} /></Card>
      </div>

      <NetWorthBreakdown data={netWorth} />

      <div className="text-right">
        <Link href="/client/assets" className="text-xs text-brass-400 hover:text-brass-300">Full assets &amp; liabilities →</Link>
      </div>
    </div>
  );
}
