import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ProviderService } from './provider.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// The firm's provider directory. Every adviser/admin can see and edit
// contact details (per spec: "Advisers can edit these later") — creating
// or deleting a directory entry outright is admin-only, so an adviser
// can't accidentally wipe an entry other advisers rely on.
@ApiTags('Provider')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('providers')
@Roles(Role.ADMIN, Role.ADVISER)
export class ProviderController {
  constructor(private readonly service: ProviderService) {}

  @Get() findAll() { return this.service.findAll(); }

  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOneOrFail(id); }

  @Post() @Roles(Role.ADMIN) create(@Body() dto: CreateProviderDto) { return this.service.create(dto); }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProviderDto) { return this.service.update(id, dto); }

  @Patch(':id/verify-email')
  verifyEmail(@Param('id') id: string) { return this.service.update(id, { emailVerified: true }); }

  @Delete(':id') @Roles(Role.ADMIN) remove(@Param('id') id: string) { return this.service.remove(id); }
}
