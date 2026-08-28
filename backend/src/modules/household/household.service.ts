import { ForbiddenException, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { BaseCrudService } from '../../common/database/base-crud.service';
import { TenantContext } from '../../common/database/tenant-context';
import { Role } from '../../common/enums/role.enum';
import { HouseholdEntity, HouseholdMemberEntity, AdviserHouseholdAssignmentEntity } from '../../database/entities';

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
   * Closes the direct-ID-access gap on the two most-used household
   * endpoints (detail + net-worth): findAllForUser hides unassigned
   * households from an adviser's list, and RLS only enforces the firm
   * boundary — neither stops an adviser or client from requesting a
   * household by ID they shouldn't see. Admin bypasses this. Note: this
   * is not yet applied to every household-scoped sub-resource across
   * other modules (scenarios, compliance-log, risk-exposure, entities) —
   * those still rely on firm-level RLS only, which is a real remaining
   * gap for a fuller hardening pass.
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
}
