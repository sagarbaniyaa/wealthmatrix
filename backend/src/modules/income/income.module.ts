import { Module } from '@nestjs/common';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [IncomeService], controllers: [IncomeController], exports: [IncomeService] })
export class IncomeModule {}
