import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateHoldingDto {
  @IsUUID() accountId: string;
  @IsUUID() assetId: string;
  @IsDateString() asOfDate: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsNumber() marketValue: number;
  @IsUUID() currencyId: string;
  @IsOptional() @IsString() source?: string;
}
