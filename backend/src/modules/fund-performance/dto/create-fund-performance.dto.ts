import { IsDateString, IsIn, IsNumber, IsOptional } from 'class-validator';

const PERIODS = ['YTD', '1Y', '3Y', '5Y'] as const;

export class CreateFundPerformanceDto {
  @IsIn(PERIODS) period: (typeof PERIODS)[number];
  @IsNumber() returnPct: number;
  @IsOptional() @IsDateString() asOfDate?: string;
}
