import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { CurrencyEntity } from '../../database/entities';

// Reference data, shared across all tenants (no firm_id column) — no RLS on this table.
@Injectable()
export class CurrencyService extends BaseCrudService<CurrencyEntity> {
  constructor() { super(CurrencyEntity); }

  async create(data: Partial<CurrencyEntity>) {
    return this.repo.save(this.repo.create(data));
  }

  // Override: base findAll() orders by createdAt, which this table doesn't have.
  async findAll(): Promise<CurrencyEntity[]> {
    return this.repo.find({ order: { code: 'ASC' } as any });
  }
}
