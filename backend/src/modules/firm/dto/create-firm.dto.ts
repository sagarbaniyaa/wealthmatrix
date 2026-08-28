import { IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateFirmDto {
  @IsString() name: string;
  @IsOptional() @IsUUID() baseCurrencyId?: string;
  @IsOptional() @IsString() fcaReference?: string;
}
