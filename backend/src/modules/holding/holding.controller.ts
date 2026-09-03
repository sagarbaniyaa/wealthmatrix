import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { HoldingService } from './holding.service';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Closed access-control gap: a holding is scoped only by account_id (no
// household_id), so nothing previously stopped any adviser or client in
// the firm reading another household's holdings by knowing or guessing
// an account id — see HouseholdService.ensureAccountAccessible.
@ApiTags('Holding')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('holdings')
export class HoldingController {
  constructor(
    private readonly service: HoldingService,
    private readonly households: HouseholdService,
  ) {}

  @Get('account/:accountId/latest') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async latest(@Param('accountId') accountId: string, @Query('asOfDate') asOfDate: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccountAccessible(accountId, user as any);
    return this.service.findLatestByAccount(accountId, asOfDate ?? new Date().toISOString().slice(0, 10));
  }

  @Get('account/:accountId/asset/:assetId/history') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async history(@Param('accountId') accountId: string, @Param('assetId') assetId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccountAccessible(accountId, user as any);
    return this.service.findHistory(accountId, assetId);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateHoldingDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccountAccessible(dto.accountId, user as any);
    return this.service.create(dto);
  }
}
