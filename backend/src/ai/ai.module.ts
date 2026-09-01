import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { WealthAnalystModule } from '../services/wealth-analyst/wealth-analyst.module';
import { FundResearchModule } from '../services/fund-research/fund-research.module';
import { SuitabilityReportModule } from '../services/suitability-report/suitability-report.module';
import { FactFindModule } from '../modules/fact-find/fact-find.module';

@Module({
  imports: [WealthAnalystModule, FundResearchModule, SuitabilityReportModule, FactFindModule],
  controllers: [AiController],
})
export class AiModule {}
