import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AppUserService } from './app-user.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Read-only roster of the firm's own users — email + role only
// (password_hash is `select: false` on the entity, so it never leaves
// here). Needed for adviser-assignment pickers and the adviser
// performance report; not client-facing.
@ApiTags('App User')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class AppUserController {
  constructor(private readonly service: AppUserService) {}

  @Get() @Roles(Role.ADMIN, Role.ADVISER)
  findAll(@Query('role') role?: string) {
    return this.service.findAll(role ? ({ role } as any) : {});
  }

  @Get(':id') @Roles(Role.ADMIN, Role.ADVISER)
  findOne(@Param('id') id: string) { return this.service.findOneOrFail(id); }

  // Self-service only — an adviser's own phone number, needed for
  // Telephony's click-to-call (it rings the adviser first). Never
  // exposes/accepts another user's id.
  @Patch('me') @Roles(Role.ADMIN, Role.ADVISER)
  updateMe(@Body() dto: UpdateMyProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(user.userId, dto);
  }
}
