import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { FundScreenEntity } from '../../database/entities';
import { FundService, PagedFunds } from '../../modules/fund/fund.service';
import { FundQueryDto } from '../../modules/fund/dto/fund-query.dto';

@Injectable()
export class FundScreenerService {
  constructor(private readonly funds: FundService) {}

  async screen(query: FundQueryDto): Promise<PagedFunds> {
    return this.funds.findFiltered(query);
  }

  async saveScreen(name: string, filters: Record<string, unknown>, createdBy: string): Promise<FundScreenEntity> {
    const repo = TenantContext.getManager().getRepository(FundScreenEntity);
    return repo.save(repo.create({ firmId: TenantContext.getFirmId(), name, filters, createdBy }));
  }

  async listScreens(): Promise<FundScreenEntity[]> {
    return TenantContext.getManager().getRepository(FundScreenEntity).find({ order: { createdAt: 'DESC' } as any });
  }

  async deleteScreen(id: string): Promise<void> {
    await TenantContext.getManager().getRepository(FundScreenEntity).delete(id);
  }
}
