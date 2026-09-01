import { IsString, MinLength } from 'class-validator';

export class ParseFactFindNotesDto {
  @IsString() @MinLength(10) notes: string;
}
