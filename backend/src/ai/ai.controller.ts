import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { WealthAnalystService } from '../services/wealth-analyst/wealth-analyst.service';
import { FundAiService } from '../services/fund-research/fund-ai.service';
import { CompareFundsDto } from '../modules/fund/dto/compare-funds.dto';
import { SuitabilityReportService } from '../services/suitability-report/suitability-report.service';
import { FactFindParserService } from '../services/fact-find/fact-find-parser.service';
import { ParseFactFindNotesDto } from './dto/parse-fact-find-notes.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('AI')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly analyst: WealthAnalystService,
    private readonly fundAnalyst: FundAiService,
    private readonly suitabilityReport: SuitabilityReportService,
    private readonly factFindParser: FactFindParserService,
  ) {}

  @Post('insights/:householdId')
  @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  insights(@Param('householdId') householdId: string) {
    return this.analyst.generateInsights(householdId);
  }

  @Post('risk-metrics/:householdId')
  @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  riskMetrics(@Param('householdId') householdId: string) {
    return this.analyst.computeHouseholdRiskMetrics(householdId);
  }

  // Rule-based breach detection (leverage/concentration thresholds) — no
  // Claude call, lives here only because WealthAnalystService already
  // holds the shared metrics math and the compliance-log module can't
  // depend back on it without a circular import.
  @Post('compliance-scan')
  @Roles(Role.ADMIN, Role.ADVISER)
  complianceScan() {
    return this.analyst.scanForBreaches();
  }

  @Post('scenario-explain/:scenarioId')
  @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  scenarioExplain(@Param('scenarioId') scenarioId: string) {
    return this.analyst.explainScenario(scenarioId);
  }

  @Post('query/:householdId')
  @Roles(Role.ADMIN, Role.ADVISER, Role.CLIENT)
  query(@Param('householdId') householdId: string, @Body('question') question: string) {
    return this.analyst.answerQuery(householdId, question);
  }

  // AI Fund Analyst — adviser/admin only, same as the rest of fund research.
  @Post('fund-summary/:fundId')
  @Roles(Role.ADMIN, Role.ADVISER)
  fundSummary(@Param('fundId') fundId: string) {
    return this.fundAnalyst.fundSummary(fundId);
  }

  @Post('fund-comparison')
  @Roles(Role.ADMIN, Role.ADVISER)
  fundComparison(@Body() dto: CompareFundsDto) {
    return this.fundAnalyst.fundComparisonSummary(dto.fundIds);
  }

  @Post('fund-suitability/:householdId')
  @Roles(Role.ADMIN, Role.ADVISER)
  fundSuitability(@Param('householdId') householdId: string) {
    return this.fundAnalyst.fundSuitabilityNotes(householdId);
  }

  @Post('suitability-report/:householdId')
  @Roles(Role.ADMIN, Role.ADVISER)
  suitabilityReportFor(@Param('householdId') householdId: string) {
    return this.suitabilityReport.generateReport(householdId);
  }

  // Meeting-to-Fact-Find: no householdId needed — this is a stateless
  // text-to-structured-data extraction, not tied to any stored record.
  @Post('fact-find-parse')
  @Roles(Role.ADMIN, Role.ADVISER)
  parseFactFindNotes(@Body() dto: ParseFactFindNotesDto) {
    return this.factFindParser.parse(dto.notes);
  }
}
