import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { FactFindService } from '../../services/fact-find/fact-find.service';
import { UpsertFactFindDto } from './dto/upsert-fact-find.dto';
import { RISK_QUESTIONNAIRE } from '../../services/fact-find/risk-questionnaire.constants';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Fact finds are household-scoped and adviser/admin-only to create/edit —
// a client never fills this in directly. Read access for a client is
// deliberately NOT exposed here; if that's wanted later, it should be a
// separate read-only endpoint scoped like ClientNoteController, not this one.
@ApiTags('Fact Find')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/fact-finds')
@Roles(Role.ADMIN, Role.ADVISER)
export class FactFindController {
  constructor(
    private readonly service: FactFindService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async findAll(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.listForHousehold(householdId);
  }

  @Get(':id')
  async findOne(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.findOneOrFail(id);
  }

  @Post()
  async create(@Param('householdId') householdId: string, @Body() dto: UpsertFactFindDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.create(householdId, dto, user.userId);
  }

  @Patch(':id')
  async update(@Param('householdId') householdId: string, @Param('id') id: string, @Body() dto: UpsertFactFindDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('householdId') householdId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.remove(id);
  }
}

// Not household-scoped — this is just the static question bank the
// frontend renders the ATR section from, same for every household.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fact-find-risk-questionnaire')
@Roles(Role.ADMIN, Role.ADVISER)
export class RiskQuestionnaireController {
  @Get() get() { return RISK_QUESTIONNAIRE; }
}
