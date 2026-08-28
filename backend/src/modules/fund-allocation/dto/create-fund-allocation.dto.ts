import { IsDateString, IsIn, IsNumber, IsOptional } from 'class-validator';

const CATEGORIES = ['equity', 'fixed_income', 'cash', 'alternatives'] as const;

export class CreateFundAllocationDto {
  @IsIn(CATEGORIES) category: (typeof CATEGORIES)[number];
  @IsNumber() weightPct: number;
  @IsOptional() @IsDateString() asOfDate?: string;
}
