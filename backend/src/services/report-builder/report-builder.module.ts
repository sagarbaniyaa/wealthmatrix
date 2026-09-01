import { Module } from '@nestjs/common';
import { ReportTemplateModule } from '../../modules/report-template/report-template.module';
import { HouseholdModule } from '../../modules/household/household.module';
import { FactFindModule } from '../../modules/fact-find/fact-find.module';
import { WealthConsolidationModule } from '../wealth-consolidation/wealth-consolidation.module';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';

import { ReportBuilderService } from './report-builder.service';
import { ReportCaseController } from '../../modules/report-case/report-case.controller';

@Module({
  imports: [ReportTemplateModule, HouseholdModule, FactFindModule, WealthConsolidationModule],
  // ClaudeClientService provided fresh here — same reasoning as
  // FundResearchModule/SuitabilityReportModule: stateless, safe to
  // re-instantiate rather than needing WealthAnalystModule to export it.
  providers: [ReportBuilderService, ClaudeClientService],
  controllers: [ReportCaseController],
  exports: [ReportBuilderService],
})
export class ReportBuilderModule {}
