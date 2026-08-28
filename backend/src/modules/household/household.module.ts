import { Module } from '@nestjs/common';
import { HouseholdService } from './household.service';
import { HouseholdController } from './household.controller';
import { WealthConsolidationModule } from '../../services/wealth-consolidation/wealth-consolidation.module';

@Module({
  imports: [WealthConsolidationModule],
  providers: [HouseholdService],
  controllers: [HouseholdController],
  exports: [HouseholdService],
})
export class HouseholdModule {}
