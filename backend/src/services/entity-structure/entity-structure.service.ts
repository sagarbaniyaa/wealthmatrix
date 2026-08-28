import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { HouseholdMemberEntity, PersonEntity, WealthEntity, EntityOwnershipEntity } from '../../database/entities';

export interface GraphNode {
  id: string;
  label: string;
  kind: 'person' | 'entity';
  entityType?: string;
}
export interface GraphEdge {
  from: string;
  to: string;
  ownershipPct: number;
  ownershipClass: string | null;
  validFrom: string;
  validTo: string | null;
}
export interface OwnershipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Builds the node/edge payload the frontend's entity structure map renders
 * directly (e.g. into React Flow). Returns the CURRENT graph (valid_to IS
 * NULL) by default — pass asOfDate for a historic structure_version view.
 */
@Injectable()
export class EntityStructureService {
  async buildOwnershipGraph(householdId: string, asOfDate?: string): Promise<OwnershipGraph> {
    const manager = TenantContext.getManager();

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const personIds = members.map((m) => m.personId);
    const persons = personIds.length
      ? await manager.getRepository(PersonEntity).find({ where: personIds.map((id) => ({ id })) as any })
      : [];

    const entities = await manager.getRepository(WealthEntity).find({ where: { householdId } as any });

    const nodes: GraphNode[] = [
      ...persons.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName}`, kind: 'person' as const })),
      ...entities.map((e) => ({ id: e.id, label: e.name, kind: 'entity' as const, entityType: e.entityType })),
    ];

    const entityIds = entities.map((e) => e.id);
    const qb = manager
      .getRepository(EntityOwnershipEntity)
      .createQueryBuilder('o')
      .where('o.owned_entity_id IN (:...entityIds)', { entityIds: entityIds.length ? entityIds : [null] });

    if (asOfDate) {
      qb.andWhere('o.valid_from <= :asOfDate', { asOfDate }).andWhere(
        '(o.valid_to IS NULL OR o.valid_to > :asOfDate)',
        { asOfDate },
      );
    } else {
      qb.andWhere('o.valid_to IS NULL');
    }

    const ownershipRows = await qb.getMany();

    const edges: GraphEdge[] = ownershipRows.map((o) => ({
      from: (o.ownerPersonId ?? o.ownerEntityId) as string,
      to: o.ownedEntityId,
      ownershipPct: Number(o.ownershipPct),
      ownershipClass: o.ownershipClass,
      validFrom: o.validFrom,
      validTo: o.validTo,
    }));

    return { nodes, edges };
  }
}
