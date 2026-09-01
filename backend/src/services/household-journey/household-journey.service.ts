import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  HouseholdEntity, HouseholdMemberEntity, PersonEntity, FactFindEntity,
  ComplianceProviderActionEntity, ReportCaseEntity,
} from '../../database/entities';

export type JourneyStepStatus = 'not_started' | 'in_progress' | 'done';

export interface JourneyStep {
  key: string;
  label: string;
  status: JourneyStepStatus;
  detail: string;
  linkPath: string;
}

export interface HouseholdJourney {
  householdId: string;
  steps: JourneyStep[];
}

/**
 * Reads existing state across every module built this session (fact
 * find, risk profile, provider sends, generated reports) and renders it
 * as one linear progress tracker — no new source-of-truth data, purely
 * a status rollup so an adviser can see "where is this client" without
 * visiting five separate pages.
 *
 * The "Suitability" step is a known simplification: there's no persisted
 * record of a Suitability Report actually being generated (that page
 * computes and discards on every view, by design — see
 * SuitabilityReportService), so this step can only report "ready to
 * generate" (a completed fact find exists) rather than "already
 * generated". Documented here and in the frontend README rather than
 * silently implying more precision than the data actually supports.
 */
@Injectable()
export class HouseholdJourneyService {
  async getJourney(householdId: string): Promise<HouseholdJourney> {
    const manager = TenantContext.getManager();
    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: householdId } as any });
    if (!household) throw new NotFoundException(`Household ${householdId} not found`);

    const factFinds = await manager.getRepository(FactFindEntity).find({ where: { householdId } as any, order: { updatedAt: 'DESC' } as any });
    const latestFactFind = factFinds[0] ?? null;
    const hasCompletedFactFind = factFinds.some((f) => f.status === 'completed');

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    const primaryPerson = primaryMember
      ? await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any })
      : null;
    const hasRiskTolerance = !!primaryPerson?.riskTolerance;

    const providerActions = await manager.getRepository(ComplianceProviderActionEntity).find({ where: { householdId } as any });
    const hasSentProviderAction = providerActions.some((a) => a.emailStatus === 'SENT' || a.emailStatus === 'RECEIVED');

    const reportCases = await manager.getRepository(ReportCaseEntity).find({ where: { householdId } as any });
    const hasFinalReport = reportCases.some((r) => r.status === 'final');

    const steps: JourneyStep[] = [
      {
        key: 'fact_find',
        label: 'Fact Find',
        status: hasCompletedFactFind ? 'done' : latestFactFind ? 'in_progress' : 'not_started',
        detail: hasCompletedFactFind
          ? `Completed ${latestFactFind?.completedOn ?? ''}`.trim()
          : latestFactFind
            ? 'Draft in progress'
            : 'Not started',
        linkPath: `/advisor/households/${householdId}/fact-find`,
      },
      {
        key: 'risk_profile',
        label: 'Risk Profile',
        status: hasRiskTolerance ? 'done' : 'not_started',
        detail: hasRiskTolerance ? `Recorded: ${primaryPerson?.riskTolerance}` : 'Not recorded — complete the Fact Find\'s risk questionnaire',
        linkPath: `/advisor/households/${householdId}/fact-find`,
      },
      {
        key: 'suitability',
        label: 'Suitability',
        // Known simplification — see class doc comment: "done" here
        // means ready-to-generate (a completed fact find exists), not
        // that a report has actually been generated and reviewed yet.
        status: hasCompletedFactFind ? 'done' : 'not_started',
        detail: hasCompletedFactFind ? 'Ready — fact find complete' : 'Needs a completed fact find first',
        linkPath: `/print/suitability/${householdId}`,
      },
      {
        key: 'provider_send',
        label: 'LOA / Provider Send',
        status: hasSentProviderAction ? 'done' : providerActions.length > 0 ? 'in_progress' : 'not_started',
        detail: hasSentProviderAction
          ? 'Sent to provider'
          : providerActions.length > 0
            ? `${providerActions.length} attempt(s), none confirmed sent`
            : 'Not started',
        linkPath: `/advisor/households/${householdId}/provider-hub`,
      },
      {
        key: 'report',
        label: 'Report',
        status: hasFinalReport ? 'done' : reportCases.length > 0 ? 'in_progress' : 'not_started',
        detail: hasFinalReport ? 'Final report on file' : reportCases.length > 0 ? 'Draft in progress' : 'Not started',
        linkPath: `/advisor/households/${householdId}/report-builder`,
      },
    ];

    return { householdId, steps };
  }
}
