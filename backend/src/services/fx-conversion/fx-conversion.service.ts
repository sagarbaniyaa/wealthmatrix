import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { ExchangeRateEntity } from '../../database/entities';

/**
 * Converts amounts between currencies at read time — nothing in the domain
 * schema stores a pre-converted "amount in GBP" column, so every dashboard/
 * consolidation figure passes through here. Point-in-time correct: pass the
 * transaction/valuation date, not "today", when converting historic amounts.
 */
@Injectable()
export class FXConversionService {
  private cache = new Map<string, number>(); // per-request memoisation only

  async getRate(fromCurrencyId: string, toCurrencyId: string, asOfDate: string): Promise<number> {
    if (fromCurrencyId === toCurrencyId) return 1;

    const cacheKey = `${fromCurrencyId}:${toCurrencyId}:${asOfDate}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const manager = TenantContext.getManager();
    const rate = await manager
      .getRepository(ExchangeRateEntity)
      .createQueryBuilder('r')
      .where('r.from_currency_id = :fromCurrencyId', { fromCurrencyId })
      .andWhere('r.to_currency_id = :toCurrencyId', { toCurrencyId })
      .andWhere('r.rate_date <= :asOfDate', { asOfDate })
      .orderBy('r.rate_date', 'DESC')
      .limit(1)
      .getOne();

    if (rate) {
      this.cache.set(cacheKey, Number(rate.rate));
      return Number(rate.rate);
    }

    // Try the inverse pair before giving up — many feeds only publish one direction.
    const inverse = await manager
      .getRepository(ExchangeRateEntity)
      .createQueryBuilder('r')
      .where('r.from_currency_id = :toCurrencyId', { toCurrencyId })
      .andWhere('r.to_currency_id = :fromCurrencyId', { fromCurrencyId })
      .andWhere('r.rate_date <= :asOfDate', { asOfDate })
      .orderBy('r.rate_date', 'DESC')
      .limit(1)
      .getOne();

    if (inverse) {
      const inverted = 1 / Number(inverse.rate);
      this.cache.set(cacheKey, inverted);
      return inverted;
    }

    throw new NotFoundException(
      `No exchange rate found for ${fromCurrencyId} -> ${toCurrencyId} on or before ${asOfDate}`,
    );
  }

  async convert(amount: number, fromCurrencyId: string, toCurrencyId: string, asOfDate: string): Promise<number> {
    const rate = await this.getRate(fromCurrencyId, toCurrencyId, asOfDate);
    return Math.round(amount * rate * 100) / 100;
  }
}
