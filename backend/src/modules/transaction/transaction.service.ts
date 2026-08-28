import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { WealthTransaction } from '../../database/entities';

@Injectable()
export class TransactionService extends BaseCrudService<WealthTransaction> {
  constructor() { super(WealthTransaction); }

  async findByAccount(accountId: string, fromDate?: string, toDate?: string) {
    const qb = this.repo.createQueryBuilder('t').where('t.account_id = :accountId', { accountId });
    if (fromDate) qb.andWhere('t.transaction_date >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('t.transaction_date <= :toDate', { toDate });
    return qb.orderBy('t.transaction_date', 'DESC').getMany();
  }
}
