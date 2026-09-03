import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { TelephonyService } from '../../services/telephony/telephony.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/telephony')
@Roles(Role.ADMIN, Role.ADVISER)
export class TelephonyController {
  constructor(
    private readonly telephony: TelephonyService,
    private readonly households: HouseholdService,
  ) {}

  @Get('calls')
  async listCalls(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.telephony.listForHousehold(householdId);
  }

  @Post('call')
  async call(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.telephony.placeCall(householdId, user.userId);
  }
}
