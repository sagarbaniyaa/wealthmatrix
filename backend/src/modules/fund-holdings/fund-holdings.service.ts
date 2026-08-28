import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { FundHoldingEntity } from '../../database/entities';

@Injectable()
export class FundHoldingsService extends BaseCrudService<FundHoldingEntity> {
  constructor() { super(FundHoldingEntity); }

  async findAll(where: any = {}) {
    return this.repo.find({ where, order: { holdingWeightPct: 'DESC' } as any });
  }
}
