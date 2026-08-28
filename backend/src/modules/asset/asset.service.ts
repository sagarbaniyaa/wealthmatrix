import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { AssetEntity } from '../../database/entities';

@Injectable()
export class AssetService extends BaseCrudService<AssetEntity> {
  constructor() { super(AssetEntity); }
}
