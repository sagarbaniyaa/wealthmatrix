import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ConsumerDutyService } from '../../services/consumer-duty/consumer-duty.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Firm-wide register — one screen answering "which clients need Consumer
// Duty attention right now", scoped the same way the household list
// itself is (admin sees the firm, an adviser sees their own book).
@ApiTags('Consumer Duty')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consumer-duty')
@Roles(Role.ADMIN, Role.ADVISER)
export class ConsumerDutyController {
  constructor(private readonly consumerDuty: ConsumerDutyService) {}

  @Get()
  async getRegister(@CurrentUser() user: AuthenticatedUser) {
    return this.consumerDuty.getRegister(user as any);
  }
}
