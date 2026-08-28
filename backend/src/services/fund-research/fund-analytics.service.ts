import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { HouseholdEntity } from '../../database/entities';
import { FundService } from '../../modules/fund/fund.service';

// Asset classes an OEIC/unit trust/investment trust wraps that trade less
// liquidly than daily-dealt equity/fixed-income/money-market funds.
const ILLIQUID_ASSET_CLASSES = new Set(['property', 'alternative']);

export interface FundSwitchImpact {
  householdId: string;
  switchAmount: number;
  fundA: { id: string; name: string; isin: string; ocf: number | null; riskRating: number | null; volatilityPct: number | null; assetClass: string };
  fundB: { id: string; name: string; isin: string; ocf: number | null; riskRating: number | null; volatilityPct: number | null; assetClass: string };
  ocfDeltaPct: number | null;
  annualCostDelta: number | null;
  riskRatingDelta: number | null;
  volatilityDeltaPct: number | null;
  liquidityChange: 'improved' | 'reduced' | 'unchanged';
  liquidityNote: string;
}

/**
 * "Fund → Household Impact": switching a household's holding from Fund A
 * to Fund B, quantified. Deliberately a narrow, transparent delta on the
 * switch itself (cost/risk/volatility/liquidity) rather than a full
 * net-worth re-projection — that's ScenarioEngineService's job, and nothing
 * here invents a return forecast. All four deltas are either a straight
 * subtraction of two already-known fund attributes or a categorical flag,
 * so there is nothing here for the AI layer to get right or wrong.
 */
@Injectable()
export class FundAnalyticsService {
  constructor(private readonly funds: FundService) {}

  async compareFundSwitchImpact(householdId: string, fundAId: string, fundBId: string, switchAmount: number): Promise<FundSwitchImpact> {
    const manager = TenantContext.getManager();
    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);

    const [fundA, fundB] = await this.funds.findOneOrFailByIdList([fundAId, fundBId]);

    const ocfDeltaPct = fundA.ocf !== null && fundB.ocf !== null ? round4(fundB.ocf - fundA.ocf) : null;
    const annualCostDelta = ocfDeltaPct !== null ? round2(switchAmount * ocfDeltaPct) : null;
    const riskRatingDelta = fundA.riskRating !== null && fundB.riskRating !== null ? fundB.riskRating - fundA.riskRating : null;
    const volatilityDeltaPct = fundA.volatilityPct !== null && fundB.volatilityPct !== null ? round4(fundB.volatilityPct - fundA.volatilityPct) : null;

    const aIlliquid = ILLIQUID_ASSET_CLASSES.has(fundA.assetClass);
    const bIlliquid = ILLIQUID_ASSET_CLASSES.has(fundB.assetClass);
    let liquidityChange: FundSwitchImpact['liquidityChange'] = 'unchanged';
    let liquidityNote = 'Both funds trade on a similar dealing basis — no material liquidity change.';
    if (!aIlliquid && bIlliquid) {
      liquidityChange = 'reduced';
      liquidityNote = `Moving into ${fundB.assetClass.replace('_', ' ')} typically means less frequent/slower dealing than ${fundA.assetClass.replace('_', ' ')}.`;
    } else if (aIlliquid && !bIlliquid) {
      liquidityChange = 'improved';
      liquidityNote = `Moving out of ${fundA.assetClass.replace('_', ' ')} into ${fundB.assetClass.replace('_', ' ')} typically improves dealing frequency/speed.`;
    }

    return {
      householdId,
      switchAmount,
      fundA: pick(fundA),
      fundB: pick(fundB),
      ocfDeltaPct,
      annualCostDelta,
      riskRatingDelta,
      volatilityDeltaPct,
      liquidityChange,
      liquidityNote,
    };
  }
}

function pick(f: { id: string; name: string; isin: string; ocf: number | null; riskRating: number | null; volatilityPct: number | null; assetClass: string }) {
  return { id: f.id, name: f.name, isin: f.isin, ocf: f.ocf, riskRating: f.riskRating, volatilityPct: f.volatilityPct, assetClass: f.assetClass };
}
function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
