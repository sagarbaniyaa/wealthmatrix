import { IsArray, IsIn, IsObject, IsOptional } from 'class-validator';

// Deliberately shallow validation: each section is a big, variably-shaped
// JSONB blob (same convention as fund_screen.filters) rather than a tree
// of nested DTOs — the frontend owns the section shapes (see
// frontend/lib/fact-find-types.ts), the backend just persists them and
// scores the one part it needs to understand (riskQuestionnaire).
export class UpsertFactFindDto {
  @IsOptional() @IsIn(['draft', 'completed']) status?: 'draft' | 'completed';

  @IsOptional() @IsObject() reviewPurposes?: Record<string, unknown>;
  @IsOptional() @IsObject() personalCircumstances?: Record<string, unknown>;
  @IsOptional() @IsObject() incomeExpenditure?: Record<string, unknown>;
  @IsOptional() @IsObject() assets?: Record<string, unknown>;
  @IsOptional() @IsObject() liabilities?: Record<string, unknown>;
  @IsOptional() @IsObject() insurance?: Record<string, unknown>;
  @IsOptional() @IsObject() investmentQuestions?: Record<string, unknown>;
  @IsOptional() @IsObject() retirementQuestions?: Record<string, unknown>;
  @IsOptional() @IsObject() riskCapacity?: Record<string, unknown>;
  @IsOptional() @IsArray() riskQuestionnaire?: { questionKey: string; selectedOption: string }[];
  @IsOptional() @IsObject() declaration?: Record<string, unknown>;

  @IsOptional() completedOn?: string;
  @IsOptional() signedOn?: string;
}
