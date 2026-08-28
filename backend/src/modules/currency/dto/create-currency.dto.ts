import { IsOptional, IsString, Length } from 'class-validator';
export class CreateCurrencyDto {
  @IsString() @Length(3, 3) code: string;
  @IsString() name: string;
  @IsOptional() @IsString() symbol?: string;
}
