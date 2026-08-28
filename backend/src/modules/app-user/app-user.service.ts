import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { AppUserEntity } from '../../database/entities';

@Injectable()
export class AppUserService extends BaseCrudService<AppUserEntity> {
  constructor() { super(AppUserEntity); }
}
