import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { PortfolioLookThroughService } from '../../services/portfolio-lookthrough/portfolio-lookthrough.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/portfolio-lookthrough')
export class PortfolioLookThroughController {
  constructor(
    private readonly lookThrough: PortfolioLookThroughService,
    private readonly households: HouseholdService,
  ) {}

  // Advisers/admins see any accessible household; a client can see their own — same
  // pattern as ClientNoteController, since this is genuinely useful for a client to see too.
  @Get()
  @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async get(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.lookThrough.compute(householdId);
  }
}
