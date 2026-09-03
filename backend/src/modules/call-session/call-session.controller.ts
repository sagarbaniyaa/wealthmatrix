import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { CallSessionService } from '../../services/call-session/call-session.service';
import { CallSuggestionsDto, FinishCallDto } from './dto/call-session.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/call-session')
@Roles(Role.ADMIN, Role.ADVISER)
export class CallSessionController {
  constructor(
    private readonly callSession: CallSessionService,
    private readonly households: HouseholdService,
  ) {}

  @Post('suggestions')
  async suggestions(@Param('householdId') householdId: string, @Body() dto: CallSuggestionsDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.callSession.getSuggestions(householdId, dto.transcript, dto.alreadyShown ?? []);
  }

  @Post('finish')
  async finish(@Param('householdId') householdId: string, @Body() dto: FinishCallDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    const processed = await this.callSession.finishCall(householdId, dto.transcript, user.userId);
    const { fileData, ...meta } = processed as any;
    return meta;
  }
}
