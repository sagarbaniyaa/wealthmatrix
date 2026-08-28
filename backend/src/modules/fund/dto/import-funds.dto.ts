import { IsOptional, IsString, MinLength } from 'class-validator';

export class ImportFundsDto {
  @IsString() @MinLength(1) csv: string;
  @IsOptional() @IsString() sourceLabel?: string;
}
