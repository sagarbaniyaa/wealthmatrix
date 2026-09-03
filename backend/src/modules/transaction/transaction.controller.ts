import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { HouseholdService } from '../household/household.service';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

// external_ref + the DB's partial unique index (account_id, external_ref) gives
// idempotent ingest from custodian feeds for free — retried webhook deliveries
// simply hit the 23505 branch of AllExceptionsFilter instead of double-booking.
//
// Closed access-control gap: a transaction is scoped only by account_id
// (no household_id), so nothing previously stopped any adviser or
// client in the firm reading — or posting a fabricated transaction
// against — another household's account by knowing or guessing its id.
@ApiTags('Transaction')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly service: TransactionService,
    private readonly households: HouseholdService,
  ) {}

  @Get('account/:accountId') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  async findByAccount(
    @Param('accountId') accountId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.households.ensureAccountAccessible(accountId, user as any);
    return this.service.findByAccount(accountId, from, to);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  async create(@Body() dto: CreateTransactionDto, @CurrentUser() user: AuthenticatedUser) {
    await this.households.ensureAccountAccessible(dto.accountId, user as any);
    return this.service.create(dto);
  }
}
