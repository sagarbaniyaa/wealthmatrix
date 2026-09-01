import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { HouseholdEntity, AppUserEntity, FirmEntity, ReportCaseEntity, FactFindEntity, ReportCaseDetails } from '../../database/entities';
import { ReportTemplateService } from './report-template.service';
import { FactFindService } from '../fact-find/fact-find.service';
import { WealthConsolidationService } from '../wealth-consolidation/wealth-consolidation.service';
import { ClaudeClientService } from '../wealth-analyst/claude-client.service';

/**
 * The core of the Report Template Builder: takes a real example report
 * (uploaded once per report type — ISA setup, pension transfer,
 * crystallisation, etc.) plus a specific household's fact find and the
 * adviser's description of this particular case, and asks Claude to
 * draft a NEW report in the same structure/format, populated with the
 * new case's actual facts. Same discipline as every other AI feature
 * here: the model narrates/drafts from given data, it doesn't invent
 * figures, and the result is explicitly a draft for adviser review.
 */
@Injectable()
export class ReportBuilderService {
  private readonly logger = new Logger(ReportBuilderService.name);

  constructor(
    private readonly templates: ReportTemplateService,
    private readonly factFinds: FactFindService,
    private readonly wealthConsolidation: WealthConsolidationService,
    private readonly claude: ClaudeClientService,
  ) {}

  private get caseRepo() {
    return TenantContext.getManager().getRepository(ReportCaseEntity);
  }

  async listForHousehold(householdId: string): Promise<ReportCaseEntity[]> {
    return this.caseRepo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async findOneOrFail(id: string): Promise<ReportCaseEntity> {
    const row = await this.caseRepo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`Report case ${id} not found`);
    return row;
  }

  async updateContent(id: string, content: string | undefined, status?: 'draft' | 'final'): Promise<ReportCaseEntity> {
    const row = await this.findOneOrFail(id);
    if (content !== undefined) row.content = content;
    if (status) row.status = status;
    return this.caseRepo.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findOneOrFail(id);
    await this.caseRepo.remove(row);
  }

  async generate(params: {
    householdId: string; reportTemplateId: string; caseDetails: ReportCaseDetails; adviserId: string;
  }): Promise<ReportCaseEntity> {
    const manager = TenantContext.getManager();
    const template = await this.templates.findWithText(params.reportTemplateId);

    const household = await manager.getRepository(HouseholdEntity).findOne({ where: { id: params.householdId } as any });
    if (!household) throw new NotFoundException(`Household ${params.householdId} not found`);

    const factFind = await this.factFinds.findLatestCompleted(params.householdId);
    const netWorth = await this.wealthConsolidation.getHouseholdNetWorth(params.householdId).catch((err) => {
      this.logger.warn(`Net worth unavailable for report case ${params.householdId}: ${err}`);
      return null;
    });
    const adviser = await manager.getRepository(AppUserEntity).findOne({ where: { id: params.adviserId } as any });
    const firm = adviser ? await manager.getRepository(FirmEntity).findOne({ where: { id: adviser.firmId } as any }) : null;

    const caseRow = this.caseRepo.create({
      firmId: TenantContext.getFirmId(),
      householdId: params.householdId,
      reportTemplateId: template.id,
      reportTemplateVersion: template.version,
      reportType: template.reportType,
      caseDetails: params.caseDetails,
      status: 'draft',
      createdBy: params.adviserId,
    });

    try {
      const content = await this.claude.complete({
        system:
          'You are an AI drafting assistant for a UK financial advice firm. You are given a REFERENCE ' +
          `TEMPLATE — a real ${template.reportType.replace(/_/g, ' ')} report this firm has produced before — ` +
          'showing the exact section structure, headings, level of detail, and tone expected for this report ' +
          'type. You are also given real data for a DIFFERENT, new client case. Write a new report of the same ' +
          'type, mirroring the reference template\'s structure and section headings as closely as possible ' +
          '(mark each section with a "## Heading" line), populated entirely with the new case\'s actual data. ' +
          'Do not carry over ANY client-identifying detail from the reference template (names, numbers, dates, ' +
          'amounts, addresses) — it is a FORMAT guide only. Do not invent facts you were not given — where the ' +
          'template covers something not present in the data given to you, write exactly ' +
          '"[Not provided — adviser to complete]" in that spot rather than fabricating it. This is a working ' +
          'draft for the adviser to review, edit, and finalise before issue — it is not independent financial ' +
          'advice as generated.',
        user: JSON.stringify({
          referenceTemplate: template.extractedText,
          household: { name: household.name },
          factFind: factFind ? summariseFactFind(factFind) : null,
          netWorth,
          caseDetails: params.caseDetails,
          adviser: { name: adviser?.displayName ?? adviser?.email ?? null, firm: firm?.name ?? null, fcaReference: firm?.fcaReference ?? null },
        }, null, 2),
        maxTokens: 3000,
      });
      caseRow.content = content;
    } catch (err: any) {
      this.logger.warn(`Report generation failed for household ${params.householdId}, template ${template.id}: ${err?.message ?? err}`);
      caseRow.generationError = err?.message ?? 'AI generation is currently unavailable.';
    }

    return this.caseRepo.save(caseRow);
  }
}

function summariseFactFind(factFind: FactFindEntity) {
  return {
    status: factFind.status,
    completedOn: factFind.completedOn,
    reviewPurposes: factFind.reviewPurposes,
    riskScore: factFind.riskScore,
    riskCategory: factFind.riskCategory,
    riskCapacity: factFind.riskCapacity,
    incomeExpenditure: factFind.incomeExpenditure,
    assets: factFind.assets,
    liabilities: factFind.liabilities,
    insurance: factFind.insurance,
    investmentQuestions: factFind.investmentQuestions,
    retirementQuestions: factFind.retirementQuestions,
  };
}
