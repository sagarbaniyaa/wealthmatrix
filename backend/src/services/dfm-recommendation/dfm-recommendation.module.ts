import { Module } from '@nestjs/common';
import { HouseholdModule } from '../../modules/household/household.module';
import { FactFindModule } from '../../modules/fact-find/fact-find.module';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { DfmRecommendationService } from './dfm-recommendation.service';
import { DfmRecommendationController } from '../../modules/dfm-recommendation/dfm-recommendation.controller';

@Module({
  imports: [HouseholdModule, FactFindModule],
  providers: [DfmRecommendationService, ClaudeClientService],
  controllers: [DfmRecommendationController],
  exports: [DfmRecommendationService],
})
export class DfmRecommendationModule {}
