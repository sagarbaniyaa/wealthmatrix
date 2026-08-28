import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { HoldingService } from './holding.service';
import { CreateHoldingDto } from './dto/create-holding.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('holdings')
export class HoldingController {
  constructor(private readonly service: HoldingService) {}

  @Get('account/:accountId/latest') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  latest(@Param('accountId') accountId: string, @Query('asOfDate') asOfDate: string) {
    return this.service.findLatestByAccount(accountId, asOfDate ?? new Date().toISOString().slice(0, 10));
  }

  @Get('account/:accountId/asset/:assetId/history') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  history(@Param('accountId') accountId: string, @Param('assetId') assetId: string) {
    return this.service.findHistory(accountId, assetId);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateHoldingDto) { return this.service.create(dto); }
}
