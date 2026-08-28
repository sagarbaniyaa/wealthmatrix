import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { AccountEntity } from '../../database/entities';

@Injectable()
export class AccountService extends BaseCrudService<AccountEntity> {
  constructor() { super(AccountEntity); }
}
