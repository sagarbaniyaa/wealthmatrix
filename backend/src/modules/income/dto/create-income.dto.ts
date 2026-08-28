import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

const INCOME_TYPES = ['employment', 'self_employment', 'rental', 'dividend', 'pension', 'other'] as const;
const FREQUENCIES = ['annual', 'monthly', 'quarterly', 'one_off'] as const;

export class CreateIncomeDto {
  @IsUUID() personId: string;
  @IsIn(INCOME_TYPES) incomeType: (typeof INCOME_TYPES)[number];
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(0) amount: number;
  @IsUUID() currencyId: string;
  @IsOptional() @IsIn(FREQUENCIES) frequency?: (typeof FREQUENCIES)[number];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() notes?: string;
}
