import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/database/tenant-context';
import { FactFindEntity, HouseholdMemberEntity, PersonEntity } from '../../database/entities';
import { scoreRiskQuestionnaire, RISK_CATEGORY_TO_TOLERANCE } from './risk-questionnaire.constants';

export interface UpsertFactFindInput {
  status?: 'draft' | 'completed';
  reviewPurposes?: Record<string, unknown>;
  personalCircumstances?: Record<string, unknown>;
  incomeExpenditure?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  liabilities?: Record<string, unknown>;
  insurance?: Record<string, unknown>;
  investmentQuestions?: Record<string, unknown>;
  retirementQuestions?: Record<string, unknown>;
  riskCapacity?: Record<string, unknown>;
  riskQuestionnaire?: { questionKey: string; selectedOption: string }[];
  declaration?: Record<string, unknown>;
  completedOn?: string;
  signedOn?: string;
}

@Injectable()
export class FactFindService {
  private get repo() {
    return TenantContext.getManager().getRepository(FactFindEntity);
  }

  async listForHousehold(householdId: string): Promise<FactFindEntity[]> {
    return this.repo.find({ where: { householdId } as any, order: { createdAt: 'DESC' } as any });
  }

  async findOneOrFail(id: string): Promise<FactFindEntity> {
    const row = await this.repo.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(`Fact find ${id} not found`);
    return row;
  }

  /** Most recent completed fact find for a household, or null — what the Suitability Report reads from. */
  async findLatestCompleted(householdId: string): Promise<FactFindEntity | null> {
    return this.repo.findOne({ where: { householdId, status: 'completed' } as any, order: { completedOn: 'DESC', updatedAt: 'DESC' } as any });
  }

  async create(householdId: string, input: UpsertFactFindInput, createdBy: string): Promise<FactFindEntity> {
    const entity = this.repo.create({
      firmId: TenantContext.getFirmId(),
      householdId,
      createdBy,
      ...toEntityFields(input),
    });
    const withScore = applyRiskScore(entity, input.riskQuestionnaire);
    const saved = await this.repo.save(withScore);
    await this.syncRiskToleranceIfCompleted(saved);
    return saved;
  }

  async update(id: string, input: UpsertFactFindInput): Promise<FactFindEntity> {
    const existing = await this.findOneOrFail(id);
    Object.assign(existing, toEntityFields(input));
    const withScore = applyRiskScore(existing, input.riskQuestionnaire ?? (existing.riskQuestionnaire as any));
    const saved = await this.repo.save(withScore);
    await this.syncRiskToleranceIfCompleted(saved);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOneOrFail(id);
    await this.repo.remove(existing);
  }

  /**
   * On marking a fact find "completed", push the computed ATR category
   * onto the primary household member's Person.riskTolerance (3-band),
   * the same field FundSuitabilityService already reads — so completing
   * a fact find keeps Fund Suitability results current without a
   * separate manual step. Same "primary member" heuristic used
   * throughout (relationship='head', else first member).
   */
  private async syncRiskToleranceIfCompleted(factFind: FactFindEntity): Promise<void> {
    if (factFind.status !== 'completed' || !factFind.riskCategory) return;
    const manager = TenantContext.getManager();
    const members = await manager.getRepository(HouseholdMemberEntity).find({ where: { householdId: factFind.householdId } as any });
    const primaryMember = members.find((m) => m.relationship === 'head') ?? members[0] ?? null;
    if (!primaryMember) return;
    const tolerance = RISK_CATEGORY_TO_TOLERANCE[factFind.riskCategory as keyof typeof RISK_CATEGORY_TO_TOLERANCE];
    if (!tolerance) return;
    await manager.getRepository(PersonEntity).update(primaryMember.personId, { riskTolerance: tolerance });
  }
}

function toEntityFields(input: UpsertFactFindInput): Partial<FactFindEntity> {
  const fields: Partial<FactFindEntity> = {};
  if (input.status !== undefined) fields.status = input.status;
  if (input.reviewPurposes !== undefined) fields.reviewPurposes = input.reviewPurposes;
  if (input.personalCircumstances !== undefined) fields.personalCircumstances = input.personalCircumstances;
  if (input.incomeExpenditure !== undefined) fields.incomeExpenditure = input.incomeExpenditure;
  if (input.assets !== undefined) fields.assets = input.assets;
  if (input.liabilities !== undefined) fields.liabilities = input.liabilities;
  if (input.insurance !== undefined) fields.insurance = input.insurance;
  if (input.investmentQuestions !== undefined) fields.investmentQuestions = input.investmentQuestions;
  if (input.retirementQuestions !== undefined) fields.retirementQuestions = input.retirementQuestions;
  if (input.riskCapacity !== undefined) fields.riskCapacity = input.riskCapacity;
  if (input.riskQuestionnaire !== undefined) fields.riskQuestionnaire = input.riskQuestionnaire;
  if (input.declaration !== undefined) fields.declaration = input.declaration;
  if (input.completedOn !== undefined) fields.completedOn = input.completedOn;
  if (input.signedOn !== undefined) fields.signedOn = input.signedOn;
  return fields;
}

function applyRiskScore<T extends FactFindEntity>(entity: T, riskQuestionnaire: { questionKey: string; selectedOption: string }[] | undefined): T {
  if (!riskQuestionnaire) return entity;
  const result = scoreRiskQuestionnaire(riskQuestionnaire);
  entity.riskScore = result?.score ?? null;
  entity.riskCategory = result?.category ?? null;
  return entity;
}
