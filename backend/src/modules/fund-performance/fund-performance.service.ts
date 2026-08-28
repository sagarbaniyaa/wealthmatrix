import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { FundPerformanceEntity } from '../../database/entities';

@Injectable()
export class FundPerformanceService extends BaseCrudService<FundPerformanceEntity> {
  constructor() { super(FundPerformanceEntity); }

  async findAll(where: any = {}) {
    return this.repo.find({ where, order: { asOfDate: 'DESC' } as any });
  }
}
