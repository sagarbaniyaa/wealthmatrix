import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { RetirementCashflowService } from './retirement-cashflow.service';
import { RetirementCashflowController } from '../../modules/retirement-cashflow/retirement-cashflow.controller';

@Module({
  imports: [HouseholdModule],
  providers: [RetirementCashflowService, ClaudeClientService],
  controllers: [RetirementCashflowController],
  exports: [RetirementCashflowService],
})
export class RetirementCashflowModule {}
