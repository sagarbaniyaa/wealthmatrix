import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { ScenarioEntity } from '../../database/entities';
import { ScenarioEventType } from '../../common/enums/domain.enums';
import { WealthConsolidationService } from '../wealth-consolidation/wealth-consolidation.service';

interface ScenarioResult {
  baselineNetWorth: number;
  projectedNetWorth: number;
  delta: number;
  narrative: string;
  details: Record<string, unknown>;
}

type EventHandler = (scenario: ScenarioEntity, consolidation: WealthConsolidationService) => Promise<ScenarioResult>;

/**
 * Answers "if X happens, what does net worth look like" by computing a
 * baseline (today's consolidated net worth) and a projected figure that
 * reflects the scenario's effect, per event type.
 *
 * Each event type is a pluggable handler in EVENT_HANDLERS — this is the
 * seam for adding real tax/actuarial logic per jurisdiction. BUSINESS_SALE
 * is implemented in full as the flagship example (matches the "sell my
 * business in 2029 for £3M" example in the product spec); the remaining
 * event types have a working-but-simplified handler with the assumptions
 * called out explicitly, flagged TODO for the tax/legal team to refine —
 * do not treat these as compliant tax advice as-is.
 */
@Injectable()
export class ScenarioEngineService {
  constructor(private readonly consolidation: WealthConsolidationService) {}

  private readonly EVENT_HANDLERS: Record<ScenarioEventType, EventHandler> = {
    [ScenarioEventType.BUSINESS_SALE]: this.handleBusinessSale.bind(this),
    [ScenarioEventType.PROPERTY_SALE]: this.handleSimpleLiquidityInjection.bind(this),
    [ScenarioEventType.PE_EXIT]: this.handleSimpleLiquidityInjection.bind(this),
    [ScenarioEventType.LIQUIDITY_EVENT]: this.handleSimpleLiquidityInjection.bind(this),
    [ScenarioEventType.DIVIDEND_RECAP]: this.handleSimpleLiquidityInjection.bind(this),
    [ScenarioEventType.INHERITANCE]: this.handleSimpleLiquidityInjection.bind(this),
    [ScenarioEventType.RELOCATION]: this.handleNarrativeOnly.bind(this),
    [ScenarioEventType.DIVORCE]: this.handleNarrativeOnly.bind(this),
    [ScenarioEventType.TAX_RESIDENCY_CHANGE]: this.handleNarrativeOnly.bind(this),
    [ScenarioEventType.LEVERAGE_CHANGE]: this.handleNarrativeOnly.bind(this),
    [ScenarioEventType.CUSTOM]: this.handleNarrativeOnly.bind(this),
  };

  async runScenario(scenarioId: string): Promise<ScenarioEntity> {
    const manager = TenantContext.getManager();
    const repo = manager.getRepository(ScenarioEntity);
    const scenario = await repo.findOne({ where: { id: scenarioId } as any });
    if (!scenario) throw new NotFoundException(`Scenario ${scenarioId} not found`);

    await repo.update(scenario.id, { status: 'running' } as any);

    try {
      const handler = this.EVENT_HANDLERS[scenario.eventType];
      const result = await handler(scenario, this.consolidation);
      await repo.update(scenario.id, { status: 'complete', result: result as any } as any);
    } catch (err) {
      await repo.update(scenario.id, {
        status: 'failed',
        result: { error: err instanceof Error ? err.message : 'Unknown error' } as any,
      } as any);
      throw err;
    }

    return repo.findOneOrFail({ where: { id: scenario.id } as any });
  }

  /**
   * "If I sell my business in 2029 for £3M, what happens to my net worth?"
   * params: { entityId: string, salePrice: number, currency: string,
   *           capitalGainsTaxRatePct?: number, sellerOwnershipPct?: number }
   *
   * Simplified model: the seller's attributed share of the sold entity's NAV
   * is removed from the projection, and (salePrice × sellerOwnershipPct% ×
   * (1 - CGT rate)) net cash is added back as post-sale liquidity. This
   * intentionally ignores deal costs, earn-outs, BADR/Entrepreneurs' Relief
   * thresholds, and multi-jurisdiction tax treaties — flagged for the tax
   * team to layer in via a real tax-calculation service.
   */
  private async handleBusinessSale(
    scenario: ScenarioEntity,
    consolidation: WealthConsolidationService,
  ): Promise<ScenarioResult> {
    const params = scenario.parameters as {
      salePrice: number;
      sellerOwnershipPct?: number;
      capitalGainsTaxRatePct?: number;
      entityId?: string;
    };

    const baseline = await consolidation.getHouseholdNetWorth(scenario.householdId);
    const cgtRate = (params.capitalGainsTaxRatePct ?? 20) / 100; // TODO: jurisdiction-aware rate lookup
    const sellerPct = (params.sellerOwnershipPct ?? 100) / 100;
    const netProceeds = params.salePrice * sellerPct * (1 - cgtRate);

    const soldEntity = params.entityId
      ? baseline.entityBreakdown.find((e) => e.entityId === params.entityId)
      : undefined;
    const removedAttribution = soldEntity?.attributedValue ?? 0;

    const projectedNetWorth =
      baseline.totalNetWorth - removedAttribution + Math.round(netProceeds * 100) / 100;

    return {
      baselineNetWorth: baseline.totalNetWorth,
      projectedNetWorth: Math.round(projectedNetWorth * 100) / 100,
      delta: Math.round((projectedNetWorth - baseline.totalNetWorth) * 100) / 100,
      narrative:
        `Selling ${soldEntity?.entityName ?? 'the business'} for ${params.salePrice.toLocaleString()} ` +
        `at an assumed ${(cgtRate * 100).toFixed(0)}% CGT rate yields net proceeds of ` +
        `${netProceeds.toLocaleString(undefined, { maximumFractionDigits: 0 })}, replacing the entity's ` +
        `attributed value of ${removedAttribution.toLocaleString()} in the household's net worth.`,
      details: { baseline, params, netProceeds, removedAttribution },
    };
  }

  /**
   * Generic handler for events that are, at this level of modelling, "a lump
   * sum of cash arrives" — property_sale, pe_exit, liquidity_event,
   * dividend_recap, inheritance. params: { amount: number, taxRatePct?: number }
   */
  private async handleSimpleLiquidityInjection(
    scenario: ScenarioEntity,
    consolidation: WealthConsolidationService,
  ): Promise<ScenarioResult> {
    const params = scenario.parameters as { amount: number; taxRatePct?: number };
    const baseline = await consolidation.getHouseholdNetWorth(scenario.householdId);
    const taxRate = (params.taxRatePct ?? 0) / 100;
    const net = params.amount * (1 - taxRate);
    const projectedNetWorth = baseline.totalNetWorth + net;

    return {
      baselineNetWorth: baseline.totalNetWorth,
      projectedNetWorth: Math.round(projectedNetWorth * 100) / 100,
      delta: Math.round(net * 100) / 100,
      narrative: `A ${scenario.eventType} of ${params.amount.toLocaleString()} net of assumed tax adds ` +
        `${net.toLocaleString(undefined, { maximumFractionDigits: 0 })} to household net worth.`,
      details: { baseline, params },
    };
  }

  /**
   * Events whose primary effect isn't a balance-sheet number this engine can
   * compute without jurisdiction-specific rules (relocation, divorce, tax
   * residency change, leverage change, custom). Returns baseline net worth
   * unchanged with a narrative flagging what a fuller implementation needs.
   */
  private async handleNarrativeOnly(
    scenario: ScenarioEntity,
    consolidation: WealthConsolidationService,
  ): Promise<ScenarioResult> {
    const baseline = await consolidation.getHouseholdNetWorth(scenario.householdId);
    return {
      baselineNetWorth: baseline.totalNetWorth,
      projectedNetWorth: baseline.totalNetWorth,
      delta: 0,
      narrative:
        `${scenario.eventType} scenarios require jurisdiction/case-specific rules ` +
        `(e.g. matrimonial asset division, dual-residency tax treaties, covenant-triggered ` +
        `re-leveraging) not yet modelled quantitatively. Baseline net worth is shown unchanged; ` +
        `extend EVENT_HANDLERS with a dedicated calculation for this event type.`,
      details: { baseline, parameters: scenario.parameters },
    };
  }
}
