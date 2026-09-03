import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ConsumerDutyService } from '../../services/consumer-duty/consumer-duty.service';
import { CreateConsumerDutyReviewDto } from './dto/create-consumer-duty-review.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Consumer Duty Review')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households/:householdId/consumer-duty')
@Roles(Role.ADMIN, Role.ADVISER)
export class ConsumerDutyReviewController {
  constructor(
    private readonly consumerDuty: ConsumerDutyService,
    private readonly households: HouseholdService,
  ) {}

  @Get()
  async getDetail(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.consumerDuty.getHouseholdDetail(householdId);
  }

  @Post()
  async recordReview(
    @Param('householdId') householdId: string,
    @Body() dto: CreateConsumerDutyReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.consumerDuty.recordReview(householdId, dto, user.userId);
  }
}
