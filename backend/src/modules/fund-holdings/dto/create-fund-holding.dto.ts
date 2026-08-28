import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFundHoldingDto {
  @IsString() holdingName: string;
  @IsNumber() holdingWeightPct: number;
  @IsOptional() @IsDateString() asOfDate?: string;
}
