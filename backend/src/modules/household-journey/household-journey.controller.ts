import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { HouseholdJourneyService } from '../../services/household-journey/household-journey.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/journey')
@Roles(Role.ADMIN, Role.ADVISER)
export class HouseholdJourneyController {
  constructor(
    private readonly journey: HouseholdJourneyService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async get(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.journey.getJourney(householdId);
  }
}
