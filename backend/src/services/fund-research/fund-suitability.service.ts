import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { HouseholdEntity, HouseholdMemberEntity, PersonEntity } from '../../database/entities';
import { FundService, PagedFunds } from '../../modules/fund/fund.service';

// Same three-band heuristic as WealthAnalystService's suitability-drift
// metric, applied here to the UK SRRI-style 1-7 fund risk_rating scale
// instead of a growth-allocation %. Deliberately simple — a triage
// starting point for the adviser, not a full attitude-to-risk questionnaire.
const RISK_TOLERANCE_TO_FUND_RATING: Record<string, [number, number]> = {
  conservative: [1, 3],
  moderate: [3, 5],
  aggressive: [5, 7],
};

export interface FundSuitabilityResult {
  householdId: string;
  riskTolerance: string | null;
  riskRatingBand: [number, number] | null;
  matchingFunds: PagedFunds;
}

@Injectable()
export class FundSuitabilityService {
  constructor(private readonly funds: FundService) {}

  async suitableFundsForHousehold(householdId: string): Promise<FundSuitabilityResult> {
    const manager = TenantContext.getManager();
    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    const primaryPerson = primaryMember
      ? await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any })
      : null;

    const riskTolerance = primaryPerson?.riskTolerance ?? null;
    const band = riskTolerance ? RISK_TOLERANCE_TO_FUND_RATING[riskTolerance] ?? null : null;

    const matchingFunds = await this.funds.findFiltered({
      riskRatingMin: band?.[0],
      riskRatingMax: band?.[1],
      pageSize: 50,
      sortBy: 'ocf',
      sortDir: 'ASC',
    } as any);

    return { householdId, riskTolerance, riskRatingBand: band, matchingFunds };
  }
}
