import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ComplianceLogService } from './compliance-log.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Compliance entries are written by risk-monitoring/consolidation jobs, not by users —
// advisers/admins can only view and resolve (sign off) findings here.
@ApiTags('Compliance Log')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compliance-log')
export class ComplianceLogController {
  constructor(
    private readonly service: ComplianceLogService,
    private readonly households: HouseholdService,
  ) {}

  // Firm-wide unresolved list is deliberate (an admin/adviser's own
  // "what needs attention" dashboard, same scoping as the household
  // list itself — findAllForUser) — not a per-household leak, since it
  // isn't filtered to one specific household's id an unassigned adviser
  // shouldn't see.
  @Get('unresolved') @Roles(Role.ADMIN, Role.ADVISER)
  async unresolved(@CurrentUser() user: AuthenticatedUser) {
    const accessible = new Set((await this.households.findAllForUser(user as any)).map((h) => h.id));
    const all = await this.service.findUnresolved();
    return user.role === 'admin' ? all : all.filter((entry) => !entry.householdId || accessible.has(entry.householdId));
  }

  // With a householdId: that one household's log, access-checked. Without
  // one: the firm-wide log the main Compliance page shows — scoped the
  // same way the household list itself is (admin sees everything, an
  // adviser only entries for their own assigned households or firm-wide
  // findings with no household attached), never a raw unscoped dump.
  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  async findAll(@Query('householdId') householdId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (householdId) {
      await this.households.ensureAccessible(householdId, user as any);
      return this.service.findAll({ householdId } as any);
    }
    if (user.role === 'admin') return this.service.findAll();
    const accessible = new Set((await this.households.findAllForUser(user as any)).map((h) => h.id));
    const all = await this.service.findAll();
    return all.filter((entry) => !entry.householdId || accessible.has(entry.householdId));
  }

  @Patch(':id/resolve') @Roles(Role.ADMIN, Role.ADVISER)
  async resolve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const entry = await this.service.findOneOrFail(id);
    if (entry.householdId) await this.households.ensureAccessible(entry.householdId, user as any);
    return this.service.resolve(id, user.userId);
  }
}
