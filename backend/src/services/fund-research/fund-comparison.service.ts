import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { FundEntity, FundPerformanceEntity, FundAllocationEntity } from '../../database/entities';
import { FundService } from '../../modules/fund/fund.service';

export interface FundComparisonResult {
  funds: FundEntity[];
  performanceByFund: Record<string, FundPerformanceEntity[]>;
  allocationByFund: Record<string, FundAllocationEntity[]>;
}

@Injectable()
export class FundComparisonService {
  constructor(private readonly funds: FundService) {}

  async compare(fundIds: string[]): Promise<FundComparisonResult> {
    const uniqueIds = Array.from(new Set(fundIds));
    if (uniqueIds.length < 2) throw new BadRequestException('Provide at least 2 distinct funds to compare.');
    if (uniqueIds.length > 5) throw new BadRequestException('You can compare up to 5 funds at a time.');

    const funds = await this.funds.findOneOrFailByIdList(uniqueIds);
    const manager = TenantContext.getManager();

    const performance = await manager.getRepository(FundPerformanceEntity)
      .createQueryBuilder('p').where('p.fund_id IN (:...ids)', { ids: uniqueIds }).getMany();
    const allocation = await manager.getRepository(FundAllocationEntity)
      .createQueryBuilder('a').where('a.fund_id IN (:...ids)', { ids: uniqueIds }).getMany();

    return {
      funds,
      performanceByFund: groupBy(performance, (p) => p.fundId),
      allocationByFund: groupBy(allocation, (a) => a.fundId),
    };
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}
