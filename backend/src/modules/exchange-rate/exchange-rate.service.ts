import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { ExchangeRateEntity } from '../../database/entities';

@Injectable()
export class ExchangeRateService extends BaseCrudService<ExchangeRateEntity> {
  constructor() { super(ExchangeRateEntity); }

  async create(data: Partial<ExchangeRateEntity>) {
    return this.repo.save(this.repo.create(data));
  }

  /** Most recent rate on or before a given date — the pattern FXConversionService relies on. */
  async findLatestOnOrBefore(fromCurrencyId: string, toCurrencyId: string, date: string) {
    return this.repo
      .createQueryBuilder('r')
      .where('r.from_currency_id = :fromCurrencyId', { fromCurrencyId })
      .andWhere('r.to_currency_id = :toCurrencyId', { toCurrencyId })
      .andWhere('r.rate_date <= :date', { date })
      .orderBy('r.rate_date', 'DESC')
      .limit(1)
      .getOne();
  }
}
