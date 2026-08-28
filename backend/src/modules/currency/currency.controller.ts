import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly service: CurrencyService) {}

  @Get() findAll() { return this.service.findAll(); }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCurrencyDto) { return this.service.create(dto); }
}
