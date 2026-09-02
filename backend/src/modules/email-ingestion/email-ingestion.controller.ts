import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EmailIngestionService } from '../../services/email-ingestion/email-ingestion.service';
import { ConnectEmailDto } from './dto/connect-email.dto';

// Per-adviser, not household-scoped — this is "my mailbox", the same
// adviser regardless of which client a provider reply happens to be
// about (matching is by reference code, see EmailIngestionService).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('email-connection')
@Roles(Role.ADMIN, Role.ADVISER)
export class EmailIngestionController {
  constructor(private readonly emailIngestion: EmailIngestionService) {}

  @Get()
  async getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.emailIngestion.getStatus(user.userId);
  }

  @Post()
  async connect(@Body() dto: ConnectEmailDto, @CurrentUser() user: AuthenticatedUser) {
    return this.emailIngestion.connect(user.userId, {
      imapHost: dto.imapHost, imapPort: dto.imapPort, imapSecure: dto.imapSecure ?? true,
      username: dto.username, password: dto.password,
    });
  }

  @Delete()
  async disconnect(@CurrentUser() user: AuthenticatedUser) {
    await this.emailIngestion.disconnect(user.userId);
    return { disconnected: true };
  }

  @Post('poll')
  async pollNow(@CurrentUser() user: AuthenticatedUser) {
    return this.emailIngestion.pollNow(user.userId);
  }
}
