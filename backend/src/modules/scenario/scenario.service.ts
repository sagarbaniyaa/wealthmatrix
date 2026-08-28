import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { ScenarioEntity } from '../../database/entities';

@Injectable()
export class ScenarioService extends BaseCrudService<ScenarioEntity> {
  constructor() { super(ScenarioEntity); }
}
