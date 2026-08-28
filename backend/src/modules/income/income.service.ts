import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { IncomeEntity } from '../../database/entities';

@Injectable()
export class IncomeService extends BaseCrudService<IncomeEntity> {
  constructor() { super(IncomeEntity); }
}
