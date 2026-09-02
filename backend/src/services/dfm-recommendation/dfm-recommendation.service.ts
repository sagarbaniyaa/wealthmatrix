import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  DfmRecommendationEntity, DfmInputs, FundCategoryWeight, FactFindEntity, HouseholdMemberEntity, PersonEntity,
} from '../../database/entities';
import { RiskCategory } from '../fact-find/risk-questionnaire.constants';
import { FactFindService } from '../fact-find/fact-find.service';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';
import { RISK_MANDATES, GROWTH_CATEGORIES, DEFENSIVE_CATEGORIES } from './dfm-mandate.constants';

const TOLERANCE_TO_RISK_CATEGORY: Record<string, RiskCategory> = {
  conservative: 'conservative',
  moderate: 'balanced',
  aggressive: 'aggressive',
};

export interface DfmComputeResult {
  inputs: DfmInputs;
  mandate: string;
  riskAlignment: string | null;
  reasoning: string[];
  indicativeFeeRange: string | null;
  fundCategories: FundCategoryWeight[];
  gaps: string[];
}

/**
 * Deterministic DFM mandate + fund-category recommendation. See
 * migration 011 / dfm-mandate.constants.ts for why this never names a
 * real DFM firm. `compute()` is pure and side-effect free (used for a
 * live preview); `create()` additionally persists the row and asks
 * Claude for a polished suitability paragraph — same
 * compute-then-narrate-with-graceful-fallback shape as
 * ChargeProjectionService.
 */
@Injectable()
export class DfmRecommendationService {
  private readonly logger = new Logger(DfmRecommendationService.name);

  constructor(
    private readonly factFinds: FactFindService,
    private readonly claude: ClaudeClientService,
  ) {}

  private get repo() {
    return TenantContext.getManager().getRepository(DfmRecommendationEntity);
  }

  async listForHousehold(householdId: string): Promise<DfmRecommendationEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async findOneOrFail(id: string): Promise<DfmRecommendationEntity> {
    const row = await this.repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`DFM recommendation ${id} not found`);
    return row;
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOneOrFail(id);
    await this.repo.remove(row);
  }

  async compute(householdId: string): Promise<DfmComputeResult> {
    const manager = TenantContext.getManager();
    const gaps: string[] = [];

    const factFinds = await this.factFinds.listForHousehold(householdId);
    const factFind = factFinds.find((f) => f.status === 'completed') ?? factFinds[0] ?? null;
    if (!factFind) gaps.push('No Fact Find on file — every input below is a best-effort default.');
    else if (factFind.status !== 'completed') gaps.push('Using a draft (not yet completed) Fact Find — treat this as provisional.');

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    const primaryPerson = primaryMember
      ? await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any })
      : null;

    const riskCategory = this.resolveRiskCategory(factFind, primaryPerson, gaps);
    const objectives = this.resolveObjectives(factFind, gaps);
    const { years: timeHorizonYears, source: timeHorizonSource } = this.resolveTimeHorizon(factFind, primaryPerson, gaps);
    const liquidityNeed = this.resolveLiquidityNeed(factFind, gaps);
    const investmentQuestions = (factFind?.investmentQuestions ?? {}) as Record<string, any>;
    const prefersPassive = typeof investmentQuestions.prefersPassive === 'boolean' ? investmentQuestions.prefersPassive : null;
    const prefersActive = typeof investmentQuestions.prefersActive === 'boolean' ? investmentQuestions.prefersActive : null;

    const inputs: DfmInputs = {
      riskCategory, objectives, timeHorizonYears, timeHorizonSource, liquidityNeed, prefersPassive, prefersActive,
    };

    if (!riskCategory) {
      gaps.push('No risk category available — complete a Fact Find (or record the client\'s risk tolerance) before generating a mandate.');
      return { inputs, mandate: 'Not enough data', riskAlignment: null, reasoning: [], indicativeFeeRange: null, fundCategories: [], gaps };
    }

    const base = RISK_MANDATES[riskCategory];
    let categories = base.baseCategories.map((c) => ({ ...c }));
    const reasoning: string[] = [
      `Risk category "${riskCategory.replace(/_/g, ' ')}" maps to the ${base.mandate}.`,
    ];

    if (liquidityNeed === 'high') {
      categories = shiftWeight(categories, GROWTH_CATEGORIES, DEFENSIVE_CATEGORIES, 15);
      reasoning.push('Shifted ~15% from growth assets into cash/short-duration bonds — a high stated liquidity need (money needed within a few years) takes priority over the base risk-band allocation.');
    } else if (liquidityNeed === 'medium') {
      categories = shiftWeight(categories, GROWTH_CATEGORIES, DEFENSIVE_CATEGORIES, 5);
      reasoning.push('Shifted a modest ~5% toward cash/short-duration bonds for a medium-term stated liquidity need.');
    }

    if (prefersPassive && !prefersActive) {
      categories = shiftWeight(categories, ['Diversified Growth', 'Alternatives'], ['Index Funds'], 10);
      reasoning.push('Client stated a preference for passive investing — shifted allocation toward Index Funds.');
    } else if (prefersActive && !prefersPassive) {
      categories = shiftWeight(categories, ['Index Funds'], ['Diversified Growth'], 10);
      reasoning.push('Client stated a preference for active management — shifted allocation away from Index Funds toward actively-managed categories.');
    }

    if (timeHorizonYears !== null) {
      reasoning.push(`Time horizon: ~${timeHorizonYears} years (${timeHorizonSource}).`);
    } else {
      reasoning.push('Time horizon not stated in the Fact Find — the allocation above does not adjust for it.');
    }

    if (objectives.length) {
      reasoning.push(`Stated objectives: ${objectives.join(', ')}.`);
    }

    return {
      inputs,
      mandate: base.mandate,
      riskAlignment: `Aligned to a "${riskCategory.replace(/_/g, ' ')}" attitude to risk.`,
      reasoning,
      indicativeFeeRange: `${base.feeRange} — indicative only; confirm actual terms with the selected DFM.`,
      fundCategories: normalizeWeights(categories),
      gaps,
    };
  }

  async create(householdId: string, createdBy: string): Promise<DfmRecommendationEntity> {
    const result = await this.compute(householdId);

    const row = this.repo.create({
      firmId: TenantContext.getFirmId(),
      householdId,
      inputs: result.inputs,
      mandate: result.mandate,
      riskAlignment: result.riskAlignment,
      reasoning: result.reasoning,
      indicativeFeeRange: result.indicativeFeeRange,
      fundCategories: result.fundCategories,
      gaps: result.gaps,
      createdBy,
    });

    if (result.fundCategories.length > 0) {
      try {
        row.aiNarrative = await this.claude.complete({
          system:
            'You are a UK financial adviser\'s drafting assistant. You are given a deterministically-computed ' +
            'DFM mandate and fund category allocation for a client. Write ONE short suitability-report paragraph ' +
            '(3-5 sentences) explaining why this mandate and allocation are suitable, in professional UK adviser ' +
            'language. Use ONLY the figures and reasoning given to you — never invent a number, fund category, ' +
            'or fact not present in the input.',
          user: JSON.stringify(result, null, 2),
          maxTokens: 400,
        });
      } catch (err: any) {
        this.logger.warn(`DFM narrative generation failed for household ${householdId}: ${err?.message ?? err}`);
        row.aiNarrativeError = err?.message ?? 'AI narrative is currently unavailable.';
      }
    }

    return this.repo.save(row);
  }

  private resolveRiskCategory(factFind: FactFindEntity | null, person: PersonEntity | null, gaps: string[]): RiskCategory | null {
    if (factFind?.riskCategory) return factFind.riskCategory as RiskCategory;
    if (person?.riskTolerance && TOLERANCE_TO_RISK_CATEGORY[person.riskTolerance]) {
      gaps.push('No ATR questionnaire score on the Fact Find — used the client\'s recorded risk tolerance instead (a coarser 3-band estimate).');
      return TOLERANCE_TO_RISK_CATEGORY[person.riskTolerance];
    }
    return null;
  }

  private resolveObjectives(factFind: FactFindEntity | null, gaps: string[]): string[] {
    const objectives: string[] = [];
    const reviewPurposes = (factFind?.reviewPurposes ?? {}) as Record<string, any>;
    if (Array.isArray(reviewPurposes.selected)) objectives.push(...reviewPurposes.selected);
    const investmentQuestions = (factFind?.investmentQuestions ?? {}) as Record<string, any>;
    if (investmentQuestions.investmentObjectives) objectives.push(String(investmentQuestions.investmentObjectives));
    const retirementQuestions = (factFind?.retirementQuestions ?? {}) as Record<string, any>;
    if (retirementQuestions.pensionIntention) objectives.push(String(retirementQuestions.pensionIntention));
    if (objectives.length === 0) gaps.push('No stated objectives found on the Fact Find.');
    return objectives;
  }

  private resolveTimeHorizon(factFind: FactFindEntity | null, person: PersonEntity | null, gaps: string[]): { years: number | null; source: string } {
    const retirementQuestions = (factFind?.retirementQuestions ?? {}) as Record<string, any>;
    const stated = String(retirementQuestions.pensionIntention ?? '');
    const ageMatch = stated.match(/\b(retir\w*\s+at\s+)?(\d{2})\b/i);
    if (ageMatch && person?.dateOfBirth) {
      const targetAge = parseInt(ageMatch[2], 10);
      if (targetAge >= 45 && targetAge <= 80) {
        const age = ageFromDob(person.dateOfBirth);
        if (age !== null) {
          const years = targetAge - age;
          if (years > 0) return { years, source: `stated retirement age ${targetAge}, current age ~${age}` };
        }
      }
    }
    gaps.push('No usable time horizon stated in the Fact Find — the allocation does not adjust for horizon.');
    return { years: null, source: 'not stated' };
  }

  private resolveLiquidityNeed(factFind: FactFindEntity | null, gaps: string[]): DfmInputs['liquidityNeed'] {
    const riskCapacity = (factFind?.riskCapacity ?? {}) as Record<string, any>;
    const stated = String(riskCapacity.withdrawalHorizon ?? '');
    const yearsMatch = stated.match(/(\d+)/);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1], 10);
      if (years <= 4) return 'high';
      if (years <= 10) return 'medium';
      return 'low';
    }
    gaps.push('No withdrawal horizon stated in the Fact Find\'s risk capacity section — liquidity need treated as not stated.');
    return 'not stated';
  }
}

function ageFromDob(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

/** Moves `amount` percentage points from `from` categories into `to` categories, proportionally within each group. Adds a `to` category at 0 first if it isn't already present. */
function shiftWeight(categories: FundCategoryWeight[], from: string[], to: string[], amount: number): FundCategoryWeight[] {
  const working = categories.map((c) => ({ ...c }));
  const fromTotal = working.filter((c) => from.includes(c.category)).reduce((sum, c) => sum + c.weightPct, 0);
  if (fromTotal <= 0) return working;

  const actualShift = Math.min(amount, fromTotal);
  working.forEach((c) => {
    if (from.includes(c.category)) {
      c.weightPct -= actualShift * (c.weightPct / fromTotal);
    }
  });

  to.forEach((cat) => {
    if (!working.some((c) => c.category === cat)) working.push({ category: cat, weightPct: 0 });
  });
  const toCount = to.length;
  working.forEach((c) => {
    if (to.includes(c.category)) c.weightPct += actualShift / toCount;
  });

  return working.filter((c) => c.weightPct > 0.01);
}

/** Rounds every weight to the nearest whole percent and corrects rounding drift on the largest bucket so the total is exactly 100. */
function normalizeWeights(categories: FundCategoryWeight[]): FundCategoryWeight[] {
  const rounded = categories.map((c) => ({ category: c.category, weightPct: Math.round(c.weightPct) })).filter((c) => c.weightPct > 0);
  const total = rounded.reduce((sum, c) => sum + c.weightPct, 0);
  const drift = 100 - total;
  if (drift !== 0 && rounded.length > 0) {
    const largest = rounded.reduce((max, c) => (c.weightPct > max.weightPct ? c : max), rounded[0]);
    largest.weightPct += drift;
  }
  return rounded.sort((a, b) => b.weightPct - a.weightPct);
}
