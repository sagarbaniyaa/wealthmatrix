import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from './audit-log.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get('row/:tableName/:rowId') @Roles(Role.ADMIN, Role.ADVISER)
  forRow(@Param('tableName') tableName: string, @Param('rowId') rowId: string) {
    return this.service.findForRow(tableName, rowId);
  }

  @Get('recent') @Roles(Role.ADMIN)
  recent(@Query('limit') limit?: string) {
    return this.service.findRecentForFirm(limit ? parseInt(limit, 10) : undefined);
  }
}
