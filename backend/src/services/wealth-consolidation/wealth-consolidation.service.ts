import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  FirmEntity, HouseholdEntity, HouseholdMemberEntity, WealthEntity,
  AccountEntity, HoldingEntity, AssetEntity,
} from '../../database/entities';
import { FXConversionService } from '../fx-conversion/fx-conversion.service';

interface EntityAttribution {
  entityId: string;
  entityName: string;
  effectiveOwnershipPct: number;
  entityNetAssetValue: number;
  attributedValue: number;
}

interface HouseholdNetWorth {
  householdId: string;
  asOfDate: string;
  baseCurrencyCode: string;
  personalNetWorth: number;
  entityAttributedNetWorth: number;
  totalNetWorth: number;
  entityBreakdown: EntityAttribution[];
}

/**
 * The engine behind "what is this household actually worth" — the thing a
 * flat-schema wealth platform cannot do correctly, because it can't walk
 * layered ownership (person -> entity -> entity -> asset) and attribute
 * indirect stakes proportionally.
 *
 * Two building blocks:
 *  1. A recursive CTE (mirrors the v_effective_ownership_today view in the
 *     schema, but parameterised by as-of date and scoped to one household's
 *     members) computing each member's EFFECTIVE % ownership of every
 *     entity reachable through the ownership graph, cycle-safe.
 *  2. Per-entity NAV = sum of that entity's account holdings (assets minus
 *     liabilities, via asset.is_liability), converted to the firm's base
 *     currency at as-of-date FX rates.
 *
 * Household net worth = personal holdings (accounts owned directly by
 * household members) + Σ(entity NAV × effective ownership %).
 */
@Injectable()
export class WealthConsolidationService {
  constructor(private readonly fx: FXConversionService) {}

  async getHouseholdNetWorth(householdId: string, asOfDate?: string): Promise<HouseholdNetWorth> {
    const manager = TenantContext.getManager();
    const date = asOfDate ?? new Date().toISOString().slice(0, 10);

    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);

    const firm = await manager.getRepository(FirmEntity).findOne({ where: { id: household.firmId } as any });
    if (!firm?.baseCurrencyId) {
      throw new NotFoundException(`Firm ${household.firmId} has no base_currency_id configured`);
    }
    const baseCurrencyId = firm.baseCurrencyId;

    const members = await manager
      .getRepository(HouseholdMemberEntity)
      .find({ where: { householdId } as any });
    const personIds = members.map((m) => m.personId);

    const personalNetWorth = personIds.length
      ? await this.sumAccountsNetValue(
          await manager.getRepository(AccountEntity).find({ where: personIds.map((id) => ({ ownerPersonId: id })) as any }),
          baseCurrencyId,
          date,
        )
      : 0;

    const effectiveOwnership = personIds.length
      ? await this.computeEffectiveOwnership(personIds, date)
      : [];

    const entityBreakdown: EntityAttribution[] = [];
    let entityAttributedNetWorth = 0;

    for (const row of effectiveOwnership) {
      const entity = await manager.getRepository(WealthEntity).findOne({ where: { id: row.entity_id } as any });
      if (!entity) continue;
      const entityAccounts = await manager.getRepository(AccountEntity).find({ where: { ownerEntityId: entity.id } as any });
      const nav = await this.sumAccountsNetValue(entityAccounts, baseCurrencyId, date);
      const attributed = Math.round(nav * (Number(row.effective_ownership_pct) / 100) * 100) / 100;

      entityBreakdown.push({
        entityId: entity.id,
        entityName: entity.name,
        effectiveOwnershipPct: Number(row.effective_ownership_pct),
        entityNetAssetValue: nav,
        attributedValue: attributed,
      });
      entityAttributedNetWorth += attributed;
    }

    return {
      householdId,
      asOfDate: date,
      baseCurrencyCode: '', // populate via CurrencyService.findOneOrFail(baseCurrencyId) in the caller if needed
      personalNetWorth,
      entityAttributedNetWorth: Math.round(entityAttributedNetWorth * 100) / 100,
      totalNetWorth: Math.round((personalNetWorth + entityAttributedNetWorth) * 100) / 100,
      entityBreakdown,
    };
  }

  /** Sums the latest holding per (account, asset) across a set of accounts, netting liabilities. */
  private async sumAccountsNetValue(accounts: AccountEntity[], baseCurrencyId: string, asOfDate: string): Promise<number> {
    if (accounts.length === 0) return 0;
    const manager = TenantContext.getManager();
    let total = 0;

    for (const account of accounts) {
      const latestHoldings = await manager
        .getRepository(HoldingEntity)
        .createQueryBuilder('h')
        .distinctOn(['h.asset_id'])
        .where('h.account_id = :accountId', { accountId: account.id })
        .andWhere('h.as_of_date <= :asOfDate', { asOfDate })
        .orderBy('h.asset_id')
        .addOrderBy('h.as_of_date', 'DESC')
        .getMany();

      for (const holding of latestHoldings) {
        const asset = await manager.getRepository(AssetEntity).findOne({ where: { id: holding.assetId } as any });
        const converted = await this.fx.convert(Number(holding.marketValue), holding.currencyId, baseCurrencyId, asOfDate);
        total += asset?.isLiability ? -converted : converted;
      }
    }
    return Math.round(total * 100) / 100;
  }

  /**
   * Cycle-safe recursive rollup of indirect ownership %, scoped to a set of
   * owner persons and a single as-of date. Mirrors v_effective_ownership_today
   * in the schema — kept here as a parameterised raw query rather than
   * reusing the view directly, since the view is fixed to CURRENT_DATE and
   * this needs historic/future as-of dates for scenario projection.
   */
  private async computeEffectiveOwnership(
    personIds: string[],
    asOfDate: string,
  ): Promise<Array<{ entity_id: string; effective_ownership_pct: string }>> {
    const manager = TenantContext.getManager();
    return manager.query(
      `
      WITH RECURSIVE ownership_chain AS (
        SELECT
          eo.owner_person_id AS root_person_id,
          eo.owned_entity_id,
          eo.ownership_pct::numeric AS effective_pct,
          ARRAY[eo.owned_entity_id] AS path
        FROM entity_ownership eo
        WHERE eo.valid_range @> $2::date
          AND eo.owner_person_id = ANY($1::uuid[])

        UNION ALL

        SELECT
          oc.root_person_id,
          eo.owned_entity_id,
          (oc.effective_pct * eo.ownership_pct / 100.0),
          oc.path || eo.owned_entity_id
        FROM entity_ownership eo
        JOIN ownership_chain oc ON eo.owner_entity_id = oc.owned_entity_id
        WHERE eo.valid_range @> $2::date
          AND NOT (eo.owned_entity_id = ANY(oc.path))
      )
      SELECT owned_entity_id AS entity_id, SUM(effective_pct) AS effective_ownership_pct
      FROM ownership_chain
      GROUP BY owned_entity_id;
      `,
      [personIds, asOfDate],
    );
  }
}
