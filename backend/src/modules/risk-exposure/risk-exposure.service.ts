import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { RiskExposureEntity } from '../../database/entities';

@Injectable()
export class RiskExposureService extends BaseCrudService<RiskExposureEntity> {
  constructor() { super(RiskExposureEntity); }

  async latestForHousehold(householdId: string) {
    return this.repo
      .createQueryBuilder('r')
      .where('r.household_id = :householdId', { householdId })
      .orderBy('r.as_of_date', 'DESC')
      .limit(1)
      .getOne();
  }

  // Override: base findAll() orders by createdAt, which this table doesn't
  // have (it tracks asOfDate/computedAt instead).
  async findAll(where: FindOptionsWhere<RiskExposureEntity> = {}): Promise<RiskExposureEntity[]> {
    return this.repo.find({ where, order: { asOfDate: 'DESC' } as any });
  }
}
