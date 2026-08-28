import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
export class CreateExchangeRateDto {
  @IsUUID() fromCurrencyId: string;
  @IsUUID() toCurrencyId: string;
  @IsDateString() rateDate: string;
  @IsNumber() @Min(0.0000000001) rate: number;
  @IsOptional() @IsString() source?: string;
}
