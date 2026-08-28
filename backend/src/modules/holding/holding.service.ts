import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { HoldingEntity } from '../../database/entities';

@Injectable()
export class HoldingService extends BaseCrudService<HoldingEntity> {
  constructor() { super(HoldingEntity); }

  /** Latest holding row per (account, asset) on or before a date — the time-series read pattern. */
  async findLatestByAccount(accountId: string, asOfDate: string) {
    return this.repo
      .createQueryBuilder('h')
      .distinctOn(['h.asset_id'])
      .where('h.account_id = :accountId', { accountId })
      .andWhere('h.as_of_date <= :asOfDate', { asOfDate })
      .orderBy('h.asset_id')
      .addOrderBy('h.as_of_date', 'DESC')
      .getMany();
  }

  async findHistory(accountId: string, assetId: string) {
    return this.repo.find({
      where: { accountId, assetId } as any,
      order: { asOfDate: 'ASC' } as any,
    });
  }
}
