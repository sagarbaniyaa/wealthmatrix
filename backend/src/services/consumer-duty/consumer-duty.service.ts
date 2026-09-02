import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { Role } from '../../common/enums/role.enum';
import { ConsumerDutyReviewEntity, FactFindEntity, HouseholdEntity } from '../../database/entities';
import { HouseholdService } from '../../modules/household/household.service';

export interface VulnerabilityFlag {
  key: string;
  label: string;
  detail: string;
}

export interface ConsumerDutyRegisterRow {
  householdId: string;
  householdName: string;
  isVulnerable: boolean;
  vulnerabilityFlags: VulnerabilityFlag[];
  supportDocumented: boolean;
  latestFactFindCompletedOn: string | null;
  reviewAgeDays: number | null;
  reviewOverdue: boolean; // no completed fact find within REVIEW_CYCLE_DAYS
  latestOutcomeReview: {
    reviewDate: string;
    priceValueOutcome: string;
    productsServicesOutcome: string;
    understandingOutcome: string;
    supportOutcome: string;
  } | null;
  outcomesFullyAssessed: boolean;
}

export interface ConsumerDutyRegister {
  generatedAt: string;
  reviewCycleDays: number;
  households: ConsumerDutyRegisterRow[];
  summary: {
    totalHouseholds: number;
    vulnerableCount: number;
    vulnerableWithoutDocumentedSupport: number;
    reviewOverdueCount: number;
    outcomesNeverAssessedCount: number;
  };
}

const REVIEW_CYCLE_DAYS = 365;

/**
 * Evidences FCA Consumer Duty (PRIN 2A) monitoring using two real data
 * sources already in the platform, rather than inventing scores for
 * things we have no data to compute honestly:
 *
 *  1. Vulnerability + support-in-place — read directly from each
 *     household's latest fact_find.personal_circumstances (see
 *     migration 005 / FactFindForm). This is the client's own most
 *     recent declaration, already collected — this service just rolls
 *     it up firm-wide instead of leaving it buried per-household.
 *  2. The four Consumer Duty outcomes (price & value, products &
 *     services, understanding, support) — a dated adviser ATTESTATION
 *     per household, stored in consumer_duty_review (migration 009).
 *     We deliberately do NOT auto-score price & value or products &
 *     services: the platform doesn't hold real fee-benchmarking or
 *     target-market data, and a fabricated score would misrepresent
 *     what's actually been evidenced. An unset outcome shows plainly as
 *     "not assessed" rather than silently defaulting to "met".
 *
 * "Review overdue" uses a fixed 365-day cycle — a reasonable default for
 * ongoing-advice relationships, not a regulatory citation; a firm with a
 * different service proposition would want this configurable.
 */
@Injectable()
export class ConsumerDutyService {
  constructor(private readonly households: HouseholdService) {}

  private get reviewRepo() {
    return TenantContext.getManager().getRepository(ConsumerDutyReviewEntity);
  }

  private extractVulnerability(factFind: FactFindEntity | null): { flags: VulnerabilityFlag[]; supportDocumented: boolean } {
    const flags: VulnerabilityFlag[] = [];
    if (!factFind) return { flags, supportDocumented: false };

    const pc = (factFind.personalCircumstances ?? {}) as Record<string, any>;

    if (pc.healthStatus === 'bad') {
      flags.push({ key: 'health', label: 'Health', detail: pc.healthExplain || 'Health status recorded as poor' });
    }
    if (pc.affectsUnderstanding) {
      flags.push({ key: 'understanding', label: 'Understanding', detail: pc.affectsUnderstandingDetails || 'May affect ability to understand advice' });
    }
    if (pc.needsAdditionalSupport) {
      flags.push({ key: 'support', label: 'Additional support', detail: pc.additionalSupportDetails || 'Needs additional support' });
    }
    if (pc.vulnerabilityNotes) {
      flags.push({ key: 'notes', label: 'Adviser notes', detail: pc.vulnerabilityNotes });
    }

    const supportDocumented = !!pc.needsAdditionalSupport && !!String(pc.additionalSupportProvided || '').trim();
    return { flags, supportDocumented };
  }

  async getRegister(user: { userId: string; role: Role }): Promise<ConsumerDutyRegister> {
    const manager = TenantContext.getManager();
    const householdList: HouseholdEntity[] = await this.households.findAllForUser(user);

    const rows: ConsumerDutyRegisterRow[] = [];
    for (const household of householdList) {
      const factFinds = await manager.getRepository(FactFindEntity).find({
        where: { householdId: household.id } as any,
        order: { updatedAt: 'DESC' } as any,
      });
      const latestCompleted = factFinds.find((f) => f.status === 'completed') ?? null;
      const mostRecent = latestCompleted ?? factFinds[0] ?? null;

      const { flags, supportDocumented } = this.extractVulnerability(mostRecent);

      const reviewAgeDays = latestCompleted?.completedOn
        ? Math.floor((Date.now() - new Date(latestCompleted.completedOn).getTime()) / 86_400_000)
        : null;

      const outcomeReviews = await this.reviewRepo.find({
        where: { householdId: household.id } as any,
        order: { reviewDate: 'DESC', createdAt: 'DESC' } as any,
      });
      const latestOutcome = outcomeReviews[0] ?? null;

      rows.push({
        householdId: household.id,
        householdName: household.name,
        isVulnerable: flags.length > 0,
        vulnerabilityFlags: flags,
        supportDocumented,
        latestFactFindCompletedOn: latestCompleted?.completedOn ?? null,
        reviewAgeDays,
        reviewOverdue: reviewAgeDays === null || reviewAgeDays > REVIEW_CYCLE_DAYS,
        latestOutcomeReview: latestOutcome
          ? {
              reviewDate: latestOutcome.reviewDate,
              priceValueOutcome: latestOutcome.priceValueOutcome,
              productsServicesOutcome: latestOutcome.productsServicesOutcome,
              understandingOutcome: latestOutcome.understandingOutcome,
              supportOutcome: latestOutcome.supportOutcome,
            }
          : null,
        outcomesFullyAssessed: !!latestOutcome
          && latestOutcome.priceValueOutcome !== 'not_assessed'
          && latestOutcome.productsServicesOutcome !== 'not_assessed'
          && latestOutcome.understandingOutcome !== 'not_assessed'
          && latestOutcome.supportOutcome !== 'not_assessed',
      });
    }

    // Vulnerable households first, then oldest review, so the register
    // reads as a worklist rather than a flat alphabetical dump.
    rows.sort((a, b) => {
      if (a.isVulnerable !== b.isVulnerable) return a.isVulnerable ? -1 : 1;
      return (b.reviewAgeDays ?? Infinity) - (a.reviewAgeDays ?? Infinity);
    });

    return {
      generatedAt: new Date().toISOString(),
      reviewCycleDays: REVIEW_CYCLE_DAYS,
      households: rows,
      summary: {
        totalHouseholds: rows.length,
        vulnerableCount: rows.filter((r) => r.isVulnerable).length,
        vulnerableWithoutDocumentedSupport: rows.filter((r) => r.isVulnerable && !r.supportDocumented).length,
        reviewOverdueCount: rows.filter((r) => r.reviewOverdue).length,
        outcomesNeverAssessedCount: rows.filter((r) => !r.latestOutcomeReview).length,
      },
    };
  }

  async getHistory(householdId: string): Promise<ConsumerDutyReviewEntity[]> {
    return this.reviewRepo.find({ where: { householdId } as any, order: { reviewDate: 'DESC', createdAt: 'DESC' } as any });
  }

  /** Household-scoped detail behind the review panel: current vulnerability read-off plus the review history. */
  async getHouseholdDetail(householdId: string): Promise<{
    vulnerabilityFlags: VulnerabilityFlag[];
    supportDocumented: boolean;
    history: ConsumerDutyReviewEntity[];
  }> {
    const manager = TenantContext.getManager();
    const factFinds = await manager.getRepository(FactFindEntity).find({
      where: { householdId } as any,
      order: { updatedAt: 'DESC' } as any,
    });
    const mostRecent = factFinds.find((f) => f.status === 'completed') ?? factFinds[0] ?? null;
    const { flags, supportDocumented } = this.extractVulnerability(mostRecent);
    const history = await this.getHistory(householdId);
    return { vulnerabilityFlags: flags, supportDocumented, history };
  }

  async recordReview(
    householdId: string,
    dto: {
      reviewDate?: string;
      priceValueOutcome: string; priceValueNotes?: string;
      productsServicesOutcome: string; productsServicesNotes?: string;
      understandingOutcome: string; understandingNotes?: string;
      supportOutcome: string; supportNotes?: string;
      overallNotes?: string;
    },
    reviewedBy: string,
  ): Promise<ConsumerDutyReviewEntity> {
    const entity = this.reviewRepo.create({
      firmId: TenantContext.getFirmId(),
      householdId,
      reviewedBy,
      reviewDate: dto.reviewDate ?? new Date().toISOString().slice(0, 10),
      priceValueOutcome: dto.priceValueOutcome as any,
      priceValueNotes: dto.priceValueNotes ?? null,
      productsServicesOutcome: dto.productsServicesOutcome as any,
      productsServicesNotes: dto.productsServicesNotes ?? null,
      understandingOutcome: dto.understandingOutcome as any,
      understandingNotes: dto.understandingNotes ?? null,
      supportOutcome: dto.supportOutcome as any,
      supportNotes: dto.supportNotes ?? null,
      overallNotes: dto.overallNotes ?? null,
    });
    return this.reviewRepo.save(entity);
  }
}
