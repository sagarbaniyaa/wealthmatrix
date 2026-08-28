import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { TenantContext } from '../../common/database/tenant-context';
import { FundEntity } from '../../database/entities';
import { FundQueryDto } from './dto/fund-query.dto';

export interface PagedFunds {
  items: FundEntity[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class FundService extends BaseCrudService<FundEntity> {
  constructor() { super(FundEntity); }

  /**
   * Server-side filtered + paginated fund search — the thing that makes
   * "search/filter across ~3,700 funds" actually workable. Never loads
   * the whole table: every filter is a WHERE clause, sorting/paging is
   * done in Postgres, and the indexes from the migration (isin, sector,
   * risk_rating) keep this fast at that scale.
   */
  async findFiltered(query: FundQueryDto): Promise<PagedFunds> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const qb = this.repo.createQueryBuilder('f');

    if (query.search) {
      qb.andWhere('(f.name ILIKE :search OR f.isin ILIKE :search)', { search: `%${query.search}%` });
    }
    if (query.sector) qb.andWhere('f.sector = :sector', { sector: query.sector });
    if (query.assetClass) qb.andWhere('f.asset_class = :assetClass', { assetClass: query.assetClass });
    if (query.riskRatingMin !== undefined) qb.andWhere('f.risk_rating >= :riskMin', { riskMin: query.riskRatingMin });
    if (query.riskRatingMax !== undefined) qb.andWhere('f.risk_rating <= :riskMax', { riskMax: query.riskRatingMax });
    if (query.ocfMax !== undefined) qb.andWhere('f.ocf <= :ocfMax', { ocfMax: query.ocfMax });
    if (query.yieldMin !== undefined) qb.andWhere('f.yield_pct >= :yieldMin', { yieldMin: query.yieldMin });
    if (query.volatilityMax !== undefined) qb.andWhere('f.volatility_pct <= :volMax', { volMax: query.volatilityMax });

    const sortColumn: Record<string, string> = {
      name: 'f.name', ocf: 'f.ocf', yieldPct: 'f.yield_pct',
      riskRating: 'f.risk_rating', volatilityPct: 'f.volatility_pct', aum: 'f.aum',
    };
    qb.orderBy(sortColumn[query.sortBy ?? 'name'], query.sortDir ?? 'ASC', 'NULLS LAST');

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  /** Distinct sector/asset-class lists for filter dropdowns — cheap even at 3,700 rows (index-only scan). */
  async listFilterOptions(): Promise<{ sectors: string[]; assetClasses: string[] }> {
    const manager = TenantContext.getManager();
    const sectors = await manager.getRepository(FundEntity).createQueryBuilder('f').select('DISTINCT f.sector', 'sector').orderBy('f.sector').getRawMany();
    const assetClasses = await manager.getRepository(FundEntity).createQueryBuilder('f').select('DISTINCT f.asset_class', 'assetClass').orderBy('f.asset_class').getRawMany();
    return {
      sectors: sectors.map((r) => r.sector),
      assetClasses: assetClasses.map((r) => r.assetClass),
    };
  }

  async findByIsin(isin: string): Promise<FundEntity | null> {
    return this.repo.findOne({ where: { isin } as any });
  }

  // Order-preserving by contract: callers (e.g. FundAnalyticsService's
  // switch-impact tool) destructure the result positionally as
  // [fundA, fundB] to match the ids they passed in. A plain `IN (...)`
  // query gives no such guarantee — Postgres is free to return rows in
  // whatever order it finds them (e.g. physical/index order), which
  // silently swapped fund A and B here until this was fixed. Re-sort by
  // the input order explicitly rather than trusting the query's order.
  async findOneOrFailByIdList(ids: string[]): Promise<FundEntity[]> {
    if (ids.length === 0) return [];
    const funds = await this.repo.createQueryBuilder('f').where('f.id IN (:...ids)', { ids }).getMany();
    const byId = new Map(funds.map((f) => [f.id, f]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Fund(s) not found: ${missing.join(', ')}`);
    }
    return ids.map((id) => byId.get(id)!);
  }
}
