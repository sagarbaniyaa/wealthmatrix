import { IsArray, IsOptional, IsString } from 'class-validator';

export class CallSuggestionsDto {
  @IsString() transcript: string;
  @IsOptional() @IsArray() @IsString({ each: true }) alreadyShown?: string[];
}

export class FinishCallDto {
  @IsString() transcript: string;
}
