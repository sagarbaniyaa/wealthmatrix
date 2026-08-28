import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ScenarioService } from './scenario.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { ScenarioEngineService } from '../../services/scenario-engine/scenario-engine.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scenarios')
export class ScenarioController {
  constructor(
    private readonly service: ScenarioService,
    private readonly engine: ScenarioEngineService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findAll(@Query('householdId') householdId?: string) {
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findOne(@Param('id') id: string) { return this.service.findOneOrFail(id); }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateScenarioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create({ ...dto, createdBy: user.userId } as any);
  }

  // Runs ScenarioEngine synchronously and persists the projection to scenario.result.
  // For long-running Monte Carlo style projections, swap this for a queued job
  // (e.g. BullMQ) — endpoint contract stays the same, status flips draft→running→complete.
  @Post(':id/run') @Roles(Role.ADMIN, Role.ADVISER)
  run(@Param('id') id: string) { return this.engine.runScenario(id); }
}
