import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { FirmService } from './firm.service';
import { UpdateFirmDto } from './dto/update-firm.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// Firms are provisioned by Anthropic-side ops tooling, not self-serve — no POST here.
// Admins can view/update their own firm's settings only (RLS scopes this automatically).
@ApiTags('Firm')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('firms')
export class FirmController {
  constructor(private readonly service: FirmService) {}

  @Get('me')
  @Roles(Role.ADMIN, Role.ADVISER)
  getMine(@Param() _: unknown) {
    return this.service.findAll();
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateFirmDto) {
    return this.service.update(id, dto);
  }
}
