import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [TransactionService], controllers: [TransactionController], exports: [TransactionService] })
export class TransactionModule {}
