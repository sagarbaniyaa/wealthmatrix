import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [AccountService], controllers: [AccountController], exports: [AccountService] })
export class AccountModule {}
