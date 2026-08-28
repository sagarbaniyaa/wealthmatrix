import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { FundHoldingsService } from './fund-holdings.service';
import { CreateFundHoldingDto } from './dto/create-fund-holding.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('funds/:fundId/holdings')
@Roles(Role.ADMIN, Role.ADVISER)
export class FundHoldingsController {
  constructor(private readonly service: FundHoldingsService) {}

  @Get() findAll(@Param('fundId') fundId: string) { return this.service.findAll({ fundId }); }

  @Post() create(@Param('fundId') fundId: string, @Body() dto: CreateFundHoldingDto) {
    return this.service.create({ ...dto, fundId } as any);
  }
}
