import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('people')
export class PersonController {
  constructor(private readonly service: PersonService) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER) findAll() { return this.service.findAll(); }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findOne(@Param('id') id: string) { return this.service.findOneOrFail(id); }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreatePersonDto) { return this.service.create(dto); }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) { return this.service.update(id, dto); }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
