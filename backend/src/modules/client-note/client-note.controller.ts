import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ClientNoteService } from './client-note.service';
import { CreateClientNoteDto } from './dto/create-client-note.dto';
import { HouseholdService } from '../household/household.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Adviser-authored CRM notes/activity log. Advisers/admins manage them
// firm-wide; a client can only ever read (never create/delete) the notes
// on their own household — never an arbitrary householdId they might pass.
//
// Closed access-control gap: the adviser branch below previously had NO
// check at all — an adviser could pass ANY householdId to read another
// adviser's notes, list every note in the firm by omitting householdId,
// create a note against a household they aren't assigned to, or delete
// any note in the firm by id. Every route now goes through
// HouseholdService.ensureAccessible.
@ApiTags('Client Note')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('client-notes')
export class ClientNoteController {
  constructor(
    private readonly service: ClientNoteService,
    private readonly households: HouseholdService,
  ) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findAll(@Query('householdId') householdId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === Role.CLIENT) {
      const own = await this.households.findForClient(user.personId);
      if (!own) return [];
      return this.service.findAll({ householdId: own.id } as any);
    }
    if (!householdId && user.role !== Role.ADMIN) throw new BadRequestException('householdId is required.');
    if (householdId) await this.households.ensureAccessible(householdId, user as any);
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateClientNoteDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccessible(dto.householdId, user as any);
    return this.service.create({ ...dto, authorId: user.userId });
  }

  @Delete(':id') @Roles(Role.ADMIN, Role.ADVISER)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const note = await this.service.findOneOrFail(id);
    await this.households.ensureAccessible(note.householdId, user as any);
    return this.service.remove(id);
  }
}
