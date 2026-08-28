import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { PersonEntity } from '../../database/entities';

@Injectable()
export class PersonService extends BaseCrudService<PersonEntity> {
  constructor() { super(PersonEntity); }
}
