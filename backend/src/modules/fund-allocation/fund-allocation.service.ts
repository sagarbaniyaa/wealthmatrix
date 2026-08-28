import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { FundAllocationEntity } from '../../database/entities';

@Injectable()
export class FundAllocationService extends BaseCrudService<FundAllocationEntity> {
  constructor() { super(FundAllocationEntity); }

  async findAll(where: any = {}) {
    return this.repo.find({ where, order: { weightPct: 'DESC' } as any });
  }
}
