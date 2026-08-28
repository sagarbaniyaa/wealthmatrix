import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { EntityOwnershipService } from './entity-ownership.service';
import { CreateOwnershipDto } from './dto/create-ownership.dto';

// Note: ownership_pct range and "exactly one owner side set" are enforced twice —
// here via class-validator for fast, friendly 400s, and again at the DB via CHECK
// constraints as the non-bypassable source of truth (see AllExceptionsFilter's
// 23514 handling for what happens if application validation is ever skipped).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('entity-ownership')
export class EntityOwnershipController {
  constructor(private readonly service: EntityOwnershipService) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  find(@Query('ownedEntityId') ownedEntityId: string, @Query('asOfDate') asOfDate?: string) {
    return asOfDate
      ? this.service.findValidAsOf(ownedEntityId, asOfDate)
      : this.service.findAll(ownedEntityId ? ({ ownedEntityId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateOwnershipDto) { return this.service.create(dto); }

  @Patch(':id/close') @Roles(Role.ADMIN, Role.ADVISER)
  close(@Param('id') id: string, @Body('validTo') validTo: string) {
    return this.service.closeStake(id, validTo);
  }
}
