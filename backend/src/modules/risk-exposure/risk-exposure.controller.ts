import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RiskExposureService } from './risk-exposure.service';

// Writes to this table come from the risk-monitoring job (WealthConsolidationService /
// a scheduled cron), not direct user input — hence read-only endpoints here.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risk-exposure')
export class RiskExposureController {
  constructor(private readonly service: RiskExposureService) {}

  @Get('household/:householdId/latest') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  latest(@Param('householdId') householdId: string) { return this.service.latestForHousehold(householdId); }

  @Get('household/:householdId/history') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  history(@Param('householdId') householdId: string) {
    return this.service.findAll({ householdId } as any);
  }
}
