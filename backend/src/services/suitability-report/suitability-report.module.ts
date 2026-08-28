import { Module } from '@nestjs/common';
import { SuitabilityReportService } from './suitability-report.service';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { FactFindModule } from '../../modules/fact-find/fact-find.module';
import { WealthConsolidationModule } from '../wealth-consolidation/wealth-consolidation.module';
import { WealthAnalystModule } from '../wealth-analyst/wealth-analyst.module';
import { FundResearchModule } from '../fund-research/fund-research.module';

@Module({
  imports: [FactFindModule, WealthConsolidationModule, WealthAnalystModule, FundResearchModule],
  // ClaudeClientService is provided fresh here (not imported) — same
  // reasoning as FundResearchModule: it's stateless (just wraps
  // ConfigService + fetch), so a second instance is safe and avoids
  // needing WealthAnalystModule to export it just for this one caller.
  providers: [SuitabilityReportService, ClaudeClientService],
  exports: [SuitabilityReportService],
})
export class SuitabilityReportModule {}
