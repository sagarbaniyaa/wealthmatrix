import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { FirmEntity } from '../../database/entities';

@Injectable()
export class FirmService extends BaseCrudService<FirmEntity> {
  constructor() { super(FirmEntity); }
}
