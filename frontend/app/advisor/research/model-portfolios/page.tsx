import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';

export default function ModelPortfoliosPage() {
  return (
    <div>
      <PageHeader eyebrow="Research" title="Model portfolios" />
      <Card>
        <p className="text-sm text-ink-300">Model portfolios aren't built yet.</p>
        <p className="mt-2 text-sm text-ink-400">
          This will let you assemble named, risk-graded portfolios from the fund universe (e.g. "Cautious Income",
          "Balanced Growth") and compare a household's current holdings against one directly — reusing the same
          comparison and suitability engines as the Compare and Fund suitability pages.
        </p>
      </Card>
    </div>
  );
}
