import { IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssetClass } from '../../../common/enums/domain.enums';

const SOURCE_OF_FUNDS = ['inheritance', 'platform_investment', 'employment_income', 'business_sale', 'other'] as const;

export class CreateAssetDto {
  @IsString() name: string;
  @IsEnum(AssetClass) assetClass: AssetClass;
  @IsOptional() @IsString() identifier?: string;
  @IsUUID() currencyId: string;
  @IsOptional() @IsBoolean() isLiability?: boolean;
  @IsOptional() @IsIn(SOURCE_OF_FUNDS) sourceOfFunds?: (typeof SOURCE_OF_FUNDS)[number];
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
