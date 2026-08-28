import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('income')
export class IncomeController {
  constructor(private readonly service: IncomeService) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findAll(@Query('personId') personId?: string) {
    return this.service.findAll(personId ? ({ personId } as any) : {});
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findOne(@Param('id') id: string) { return this.service.findOneOrFail(id); }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateIncomeDto) { return this.service.create(dto); }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  update(@Param('id') id: string, @Body() dto: UpdateIncomeDto) { return this.service.update(id, dto); }

  @Delete(':id') @Roles(Role.ADMIN, Role.ADVISER)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
