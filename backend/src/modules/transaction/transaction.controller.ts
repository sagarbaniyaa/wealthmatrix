import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

// external_ref + the DB's partial unique index (account_id, external_ref) gives
// idempotent ingest from custodian feeds for free — retried webhook deliveries
// simply hit the 23505 branch of AllExceptionsFilter instead of double-booking.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  @Get('account/:accountId') @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  findByAccount(
    @Param('accountId') accountId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findByAccount(accountId, from, to);
  }

  @Post() @Roles(Role.ADMIN, Role.ADVISER)
  create(@Body() dto: CreateTransactionDto) { return this.service.create(dto); }
}
