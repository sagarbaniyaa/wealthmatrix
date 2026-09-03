import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { EntityOwnershipService } from './entity-ownership.service';
import { CreateOwnershipDto } from './dto/create-ownership.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Note: ownership_pct range and "exactly one owner side set" are enforced twice —
// here via class-validator for fast, friendly 400s, and again at the DB via CHECK
// constraints as the non-bypassable source of truth (see AllExceptionsFilter's
// 23514 handling for what happens if application validation is ever skipped).
@ApiTags('Entity Ownership')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('entity-ownership')
export class EntityOwnershipController {
  constructor(
    private readonly service: EntityOwnershipService,
    private readonly households: HouseholdService,
  ) {}

  // Closed alongside EntityController's same gap: this previously relied
  // on firm-level RLS alone (no ensureAccessible/ensureEntityAccessible
  // call at all), and a missing ownedEntityId returned every ownership
  // row in the firm to any authenticated adviser or client. Now a
  // non-admin must scope the request to one entity they can actually
  // access; admin keeps the unfiltered firm-wide view.
  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async find(
    @Query('ownedEntityId') ownedEntityId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('asOfDate') asOfDate?: string,
  ) {
    if (!ownedEntityId && user.role !== Role.ADMIN) {
      throw new BadRequestException('ownedEntityId is required.');
    }
    if (ownedEntityId) await this.households.ensureEntityAccessible(ownedEntityId, user as any);

    return asOfDate
      ? this.service.findValidAsOf(ownedEntityId, asOfDate)
      : this.service.findAll(ownedEntityId ? ({ ownedEntityId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateOwnershipDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureEntityAccessible(dto.ownedEntityId, user as any);
    return this.service.create(dto);
  }

  @Patch(':id/close') @Roles(Role.ADMIN, Role.ADVISER)
  async close(@Param('id') id: string, @Body('validTo') validTo: string, @CurrentUser() user: AuthenticatedUser) {
    const stake = await this.service.findOneOrFail(id);
    await this.households.ensureEntityAccessible(stake.ownedEntityId, user as any);
    return this.service.closeStake(id, validTo);
  }
}
