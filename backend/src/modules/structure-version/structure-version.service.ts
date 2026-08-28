import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { StructureVersionEntity } from '../../database/entities';

@Injectable()
export class StructureVersionService extends BaseCrudService<StructureVersionEntity> {
  constructor() { super(StructureVersionEntity); }

  async approve(id: string, approvedBy: string) {
    return this.update(id, { approvedBy, approvedAt: new Date() } as any);
  }
}
