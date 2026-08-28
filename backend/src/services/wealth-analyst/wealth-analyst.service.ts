import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { TenantContext } from '../../common/database/tenant-context';
import {
  AccountEntity, AssetEntity, CurrencyEntity, HoldingEntity, ScenarioEntity,
  HouseholdMemberEntity, HouseholdEntity, FirmEntity, PersonEntity, ComplianceLogEntity,
} from '../../database/entities';
import { WealthConsolidationService } from '../wealth-consolidation/wealth-consolidation.service';
import { EntityStructureService } from '../entity-structure/entity-structure.service';
import { ComplianceLogService } from '../../modules/compliance-log/compliance-log.service';
import { ClaudeClientService } from './claude-client.service';
import {
  EntityRiskProfile, HouseholdRiskContext, QueryFilterSpec,
  HouseholdRiskMetrics, RiskMetric, RiskColor, WeightedPosition,
} from './wealth-analyst.types';

// Growth/risk-bearing asset classes, used only for the suitability-drift
// heuristic below — everything else (cash, fixed income, pensions, debt
// instruments) counts as the "defensive" side of the allocation.
const GROWTH_ASSET_CLASSES = new Set(['equity_public', 'equity_private', 'private_equity_fund']);
const LIQUID_ASSET_CLASSES = new Set(['cash']);

// Suitability bands: expected growth-allocation range per declared risk
// tolerance. Deliberately simple (this is a triage signal for the adviser,
// not a full IPS/suitability engine).
const SUITABILITY_BANDS: Record<string, [number, number]> = {
  conservative: [0, 30],
  moderate: [30, 60],
  aggressive: [60, 100],
};

@Injectable()
export class WealthAnalystService {
  private readonly logger = new Logger(WealthAnalystService.name);

  constructor(
    private readonly consolidation: WealthConsolidationService,
    private readonly structure: EntityStructureService,
    private readonly complianceLog: ComplianceLogService,
    private readonly claude: ClaudeClientService,
  ) {}

  /**
   * The five-metric insights panel: leverage, concentration, liquidity,
   * currency exposure, and suitability drift — computed household-wide
   * (personal holdings at 100% + each entity's holdings weighted by the
   * household's effective ownership %), each colour-coded, each with a
   * short AI note. The maths never depends on Claude; if the API call
   * fails (e.g. no billing credit) the metrics still return with
   * `aiError` set and every `note` left null, rather than failing the
   * whole request.
   */
  async computeHouseholdRiskMetrics(householdId: string, asOfDate?: string): Promise<HouseholdRiskMetrics> {
    const date = asOfDate ?? new Date().toISOString().slice(0, 10);
    const raw = await this.computeRawMetrics(householdId, date);
    const {
      household, baseCurrencyCode, totalGrossAssets, totalGrossLiabilities,
      leveragePct, concentrationPct, liquidityPct, foreignExposurePct,
      growthAllocationPct, primaryPerson, driftPct, band,
    } = raw;

    let notes: Record<string, string> | null = null;
    let aiError: string | null = null;
    try {
      notes = await this.claude.completeJSON<Record<string, string>>({
        system:
          'You are an AI Wealth Analyst for a UHNI family office platform. You are given ' +
          'five pre-computed risk metrics for one household — percentages you must not ' +
          'recalculate, invent, or adjust. For each of the five keys (leverage, concentration, ' +
          'liquidity, currencyExposure, suitabilityDrift) write ONE short sentence (max 25 ' +
          'words) naming the household and citing the metric\'s actual figure(s) from the ' +
          'input, e.g. "Sterling Family carries high concentration risk with 47% of assets in ' +
          'a single equity position." If a metric value is null, say there is not enough data. ' +
          'Respond with ONLY a JSON object {"leverage":"...","concentration":"...",' +
          '"liquidity":"...","currencyExposure":"...","suitabilityDrift":"..."} — no markdown, no prose outside it.',
        user: JSON.stringify({
          householdName: household.name,
          baseCurrencyCode,
          totalGrossAssets,
          totalGrossLiabilities,
          metrics: {
            leverageRatioPct: leveragePct,
            concentrationPct,
            liquidityRatioPct: liquidityPct,
            foreignCurrencyExposurePct: foreignExposurePct,
            growthAllocationPct,
            riskTolerance: primaryPerson?.riskTolerance ?? null,
            suitabilityBand: band,
            suitabilityDriftPct: driftPct,
          },
        }, null, 2),
        maxTokens: 500,
      });
    } catch (err: any) {
      this.logger.warn(`AI notes unavailable for household ${householdId}: ${err?.message ?? err}`);
      aiError = err?.message ?? 'AI notes are currently unavailable.';
    }

    return {
      householdId,
      asOfDate: date,
      totalGrossAssets,
      totalGrossLiabilities,
      leverage: buildMetric(leveragePct, thresholds(leveragePct, 30, 60, 'higher-worse'), 'Leverage risk', notes?.leverage ?? null),
      concentration: buildMetric(concentrationPct, thresholds(concentrationPct, 25, 50, 'higher-worse'), 'Concentration risk', notes?.concentration ?? null),
      liquidity: buildMetric(liquidityPct, thresholds(liquidityPct, 10, 20, 'higher-better'), 'Liquidity ratio', notes?.liquidity ?? null),
      currencyExposure: buildMetric(foreignExposurePct, thresholds(foreignExposurePct, 20, 40, 'higher-worse'), 'Currency exposure', notes?.currencyExposure ?? null),
      suitabilityDrift: buildMetric(driftPct, thresholds(driftPct, 10, 30, 'higher-worse'), 'Suitability drift', notes?.suitabilityDrift ?? null),
      aiError,
    };
  }

  /** The pure-maths half of computeHouseholdRiskMetrics — no Claude call, safe to run for every household on every compliance scan. */
  private async computeRawMetrics(householdId: string, date: string) {
    const manager = TenantContext.getManager();

    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);
    const firm = await manager.getRepository(FirmEntity).findOne({ where: { id: household.firmId } as any });
    const baseCurrency = firm?.baseCurrencyId
      ? await manager.getRepository(CurrencyEntity).findOne({ where: { id: firm.baseCurrencyId } as any })
      : null;
    const baseCurrencyCode = baseCurrency?.code ?? 'GBP';

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const personIds = members.map((m) => m.personId);
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    const primaryPerson = primaryMember
      ? await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any })
      : null;

    const positions: WeightedPosition[] = [];
    for (const personId of personIds) {
      const accounts = await manager.getRepository(AccountEntity).find({ where: { ownerPersonId: personId } as any });
      positions.push(...(await this.getAccountPositions(accounts, date, 1)));
    }

    const netWorth = await this.consolidation.getHouseholdNetWorth(householdId, date);
    for (const attribution of netWorth.entityBreakdown) {
      const accounts = await manager.getRepository(AccountEntity).find({ where: { ownerEntityId: attribution.entityId } as any });
      positions.push(...(await this.getAccountPositions(accounts, date, attribution.effectiveOwnershipPct / 100)));
    }

    const assetPositions = positions.filter((p) => !p.isLiability);
    const totalGrossAssets = round2(assetPositions.reduce((sum, p) => sum + p.value, 0));
    const totalGrossLiabilities = round2(positions.filter((p) => p.isLiability).reduce((sum, p) => sum + p.value, 0));

    const leveragePct = totalGrossAssets > 0 ? round2((totalGrossLiabilities / totalGrossAssets) * 100) : null;
    const largestAsset = assetPositions.reduce((max, p) => Math.max(max, p.value), 0);
    const concentrationPct = totalGrossAssets > 0 ? round2((largestAsset / totalGrossAssets) * 100) : null;
    const liquidValue = assetPositions.filter((p) => LIQUID_ASSET_CLASSES.has(p.assetClass)).reduce((sum, p) => sum + p.value, 0);
    const liquidityPct = totalGrossAssets > 0 ? round2((liquidValue / totalGrossAssets) * 100) : null;
    const baseCurrencyValue = assetPositions.filter((p) => p.currencyCode === baseCurrencyCode).reduce((sum, p) => sum + p.value, 0);
    const foreignExposurePct = totalGrossAssets > 0 ? round2(100 - (baseCurrencyValue / totalGrossAssets) * 100) : null;

    const growthValue = assetPositions.filter((p) => GROWTH_ASSET_CLASSES.has(p.assetClass)).reduce((sum, p) => sum + p.value, 0);
    const growthAllocationPct = totalGrossAssets > 0 ? round2((growthValue / totalGrossAssets) * 100) : null;
    const { driftPct, band } = computeSuitabilityDrift(growthAllocationPct, primaryPerson?.riskTolerance ?? null);

    return {
      household, baseCurrencyCode, totalGrossAssets, totalGrossLiabilities,
      leveragePct, concentrationPct, liquidityPct, foreignExposurePct,
      growthAllocationPct, primaryPerson, driftPct, band,
    };
  }

  /**
   * Real-time breach detection: recomputes leverage/concentration for
   * every household in the firm (pure maths, no Claude) and writes a
   * compliance_log row — with an auto-generated message citing the exact
   * figures — for any breach that doesn't already have an open finding
   * for that same rule. Safe to call as often as needed (e.g. on every
   * Compliance page load) since it's idempotent per open breach.
   */
  async scanForBreaches(): Promise<{ scanned: number; created: number }> {
    const manager = TenantContext.getManager();
    const households = await manager.getRepository(HouseholdEntity).find();
    const date = new Date().toISOString().slice(0, 10);
    let created = 0;

    for (const household of households) {
      const raw = await this.computeRawMetrics(household.id, date);

      if (raw.leveragePct !== null && raw.leveragePct > 60) {
        created += await this.raiseBreachIfNew(
          household.id,
          'LEVERAGE_BREACH',
          `${household.name}'s leverage ratio is ${raw.leveragePct}% (liabilities of ` +
            `${formatMoney(raw.totalGrossLiabilities, raw.baseCurrencyCode)} against ` +
            `${formatMoney(raw.totalGrossAssets, raw.baseCurrencyCode)} gross assets), exceeding the 60% threshold.`,
        );
      }
      if (raw.concentrationPct !== null && raw.concentrationPct > 50) {
        created += await this.raiseBreachIfNew(
          household.id,
          'CONCENTRATION_BREACH',
          `${household.name} holds ${raw.concentrationPct}% of its portfolio in a single asset, exceeding the 50% concentration threshold.`,
        );
      }
    }

    return { scanned: households.length, created };
  }

  private async raiseBreachIfNew(householdId: string, ruleCode: string, message: string): Promise<number> {
    const manager = TenantContext.getManager();
    const existing = await manager.getRepository(ComplianceLogEntity).findOne({
      where: { householdId, ruleCode, resolvedAt: IsNull() } as any,
    });
    if (existing) return 0;

    await this.complianceLog.create({
      householdId,
      severity: 'breach' as any,
      ruleCode,
      message,
    } as any);
    return 1;
  }

  /** Latest holding per (account, asset), classified as a weighted asset/liability position. */
  private async getAccountPositions(accounts: AccountEntity[], asOfDate: string, weight: number): Promise<WeightedPosition[]> {
    const manager = TenantContext.getManager();
    const positions: WeightedPosition[] = [];

    for (const account of accounts) {
      const latestHoldings = await manager
        .getRepository(HoldingEntity)
        .createQueryBuilder('h')
        .distinctOn(['h.asset_id'])
        .where('h.account_id = :accountId', { accountId: account.id })
        .andWhere('h.as_of_date <= :asOfDate', { asOfDate })
        .orderBy('h.asset_id')
        .addOrderBy('h.as_of_date', 'DESC')
        .getMany();

      for (const holding of latestHoldings) {
        const asset = await manager.getRepository(AssetEntity).findOne({ where: { id: holding.assetId } as any });
        const currency = await manager.getRepository(CurrencyEntity).findOne({ where: { id: holding.currencyId } as any });
        positions.push({
          value: Number(holding.marketValue) * weight,
          assetClass: asset?.assetClass ?? 'other',
          isLiability: asset?.isLiability ?? false,
          currencyCode: currency?.code ?? 'UNKNOWN',
        });
      }
    }
    return positions;
  }

  async generateInsights(householdId: string) {
    const context = await this.computeHouseholdRiskContext(householdId);

    const flagged = context.entities.filter(
      (e) => e.leverageRatio > 0.5 || e.concentrationPct > 25,
    );

    const narrative = await this.claude.complete({
      system:
        'You are an AI Wealth Analyst for a UHNI family office platform. You are given ' +
        'structured, pre-computed financial data for one household — you must not invent, ' +
        'estimate, or adjust any number in it. Write a concise adviser review note (150-250 ' +
        'words): summarise overall risk posture, call out any entity with leverage above 50% ' +
        'or concentration above 25% by name with its exact figures, and note one or two ' +
        'plausible planning opportunities (e.g. diversification, structuring). Do not give ' +
        'individualised tax or legal advice — flag it for adviser follow-up instead. Plain ' +
        'prose, no headers, no bullet points.',
      user: JSON.stringify(context, null, 2),
      maxTokens: 700,
    });

    return {
      generatedAt: new Date().toISOString(),
      householdId,
      totalNetWorth: context.totalNetWorth,
      flaggedEntities: flagged,
      unresolvedComplianceCount: context.unresolvedComplianceCount,
      narrative,
    };
  }

  async explainScenario(scenarioId: string) {
    const manager = TenantContext.getManager();
    const scenario = await manager.getRepository(ScenarioEntity).findOne({ where: { id: scenarioId } as any });
    if (!scenario) throw new NotFoundException(`Scenario ${scenarioId} not found`);
    if (!scenario.result) {
      return {
        scenarioId, eventType: scenario.eventType, result: null, impact: null,
        explanation: null, explanationError: 'This scenario has not been run yet — call POST /scenarios/:id/run first.',
      };
    }

    const impact = extractScenarioImpact(scenario.result as any);

    let explanation: string | null = null;
    let explanationError: string | null = null;
    try {
      explanation = await this.claude.complete({
        system:
          'You are an AI Wealth Analyst. You are given a scenario projection that was already ' +
          'computed deterministically (baseline/projected net worth and, where applicable, tax ' +
          'impact, liquidity change, and entity valuation shift) plus the assumptions used. ' +
          'Explain it to the client in plain English (100-160 words): what changes and why, ' +
          'citing the actual tax/liquidity/valuation figures given (skip any that are null — ' +
          'do not invent a number for them), and the one or two biggest assumptions/caveats ' +
          '(e.g. an assumed tax rate) to discuss with their adviser. Only reference figures ' +
          'present in the input — never mention income, recurring cash flow, or any other ' +
          'metric that was not supplied. Do not restate every number verbatim — reference the ' +
          'key ones naturally in prose.',
        user: JSON.stringify({ eventType: scenario.eventType, parameters: scenario.parameters, result: scenario.result, impact }, null, 2),
        maxTokens: 500,
      });
    } catch (err: any) {
      this.logger.warn(`Scenario explanation unavailable for ${scenarioId}: ${err?.message ?? err}`);
      explanationError = err?.message ?? 'AI explanation is currently unavailable.';
    }

    return { scenarioId, eventType: scenario.eventType, result: scenario.result, impact, explanation, explanationError };
  }

  async answerQuery(householdId: string, question: string) {
    const context = await this.computeHouseholdRiskContext(householdId);

    const filters = await this.claude.completeJSON<QueryFilterSpec>({
      system:
        'Translate the user\'s question about their wealth entities into a JSON filter object ' +
        'with ONLY these optional numeric keys: ownershipPctMin, ownershipPctMax, ' +
        'leverageRatioMin, leverageRatioMax (as decimals, e.g. 0.5 for 50%), ' +
        'concentrationPctMin, concentrationPctMax, currency (ISO code). Omit keys not implied ' +
        'by the question. Respond with ONLY the JSON object, no prose, no markdown fences.',
      user: question,
      maxTokens: 200,
    });

    const matches = context.entities.filter((e) => {
      if (filters.ownershipPctMin !== undefined && e.effectiveOwnershipPct < filters.ownershipPctMin) return false;
      if (filters.ownershipPctMax !== undefined && e.effectiveOwnershipPct > filters.ownershipPctMax) return false;
      if (filters.leverageRatioMin !== undefined && e.leverageRatio < filters.leverageRatioMin) return false;
      if (filters.leverageRatioMax !== undefined && e.leverageRatio > filters.leverageRatioMax) return false;
      if (filters.concentrationPctMin !== undefined && e.concentrationPct < filters.concentrationPctMin) return false;
      if (filters.concentrationPctMax !== undefined && e.concentrationPct > filters.concentrationPctMax) return false;
      if (filters.currency && !(filters.currency in e.currencyExposure)) return false;
      return true;
    });

    const narrative = await this.claude.complete({
      system:
        'You are an AI Wealth Analyst. Given the user\'s original question and a pre-filtered ' +
        'list of matching entities (already computed correctly — do not recalculate or second-' +
        'guess the numbers), answer the question directly in 1-3 sentences, naming the ' +
        'matching entities with their key figures. If the list is empty, say so plainly.',
      user: JSON.stringify({ question, matches }, null, 2),
      maxTokens: 300,
    });

    return { question, filters, matches, narrative };
  }

  private async computeHouseholdRiskContext(householdId: string, asOfDate?: string): Promise<HouseholdRiskContext> {
    const date = asOfDate ?? new Date().toISOString().slice(0, 10);
    const netWorth = await this.consolidation.getHouseholdNetWorth(householdId, date);
    const graph = await this.structure.buildOwnershipGraph(householdId, date);
    const unresolved = await this.complianceLog.findUnresolved();

    const entityNodes = graph.nodes.filter((n) => n.kind === 'entity');
    const entities: EntityRiskProfile[] = [];

    for (const node of entityNodes) {
      const attribution = netWorth.entityBreakdown.find((e) => e.entityId === node.id);
      const profile = await this.computeEntityRiskProfile(node.id, date);
      entities.push({
        entityId: node.id,
        entityName: node.label,
        entityType: node.entityType ?? 'unknown',
        effectiveOwnershipPct: attribution?.effectiveOwnershipPct ?? 0,
        ...profile,
      });
    }

    return {
      householdId,
      asOfDate: date,
      totalNetWorth: netWorth.totalNetWorth,
      entities,
      unresolvedComplianceCount: unresolved.filter((c) => c.householdId === householdId).length,
    };
  }

  private async computeEntityRiskProfile(
    entityId: string,
    asOfDate: string,
  ): Promise<Pick<EntityRiskProfile, 'grossAssets' | 'grossLiabilities' | 'leverageRatio' | 'concentrationPct' | 'currencyExposure'>> {
    const manager = TenantContext.getManager();
    const accounts = await manager.getRepository(AccountEntity).find({ where: { ownerEntityId: entityId } as any });

    let grossAssets = 0;
    let grossLiabilities = 0;
    const byPosition: Array<{ value: number; currencyCode: string }> = [];
    const currencyCache = new Map<string, string>();

    for (const account of accounts) {
      const latestHoldings = await manager
        .getRepository(HoldingEntity)
        .createQueryBuilder('h')
        .distinctOn(['h.asset_id'])
        .where('h.account_id = :accountId', { accountId: account.id })
        .andWhere('h.as_of_date <= :asOfDate', { asOfDate })
        .orderBy('h.asset_id')
        .addOrderBy('h.as_of_date', 'DESC')
        .getMany();

      for (const holding of latestHoldings) {
        const asset = await manager.getRepository(AssetEntity).findOne({ where: { id: holding.assetId } as any });
        const value = Number(holding.marketValue);

        if (!currencyCache.has(holding.currencyId)) {
          const currency = await manager.getRepository(CurrencyEntity).findOne({ where: { id: holding.currencyId } as any });
          currencyCache.set(holding.currencyId, currency?.code ?? 'UNKNOWN');
        }
        const currencyCode = currencyCache.get(holding.currencyId)!;

        if (asset?.isLiability) {
          grossLiabilities += value;
        } else {
          grossAssets += value;
          byPosition.push({ value, currencyCode });
        }
      }
    }

    const leverageRatio = grossAssets > 0 ? Math.round((grossLiabilities / grossAssets) * 10000) / 10000 : 0;
    const largestPosition = byPosition.reduce((max, p) => Math.max(max, p.value), 0);
    const concentrationPct = grossAssets > 0 ? Math.round((largestPosition / grossAssets) * 10000) / 100 : 0;

    const currencyExposure: Record<string, number> = {};
    if (grossAssets > 0) {
      for (const p of byPosition) {
        currencyExposure[p.currencyCode] = Math.round(((currencyExposure[p.currencyCode] ?? 0) + p.value / grossAssets) * 10000) / 100;
      }
    }

    return { grossAssets, grossLiabilities, leverageRatio, concentrationPct, currencyExposure };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatMoney(n: number, currencyCode: string): string {
  return `${currencyCode} ${Math.round(n).toLocaleString('en-GB')}`;
}

/**
 * Pulls a tax/liquidity/entity-valuation breakdown out of a scenario's
 * already-computed result.details — no new maths, just re-deriving what
 * each event handler already worked out (each handler's `details` shape
 * differs, so this is a light structural sniff, not a strict schema).
 */
function extractScenarioImpact(result: {
  baselineNetWorth: number; projectedNetWorth: number; delta: number; details?: Record<string, any>;
}) {
  const details = result.details ?? {};
  const params = details.params ?? {};
  let taxImpact: number | null = null;
  let liquidityChange: number | null = null;
  let entityValuationShift: number | null = null;

  if (typeof details.netProceeds === 'number') {
    // Business sale: gross proceeds minus the net (after-CGT) proceeds is the tax paid.
    const grossProceeds = (params.salePrice ?? 0) * ((params.sellerOwnershipPct ?? 100) / 100);
    taxImpact = round2(grossProceeds - details.netProceeds);
    liquidityChange = round2(details.netProceeds);
    entityValuationShift = typeof details.removedAttribution === 'number' ? round2(-details.removedAttribution) : null;
  } else if (typeof params.amount === 'number') {
    // Simple liquidity injection (property sale, PE exit, dividend recap, inheritance, ...).
    const taxRate = (params.taxRatePct ?? 0) / 100;
    const net = params.amount * (1 - taxRate);
    taxImpact = round2(params.amount - net);
    liquidityChange = round2(net);
  }

  return {
    baselineNetWorth: result.baselineNetWorth,
    projectedNetWorth: result.projectedNetWorth,
    netWorthDelta: result.delta,
    taxImpact,
    liquidityChange,
    entityValuationShift,
  };
}

function buildMetric(value: number | null, color: RiskColor, label: string, note: string | null): RiskMetric {
  return { value, color, label, note };
}

/**
 * green/yellow/red bucketing shared by all five metrics. `direction`
 * controls whether a HIGH value is the risky end (leverage, concentration,
 * currency exposure, suitability drift) or the safe end (liquidity).
 */
function thresholds(value: number | null, low: number, high: number, direction: 'higher-worse' | 'higher-better'): RiskColor {
  if (value === null) return 'neutral';
  if (direction === 'higher-worse') {
    if (value >= high) return 'red';
    if (value >= low) return 'yellow';
    return 'green';
  }
  if (value < low) return 'red';
  if (value < high) return 'yellow';
  return 'green';
}

/**
 * Suitability drift: how far the household's growth-asset allocation sits
 * outside the band expected for its declared risk tolerance. Null when
 * either input is missing (no positions, or no risk tolerance recorded).
 */
function computeSuitabilityDrift(
  growthAllocationPct: number | null,
  riskTolerance: string | null,
): { driftPct: number | null; band: string | null } {
  if (growthAllocationPct === null || !riskTolerance || !(riskTolerance in SUITABILITY_BANDS)) {
    return { driftPct: null, band: null };
  }
  const [lo, hi] = SUITABILITY_BANDS[riskTolerance];
  const drift = growthAllocationPct < lo ? lo - growthAllocationPct : growthAllocationPct > hi ? growthAllocationPct - hi : 0;
  return { driftPct: round2(drift), band: `${lo}-${hi}%` };
}