import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ProviderSendService } from '../../services/provider-hub/provider-send.service';
import { UpdateActionStatusDto } from './dto/update-action-status.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Firm-wide compliance log viewer. Same admin-only pattern as the
// existing audit-trail viewer on /advisor/compliance — an adviser sees
// this household-by-household instead, via GET .../provider-pack/actions.
@ApiTags('Compliance Provider Action')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compliance-provider-actions')
export class ComplianceProviderActionController {
  constructor(
    private readonly send: ProviderSendService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN)
  findAll(@Query('householdId') householdId?: string) {
    return this.send.listActions(householdId);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.ADVISER)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateActionStatusDto, @CurrentUser() user: AuthenticatedUser) {
    const action = await this.send.findOneOrFail(id);
    await this.households.ensureAccessible(action.householdId, user as any);
    return this.send.updateStatus(id, dto.status);
  }
}
