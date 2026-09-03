import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { FundAllocationService } from './fund-allocation.service';
import { CreateFundAllocationDto } from './dto/create-fund-allocation.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Fund Allocation')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('funds/:fundId/allocation')
@Roles(Role.ADMIN, Role.ADVISER)
export class FundAllocationController {
  constructor(private readonly service: FundAllocationService) {}

  @Get() findAll(@Param('fundId') fundId: string) { return this.service.findAll({ fundId }); }

  @Post() create(@Param('fundId') fundId: string, @Body() dto: CreateFundAllocationDto) {
    return this.service.create({ ...dto, fundId } as any);
  }
}
