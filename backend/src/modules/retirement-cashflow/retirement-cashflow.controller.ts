import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { RetirementCashflowService } from '../../services/retirement-cashflow/retirement-cashflow.service';
import { CreateRetirementCashflowDto } from './dto/create-retirement-cashflow.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Retirement Cashflow')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/retirement-cashflow')
@Roles(Role.ADMIN, Role.ADVISER)
export class RetirementCashflowController {
  constructor(
    private readonly cashflow: RetirementCashflowService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async findAll(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cashflow.listForHousehold(householdId);
  }

  @Get(':id')
  async findOne(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cashflow.findOneOrFail(id);
  }

  @Post()
  async create(@Param('householdId') householdId: string, @Body() dto: CreateRetirementCashflowDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cashflow.create({ householdId, name: dto.name, inputs: dto.inputs, createdBy: user.userId });
  }

  @Delete(':id')
  async remove(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.cashflow.remove(id);
  }
}
