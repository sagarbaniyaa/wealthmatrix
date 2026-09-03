import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Closed access-control gap: account carries no household_id, only
// owner_person_id XOR owner_entity_id, so nothing previously stopped
// any adviser or client in the firm reading another household's
// accounts (or every account in the firm, via an unfiltered findAll)
// by knowing or guessing an id. Every route below now resolves the
// owning household through HouseholdService.ensureAccountAccessible.
@ApiTags('Account')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountController {
  constructor(
    private readonly service: AccountService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findAll(
    @Query('ownerPersonId') ownerPersonId: string | undefined,
    @Query('ownerEntityId') ownerEntityId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!ownerPersonId && !ownerEntityId && user.role !== Role.ADMIN) {
      throw new BadRequestException('ownerPersonId or ownerEntityId is required.');
    }
    if (ownerPersonId) await this.households.ensurePersonAccessible(ownerPersonId, user as any);
    if (ownerEntityId) await this.households.ensureEntityAccessible(ownerEntityId, user as any);

    const where: any = {};
    if (ownerPersonId) where.ownerPersonId = ownerPersonId;
    if (ownerEntityId) where.ownerEntityId = ownerEntityId;
    return this.service.findAll(where);
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccountAccessible(id, user as any);
    return this.service.findOneOrFail(id);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateAccountDto, @CurrentUser() user: AuthenticatedUser) {
    if (dto.ownerPersonId) await this.households.ensurePersonAccessible(dto.ownerPersonId, user as any);
    if (dto.ownerEntityId) await this.households.ensureEntityAccessible(dto.ownerEntityId, user as any);
    return this.service.create(dto);
  }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async update(@Param('id') id: string, @Body() dto: Partial<CreateAccountDto>, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccountAccessible(id, user as any);
    return this.service.update(id, dto);
  }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
