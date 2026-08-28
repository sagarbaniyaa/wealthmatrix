'use client';

import { useMemo, useState } from 'react';
import type { OwnershipGraph } from '@/lib/types';
import { formatCurrency, formatPct } from '@/lib/format';

export interface EntityNavInfo {
  nav: number;
  attributedValue: number;
  effectiveOwnershipPct: number;
}

/**
 * Signature visual for the product: the ownership graph rendered as a
 * "ledger seal" diagram — nodes as double-ring seals (evoking the
 * formality of trust/entity documentation, the exact thing this product
 * exists to make legible), thin brass connecting lines labelled with
 * ownership %. Depth-layered layout (persons at depth 0, entities laid
 * out by longest path from any owner) computed client-side — no graph
 * library dependency for what is, at UHNI household scale, a small graph.
 *
 * Hover tooltip: entity nodes show NAV + effective ownership % (from the
 * household net-worth breakdown, passed in as `navByEntityId`); person
 * nodes show their role. Kept as a plain positioned HTML overlay rather
 * than native <title> so it matches the app's own styling.
 */
export function EntityStructureGraph({ graph, navByEntityId }: { graph: OwnershipGraph; navByEntityId?: Record<string, EntityNavInfo> }) {
  const layout = useMemo(() => computeLayout(graph), [graph]);
  const [hovered, setHovered] = useState<string | null>(null);

  if (graph.nodes.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-300">No structure recorded for this household yet.</p>;
  }

  const width = Math.max(720, layout.maxCol * 220 + 160);
  const height = layout.maxRow * 140 + 160;
  const hoveredNode = layout.nodes.find((n) => n.id === hovered) ?? null;
  const hoveredNav = hoveredNode ? navByEntityId?.[hoveredNode.id] : undefined;

  return (
    <div className="relative overflow-x-auto">
      <svg width={width} height={height} className="block">
        {layout.edges.map((e, i) => (
          <g key={i}>
            <line
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke="#B98B2E" strokeOpacity={0.4} strokeWidth={1.5}
            />
            <rect x={e.labelX - 20} y={e.labelY - 10} width={40} height={18} fill="#12141A" />
            <text x={e.labelX} y={e.labelY + 4} textAnchor="middle" className="fill-brass-400" fontSize={11} fontFamily="var(--font-plex-mono)">
              {e.pct}%
            </text>
          </g>
        ))}

        {layout.nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            className="ledger-seal cursor-pointer"
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered((cur) => (cur === n.id ? null : cur))}
          >
            <circle r={30} fill="#1A1D24" stroke={n.kind === 'person' ? '#5D9389' : '#B98B2E'} strokeWidth={hovered === n.id ? 3 : 2} />
            <circle r={24} fill="none" stroke={n.kind === 'person' ? '#5D9389' : '#B98B2E'} strokeWidth={0.75} strokeOpacity={0.6} />
            <text y={5} textAnchor="middle" fontSize={10} fill="#F5F3ED" fontFamily="var(--font-plex-sans)">
              {initials(n.label)}
            </text>
            <text y={48} textAnchor="middle" fontSize={12} fill="#D7D9DE" fontFamily="var(--font-plex-sans)">
              {truncate(n.label, 18)}
            </text>
            {n.entityType && (
              <text y={64} textAnchor="middle" fontSize={10} fill="#8A8F9C" fontFamily="var(--font-plex-mono)">
                {n.entityType.replace('_', ' ')}
              </text>
            )}
          </g>
        ))}
      </svg>

      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-sm border border-hairline bg-ink-800 p-3 shadow-lg"
          style={{ left: hoveredNode.x + 40, top: Math.max(hoveredNode.y - 50, 0) }}
        >
          <p className="text-sm font-medium text-ink-100">{hoveredNode.label}</p>
          {hoveredNode.kind === 'entity' ? (
            hoveredNav ? (
              <div className="mt-1.5 space-y-1 text-xs text-ink-300">
                <p>Entity NAV: <span className="figure text-ink-100">{formatCurrency(hoveredNav.nav)}</span></p>
                <p>Effective ownership: <span className="figure text-ink-100">{formatPct(hoveredNav.effectiveOwnershipPct)}</span></p>
                <p>Attributed to household: <span className="figure text-ink-100">{formatCurrency(hoveredNav.attributedValue)}</span></p>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-ink-500">No net-worth data for this entity.</p>
            )
          ) : (
            <p className="mt-1.5 text-xs text-ink-500">Household member — owns the entities linked below.</p>
          )}
        </div>
      )}
    </div>
  );
}

function initials(label: string) {
  return label.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

interface LaidOutNode { id: string; label: string; kind: 'person' | 'entity'; entityType?: string; x: number; y: number; }
interface LaidOutEdge { x1: number; y1: number; x2: number; y2: number; labelX: number; labelY: number; pct: string; }

function computeLayout(graph: OwnershipGraph) {
  const depth = new Map<string, number>();
  graph.nodes.filter((n) => n.kind === 'person').forEach((n) => depth.set(n.id, 0));

  // Iteratively relax depths along edges (small graphs, few passes needed; cycle-safe via pass cap).
  for (let pass = 0; pass < graph.nodes.length + 1; pass++) {
    let changed = false;
    for (const e of graph.edges) {
      const fromDepth = depth.get(e.from);
      if (fromDepth === undefined) continue;
      const candidate = fromDepth + 1;
      if ((depth.get(e.to) ?? -1) < candidate) {
        depth.set(e.to, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }
  graph.nodes.forEach((n) => { if (!depth.has(n.id)) depth.set(n.id, 0); });

  const byDepth = new Map<number, string[]>();
  graph.nodes.forEach((n) => {
    const d = depth.get(n.id)!;
    byDepth.set(d, [...(byDepth.get(d) ?? []), n.id]);
  });

  const colGap = 220, rowGap = 130, marginX = 100, marginY = 80;
  const positions = new Map<string, { x: number; y: number }>();
  let maxRow = 0;

  byDepth.forEach((ids, d) => {
    ids.forEach((id, i) => {
      positions.set(id, { x: marginX + d * colGap, y: marginY + i * rowGap });
      maxRow = Math.max(maxRow, i + 1);
    });
  });

  const nodes: LaidOutNode[] = graph.nodes.map((n) => ({
    ...n, x: positions.get(n.id)!.x, y: positions.get(n.id)!.y,
  }));

  const edges: LaidOutEdge[] = graph.edges
    .filter((e) => positions.has(e.from) && positions.has(e.to))
    .map((e) => {
      const p1 = positions.get(e.from)!, p2 = positions.get(e.to)!;
      return {
        x1: p1.x + 30, y1: p1.y, x2: p2.x - 30, y2: p2.y,
        labelX: (p1.x + p2.x) / 2, labelY: (p1.y + p2.y) / 2,
        pct: e.ownershipPct.toFixed(1),
      };
    });

  return { nodes, edges, maxCol: byDepth.size, maxRow };
}
