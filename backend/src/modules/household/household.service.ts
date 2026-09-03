import { ForbiddenException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { TenantContext } from '../../common/database/tenant-context';
import { Role } from '../../common/enums/role.enum';
import {
  HouseholdEntity,
  HouseholdMemberEntity,
  AdviserHouseholdAssignmentEntity,
  WealthEntity,
  EntityOwnershipEntity,
  AccountEntity,
} from '../../database/entities';

@Injectable()
export class HouseholdService extends BaseCrudService<HouseholdEntity> {
  constructor() { super(HouseholdEntity); }

  /** Resolves the single household a client's person record belongs to, or null. */
  async findForClient(personId: string | null | undefined): Promise<HouseholdEntity | null> {
    if (!personId) return null;
    const member = await TenantContext.getManager()
      .getRepository(HouseholdMemberEntity)
      .findOne({ where: { personId } as any });
    if (!member) return null;
    return this.repo.findOne({ where: { id: member.householdId } as any });
  }

  /**
   * Admin sees the whole firm's book; an adviser sees only households
   * they're assigned to (adviser_household_assignment) — this is the
   * enforcement point for "Adviser → assigned households" in the RBAC
   * model. Without an assignment row, a brand-new adviser sees nothing,
   * which is why `create()` below auto-assigns the creating adviser.
   */
  async findAllForUser(user: { userId: string; role: Role }): Promise<HouseholdEntity[]> {
    if (user.role === Role.ADMIN) return this.findAll();

    const assignments = await TenantContext.getManager()
      .getRepository(AdviserHouseholdAssignmentEntity)
      .find({ where: { adviserId: user.userId } as any });
    const householdIds = assignments.map((a) => a.householdId);
    if (householdIds.length === 0) return [];
    return this.repo.find({ where: { id: In(householdIds) } as any, order: { createdAt: 'DESC' } as any });
  }

  /**
   * Same create() as the base class, but also stamps primaryAdviserId and
   * writes the adviser_household_assignment row when an adviser (not
   * admin) creates the household — otherwise a household they just made
   * would immediately be invisible to them under findAllForUser above.
   */
  async createForUser(data: { name: string; primaryAdviserId?: string }, user: { userId: string; role: Role }): Promise<HouseholdEntity> {
    const withAdviser = user.role === Role.ADVISER ? { ...data, primaryAdviserId: data.primaryAdviserId ?? user.userId } : data;
    const household = await this.create(withAdviser);

    if (user.role === Role.ADVISER) {
      await TenantContext.getManager().getRepository(AdviserHouseholdAssignmentEntity).save(
        TenantContext.getManager().getRepository(AdviserHouseholdAssignmentEntity).create({
          firmId: TenantContext.getFirmId(), adviserId: user.userId, householdId: household.id,
        }),
      );
    }

    return household;
  }

  /**
   * Closes the direct-ID-access gap: findAllForUser hides unassigned
   * households from an adviser's list, and RLS only enforces the firm
   * boundary — neither stops an adviser or client from requesting a
   * household by ID they shouldn't see. Admin bypasses this. Applied
   * directly to every household-scoped controller (scenarios,
   * compliance-log, risk-exposure, client notes, etc.), and indirectly
   * — via ensureEntityAccessible/ensurePersonAccessible/
   * ensureAccountAccessible below — to entities, people, accounts,
   * holdings, transactions and income, none of which carry a
   * household_id of their own to check directly.
   */
  async ensureAccessible(householdId: string, user: { userId: string; role: Role; personId?: string | null }): Promise<void> {
    if (user.role === Role.ADMIN) return;

    if (user.role === Role.ADVISER) {
      const assignment = await TenantContext.getManager()
        .getRepository(AdviserHouseholdAssignmentEntity)
        .findOne({ where: { adviserId: user.userId, householdId } as any });
      if (!assignment) throw new ForbiddenException('You are not assigned to this household.');
      return;
    }

    if (user.role === Role.CLIENT) {
      const own = await this.findForClient(user.personId);
      if (!own || own.id !== householdId) throw new ForbiddenException('You can only view your own household.');
    }
  }

  /**
   * Closes the harder case ensureAccessible above couldn't: entity.
   * household_id is nullable, so a subsidiary reached only through
   * another entity's ownership graph (e.g. a household holds a trust,
   * the trust owns a company, and the company itself has no
   * household_id) had no household to check access against and relied
   * on firm-level RLS alone — any adviser in the firm could reach it by
   * guessing its id.
   *
   * Walks the ownership graph UPWARD from the given entity (owned ->
   * owner, following owner_entity_id chains and owner_person_id ->
   * household_member links) to collect every household the entity is
   * transitively part of, then grants access if the user can see any
   * one of them. A cycle-safe BFS (ownership data is meant to be a DAG,
   * but nothing in the schema forbids a bad row from creating a loop).
   *
   * An entity with no household anywhere in its ownership graph (a
   * true orphan, not linked to any household directly or transitively)
   * falls through to firm-level RLS only, same as before — there is no
   * narrower boundary to enforce than "the whole firm" for something
   * that isn't part of any household's story at all.
   */
  async ensureEntityAccessible(entityId: string, user: { userId: string; role: Role; personId?: string | null }): Promise<void> {
    if (user.role === Role.ADMIN) return;

    const householdIds = await this.findHouseholdsForEntity(entityId);
    if (householdIds.size === 0) return;

    let lastError: unknown;
    for (const householdId of householdIds) {
      try {
        await this.ensureAccessible(householdId, user);
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new ForbiddenException('You do not have access to this entity.');
  }

  private async findHouseholdsForEntity(entityId: string): Promise<Set<string>> {
    const manager = TenantContext.getManager();
    const householdIds = new Set<string>();
    const visitedEntityIds = new Set<string>();
    const queue: string[] = [entityId];

    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      if (visitedEntityIds.has(currentId)) continue;
      visitedEntityIds.add(currentId);

      const entity = await manager.getRepository(WealthEntity).findOne({ where: { id: currentId } as any });
      if (!entity) continue;
      if (entity.householdId) householdIds.add(entity.householdId);

      const ownershipRows = await manager
        .getRepository(EntityOwnershipEntity)
        .find({ where: { ownedEntityId: currentId } as any });

      for (const row of ownershipRows) {
        if (row.ownerEntityId && !visitedEntityIds.has(row.ownerEntityId)) {
          queue.push(row.ownerEntityId);
        }
        if (row.ownerPersonId) {
          const memberships = await manager
            .getRepository(HouseholdMemberEntity)
            .find({ where: { personId: row.ownerPersonId } as any });
          for (const membership of memberships) householdIds.add(membership.householdId);
        }
      }
    }

    return householdIds;
  }

  /**
   * Same idea as ensureAccessible, for a person who isn't necessarily
   * the CURRENT user — findForClient above only ever resolves the
   * caller's own household, which is no help when an adviser is asking
   * "can I see THIS other person's income/accounts". Grants access if
   * the person belongs to a household the user can see; a person not
   * linked to any household falls through to firm-level RLS only, same
   * reasoning as an orphan entity in ensureEntityAccessible.
   */
  async ensurePersonAccessible(personId: string, user: { userId: string; role: Role; personId?: string | null }): Promise<void> {
    if (user.role === Role.ADMIN) return;
    const household = await this.findForClient(personId);
    if (!household) return;
    await this.ensureAccessible(household.id, user);
  }

  /**
   * Closes the same class of gap on account/holding/transaction data:
   * none of those tables carry a household_id, only owner_person_id XOR
   * owner_entity_id, so nothing stopped any adviser or client in the
   * firm reading (or, for holdings/transactions, even attaching new
   * records to) another household's accounts by knowing or guessing an
   * account id. Resolves the owning household via whichever owner side
   * is set and delegates to ensurePersonAccessible/ensureEntityAccessible
   * — an account with NEITHER owner side set (shouldn't happen, but
   * nothing in the schema forbids it) falls through to firm-level RLS
   * only, same reasoning as every other orphan case above.
   */
  async ensureAccountAccessible(accountId: string, user: { userId: string; role: Role; personId?: string | null }): Promise<void> {
    if (user.role === Role.ADMIN) return;

    const account = await TenantContext.getManager().getRepository(AccountEntity).findOne({ where: { id: accountId } as any });
    if (!account) return;

    if (account.ownerPersonId) {
      await this.ensurePersonAccessible(account.ownerPersonId, user);
    } else if (account.ownerEntityId) {
      await this.ensureEntityAccessible(account.ownerEntityId, user);
    }
  }
}
