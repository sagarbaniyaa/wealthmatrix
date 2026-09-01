import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { ChargeProjectionService } from './charge-projection.service';
import { ChargeProjectionController } from '../../modules/charge-projection/charge-projection.controller';

@Module({
  imports: [HouseholdModule],
  providers: [ChargeProjectionService, ClaudeClientService],
  controllers: [ChargeProjectionController],
  exports: [ChargeProjectionService],
})
export class ChargeProjectionModule {}
