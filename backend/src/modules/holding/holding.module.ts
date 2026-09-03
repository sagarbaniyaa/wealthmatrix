import { Module } from '@nestjs/common';
import { HoldingService } from './holding.service';
import { HoldingController } from './holding.controller';
import { HouseholdModule } from '../household/household.module';

@Module({ imports: [HouseholdModule], providers: [HoldingService], controllers: [HoldingController], exports: [HoldingService] })
export class HoldingModule {}
