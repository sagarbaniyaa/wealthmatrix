import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { ComplianceLogEntity } from '../../database/entities';

@Injectable()
export class ComplianceLogService extends BaseCrudService<ComplianceLogEntity> {
  constructor() { super(ComplianceLogEntity); }

  async findUnresolved() {
    return this.repo
      .createQueryBuilder('c')
      .where('c.resolved_at IS NULL')
      .orderBy('c.detected_at', 'DESC')
      .getMany();
  }

  // Override: base findAll() orders by createdAt, which this table doesn't
  // have (it tracks detectedAt/resolvedAt instead).
  async findAll(where: FindOptionsWhere<ComplianceLogEntity> = {}): Promise<ComplianceLogEntity[]> {
    return this.repo.find({ where, order: { detectedAt: 'DESC' } as any });
  }

  async resolve(id: string, resolvedBy: string) {
    return this.update(id, { resolvedAt: new Date(), resolvedBy } as any);
  }
}
