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
import { GdprService } from '../../services/gdpr/gdpr.service';
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
    private readonly gdpr: GdprService,
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

  // GDPR subject access request: everything this platform holds that's
  // attributable to this person, in one JSON document.
  @Get(':id/gdpr-export') @Roles(Role.ADMIN, Role.ADVISER)
  async gdprExport(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensurePersonAccessible(id, user as any);
    return this.gdpr.exportPersonData(id);
  }

  // Right to erasure — anonymises identifying fields on the person
  // record; financial records are RETAINED under statutory record-
  // keeping duties, not deleted (see GdprService's own comment on why).
  // Admin-only: this is a one-way, hard-to-reverse action on client PII.
  @Post(':id/gdpr-erase') @Roles(Role.ADMIN)
  async gdprErase(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensurePersonAccessible(id, user as any);
    await this.gdpr.erasePersonData(id, user.userId);
    return { message: 'Personal data has been erased. Financial records are retained under statutory record-keeping obligations.' };
  }
}
