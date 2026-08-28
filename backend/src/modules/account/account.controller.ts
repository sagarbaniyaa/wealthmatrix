import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findAll(@Query('ownerPersonId') ownerPersonId?: string, @Query('ownerEntityId') ownerEntityId?: string) {
    const where: any = {};
    if (ownerPersonId) where.ownerPersonId = ownerPersonId;
    if (ownerEntityId) where.ownerEntityId = ownerEntityId;
    return this.service.findAll(where);
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findOne(@Param('id') id: string) { return this.service.findOneOrFail(id); }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateAccountDto) { return this.service.create(dto); }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  update(@Param('id') id: string, @Body() dto: Partial<CreateAccountDto>) { return this.service.update(id, dto); }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
