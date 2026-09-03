import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { EntityService } from './entity.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { EntityStructureService } from '../../services/entity-structure/entity-structure.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Entity')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('entities')
export class EntityController {
  constructor(
    private readonly service: EntityService,
    private readonly structure: EntityStructureService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  async findAll(@Query('householdId') householdId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!householdId) throw new BadRequestException('householdId is required.');
    await this.households.ensureAccessible(householdId, user as any);
    return this.service.findAll({ householdId } as any);
  }

  // Closed: entity.household_id is nullable — an entity reached only via
  // another entity's ownership graph (no direct household_id of its own)
  // used to fall through to firm-level RLS alone. ensureEntityAccessible
  // walks the ownership graph upward (owner_entity_id chains and
  // owner_person_id -> household_member links) to find every household
  // this entity is transitively part of, and grants access if the user
  // can see any one of them — see HouseholdService for the full writeup.
  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const entity = await this.service.findOneOrFail(id);
    await this.households.ensureEntityAccessible(id, user as any);
    return entity;
  }

  // Graph payload for the frontend's entity structure map — see EntityStructureService.
  @Get('household/:householdId/graph') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async graph(@Param('householdId') householdId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(householdId, user as any);
    return this.structure.buildOwnershipGraph(householdId);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateEntityDto, @CurrentUser() user: AuthenticatedUser) {
    if (dto.householdId) await this.households.ensureAccessible(dto.householdId, user as any);
    return this.service.create(dto);
  }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async update(@Param('id') id: string, @Body() dto: UpdateEntityDto, @CurrentUser() user: AuthenticatedUser) {
    await this.service.findOneOrFail(id);
    await this.households.ensureEntityAccessible(id, user as any);
    return this.service.update(id, dto);
  }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
