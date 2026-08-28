import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { WealthAnalystModule } from '../services/wealth-analyst/wealth-analyst.module';
import { FundResearchModule } from '../services/fund-research/fund-research.module';
import { SuitabilityReportModule } from '../services/suitability-report/suitability-report.module';

@Module({
  imports: [WealthAnalystModule, FundResearchModule, SuitabilityReportModule],
  controllers: [AiController],
})
export class AiModule {}
