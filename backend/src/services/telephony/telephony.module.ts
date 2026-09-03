import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { ComplianceLogModule } from '../../modules/compliance-log/compliance-log.module';
import { TelephonyService } from './telephony.service';
import { TelephonyController } from '../../modules/telephony/telephony.controller';
import { TelephonyWebhookController } from '../../modules/telephony/telephony-webhook.controller';

@Module({
  imports: [HouseholdModule, ComplianceLogModule],
  providers: [TelephonyService],
  controllers: [TelephonyController, TelephonyWebhookController],
  exports: [TelephonyService],
})
export class TelephonyModule {}
