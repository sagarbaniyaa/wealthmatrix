import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { RiskExposureService } from './risk-exposure.service';

// Writes to this table come from the risk-monitoring job (WealthConsolidationService /
// a scheduled cron), not direct user input — hence read-only endpoints here.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk-exposure')
export class RiskExposureController {
  constructor(
    private readonly service: RiskExposureService,
    private readonly households: HouseholdService,
  ) {}

  @Get('household/:householdId/latest') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async latest(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.latestForHousehold(householdId);
  }

  @Get('household/:householdId/history') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async history(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.findAll({ householdId } as any);
  }
}
