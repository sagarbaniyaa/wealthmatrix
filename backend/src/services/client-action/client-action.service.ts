import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import {
  HouseholdActionEntity, ChargeProjectionEntity, ConsumerDutyReviewEntity, ComplianceProviderActionEntity,
  ReportCaseEntity, ReportTemplateEntity, LoaTemplateEntity, PersonEntity, HouseholdMemberEntity,
} from '../../database/entities';
import { ClientDocumentService } from '../../modules/client-document/client-document.service';
import { FactFindService } from '../fact-find/fact-find.service';
import { DfmRecommendationService } from '../dfm-recommendation/dfm-recommendation.service';
import { ACTION_REQUIREMENTS, ActionType, ComplianceCheckKey } from './action-requirements.constants';

export interface ActionChecklistDocument {
  type: string; label: string; satisfied: boolean; latestFileName: string | null; extractionStatus: string | null;
}
export interface ActionChecklistCheck {
  key: ComplianceCheckKey; label: string; satisfied: boolean; detail: string;
}
export interface ActionChecklist {
  actionType: ActionType;
  label: string;
  notes: string | null;
  selectedAt: string;
  documents: ActionChecklistDocument[];
  complianceChecks: ActionChecklistCheck[];
  suitability: { sectionLabel: string; templateFound: boolean; templateId: string | null; reportCaseId: string | null; reportCaseStatus: string | null };
  provider: { required: boolean; hasAction: boolean; latestStatus: string | null };
  dfm: { relevant: boolean; hasRecommendation: boolean; latestMandate: string | null };
  loa: { hasActiveTemplate: boolean };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * The "What are we doing for this client?" orchestrator (spec §3):
 * selecting an action doesn't create new data, it picks which fixed
 * requirements (action-requirements.constants.ts) to check against
 * every other module's REAL data — documents, Fact Find, charge
 * projections, Consumer Duty reviews, DFM recommendations, provider
 * sends, report templates/cases, LOA templates. A household can have a
 * history of actions over time (append-only), and the checklist always
 * reflects the CURRENT (latest) one.
 */
@Injectable()
export class ClientActionService {
  constructor(
    private readonly clientDocuments: ClientDocumentService,
    private readonly factFinds: FactFindService,
    private readonly dfmRecommendations: DfmRecommendationService,
  ) {}

  private get repo() {
    return TenantContext.getManager().getRepository(HouseholdActionEntity);
  }

  async setAction(householdId: string, actionType: ActionType, notes: string | undefined, selectedBy: string): Promise<HouseholdActionEntity> {
    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(), householdId, actionType, notes: notes ?? null, selectedBy,
    });
    return this.repo.save(entity);
  }

  async getCurrent(householdId: string): Promise<HouseholdActionEntity | null> {
    return this.repo.findOne({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async getHistory(householdId: string): Promise<HouseholdActionEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async getChecklist(householdId: string): Promise<ActionChecklist | null> {
    const current = await this.getCurrent(householdId);
    if (!current) return null;

    const requirements = ACTION_REQUIREMENTS[current.actionType as ActionType];
    if (!requirements) return null; // an unrecognised/legacy action_type value — nothing to check against

    const manager = TenantContext.getManager();

    const documents = await this.clientDocuments.listForHousehold(householdId);
    const documentChecklist: ActionChecklistDocument[] = requirements.requiredDocuments.map(({ type, label }) => {
      const matches = documents.filter((d) => d.documentType === type).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const latest = matches[0] ?? null;
      return {
        type, label, satisfied: !!latest,
        latestFileName: latest?.fileName ?? null,
        extractionStatus: latest?.extractionStatus ?? null,
      };
    });

    const factFinds = await this.factFinds.listForHousehold(householdId);
    const completedFactFind = factFinds.find((f) => f.status === 'completed') ?? null;

    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    const primaryPerson = primaryMember
      ? await manager.getRepository(PersonEntity).findOne({ where: { id: primaryMember.personId } as any })
      : null;
    const hasRiskProfile = !!completedFactFind?.riskCategory || !!primaryPerson?.riskTolerance;

    const chargeProjectionCount = await manager.getRepository(ChargeProjectionEntity).count({ where: { householdId } as any });
    const consumerDutyCount = await manager.getRepository(ConsumerDutyReviewEntity).count({ where: { householdId } as any });

    const CHECK_RESULTS: Record<ComplianceCheckKey, { satisfied: boolean; detail: string }> = {
      fact_find_completed: {
        satisfied: !!completedFactFind,
        detail: completedFactFind ? `Completed ${completedFactFind.completedOn ?? ''}`.trim() : 'No completed Fact Find on file.',
      },
      risk_profile_recorded: {
        satisfied: hasRiskProfile,
        detail: hasRiskProfile ? (completedFactFind?.riskCategory ? `ATR: ${completedFactFind.riskCategory}` : `Recorded: ${primaryPerson?.riskTolerance}`) : 'No risk profile recorded.',
      },
      charges_compared: {
        satisfied: chargeProjectionCount > 0,
        detail: chargeProjectionCount > 0 ? `${chargeProjectionCount} charge projection(s) on file.` : 'No charge projection run yet — use Projections.',
      },
      consumer_duty_assessed: {
        satisfied: consumerDutyCount > 0,
        detail: consumerDutyCount > 0 ? `${consumerDutyCount} Consumer Duty review(s) on file.` : 'No Consumer Duty outcome review recorded yet.',
      },
    };
    const complianceChecklist: ActionChecklistCheck[] = requirements.complianceChecks.map(({ key, label }) => ({
      key, label, satisfied: CHECK_RESULTS[key].satisfied, detail: CHECK_RESULTS[key].detail,
    }));

    const activeTemplates = await manager.getRepository(ReportTemplateEntity).find({ where: { isActive: true } as any });
    const matchingTemplate = activeTemplates.find((t) => normalize(t.reportType) === normalize(requirements.suitabilitySectionLabel)) ?? null;
    let reportCase: ReportCaseEntity | null = null;
    if (matchingTemplate) {
      const cases = await manager.getRepository(ReportCaseEntity).find({
        where: { householdId, reportType: matchingTemplate.reportType } as any, order: { createdAt: 'DESC' } as any,
      });
      reportCase = cases[0] ?? null;
    }

    const providerActions = await manager.getRepository(ComplianceProviderActionEntity).find({
      where: { householdId } as any, order: { createdAt: 'DESC' } as any,
    });

    let dfmHasRecommendation = false;
    let dfmLatestMandate: string | null = null;
    if (requirements.relevantToDfm) {
      const recs = await this.dfmRecommendations.listForHousehold(householdId);
      dfmHasRecommendation = recs.length > 0;
      dfmLatestMandate = recs[0]?.mandate ?? null;
    }

    const loaTemplateCount = await manager.getRepository(LoaTemplateEntity).count({ where: { isActive: true } as any });

    return {
      actionType: current.actionType as ActionType,
      label: requirements.label,
      notes: current.notes,
      selectedAt: current.createdAt.toISOString(),
      documents: documentChecklist,
      complianceChecks: complianceChecklist,
      suitability: {
        sectionLabel: requirements.suitabilitySectionLabel,
        templateFound: !!matchingTemplate,
        templateId: matchingTemplate?.id ?? null,
        reportCaseId: reportCase?.id ?? null,
        reportCaseStatus: reportCase?.status ?? null,
      },
      provider: {
        required: requirements.requiresProvider,
        hasAction: providerActions.length > 0,
        latestStatus: providerActions[0]?.emailStatus ?? null,
      },
      dfm: { relevant: requirements.relevantToDfm, hasRecommendation: dfmHasRecommendation, latestMandate: dfmLatestMandate },
      loa: { hasActiveTemplate: loaTemplateCount > 0 },
    };
  }
}
