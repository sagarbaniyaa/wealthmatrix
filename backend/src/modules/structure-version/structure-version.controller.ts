import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { StructureVersionService } from './structure-version.service';
import { CreateStructureVersionDto } from './dto/create-structure-version.dto';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Closed access-control gap: same class as scenarios/risk-exposure/
// compliance-log before their fix — household_id is right there on the
// row, but nothing checked it against the caller's actual assignment.
@ApiTags('Structure Version')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('structure-versions')
export class StructureVersionController {
  constructor(
    private readonly service: StructureVersionService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findAll(@Query('householdId') householdId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!householdId && user.role !== Role.ADMIN) throw new BadRequestException('householdId is required.');
    if (householdId) await this.households.ensureAccessible(householdId, user as any);
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateStructureVersionDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(dto.householdId, user as any);
    return this.service.create(dto);
  }

  @Patch(':id/approve') @Roles(Role.ADMIN, Role.ADVISER)
  async approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const version = await this.service.findOneOrFail(id);
    await this.households.ensureAccessible(version.householdId, user as any);
    return this.service.approve(id, user.userId);
  }
}
