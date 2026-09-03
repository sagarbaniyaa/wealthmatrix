import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { CgtIntelligenceService } from '../../services/cgt-intelligence/cgt-intelligence.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/cgt-analysis')
@Roles(Role.ADMIN, Role.ADVISER)
export class CgtAnalysisController {
  constructor(
    private readonly cgt: CgtIntelligenceService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async findAll(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cgt.listForHousehold(householdId);
  }

  @Get('preview')
  async preview(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cgt.compute(householdId);
  }

  @Post()
  async create(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cgt.create(householdId, user.userId);
  }

  @Delete(':id')
  async remove(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cgt.remove(id);
  }
}
