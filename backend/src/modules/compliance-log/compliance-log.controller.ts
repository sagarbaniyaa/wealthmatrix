import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ComplianceLogService } from './compliance-log.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Compliance entries are written by risk-monitoring/consolidation jobs, not by users —
// advisers/admins can only view and resolve (sign off) findings here.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compliance-log')
export class ComplianceLogController {
  constructor(private readonly service: ComplianceLogService) {}

  @Get('unresolved') @Roles(Role.ADMIN, Role.ADVISER) unresolved() { return this.service.findUnresolved(); }

  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  findAll(@Query('householdId') householdId?: string) {
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Patch(':id/resolve') @Roles(Role.ADMIN, Role.ADVISER)
  resolve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.resolve(id, user.userId);
  }
}
