import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from './household.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { UpdateHouseholdDto } from './dto/update-household.dto';
import { WealthConsolidationService } from '../../services/wealth-consolidation/wealth-consolidation.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Household')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('households')
export class HouseholdController {
  constructor(
    private readonly service: HouseholdService,
    private readonly consolidation: WealthConsolidationService,
  ) {}

  // Admin sees the whole firm's book; adviser sees only assigned
  // households — see HouseholdService.findAllForUser.
  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  findAll(@CurrentUser() user: AuthenticatedUser) { return this.service.findAllForUser(user as any); }

  // Clients can't hit GET / (adviser/admin only) so they have no way to
  // learn their own household's id — this resolves it from their JWT's
  // personId instead. Must be registered before ':id' or 'me' gets
  // swallowed by that param route.
  @Get('me') @Roles(Role.CLIENT)
  findMine(@CurrentUser() user: AuthenticatedUser) { return this.service.findForClient(user.personId); }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.service.ensureAccessible(id, user as any);
    return this.service.findOneOrFail(id);
  }

  @Get(':id/net-worth') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async netWorth(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.service.ensureAccessible(id, user as any);
    return this.consolidation.getHouseholdNetWorth(id);
  }

  // Auto-assigns the creating adviser (see HouseholdService.createForUser) —
  // otherwise a household they just created would be invisible to them
  // under the assignment-scoped findAll above.
  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateHouseholdDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createForUser(dto, user as any);
  }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async update(@Param('id') id: string, @Body() dto: UpdateHouseholdDto, @CurrentUser() user: AuthenticatedUser) {
    await this.service.ensureAccessible(id, user as any);
    return this.service.update(id, dto);
  }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
