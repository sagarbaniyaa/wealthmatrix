import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ClientActionService } from '../../services/client-action/client-action.service';
import { SetClientActionDto } from './dto/set-client-action.dto';
import { ACTION_REQUIREMENTS, ActionType } from '../../services/client-action/action-requirements.constants';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/action')
@Roles(Role.ADMIN, Role.ADVISER)
export class ClientActionController {
  constructor(
    private readonly clientAction: ClientActionService,
    private readonly households: HouseholdService,
  ) {}

  @Get('options')
  listOptions() {
    return (Object.keys(ACTION_REQUIREMENTS) as ActionType[]).map((actionType) => ({
      actionType, label: ACTION_REQUIREMENTS[actionType].label,
    }));
  }

  @Get()
  async getCurrent(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.clientAction.getCurrent(householdId);
  }

  @Get('history')
  async getHistory(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.clientAction.getHistory(householdId);
  }

  @Get('checklist')
  async getChecklist(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.clientAction.getChecklist(householdId);
  }

  @Post()
  async setAction(@Param('householdId') householdId: string, @Body() dto: SetClientActionDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.clientAction.setAction(householdId, dto.actionType as ActionType, dto.notes, user.userId);
  }
}
