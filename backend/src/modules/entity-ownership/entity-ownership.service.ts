import { Injectable } from '@nestjs/common';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { EntityOwnershipEntity } from '../../database/entities';

@Injectable()
export class EntityOwnershipService extends BaseCrudService<EntityOwnershipEntity> {
  constructor() { super(EntityOwnershipEntity); }

  /**
   * "Close" a stake instead of deleting it — sets valid_to so the historic
   * record is preserved for as-of-date queries and audit_log continues to
   * show a coherent lineage rather than a hard delete.
   */
  async closeStake(id: string, validTo: string) {
    return this.update(id, { validTo } as Partial<EntityOwnershipEntity>);
  }

  /** Direct ownership edges valid on a given date for one owned entity. */
  async findValidAsOf(ownedEntityId: string, asOfDate: string) {
    return this.repo
      .createQueryBuilder('o')
      .where('o.owned_entity_id = :ownedEntityId', { ownedEntityId })
      .andWhere('o.valid_from <= :asOfDate', { asOfDate })
      .andWhere('(o.valid_to IS NULL OR o.valid_to > :asOfDate)', { asOfDate })
      .getMany();
  }
}
