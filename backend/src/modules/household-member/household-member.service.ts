import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { HouseholdMemberEntity } from '../../database/entities';

@Injectable()
export class HouseholdMemberService extends BaseCrudService<HouseholdMemberEntity> {
  constructor() { super(HouseholdMemberEntity); }
}
