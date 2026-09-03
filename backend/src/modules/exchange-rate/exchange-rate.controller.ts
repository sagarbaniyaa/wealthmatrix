import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ExchangeRateService } from './exchange-rate.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Exchange Rate')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(private readonly service: ExchangeRateService) {}

  @Get() findAll() { return this.service.findAll(); }

  @Get('latest')
  latest(@Query('from') from: string, @Query('to') to: string, @Query('date') date: string) {
    return this.service.findLatestOnOrBefore(from, to, date);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateExchangeRateDto) { return this.service.create(dto); }
}
