import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { HouseholdJourneyService } from './household-journey.service';
import { HouseholdJourneyController } from '../../modules/household-journey/household-journey.controller';

@Module({
  imports: [HouseholdModule],
  providers: [HouseholdJourneyService],
  controllers: [HouseholdJourneyController],
  exports: [HouseholdJourneyService],
})
export class HouseholdJourneyModule {}
