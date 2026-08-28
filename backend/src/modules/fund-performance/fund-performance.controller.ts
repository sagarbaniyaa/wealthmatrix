import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { FundPerformanceService } from './fund-performance.service';
import { CreateFundPerformanceDto } from './dto/create-fund-performance.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('funds/:fundId/performance')
@Roles(Role.ADMIN, Role.ADVISER)
export class FundPerformanceController {
  constructor(private readonly service: FundPerformanceService) {}

  @Get() findAll(@Param('fundId') fundId: string) { return this.service.findAll({ fundId }); }

  @Post() create(@Param('fundId') fundId: string, @Body() dto: CreateFundPerformanceDto) {
    return this.service.create({ ...dto, fundId } as any);
  }
}
