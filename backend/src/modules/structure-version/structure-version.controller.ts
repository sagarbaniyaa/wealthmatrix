import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { StructureVersionService } from './structure-version.service';
import { CreateStructureVersionDto } from './dto/create-structure-version.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('structure-versions')
export class StructureVersionController {
  constructor(private readonly service: StructureVersionService) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findAll(@Query('householdId') householdId?: string) {
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateStructureVersionDto) { return this.service.create(dto); }

  @Patch(':id/approve') @Roles(Role.ADMIN, Role.ADVISER)
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approve(id, user.userId);
  }
}
