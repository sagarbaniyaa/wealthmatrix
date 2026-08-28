import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { EntityService } from './entity.service';
import { CreateEntityDto } from './dto/create-entity.dto';
import { UpdateEntityDto } from './dto/update-entity.dto';
import { EntityStructureService } from '../../services/entity-structure/entity-structure.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('entities')
export class EntityController {
  constructor(
    private readonly service: EntityService,
    private readonly structure: EntityStructureService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  findAll(@Query('householdId') householdId?: string) {
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findOne(@Param('id') id: string) { return this.service.findOneOrFail(id); }

  // Graph payload for the frontend's entity structure map — see EntityStructureService.
  @Get('household/:householdId/graph') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  graph(@Param('householdId') householdId: string) {
    return this.structure.buildOwnershipGraph(householdId);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateEntityDto) { return this.service.create(dto); }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  update(@Param('id') id: string, @Body() dto: UpdateEntityDto) { return this.service.update(id, dto); }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
