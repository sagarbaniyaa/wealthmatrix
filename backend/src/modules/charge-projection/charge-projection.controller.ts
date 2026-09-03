import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ChargeProjectionService } from '../../services/charge-projection/charge-projection.service';
import { CreateChargeProjectionDto } from './dto/create-charge-projection.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Charge Projection')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/charge-projections')
@Roles(Role.ADMIN, Role.ADVISER)
export class ChargeProjectionController {
  constructor(
    private readonly projections: ChargeProjectionService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async findAll(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.projections.listForHousehold(householdId);
  }

  @Get(':id')
  async findOne(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.projections.findOneOrFail(id);
  }

  @Post()
  async create(@Param('householdId') householdId: string, @Body() dto: CreateChargeProjectionDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.projections.create({
      householdId, name: dto.name, oldArrangement: dto.oldArrangement, newArrangement: dto.newArrangement,
      assumptions: dto.assumptions, createdBy: user.userId,
    });
  }

  @Delete(':id')
  async remove(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.projections.remove(id);
  }
}
