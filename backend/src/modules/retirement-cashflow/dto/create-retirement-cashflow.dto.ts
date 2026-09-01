import { IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class RetirementCashflowInputsDto {
  @IsNumber() @Min(18) @Max(100) currentAge: number;
  @IsNumber() @Min(18) @Max(100) retirementAge: number;
  @IsNumber() @Min(18) @Max(120) planToAge: number;
  @IsNumber() @Min(0) currentPotValue: number;
  @IsNumber() @Min(0) monthlyContribution: number;
  @IsNumber() @Min(0) desiredAnnualIncome: number;
  @IsNumber() @Min(-20) @Max(20) expectedReturnPct: number;
  @IsNumber() @Min(0) @Max(50) returnVolatilityPct: number;
}

export class CreateRetirementCashflowDto {
  @IsOptional() @IsString() name?: string;
  @IsObject() @ValidateNested() @Type(() => RetirementCashflowInputsDto) inputs: RetirementCashflowInputsDto;
}
