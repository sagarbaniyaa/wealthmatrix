import { IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

const ASSET_CLASSES = ['equity', 'fixed_income', 'mixed_asset', 'money_market', 'property', 'alternative'] as const;

export class CreateFundDto {
  @IsString() name: string;
  @IsString() isin: string;
  @IsOptional() @IsString() sedol?: string;
  @IsString() sector: string;
  @IsIn(ASSET_CLASSES) assetClass: (typeof ASSET_CLASSES)[number];

  @IsOptional() @IsNumber() ocf?: number;
  @IsOptional() @IsNumber() yieldPct?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(7) riskRating?: number;
  @IsOptional() @IsNumber() volatilityPct?: number;
  @IsOptional() @IsNumber() maxDrawdownPct?: number;
  @IsOptional() @IsString() manager?: string;
  @IsOptional() @IsNumber() managerTenureYears?: number;
  @IsOptional() @IsNumber() esgScore?: number;
  @IsOptional() @IsUUID() currencyId?: string;
  @IsOptional() @IsDateString() inceptionDate?: string;
  @IsOptional() @IsNumber() aum?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() dataSource?: string;
}
