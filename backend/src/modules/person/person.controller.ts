import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Closed access-control gap: nothing previously stopped an adviser or
// client reading, or an adviser editing, ANY person record in the firm
// (name, DOB and other PII) by knowing or guessing an id — person
// carries no household_id of its own, only a household_member row
// linking it to one. findAll() firm-wide is now admin-only (the
// frontend never called it unfiltered — its one use of this API is the
// household-creation POST); everything else goes through
// HouseholdService.ensurePersonAccessible.
@ApiTags('Person')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('people')
export class PersonController {
  constructor(
    private readonly service: PersonService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN) findAll() { return this.service.findAll(); }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensurePersonAccessible(id, user as any);
    return this.service.findOneOrFail(id);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreatePersonDto) { return this.service.create(dto); }

  @Patch(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async update(@Param('id') id: string, @Body() dto: UpdatePersonDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensurePersonAccessible(id, user as any);
    return this.service.update(id, dto);
  }

  @Delete(':id') @Roles(Role.ADMIN)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
