import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { HouseholdMemberService } from './household-member.service';
import { CreateHouseholdMemberDto } from './dto/create-household-member.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('household-members')
export class HouseholdMemberController {
  constructor(private readonly service: HouseholdMemberService) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  findAll(@Query('householdId') householdId?: string) {
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateHouseholdMemberDto) { return this.service.create(dto); }

  @Delete(':id') @Roles(Role.ADMIN, Role.ADVISER)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
