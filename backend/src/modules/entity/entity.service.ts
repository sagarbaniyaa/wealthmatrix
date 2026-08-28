import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { WealthEntity } from '../../database/entities';

@Injectable()
export class EntityService extends BaseCrudService<WealthEntity> {
  constructor() { super(WealthEntity); }
}
