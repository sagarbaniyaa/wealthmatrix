import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  ChargeProjectionEntity, ChargeArrangementOld, ChargeArrangementNew, ChargeProjectionAssumptions, ChargeProjectionResults,
} from '../../database/entities';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';

/**
 * Standard "reduction in yield" style methodology: both arrangements are
 * assumed to grow at the SAME gross rate before charges, so the entire
 * divergence between the two curves is the charge difference — nothing
 * else. Manual entry on both sides deliberately (no join against `fund`)
 * because the "old" arrangement in a real transfer is very often a
 * legacy insurance-company pension that will never be in our researched
 * fund database.
 */
@Injectable()
export class ChargeProjectionService {
  private readonly logger = new Logger(ChargeProjectionService.name);

  constructor(private readonly claude: ClaudeClientService) {}

  private get repo() {
    return TenantContext.getManager().getRepository(ChargeProjectionEntity);
  }

  async listForHousehold(householdId: string): Promise<ChargeProjectionEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async findOneOrFail(id: string): Promise<ChargeProjectionEntity> {
    const row = await this.repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`Charge projection ${id} not found`);
    return row;
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOneOrFail(id);
    await this.repo.remove(row);
  }

  compute(oldArrangement: ChargeArrangementOld, newArrangement: ChargeArrangementNew, assumptions: ChargeProjectionAssumptions): ChargeProjectionResults {
    const growth = assumptions.grossGrowthRatePct / 100;
    const oldNetRate = growth - oldArrangement.ongoingChargePct / 100;
    const newNetRate = growth - newArrangement.ongoingChargePct / 100;

    const startingNewValue = round2(
      oldArrangement.currentValue * (1 - oldArrangement.exitPenaltyPct / 100) * (1 - newArrangement.initialChargePct / 100),
    );

    const series: ChargeProjectionResults['series'] = [];
    let oldValue = oldArrangement.currentValue;
    let newValue = startingNewValue;
    series.push({ year: 0, oldValue: round2(oldValue), newValue: round2(newValue) });

    for (let year = 1; year <= assumptions.projectionYears; year++) {
      oldValue = oldValue * (1 + oldNetRate);
      newValue = newValue * (1 + newNetRate);
      series.push({ year, oldValue: round2(oldValue), newValue: round2(newValue) });
    }

    const finalOldValue = round2(oldValue);
    const finalNewValue = round2(newValue);
    const difference = round2(finalNewValue - finalOldValue);
    const differencePct = finalOldValue !== 0 ? round2((difference / finalOldValue) * 100) : 0;

    return { series, startingNewValue, finalOldValue, finalNewValue, difference, differencePct };
  }

  async create(params: {
    householdId: string; name?: string; oldArrangement: ChargeArrangementOld; newArrangement: ChargeArrangementNew;
    assumptions: ChargeProjectionAssumptions; createdBy: string;
  }): Promise<ChargeProjectionEntity> {
    const results = this.compute(params.oldArrangement, params.newArrangement, params.assumptions);

    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(),
      householdId: params.householdId,
      name: params.name ?? null,
      oldArrangement: params.oldArrangement,
      newArrangement: params.newArrangement,
      assumptions: params.assumptions,
      results,
      createdBy: params.createdBy,
    });
    const saved = await this.repo.save(entity);

    try {
      const narrative = await this.claude.complete({
        system:
          'You are an AI assistant for a UK financial advice firm. You are given a pre-computed charge/growth ' +
          'projection comparing a client\'s existing pension/plan arrangement against a proposed new one — both ' +
          'figures and the year-by-year projection are already calculated correctly; do not recompute or adjust ' +
          'any number. Write a short, plain-English note (80-140 words) explaining what the projection shows and ' +
          'why the charge difference compounds the way it does over time. Do not recommend whether to transfer — ' +
          'state the arithmetic outcome only; the suitability judgement is the adviser\'s.',
        user: JSON.stringify({ oldArrangement: params.oldArrangement, newArrangement: params.newArrangement, assumptions: params.assumptions, results }, null, 2),
        maxTokens: 300,
      });
      saved.aiNarrative = narrative;
    } catch (err: any) {
      this.logger.warn(`Charge projection narrative unavailable: ${err?.message ?? err}`);
      saved.aiNarrativeError = err?.message ?? 'AI narrative is currently unavailable.';
    }

    return this.repo.save(saved);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
