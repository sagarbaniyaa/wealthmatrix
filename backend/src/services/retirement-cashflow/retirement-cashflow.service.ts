import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  RetirementCashflowScenarioEntity, RetirementCashflowInputs, RetirementCashflowResults, RetirementCashflowYear,
} from '../../database/entities';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';

const SIMULATION_COUNT = 2000;

/**
 * A transparent Monte Carlo retirement sustainability model — not a
 * black box. Everything is modelled in REAL (inflation-adjusted)
 * terms: contributions and the desired retirement income stay constant
 * in today's money, and the assumed return is a real (post-inflation)
 * return — deliberately avoiding a separate inflation input that would
 * only cancel back out, rather than pretending to more sophistication
 * than that.
 *
 * Annual returns are drawn from a Normal(expectedReturn, volatility)
 * distribution, floored at -95% in any single year (a simplification
 * chosen over a strict lognormal model, for the same reason: honesty
 * about what this is, not a claim of institutional-grade realism).
 * "Success" means the pot never hits zero at any point through
 * `planToAge`, not just that the final balance is positive.
 */
@Injectable()
export class RetirementCashflowService {
  private readonly logger = new Logger(RetirementCashflowService.name);

  constructor(private readonly claude: ClaudeClientService) {}

  private get repo() {
    return TenantContext.getManager().getRepository(RetirementCashflowScenarioEntity);
  }

  async listForHousehold(householdId: string): Promise<RetirementCashflowScenarioEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async findOneOrFail(id: string): Promise<RetirementCashflowScenarioEntity> {
    const row = await this.repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`Retirement cashflow scenario ${id} not found`);
    return row;
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOneOrFail(id);
    await this.repo.remove(row);
  }

  simulate(inputs: RetirementCashflowInputs): RetirementCashflowResults {
    const years = inputs.planToAge - inputs.currentAge;
    const yearsToRetirement = inputs.retirementAge - inputs.currentAge;
    const meanReturn = inputs.expectedReturnPct / 100;
    const volatility = inputs.returnVolatilityPct / 100;

    // paths[sim][year] = pot value at that year (year 0 = now)
    const paths: number[][] = [];
    let successCount = 0;

    for (let sim = 0; sim < SIMULATION_COUNT; sim++) {
      const path: number[] = [inputs.currentPotValue];
      let pot = inputs.currentPotValue;
      let depleted = false;

      for (let year = 1; year <= years; year++) {
        const annualReturn = Math.max(sampleNormal(meanReturn, volatility), -0.95);
        pot = pot * (1 + annualReturn);

        if (year <= yearsToRetirement) {
          pot += inputs.monthlyContribution * 12;
        } else {
          pot -= inputs.desiredAnnualIncome;
        }

        if (pot <= 0) {
          pot = 0;
          depleted = true;
        }
        path.push(pot);
      }

      if (!depleted) successCount++;
      paths.push(path);
    }

    const series: RetirementCashflowYear[] = [];
    for (let year = 0; year <= years; year++) {
      const valuesAtYear = paths.map((p) => p[year]).sort((a, b) => a - b);
      series.push({
        age: inputs.currentAge + year,
        p10: round2(percentile(valuesAtYear, 10)),
        p50: round2(percentile(valuesAtYear, 50)),
        p90: round2(percentile(valuesAtYear, 90)),
      });
    }

    return {
      successProbabilityPct: round2((successCount / SIMULATION_COUNT) * 100),
      series,
      simulationCount: SIMULATION_COUNT,
    };
  }

  async create(params: { householdId: string; name?: string; inputs: RetirementCashflowInputs; createdBy: string }): Promise<RetirementCashflowScenarioEntity> {
    const results = this.simulate(params.inputs);

    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(),
      householdId: params.householdId,
      name: params.name ?? null,
      inputs: params.inputs,
      results,
      createdBy: params.createdBy,
    });
    const saved = await this.repo.save(entity);

    try {
      const narrative = await this.claude.complete({
        system:
          'You are an AI assistant for a UK financial advice firm. You are given the pre-computed results of a ' +
          'Monte Carlo retirement sustainability simulation (2,000 simulated paths, real/inflation-adjusted ' +
          'terms) — the success probability and percentile figures are already correct; do not recompute or ' +
          'adjust them. Write a short, plain-English note (80-140 words) explaining what the success probability ' +
          'means and what the 10th/90th percentile spread implies about downside/upside risk. Do not recommend ' +
          'a course of action — describe the arithmetic outcome only; what to do about it is the adviser\'s ' +
          'judgement.',
        user: JSON.stringify({ inputs: params.inputs, results }, null, 2),
        maxTokens: 300,
      });
      saved.aiNarrative = narrative;
    } catch (err: any) {
      this.logger.warn(`Retirement cashflow narrative unavailable: ${err?.message ?? err}`);
      saved.aiNarrativeError = err?.message ?? 'AI narrative is currently unavailable.';
    }

    return this.repo.save(saved);
  }
}

/** Box-Muller transform — no dependency needed for a normal random sample. */
function sampleNormal(mean: number, stdDev: number): number {
  const u1 = Math.random() || Number.EPSILON;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
  return sortedValues[index];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
