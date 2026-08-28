import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { AdviserHouseholdAssignmentEntity } from '../../database/entities';

@Injectable()
export class AdviserHouseholdAssignmentService extends BaseCrudService<AdviserHouseholdAssignmentEntity> {
  constructor() { super(AdviserHouseholdAssignmentEntity); }
}
