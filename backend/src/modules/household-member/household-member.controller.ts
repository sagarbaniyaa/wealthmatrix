import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { HouseholdMemberService } from './household-member.service';
import { CreateHouseholdMemberDto } from './dto/create-household-member.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Closed access-control gap: same class as scenarios/risk-exposure/
// compliance-log before their fix — household_id is right there on the
// row, but nothing checked it against the caller's actual assignment.
@ApiTags('Household Member')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('household-members')
export class HouseholdMemberController {
  constructor(
    private readonly service: HouseholdMemberService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  async findAll(@Query('householdId') householdId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!householdId && user.role !== Role.ADMIN) throw new BadRequestException('householdId is required.');
    if (householdId) await this.households.ensureAccessible(householdId, user as any);
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateHouseholdMemberDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(dto.householdId, user as any);
    return this.service.create(dto);
  }

  @Delete(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const member = await this.service.findOneOrFail(id);
    await this.households.ensureAccessible(member.householdId, user as any);
    return this.service.remove(id);
  }
}
