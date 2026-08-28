import { Module } from '@nestjs/common';
import { FundService } from '../../modules/fund/fund.service';
import { FundScreenerService } from './fund-screener.service';
import { FundComparisonService } from './fund-comparison.service';
import { FundSuitabilityService } from './fund-suitability.service';
import { FundAnalyticsService } from './fund-analytics.service';
import { FundImportService } from './fund-import.service';
import { FundAiService } from './fund-ai.service';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';

// Groups the fund-research services that sit above plain fund CRUD:
// screener, comparison, suitability, the fund-switch impact tool, CSV
// ingestion, and the AI layer. FundService is provided again here
// (harmless — it's stateless, resolving everything via TenantContext at
// call time, not constructor injection) rather than importing FundModule,
// to avoid a circular import between the two modules.
@Module({
  providers: [
    FundService,
    FundScreenerService,
    FundComparisonService,
    FundSuitabilityService,
    FundAnalyticsService,
    FundImportService,
    FundAiService,
    ClaudeClientService,
  ],
  exports: [
    FundScreenerService,
    FundComparisonService,
    FundSuitabilityService,
    FundAnalyticsService,
    FundImportService,
    FundAiService,
  ],
})
export class FundResearchModule {}
