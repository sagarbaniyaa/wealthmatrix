import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ScenarioService } from './scenario.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { ScenarioEngineService } from '../../services/scenario-engine/scenario-engine.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Scenario')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scenarios')
export class ScenarioController {
  constructor(
    private readonly service: ScenarioService,
    private readonly engine: ScenarioEngineService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findAll(@Query('householdId') householdId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    // Security review finding (closed): RLS only enforces the firm
    // boundary, not "is this adviser actually assigned to this
    // household" — findAll with no householdId used to let anyone in
    // the firm list every scenario firm-wide. Now requires a household
    // and checks it, same as every household-scoped endpoint built
    // since this module — see HouseholdService.ensureAccessible.
    if (!householdId) throw new BadRequestException('householdId is required.');
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.findAll({ householdId } as any);
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scenario = await this.service.findOneOrFail(id);
    await this.households.ensureAccessible(scenario.householdId, user as any);
    return scenario;
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateScenarioDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(dto.householdId, user as any);
    return this.service.create({ ...dto, createdBy: user.userId } as any);
  }

  // Runs ScenarioEngine synchronously and persists the projection to scenario.result.
  // For long-running Monte Carlo style projections, swap this for a queued job
  // (e.g. BullMQ) — endpoint contract stays the same, status flips draft→running→complete.
  @Post(':id/run') @Roles(Role.ADMIN, Role.ADVISER)
  async run(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scenario = await this.service.findOneOrFail(id);
    await this.households.ensureAccessible(scenario.householdId, user as any);
    return this.engine.runScenario(id);
  }
}
