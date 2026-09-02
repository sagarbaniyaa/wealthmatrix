import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { ConsumerDutyService } from './consumer-duty.service';
import { ConsumerDutyController } from '../../modules/consumer-duty/consumer-duty.controller';
import { ConsumerDutyReviewController } from '../../modules/consumer-duty/consumer-duty-review.controller';

@Module({
  imports: [HouseholdModule],
  providers: [ConsumerDutyService],
  controllers: [ConsumerDutyController, ConsumerDutyReviewController],
  exports: [ConsumerDutyService],
})
export class ConsumerDutyModule {}
