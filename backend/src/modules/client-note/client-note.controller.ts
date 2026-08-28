import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ClientNoteService } from './client-note.service';
import { CreateClientNoteDto } from './dto/create-client-note.dto';
import { HouseholdService } from '../household/household.service';

// Adviser-authored CRM notes/activity log. Advisers/admins manage them
// firm-wide; a client can only ever read (never create/delete) the notes
// on their own household — never an arbitrary householdId they might pass.
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
    return this.service.findAll(householdId ? ({ householdId } as any) : {});
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateClientNoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create({ ...dto, authorId: user.userId });
  }

  @Delete(':id') @Roles(Role.ADMIN, Role.ADVISER)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
