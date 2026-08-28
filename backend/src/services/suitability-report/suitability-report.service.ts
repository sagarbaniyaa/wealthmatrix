import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { HouseholdEntity, FactFindEntity } from '../../database/entities';
import { WealthConsolidationService } from '../wealth-consolidation/wealth-consolidation.service';
import { WealthAnalystService } from '../wealth-analyst/wealth-analyst.service';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { FundSuitabilityService } from '../fund-research/fund-suitability.service';
import { FactFindService } from '../fact-find/fact-find.service';

export interface SuitabilityReportContext {
  household: { id: string; name: string };
  factFind: FactFindEntity | null;
  netWorth: Awaited<ReturnType<WealthConsolidationService['getHouseholdNetWorth']>> | null;
  riskMetrics: Awaited<ReturnType<WealthAnalystService['computeHouseholdRiskMetrics']>> | null;
  suitableFunds: Awaited<ReturnType<FundSuitabilityService['suitableFundsForHousehold']>> | null;
}

export interface SuitabilityReportResult {
  context: SuitabilityReportContext;
  narrative: string | null;
  narrativeError: string | null;
}

/**
 * Assembles a Suitability Report the way UK retail advice actually
 * requires one (COBS 9A-style): client circumstances + objectives (from
 * the fact find) set against the recommendation's cost/risk profile and
 * the client's capacity for loss (from the platform's own risk engine) —
 * the AI only ever narrates numbers that were already computed
 * deterministically elsewhere in this codebase, same discipline as
 * WealthAnalystService and FundAiService.
 */
@Injectable()
export class SuitabilityReportService {
  private readonly logger = new Logger(SuitabilityReportService.name);

  constructor(
    private readonly factFinds: FactFindService,
    private readonly wealthConsolidation: WealthConsolidationService,
    private readonly wealthAnalyst: WealthAnalystService,
    private readonly fundSuitability: FundSuitabilityService,
    private readonly claude: ClaudeClientService,
  ) {}

  async buildContext(householdId: string): Promise<SuitabilityReportContext> {
    const household = await TenantContext.getManager().getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);

    const factFind = await this.factFinds.findLatestCompleted(householdId);

    const netWorth = await this.wealthConsolidation.getHouseholdNetWorth(householdId).catch((err) => {
      this.logger.warn(`Net worth unavailable for suitability report ${householdId}: ${err}`);
      return null;
    });
    const riskMetrics = await this.wealthAnalyst.computeHouseholdRiskMetrics(householdId).catch((err) => {
      this.logger.warn(`Risk metrics unavailable for suitability report ${householdId}: ${err}`);
      return null;
    });
    const suitableFunds = await this.fundSuitability.suitableFundsForHousehold(householdId).catch((err) => {
      this.logger.warn(`Fund suitability unavailable for suitability report ${householdId}: ${err}`);
      return null;
    });

    return { household: { id: household.id, name: household.name }, factFind, netWorth, riskMetrics, suitableFunds };
  }

  async generateReport(householdId: string): Promise<SuitabilityReportResult> {
    const context = await this.buildContext(householdId);

    if (!context.factFind) {
      return {
        context,
        narrative: null,
        narrativeError: 'No completed fact find for this household yet — complete one before generating a suitability report.',
      };
    }

    // Strip the raw ATR question/answer array and JSONB odds and ends
    // down to what the narrative actually needs — keeps the prompt
    // focused and avoids feeding walls of UI-only data to the model.
    const factFindSummary = summariseFactFind(context.factFind);

    try {
      const narrative = await this.claude.complete({
        system:
          'You are an AI Suitability Analyst for a UK financial advice platform. You are given a ' +
          'client\'s fact-find summary (objectives, risk profile, income/expenditure, assets, ' +
          'liabilities) plus pre-computed net worth and risk metrics for their household, and a ' +
          'pre-filtered shortlist of funds matching their recorded risk tolerance. Do not invent, ' +
          'estimate, or adjust any figure you are given. Write a formal suitability report narrative ' +
          'in these sections, each with a short heading: "Client circumstances and objectives" ' +
          '(summarise, do not just repeat verbatim), "Risk profile and capacity for loss" (relate the ' +
          'stated ATR category to the household\'s actual risk metrics), "Suitability assessment" ' +
          '(whether the shortlisted funds/allocation align with the stated objectives and risk profile, ' +
          'and any mismatch to flag), and "Next steps". 300-450 words total. This is a working draft for ' +
          'the adviser to review and edit — it is not independent financial advice and must not present ' +
          'itself as a final recommendation.',
        user: JSON.stringify({
          household: context.household,
          factFind: factFindSummary,
          netWorth: context.netWorth,
          riskMetrics: context.riskMetrics
            ? Object.fromEntries(Object.entries(context.riskMetrics).filter(([k]) => k !== 'aiError' && k !== 'notes'))
            : null,
          suitableFunds: context.suitableFunds,
        }, null, 2),
        maxTokens: 1200,
      });
      return { context, narrative, narrativeError: null };
    } catch (err: any) {
      this.logger.warn(`Suitability narrative unavailable for ${householdId}: ${err?.message ?? err}`);
      return { context, narrative: null, narrativeError: err?.message ?? 'AI narrative is currently unavailable.' };
    }
  }
}

function summariseFactFind(factFind: FactFindEntity) {
  return {
    status: factFind.status,
    completedOn: factFind.completedOn,
    reviewPurposes: factFind.reviewPurposes,
    riskScore: factFind.riskScore,
    riskCategory: factFind.riskCategory,
    riskCapacity: factFind.riskCapacity,
    incomeExpenditure: factFind.incomeExpenditure,
    assets: factFind.assets,
    liabilities: factFind.liabilities,
    investmentQuestions: factFind.investmentQuestions,
    retirementQuestions: factFind.retirementQuestions,
  };
}
