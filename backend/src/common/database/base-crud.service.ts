import { NotFoundException } from '@nestjs/common';
import { DeepPartial, EntityTarget, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { TenantContext } from './tenant-context';

/**
 * Generic tenant-aware CRUD base. Every domain service extends this
 * instead of hand-rolling find/create/update/remove — RLS is the hard
 * isolation boundary, but stamping firm_id explicitly on create is
 * defense-in-depth and keeps inserts correct even before RLS evaluates
 * the WITH CHECK clause.
 *
 * Concrete services add entity-specific query/business methods on top.
 */
export abstract class BaseCrudService<T extends ObjectLiteral> {
  protected constructor(protected readonly target: EntityTarget<T>) {}

  protected get repo() {
    return TenantContext.getManager().getRepository(this.target);
  }

  async findAll(where: FindOptionsWhere<T> = {} as FindOptionsWhere<T>, relations: string[] = []): Promise<T[]> {
    return this.repo.find({ where, relations, order: { createdAt: 'DESC' } as any });
  }

  async findOneOrFail(id: string, relations: string[] = []): Promise<T> {
    const row = await this.repo.findOne({ where: { id } as any, relations });
    if (!row) {
      throw new NotFoundException(`${this.repo.metadata.name} ${id} not found`);
    }
    return row;
  }

  async create(data: DeepPartial<T>): Promise<T> {
    const withFirm = { ...data, firmId: TenantContext.getFirmId() } as DeepPartial<T>;
    const entity = this.repo.create(withFirm);
    return this.repo.save(entity);
  }

  async update(id: string, data: DeepPartial<T>): Promise<T> {
    const existing = await this.findOneOrFail(id);
    this.repo.merge(existing, data);
    return this.repo.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOneOrFail(id);
    await this.repo.remove(existing);
  }
}
