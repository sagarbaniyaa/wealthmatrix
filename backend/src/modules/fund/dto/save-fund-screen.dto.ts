import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class SaveFundScreenDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsObject() filters?: Record<string, unknown>;
}
