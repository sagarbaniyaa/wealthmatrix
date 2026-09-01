import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  HouseholdMemberEntity, AccountEntity, HoldingEntity, AssetEntity, FundEntity, FundHoldingEntity, FundAllocationEntity,
} from '../../database/entities';

export interface LookThroughExposure {
  name: string;
  value: number;
  pct: number;
}

export interface LookThroughHoldingDetail {
  assetName: string;
  value: number;
  matchedFundId: string | null;
  matchedFundName: string | null;
  lookedThrough: boolean;
}

export interface PortfolioLookThroughResult {
  totalValue: number;
  lookedThroughValue: number;   // portion of totalValue backed by a matched fund's own holdings/allocation data
  lookedThroughPct: number;
  topExposures: LookThroughExposure[];      // underlying companies/direct single-stock holdings, combined
  assetClassBreakdown: LookThroughExposure[];
  holdings: LookThroughHoldingDetail[];
}

/**
 * True cross-portfolio look-through: a client's actual exposure to a
 * given company or asset class, aggregated THROUGH every fund they hold,
 * not just "which funds do they hold". Matches a held asset to our
 * researched fund database by ISIN (`asset.identifier = fund.isin`) —
 * where that match exists, the holding's value is distributed across
 * that fund's own top-holdings/allocation data instead of being counted
 * as one opaque line item.
 *
 * Known simplifications (see README):
 *  - Scoped to accounts owned directly by household members
 *    (`owner_person_id`) — entity-attributed holdings (via a trust/
 *    company the household owns a stake in) are not included, unlike
 *    WealthConsolidationService's net-worth figure.
 *  - `fund_holdings` in this schema is only ever the fund's TOP holdings
 *    (not its full constituent list), so `lookedThroughPct` per fund is
 *    an approximation, not 100% of that fund's book — a fund's
 *    "everything else" long tail isn't attributed to any single company.
 */
@Injectable()
export class PortfolioLookThroughService {
  async compute(householdId: string): Promise<PortfolioLookThroughResult> {
    const manager = TenantContext.getManager();

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const personIds = members.map((m) => m.personId);
    if (personIds.length === 0) {
      return { totalValue: 0, lookedThroughValue: 0, lookedThroughPct: 0, topExposures: [], assetClassBreakdown: [], holdings: [] };
    }

    const accounts = await manager.getRepository(AccountEntity)
      .createQueryBuilder('a').where('a.owner_person_id IN (:...ids)', { ids: personIds }).getMany();
    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return { totalValue: 0, lookedThroughValue: 0, lookedThroughPct: 0, topExposures: [], assetClassBreakdown: [], holdings: [] };
    }

    const allHoldings = await manager.getRepository(HoldingEntity)
      .createQueryBuilder('h').where('h.account_id IN (:...ids)', { ids: accountIds }).orderBy('h.as_of_date', 'DESC').getMany();

    // Latest holding per (account, asset) pair — a holding history can have several as-of dates.
    const latestByKey = new Map<string, HoldingEntity>();
    for (const h of allHoldings) {
      const key = `${h.accountId}:${h.assetId}`;
      if (!latestByKey.has(key)) latestByKey.set(key, h); // already ordered DESC by date
    }
    const latestHoldings = Array.from(latestByKey.values());

    const assetIds = Array.from(new Set(latestHoldings.map((h) => h.assetId)));
    const assets = assetIds.length
      ? await manager.getRepository(AssetEntity).createQueryBuilder('a').where('a.id IN (:...ids)', { ids: assetIds }).getMany()
      : [];
    const assetById = new Map(assets.map((a) => [a.id, a]));

    const identifiers = assets.map((a) => a.identifier).filter((i): i is string => !!i);
    const matchedFunds = identifiers.length
      ? await manager.getRepository(FundEntity).createQueryBuilder('f').where('f.isin IN (:...isins)', { isins: identifiers }).getMany()
      : [];
    const fundByIsin = new Map(matchedFunds.map((f) => [f.isin, f]));

    const companyExposure = new Map<string, number>();
    const assetClassExposure = new Map<string, number>();
    const holdingsDetail: LookThroughHoldingDetail[] = [];
    let totalValue = 0;
    let lookedThroughValue = 0;

    for (const holding of latestHoldings) {
      const asset = assetById.get(holding.assetId);
      const value = Number(holding.marketValue);
      totalValue += value;

      const fund = asset?.identifier ? fundByIsin.get(asset.identifier) : undefined;

      if (fund) {
        lookedThroughValue += value;
        holdingsDetail.push({ assetName: asset!.name, value, matchedFundId: fund.id, matchedFundName: fund.name, lookedThrough: true });

        const fundHoldings = await manager.getRepository(FundHoldingEntity).find({ where: { fundId: fund.id } as any });
        for (const fh of fundHoldings) {
          const contribution = value * (Number(fh.holdingWeightPct) / 100);
          companyExposure.set(fh.holdingName, (companyExposure.get(fh.holdingName) ?? 0) + contribution);
        }

        const allocations = await manager.getRepository(FundAllocationEntity).find({ where: { fundId: fund.id } as any });
        for (const alloc of allocations) {
          const contribution = value * (Number(alloc.weightPct) / 100);
          assetClassExposure.set(alloc.category, (assetClassExposure.get(alloc.category) ?? 0) + contribution);
        }
      } else {
        const name = asset?.name ?? 'Unknown asset';
        holdingsDetail.push({ assetName: name, value, matchedFundId: null, matchedFundName: null, lookedThrough: false });
        // Not fund-matched — still counts directly as its own single-name exposure (covers direct stock holdings)
        // and under its own asset class (a fair, if coarser, bucket than a fund's own allocation categories).
        companyExposure.set(name, (companyExposure.get(name) ?? 0) + value);
        const bucket = asset?.assetClass ?? 'other';
        assetClassExposure.set(bucket, (assetClassExposure.get(bucket) ?? 0) + value);
      }
    }

    const toSortedExposures = (map: Map<string, number>): LookThroughExposure[] =>
      Array.from(map.entries())
        .map(([name, value]) => ({ name, value: round2(value), pct: totalValue > 0 ? round2((value / totalValue) * 100) : 0 }))
        .sort((a, b) => b.value - a.value);

    return {
      totalValue: round2(totalValue),
      lookedThroughValue: round2(lookedThroughValue),
      lookedThroughPct: totalValue > 0 ? round2((lookedThroughValue / totalValue) * 100) : 0,
      topExposures: toSortedExposures(companyExposure).slice(0, 20),
      assetClassBreakdown: toSortedExposures(assetClassExposure),
      holdings: holdingsDetail,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
