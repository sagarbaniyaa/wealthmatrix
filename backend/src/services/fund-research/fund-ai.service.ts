import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { FundService } from '../../modules/fund/fund.service';
import { FundComparisonService } from './fund-comparison.service';
import { FundSuitabilityService } from './fund-suitability.service';
import { TenantContext } from '../../common/database/tenant-context';
import { FundPerformanceEntity } from '../../database/entities';

/**
 * AI Fund Analyst — same shape as WealthAnalystService: every number
 * shown to the adviser is computed deterministically first (fund
 * attributes, performance rows, suitability matches); Claude only ever
 * narrates what's already been computed, and every call is wrapped so a
 * billing/availability failure degrades to a plain error string rather
 * than failing the whole request.
 */
@Injectable()
export class FundAiService {
  private readonly logger = new Logger(FundAiService.name);

  constructor(
    private readonly funds: FundService,
    private readonly comparison: FundComparisonService,
    private readonly suitability: FundSuitabilityService,
    private readonly claude: ClaudeClientService,
  ) {}

  async fundSummary(fundId: string): Promise<{ fundId: string; summary: string | null; error: string | null }> {
    const [fund] = await this.funds.findOneOrFailByIdList([fundId]);
    const performance = await TenantContext.getManager()
      .getRepository(FundPerformanceEntity).find({ where: { fundId } as any });

    try {
      const summary = await this.claude.complete({
        system:
          'You are an AI Fund Analyst. You are given structured data for one fund — do not invent, ' +
          'estimate, or adjust any figure in it. Write a concise adviser-facing summary (100-150 words): ' +
          'what the fund is, its cost/risk profile, and how its performance figures (if given) look in ' +
          'context. Do not give personalised investment advice or a buy/sell recommendation — this is a ' +
          'factual summary for the adviser to use in their own suitability assessment.',
        user: JSON.stringify({ fund, performance }, null, 2),
        maxTokens: 400,
      });
      return { fundId, summary, error: null };
    } catch (err: any) {
      this.logger.warn(`Fund summary unavailable for ${fundId}: ${err?.message ?? err}`);
      return { fundId, summary: null, error: err?.message ?? 'AI summary is currently unavailable.' };
    }
  }

  async fundComparisonSummary(fundIds: string[]): Promise<{ comparison: Awaited<ReturnType<FundComparisonService['compare']>>; summary: string | null; error: string | null }> {
    const comparison = await this.comparison.compare(fundIds);

    try {
      const summary = await this.claude.complete({
        system:
          'You are an AI Fund Analyst. You are given pre-computed data for 2-5 funds being compared ' +
          'side by side — do not invent or adjust any figure. Write a plain-English comparison (120-200 ' +
          'words) covering cost, risk, and asset allocation differences, naming funds by their actual ' +
          'name. Do not recommend one over another — describe the trade-offs and flag what the adviser ' +
          'should weigh up given their client\'s circumstances.',
        user: JSON.stringify(comparison, null, 2),
        maxTokens: 500,
      });
      return { comparison, summary, error: null };
    } catch (err: any) {
      this.logger.warn(`Fund comparison summary unavailable: ${err?.message ?? err}`);
      return { comparison, summary: null, error: err?.message ?? 'AI summary is currently unavailable.' };
    }
  }

  async fundSuitabilityNotes(householdId: string): Promise<{ result: Awaited<ReturnType<FundSuitabilityService['suitableFundsForHousehold']>>; notes: string | null; error: string | null }> {
    const result = await this.suitability.suitableFundsForHousehold(householdId);
    if (!result.riskTolerance) {
      return { result, notes: null, error: 'No risk tolerance is recorded for this household\'s primary contact yet — set it on their profile first.' };
    }

    try {
      const notes = await this.claude.complete({
        system:
          'You are an AI Fund Analyst. You are given a household\'s declared risk tolerance and a ' +
          'pre-filtered list of funds whose risk_rating already matches that tolerance band (the ' +
          'filtering is already correct — do not second-guess or recompute it). Write a short adviser ' +
          'note (80-140 words) on how to use this shortlist: what to still check per fund (cost, ' +
          'liquidity, concentration) before recommending anything, and that this is a starting shortlist, ' +
          'not personalised investment advice.',
        user: JSON.stringify(result, null, 2),
        maxTokens: 350,
      });
      return { result, notes, error: null };
    } catch (err: any) {
      this.logger.warn(`Fund suitability notes unavailable for ${householdId}: ${err?.message ?? err}`);
      return { result, notes: null, error: err?.message ?? 'AI notes are currently unavailable.' };
    }
  }
}
